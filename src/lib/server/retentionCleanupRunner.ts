/**
 * 보관 만료 정리 수동 실행 (Privacy-Retention-Runner-1).
 *
 * 하는 일은 하나다. 후보를 하나씩 기존 실행 경로에 넘기고 결과를 세어 돌려준다.
 * 스스로는 아무것도 판정하지 않고, 아무 SQL도 보내지 않고, 정리 규칙을 알지 못한다.
 *
 * ── 후보는 허가가 아니다 ──
 *
 * 후보 목록은 "지워도 된다"는 결론이 아니라 "살펴볼 만하다"는 표시일 뿐이다.
 * 목록을 읽은 순간과 실제로 지우는 순간 사이에 무엇이든 달라질 수 있다.
 * 그래서 이 파일은 후보의 id만 넘기고, 지워도 되는지는 넘겨받은 실행 함수가
 * **최신 자료를 다시 읽어** 처음부터 다시 판정한다. 그 경계를 여기서 건너뛰지 않는다.
 * 후보 목록에 담긴 값을 근거로 삼는 코드를 두지 않는 이유도 같다.
 *
 * ── 하나씩 한다 ──
 *
 * app_store는 한 행에 전체 자료를 담고 저장은 낙관적 CAS다. 여러 건을 동시에
 * 보내면 서로 밀어내며 충돌만 늘린다. 스스로 경합을 만들지 않으려고 순서대로 한다.
 *
 * ── 한 건이 실패해도 멈추지 않는다 ──
 *
 * 한 건의 실패는 그 건의 사실이다. 다음 건까지 멈출 이유가 없다.
 * 다만 후보를 아예 찾지 못했다면 시작할 수 없으므로 아무것도 하지 않는다(fail-closed).
 *
 * ── 남기는 값 ──
 *
 * 결과에도 기록에도 개인정보를 담지 않는다. 오류 내용(Error.message)도 그대로
 * 담지 않는다. 그 안에 값이 섞여 나올 수 있어서다. 정해 둔 사유만 돌려준다.
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type { RetentionCandidate } from "./retentionDiscovery.ts";

/**
 * 실행 함수가 돌려주는 값의 모양.
 *
 * store.ts의 RetentionScrubResult / OrphanScrubResult와 같은 모양을 여기에 적어 둔다.
 * 순수 모듈이 DB를 아는 파일을 참조하지 않게 하려는 것이고, 모양이 어긋나면
 * 타입 검사에서 드러난다.
 */
export type RunnerScrubResult = { applied: true } | { applied: false; reason: string };

/** 재시도까지 끝난 결과. store.ts의 RetentionScrubRetryResult와 같은 모양이다. */
export type RunnerRetryOutcome =
  | { ok: true; result: RunnerScrubResult; attempts: number }
  | { ok: false; reason: "cas-conflict"; attempts: number };

/**
 * 실행에 필요한 바깥 세계.
 *
 * 저장소도 정리 함수도 넘겨받는다. DB 없이 이 진행 규칙을 확인할 수 있어야 하고,
 * 실제 저장소를 아는 쪽을 store.ts 하나로 두기 위해서다.
 */
export interface RetentionCleanupDeps {
  findCandidates: (now: string) => Promise<RetentionCandidate[]>;
  /** 주문 1건. 최신 자료로 판정부터 다시 하는 재시도 wrapper여야 한다. */
  scrubOrder: (id: string, now: string) => Promise<RunnerRetryOutcome>;
  /** 짝 없는 상담 1건. 같은 규칙이다. */
  scrubOrphanConsultation: (id: string, now: string) => Promise<RunnerRetryOutcome>;
}

/** 한 건이 어떻게 끝났는지. */
export type RetentionCleanupOutcome = "succeeded" | "blocked" | "cas-conflict" | "error";

/** 오류로 끝났을 때 돌려주는 사유. 실제 오류 내용은 담지 않는다. */
export const RETENTION_CLEANUP_ERROR_REASON = "scrub-failed";

/**
 * 한 건의 결과.
 *
 * kind와 id 말고는 담지 않는다. 이름·연락처·사연은 물론 userId도 없다.
 * reason은 정리 경로가 정해 둔 사유이거나 위 고정값뿐이다.
 */
export interface RetentionCleanupItem {
  kind: RetentionCandidate["kind"];
  id: string;
  outcome: RetentionCleanupOutcome;
  /** blocked면 멈춘 사유, error면 고정 사유. 성공이면 없다. */
  reason?: string;
  /** 몇 번째 시도에서 끝났는지. 실행까지 가지 못했으면 없다. */
  attempts?: number;
}

/**
 * 실행 전체의 요약.
 *
 * discoveryFailed는 오류가 아니라 사실이다. 후보를 읽지 못해 아무것도 하지 않았다는
 * 뜻이며, "후보가 없었다"와 구분해야 해서 따로 둔다.
 */
export interface RetentionCleanupSummary {
  /** 후보 찾기가 돌려준 전체 건수. 한도를 적용하기 **전**의 수다. */
  discovered: number;
  /** 이번 실행에서 실제로 시도한 건수. 한도를 적용한 뒤의 수다. */
  processed: number;
  /** 이번에 손대지 않고 남은 건수. 다음 실행이 이어서 할 몫이다. */
  remaining: number;
  succeeded: number;
  blocked: number;
  conflicts: number;
  errors: number;
  discoveryFailed: boolean;
  results: RetentionCleanupItem[];
}

/** 한도가 정수 1 이상이 아닐 때 던지는 고정 문구. 값을 담지 않는다. */
const LIMIT_ERROR = "RETENTION_CLEANUP_LIMIT_INVALID";

/**
 * 후보를 찾아 하나씩 정리한다. 한 번만 돈다(되풀이하지 않는다).
 *
 * now는 서버가 만든 시각을 받는다. 한 번의 실행 안에서는 같은 시각을 쓴다.
 * 판정은 실행 함수가 그 시각으로 다시 하므로, 중간에 시각이 흐르며 경계가
 * 달라지는 일이 없다.
 *
 * ── 한도(limit) ──
 *
 * 몇 건까지 시도할지 부른 쪽이 반드시 정한다. 기본값을 두지 않는다.
 * 기본값이 있으면 아무 생각 없이 부른 호출이 후보 전체를 지우게 된다.
 * 한 번의 실행이 어디까지 갈지는 사람이 정할 일이다.
 *
 * 한도는 **후보를 찾은 뒤에** 적용한다. discovered는 언제나 전체 후보 수이고,
 * processed가 이번에 시도한 수다. 두 값을 갈라 두어야 부른 쪽이 "얼마나 남았는지"를
 * 알 수 있다. 한도를 찾기 단계에 밀어 넣으면 전체 수를 영영 알 수 없다.
 *
 * 정수 1 이상이 아니면 아무것도 하지 않고 던진다. 후보조차 읽지 않는다(fail-closed).
 * 상한은 여기서 정하지 않는다. 얼마까지 허용할지는 입력을 받는 쪽이 정할 일이다.
 */
export async function runRetentionCleanup(
  deps: RetentionCleanupDeps,
  now: string,
  limit: number,
): Promise<RetentionCleanupSummary> {
  /*
   * 한도부터 본다. 후보를 읽기 전에 멈춰야 한다.
   * 읽고 나서 멈추면 "아무것도 하지 않았다"가 아니라 "읽기는 했다"가 된다.
   * 0·음수·소수·NaN·Infinity가 모두 여기서 걸린다.
   */
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(LIMIT_ERROR);

  const empty: RetentionCleanupSummary = {
    discovered: 0,
    processed: 0,
    remaining: 0,
    succeeded: 0,
    blocked: 0,
    conflicts: 0,
    errors: 0,
    discoveryFailed: false,
    results: [],
  };

  let candidates: RetentionCandidate[];
  try {
    candidates = await deps.findCandidates(now);
  } catch {
    // 시작할 수 없다. 아무것도 지우지 않는다(fail-closed).
    // 개인정보는 남기지 않는다. 어느 단계가 막혔는지만 남긴다.
    console.warn("[retention] cleanup skipped: candidate lookup failed");
    return { ...empty, discoveryFailed: true };
  }

  /*
   * 앞에서부터 한도만큼만 가져간다. 후보 목록 자체는 바꾸지 않는다(slice는 새 배열이다).
   * 나머지는 다음 실행이 다시 찾아서 이어 한다. 여기서 기억해 두지 않는다.
   * 이어서 할 자리를 기억하면 그 자리가 낡는다. 후보는 매번 새로 찾는 것이 옳다.
   */
  const selected = candidates.slice(0, limit);

  const summary: RetentionCleanupSummary = {
    ...empty,
    discovered: candidates.length,
    processed: selected.length,
    // selected는 slice 결과라 discovered를 넘지 않는다. 그래서 음수가 되지 않는다.
    remaining: candidates.length - selected.length,
  };

  /*
   * 순서대로 한다. Promise.all로 묶지 않는다.
   * 동시에 보내면 같은 app_store 행을 두고 서로 밀어내며 충돌만 늘어난다.
   */
  for (const candidate of selected) {
    const { kind, id } = candidate;
    const run = kind === "order" ? deps.scrubOrder : deps.scrubOrphanConsultation;

    let outcome: RunnerRetryOutcome;
    try {
      outcome = await run(id, now);
    } catch {
      /*
       * 한 건의 실패다. 다음 건까지 멈추지 않는다.
       * 오류 내용은 담지도 남기지도 않는다. 값이 섞여 나올 수 있다.
       */
      console.warn(`[retention] cleanup item failed (${kind})`);
      summary.errors += 1;
      summary.results.push({ kind, id, outcome: "error", reason: RETENTION_CLEANUP_ERROR_REASON });
      continue;
    }

    // 정해진 횟수를 모두 겹쳐서 놓쳤다. 아무것도 바뀌지 않았다.
    if (!outcome.ok) {
      summary.conflicts += 1;
      summary.results.push({
        kind,
        id,
        outcome: "cas-conflict",
        reason: outcome.reason,
        attempts: outcome.attempts,
      });
      continue;
    }

    // 최신 상태에서 대상이 아니라고 판단했다. 실패도 성공도 아니다.
    if (!outcome.result.applied) {
      summary.blocked += 1;
      summary.results.push({
        kind,
        id,
        outcome: "blocked",
        reason: outcome.result.reason,
        attempts: outcome.attempts,
      });
      continue;
    }

    // 정리 경로가 적용을 마쳤다고 답한 경우에만 성공으로 센다.
    summary.succeeded += 1;
    summary.results.push({ kind, id, outcome: "succeeded", attempts: outcome.attempts });
  }

  return summary;
}
