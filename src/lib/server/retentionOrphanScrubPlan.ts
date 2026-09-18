/**
 * 짝 없는 상담의 보관 만료 scrub 계획 (Privacy-Retention-Orphan-1).
 *
 * "짝이 되는 주문이 없는 이 상담 1건을 지금 scrub해도 되는가"만 계산한다.
 * 저장하지 않고, 받은 값을 바꾸지도 않는다. 실제 반영은 store.ts가 한다.
 *
 * ── 왜 별도 경로인가 ──
 *
 * 정상 경로(retentionScrubPlan)는 주문 id로 들어와 주문·상담·결제를 한 문장으로 다룬다.
 * 그런데 예전 자료에는 짝이 되는 주문 없이 상담만 남아 있을 수 있다
 * (myOrders.ts가 "짝이 되는 주문이 없는 상담"을 목록에 따로 담는 이유와 같다).
 * 그런 상담은 주문 id가 없어 정상 경로에 영영 닿지 않는다. 처리하려고 주문을
 * 지어내지 않는다. 대신 상담 id로 들어오는 이 경로를 따로 둔다.
 *
 * ── 짝이 하나라도 있으면 하지 않는다 ──
 *
 * 주문이 존재하는 상담은 이 경로의 대상이 아니다. 정상 경로가 주문·결제까지 함께
 * 다뤄야 하는데, 이쪽으로 처리하면 상담만 지워지고 주문 details와 결제 스냅샷은
 * 그대로 남는다. 그래서 app_store와 orders 테이블 **양쪽 모두** 없을 때만 진행한다.
 * 한쪽이라도 있으면 막는다(fail-closed).
 *
 * 판별은 저장된 주문의 존재 여부로 한다. id 접두사("c-" 등)로 보지 않는다.
 * 접두사는 관례일 뿐이고 0원 경로와 결제 경로가 만드는 모양이 달라 믿을 수 없다.
 *
 * ── 기산점 ──
 *
 * Consultation.completedAt 하나뿐이다. createdAt·scheduledAt·datetime·status로
 * 추정하지 않는다(전부 다른 뜻의 값이다).
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import { decideRetentionEligibility } from "./retentionEligibility.ts";
import { scrubConsultationForRetention } from "./retentionScrub.ts";
import type { AppData, Consultation } from "@/lib/types/app";

/** 계획을 세우지 못한 이유. 어느 것도 오류가 아니라 "지금은 하지 않는다"는 뜻이다. */
export type OrphanScrubBlockedReason =
  /** 그 id의 상담이 저장소에 없다. */
  | "consultation-not-found"
  /** 짝이 되는 주문이 있다. 이 경로의 대상이 아니다(정상 경로가 다룬다). */
  | "paired-order-exists"
  /** 완료 증빙이 없다. 이 구조가 생기기 전의 건이 여기 해당한다. */
  | "missing-evidence"
  /** 증빙은 있으나 시각으로 읽을 수 없다. */
  | "invalid-evidence"
  /** 넘어온 현재 시각을 읽을 수 없다. */
  | "invalid-now"
  /** 아직 보관 기간 중이다. */
  | "not-yet";

/**
 * 저장소 밖에서 확인해야 하는 사실.
 *
 * orders 테이블은 app_store와 다른 저장소라 AppData만으로는 볼 수 없다.
 * 조회는 store.ts가 하고, 그 결과를 이 계획이 받아 판단에 넣는다.
 * 확인하지 못했으면 true를 넘긴다(모르면 하지 않는 쪽으로 기운다).
 */
export interface OrphanScrubEvidence {
  /** 같은 id의 주문이 orders 테이블에 있는가. DB가 없는 환경에서는 false다. */
  pairedOrderInSql: boolean;
}

/**
 * 실행 계획 1건.
 *
 * nextConsultation은 정리가 끝난 **새 객체**다. 반영하는 쪽이 배열의 그 자리를
 * 통째로 바꾼다. 무엇을 지울지가 아니라 무엇이 남는지를 담는 이유는
 * 반영하는 쪽이 allowlist를 다시 해석할 여지를 두지 않기 위해서다.
 */
export interface OrphanScrubPlan {
  /** data.consultations 안에서의 자리. 반영하는 쪽이 이 자리를 바꾼다. */
  index: number;
  /** 정리 전 상담. data 안의 바로 그 객체다(되돌릴 때 쓴다). */
  consultation: Consultation;
  /** 정리가 끝난 새 상담. purpose가 없고 details는 allowlist 결과다. */
  nextConsultation: Consultation;
  /** 판정에 쓴 완료 증빙(ISO). */
  evidenceAt: string;
  /** 그 증빙으로부터 보관 기간이 끝난 시각(ISO). */
  eligibleAt: string;
  /** 완료 증빙으로 남길 시각(ISO). 넘어온 현재 시각을 정규화한 값이다. */
  scrubbedAt: string;
}

export type OrphanScrubPlanResult =
  | { ok: true; plan: OrphanScrubPlan }
  | { ok: false; reason: OrphanScrubBlockedReason };

/**
 * 짝 없는 상담 1건의 보관 만료 scrub 계획을 세운다.
 *
 * data는 읽기만 한다. now는 서버가 만든 시각을 받는다(시각에 따라 답이 달라지는
 * 판정이라 함수 안에서 만들지 않는다).
 */
export function planOrphanConsultationScrub(
  data: AppData,
  consultationId: string,
  now: string,
  evidence: OrphanScrubEvidence,
): OrphanScrubPlanResult {
  const id = String(consultationId ?? "").trim();
  if (!id) return { ok: false, reason: "consultation-not-found" };

  const index = data.consultations.findIndex((item) => item.id === id);
  if (index < 0) return { ok: false, reason: "consultation-not-found" };
  const consultation = data.consultations[index];

  /*
   * 짝 확인. 두 저장소를 모두 본다.
   * app_store에만 있거나 orders 테이블에만 있어도 "짝이 있다"로 본다.
   * 둘이 어긋난 상태라면 더더욱 이 경로로 지워서는 안 된다.
   */
  if (evidence.pairedOrderInSql) return { ok: false, reason: "paired-order-exists" };
  if (data.orders.some((item) => item.id === id)) {
    return { ok: false, reason: "paired-order-exists" };
  }

  // 기산점은 completedAt 하나뿐이다. 판정은 정상 경로와 같은 함수를 거친다.
  const decision = decideRetentionEligibility(consultation.completedAt, now);
  if (decision.kind !== "eligible") return { ok: false, reason: decision.kind };

  return {
    ok: true,
    plan: {
      index,
      consultation,
      // 정리 규칙은 정상 경로와 완전히 같다. 이쪽만 따로 만들지 않는다.
      nextConsultation: scrubConsultationForRetention(consultation),
      evidenceAt: decision.evidenceAt,
      eligibleAt: decision.eligibleAt,
      // 판정이 통과했다는 것은 now가 시각으로 읽혔다는 뜻이다. 모양만 맞춰 둔다.
      scrubbedAt: new Date(Date.parse(now.trim())).toISOString(),
    },
  };
}
