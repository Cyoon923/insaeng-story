/**
 * 관리자 결제 재접수.
 *
 * NICEPAY 승인은 끝났는데(status = paid) 주문·상담 저장이 밀려
 * payments.order_id가 비어 있는 건을 다시 접수한다.
 * 관리자 화면의 "결제 완료 / 접수 확인 필요"(unlinked) 목록이 대상이다.
 *
 * 이 API는 결제를 다시 승인하지 않는다. PG를 부르지도, 결제 상태를 바꾸지도 않는다.
 * 하는 일은 둘 중 하나뿐이다.
 *  - 주문·상담이 아직 없으면: 기존 commitOrder / commitConsultation으로 다시 접수한다.
 *  - 이미 있으면:            payments.order_id만 연결한다(commit을 다시 부르지 않는다).
 *
 * 두 번째 갈래가 특히 중요하다. commit*은 부를 때마다 쿠폰 사용·적립금 차감·추천인 적립을
 * 다시 수행하고 app_store JSONB에는 ON CONFLICT 보호가 없다.
 * 이미 접수된 건에 commit을 다시 부르면 할인 자원이 이중으로 빠져나간다.
 */
import { NextResponse } from "next/server";
import {
  applyFreeCoupon,
  applyPoints,
  applyReferral,
  commitConsultation,
  commitOrder,
  consultationIdForPayment,
  orderIdForPayment,
} from "@/lib/server/applyOrder";
import { badRequest, readJsonBody, requireAdmin } from "@/lib/server/chatInquiryApi";
import { readServerConsentedAt } from "@/lib/server/consents";
import { calcConsultationAmount, calcOrderAmount } from "@/lib/server/pricing";
import {
  getPaymentByMerchantOrderId,
  isAppStoreConflict,
  linkPaymentToOrder,
  readData,
  writeDataWithOrderForPayment,
} from "@/lib/server/store";
import { isActiveUser } from "@/lib/server/withdrawAccount";
import type { CouponProduct, Order } from "@/lib/types/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/** 자동 복구하지 않고 사람이 확인해야 하는 건. 결제는 그대로 둔다. */
function manual(reason: string) {
  return NextResponse.json({ ok: false, needsManualReview: true, reason }, { status: 409 });
}

export async function POST(request: Request) {
  // 1) 관리자 확인이 가장 먼저다.
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body) return badRequest("요청 형식을 확인해 주세요.");
  const merchantOrderId = String(body.merchantOrderId ?? "").trim();
  if (!merchantOrderId) return badRequest("주문번호를 입력해 주세요.");

  // 2) 결제 기록 확인. 여기서 읽은 값만 근거로 쓴다.
  const payment = await getPaymentByMerchantOrderId(merchantOrderId);
  if (!payment) {
    return NextResponse.json({ error: "결제 내역을 찾을 수 없습니다." }, { status: 404 });
  }

  // 3) 자동 복구 대상인지. 승인이 끝났고 아직 연결되지 않은 건만 다룬다.
  if (payment.provider !== "nicepay") return manual("NICEPAY 결제가 아닙니다.");
  if (payment.status !== "paid") {
    return manual(`승인이 확정되지 않은 결제입니다(${payment.status}).`);
  }
  if (payment.orderId) {
    // 이미 연결되어 있으면 할 일이 없다. 같은 요청이 두 번 와도 안전하게 끝난다.
    return NextResponse.json({ ok: true, alreadyLinked: true, orderId: payment.orderId });
  }
  const approvedAmount = payment.approvedAmount;
  if (approvedAmount === null) return manual("승인 금액이 기록되어 있지 않습니다.");

  // 4) 스냅샷 필수 정보. 전부 서버(preparePayment)가 만든 값이다.
  const snapshot = payment.orderSnapshot;
  const request_ = asObject(snapshot?.request);
  const discount = asObject(snapshot?.discount);
  const kind = String(snapshot?.kind ?? "");
  const userId = String(snapshot?.userId ?? "");
  const snapshotAmount = positiveInt(snapshot?.amount);
  /*
   * 서버가 동의를 검증한 시각. 없거나 형식이 어긋나면 undefined이며, 그 사실만으로
   * 복구를 막지 않는다(이 기능이 생기기 전에 준비된 결제에는 값이 없다).
   * 그 경우 증빙에 동의시각을 추정해 채우지 않는다.
   */
  const consentedAt = readServerConsentedAt(snapshot?.consentedAt);
  if (!snapshot || !request_ || !discount || !userId || snapshotAmount === null) {
    return manual("결제 준비 정보가 남아 있지 않습니다.");
  }
  if (kind !== "order" && kind !== "consultation") {
    return manual("결제 준비 정보를 확인하지 못했습니다.");
  }

  const data = await readData();
  const user = data.users.find((item) => item.id === userId);
  if (!user) return manual("회원 정보를 찾을 수 없습니다.");
  // 탈퇴 회원은 자동 복구하지 않는다. 주문을 만들면 지운 개인정보가 다시 쌓이고
  // 본인은 MY에서 확인할 수도 없다. 이런 건은 환불로 처리해야 한다.
  if (!isActiveUser(user)) return manual("탈퇴한 회원의 결제입니다. 환불로 처리해 주세요.");

  // 5) 결정적 id. 승인 경로가 쓰는 값과 같아야 같은 건으로 이어진다.
  const targetId =
    kind === "consultation"
      ? consultationIdForPayment(merchantOrderId)
      : orderIdForPayment(merchantOrderId);

  // 6) 이미 접수된 건인지 확인한다. 있으면 commit을 절대 다시 부르지 않고 연결만 한다.
  //    commit*은 쿠폰·적립금·추천인을 다시 처리하므로 여기서 갈라야 이중 차감이 없다.
  const alreadyCommitted =
    kind === "consultation"
      ? data.consultations.some((item) => item.id === targetId)
      : data.orders.some((item) => item.id === targetId);
  if (alreadyCommitted) {
    const linked = await linkPaymentToOrder({ merchantOrderId, orderId: targetId });
    if (!linked) return manual("결제 연결에 실패했습니다. 결제 상태를 확인해 주세요.");
    return NextResponse.json({ ok: true, linkedOnly: true, orderId: targetId });
  }

  // 7) 금액 재계산. 저장하지 않는 사본 위에서만 하고, 승인 경로와 순서를 똑같이 맞춘다.
  //    회원의 쿠폰·적립금이 그사이 달라졌으면 결과가 승인 금액과 어긋난다.
  //    그때는 자동으로 접수하지 않는다. 받은 돈과 다른 금액의 주문을 만들 수 없다.
  const draft = structuredClone(data);
  const draftUser = draft.users.find((item) => item.id === userId);
  if (!draftUser) return manual("회원 정보를 찾을 수 없습니다.");

  const couponId = typeof discount.couponId === "string" ? discount.couponId : "";
  const referralCode = typeof discount.referralCode === "string" ? discount.referralCode : "";
  const usePoints = Number(discount.usePoints ?? 0);
  if (!Number.isInteger(usePoints) || usePoints < 0) {
    return manual("할인 정보를 확인하지 못했습니다.");
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
    if (!priced) return manual("신청 내용을 확인하지 못했습니다.");
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

  const couponed = applyFreeCoupon(draft, userId, verifyDetails, basePrice, couponProduct);
  if (couponed.error) return manual("쿠폰 상태가 결제 당시와 달라졌습니다.");
  const referred =
    couponed.amount > 0
      ? applyReferral(draft, userId, couponed.details, couponed.amount)
      : couponed;
  if (referred.error) return manual("추천인 정보가 결제 당시와 달라졌습니다.");
  const pointed = applyPoints(draftUser, referred.details, referred.amount);
  const recalculated = pointed.amount;

  if (recalculated !== snapshotAmount || recalculated !== approvedAmount) {
    return manual("재계산 금액이 승인 금액과 다릅니다. 수동으로 확인해 주세요.");
  }

  // 8) 실제 접수. 저장은 승인 경로와 같은 한 문장(CAS + orders + payments 연결)을 쓴다.
  //    할인 의도는 snapshot.discount가 기준이다. details의 할인 문자열로 덮이지 않게 한다.
  const commitDetails: Record<string, string> = {
    ...((asObject(snapshot.details) ?? {}) as Record<string, string>),
    couponId,
    referralCode,
    usePoints: usePoints > 0 ? "1" : "",
  };

  try {
    if (kind === "order") {
      const result = await commitOrder(
        data,
        user,
        {
          product: request_.product,
          title: request_.title,
          options: request_.options,
          payment: request_.payment,
          details: commitDetails,
        },
        {
          // 예전 snapshot에는 동의 값이 없다. 복구를 막지 않는다.
          requireConsent: false,
          // 동의를 검증한 시각. 없으면 넘기지 않고, 증빙에도 시각을 만들지 않는다.
          ...(consentedAt ? { consentedAt } : {}),
          orderId: targetId,
          write: (next, order) => writeDataWithOrderForPayment(next, order, merchantOrderId),
          // 승인이 이미 끝난 건이라는 사실은 위 3)에서 확인했다.
          mode: "paid-approved",
        },
      );
      if (!result.ok) return manual(result.error);
      return NextResponse.json({ ok: true, recommitted: true, orderId: result.order.id });
    }

    const result = await commitConsultation(
      data,
      user,
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
        // 동의 값도 같은 이유로 없으면 넘어간다.
        requireConsent: false,
        // 주문과 같다. 값이 있을 때만 넘긴다.
        ...(consentedAt ? { consentedAt } : {}),
        // 예전 결제 복구가 목적이다. snapshot에 scheduledDate가 없던 시절의 건을
        // 막으면 결제만 남고 상담이 만들어지지 않는다. 값이 있으면 검증은 그대로 한다.
        requireSchedule: false,
        // 판매 가능 날짜 목록은 한국 날짜 기준으로 매일 앞으로 밀린다. 결제 준비와
        // 승인 사이에 자정이 지나면 같은 예약이 목록에서 빠지므로, 이 예약을 그 목록으로
        // 다시 보지 않는다. 형식·표시 문구 짝·시각·슬롯 충돌 검증은 그대로다.
        verifyOfferedDate: false,
        consultationId: targetId,
        write: (next, order) => writeDataWithOrderForPayment(next, order, merchantOrderId),
        mode: "paid-approved",
      },
    );
    // 슬롯이 이미 찼으면 여기서 막힌다. 비워 두는 것이 맞고 강제로 넣지 않는다.
    if (!result.ok) return manual(result.error);
    return NextResponse.json({
      ok: true,
      recommitted: true,
      consultationId: result.consultation.id,
    });
  } catch (error) {
    // 다른 요청과 겹쳐 저장이 밀린 경우. 아무것도 저장되지 않았으므로 그대로 다시 부르면 된다.
    if (isAppStoreConflict(error)) {
      return manual("다른 요청과 겹쳤습니다. 잠시 후 다시 시도해 주세요.");
    }
    console.error("[admin/payments/recommit] 재접수 실패");
    return NextResponse.json({ error: "재접수에 실패했습니다." }, { status: 500 });
  }
}
