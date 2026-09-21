/**
 * 관리자 수동 정리 실행 (Privacy-Cleanup-Execution-API-1).
 *
 * 이 모듈은 아무것도 읽지도 쓰지도 않는다. 저장소를 아는 수단을 두지 않고, 실행 함수도
 * 전부 넘겨받는다. 그래서 DB 없이 이 규칙 전부를 확인할 수 있고, 실제 저장소를 아는 쪽은
 * store.ts / verificationCodes.ts 하나씩으로 남는다.
 *
 * ── 한 요청에 한 가지만 ──
 *
 * 정리는 되돌릴 수 없다. 한 번의 실수가 여러 종류를 한꺼번에 실행하는 일이 없도록
 * action을 정확히 하나만 받고, 그 하나만 실행한다. 연속 실행도 병렬 실행도 만들지 않는다.
 * 여러 종류를 돌리려면 사람이 요청을 여러 번 보낸다.
 *
 * ── 확인 문구 ──
 *
 * 모든 action에 confirm이 필요하다. 값은 action 이름과 **정확히 같아야** 한다.
 * 별도의 매직 문자열을 만들지 않는 이유는, 무엇을 실행하는지 적는 행위 자체가 확인이기
 * 때문이다. 읽기만 하는 것처럼 보이는 prepare-schema도 예외로 두지 않는다.
 * 스키마 변경 역시 되돌리는 절차가 따로 필요한 일이다.
 *
 * ── 돌려주는 값 ──
 *
 * 건수와 정해 둔 사유 이름뿐이다. 주문 id·상담 id·회원 정보·SQL·접속 정보·받은 오류는
 * 하나도 담지 않는다. 특히 정리 결과의 results[]는 건별 id를 들고 있으므로 이 계층이
 * 그 배열을 그대로 내보내지 않는다. 사유의 수만 세어 담는다.
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type { RETENTION_CLEANUP_ERROR_REASON } from "./retentionCleanupRunner.ts";
import type { OrphanScrubBlockedReason } from "./retentionOrphanScrubPlan.ts";
import type { RetentionScrubBlockedReason } from "./retentionScrubPlan.ts";

/* ── action ─────────────────────────────────────────── */

/** 이 API가 실행할 수 있는 전부. 여기 없는 값은 실행하지 않는다. */
export const CLEANUP_ACTIONS = [
  "prepare-schema",
  "retention",
  "legacy-codes",
  "expired-verifications",
  "expired-inquiries-chat",
] as const;

export type CleanupAction = (typeof CLEANUP_ACTIONS)[number];

/**
 * 이번 버전에서 retention이 허용하는 유일한 한도.
 *
 * 처음 실행이라 후보가 몇 건인지 아직 모른다. 한 건만 처리해 보면 응답의 discovered가
 * 전체 후보 수를 알려 주므로, 규모를 확인하기 전에 여러 건을 지우지 않는다.
 * 값을 키우는 일은 실제 실행 결과를 보고 따로 정한다.
 */
export const RETENTION_LIMIT = 1;

/**
 * 일반 문의·채팅 정리가 한 번에 처리하는 한도.
 *
 * legacy 1건 + 채팅 1건이다. 이 정리도 처음 실행이라 몇 건이 지워질지 모른다.
 * 사전 확인(preflight)이 규모를 알려 주므로, 규모를 보기 전에 여러 건을 지우지 않는다.
 * retention의 한도와 값이 같아도 다른 정책이라 상수를 따로 둔다.
 */
export const INQUIRY_CHAT_CLEANUP_LIMIT = 1;

/* ── 실행 함수가 돌려주는 값의 모양 ─────────────────── */

/**
 * 아래 네 모양은 store.ts / verificationCodes.ts의 반환 타입과 같은 모양을 여기에
 * 적어 둔 것이다. 순수 모듈이 DB를 아는 파일을 참조하지 않게 하려는 것이고,
 * 모양이 어긋나면 실제 함수를 넘기는 자리(route)에서 타입 검사에 걸린다.
 *
 * 일부러 좁게 적는다. 예를 들어 legacy 결과의 mode나 정리 결과 항목의 id·kind는
 * 여기에 없다. 읽을 수 없게 해 두면 실수로 내보낼 수도 없다.
 */
export type SchemaPrepareResult = { supported: true } | { supported: false };

export type VerificationCleanupOutcome =
  | { supported: true; deleted: number }
  | { supported: false };

export type LegacyCodesOutcome =
  | { ok: true; deleted: number; attempts: number }
  | { ok: false; attempts: number };

export type ExpiredInquiryOutcome =
  | { ok: true; deleted: number; attempts: number }
  | { ok: false; reason: string; attempts: number };

export type ExpiredChatOutcome = { ok: true; deleted: number } | { ok: false; reason: string };

export interface RetentionRunOutcome {
  discovered: number;
  processed: number;
  remaining: number;
  succeeded: number;
  blocked: number;
  conflicts: number;
  errors: number;
  discoveryFailed: boolean;
  /** 건별 결과. 사유를 세는 데만 쓴다. id·kind는 이 모양에 없다. */
  results: readonly { reason?: string }[];
}

/**
 * 실행에 필요한 바깥 세계.
 *
 * 저장소를 읽는 수단도 쓰는 수단도 두지 않는다. 둘 수 없게 해 두면 나중에도 이 자리에서
 * 저장소에 닿을 수 없다. databaseMode는 참/거짓만 받는다(접속 문자열을 받지 않는다).
 */
export interface CleanupExecuteDeps {
  databaseMode: () => boolean;
  prepareSchema: () => Promise<SchemaPrepareResult>;
  runRetention: (now: string, limit: number) => Promise<RetentionRunOutcome>;
  cleanupLegacyCodes: (now: number) => Promise<LegacyCodesOutcome>;
  deleteExpiredVerifications: (now: Date) => Promise<VerificationCleanupOutcome>;
  /**
   * 만료된 legacy 문의를 최대 limit건 지운다.
   * inquiryChatCleanupStore.runExpiredInquiryCleanup과 같은 모양을 여기에 적어 둔다.
   */
  cleanupExpiredInquiries: (now: string, limit: number) => Promise<ExpiredInquiryOutcome>;
  /** 만료된 채팅 방을 최대 limit개 지운다. 메시지는 FK CASCADE가 함께 없앤다. */
  cleanupExpiredChats: (now: string, limit: number) => Promise<ExpiredChatOutcome>;
}

/* ── 사유 ───────────────────────────────────────────── */

/**
 * 정리 경로가 쓰는 사유 전부.
 *
 * 네 곳에서 온다. 주문 정리가 멈춘 사유, 짝 없는 상담 정리가 멈춘 사유,
 * 저장이 겹쳐 밀린 경우("cas-conflict"), 실행이 실패한 경우(runner의 고정값).
 * 그쪽에 새 사유가 생기면 아래 목록에서 타입 검사가 먼저 깨진다.
 */
type KnownRetentionReason =
  | RetentionScrubBlockedReason
  | OrphanScrubBlockedReason
  | "cas-conflict"
  | typeof RETENTION_CLEANUP_ERROR_REASON;

/**
 * 응답 키로 쓸 수 있는 사유. Record라 빠뜨려도, 없는 값을 적어도 타입 검사에 걸린다.
 *
 * allowlist인 이유는 결과의 reason이 문자열이기 때문이다. 목록에 없는 값이 섞여 오면
 * 그대로 버린다. 모르는 문자열을 응답 키로 만들면 그 자리로 무엇이든 새어 나갈 수 있다.
 */
const ALLOWED_REASONS: Record<KnownRetentionReason, true> = {
  "order-not-found": true,
  "consultation-not-found": true,
  "paired-order-exists": true,
  "missing-evidence": true,
  "invalid-evidence": true,
  "invalid-now": true,
  "not-yet": true,
  "cas-conflict": true,
  "scrub-failed": true,
};

/**
 * 사유별 건수를 센다. 정해 둔 사유만 담고, 한 번도 나오지 않은 사유는 담지 않는다.
 *
 * 세는 것 말고는 아무것도 읽지 않는다. id도 kind도 이 함수에 들어오지 않는다.
 */
export function countRetentionReasons(
  results: readonly { reason?: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of results) {
    const reason = item?.reason;
    if (typeof reason !== "string") continue;
    // 모르는 값은 버린다. 응답 키를 결과가 정하게 두지 않는다.
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_REASONS, reason)) continue;
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return counts;
}

/* ── 응답 ───────────────────────────────────────────── */

/** 거절 사유. 고정 코드와 고정 문구뿐이다. 받은 값도 오류도 담지 않는다. */
export const CLEANUP_ERRORS = {
  INVALID_ACTION: "정리 항목을 정확히 하나만 지정해 주세요.",
  CONFIRM_REQUIRED: "확인 문구가 정리 항목과 같아야 합니다.",
  INVALID_LIMIT: "이번 실행에서는 한 건만 처리할 수 있습니다.",
  DATABASE_MODE_REQUIRED: "데이터베이스 모드에서만 실행할 수 있습니다.",
  CLEANUP_FAILED: "정리를 실행하지 못했습니다.",
} as const;

export type CleanupErrorCode = keyof typeof CLEANUP_ERRORS;

export interface CleanupErrorBody {
  error: CleanupErrorCode;
  message: string;
}

export interface PrepareSchemaBody {
  action: "prepare-schema";
  preparedAt: string;
  ok: true;
}

/**
 * 정리 결과 요약.
 *
 * ok를 두지 않는다. 후보를 읽지 못한 실행(discoveryFailed)을 "끝났다"로 읽게 만드는
 * 자리를 만들지 않기 위해서다. 보는 쪽은 discoveryFailed와 remaining을 함께 읽는다.
 */
export interface RetentionBody {
  action: "retention";
  ranAt: string;
  discovered: number;
  processed: number;
  remaining: number;
  succeeded: number;
  blocked: number;
  conflicts: number;
  errors: number;
  discoveryFailed: boolean;
  reasons: Record<string, number>;
}

export interface LegacyCodesBody {
  action: "legacy-codes";
  ranAt: string;
  deleted: number;
  attempts: number;
  ok: boolean;
}

/**
 * 일반 문의·채팅 정리 결과.
 *
 * 두 갈래를 한 몸에 담되 서로의 성패를 가리지 않는다. legacy가 실패하면 채팅은
 * 실행하지 않으며(ran=false), 그 사실이 응답에 그대로 드러난다.
 * 사유는 정해 둔 고정 문자열뿐이고 받은 오류·SQL·개인정보는 담지 않는다.
 */
export interface ExpiredInquiriesChatBody {
  action: "expired-inquiries-chat";
  ranAt: string;
  legacy: { ran: boolean; ok: boolean; deleted: number; attempts: number; reason?: string };
  chat: { ran: boolean; ok: boolean; deleted: number; reason?: string };
}

export interface ExpiredVerificationsBody {
  action: "expired-verifications";
  ranAt: string;
  deleted: number;
  ok: true;
}

export type CleanupResponseBody =
  | CleanupErrorBody
  | PrepareSchemaBody
  | RetentionBody
  | LegacyCodesBody
  | ExpiredVerificationsBody
  | ExpiredInquiriesChatBody;

export interface CleanupExecuteResponse {
  status: number;
  body: CleanupResponseBody;
}

/** 거절 응답을 만든다. 상태 코드는 사유마다 하나로 정해져 있다. */
function refuse(code: CleanupErrorCode): CleanupExecuteResponse {
  const status =
    code === "DATABASE_MODE_REQUIRED" ? 409 : code === "CLEANUP_FAILED" ? 500 : 400;
  return { status, body: { error: code, message: CLEANUP_ERRORS[code] } };
}

/* ── 입력 확인 ──────────────────────────────────────── */

/** 본문의 action이 허용된 값 하나인지. 배열·숫자·여러 값은 여기서 걸린다. */
function readAction(value: unknown): CleanupAction | null {
  if (typeof value !== "string") return null;
  return (CLEANUP_ACTIONS as readonly string[]).includes(value)
    ? (value as CleanupAction)
    : null;
}

/**
 * 한도가 이번 버전이 허용하는 값인지.
 *
 * 정수 1 하나만 받는다. 0·음수·소수·NaN·문자열·2 이상이 모두 여기서 걸린다.
 * "1로 읽히는 값"(문자열 "1", true)도 받지 않는다. 숫자로 적어야 한다.
 */
function isAllowedLimit(value: unknown): boolean {
  return typeof value === "number" && value === RETENTION_LIMIT;
}

/* ── 실행 ───────────────────────────────────────────── */

/**
 * 정리 한 가지를 실행한다.
 *
 * now는 밖에서 받는다. 요청 처리 시작 시각 하나를 그대로 쓰기 위해서다.
 * 함수 안에서 만들면 판정 시각과 적히는 시각이 갈라진다.
 *
 * 차례는 이렇다. action → confirm → DB 모드 → (retention이면) 한도 → 실행.
 * 어느 하나라도 걸리면 실행 함수를 **한 번도 부르지 않는다**.
 */
export async function runCleanupExecute(
  deps: CleanupExecuteDeps,
  body: Record<string, unknown> | null,
  now: string,
): Promise<CleanupExecuteResponse> {
  const action = readAction(body?.action);
  if (!action) return refuse("INVALID_ACTION");

  // 무엇을 실행하는지 그대로 적어야 한다. 읽기처럼 보이는 것도 예외가 아니다.
  if (body?.confirm !== action) return refuse("CONFIRM_REQUIRED");

  // 파일 모드에는 정리할 저장소가 없다. 어떤 action도 실행하지 않는다.
  if (!deps.databaseMode()) return refuse("DATABASE_MODE_REQUIRED");

  if (action === "retention" && !isAllowedLimit(body?.limit)) return refuse("INVALID_LIMIT");

  // 일반 문의·채팅 정리도 한도를 적어야 한다. 값은 이번 버전이 허용하는 1 하나뿐이다.
  if (action === "expired-inquiries-chat" && body?.limit !== INQUIRY_CHAT_CLEANUP_LIMIT) {
    return refuse("INVALID_LIMIT");
  }

  try {
    return await execute(deps, action, now);
  } catch {
    /*
     * 받은 오류는 버린다. 문장·인자·접속 정보가 섞여 있을 수 있다.
     * 남기는 기록은 어느 정리가 실패했는지뿐이다. action은 정해 둔 값이라 안전하다.
     */
    console.warn(`[cleanup] execution failed (${action})`);
    return refuse("CLEANUP_FAILED");
  }
}

/** action 하나를 실제로 실행한다. 부르는 함수는 언제나 하나뿐이다. */
async function execute(
  deps: CleanupExecuteDeps,
  action: CleanupAction,
  now: string,
): Promise<CleanupExecuteResponse> {
  if (action === "prepare-schema") {
    const result = await deps.prepareSchema();
    // 준비할 자리가 없다는 답이다. 준비했다고 말하지 않는다.
    if (!result.supported) return refuse("DATABASE_MODE_REQUIRED");
    return { status: 200, body: { action, preparedAt: now, ok: true } };
  }

  if (action === "retention") {
    const summary = await deps.runRetention(now, RETENTION_LIMIT);
    return {
      status: 200,
      body: {
        action,
        ranAt: now,
        discovered: summary.discovered,
        processed: summary.processed,
        // 남은 수는 정리 쪽이 센 값을 그대로 쓴다. 여기서 다시 계산하지 않는다.
        remaining: summary.remaining,
        succeeded: summary.succeeded,
        blocked: summary.blocked,
        conflicts: summary.conflicts,
        errors: summary.errors,
        // 후보를 읽지 못했다는 사실을 지우지 않는다.
        discoveryFailed: summary.discoveryFailed,
        reasons: countRetentionReasons(summary.results),
      },
    };
  }

  if (action === "expired-inquiries-chat") {
    /*
     * 두 저장소를 차례로 정리한다. 한도는 각각 1건이고, 기준 시각(now)은 하나다.
     *
     * legacy가 끝나지 못했으면 채팅으로 넘어가지 않는다. 한쪽이 밀린 채로 다른 쪽만
     * 지우면 응답이 "절반은 됐다"를 "됐다"처럼 보이게 만든다. 멈추고 그대로 적는다.
     */
    const legacy = await deps.cleanupExpiredInquiries(now, INQUIRY_CHAT_CLEANUP_LIMIT);
    if (!legacy.ok) {
      return {
        status: 200,
        body: {
          action,
          ranAt: now,
          legacy: { ran: true, ok: false, deleted: 0, attempts: legacy.attempts, reason: legacy.reason },
          chat: { ran: false, ok: false, deleted: 0 },
        },
      };
    }

    const chat = await deps.cleanupExpiredChats(now, INQUIRY_CHAT_CLEANUP_LIMIT);
    return {
      status: 200,
      body: {
        action,
        ranAt: now,
        legacy: { ran: true, ok: true, deleted: legacy.deleted, attempts: legacy.attempts },
        chat: chat.ok
          ? { ran: true, ok: true, deleted: chat.deleted }
          : { ran: true, ok: false, deleted: 0, reason: chat.reason },
      },
    };
  }

  if (action === "legacy-codes") {
    // 이 정리만 epoch ms를 받는다. 기준 시각은 하나이고 모양만 맞춰 넘긴다.
    const result = await deps.cleanupLegacyCodes(Date.parse(now));
    return {
      status: 200,
      body: {
        action,
        ranAt: now,
        // 겹쳐서 밀렸으면 지운 것이 없다. 그때는 지웠다고 말하지 않는다.
        deleted: result.ok ? result.deleted : 0,
        attempts: result.attempts,
        ok: result.ok,
      },
    };
  }

  const result = await deps.deleteExpiredVerifications(new Date(now));
  // 이 저장소가 없는 환경이다. 지웠다고 말하지 않는다.
  if (!result.supported) return refuse("DATABASE_MODE_REQUIRED");
  return { status: 200, body: { action, ranAt: now, deleted: result.deleted, ok: true } };
}
