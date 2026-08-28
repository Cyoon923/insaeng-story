/**
 * Effective 합성 공통 계층 타입.
 *
 * 이 계층은 **Natal Strength 판정을 다시 계산하는 엔진이 아니다.**
 * 기존 Display Score 좌표를 빌려, 확정된 modifier들을 얹어 만드는
 * **파생(derived) Effective 계층**이다 (§1.6.8 스케일 전제).
 * Natal Strength Level · Need · Core · Supplement는 건드리지 않는다.
 */

import type { ElementStrengthLevel } from "@/lib/saju/elements/buildElementStrengthProfiles";
import type { Element } from "@/lib/saju/types";

/**
 * 빌려 온 natal 오행 좌표 1건.
 * (`toElementStrengthDisplayProfiles`의 표시 전용 좌표를 경계에서 추출한 값)
 */
export type NatalElementScore = {
  element: Element;
  /** 빌려 온 Display Score 좌표. */
  natalScore: number;
};

/**
 * 오행별 **부호 있는** 변화량 — clash·transform 등 모든 층의 공통 좌표계.
 *
 * 감쇠는 음수, 가산은 양수다. severity·weight·score를 넣지 않는다.
 */
export type ElementEffectiveDelta = {
  element: Element;
  delta: number;
};

/** 합성 결과 1건. `internalEffectiveScore`는 **unclamped**. */
export type ElementEffectiveScore = {
  element: Element;
  natalScore: number;
  /** 적용된 delta 총합(부호 있음). 변화 없으면 0. */
  delta: number;
  internalEffectiveScore: number;
};

/** clamp·Level까지 붙인 결과. `effectiveStrengthLevel`은 **파생값**이다. */
export type ElementEffectiveProfile = ElementEffectiveScore & {
  displayEffectiveScore: number;
  effectiveStrengthLevel: ElementStrengthLevel;
};
