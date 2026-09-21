/**
 * 일반 문의·채팅 보존기간 정리 실행 (Privacy-Inquiries-Chat-Cleanup-2).
 *
 * 규칙은 inquiryChatCleanup.ts가 정한다. 이 파일은 그 규칙대로 실제 저장소를 바꾼다.
 * 관리자 API에는 아직 연결하지 않는다. 일정에 따라 스스로 도는 구조도 만들지 않는다.
 *
 * ── 한 번에 얼마나 지우는가 ──
 *
 * limit을 호출부가 **반드시** 정한다. 기본값을 숨겨 두지 않는다. 처음 실행에서
 * 몇 건이 지워질지 모르는 채로 무제한 삭제가 나가는 일을 구조적으로 막기 위해서다.
 * 양의 정수가 아니면 아무것도 하지 않는다.
 *
 * ── 지우는 것 ──
 *
 * legacy: app_store.data.inquiries[]의 만료 원소. 다른 키는 건드리지 않는다.
 * chat  : chat_inquiries의 만료 행. 메시지는 FK ON DELETE CASCADE로 함께 사라진다.
 *         chat_inquiry_messages를 직접 지우는 문장을 두지 않는다.
 * complaint_records·refund_requests·orders·payments·consultations는 보지도 않는다.
 *
 * ── 돌려주는 값 ──
 *
 * 건수와 정해 둔 사유뿐이다. 문의 id·이름·연락처·본문·회원 정보는 담지 않는다.
 */
import {
  COUNT_EXPIRED_CHAT_SQL,
  DELETE_CHAT_BY_IDS_SQL,
  SELECT_EXPIRED_CHAT_IDS_SQL,
  cleanupCutoff,
  countExpiredInquiries,
  isValidCleanupLimit,
  pruneExpiredInquiries,
  type ChatCleanupResult,
  type InquiryChatPreflightResult,
  type InquiryCleanupResult,
} from "@/lib/server/inquiryChatCleanup";
import { isAppStoreConflict, readData, sqlClient, writeData } from "@/lib/server/store";
import type { AppData, Inquiry } from "@/lib/types/app";

/** 겹쳐서 밀렸을 때 다시 시도하는 횟수. legacyCodesCleanup과 같은 크기로 둔다. */
export const INQUIRY_CLEANUP_MAX_ATTEMPTS = 3;

/**
 * 실행에 필요한 바깥 세계.
 *
 * 접속 문자열을 받지 않는다. 저장소를 읽고 쓰는 수단과 충돌 판정만 받는다.
 * 기본값은 아래 defaultInquiryCleanupDeps가 준다.
 */
export interface InquiryCleanupDeps {
  readData: () => Promise<AppData>;
  writeData: (data: AppData) => Promise<void>;
  isConflict: (error: unknown) => boolean;
}

export function defaultInquiryCleanupDeps(): InquiryCleanupDeps {
  return { readData, writeData, isConflict: isAppStoreConflict };
}

/**
 * 만료된 legacy 문의를 최대 limit건 지운다.
 *
 * 겹쳐서 밀리면 최신 자료를 **다시 읽어** 처음부터 다시 한다(legacyCodesCleanup과 같은 규약).
 * 지난 회차의 자료도 결과도 다시 쓰지 않는다. 밀린 사이에 새 문의가 저장되었을 수 있다.
 * 겹침이 아닌 오류는 그대로 올린다. 이유를 모른 채로 다시 지우지 않는다.
 *
 * 지울 것이 없으면 저장하지 않는다. app_store는 한 행에 전체 자료를 담아 저장이 곧
 * 전체 재작성이라, 바꿀 것이 없는데 쓰면 관계없는 요청과 경합만 만든다.
 */
export async function runExpiredInquiryCleanup(
  deps: InquiryCleanupDeps,
  now: string,
  limit: number,
  maxAttempts: number = INQUIRY_CLEANUP_MAX_ATTEMPTS,
): Promise<InquiryCleanupResult> {
  if (!isValidCleanupLimit(limit)) return { ok: false, reason: "invalid-limit", attempts: 0 };
  const cutoff = cleanupCutoff(now);
  if (cutoff === null) return { ok: false, reason: "invalid-now", attempts: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // 회차마다 새로 읽는다. 지난 회차의 자료도 결과도 쓰지 않는다.
    const data = await deps.readData();
    const { next, deleted } = pruneExpiredInquiries<Inquiry>(data.inquiries, cutoff, limit);

    // 바꿀 것이 없으면 저장하지 않는다.
    if (deleted === 0) return { ok: true, deleted: 0, attempts: attempt };

    /*
     * 자리를 바꿔 끼운다(다른 store 함수들과 같이 data를 직접 바꾼다.
     * 사본을 만들면 기준 version을 잃는다). inquiries 말고는 건드리지 않는다.
     */
    const previous = data.inquiries;
    data.inquiries = next;
    try {
      await deps.writeData(data);
    } catch (error) {
      data.inquiries = previous;
      // 겹쳐서 밀린 경우가 아니면 그대로 올린다.
      if (!deps.isConflict(error)) throw error;
      // 개인정보는 남기지 않는다. 몇 번째 시도였는지만 남긴다.
      console.warn(`[inquiry-cleanup] store conflict on attempt ${attempt}`);
      continue;
    }
    return { ok: true, deleted, attempts: attempt };
  }

  console.warn("[inquiry-cleanup] store conflict exhausted");
  return { ok: false, reason: "cas-conflict", attempts: maxAttempts };
}

/**
 * 만료된 채팅 방을 최대 limit개 지운다.
 *
 * 두 문장으로 나눈다. 먼저 cutoff와 limit으로 대상 id만 고르고, 그 id들만 지운다.
 * 조건 하나로 바로 DELETE를 보내면 한 번에 몇 행이 사라질지 문장만으로는 알 수 없다.
 * 고른 id는 삭제에만 쓰고 밖으로 돌려주지 않는다.
 *
 * 메시지는 지우지 않는다. FK ON DELETE CASCADE가 방과 함께 없앤다.
 */
export async function runExpiredChatCleanup(
  now: string,
  limit: number,
): Promise<ChatCleanupResult> {
  if (!isValidCleanupLimit(limit)) return { ok: false, reason: "invalid-limit" };
  const cutoff = cleanupCutoff(now);
  if (cutoff === null) return { ok: false, reason: "invalid-now" };

  const sql = sqlClient();
  if (!sql) return { ok: false, reason: "database-required" };

  const rows = (await sql.query(SELECT_EXPIRED_CHAT_IDS_SQL, [cutoff, limit])) as {
    id: string;
  }[];
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return { ok: true, deleted: 0 };

  // RETURNING 1이라 돌아오는 행에는 값이 없다. 행 수가 곧 지운 건수다.
  const removed = (await sql.query(DELETE_CHAT_BY_IDS_SQL, [ids])) as unknown[];
  return { ok: true, deleted: Array.isArray(removed) ? removed.length : 0 };
}

/**
 * 사전 확인. 만료 건수만 세고 아무것도 바꾸지 않는다.
 *
 * writeData도 DELETE도 부르지 않는다. 부를 수단을 이 함수 안에 두지 않는다.
 * 실행과 같은 cutoff 규칙을 쓰므로, 여기서 본 수가 실제로 지워질 후보의 수다
 * (단 실행은 limit만큼만 지우므로 한 번에 다 지워지지는 않는다).
 *
 * 건수를 읽지 못하면 0으로 적지 않는다. "세지 못했다"를 그대로 돌려준다.
 */
export async function runInquiryChatCleanupPreflight(
  deps: Pick<InquiryCleanupDeps, "readData">,
  now: string,
): Promise<InquiryChatPreflightResult> {
  const cutoff = cleanupCutoff(now);
  if (cutoff === null) return { ok: false, reason: "invalid-now" };

  const sql = sqlClient();
  if (!sql) return { ok: false, reason: "database-required" };

  const data = await deps.readData();
  const expiredLegacyInquiries = countExpiredInquiries(data.inquiries, cutoff);

  const rows = (await sql.query(COUNT_EXPIRED_CHAT_SQL, [cutoff])) as {
    expired: number | string;
  }[];
  const raw = rows[0]?.expired;
  const expiredChatInquiries =
    typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : null;
  if (expiredChatInquiries === null || !Number.isSafeInteger(expiredChatInquiries)) {
    return { ok: false, reason: "count-failed" };
  }

  return {
    ok: true,
    checkedAt: now,
    cutoff,
    expiredLegacyInquiries,
    expiredChatInquiries,
  };
}
