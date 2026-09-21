/**
 * 일반 문의·채팅 보존기간 정리 규칙 (Privacy-Inquiries-Chat-Cleanup-2).
 *
 * 순수 모듈이다. 아무것도 읽지 않고, 저장하지 않고, 시각을 만들지 않는다.
 * 실제 실행은 inquiryChatCleanupStore.ts가 하고, 이 파일은 "무엇이 만료인가"만 정한다.
 *
 * ── 이 90일이 무엇인가 ──
 *
 * 사주로그가 응대·재문의를 위해 두는 **내부 운영 보존기간**이다. 법정 보존기간이 아니다.
 * 실제 불만·분쟁으로 승격된 건은 complaint_records에 따로 남으며 이 정리의 대상이 아니다.
 * 주문·결제·환불·상담 기록도 대상이 아니다. 여기서 지우는 것은 일반 문의와 채팅뿐이다.
 *
 * 기존 콘텐츠성 개인정보 보관(서비스 완료 후 1년, retentionEligibility.ts)과 섞지 않는다.
 * 뜻도 기산점도 다르고, 한쪽을 고칠 때 다른 쪽이 따라 바뀌면 안 된다.
 * 그래서 RETENTION_YEARS를 import하지 않고 이 정책 전용 상수를 따로 둔다.
 *
 * ── 기준 시각 ──
 *
 * legacy 문의(app_store.data.inquiries[]) : createdAt   (상태도 종료 시각도 없는 접수 기록이다)
 * 채팅(chat_inquiries)                     : last_message_at (마지막 활동. 대화가 오가면 갱신된다)
 *
 * 상태(open/in_progress/closed)·회원 연결·비회원 토큰 유무는 판정에 쓰지 않는다.
 * 활동이 있으면 last_message_at이 앞으로 가서 자연히 대상에서 빠진다.
 *
 * ── 지우지 않는 쪽으로 기운다(fail-closed) ──
 *
 * 시각을 읽지 못하면 지우지 않는다. 미래 시각도 지우지 않는다.
 * 정확히 cutoff와 같은 시각도 지우지 않는다(cutoff보다 **이전**만 만료다).
 * 지우지 못해 사람이 한 번 더 보는 것은 되돌릴 수 있지만, 지운 기록은 되돌릴 수 없다.
 *
 * import 경로가 없는 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */

/**
 * 일반 문의·채팅의 내부 운영 보존기간(일).
 *
 * 달력이 아니라 고정 길이로 센다. 90일은 윤년·월말 문제가 없어서
 * 1년 보관(retentionEligibility.RETENTION_YEARS)처럼 달력 계산을 할 이유가 없다.
 * 그 상수와 값을 섞지 않는다. 다른 정책이다.
 */
export const INQUIRY_CHAT_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ISO 8601 날짜·시각. 서버가 남기는 값(new Date().toISOString())의 형태다.
 *
 * Date.parse는 "0000"이나 "Dec 2026" 같은 느슨한 문자열도 받아들인다. 삭제 여부를
 * 가르는 판정이라 그런 값을 시각으로 인정하지 않는다(retentionEligibility.ts와 같은 경계).
 */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** 달력에 있는 날짜인지. 2월 30일처럼 없는 날은 받지 않는다. */
function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  // 다음 달 0일이 이번 달의 마지막 날이다(윤년도 이 계산으로 맞는다).
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 시각으로 읽히는 값인지. 빈 값·공백·느슨한 문자열·없는 날짜는 받지 않는다.
 *
 * 형태 검사만으로는 부족하다. Date.parse는 "2026-02-30"을 3월 2일로 굴려서 받아들인다.
 * 서버가 만드는 값(toISOString)은 그런 날짜를 만들지 않으므로, 굴러간 값을 시각으로
 * 인정하지 않고 읽을 수 없는 값으로 본다(fail-closed).
 */
export function parseIsoTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!ISO_DATE_TIME.test(trimmed)) return null;
  const [year, month, day] = trimmed.slice(0, 10).split("-").map(Number);
  if (!isRealCalendarDate(year, month, day)) return null;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 만료 경계 시각. 이 시각보다 **이전**에 멈춘 기록이 정리 대상이다.
 *
 * now는 밖에서 받는다. 시각에 따라 답이 달라지는 판정이라 함수 안에서 만들지 않는다
 * (경계를 테스트로 고정할 수 있어야 한다). 읽을 수 없는 now면 null이고,
 * 호출부는 그때 아무것도 지우지 않는다.
 */
export function cleanupCutoff(
  now: string,
  days: number = INQUIRY_CHAT_RETENTION_DAYS,
): string | null {
  const nowMs = parseIsoTime(now);
  if (nowMs === null) return null;
  if (!Number.isSafeInteger(days) || days <= 0) return null;
  return new Date(nowMs - days * DAY_MS).toISOString();
}

/**
 * 이 시각이 만료인지.
 *
 * 경계는 셋 다 "지우지 않음"이다.
 *   읽을 수 없는 값 / 미래 값 / 정확히 cutoff와 같은 값
 */
export function isExpiredAt(value: unknown, cutoffIso: string): boolean {
  const cutoff = parseIsoTime(cutoffIso);
  if (cutoff === null) return false;
  const at = parseIsoTime(value);
  if (at === null) return false;
  return at < cutoff;
}

/** 한 번에 지울 최대 건수. 호출부가 반드시 정한다. 기본값을 숨겨 두지 않는다. */
export function isValidCleanupLimit(limit: unknown): limit is number {
  return typeof limit === "number" && Number.isSafeInteger(limit) && limit > 0;
}

/** legacy 문의 1건에서 판정에 쓰는 값만 본다. 이름·연락처·본문은 보지 않는다. */
interface HasCreatedAt {
  createdAt?: unknown;
}

/**
 * 만료된 문의만 덜어낸 **새 배열**을 만든다. 인자는 바꾸지 않는다.
 *
 * 배열 순서를 그대로 지킨다. 오래된 순서를 추측해 정렬하지 않는다.
 * 정렬하면 저장 순서가 바뀌어 화면이 달라지고, 한 번에 limit만 지우는 이번 방식에서는
 * "어느 것이 먼저 지워지는가"가 정렬 기준에 따라 흔들린다.
 *
 * 배열이 아니거나 원소가 객체가 아니면 그대로 남긴다(판정하지 못한 것을 지우지 않는다).
 * limit에 도달하면 나머지는 만료여도 남긴다. 다음 실행에서 이어서 지운다.
 */
export function pruneExpiredInquiries<T extends HasCreatedAt>(
  inquiries: readonly T[] | null | undefined,
  cutoffIso: string,
  limit: number,
): { next: T[]; deleted: number } {
  if (!Array.isArray(inquiries)) return { next: [], deleted: 0 };
  if (!isValidCleanupLimit(limit)) return { next: [...inquiries], deleted: 0 };

  const next: T[] = [];
  let deleted = 0;
  for (const item of inquiries) {
    if (
      deleted < limit &&
      item !== null &&
      typeof item === "object" &&
      isExpiredAt(item.createdAt, cutoffIso)
    ) {
      deleted += 1;
      continue;
    }
    next.push(item);
  }
  return { next, deleted };
}

/* ── 채팅 질의 ──────────────────────────────────────── */

/**
 * 지울 채팅 방의 id만 고른다. 삭제 대상을 먼저 좁히기 위한 문장이다.
 *
 * $1 = cutoff(ISO), $2 = limit. 값은 전부 파라미터로 넘긴다.
 * 조건은 last_message_at 하나뿐이다. 상태·회원·비회원 토큰은 조건에 없다.
 * NULL인 행은 비교가 참이 되지 않아 자동으로 빠진다(그 자체가 fail-closed다).
 * 오래 멈춘 방부터 지우려고 오름차순으로 고른다.
 */
export const SELECT_EXPIRED_CHAT_IDS_SQL = `
  SELECT id FROM chat_inquiries
  WHERE last_message_at < $1::timestamptz
  ORDER BY last_message_at ASC
  LIMIT $2
`;

/**
 * 고른 id만 지운다.
 *
 * chat_inquiry_messages를 직접 지우지 않는다. FK가 ON DELETE CASCADE라
 * 방을 지우면 그 안의 메시지가 함께 사라진다(store.ts의 스키마).
 * RETURNING 1은 지운 행 수를 세기 위한 것이다. 값이 아니라 상수를 돌려주므로
 * 문의 id·이름·연락처·본문은 응답 경로에 오르지 않는다.
 */
export const DELETE_CHAT_BY_IDS_SQL = `
  DELETE FROM chat_inquiries WHERE id = ANY($1::text[]) RETURNING 1
`;

/**
 * 만료된 채팅 방이 몇 개인지만 센다. 지우지 않는다.
 *
 * 조건은 삭제와 같은 last_message_at 하나뿐이다(두 곳의 경계가 어긋나지 않게 같은 뜻을 쓴다).
 * 고르는 것은 건수뿐이라 id·이름·연락처·본문이 응답 경로에 오를 자리가 없다.
 */
export const COUNT_EXPIRED_CHAT_SQL = `
  SELECT count(*)::int AS expired
  FROM chat_inquiries
  WHERE last_message_at < $1::timestamptz
`;

/** 사전 확인 결과. 건수와 시각뿐이다. */
export type InquiryChatPreflightResult =
  | {
      ok: true;
      checkedAt: string;
      cutoff: string;
      expiredLegacyInquiries: number;
      expiredChatInquiries: number;
    }
  | { ok: false; reason: "invalid-now" | "database-required" | "count-failed" };

/**
 * 만료된 legacy 문의 수를 센다. 배열을 바꾸지 않는다.
 *
 * 읽을 수 없거나 없는 createdAt은 세지 않는다. 지우지 않을 것을 "지울 것"으로
 * 보여 주면 사전 확인이 실제 실행과 다른 수를 말하게 된다.
 */
export function countExpiredInquiries<T extends HasCreatedAt>(
  inquiries: readonly T[] | null | undefined,
  cutoffIso: string,
): number {
  if (!Array.isArray(inquiries)) return 0;
  let expired = 0;
  for (const item of inquiries) {
    if (item !== null && typeof item === "object" && isExpiredAt(item.createdAt, cutoffIso)) {
      expired += 1;
    }
  }
  return expired;
}

/* ── 결과 ───────────────────────────────────────────── */

/**
 * 정리 결과. 건수와 고정 사유뿐이다.
 * 문의 id·이름·연락처·본문·회원 정보는 이 모양에 자리가 없다.
 */
export type InquiryCleanupResult =
  | { ok: true; deleted: number; attempts: number }
  | { ok: false; reason: "cas-conflict"; attempts: number }
  | { ok: false; reason: "invalid-now" | "invalid-limit"; attempts: 0 };

export type ChatCleanupResult =
  | { ok: true; deleted: number }
  | { ok: false; reason: "invalid-now" | "invalid-limit" | "database-required" };
