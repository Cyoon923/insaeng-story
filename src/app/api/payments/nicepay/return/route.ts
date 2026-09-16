/**
 * NICEPAY 인증 결과 수신(returnUrl).
 *
 * NICEPAY가 고객 브라우저를 통해 크로스사이트로 POST하므로 세션 쿠키(SameSite=Lax)가
 * 오지 않는다. 따라서 getUserId()를 쓰지 않고, 결제 대상 회원은 오직
 * payments.order_snapshot.userId로만 식별한다.
 *
 * 상태 흐름: ready → (선점) processing → 승인 → paid → 주문/상담 확정 → order_id 연결.
 * 승인 여부를 확정할 수 없는 통신 오류에서는 상태를 바꾸지 않고 processing으로 남긴다.
 */
import {
  applyFreeCoupon,
  applyPoints,
  applyReferral,
  commitConsultation,
  commitOrder,
  consultationIdForPayment,
  orderIdForPayment,
} from "@/lib/server/applyOrder";
import { isSlotAvailable, parseDatetime } from "@/lib/server/consultationSlots";
import {
  approveNicepayPayment,
  nicepayClientKey,
  nicepayConfigured,
  verifyReturnSignature,
} from "@/lib/server/nicepayApprove";
import { calcConsultationAmount, calcOrderAmount } from "@/lib/server/pricing";
import {
  claimPaymentApproved,
  claimPaymentProcessing,
  getPaymentByMerchantOrderId,
  markPaymentFailed,
  readData,
  writeDataWithOrderForPayment,
} from "@/lib/server/store";
import { isActiveUser } from "@/lib/server/withdrawAccount";
import type { CouponProduct, Order } from "@/lib/types/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_SUCCESS = "0000";

/** 화면에는 짧은 안내만 남긴다. PG 응답 원문·secret·스냅샷은 절대 내보내지 않는다. */
function page(title: string, message: string, status: number): Response {
  const body = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:48px 20px;font-family:system-ui,-apple-system,sans-serif;background:#FAF7F2;color:#403A49;text-align:center">
<h1 style="font-size:22px;line-height:1.5">${title}</h1>
<p style="font-size:16px;line-height:1.7;color:#6B6570">${message}</p>
<p style="margin-top:28px"><a href="/" style="font-size:16px;color:#5c3d2e">홈으로 이동</a></p>
</body></html>`;
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function failed(message: string): Response {
  return page("결제를 완료하지 못했습니다", message, 200);
}

/**
 * 결제가 이미 이뤄졌거나 결과를 확정할 수 없는 상태.
 * 여기서는 절대 "결제 실패"라고 말하지 않는다. 중복 결제를 유도하기 때문이다.
 */
function pending(message: string): Response {
  return page("결제 확인 중입니다", message, 200);
}

/** 접수까지 끝난 건은 기존 완료 화면으로 보낸다. Lax 세션 쿠키는 이 GET에 다시 실린다. */
function completed(request: Request, type: "order" | "consult", id: string): Response {
  const location = new URL(
    `/apply/complete?type=${type}&id=${encodeURIComponent(id)}`,
    request.url,
  ).toString();
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** 금액은 양의 정수만 인정한다. */
function positiveInt(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

export async function POST(request: Request) {
  if (!nicepayConfigured()) {
    return failed("결제 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.");
  }

  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "").trim();

  // 1) 인증 결과. 실패면 승인 API를 부르지 않는다.
  const authResultCode = field("authResultCode");
  if (authResultCode !== AUTH_SUCCESS) {
    return failed("카드 인증이 취소되었거나 완료되지 않았습니다.");
  }

  // 2) 필수 필드
  const tid = field("tid");
  const clientId = field("clientId");
  const merchantOrderId = field("orderId");
  const amountText = field("amount");
  const authToken = field("authToken");
  const signature = field("signature");
  const returnAmount = positiveInt(amountText);
  if (!tid || !clientId || !merchantOrderId || !authToken || !signature || returnAmount === null) {
    return failed("결제 정보를 확인하지 못했습니다.");
  }

  // 3) 우리 가맹점 건인지
  if (clientId !== nicepayClientKey()) {
    return failed("결제 정보를 확인하지 못했습니다.");
  }

  // 4) 위변조 검증. amount는 받은 문자열 그대로 넣어야 해시가 맞는다.
  if (!verifyReturnSignature({ authToken, clientId, amount: amountText, signature })) {
    return failed("결제 정보를 확인하지 못했습니다.");
  }

  // 4) 결제 준비 기록 확인
  const payment = await getPaymentByMerchantOrderId(merchantOrderId);
  if (!payment || payment.provider !== "nicepay") {
    return failed("결제 내역을 찾을 수 없습니다.");
  }

  // 5) 빠른 경로. 이미 끝난 건이면 아래 검증까지 갈 필요가 없다.
  if (payment.status === "paid") {
    if (payment.orderId) {
      const type = String(payment.orderSnapshot?.kind ?? "") === "consultation" ? "consult" : "order";
      return completed(request, type, payment.orderId);
    }
    return pending("결제는 완료되었으나 접수 처리를 확인 중입니다.");
  }
  if (payment.status === "processing") {
    return pending("결제 결과를 확인하고 있습니다. 잠시 후 MY에서 확인해 주세요.");
  }
  if (payment.status !== "ready") {
    return failed("이미 종료된 결제입니다.");
  }

  // 5) 스냅샷과 회원 확인
  const snapshot = payment.orderSnapshot;
  const request_ = asObject(snapshot?.request);
  const discount = asObject(snapshot?.discount);
  const kind = String(snapshot?.kind ?? "");
  const userId = String(snapshot?.userId ?? "");
  const snapshotAmount = positiveInt(snapshot?.amount);
  if (!snapshot || !request_ || !discount || !userId || snapshotAmount === null) {
    return failed("결제 정보를 확인하지 못했습니다.");
  }
  if (kind !== "order" && kind !== "consultation") {
    return failed("결제 정보를 확인하지 못했습니다.");
  }

  // 계산은 저장하지 않는 사본 위에서만 한다. 쿠폰·적립금·추천인 상태를 바꾸지 않는다.
  const data = await readData();
  const draft = structuredClone(data);
  const draftUser = draft.users.find((item) => item.id === userId);
  // 탈퇴한 회원의 결제는 승인하지 않는다. 결제창을 연 뒤 다른 탭에서 탈퇴했을 수 있다.
  // 회원 행은 탈퇴해도 남으므로 존재 여부만으로는 가려낼 수 없다.
  // 여기는 승인 API를 부르기 전이라 이 시점에 막으면 돈이 나가지 않는다.
  if (!isActiveUser(draftUser)) {
    return failed("회원 정보를 확인하지 못했습니다.");
  }

  // 5) 금액 1차 대조
  if (returnAmount !== payment.requestedAmount || returnAmount !== snapshotAmount) {
    return failed("결제 금액이 일치하지 않습니다.");
  }

  // 6) 할인 재검증. 판단 근거는 snapshot.discount뿐이고 details 문자열은 쓰지 않는다.
  const couponId = typeof discount.couponId === "string" ? discount.couponId : "";
  const referralCode = typeof discount.referralCode === "string" ? discount.referralCode : "";
  const usePoints = Number(discount.usePoints ?? 0);
  if (!Number.isInteger(usePoints) || usePoints < 0) {
    return failed("결제 정보를 확인하지 못했습니다.");
  }
  const verifyDetails: Record<string, string> = {
    couponId,
    referralCode,
    usePoints: usePoints > 0 ? "1" : "",
  };

  let couponProduct: CouponProduct;
  let basePrice: number;
  if (kind === "order") {
    const priced = calcOrderAmount(request_.product, request_.options);
    if (!priced) return failed("신청 내용을 확인하지 못했습니다.");
    couponProduct = request_.product as Order["product"];
    basePrice = priced.amount;
  } else {
    const priced = calcConsultationAmount({
      report: request_.report,
      extraPerson: request_.extraPerson,
    });
    couponProduct = "consultation";
    basePrice = priced.amount;
  }

  // preparePayment와 같은 순서·조건으로 계산한다.
  const couponed = applyFreeCoupon(draft, userId, verifyDetails, basePrice, couponProduct);
  if (couponed.error) return failed("할인 정보를 다시 확인해 주세요.");
  const referred =
    couponed.amount > 0
      ? applyReferral(draft, userId, couponed.details, couponed.amount)
      : couponed;
  if (referred.error) return failed("할인 정보를 다시 확인해 주세요.");
  const pointed = applyPoints(draftUser, referred.details, referred.amount);
  const recalculated = pointed.amount;

  if (recalculated !== snapshotAmount || recalculated !== returnAmount) {
    return failed("결제 금액을 다시 확인해 주세요.");
  }

  // 7) 상담은 승인 전에 슬롯을 다시 확인한다. 점유는 하지 않는다.
  if (kind === "consultation") {
    const teacher = String(request_.teacher ?? "유비 선생");
    const parsed = parseDatetime(String(request_.datetime ?? ""));
    if (!parsed) return failed("상담 시간을 확인하지 못했습니다.");
    if (!isSlotAvailable(data, teacher, parsed.date, parsed.time)) {
      return failed("선택하신 상담 시간이 이미 예약되었습니다. 다른 시간을 선택해 주세요.");
    }
  }

  // 8) 승인 API를 부르기 전에 결제 1건을 선점한다.
  //    같은 결제로 콜백이 동시에 두 번 들어와도 여기서 하나만 통과한다.
  const claimed = await claimPaymentProcessing(merchantOrderId);
  if (!claimed) {
    // 9) 선점하지 못한 요청은 승인도 주문 생성도 하지 않고 현재 상태만 안내한다.
    const current = await getPaymentByMerchantOrderId(merchantOrderId);
    if (current?.status === "paid") {
      if (current.orderId) {
        return completed(request, kind === "consultation" ? "consult" : "order", current.orderId);
      }
      return pending("결제는 완료되었으나 접수 처리를 확인 중입니다.");
    }
    if (current?.status === "processing") {
      return pending("결제 결과를 확인하고 있습니다. 잠시 후 MY에서 확인해 주세요.");
    }
    if (current?.status === "cancelled" || current?.status === "partialCancelled") {
      return failed("취소된 결제입니다.");
    }
    if (current?.status === "failed") {
      return failed("결제가 완료되지 않았습니다.");
    }
    // ready로 남아 있는 경우(선점 직전 다른 처리로 상태가 되돌아간 극히 짧은 상황)에도
    // 승인 API를 다시 부르지 않는다.
    return pending("결제 결과를 확인하고 있습니다. 잠시 후 MY에서 확인해 주세요.");
  }

  // 10) 여기까지 온 요청만 승인한다. 금액은 서버가 확정한 값만 쓴다.
  const outcome = await approveNicepayPayment({ tid, amount: recalculated });

  // 11-B) 결과를 확정할 수 없으면 상태를 바꾸지 않는다.
  //       processing으로 남겨 두고 사람이 확인한다. 결제 실패라고 말하지 않는다.
  if (outcome.kind === "unknown") {
    return pending("결제 결과를 확인하고 있습니다. 잠시 후 MY에서 확인해 주세요.");
  }

  // 11-A) 명확한 승인 거절일 때만 failed로 확정한다.
  if (outcome.kind === "declined") {
    await markPaymentFailed({ merchantOrderId, raw: outcome.raw });
    return failed(outcome.reason || "카드사 승인이 완료되지 않았습니다.");
  }

  // 11-C) 승인 성공. 주문을 만들기 전에 결제부터 paid로 확정한다.
  //       이 UPDATE가 먼저 성공해야 저장이 실패해도 "돈은 받았고 주문은 없다"는 사실이 남는다.
  const paid = await claimPaymentApproved({
    merchantOrderId,
    pgTid: outcome.result?.tid ?? tid,
    approvedAmount: recalculated,
    method: outcome.result?.payMethod ?? null,
    approvedAt: outcome.result?.paidAt ?? null,
    raw: outcome.raw,
  });
  if (!paid) {
    // 내가 선점한 건이 아니게 됐다는 뜻이므로 주문을 만들지 않는다.
    return pending("결제 결과를 확인하고 있습니다. 잠시 후 MY에서 확인해 주세요.");
  }

  // 12~13) paid가 된 요청만 주문/상담을 확정한다.
  //        쿠폰 사용·적립금 차감·추천인 적립은 여기(commit*)에서 처음 실제로 반영된다.
  const liveData = await readData();
  const liveUser = liveData.users.find((item) => item.id === userId);
  // 승인과 이 사이에 탈퇴가 끝났을 수도 있다. 그때는 주문을 만들지 않는다.
  // 다만 돈은 이미 승인된 뒤라 실패라고 말하지 않는다. 기존처럼 pending으로 두고
  // paid + order_id NULL 상태를 운영자 복구 대상으로 남긴다.
  if (!isActiveUser(liveUser)) {
    return pending("결제는 완료되었으나 접수 처리를 확인 중입니다.");
  }
  // 할인 의도는 snapshot.discount가 기준이다. details의 할인 문자열로 덮이지 않게 한다.
  const commitDetails: Record<string, string> = {
    ...((asObject(snapshot.details) ?? {}) as Record<string, string>),
    couponId,
    referralCode,
    usePoints: usePoints > 0 ? "1" : "",
  };

  try {
    if (kind === "order") {
      const result = await commitOrder(
        liveData,
        liveUser,
        {
          product: request_.product,
          title: request_.title,
          options: request_.options,
          payment: request_.payment,
          details: commitDetails,
        },
        {
          orderId: orderIdForPayment(merchantOrderId),
          write: (next, order) => writeDataWithOrderForPayment(next, order, merchantOrderId),
          // 승인이 끝난 뒤에만 유료 금액을 확정할 수 있다. 위 claimPaymentApproved가 성공한 지점이다.
          mode: "paid-approved",
        },
      );
      if (!result.ok) {
        return pending("결제는 완료되었으나 접수 처리를 확인 중입니다.");
      }
      return completed(request, "order", result.order.id);
    }

    const result = await commitConsultation(
      liveData,
      liveUser,
      {
        title: request_.title,
        report: request_.report,
        extraPerson: request_.extraPerson,
        payment: request_.payment,
        teacher: request_.teacher,
        datetime: request_.datetime,
        purpose: request_.purpose,
        method: request_.method,
        option: request_.option,
        details: commitDetails,
      },
      {
        consultationId: consultationIdForPayment(merchantOrderId),
        write: (next, order) => writeDataWithOrderForPayment(next, order, merchantOrderId),
        // 주문과 같다. 승인 성공 뒤에만 유료 상담을 확정한다.
        mode: "paid-approved",
      },
    );
    if (!result.ok) {
      // 슬롯이 그사이 찼거나 저장에 실패한 경우. 결제는 이미 성공했으므로
      // 결제 실패로 안내하지 않는다. payment는 paid + order_id NULL로 남아 복구 대상이 된다.
      return pending("결제는 완료되었으나 접수 처리를 확인 중입니다.");
    }
    return completed(request, "consult", result.consultation.id);
  } catch {
    // 저장 실패. paid + order_id NULL을 그대로 두고 사람이 복구한다.
    return pending("결제는 완료되었으나 접수 처리를 확인 중입니다.");
  }
}
