/**
 * Effective Display clamp + nearest-band Level 판정 (TBD-01c-wiring · W3 · 6단계).
 *
 * band 값은 `STRENGTH_DISPLAY_BANDS`를 **import해서만** 쓴다 — clash 모듈에 복제하지 않는다.
 * 판정 순서·레벨 순서도 band 표의 `lo`에서 유도하므로 별도 LEVEL_ORDER 복제가 없다.
 *
 * 이 함수들은 **Effective 파생값 전용**이다. Natal `strengthLevel`은 건드리지 않는다
 * (presentation 모듈이 "does not recompute / promote / demote strengthLevel"인 경계를 유지).
 */

import type { ElementStrengthLevel } from "@/lib/saju/elements/buildElementStrengthProfiles";
import { STRENGTH_DISPLAY_BANDS } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";

/** band 표의 lo 오름차순 = 약 → 강. 순서를 따로 정의하지 않는다. */
const ORDERED_LEVELS: ElementStrengthLevel[] = (
  Object.keys(STRENGTH_DISPLAY_BANDS) as ElementStrengthLevel[]
).sort((a, b) => STRENGTH_DISPLAY_BANDS[a].lo - STRENGTH_DISPLAY_BANDS[b].lo);

const DISPLAY_LO = STRENGTH_DISPLAY_BANDS[ORDERED_LEVELS[0]!].lo;
const DISPLAY_HI = STRENGTH_DISPLAY_BANDS[ORDERED_LEVELS[ORDERED_LEVELS.length - 1]!].hi;

/**
 * Internal Effective → Display Effective. 표시 구간으로만 자른다.
 * Internal 자체는 호출자가 unclamped로 보존한다.
 */
export function clampToDisplayRange(score: number): number {
  return Math.min(DISPLAY_HI, Math.max(DISPLAY_LO, score));
}

/**
 * Display Effective 좌표의 Level.
 *
 * - band 안이면 그 band
 * - band 사이 gap이면 **nearest**
 * - 정확히 중점이면 **upper**
 *
 * clamp된 값을 입력으로 받으므로 범위 밖 분기는 필요 없다. 참고로 clamp 전
 * Internal로 판정해도 결과는 같다 — `<lo`는 clamp되어 최약 band로, `>hi`는 최강 band로
 * 가고, 이는 §1.5.9.10.3의 "범위 밖 → very-weak / very-strong"과 일치한다.
 */
export function resolveNearestStrengthLevel(displayScore: number): ElementStrengthLevel {
  for (const level of ORDERED_LEVELS) {
    const { lo, hi } = STRENGTH_DISPLAY_BANDS[level];
    if (displayScore >= lo && displayScore <= hi) return level;
  }

  for (let i = 0; i < ORDERED_LEVELS.length - 1; i += 1) {
    const lower = ORDERED_LEVELS[i]!;
    const upper = ORDERED_LEVELS[i + 1]!;
    const bandHi = STRENGTH_DISPLAY_BANDS[lower].hi;
    const nextLo = STRENGTH_DISPLAY_BANDS[upper].lo;
    if (displayScore > bandHi && displayScore < nextLo) {
      // 동거리(정확한 중점) → upper
      return displayScore - bandHi < nextLo - displayScore ? lower : upper;
    }
  }

  throw new Error(`resolveNearestStrengthLevel: unmapped display score ${displayScore}`);
}
