/**
 * 대운(decade luck) 최소 계약.
 *
 * **간지 산출은 이 모듈의 책임이 아니다.** 대운 시작점·순행/역행·교운 시각
 * 규칙이 아직 확정되지 않았으므로(§1.10 · mvp-engine-readiness-audit §2),
 * 임의 계산식을 만들지 않고 **이미 계산된 대운을 입력으로 받는다**.
 *
 * 규칙이 확정되면 이 타입을 만들어 주는 산출기만 추가하면 되고,
 * 아래 clash 경로는 그대로 재사용된다.
 */

import type { Branch, Stem } from "@/lib/saju/types";

/**
 * 계산이 끝난 대운 한 구간.
 *
 * `window`는 시작 포함 · 끝 배타 (`LuckClashWindow`와 동일 계약).
 * 충 판정에 실제로 쓰이는 것은 `branch`와 window뿐이며, `stem`은 간지 표현을
 * 온전히 보존하기 위해 둔다.
 */
export type DecadeLuckInput = {
  stem: Stem;
  branch: Branch;
  /** 대운 시작 시각(포함). */
  windowStart: Date;
  /** 다음 대운 시작 시각(배타). */
  windowEnd: Date;
};
