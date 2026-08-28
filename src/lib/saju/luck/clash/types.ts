/**
 * Luck ↔ Natal generic 육충 배선용 최소 데이터 계약 (TBD-01c-wiring · W3).
 *
 * 본 모듈은 **관계 탐지 이전 단계**의 자료형만 정의한다.
 * relation detection · collapse · δ modifier · Opening 효과는 **여기 없다.**
 *
 * 설계 근거: docs/unyul-judgment-rules-draft-v0.md §1.6.8.10
 */

import type { Branch, Element, PillarSlot } from "@/lib/saju/types";

/**
 * 충 판정에 필요한 natal 지지 슬롯 1개.
 *
 * `rootElements`는 확정된 attenuation key `(element × natal slot)`의 오행 축이며
 * **오행당 정확히 1개**다(§1.6.8.9.4). `RootHit` 레코드 수는 polarity(비견/겁재)로
 * 중복되므로 이 축의 원천으로 쓰지 않는다.
 *
 * `stem` · `role` · `hiddenStem` · `polarity`는 **의도적으로 제외**한다.
 * 지지 육충은 지지 글자만으로 판정되고, 감쇠는 깊이를 쓰지 않는다.
 */
export type NatalClashSlot = {
  slot: PillarSlot;
  branch: Branch;
  /** 이 슬롯이 root를 제공하는 오행. 중복 없음. ELEMENTS 순서. */
  rootElements: Element[];
};

/**
 * 충 판정용 natal 스냅샷.
 *
 * **confirmed 슬롯만** 담는다. `hour === "unknown"`이면 hour 슬롯이 **빠진다**
 * (별도 플래그를 두지 않는다 — 부재 자체가 표현이다).
 * Natal은 불변이며 이 스냅샷은 파생물이다.
 */
export type NatalClashSnapshot = {
  slots: NatalClashSlot[];
};

/**
 * 운 종류. 현재 엔진이 산출하는 것은 `annual-year`뿐이며
 * 나머지는 계약상의 자리다(간지 산출식 TBD · §1.10).
 */
export type LuckClashKind = "decade" | "annual-year" | "month" | "day";

/** 운이 활성인 구간. start 포함, end 배타. */
export type LuckClashWindow = {
  start: Date;
  end: Date;
};

/**
 * 충 판정에 필요한 운 대상 최소 계약.
 *
 * 지지 육충은 **지지 글자와 활성 구간만** 요구하므로 그 둘만 담는다.
 * annual 전용 필드(`year` · `boundaryBasis` · `stem` · `stemElement` ·
 * `branchMainElement`)는 **넣지 않는다** — 넣으면 대운·월운·일운 확장 시
 * detector를 다시 써야 한다. 경계 산출은 각 운 종류가 책임지고
 * 여기서는 그 **결과 window만** 소비한다.
 */
export type LuckClashTarget = {
  luckKind: LuckClashKind;
  branch: Branch;
  window: LuckClashWindow;
};

/**
 * 지지 육충 6쌍의 canonical id.
 *
 * 쌍은 무순서다 — 子午와 午子는 **같은 `clash-zi-wu`** 를 낸다.
 * 개고(TBD-03a) 평가기는 `clash-chou-wei` · `clash-chen-xu` 만 보고 분기하면 되며,
 * 본 계약은 개고 여부나 효과를 **판단하지 않는다.**
 */
export type ClashPairId =
  | "clash-zi-wu"
  | "clash-chou-wei"
  | "clash-yin-shen"
  | "clash-mao-you"
  | "clash-chen-xu"
  | "clash-si-hai";

/**
 * 충이 어디에서 왔는지. 수치에는 쓰이지 않는다(§1.6.8.9.5 — source 가중 없음).
 * 기록 목적이며, 향후 natal 내부 충 detector도 같은 레코드를 쓸 수 있도록
 * `"natal"`을 포함한다.
 */
export type ClashSource = "natal" | LuckClashKind;

/**
 * 육충 관계 1건.
 *
 * **relation은 '지지 대 지지'다.** `element`를 넣지 않는다 — 오행 축은
 * collapse 단계에서 snapshot으로 붙인다. 여기에 넣으면 같은 충이 오행 수만큼
 * 복제되어 attenuation 중복이 재발한다(§1.6.8.10.3).
 *
 * `delta` · severity 점수도 넣지 않는다. 수치는 modifier 단계에만 등장한다.
 */
export type ClashRelation = {
  natalSlot: PillarSlot;
  natalBranch: Branch;
  /** 충 상대 지지 (운 또는 다른 natal 슬롯). */
  otherBranch: Branch;
  source: ClashSource;
  clashPairId: ClashPairId;
  /** 운 충의 활성 구간. natal 내부 충은 `null`. */
  window: LuckClashWindow | null;
};

/**
 * 감쇠 단위 1개 — 확정 계약 `(element × natal 지지슬롯)` (§1.6.8.9.4).
 *
 * 같은 키는 활성 relation 수·source와 **무관하게 1개**다.
 * `source` · `window` · `clashPairId`는 relation 쪽에 남고 여기 오지 않는다
 * (relation multiplicity ≠ attenuation multiplicity).
 * `delta` · severity도 없다 — 수치는 다음 단계(modifier)에서만 붙는다.
 */
export type ClashAttenuationKey = {
  element: Element;
  natalSlot: PillarSlot;
};

/**
 * 감쇠 단위 1건에 수치를 붙인 modifier (§1.6.8.0).
 *
 * `attenuation`은 **양수 크기**다. 소비자가 Natal에서 뺀다:
 * `Internal Effective = Natal − Σattenuation` (§1.5.9.5의 `Natal − Σatten + Σboost` 형태).
 * clamp·Level 재판정은 여기서 하지 않는다 — Internal은 unclamped다.
 *
 * `source` · `window` · `clashPairId` · severity는 relation 쪽에 남고 여기 오지 않는다.
 * Opening 효과와 합산하지 않는다(§1.6.7.6 — 병존하되 별항).
 */
export type ClashAttenuationModifier = {
  element: Element;
  natalSlot: PillarSlot;
  /** 감쇠 크기(양수). Natal에서 빼는 값. */
  attenuation: number;
};
