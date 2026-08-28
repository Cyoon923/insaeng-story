/**
 * Transform(합) production 계층 최소 타입 — L1 relation 단계 (TBD-02g).
 *
 * 본 파일은 **관계 사실**만 표현한다. `transform-ok` 판정 · 목표 오행 ·
 * modifier · pool · 경합은 후속 계층(L2~L4)의 몫이며 여기 없다.
 *
 * 설계 근거: docs/unyul-judgment-rules-draft-v0.md §1.5.11
 */

import type { Element, PillarSlot } from "@/lib/saju/types";

/** 이번 L1이 다루는 합 종류. 六合·반합은 transform path가 없어 제외(§1.5.11.7). */
export type TransformCombineKind = "五合" | "삼합" | "방합";

/**
 * 참여 층. 五合은 **천간**, 삼합·방합은 **지지**에서 성립한다.
 * 같은 `slot`이라도 layer가 다르면 자리를 공유하지 않는다(§1.5.11.3).
 */
export type TransformParticipantLayer = "stem" | "branch";

/**
 * 합에 참여하는 자리 1개.
 *
 * `element` 의미:
 * - `stem` layer → 해당 천간의 오행
 * - `branch` layer → 해당 지지의 **본기(정기 지장간)** 오행 (§1.5.9.10.1)
 */
export type TransformParticipant = {
  slot: PillarSlot;
  layer: TransformParticipantLayer;
  element: Element;
};

/**
 * 합 관계 1건 — **hit 사실만**.
 *
 * `combineId`는 글자 조합의 canonical id다. 자리 배치·순서가 달라도 동일하다.
 * 서로 다른 자리 조합은 **별개 relation**으로 보존한다(multiplicity 보존).
 * 따라서 같은 `combineId`가 여러 relation에 나타날 수 있으며,
 * 인스턴스 식별은 `combineId` + `participants`의 자리 집합이다.
 */
export type TransformRelation = {
  combineId: string;
  kind: TransformCombineKind;
  /** 표 순서(예: 申子辰)를 따른다. */
  participants: TransformParticipant[];
};
