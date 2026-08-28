/**
 * 호환 재수출 — 실제 소유는 `@/lib/saju/effective/resolveEffectiveStrengthLevel`.
 *
 * clamp·nearest-band 판정은 clash 전용이 아니라 **모든 Effective 층 공통**이므로
 * `effective/`로 승격했다. 기존 import 경로를 깨지 않기 위해 재수출만 남긴다.
 */
export {
  clampToDisplayRange,
  resolveNearestStrengthLevel,
} from "@/lib/saju/effective/resolveEffectiveStrengthLevel";
