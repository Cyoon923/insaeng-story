/**
 * NICEPAY 인증 결과 수신(returnUrl).
 *
 * NICEPAY가 고객 브라우저를 통해 크로스사이트로 POST하므로 세션 쿠키(SameSite=Lax)가
 * 오지 않는다. 따라서 getUserId()를 쓰지 않고, 결제 대상 회원은 오직
 * payments.order_snapshot.userId로만 식별한다.
 *
 * 이 단계(4-2b-1)는 검증과 승인 API 호출까지만 한다.
 * TODO(4-2b-2): approval success must be persisted/finalized before production payment test.
 * (승인 성공 뒤 payment paid 확정·주문/상담 생성이 아직 연결되지 않았다)
 */
import {
  applyFreeCoupon,
  applyPoints,
  applyReferral,
} from "@/lib/server/applyOrder";
import { isSlotAvailable, parseDatetime } from "@/lib/server/consultationSlots";
import {
  approveNicepayPayment,
  nicepayClientKey,
  nicepayConfigured,
  verifyReturnSignature,
} from "@/lib/server/nicepayApprove";
import { calcConsultationAmount, calcOrderAmount } from "@/lib/server/pricing";
import { getPaymentByMerchantOrderId, readData } from "@/lib/server/store";
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

  // 5~6) 결제 준비 기록 확인
  const payment = await getPaymentByMerchantOrderId(merchantOrderId);
  if (!payment || payment.provider !== "nicepay") {
    return failed("결제 내역을 찾을 수 없습니다.");
  }

  // 7) ready가 아니면 승인 API를 부르지 않는다. 이미 paid면 중복 콜백이다.
  if (payment.status === "paid") {
    return page(
      "이미 처리된 결제입니다",
      "같은 결제가 이미 접수되어 있습니다. 진행 상황은 MY에서 확인하실 수 있습니다.",
      200,
    );
  }
  if (payment.status !== "ready") {
    return failed("이미 종료된 결제입니다.");
  }

  // 8~9) 스냅샷과 회원 확인
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
  if (!draftUser) {
    return failed("회원 정보를 확인하지 못했습니다.");
  }

  // 10) 금액 1차 대조
  if (returnAmount !== payment.requestedAmount || returnAmount !== snapshotAmount) {
    return failed("결제 금액이 일치하지 않습니다.");
  }

  // 11) 할인 재검증. 판단 근거는 snapshot.discount뿐이고 details 문자열은 쓰지 않는다.
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

  // 12) 상담은 승인 직전에 슬롯을 다시 확인한다. 점유는 하지 않는다.
  if (kind === "consultation") {
    const teacher = String(request_.teacher ?? "유비 선생");
    const parsed = parseDatetime(String(request_.datetime ?? ""));
    if (!parsed) return failed("상담 시간을 확인하지 못했습니다.");
    if (!isSlotAvailable(data, teacher, parsed.date, parsed.time)) {
      return failed("선택하신 상담 시간이 이미 예약되었습니다. 다른 시간을 선택해 주세요.");
    }
  }

  // 13) 여기까지 통과한 경우에만 승인한다. 금액은 서버가 확정한 값만 쓴다.
  const outcome = await approveNicepayPayment({ tid, amount: recalculated });
  if (!outcome.ok) {
    return failed(outcome.reason || "카드사 승인이 완료되지 않았습니다.");
  }

  // 승인은 성공했지만 내부 확정(주문 생성·paid 기록)은 아직 연결되지 않았다.
  // 그래서 "결제 완료"라고 표시하지 않는다.
  return page(
    "결제 확인 중입니다",
    "카드사 확인이 끝났습니다. 접수 처리가 완료되면 안내해 드리겠습니다.",
    200,
  );
}
