/**
 * 상담원 문의방과 그 안의 메시지를 다루는 데이터 계층.
 *
 * 방침
 * - 새 대화는 app_store JSONB가 아니라 chat_inquiries / chat_inquiry_messages 테이블에만 쌓는다.
 *   JSONB는 한 행을 통째로 덮어써서 고객과 상담원이 번갈아 쓰면 메시지가 사라질 수 있다.
 * - 조회는 언제나 "내 것"인지 함께 물어본다. 문의 id만으로 읽히는 함수는 만들지 않는다.
 * - DATABASE_URL이 없으면 조용히 파일 저장으로 넘어가지 않고 실패한다.
 *   새 대화가 잘못된 저장소에 적히는 편보다 분명히 실패하는 편이 낫다.
 * - 원문 guest token은 저장하지도, 로그에 남기지도 않는다. 해시만 다룬다.
 * - 권한 확인(관리자 로그인 여부)은 여기서 하지 않는다. API에서 한다.
 */
import { createHash, randomBytes } from "crypto";
import { ensureTable, nowId, normalizePhone, sqlClient } from "@/lib/server/store";

export type ChatInquiryStatus = "new" | "in_progress" | "closed";
export type ChatInquirySender = "customer" | "agent";

/** 챗봇에서 고를 수 있는 연락 방법. 저장 전에 이 값인지 확인한다. */
export const CHAT_CONTACT_METHODS = ["카카오톡", "문자"] as const;
export type ChatContactMethod = (typeof CHAT_CONTACT_METHODS)[number];

const CHAT_INQUIRY_STATUSES: ChatInquiryStatus[] = ["new", "in_progress", "closed"];

const NAME_MAX = 40;
const BODY_MAX = 1000;

/** 고객·관리자에게 돌려주는 문의방. guest_token_hash는 서버 안에서만 쓰고 담지 않는다. */
export interface ChatInquiry {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  contactMethod: string;
  status: ChatInquiryStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface ChatInquiryMessage {
  id: string;
  inquiryId: string;
  sender: ChatInquirySender;
  body: string;
  createdAt: string;
}

/** 문의방과 그 안의 메시지를 함께 돌려줄 때 쓴다. */
export interface ChatInquiryThread {
  inquiry: ChatInquiry;
  messages: ChatInquiryMessage[];
}

/** 값이 잘못되었을 때 던진다. API에서 400으로 바꿔 쓴다. */
export class ChatInquiryError extends Error {}

/**
 * 비회원이 자기 문의방을 다시 찾기 위한 토큰. 쿠키에 담을 원문은 호출부가 갖고,
 * 저장소에는 hashGuestToken()의 결과만 남는다.
 */
export function createGuestToken(): string {
  return randomBytes(32).toString("hex");
}

/** 같은 토큰이면 언제나 같은 값이 나온다. 되돌릴 수는 없다. */
export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isChatInquiryStatus(value: unknown): value is ChatInquiryStatus {
  return typeof value === "string" && CHAT_INQUIRY_STATUSES.includes(value as ChatInquiryStatus);
}

export function isChatContactMethod(value: unknown): value is ChatContactMethod {
  return (
    typeof value === "string" && CHAT_CONTACT_METHODS.includes(value as ChatContactMethod)
  );
}

/** 이름. 비어 있으면 거절하고, 지나치게 길면 자른다. */
export function normalizeName(value: unknown): string {
  const name = String(value ?? "").trim();
  if (!name) throw new ChatInquiryError("이름을 입력해 주세요.");
  return name.slice(0, NAME_MAX);
}

/** 연락 방법과 상관없이 휴대폰 번호만 받는다. 카카오톡 아이디는 받지 않는다. */
export function normalizeMobilePhone(value: unknown): string {
  const phone = normalizePhone(String(value ?? ""));
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    throw new ChatInquiryError("휴대폰 번호를 정확히 입력해 주세요.");
  }
  return phone;
}

/** 메시지 본문. 비어 있으면 거절하고, 지나치게 길면 자른다. */
export function normalizeBody(value: unknown): string {
  const body = String(value ?? "").trim();
  if (!body) throw new ChatInquiryError("내용을 입력해 주세요.");
  return body.slice(0, BODY_MAX);
}

function requireContactMethod(value: unknown): ChatContactMethod {
  if (!isChatContactMethod(value)) {
    throw new ChatInquiryError("연락받을 방법을 선택해 주세요.");
  }
  return value;
}

/**
 * 새 대화는 Postgres에만 쌓는다. DATABASE_URL이 없으면 실패한다.
 * 파일 저장으로 넘어가면 관리자와 고객이 서로 다른 저장소를 보게 된다.
 */
async function requireSql() {
  const sql = sqlClient();
  if (!sql) {
    throw new Error("상담원 문의는 데이터베이스가 있어야 이용할 수 있습니다.");
  }
  await ensureTable(sql);
  return sql;
}

interface InquiryRow {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
  contact_method: string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
  last_message_at: string | Date;
}

interface MessageRow {
  id: string;
  inquiry_id: string;
  sender: string;
  body: string;
  created_at: string | Date;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapInquiry(row: InquiryRow): ChatInquiry {
  return {
    id: row.id,
    ...(row.user_id ? { userId: row.user_id } : {}),
    name: row.name,
    phone: row.phone,
    contactMethod: row.contact_method,
    // 저장된 값이 예상 밖이면 화면이 깨지지 않게 new로 본다.
    status: isChatInquiryStatus(row.status) ? row.status : "new",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastMessageAt: toIso(row.last_message_at),
  };
}

function mapMessage(row: MessageRow): ChatInquiryMessage {
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    sender: row.sender === "agent" ? "agent" : "customer",
    body: row.body,
    createdAt: toIso(row.created_at),
  };
}

const INQUIRY_COLUMNS =
  "id, user_id, name, phone, contact_method, status, created_at, updated_at, last_message_at";

export interface CreateChatInquiryInput {
  /** 로그인 회원이면 채운다. 비회원이면 guestTokenHash를 준다. */
  userId?: string | null;
  guestTokenHash?: string | null;
  name: unknown;
  phone: unknown;
  contactMethod: unknown;
  firstMessage: unknown;
}

/**
 * 문의방을 만들고 첫 고객 메시지를 함께 남긴다.
 * 두 INSERT를 한 트랜잭션으로 보내 방만 남거나 메시지만 남는 일이 없게 한다.
 */
export async function createChatInquiry(
  input: CreateChatInquiryInput,
): Promise<ChatInquiryThread> {
  const userId = input.userId?.trim() || null;
  const guestTokenHash = input.guestTokenHash?.trim() || null;
  if (!userId && !guestTokenHash) {
    throw new ChatInquiryError("문의방을 만들 수 없습니다.");
  }

  const name = normalizeName(input.name);
  const phone = normalizeMobilePhone(input.phone);
  const contactMethod = requireContactMethod(input.contactMethod);
  const body = normalizeBody(input.firstMessage);

  const sql = await requireSql();
  const inquiryId = nowId();
  const messageId = nowId();

  const [inquiryRows, messageRows] = (await sql.transaction((txn) => [
    txn.query(
      `
        INSERT INTO chat_inquiries (id, user_id, guest_token_hash, name, phone, contact_method)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING ${INQUIRY_COLUMNS}
      `,
      [inquiryId, userId, guestTokenHash, name, phone, contactMethod],
    ),
    txn.query(
      `
        INSERT INTO chat_inquiry_messages (id, inquiry_id, sender, body)
        VALUES ($1, $2, 'customer', $3)
        RETURNING id, inquiry_id, sender, body, created_at
      `,
      [messageId, inquiryId, body],
    ),
  ])) as [InquiryRow[], MessageRow[]];

  return {
    inquiry: mapInquiry(inquiryRows[0]),
    messages: messageRows.map(mapMessage),
  };
}

/**
 * 고객 목록 한 벌. 주인 확인은 호출부가 주는 열(user_id 또는 guest_token_hash)로 한다.
 *
 * 방마다 마지막 말이 누구 것인지 함께 읽는다. 고객 화면이 "새 상담원 답변이 있는지"를
 * 이 한 값으로 판단하기 때문이다. 방식은 관리자 목록(listChatInquiriesForAdmin)과 같은
 * LATERAL이며, 같은 (inquiry_id, created_at) 인덱스를 그대로 쓴다. 질의 수는 늘지 않는다.
 *
 * 관리자와 달리 마지막 말의 본문(body)은 읽지 않는다. 고객 응답에 필요하지 않고,
 * 필요 없는 값을 담지 않는 것이 고객용 응답의 방침이다.
 */
async function listChatInquiriesBy(
  column: "user_id" | "guest_token_hash",
  value: string,
): Promise<ChatInquiryListItem[]> {
  if (!value) return [];
  const sql = await requireSql();
  const rows = (await sql.query(
    `
      SELECT
        i.id, i.user_id, i.name, i.phone, i.contact_method, i.status,
        i.created_at, i.updated_at, i.last_message_at,
        last_message.sender AS last_message_sender
      FROM chat_inquiries i
      LEFT JOIN LATERAL (
        SELECT m.sender
        FROM chat_inquiry_messages m
        WHERE m.inquiry_id = i.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message ON TRUE
      WHERE i.${column} = $1
      ORDER BY i.last_message_at DESC
    `,
    [value],
  )) as (InquiryRow & { last_message_sender: string | null })[];

  return rows.map((row) => ({
    ...mapInquiry(row),
    ...(row.last_message_sender === null
      ? {}
      : { lastMessageSender: row.last_message_sender === "agent" ? "agent" : "customer" }),
  }));
}

/** 회원이 가진 문의방. 최근 대화가 위로 온다. */
export async function listChatInquiriesByUserId(
  userId: string,
): Promise<ChatInquiryListItem[]> {
  return listChatInquiriesBy("user_id", userId);
}

/** 비회원이 가진 문의방. 토큰 해시가 맞아야만 보인다. */
export async function listChatInquiriesByGuestTokenHash(
  guestTokenHash: string,
): Promise<ChatInquiryListItem[]> {
  return listChatInquiriesBy("guest_token_hash", guestTokenHash);
}

async function loadMessages(
  sql: Awaited<ReturnType<typeof requireSql>>,
  inquiryId: string,
): Promise<ChatInquiryMessage[]> {
  const rows = (await sql.query(
    `
      SELECT id, inquiry_id, sender, body, created_at FROM chat_inquiry_messages
      WHERE inquiry_id = $1
      ORDER BY created_at ASC
    `,
    [inquiryId],
  )) as MessageRow[];
  return rows.map(mapMessage);
}

/**
 * 회원의 문의방 하나. id와 userId가 모두 맞아야 돌려준다.
 * 남의 방 id를 넣어도 null이 나온다.
 */
export async function getChatInquiryForUser(
  inquiryId: string,
  userId: string,
): Promise<ChatInquiryThread | null> {
  if (!inquiryId || !userId) return null;
  const sql = await requireSql();
  const rows = (await sql.query(
    `SELECT ${INQUIRY_COLUMNS} FROM chat_inquiries WHERE id = $1 AND user_id = $2`,
    [inquiryId, userId],
  )) as InquiryRow[];
  if (!rows[0]) return null;
  return { inquiry: mapInquiry(rows[0]), messages: await loadMessages(sql, inquiryId) };
}

/** 비회원의 문의방 하나. id와 토큰 해시가 모두 맞아야 돌려준다. */
export async function getChatInquiryForGuest(
  inquiryId: string,
  guestTokenHash: string,
): Promise<ChatInquiryThread | null> {
  if (!inquiryId || !guestTokenHash) return null;
  const sql = await requireSql();
  const rows = (await sql.query(
    `SELECT ${INQUIRY_COLUMNS} FROM chat_inquiries WHERE id = $1 AND guest_token_hash = $2`,
    [inquiryId, guestTokenHash],
  )) as InquiryRow[];
  if (!rows[0]) return null;
  return { inquiry: mapInquiry(rows[0]), messages: await loadMessages(sql, inquiryId) };
}

interface AddCustomerMessageInput {
  inquiryId: string;
  /** 둘 중 하나만 준다. 준 쪽이 방 주인인지 함께 확인한다. */
  userId?: string | null;
  guestTokenHash?: string | null;
  body: unknown;
}

/**
 * 고객이 자기 문의방에 메시지를 더한다.
 * 주인이 아니거나 방이 닫혀 있으면 null이다.
 *
 * 닫힌 방을 다시 여는 정책은 아직 정해지지 않아 지금은 거절한다.
 * 정책이 정해지면 아래 status 조건만 바꾸면 된다.
 */
export async function addCustomerMessage(
  input: AddCustomerMessageInput,
): Promise<ChatInquiryMessage | null> {
  const userId = input.userId?.trim() || null;
  const guestTokenHash = input.guestTokenHash?.trim() || null;
  if (!input.inquiryId || (!userId && !guestTokenHash)) return null;
  const body = normalizeBody(input.body);

  const sql = await requireSql();
  const owned = (await sql.query(
    `
      SELECT id FROM chat_inquiries
      WHERE id = $1
        AND status <> 'closed'
        AND ($2::text IS NULL OR user_id = $2)
        AND ($3::text IS NULL OR guest_token_hash = $3)
    `,
    [input.inquiryId, userId, guestTokenHash],
  )) as { id: string }[];
  if (!owned[0]) return null;

  return insertMessage(sql, input.inquiryId, "customer", body);
}

/** 관리자 목록 한 줄. 목록에서 바로 마지막 말을 보여 주기 위해 두 값을 함께 담는다. */
export interface ChatInquiryListItem extends ChatInquiry {
  lastMessageBody?: string;
  lastMessageSender?: ChatInquirySender;
}

/**
 * 관리자 목록. 최근 대화가 위로 온다. 권한 확인은 API에서 한다.
 *
 * 방마다 메시지를 따로 읽으면 방 수만큼 질의가 늘어난다(N+1).
 * LATERAL로 방마다 마지막 한 줄만 붙여 한 번의 질의로 끝낸다.
 * chat_inquiry_messages (inquiry_id, created_at) 인덱스를 그대로 쓴다.
 */
export async function listChatInquiriesForAdmin(): Promise<ChatInquiryListItem[]> {
  const sql = await requireSql();
  const rows = (await sql.query(
    `
      SELECT
        i.id, i.user_id, i.name, i.phone, i.contact_method, i.status,
        i.created_at, i.updated_at, i.last_message_at,
        last_message.body AS last_message_body,
        last_message.sender AS last_message_sender
      FROM chat_inquiries i
      LEFT JOIN LATERAL (
        SELECT m.body, m.sender
        FROM chat_inquiry_messages m
        WHERE m.inquiry_id = i.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message ON TRUE
      ORDER BY i.last_message_at DESC
    `,
  )) as (InquiryRow & { last_message_body: string | null; last_message_sender: string | null })[];

  return rows.map((row) => ({
    ...mapInquiry(row),
    ...(row.last_message_body === null ? {} : { lastMessageBody: row.last_message_body }),
    ...(row.last_message_sender === null
      ? {}
      : { lastMessageSender: row.last_message_sender === "agent" ? "agent" : "customer" }),
  }));
}

/** 관리자 상세. 전체 메시지를 시간순으로 함께 돌려준다. */
export async function getChatInquiryForAdmin(
  inquiryId: string,
): Promise<ChatInquiryThread | null> {
  if (!inquiryId) return null;
  const sql = await requireSql();
  const rows = (await sql.query(
    `SELECT ${INQUIRY_COLUMNS} FROM chat_inquiries WHERE id = $1`,
    [inquiryId],
  )) as InquiryRow[];
  if (!rows[0]) return null;
  return { inquiry: mapInquiry(rows[0]), messages: await loadMessages(sql, inquiryId) };
}

/**
 * 상담원 답변. 메시지를 남기고 방의 시각을 갱신한다.
 * 아직 손대지 않은 방(new)이면 진행 중으로 바꾼다.
 *
 * 끝난 방(closed)에는 남기지 않는다. 고객이 답할 수 없는 방에 상담원 말만 쌓여
 * 고객이 보지 못한 안내가 생기는 편보다, 다시 열고 나서 답하는 편이 낫다.
 * 고객 쪽 addCustomerMessage와 같은 기준이다.
 */
export async function addAgentMessage(
  inquiryId: string,
  body: unknown,
): Promise<ChatInquiryMessage | null> {
  if (!inquiryId) return null;
  const text = normalizeBody(body);

  const sql = await requireSql();
  const rows = (await sql.query(
    `SELECT id FROM chat_inquiries WHERE id = $1 AND status <> 'closed'`,
    [inquiryId],
  )) as {
    id: string;
  }[];
  if (!rows[0]) return null;

  const message = await insertMessage(sql, inquiryId, "agent", text);
  await sql.query(
    `UPDATE chat_inquiries SET status = 'in_progress' WHERE id = $1 AND status = 'new'`,
    [inquiryId],
  );
  return message;
}

/** 상담 상태 변경. 허용된 값만 받는다. */
export async function updateChatInquiryStatus(
  inquiryId: string,
  status: unknown,
): Promise<ChatInquiry | null> {
  if (!inquiryId) return null;
  if (!isChatInquiryStatus(status)) {
    throw new ChatInquiryError("상담 상태 값이 올바르지 않습니다.");
  }
  const sql = await requireSql();
  const rows = (await sql.query(
    `
      UPDATE chat_inquiries
      SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING ${INQUIRY_COLUMNS}
    `,
    [inquiryId, status],
  )) as InquiryRow[];
  return rows[0] ? mapInquiry(rows[0]) : null;
}

/**
 * 메시지 저장과 방 시각 갱신을 한 트랜잭션으로 보낸다.
 * 메시지만 남고 목록의 마지막 시각이 옛날로 남는 일이 없게 한다.
 */
async function insertMessage(
  sql: Awaited<ReturnType<typeof requireSql>>,
  inquiryId: string,
  sender: ChatInquirySender,
  body: string,
): Promise<ChatInquiryMessage> {
  const messageId = nowId();
  const [messageRows] = (await sql.transaction((txn) => [
    txn.query(
      `
        INSERT INTO chat_inquiry_messages (id, inquiry_id, sender, body)
        VALUES ($1, $2, $3, $4)
        RETURNING id, inquiry_id, sender, body, created_at
      `,
      [messageId, inquiryId, sender, body],
    ),
    txn.query(
      `UPDATE chat_inquiries SET updated_at = now(), last_message_at = now() WHERE id = $1`,
      [inquiryId],
    ),
  ])) as [MessageRow[], unknown];
  return mapMessage(messageRows[0]);
}

/**
 * 아직 끝나지 않은 문의방 하나를 찾는다.
 * 같은 사람이 다시 문의할 때 방을 새로 만들지 않고 이어 쓰기 위한 것이다.
 *
 * new/in_progress만 본다. closed는 끝난 대화이므로 찾지 않는다.
 * 어쩌다 진행 중 방이 둘 이상 생겼더라도 가장 최근에 말한 방 하나만 돌려준다.
 * 주인 확인은 호출부가 주는 열(user_id 또는 guest_token_hash)로 함께 한다.
 */
async function findOpenChatInquiryBy(
  column: "user_id" | "guest_token_hash",
  value: string,
): Promise<ChatInquiry | null> {
  if (!value) return null;
  const sql = await requireSql();
  const rows = (await sql.query(
    `
      SELECT ${INQUIRY_COLUMNS} FROM chat_inquiries
      WHERE ${column} = $1
        AND status IN ('new', 'in_progress')
      ORDER BY last_message_at DESC
      LIMIT 1
    `,
    [value],
  )) as InquiryRow[];
  return rows[0] ? mapInquiry(rows[0]) : null;
}

/** 회원의 진행 중 문의방. 없으면 null이다. */
export async function findOpenChatInquiryByUserId(userId: string): Promise<ChatInquiry | null> {
  return findOpenChatInquiryBy("user_id", userId);
}

/** 비회원의 진행 중 문의방. 토큰 해시가 맞아야만 찾힌다. */
export async function findOpenChatInquiryByGuestTokenHash(
  guestTokenHash: string,
): Promise<ChatInquiry | null> {
  return findOpenChatInquiryBy("guest_token_hash", guestTokenHash);
}

/**
 * 탈퇴한 회원의 문의방에서 직접 개인정보(이름·연락처)만 익명화한다.
 *
 * 행을 지우지 않는다. 상담 이력·상태·날짜는 운영 기록이라 그대로 둔다.
 * chat_inquiry_messages는 건드리지 않는다. 상담 내용 자체이기 때문이다.
 * user_id도 남긴다. 주문·결제와 같은 방침이다.
 *
 * 대상은 user_id가 일치하는 행뿐이다. user_id가 없는 비회원 문의는 매칭되지 않는다.
 * 대체할 이름은 인자로 받는다. withdrawAccount.ts를 import하면 순환 의존이 되기 때문이다
 * (호출부: src/app/api/app/route.ts의 withdrawAccount 액션).
 * DATABASE_URL이 없는 환경에는 이 테이블 자체가 없으므로 아무것도 하지 않는다.
 */
export async function scrubChatInquiriesByUser(
  userId: string,
  withdrawnName: string,
): Promise<void> {
  if (!userId) return;
  const sql = sqlClient();
  if (!sql) return;
  await ensureTable(sql);
  await sql.query(
    `
      UPDATE chat_inquiries
      SET name = $2, phone = '', updated_at = now()
      WHERE user_id = $1
    `,
    [userId, withdrawnName],
  );
}
