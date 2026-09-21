/**
 * 불만·분쟁 처리 기록 저장 모델 (Privacy-Complaint-Implementation-2, Step 2).
 *
 * 이 파일은 저장만 한다. 관리자 API·화면 연결, refund_requests 중복 판정,
 * 보존기간 정리(cleanup)는 이 단계에서 만들지 않는다.
 *
 * 저장 위치
 * - PostgreSQL 전용 complaint_records 테이블이다. app_store JSONB에 미러를 두지 않는다.
 *   조건부 UPDATE(CAS)로 "한 번만 처리 완료"를 보장해야 하기 때문이다.
 * - DATABASE_URL이 없는 환경에서는 저장할 수 없다(환불 문의·결제 기록과 같은 규칙).
 *
 * 무엇을 담지 않는가
 * - 이름·연락처·guest token·원본 문의 id·대화 본문·금액·PG 정보.
 *   입력 타입에 그 자리가 아예 없으므로 실수로도 들어올 수 없다.
 *   거래 사실은 orders·payments가, 환불 처리는 refund_requests가 따로 보유한다.
 *   여기에는 "어떤 성격의 불만이 언제 접수되어 어떻게 끝났는가"만 남는다.
 *
 * 왜 FK가 없는가
 * - 원본 문의·채팅은 운영 보존정책에 따라 먼저 사라진다. FK를 걸면 그 삭제가
 *   이 기록을 함께 지우거나 막는다. user_id·order_id는 참조일 뿐 제약이 아니다.
 *
 * 값 규칙과 상태 전이는 complaintRecordRules.ts가 정한다. 여기서 다시 정하지 않는다.
 */
import {
  normalizeComplaintSummary,
  requireComplaintCategory,
  requireComplaintSourceType,
  requireComplaintTransition,
} from "@/lib/server/complaintRecordRules";
import { nowId, sqlClient } from "@/lib/server/store";
import type {
  ComplaintCategory,
  ComplaintRecord,
  ComplaintSourceType,
  ComplaintStatus,
} from "@/lib/types/app";

/** DATABASE_URL이 없으면 조용히 파일 저장으로 넘어가지 않고 실패한다. */
function complaintClient() {
  const sql = sqlClient();
  if (!sql) {
    throw new Error("불만 기록은 DATABASE_URL이 설정된 환경에서만 저장할 수 있습니다.");
  }
  return sql;
}

/**
 * 테이블 준비.
 *
 * FK가 없으므로 다른 테이블을 먼저 만들 필요가 없다(store.ts의 ensureTable을 부르지 않는다).
 * 모두 IF NOT EXISTS라 여러 번 실행해도 결과가 같다.
 *
 * 컬럼은 열 개뿐이다. 값 검증(분류·요지·전이)은 서버 코드가 하고, 여기에는
 * 구조만 둔다. 상태는 open으로 시작하며 INSERT가 그 값을 직접 적는다.
 */
async function runComplaintRecordsMigration(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await sql.transaction((txn) => [
    txn.query(`
      CREATE TABLE IF NOT EXISTS complaint_records (
        id TEXT PRIMARY KEY,
        -- chat | inquiry | other. 원본 id는 남기지 않는다(원본이 먼저 만료된다).
        source_type TEXT NOT NULL,
        -- service | payment | consultation | delivery | privacy | other
        category TEXT NOT NULL,
        -- 상담원이 정리한 요지. 대화 전문을 옮기는 자리가 아니다.
        summary TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        -- open | handled. 되돌아가는 전이는 없다.
        status TEXT NOT NULL,
        -- 처리 완료 시각. 한 번 기록하면 덮어쓰지 않는다.
        handled_at TIMESTAMPTZ,
        -- 회원이 제기한 건일 때만. 이름·연락처 대신 쓰는 최소 식별자다.
        user_id TEXT,
        -- 특정 주문에 관한 건일 때만. 참조일 뿐이라 FK를 걸지 않는다.
        order_id TEXT,
        -- 처리한 관리자 표식. 고객 개인정보가 아니다.
        handled_by TEXT
      )
    `),
    txn.query(`
      CREATE INDEX IF NOT EXISTS complaint_records_status_created_idx
        ON complaint_records (status, created_at DESC)
    `),
  ]);
}

/**
 * 서버 인스턴스당 한 번만 실행하기 위한 기억. 실패하면 지워서 다음 요청이 다시 시도한다.
 * 기존 ensureRefundRequests·ensureTable과 같은 방식이다.
 */
let complaintRecordsMigration: Promise<void> | null = null;

export function ensureComplaintRecords(
  sql: NonNullable<ReturnType<typeof sqlClient>>,
): Promise<void> {
  if (!complaintRecordsMigration) {
    complaintRecordsMigration = runComplaintRecordsMigration(sql).catch((error) => {
      complaintRecordsMigration = null;
      throw error;
    });
  }
  return complaintRecordsMigration;
}

interface ComplaintRecordRow {
  id: string;
  source_type: string;
  category: string;
  summary: string;
  created_at: string | Date;
  status: string;
  handled_at: string | Date | null;
  user_id: string | null;
  order_id: string | null;
  handled_by: string | null;
}

const COMPLAINT_RECORD_COLUMNS = `id, source_type, category, summary, created_at, status,
  handled_at, user_id, order_id, handled_by`;

/** TIMESTAMPTZ 열을 ISO 문자열로. 값이 없으면 "기록 없음"이라는 뜻의 null을 유지한다. */
function toIsoOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toComplaintRecord(row: ComplaintRecordRow): ComplaintRecord {
  const createdAt =
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  return {
    id: row.id,
    // 저장은 createComplaintRecord만 하고 그 함수가 언제나 목록 안의 값을 넣는다.
    sourceType: row.source_type as ComplaintSourceType,
    category: row.category as ComplaintCategory,
    summary: row.summary,
    createdAt,
    status: row.status as ComplaintStatus,
    handledAt: toIsoOrNull(row.handled_at),
    userId: row.user_id,
    orderId: row.order_id,
    handledBy: row.handled_by,
  };
}

/** 빈 문자열과 "없음"을 섞지 않는다. 공백뿐인 참조는 없는 것으로 본다. */
function optionalRef(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text ? text : null;
}

/**
 * 승격 입력.
 *
 * 이름·연락처·guest token·원본 문의 id·대화 본문·금액·PG 정보를 받는 자리가 없다.
 * 받지 않으면 저장할 수도 없다.
 */
export interface CreateComplaintRecordInput {
  sourceType: unknown;
  category: unknown;
  summary: unknown;
  /** 회원이 제기한 건일 때만. 없으면 null로 남는다. */
  userId?: string | null;
  /** 특정 주문에 관한 건일 때만. 없으면 null로 남는다. */
  orderId?: string | null;
}

/**
 * 불만 기록을 남긴다.
 *
 * id·접수 시각·상태는 서버가 만든다. 호출부가 정하지 않는다.
 * 상태는 언제나 open으로 시작한다(문장 안에 직접 적는다).
 * 값이 규칙에 어긋나면 ComplaintRecordError를 던지고 아무것도 저장하지 않는다.
 */
export async function createComplaintRecord(
  input: CreateComplaintRecordInput,
): Promise<ComplaintRecord> {
  const sourceType = requireComplaintSourceType(input.sourceType);
  const category = requireComplaintCategory(input.category);
  const summary = normalizeComplaintSummary(input.summary);
  const userId = optionalRef(input.userId);
  const orderId = optionalRef(input.orderId);

  const sql = complaintClient();
  await ensureComplaintRecords(sql);

  const rows = (await sql.query(
    `
      INSERT INTO complaint_records
        (id, source_type, category, summary, created_at, status, user_id, order_id)
      VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)
      RETURNING ${COMPLAINT_RECORD_COLUMNS}
    `,
    [nowId(), sourceType, category, summary, new Date().toISOString(), userId, orderId],
  )) as ComplaintRecordRow[];

  return toComplaintRecord(rows[0]);
}

/** 관리자 목록. 최근 접수가 위로 온다. 권한 확인은 API에서 한다. */
export async function listComplaintRecordsForAdmin(): Promise<ComplaintRecord[]> {
  const sql = complaintClient();
  await ensureComplaintRecords(sql);
  const rows = (await sql.query(
    `SELECT ${COMPLAINT_RECORD_COLUMNS} FROM complaint_records ORDER BY created_at DESC`,
  )) as ComplaintRecordRow[];
  return rows.map(toComplaintRecord);
}

/**
 * 처리 완료 결과.
 *
 * 실패 사유를 문자열로 흘리지 않고 union으로 좁혀, 나중에 API·관리자 화면이
 * 안전하게 분기할 수 있게 한다.
 */
export type MarkComplaintHandledResult =
  | { ok: true; record: ComplaintRecord }
  | { ok: false; reason: "already-handled" }
  | { ok: false; reason: "not-found" };

/**
 * 처리 완료로 표시한다. open일 때만 바뀐다.
 *
 * 마지막 관문은 DB의 조건부 UPDATE(CAS)다. WHERE에 status = 'open'이 있어
 * 동시에 두 요청이 들어와도 한 번만 행을 바꾸고, 두 번째는 0행을 받는다.
 * 이미 처리된 기록이나 없는 id를 성공으로 돌려주지 않는다.
 *
 * handled_at·handled_by는 COALESCE로 감싼다. 어떤 이유로 값이 이미 있더라도
 * 덮어쓰지 않는다("한 번만 기록"하는 값이다).
 */
export async function markComplaintHandled(input: {
  complaintRecordId: string;
  /** 실행한 관리자. 처리 기록으로 남는다. */
  handledBy: string;
}): Promise<MarkComplaintHandledResult> {
  // 전이 규칙은 순수 모듈이 정한다. 여기서 다시 판단하지 않는다.
  const targetStatus = requireComplaintTransition("open", "handled");

  const handledBy = input.handledBy.trim();
  if (!handledBy) {
    // 누가 했는지 모르는 처리 기록을 남기지 않는다. 호출부가 관리자 식별자를 준다.
    throw new Error("불만 기록을 처리 완료하려면 실행한 관리자를 남겨야 합니다.");
  }

  const sql = complaintClient();
  await ensureComplaintRecords(sql);

  const rows = (await sql.query(
    `
      UPDATE complaint_records
      SET status = $2,
          handled_at = COALESCE(handled_at, $3::timestamptz),
          handled_by = COALESCE(handled_by, $4)
      WHERE id = $1 AND status = 'open'
      RETURNING ${COMPLAINT_RECORD_COLUMNS}
    `,
    [input.complaintRecordId, targetStatus, new Date().toISOString(), handledBy],
  )) as ComplaintRecordRow[];
  if (rows[0]) {
    return { ok: true, record: toComplaintRecord(rows[0]) };
  }

  // 0행인 이유를 가른다. 기록이 아예 없는지, 있는데 이미 처리된 것인지.
  const found = (await sql.query(`SELECT id FROM complaint_records WHERE id = $1`, [
    input.complaintRecordId,
  ])) as { id: string }[];
  return found[0] ? { ok: false, reason: "already-handled" } : { ok: false, reason: "not-found" };
}
