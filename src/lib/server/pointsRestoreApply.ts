/**
 * 적립금 복원에 쓸 잔액 계산 (Refund-Points-Restore-Atomic-1).
 *
 * 저장하지 않는다. 받은 값을 바꾸지도 않는다. "누구의 잔액을 얼마로 만들 것인가"만
 * 계산해 돌려준다. 실제 반영과 원장 기록은 store.ts의 한 문장이 함께 한다.
 *
 * 떼어 둔 이유는 다른 순수 모듈들과 같다. DB 없이 그 자체로 확인할 수 있어야 하고,
 * 잔액 계산이 틀리면 고객 돈이 틀어지기 때문이다.
 */
import type { AppData, User } from "@/lib/types/app";

export type PointsRestorePlan =
  | { ok: true; user: User; previousPoints: number; nextPoints: number }
  | { ok: false; reason: "invalid-amount" | "user-not-found" };

/**
 * 복원 뒤 잔액을 계산한다.
 *
 * amount는 원 단위 양의 정수만 받는다. 0·음수·소수는 복원할 값이 아니다
 * (그 판정은 pointsRestoreDecision이 먼저 하지만, 여기서도 다시 본다. 저장 직전의
 *  마지막 계산이라 한 곳만 믿지 않는다).
 *
 * 대상 회원이 저장소에 없으면 아무것도 하지 않는다. 없는 회원의 잔액을 만들지 않는다.
 * user.points가 비어 있거나 이상하면 0에서 시작한다(기존 applyPoints와 같은 규칙).
 */
export function prepareRestoredPoints(
  data: AppData,
  userId: string,
  amount: number,
): PointsRestorePlan {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, reason: "invalid-amount" };
  }
  const id = userId.trim();
  if (!id) return { ok: false, reason: "user-not-found" };

  const user = data.users.find((item) => item.id === id);
  if (!user) return { ok: false, reason: "user-not-found" };

  const previousPoints = Math.max(0, Math.floor(user.points ?? 0));
  return { ok: true, user, previousPoints, nextPoints: previousPoints + amount };
}
