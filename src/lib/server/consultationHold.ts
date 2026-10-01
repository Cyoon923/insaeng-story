/**
 * 일반 1:1 상담 결제의 슬롯 확보 (P1-04 Stage 2).
 *
 * NICEPAY return에서 claimPaymentProcessing이 성공한 결제만 이 함수를 부른다.
 * 확보가 성공한 결제만 승인 API를 부른다. 두 결제가 같은 슬롯으로 동시에 들어와도
 * app_store version CAS가 한 번에 한 쓰기만 통과시키므로, 뒤에 온 쪽은 다시 읽었을 때
 * 앞쪽의 hold를 보고 slot-unavailable이 된다.
 *
 * hold → Consultation 전환은 commitConsultation(holdOwnerMerchantOrderId)이 확정 저장과 함께 한다.
 * 승인 거절 때의 해제는 releaseConsultationHold가 한다. 만료 처리는 하지 않는다.
 */
import { isSlotAvailable } from "./consultationSlots.ts";
import type { AppData, ConsultationHold, Payment, PaymentStatus } from "@/lib/types/app";

/**
 * CAS가 겹쳐 밀렸을 때 다시 해 보는 횟수. 기존 app_store 작업들과 같은 3을 쓴다
 * (RETENTION_SCRUB_MAX_ATTEMPTS / LEGACY_CODES_CLEANUP_MAX_ATTEMPTS /
 * INQUIRY_CLEANUP_MAX_ATTEMPTS / MY_PHONE_VERIFICATION_MAX_ATTEMPTS).
 */
export const CONSULTATION_HOLD_MAX_ATTEMPTS = 3;

export interface ConsultationHoldDeps {
  /** store.readData. 회차마다 새로 읽는다. */
  readData: () => Promise<AppData>;
  /** store.writeData. app_store version CAS로 저장하고, 밀리면 예외를 던진다. */
  writeData: (data: AppData) => Promise<void>;
  /** store.isAppStoreConflict. */
  isConflict: (error: unknown) => boolean;
}

export type AcquireConsultationHoldResult =
  /** 이 결제가 슬롯을 확보했다(이미 확보해 둔 경우 포함). 승인 API를 불러도 된다. */
  | { kind: "held" }
  /** 실제 상담·차단·다른 결제의 hold가 있다. 승인 API를 부르면 안 된다. */
  | { kind: "slot-unavailable" }
  /** 정해진 횟수를 모두 CAS 충돌로 밀렸다. 아무것도 저장되지 않았다. 승인 API를 부르면 안 된다. */
  | { kind: "retry-later"; attempts: number };

/** 한 회차. 저장이 밀리면 예외가 그대로 올라간다. */
async function attemptOnce(
  data: AppData,
  hold: ConsultationHold,
  deps: ConsultationHoldDeps,
): Promise<AcquireConsultationHoldResult> {
  const holds = data.consultationHolds ?? [];
  // 같은 결제가 같은 슬롯을 이미 확보했다(재호출). 다시 쓰지 않는다.
  if (
    holds.some(
      (item) =>
        item.merchantOrderId === hold.merchantOrderId &&
        item.teacher === hold.teacher &&
        item.date === hold.date &&
        item.time === hold.time,
    )
  ) {
    return { kind: "held" };
  }
  if (
    !isSlotAvailable(data, hold.teacher, hold.date, hold.time, {
      ownerMerchantOrderId: hold.merchantOrderId,
    })
  ) {
    return { kind: "slot-unavailable" };
  }
  data.consultationHolds = [...holds, hold];
  await deps.writeData(data);
  return { kind: "held" };
}

/**
 * 슬롯을 확보한다. CAS 충돌일 때만 새로 읽어 다시 시도한다.
 * 그 밖의 오류는 숨기지 않고 그대로 던진다(호출부가 승인 API에 가지 않게 된다).
 */
export async function acquireConsultationHold(
  input: {
    teacher: string;
    date: string;
    time: string;
    merchantOrderId: string;
    checkoutId?: string | null;
    createdAt: string;
  },
  deps: ConsultationHoldDeps,
  maxAttempts: number = CONSULTATION_HOLD_MAX_ATTEMPTS,
): Promise<AcquireConsultationHoldResult> {
  const hold: ConsultationHold = {
    teacher: input.teacher,
    date: input.date,
    time: input.time,
    merchantOrderId: input.merchantOrderId,
    ...(input.checkoutId ? { checkoutId: input.checkoutId } : {}),
    createdAt: input.createdAt,
  };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // 회차마다 새로 읽는다. 지난 회차의 data는 낡은 version이라 다시 쓰지 않는다.
    const data = await deps.readData();
    try {
      return await attemptOnce(data, hold, deps);
    } catch (error) {
      if (!deps.isConflict(error)) throw error;
      console.warn(`[consultation-hold] store conflict on attempt ${attempt}`);
    }
  }
  console.warn("[consultation-hold] store conflict exhausted");
  return { kind: "retry-later", attempts: maxAttempts };
}

export type ReleaseConsultationHoldResult =
  /** 이 결제의 hold가 없다(이미 풀렸거나 처음부터 없음). */
  | { kind: "released" }
  /** 정해진 횟수를 모두 CAS 충돌로 밀렸다. hold는 남아 있다. */
  | { kind: "retry-later"; attempts: number };

/**
 * 이 결제(merchantOrderId)가 가진 hold만 푼다. 다른 결제의 hold는 건드리지 않는다.
 * 없으면 쓰지 않고 released다. CAS 충돌일 때만 다시 시도하고, 그 밖의 오류는 던진다.
 */
export async function releaseConsultationHold(
  merchantOrderId: string,
  deps: ConsultationHoldDeps,
  maxAttempts: number = CONSULTATION_HOLD_MAX_ATTEMPTS,
): Promise<ReleaseConsultationHoldResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const data = await deps.readData();
    const holds = data.consultationHolds ?? [];
    const kept = holds.filter((hold) => hold.merchantOrderId !== merchantOrderId);
    if (kept.length === holds.length) return { kind: "released" };
    data.consultationHolds = kept;
    try {
      await deps.writeData(data);
      return { kind: "released" };
    } catch (error) {
      if (!deps.isConflict(error)) throw error;
      console.warn(`[consultation-hold] release conflict on attempt ${attempt}`);
    }
  }
  console.warn("[consultation-hold] release conflict exhausted");
  return { kind: "retry-later", attempts: maxAttempts };
}

/* ── 관리자 확인·수동 해제 (P1-04 Stage 4) ─────────────────── */

/**
 * hold를 사람이 풀어도 되는지. 서버가 결제 기록의 지금 상태로만 정한다.
 *
 * - ready / failed / cancelled: 승인되지 않았거나 이미 종료된 결제라 슬롯을 돌려줘도 된다.
 * - processing: 실제로 승인됐을 수 있다. 결제 조회(P1-02)로 먼저 확정해야 한다.
 * - paid: 돈을 받은 결제다. 재접수나 환불로 먼저 종결해야 한다(이번 범위에서 해제 금지).
 * - partialCancelled: 일부만 취소된 결제다. 사람이 결제 정보를 직접 확인해야 한다.
 * - 결제 기록 없음: 안전하다고 가정하지 않는다.
 */
export type HoldReleaseBlock = "payment-missing" | "processing" | "paid" | "partial-cancelled";

const RELEASABLE: readonly PaymentStatus[] = ["ready", "failed", "cancelled"];

export const HOLD_RELEASE_MESSAGES: Record<HoldReleaseBlock, string> = {
  "payment-missing": "결제 기록을 찾을 수 없어 해제할 수 없습니다. 결제 정보를 직접 확인해 주세요.",
  processing: "승인 결과를 아직 확인하지 못한 결제입니다. 먼저 '결제 조회'로 결제 상태를 확인해 주세요.",
  paid: "결제가 완료된 건입니다. 재접수 또는 환불을 먼저 확인해 주세요.",
  "partial-cancelled": "부분취소된 결제입니다. 결제 정보를 직접 확인해 주세요.",
};

export function holdReleaseDecision(
  payment: Pick<Payment, "status"> | null,
): { ok: true } | { ok: false; reason: HoldReleaseBlock } {
  if (!payment) return { ok: false, reason: "payment-missing" };
  if (RELEASABLE.includes(payment.status)) return { ok: true };
  if (payment.status === "processing") return { ok: false, reason: "processing" };
  if (payment.status === "paid") return { ok: false, reason: "paid" };
  return { ok: false, reason: "partial-cancelled" };
}

/** 관리자 화면 한 줄. 개인정보와 checkoutId는 담지 않는다. */
export interface AdminConsultationHold {
  teacher: string;
  date: string;
  time: string;
  merchantOrderId: string;
  createdAt: string;
  /** 결제 기록의 지금 상태. 기록이 없으면 "missing", 읽지 못했으면 "unavailable". */
  paymentStatus: PaymentStatus | "missing" | "unavailable";
  /** 서버가 정한 해제 가능 여부. 화면은 이 값으로만 버튼을 보인다. */
  releasable: boolean;
}

/** hold마다 결제 기록을 다시 읽어 상태를 붙인다. 읽기 실패는 해제 불가로 둔다. */
export async function listHoldsForAdmin(
  data: AppData,
  getPayment: (merchantOrderId: string) => Promise<Payment | null>,
): Promise<AdminConsultationHold[]> {
  const items: AdminConsultationHold[] = [];
  for (const hold of data.consultationHolds ?? []) {
    let paymentStatus: AdminConsultationHold["paymentStatus"];
    let releasable = false;
    try {
      const payment = await getPayment(hold.merchantOrderId);
      paymentStatus = payment ? payment.status : "missing";
      releasable = holdReleaseDecision(payment).ok;
    } catch {
      paymentStatus = "unavailable";
    }
    items.push({
      teacher: hold.teacher,
      date: hold.date,
      time: hold.time,
      merchantOrderId: hold.merchantOrderId,
      createdAt: hold.createdAt,
      paymentStatus,
      releasable,
    });
  }
  return items;
}

export type AdminHoldReleaseResult =
  | { ok: true; status: "released"; message: string }
  | { ok: false; status: HoldReleaseBlock | "retry"; message: string };

/**
 * 관리자 수동 해제. 결제 기록을 다시 읽어 판정하고, 허용될 때만 이 결제의 hold를 푼다.
 * 이미 hold가 없으면 released(아무것도 쓰지 않음)다. 다른 결제의 hold는 건드리지 않는다.
 */
export async function runAdminHoldRelease(
  merchantOrderId: string,
  deps: ConsultationHoldDeps & { getPayment: (merchantOrderId: string) => Promise<Payment | null> },
): Promise<AdminHoldReleaseResult> {
  const decision = holdReleaseDecision(await deps.getPayment(merchantOrderId));
  if (!decision.ok) {
    return { ok: false, status: decision.reason, message: HOLD_RELEASE_MESSAGES[decision.reason] };
  }
  const released = await releaseConsultationHold(merchantOrderId, deps);
  if (released.kind === "released") {
    return { ok: true, status: "released", message: "상담 시간 확보를 해제했습니다." };
  }
  return { ok: false, status: "retry", message: "다른 요청과 겹쳐 해제하지 못했습니다. 다시 시도해 주세요." };
}
