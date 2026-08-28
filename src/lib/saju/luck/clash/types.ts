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
