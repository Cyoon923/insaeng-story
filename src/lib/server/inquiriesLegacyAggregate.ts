/**
 * 문의 잔존 현황 (Privacy-Inquiries-Chat-Diagnostic-2).
 *
 * 하는 일은 하나다. "탈퇴 회원·비회원을 가리키는 문의가 지금 몇 건 남아 있는가"를
 * 숫자로만 돌려준다. 아무것도 바꾸지 않고, 아무 값도 내보내지 않는다.
 *
 * 세는 곳은 셋이다.
 *   [A] app_store.data.inquiries[]   무료상담·이벤트 접수(JSONB)
 *   [B] chat_inquiries               상담원 문의방(테이블)
 *   [C] chat_inquiry_messages        그 안의 메시지(테이블)
 *
 * ── 탈퇴 판정은 withdrawnAt 하나다 ──
 *
 * User.withdrawnAt에 값이 있으면 탈퇴한 회원이다(types/app.ts, isActiveUser).
 * 이름이 "탈퇴회원"인지, 연락처가 비었는지는 판정에 쓰지 않는다. 그것들은
 * 비식별화의 부수 효과일 뿐이고, 정본은 withdrawnAt 하나뿐이다.
 * 빈 문자열은 값이 없는 것으로 본다(코드의 truthy 판정과 같은 경계다).
 *
 * ── 왜 DB 안에서 세는가 ──
 *
 * 문의도 회원도 개인정보다. app_store 행을 통째로 읽어 오면 회원 전체의 개인정보가
 * 애플리케이션 메모리에 올라온다. 숫자 몇 개를 얻자고 그렇게 할 이유가 없다.
 * 그래서 집계를 DB 안에서 끝내고, 돌려받는 것은 건수뿐이다.
 * SELECT 목록에 값이 없으면 내보낼 수도 없다.
 *
 * 저장소 모듈(store.ts)을 import하지 않는다. readData()·ensureTable()·
 * ensureAppStoreVersion()은 CREATE와 ALTER를 보낸다. 현황을 보기만 하려고
 * Production 스키마를 건드릴 수 없다. 확인하는 자리가 바꾸는 자리를 겸하지 않는다.
 * 쓸 수 없게 해 두면 나중에도 그럴 수 없다.
 *
 * ── 세는 칸이 서로 겹치지 않는다 ──
 *
 * [A] 문의 한 건은 넷 중 정확히 하나. 합은 언제나 total이다.
 *   memberLinkedActive / memberLinkedWithdrawn / memberLinkedUnknown / guestNoUserId
 *
 * [B] 문의방 한 행은 다섯 중 정확히 하나. 합은 언제나 total이다.
 *   memberLinkedActive / memberLinkedWithdrawn / memberLinkedUnknown
 *   guestWithToken               user_id 없음 + guest_token_hash 있음
 *   unlinkedNoUserNoGuestToken   user_id 없음 + guest_token_hash 없음
 *     ← schema에 제약이 없어 구조적으로 가능하다(Diagnostic-1B). 정상이면 0이다.
 *
 * [C] 메시지 한 행은 여섯 중 정확히 하나. 합은 언제나 totalMessages다.
 *   active / withdrawn / unknown / guest / unlinked / orphan
 *   orphanMessages는 FK(ON DELETE CASCADE) 때문에 정상 스키마에서는 0이다. 무결성 확인용이다.
 *
 * ── "Present"의 뜻 ──
 *
 * 구조적 존재 여부(NULL도 빈 문자열도 아님)뿐이다. 내용을 보지 않고, 길이도 재지 않고,
 * 유형으로 나누지도 않는다. NotAnonymized는 "익명화 표식이 아직 없는 건수"이며
 * 실명 잔존 건수가 아니다(이름은 자유 입력이라 코드로 판정할 수 없다. 상한값이다).
 *
 * ── 돌려주는 값 ──
 *
 * 건수와 시각뿐이다. 이름·연락처·문의 내용·메시지 본문·userId·guest token은
 * SELECT 목록에 아예 없다. 행을 돌려주지도 않고, 기간별·상품별로 쪼개지도 않는다.
 * 쪼개면 답에 기여하지 않는 정보만 늘고 작은 집단이 드러난다.
 *
 * import 경로가 없는 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */

/* ── 질의 ───────────────────────────────────────────── */

/** 비식별화된 기록의 이름 자리에 남는 값. withdrawAccount.WITHDRAWN_NAME과 같아야 한다. */
export const INQUIRY_ANONYMIZED_NAME = "탈퇴회원";

/**
 * chat 테이블이 실제로 있는지만 묻는다. 없으면 만들지 않는다.
 *
 * ensureTable()을 부르면 CREATE가 나간다. 확인하는 자리에서 스키마를 만들지 않는다.
 * to_regclass는 없는 이름에 대해 오류 대신 NULL을 준다.
 */
export const CHAT_TABLES_PRESENT_SQL = `
  SELECT (
    to_regclass('public.chat_inquiries') IS NOT NULL
    AND to_regclass('public.chat_inquiry_messages') IS NOT NULL
  ) AS chat_tables_present
`;

/**
 * [A] app_store.data.inquiries[] 현황. SELECT 하나이고 매개변수가 없다.
 *
 * users를 id로 한 번 묶는(GROUP BY) 이유는 같은 id가 두 번 들어 있는 과거 자료가
 * 있어도 문의 건수가 부풀지 않게 하기 위해서다. 묶지 않으면 join이 행을 늘린다.
 *
 * ->> 는 JSON null에도 SQL NULL을 주고, 원소가 객체가 아니어도(숫자·문자열 등)
 * 오류 없이 NULL을 준다. NULLIF(...,'')가 빈 문자열까지 같은 자리로 모은다.
 *
 * GROUP BY가 없어 결과는 언제나 한 행이다. app_store 행이 아직 없어도 마찬가지이며
 * 그때는 모든 칸이 0이다. 즉 이 문장만으로는 "저장된 것이 없다"와 "0건이다"를
 * 구분하지 않는다. 지금 질문에서는 그 구분이 답을 바꾸지 않는다.
 */
export const LEGACY_INQUIRIES_AGGREGATE_SQL = `
  WITH src AS (
    SELECT data FROM app_store WHERE id = 1
  ),
  member AS (
    SELECT
      u.value->>'id' AS id,
      bool_or(NULLIF(u.value->>'withdrawnAt', '') IS NOT NULL) AS withdrawn
    FROM src, LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(src.data->'users') = 'array'
           THEN src.data->'users' ELSE '[]'::jsonb END
    ) AS u
    WHERE NULLIF(u.value->>'id', '') IS NOT NULL
    GROUP BY u.value->>'id'
  ),
  inquiry AS (
    SELECT
      NULLIF(i.value->>'userId', '') AS user_id,
      (i.value->>'name' IS DISTINCT FROM '${INQUIRY_ANONYMIZED_NAME}') AS name_not_anonymized,
      NULLIF(i.value->>'name', '') IS NOT NULL AS name_present,
      NULLIF(i.value->>'phone', '') IS NOT NULL AS phone_present,
      NULLIF(i.value->>'message', '') IS NOT NULL AS message_present
    FROM src, LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(src.data->'inquiries') = 'array'
           THEN src.data->'inquiries' ELSE '[]'::jsonb END
    ) AS i
  ),
  joined AS (
    SELECT
      inquiry.user_id IS NOT NULL AS linked,
      member.id IS NOT NULL AS known,
      COALESCE(member.withdrawn, false) AS withdrawn,
      inquiry.name_not_anonymized,
      inquiry.name_present,
      inquiry.phone_present,
      inquiry.message_present
    FROM inquiry LEFT JOIN member ON member.id = inquiry.user_id
  )
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE linked AND known AND NOT withdrawn)::int AS member_linked_active,
    count(*) FILTER (WHERE linked AND known AND withdrawn)::int AS member_linked_withdrawn,
    count(*) FILTER (WHERE linked AND NOT known)::int AS member_linked_unknown,
    count(*) FILTER (WHERE NOT linked)::int AS guest_no_user_id,
    count(*) FILTER (
      WHERE linked AND known AND withdrawn AND name_not_anonymized
    )::int AS withdrawn_name_not_anonymized,
    count(*) FILTER (
      WHERE linked AND known AND withdrawn AND phone_present
    )::int AS withdrawn_phone_not_cleared,
    count(*) FILTER (
      WHERE linked AND known AND withdrawn AND message_present
    )::int AS withdrawn_message_present,
    count(*) FILTER (
      WHERE linked AND known AND withdrawn
    )::int AS withdrawn_user_id_present,
    count(*) FILTER (WHERE NOT linked AND name_present)::int AS guest_name_present,
    count(*) FILTER (WHERE NOT linked AND phone_present)::int AS guest_phone_present,
    count(*) FILTER (WHERE NOT linked AND message_present)::int AS guest_message_present
  FROM joined
`;

/**
 * [B]+[C] chat_inquiries / chat_inquiry_messages 현황. SELECT 하나다.
 *
 * 문의방과 메시지를 한 문장에서 센다. 분류 기준(회원·탈퇴·비회원·미연결)이 하나뿐이라
 * 두 번 적으면 한쪽만 고쳐질 자리가 생긴다.
 *
 * 메시지는 LEFT JOIN이다. 소속 문의방이 없는 행(orphan)을 지우지 않고 그대로 세기
 * 위해서다. 정상 스키마에서는 FK가 막아 0이지만, 0임을 확인하는 것도 확인이다.
 *
 * body는 count(*) FILTER의 조건에만 나오고 SELECT 목록에는 없다.
 * 비었는지 아닌지만 보고, 본문은 어디에도 담기지 않는다.
 */
export const CHAT_INQUIRIES_AGGREGATE_SQL = `
  WITH src AS (
    SELECT data FROM app_store WHERE id = 1
  ),
  member AS (
    SELECT
      u.value->>'id' AS id,
      bool_or(NULLIF(u.value->>'withdrawnAt', '') IS NOT NULL) AS withdrawn
    FROM src, LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(src.data->'users') = 'array'
           THEN src.data->'users' ELSE '[]'::jsonb END
    ) AS u
    WHERE NULLIF(u.value->>'id', '') IS NOT NULL
    GROUP BY u.value->>'id'
  ),
  inquiry AS (
    SELECT
      c.id AS inquiry_id,
      NULLIF(c.user_id, '') IS NOT NULL AS linked,
      NULLIF(c.guest_token_hash, '') IS NOT NULL AS tokened,
      member.id IS NOT NULL AS known,
      COALESCE(member.withdrawn, false) AS withdrawn,
      (c.name IS DISTINCT FROM '${INQUIRY_ANONYMIZED_NAME}') AS name_not_anonymized,
      NULLIF(c.name, '') IS NOT NULL AS name_present,
      NULLIF(c.phone, '') IS NOT NULL AS phone_present
    FROM chat_inquiries c
    LEFT JOIN member ON member.id = NULLIF(c.user_id, '')
  ),
  inquiry_counts AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE linked AND known AND NOT withdrawn)::int AS member_linked_active,
      count(*) FILTER (WHERE linked AND known AND withdrawn)::int AS member_linked_withdrawn,
      count(*) FILTER (WHERE linked AND NOT known)::int AS member_linked_unknown,
      count(*) FILTER (WHERE NOT linked AND tokened)::int AS guest_with_token,
      count(*) FILTER (WHERE NOT linked AND NOT tokened)::int AS unlinked_no_user_no_guest_token,
      count(*) FILTER (
        WHERE linked AND known AND withdrawn AND name_not_anonymized
      )::int AS withdrawn_name_not_anonymized,
      count(*) FILTER (
        WHERE linked AND known AND withdrawn AND phone_present
      )::int AS withdrawn_phone_not_cleared,
      count(*) FILTER (
        WHERE linked AND known AND withdrawn
      )::int AS withdrawn_user_id_present,
      count(*) FILTER (WHERE NOT linked AND tokened AND name_present)::int AS guest_name_present,
      count(*) FILTER (WHERE NOT linked AND tokened AND phone_present)::int AS guest_phone_present
    FROM inquiry
  ),
  message_counts AS (
    SELECT
      count(*)::int AS total_messages,
      count(*) FILTER (
        WHERE inquiry.linked AND inquiry.known AND NOT inquiry.withdrawn
      )::int AS messages_for_active_member_inquiry,
      count(*) FILTER (
        WHERE inquiry.linked AND inquiry.known AND inquiry.withdrawn
      )::int AS messages_for_withdrawn_member_inquiry,
      count(*) FILTER (
        WHERE inquiry.linked AND NOT inquiry.known
      )::int AS messages_for_unknown_member_inquiry,
      count(*) FILTER (
        WHERE NOT inquiry.linked AND inquiry.tokened
      )::int AS messages_for_guest_inquiry,
      count(*) FILTER (
        WHERE NOT inquiry.linked AND NOT inquiry.tokened
      )::int AS messages_for_unlinked_inquiry,
      count(*) FILTER (WHERE inquiry.inquiry_id IS NULL)::int AS orphan_messages,
      count(*) FILTER (
        WHERE inquiry.linked AND inquiry.known AND inquiry.withdrawn
          AND NULLIF(m.body, '') IS NOT NULL
      )::int AS withdrawn_message_body_present,
      count(*) FILTER (
        WHERE NOT inquiry.linked AND inquiry.tokened
          AND NULLIF(m.body, '') IS NOT NULL
      )::int AS guest_message_body_present
    FROM chat_inquiry_messages m
    LEFT JOIN inquiry ON inquiry.inquiry_id = m.inquiry_id
  )
  SELECT
    inquiry_counts.total,
    inquiry_counts.member_linked_active,
    inquiry_counts.member_linked_withdrawn,
    inquiry_counts.member_linked_unknown,
    inquiry_counts.guest_with_token,
    inquiry_counts.unlinked_no_user_no_guest_token,
    inquiry_counts.withdrawn_name_not_anonymized,
    inquiry_counts.withdrawn_phone_not_cleared,
    inquiry_counts.withdrawn_user_id_present,
    inquiry_counts.guest_name_present,
    inquiry_counts.guest_phone_present,
    message_counts.total_messages,
    message_counts.messages_for_active_member_inquiry,
    message_counts.messages_for_withdrawn_member_inquiry,
    message_counts.messages_for_unknown_member_inquiry,
    message_counts.messages_for_guest_inquiry,
    message_counts.messages_for_unlinked_inquiry,
    message_counts.orphan_messages,
    message_counts.withdrawn_message_body_present,
    message_counts.guest_message_body_present
  FROM inquiry_counts, message_counts
`;

/* ── 바깥 세계 ──────────────────────────────────────── */

/**
 * 집계에 필요한 바깥 세계.
 *
 * 접속 문자열을 받지 않는다. DB 모드인지는 참·거짓 하나로만 받고, 질의는 넘겨받은
 * 함수로 보낸다. 그 함수들은 인자를 받지 않는다. 보낼 문장이 위 상수들로 정해져
 * 있어서, 호출부가 다른 문장을 끼워 넣을 자리를 만들지 않는다.
 */
export interface InquiriesLegacyAggregateDeps {
  /** DB 모드인지. 참·거짓만 받는다. */
  databaseMode: () => boolean;
  /** CHAT_TABLES_PRESENT_SQL을 보내고 결과 행을 돌려준다. */
  queryChatTablesPresent: () => Promise<readonly Record<string, unknown>[]>;
  /** LEGACY_INQUIRIES_AGGREGATE_SQL을 보내고 결과 행을 돌려준다. */
  queryLegacyInquiries: () => Promise<readonly Record<string, unknown>[]>;
  /** CHAT_INQUIRIES_AGGREGATE_SQL을 보내고 결과 행을 돌려준다. */
  queryChatInquiries: () => Promise<readonly Record<string, unknown>[]>;
}

/* ── 응답 ───────────────────────────────────────────── */

/** [A] app_store.data.inquiries[] 현황. 앞의 네 칸의 합이 total이다. */
export interface LegacyInquiriesCounts {
  total: number;
  memberLinkedActive: number;
  memberLinkedWithdrawn: number;
  memberLinkedUnknown: number;
  guestNoUserId: number;
  /** memberLinkedWithdrawn 중 이름이 "탈퇴회원"이 아닌 건수(익명화 미적용 상한값). */
  withdrawnNameNotAnonymized: number;
  withdrawnPhoneNotCleared: number;
  withdrawnMessagePresent: number;
  /** memberLinkedWithdrawn 중 userId가 남아 있는 건수. 현 비식별화는 지우지 않는다(회귀 감시). */
  withdrawnUserIdPresent: number;
  guestNamePresent: number;
  guestPhonePresent: number;
  guestMessagePresent: number;
}

/** [B] chat_inquiries 현황. 앞의 다섯 칸의 합이 total이다. */
export interface ChatInquiriesCounts {
  total: number;
  memberLinkedActive: number;
  memberLinkedWithdrawn: number;
  memberLinkedUnknown: number;
  guestWithToken: number;
  /** user_id도 guest_token_hash도 없는 행. 정상이면 0이다(Diagnostic-1B). */
  unlinkedNoUserNoGuestToken: number;
  withdrawnNameNotAnonymized: number;
  withdrawnPhoneNotCleared: number;
  withdrawnUserIdPresent: number;
  guestNamePresent: number;
  guestPhonePresent: number;
}

/** [C] chat_inquiry_messages 현황. 앞의 여섯 칸의 합이 totalMessages다. 본문은 담지 않는다. */
export interface ChatInquiryMessagesCounts {
  totalMessages: number;
  messagesForActiveMemberInquiry: number;
  messagesForWithdrawnMemberInquiry: number;
  messagesForUnknownMemberInquiry: number;
  messagesForGuestInquiry: number;
  messagesForUnlinkedInquiry: number;
  /** 소속 문의방이 없는 메시지. FK 때문에 정상 스키마에서는 0이다(무결성 확인). */
  orphanMessages: number;
  withdrawnMessageBodyPresent: number;
  guestMessageBodyPresent: number;
}

/** chat 테이블이 없을 때 쓰는 모양. 칸을 지우지 않고 "세지 못했다"를 null로 적는다. */
export type NulledCounts<T> = { [K in keyof T]: null };

/** 관리자에게 돌려줄 현황. 배열도, 자유 키도, 값도 없다. */
export interface InquiriesLegacyAggregateBody {
  action: "inquiries-legacy-aggregate";
  /** 기준 시각(ISO). 이 현황이 언제의 사실인지를 적어 둔다. */
  checkedAt: string;
  /** DB 모드에서 센 결과라는 표시. 이 본문에서는 언제나 true다. */
  databaseMode: true;
  /** chat 테이블 두 개가 모두 있는지. false면 아래 두 묶음이 전부 null이다. */
  chatTablesPresent: boolean;
  legacyInquiries: LegacyInquiriesCounts;
  chatInquiries: ChatInquiriesCounts | NulledCounts<ChatInquiriesCounts>;
  chatInquiryMessages:
    | ChatInquiryMessagesCounts
    | NulledCounts<ChatInquiryMessagesCounts>;
}

/** 거절 사유. 고정 코드와 고정 문구뿐이다. 받은 오류도 질의도 담지 않는다. */
export const INQUIRIES_LEGACY_AGGREGATE_ERRORS = {
  DATABASE_MODE_REQUIRED: "데이터베이스 모드에서만 확인할 수 있습니다.",
  AGGREGATE_FAILED: "문의 현황을 확인하지 못했습니다.",
} as const;

export type InquiriesLegacyAggregateErrorCode =
  keyof typeof INQUIRIES_LEGACY_AGGREGATE_ERRORS;

export interface InquiriesLegacyAggregateErrorBody {
  error: InquiriesLegacyAggregateErrorCode;
  message: string;
  checkedAt: string;
  databaseMode: boolean;
}

export interface InquiriesLegacyAggregateResponse {
  status: number;
  body: InquiriesLegacyAggregateBody | InquiriesLegacyAggregateErrorBody;
}

function refuse(
  code: InquiriesLegacyAggregateErrorCode,
  now: string,
  databaseMode: boolean,
): InquiriesLegacyAggregateResponse {
  return {
    status: code === "DATABASE_MODE_REQUIRED" ? 409 : 500,
    body: {
      error: code,
      message: INQUIRIES_LEGACY_AGGREGATE_ERRORS[code],
      checkedAt: now,
      databaseMode,
    },
  };
}

/* ── 값 읽기 ────────────────────────────────────────── */

/**
 * 건수로 읽는다. 읽을 수 없으면 0이 아니라 null이고, 위에서 실패로 다룬다.
 *
 * 드라이버가 숫자로 줄 수도 문자열로 줄 수도 있어 둘 다 받는다. 0은 정상적인
 * 답이라 그대로 통과시키고, 읽지 못한 것과 구분한다. 읽지 못한 값을 0으로 적으면
 * "세어 보니 없었다"로 읽히기 때문이다.
 */
export function readCount(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/** 테이블 존재 여부. 참·거짓이 아니면 읽지 못한 것으로 본다(없음으로 보지 않는다). */
export function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "t" || value === "true") return true;
  if (value === "f" || value === "false") return false;
  return null;
}

/**
 * 행에서 정해진 칸들을 한꺼번에 건수로 읽는다.
 * 하나라도 읽지 못하면 전부 실패로 다룬다. 일부만 채워 돌려주면 보는 쪽이
 * 빠진 칸을 0으로 읽는다.
 */
function readCounts<K extends string>(
  row: Record<string, unknown>,
  fields: Readonly<Record<K, string>>,
): Record<K, number> | null {
  const result = {} as Record<K, number>;
  for (const key of Object.keys(fields) as K[]) {
    const count = readCount(row[fields[key]]);
    if (count === null) return null;
    result[key] = count;
  }
  return result;
}

/** 응답 칸 이름 ↔ 질의 칸 이름. 옮겨 적는 자리를 한 곳으로 모은다. */
const LEGACY_FIELDS = {
  total: "total",
  memberLinkedActive: "member_linked_active",
  memberLinkedWithdrawn: "member_linked_withdrawn",
  memberLinkedUnknown: "member_linked_unknown",
  guestNoUserId: "guest_no_user_id",
  withdrawnNameNotAnonymized: "withdrawn_name_not_anonymized",
  withdrawnPhoneNotCleared: "withdrawn_phone_not_cleared",
  withdrawnMessagePresent: "withdrawn_message_present",
  withdrawnUserIdPresent: "withdrawn_user_id_present",
  guestNamePresent: "guest_name_present",
  guestPhonePresent: "guest_phone_present",
  guestMessagePresent: "guest_message_present",
} as const satisfies Record<keyof LegacyInquiriesCounts, string>;

const CHAT_INQUIRY_FIELDS = {
  total: "total",
  memberLinkedActive: "member_linked_active",
  memberLinkedWithdrawn: "member_linked_withdrawn",
  memberLinkedUnknown: "member_linked_unknown",
  guestWithToken: "guest_with_token",
  unlinkedNoUserNoGuestToken: "unlinked_no_user_no_guest_token",
  withdrawnNameNotAnonymized: "withdrawn_name_not_anonymized",
  withdrawnPhoneNotCleared: "withdrawn_phone_not_cleared",
  withdrawnUserIdPresent: "withdrawn_user_id_present",
  guestNamePresent: "guest_name_present",
  guestPhonePresent: "guest_phone_present",
} as const satisfies Record<keyof ChatInquiriesCounts, string>;

const CHAT_MESSAGE_FIELDS = {
  totalMessages: "total_messages",
  messagesForActiveMemberInquiry: "messages_for_active_member_inquiry",
  messagesForWithdrawnMemberInquiry: "messages_for_withdrawn_member_inquiry",
  messagesForUnknownMemberInquiry: "messages_for_unknown_member_inquiry",
  messagesForGuestInquiry: "messages_for_guest_inquiry",
  messagesForUnlinkedInquiry: "messages_for_unlinked_inquiry",
  orphanMessages: "orphan_messages",
  withdrawnMessageBodyPresent: "withdrawn_message_body_present",
  guestMessageBodyPresent: "guest_message_body_present",
} as const satisfies Record<keyof ChatInquiryMessagesCounts, string>;

function nulled<T extends object>(fields: Readonly<Record<keyof T, string>>): NulledCounts<T> {
  const result = {} as NulledCounts<T>;
  for (const key of Object.keys(fields) as (keyof T)[]) result[key] = null;
  return result;
}

/* ── 실행 ───────────────────────────────────────────── */

/**
 * 현황을 한 번 센다.
 *
 * now는 밖에서 받는다. 요청 처리 시작 시각 하나를 그대로 적기 위해서다.
 *
 * 차례는 DB 모드 → 테이블 존재 확인 → [A] → (있으면) [B]+[C]다.
 * 앞에서 걸리면 뒤의 질의를 한 번도 보내지 않는다.
 *
 * chat 테이블이 없는 것은 실패가 아니다. 아직 만들어지지 않은 저장소일 수 있고,
 * 그때도 [A]의 규모는 알 수 있어야 한다. 만들지 않고 null로 적는다.
 *
 * 받은 오류는 버린다. 문장·인자·접속 정보가 섞여 있을 수 있어 밖으로 내보내지 않고
 * 따로 기록하지도 않는다. 돌려주는 것은 정해 둔 코드 하나다.
 */
export async function runInquiriesLegacyAggregate(
  deps: InquiriesLegacyAggregateDeps,
  now: string,
): Promise<InquiriesLegacyAggregateResponse> {
  if (!deps.databaseMode()) return refuse("DATABASE_MODE_REQUIRED", now, false);

  let chatTablesPresent: boolean | null;
  let legacyRow: Record<string, unknown> | undefined;
  try {
    chatTablesPresent = readBoolean((await deps.queryChatTablesPresent())[0]?.chat_tables_present);
    legacyRow = (await deps.queryLegacyInquiries())[0];
  } catch {
    return refuse("AGGREGATE_FAILED", now, true);
  }
  if (chatTablesPresent === null || !legacyRow) return refuse("AGGREGATE_FAILED", now, true);

  // 이 문장들은 언제나 한 행을 준다(집계에 GROUP BY가 없다). 행이 없다면 문장이 바뀌었거나
  // 드라이버가 결과를 주지 못한 것이다. 그때는 0건으로 적지 않고 세지 못한 것으로 다룬다.
  const legacyInquiries = readCounts<keyof LegacyInquiriesCounts>(legacyRow, LEGACY_FIELDS);
  if (!legacyInquiries) return refuse("AGGREGATE_FAILED", now, true);

  if (!chatTablesPresent) {
    return {
      status: 200,
      body: {
        action: "inquiries-legacy-aggregate",
        checkedAt: now,
        databaseMode: true,
        chatTablesPresent: false,
        legacyInquiries,
        chatInquiries: nulled<ChatInquiriesCounts>(CHAT_INQUIRY_FIELDS),
        chatInquiryMessages: nulled<ChatInquiryMessagesCounts>(CHAT_MESSAGE_FIELDS),
      },
    };
  }

  let chatRow: Record<string, unknown> | undefined;
  try {
    chatRow = (await deps.queryChatInquiries())[0];
  } catch {
    return refuse("AGGREGATE_FAILED", now, true);
  }
  if (!chatRow) return refuse("AGGREGATE_FAILED", now, true);

  const chatInquiries = readCounts<keyof ChatInquiriesCounts>(chatRow, CHAT_INQUIRY_FIELDS);
  const chatInquiryMessages = readCounts<keyof ChatInquiryMessagesCounts>(
    chatRow,
    CHAT_MESSAGE_FIELDS,
  );
  if (!chatInquiries || !chatInquiryMessages) return refuse("AGGREGATE_FAILED", now, true);

  return {
    status: 200,
    body: {
      action: "inquiries-legacy-aggregate",
      checkedAt: now,
      databaseMode: true,
      chatTablesPresent: true,
      legacyInquiries,
      chatInquiries,
      chatInquiryMessages,
    },
  };
}
