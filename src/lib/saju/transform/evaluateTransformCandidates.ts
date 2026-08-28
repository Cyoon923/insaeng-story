/**
 * L2 — C-* 조건 평가와 `transform-ok` / `hit-no-transform` 판정
 * (TBD-02g · §1.5.4.1 판정 계약 · §1.5.4.2 매트릭스 · §1.5.4.5 정의).
 *
 * 하지 않는 것: pool 12/16 · attenuation/boost · modifier · 경합 승자 판정 ·
 * Effective 합성 · Natal 변경.
 *
 * **확정된 정의로 평가할 수 없는 조건은 `unknown`으로 남긴다.**
 * 임의 임계값·boolean 규칙을 만들지 않는다.
 */

import { stemElement } from "@/lib/saju/constants/elements";
import { confirmedSlots } from "@/lib/saju/elements/slots";
import { seasonPhaseOf } from "@/lib/saju/elements/season";
import { resolveBranchClashPairId } from "@/lib/saju/luck/clash/branchClashPairs";
import {
  TRANSFORM_CONDITION_ORDER,
  TRANSFORM_CONDITION_ROLES,
} from "@/lib/saju/transform/conditionRoles";
import { transformTargetOf } from "@/lib/saju/transform/transformTargetTables";
import type {
  TransformCandidate,
  TransformConditionEvidence,
  TransformConditionKey,
  TransformConditionRole,
  TransformConditionState,
  TransformRelation,
} from "@/lib/saju/transform/types";
import type { Element, FourPillars, PillarSlot } from "@/lib/saju/types";

const SLOT_ORDER: Record<PillarSlot, number> = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
};

type Verdict = { state: TransformConditionState; reason: string };

/**
 * C-월령: "화 목표 오행이 월지 기준 왕·상 등 득시, 또는 월지가 해당 합국 구성원"(§1.5.4.5).
 * 득시의 경계는 문서가 명시한 **왕·상**으로 읽는다. 월령 테이블은 변경하지 않는다.
 */
function evaluateMonthCommand(
  pillars: FourPillars,
  relation: TransformRelation,
  target: Element,
): Verdict {
  const monthIsMember = relation.participants.some(
    (participant) => participant.slot === "month" && participant.layer === "branch",
  );
  if (monthIsMember) {
    return { state: "satisfied", reason: "month-branch-is-member" };
  }
  const phase = seasonPhaseOf(target, pillars.month.branch);
  if (phase === "왕" || phase === "상") {
    return { state: "satisfied", reason: `target-season-phase=${phase}` };
  }
  return { state: "failed", reason: `target-season-phase=${phase}` };
}

/** C-투간: "化神(합화 결과 오행)이 천간에 투출"(§1.5.4.5). 확정 정의로 판정 가능. */
function evaluateStemExposure(pillars: FourPillars, target: Element): Verdict {
  const exposedAt = confirmedSlots(pillars)
    .filter(({ pillar }) => stemElement(pillar.stem) === target)
    .map(({ slot }) => slot);
  return exposedAt.length > 0
    ? { state: "satisfied", reason: `target-stem-exposed-at=${exposedAt.join("+")}` }
    : { state: "failed", reason: "target-stem-not-exposed" };
}

/**
 * C-방해: "참여 글자에 대한 **충** 성립"(§1.5.4.5). 형·파·해 편입은 TBD.
 *
 * - 지지 참여(삼합·방합): 지지 육충이 확정 표(§1.6.1)로 존재 → **판정 가능**
 * - 천간 참여(五合): 천간 충은 TBD-03 **범위 밖**(§1.6.1)이고 §1.5.4.3의
 *   "연계 지지"도 확정 정의가 없다 → **unknown**
 */
function evaluateObstruction(pillars: FourPillars, relation: TransformRelation): Verdict {
  const branchParticipants = relation.participants.filter(
    (participant) => participant.layer === "branch",
  );
  if (branchParticipants.length === 0) {
    return {
      state: "unknown",
      reason: "stem-participants: 천간충 범위 밖(§1.6.1) · 연계 지지 정의 미확정",
    };
  }

  const slots = confirmedSlots(pillars);
  const hits: string[] = [];
  for (const participant of branchParticipants) {
    const own = slots.find(({ slot }) => slot === participant.slot);
    if (own === undefined) continue;
    for (const other of slots) {
      if (other.slot === participant.slot) continue;
      if (resolveBranchClashPairId(own.pillar.branch, other.pillar.branch) !== null) {
        hits.push(`${participant.slot}:${own.pillar.branch}x${other.pillar.branch}`);
      }
    }
  }
  return hits.length > 0
    ? { state: "satisfied", reason: `participant-branch-clash=${hits.join(",")}` }
    : { state: "failed", reason: "no-participant-branch-clash" };
}

/** C-거리: "지정 슬롯 쌍이 인접 기둥(연-월·월-일·일-시)"(§1.5.4.5). 五合에서만 R. */
function evaluateDistance(relation: TransformRelation): Verdict {
  const indices = relation.participants.map((participant) => SLOT_ORDER[participant.slot]);
  const min = Math.min(...indices);
  const max = Math.max(...indices);
  return max - min === 1
    ? { state: "satisfied", reason: "adjacent-pillars" }
    : { state: "failed", reason: `slot-span=${max - min}` };
}

/**
 * 확정 정의가 없어 평가하지 않는 조건들.
 *
 * - C-세력: "본기 밀도 등 — 라벨만". 임계값 없음 → unknown (S라 차단하지 않음)
 * - C-통근: "참여/결과 관련 천간의 rootStatus" — 대상 천간이 참여인지 결과인지
 *   미확정이고 세부는 TBD-05 → unknown
 * - C-경쟁: "화기를 깨는 극·설 재료" — 판정 기준 없음 → unknown (S)
 * - C-중복: 역할이 **게이트**(§1.5.10.8). L2에서 R/S/B로 쓰지 않는다 → not-applicable
 */
function evaluateUnresolved(key: TransformConditionKey): Verdict {
  switch (key) {
    case "force":
      return { state: "unknown", reason: "C-세력 임계 미확정 (라벨만, §1.5.4.5)" };
    case "root":
      return { state: "unknown", reason: "C-통근 대상 천간 미확정 · 세부 TBD-05" };
    case "competition":
      return { state: "unknown", reason: "C-경쟁 판정 기준 미확정 (§1.5.4.5)" };
    case "duplicate":
      return {
        state: "not-applicable",
        reason: "C-중복은 게이트 — L4 경합 집합 입력 (§1.5.10.8)",
      };
    default:
      throw new Error(`evaluateUnresolved: unexpected key ${key}`);
  }
}

function evaluateCondition(
  key: TransformConditionKey,
  role: TransformConditionRole,
  pillars: FourPillars,
  relation: TransformRelation,
  target: Element,
): Verdict {
  if (role === "not-applicable") {
    return { state: "not-applicable", reason: `role=not-applicable (${relation.kind})` };
  }
  switch (key) {
    case "monthCommand":
      return evaluateMonthCommand(pillars, relation, target);
    case "stemExposure":
      return evaluateStemExposure(pillars, target);
    case "obstruction":
      return evaluateObstruction(pillars, relation);
    case "distance":
      return evaluateDistance(relation);
    default:
      return evaluateUnresolved(key);
  }
}

/**
 * §1.5.4.1 판정 계약:
 * 1. required 하나라도 fail → hit-no-transform
 * 3. blocking 성립(satisfied) → hit-no-transform
 * 4. required 또는 blocking이 unknown → 자동 transform-ok 금지
 * 2. supporting은 단독 승격 불가 · supporting fail은 기각 사유 아님
 * gate(C-중복)는 L2 판정에 쓰지 않는다.
 */
function decideStatus(conditions: readonly TransformConditionEvidence[]): TransformCandidate["status"] {
  for (const condition of conditions) {
    if (condition.role === "required") {
      if (condition.state === "failed" || condition.state === "unknown") return "hit-no-transform";
    }
    if (condition.role === "blocking") {
      if (condition.state === "satisfied" || condition.state === "unknown") {
        return "hit-no-transform";
      }
    }
  }
  return "transform-ok";
}

/**
 * L1 relation → L2 판정 후보.
 *
 * 순수 함수이며 `pillars` · `relations`를 변경하지 않는다.
 * relation 객체는 그대로 참조로 싣는다(복사·변형 없음).
 */
export function evaluateTransformCandidates(
  pillars: FourPillars,
  relations: readonly TransformRelation[],
): TransformCandidate[] {
  return relations.map((relation) => {
    const target = transformTargetOf(relation.combineId);
    const roles = TRANSFORM_CONDITION_ROLES[relation.kind];

    const conditions: TransformConditionEvidence[] = TRANSFORM_CONDITION_ORDER.map((key) => {
      const role = roles[key];
      const verdict = evaluateCondition(key, role, pillars, relation, target);
      return { key, role, state: verdict.state, reason: verdict.reason };
    });

    return {
      relation,
      status: decideStatus(conditions),
      targetElement: target,
      conditions,
    };
  });
}
