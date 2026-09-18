/**
 * 보관 만료 정리의 재시도 (Privacy-Retention-Retry-1).
 *
 * 하는 일은 하나다. "저장이 겹쳐 밀렸을 때만, 최신 자료로 처음부터 다시 한다."
 * 스스로는 아무것도 판정하지 않고 아무것도 지우지 않는다. 무엇을 할지는 넘겨받은
 * 시도 함수가 정한다.
 *
 * ── 왜 재시도가 필요한가 ──
 *
 * app_store는 id=1 한 행에 전체 자료를 담고, 저장은 낙관적 CAS다. 건 하나만
 * 정리해도 물리적으로는 전체를 다시 쓰므로 다른 주문·상담·회원 변경과 상시 경합한다.
 * 겹쳐서 밀리는 것은 오류가 아니라 흔한 일이고, 밀렸을 때 아무것도 바뀌지 않았다는
 * 사실이 이미 보장되어 있다(AppStoreConflictError).
 *
 * ── 매번 처음부터 다시 한다 ──
 *
 * 시도마다 **반드시 자료를 새로 읽는다.** 지난 회차의 AppData나 계획을 다시 쓰지
 * 않는다. 밀린 사이에 무엇이든 달라질 수 있기 때문이다. 상담이 다시 열렸을 수도,
 * 짝이 되는 주문이 생겼을 수도 있다. 그때는 지우지 않는 쪽이 옳다.
 * 판정을 지난 회차 값으로 대신하면 그 변화가 보이지 않는다.
 *
 * ── 겹침만 다시 한다 ──
 *
 * 다시 하는 것은 CAS 충돌뿐이다. 그 밖의 오류(연결 끊김, SQL 오류, 프로그램 오류)는
 * 그대로 올린다. 왜 실패했는지 모르는 채로 개인정보를 지우는 일을 반복하지 않는다.
 *
 * 대상이 아니라는 답(blocked)은 실패가 아니다. 다시 해도 같은 답이므로 그 자리에서 끝난다.
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type { AppData } from "@/lib/types/app";

/** 최초 시도를 포함한 최대 시도 횟수. 이 파일 밖에서 바꾸지 않는다. */
export const RETENTION_SCRUB_MAX_ATTEMPTS = 3;

/**
 * 재시도에 필요한 바깥 세계.
 *
 * 저장소를 직접 부르지 않고 넘겨받는다. DB 없이 이 규칙 자체를 확인할 수 있어야 하고,
 * 실제 저장소를 아는 쪽은 store.ts 하나로 두기 위해서다.
 */
export interface RetentionRetryDeps<T> {
  /** 시도마다 최신 자료를 읽는다. 회차마다 새 객체여야 한다(CAS 기준 version이 붙는다). */
  readData: () => Promise<AppData>;
  /** 실제로 판정하고 저장하는 함수. 넘겨받은 자료만 본다. */
  attempt: (data: AppData) => Promise<T>;
  /** 이 오류가 "겹쳐서 밀림"인지. store.ts의 isAppStoreConflict를 넘긴다. */
  isConflict: (error: unknown) => boolean;
}

/**
 * 재시도 결과.
 *
 * exhausted는 오류가 아니라 사실이다. 정해진 횟수만큼 모두 겹쳐서 놓쳤다는 뜻이며,
 * 이때 어느 저장소도 바뀌지 않았다. 나중에 다시 부르면 된다.
 */
export type RetentionRetryOutcome<T> =
  | { ok: true; result: T; attempts: number }
  | { ok: false; reason: "cas-conflict"; attempts: number };

/**
 * 겹쳐서 밀린 경우에만 최신 자료로 다시 시도한다.
 *
 * 성공하거나 "대상이 아니다"라는 답을 받으면 그 자리에서 끝낸다. 그 뒤로는
 * readData도 attempt도 다시 부르지 않는다(같은 건을 두 번 지우지 않기 위해서다).
 *
 * 남기는 기록은 몇 번째 시도였는지뿐이다. 이름·연락처·사연은 물론 주문 id나 상담 id도
 * 남기지 않는다. 어느 회원의 무엇을 지우는 중인지가 기록에 드러나지 않게 한다.
 */
export async function runRetentionScrubWithRetry<T>(
  deps: RetentionRetryDeps<T>,
  maxAttempts: number = RETENTION_SCRUB_MAX_ATTEMPTS,
): Promise<RetentionRetryOutcome<T>> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // 회차마다 새로 읽는다. 지난 회차의 자료도 계획도 쓰지 않는다.
    const data = await deps.readData();
    try {
      return { ok: true, result: await deps.attempt(data), attempts: attempt };
    } catch (error) {
      // 겹쳐서 밀린 경우가 아니면 그대로 올린다. 이유를 모른 채 다시 하지 않는다.
      if (!deps.isConflict(error)) throw error;
      // 개인정보는 남기지 않는다. 몇 번째 시도였는지만 남긴다.
      console.warn(`[retention] store conflict on attempt ${attempt}`);
    }
  }
  console.warn("[retention] store conflict exhausted");
  return { ok: false, reason: "cas-conflict", attempts: maxAttempts };
}
