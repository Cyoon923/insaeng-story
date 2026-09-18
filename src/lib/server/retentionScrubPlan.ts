/**
 * 보관 만료 scrub 실행 계획 (Privacy-Retention-Execution-1).
 *
 * "이 주문 1건을 지금 scrub해도 되는가, 된다면 결과가 무엇인가"만 계산한다.
 * 저장하지 않고, 받은 값을 바꾸지도 않는다. 실제 반영은 store.ts의 한 문장이 한다.
 *
 * 떼어 둔 이유는 다른 순수 모듈들과 같다. DB 없이 그 자체로 확인할 수 있어야 하고,
 * 여기서 판정이 틀리면 아직 보관 기간이 남은 개인정보가 지워지기 때문이다.
 *
 * ── 호출자가 우회할 수 없게 만든 것 ──
 *
 * 이 함수는 "지워도 되는 건인지"를 **여기서 직접 다시 판정한다**. 호출자는 주문 id와
 * 현재 시각만 넘기고, 지울 대상이나 남길 값을 고를 수 없다. 판정은 언제나
 * retentionEligibility.decideRetentionEligibility 하나를 거치며, 그 결과가
 * eligible이 아니면 계획 자체가 만들어지지 않는다(fail-closed).
 * 남길 키도 호출자가 고르지 않는다. retentionScrub의 allowlist가 유일한 출처다.
 *
 * ── 기산점을 상품으로 가른다 ──
 *
 * 인생곡(story / saju-song / premium) : Order.deliveredAt
 * 1:1 사주상담                        : 같은 id Consultation.completedAt
 *
 * 판별은 order.product 값으로 한다. id 접두사("c-" 등)로 보지 않는다.
 * 접두사는 관례일 뿐이고, 0원 경로와 결제 경로가 만드는 모양이 달라 믿을 수 없다.
 *
 * ── 이번 단계에서 다루지 않는 것 ──
 *
 * 짝이 되는 Order가 없는 Consultation(예전 자료)은 대상이 아니다. 그런 상담을 위해
 * 주문을 지어내지 않는다. 다음 단계에서 상담 id를 직접 받는 경로로 다룬다.
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import { decideRetentionEligibility } from "./retentionEligibility.ts";
import { pickRetentionDetails } from "./retentionScrub.ts";
import type { AppData, Consultation, Order } from "@/lib/types/app";

/** 계획을 세우지 못한 이유. 어느 것도 오류가 아니라 "지금은 하지 않는다"는 뜻이다. */
export type RetentionScrubBlockedReason =
  /** 그 id의 주문이 저장소에 없다. */
  | "order-not-found"
  /** 상담 주문인데 같은 id의 상담이 없다. 기산점을 읽을 수 없어 하지 않는다. */
  | "consultation-not-found"
  /** 완료 증빙이 없다. 이 구조가 생기기 전의 건이 여기 해당한다. */
  | "missing-evidence"
  /** 증빙은 있으나 시각으로 읽을 수 없다. */
  | "invalid-evidence"
  /** 넘어온 현재 시각을 읽을 수 없다. */
  | "invalid-now"
  /** 아직 보관 기간 중이다. */
  | "not-yet";

/**
 * 실행 계획 1건.
 *
 * 저장소를 바꾸는 쪽이 필요한 값만 담는다. 무엇을 지울지가 아니라
 * **무엇이 남는지**(details)를 담는 이유는, 남는 값이 곧 allowlist의 결과라서
 * 반영하는 쪽이 목록을 다시 해석할 여지를 두지 않기 위해서다.
 */
export interface RetentionScrubPlan {
  /** 대상 주문. data 안의 바로 그 객체다(사본이 아니다). */
  order: Order;
  /** 상담 주문일 때 같은 id의 상담. 인생곡이면 null이다. */
  consultation: Consultation | null;
  /** 정리한 뒤의 details. 주문과 상담이 같은 목록을 쓰므로 각각 계산해 둔다. */
  orderDetails: Record<string, string>;
  consultationDetails: Record<string, string> | null;
  /** 판정에 쓴 완료 증빙(ISO). 어느 시각을 보고 지웠는지 남기기 위한 값이다. */
  evidenceAt: string;
  /** 그 증빙으로부터 보관 기간이 끝난 시각(ISO). */
  eligibleAt: string;
  /** 완료 증빙으로 남길 시각(ISO). 넘어온 현재 시각을 정규화한 값이다. */
  scrubbedAt: string;
}

export type RetentionScrubPlanResult =
  | { ok: true; plan: RetentionScrubPlan }
  | { ok: false; reason: RetentionScrubBlockedReason };

/**
 * 주문 1건의 보관 만료 scrub 계획을 세운다.
 *
 * data는 읽기만 한다. 계획 안의 order·consultation은 data 안의 객체를 그대로 가리키므로
 * 반영하는 쪽이 그 자리에서 바꿀 수 있다(다른 store 함수들과 같은 방식이다).
 *
 * now는 서버가 만든 시각을 받는다. 시각에 따라 답이 달라지는 판정이라 함수 안에서
 * 만들지 않는다(경계를 테스트로 고정할 수 있어야 한다).
 */
export function planRetentionScrub(
  data: AppData,
  orderId: string,
  now: string,
): RetentionScrubPlanResult {
  const id = String(orderId ?? "").trim();
  if (!id) return { ok: false, reason: "order-not-found" };

  const order = data.orders.find((item) => item.id === id);
  if (!order) return { ok: false, reason: "order-not-found" };

  /*
   * 기산점을 고른다. 상품으로 가르며 id 모양으로 추측하지 않는다.
   * 상담 주문인데 짝이 되는 상담을 찾지 못하면 아무것도 하지 않는다. 주문의
   * deliveredAt으로 대신 판정하면 다른 뜻의 시각으로 개인정보를 지우게 된다.
   */
  let consultation: Consultation | null = null;
  let evidence: string | null | undefined;
  if (order.product === "consultation") {
    consultation = data.consultations.find((item) => item.id === order.id) ?? null;
    if (!consultation) return { ok: false, reason: "consultation-not-found" };
    evidence = consultation.completedAt;
  } else {
    evidence = order.deliveredAt;
  }

  // 판정은 여기 한 곳을 거친다. 호출자가 건너뛸 수 있는 경로를 두지 않는다.
  const decision = decideRetentionEligibility(evidence, now);
  if (decision.kind !== "eligible") return { ok: false, reason: decision.kind };

  return {
    ok: true,
    plan: {
      order,
      consultation,
      orderDetails: pickRetentionDetails(order.details),
      consultationDetails: consultation ? pickRetentionDetails(consultation.details) : null,
      evidenceAt: decision.evidenceAt,
      eligibleAt: decision.eligibleAt,
      // 판정이 통과했다는 것은 now가 시각으로 읽혔다는 뜻이다. 모양만 맞춰 둔다.
      scrubbedAt: new Date(Date.parse(now.trim())).toISOString(),
    },
  };
}
