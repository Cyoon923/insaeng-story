import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { neon } from "@neondatabase/serverless";
import type {
  AppData,
  Coupon,
  Order,
  OrderStatus,
  Payment,
  PaymentStatus,
  User,
} from "@/lib/types/app";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "app-data.json");

const EMPTY: AppData = {
  users: [],
  orders: [],
  consultations: [],
  inquiries: [],
  reviews: [],
  wishlists: {},
  coupons: {},
  notifications: {},
  notificationSettings: {},
  codes: {},
  blockedSlots: [],
  adminPromo: null,
};

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

function canUseDatabase() {
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return Boolean(databaseUrl());
}

export function sqlClient() {
  if (!canUseDatabase()) return null;
  return neon(databaseUrl());
}

/**
 * 필요한 테이블을 보장한다. 모두 IF NOT EXISTS라 여러 번 실행해도 안전하다.
 * orders는 주문 읽기·쓰기에 쓰이고, payments는 결제 준비·승인 기록에 쓴다.
 * 그 밖의 데이터는 그대로 app_store JSONB에 저장된다.
 * 여기에는 잠금이 가벼운 CREATE 문만 둔다. ALTER는 runPaymentsMigration으로 분리했다.
 * DDL을 한 트랜잭션으로 묶어 기존과 같은 왕복 1회를 유지한다.
 * 실제 호출은 ensureTable()이 감싸서 서버 인스턴스당 한 번만 실행한다.
 */
async function createTables(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await sql.transaction((txn) => [
    txn.query(`
      CREATE TABLE IF NOT EXISTS app_store (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL,
        -- 저장할 때마다 1씩 오른다. 읽은 시점의 값과 다르면 그사이 다른 요청이 저장한 것이다.
        version BIGINT NOT NULL DEFAULT 0
      )
    `),
    txn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        amount INTEGER NOT NULL,
        base_amount INTEGER,
        payment TEXT NOT NULL DEFAULT '',
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `),
    txn.query(`
      CREATE INDEX IF NOT EXISTS orders_user_created_idx
        ON orders (user_id, created_at DESC)
    `),
    txn.query(`
      CREATE INDEX IF NOT EXISTS orders_created_idx
        ON orders (created_at DESC)
    `),
    txn.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        -- 결제 준비 시점에는 아직 주문이 없으므로 비워 둔다. 승인 성공 후 채운다.
        order_id TEXT REFERENCES orders(id),
        provider TEXT NOT NULL,
        merchant_order_id TEXT NOT NULL,
        pg_tid TEXT,
        requested_amount INTEGER NOT NULL,
        approved_amount INTEGER,
        cancelled_amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        method TEXT,
        approved_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        -- 승인 성공 후 주문·상담을 만들기 위한 신청 정보 사본.
        order_snapshot JSONB,
        -- PG 응답 원문. order_snapshot과 용도를 섞지 않는다.
        raw JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `),
    txn.query(`
      CREATE INDEX IF NOT EXISTS payments_order_created_idx
        ON payments (order_id, created_at DESC)
    `),
    // 상담원 문의방과 그 안의 메시지. 고객과 상담원이 여러 번 주고받는 대화라
    // app_store JSONB가 아니라 행 단위로 쌓는다. 아직 읽기·쓰기 코드는 없다.
    txn.query(`
      CREATE TABLE IF NOT EXISTS chat_inquiries (
        id TEXT PRIMARY KEY,
        -- 회원 문의에만 채운다. 비회원은 guest_token_hash로 자기 방을 다시 찾는다.
        user_id TEXT,
        -- 원문 토큰은 저장하지 않는다. 해시만 둔다.
        guest_token_hash TEXT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        contact_method TEXT NOT NULL,
        -- new | in_progress | closed. 값 검증은 서버 데이터 계층에서 한다.
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `),
    txn.query(`
      CREATE INDEX IF NOT EXISTS chat_inquiries_status_last_message_idx
        ON chat_inquiries (status, last_message_at DESC)
    `),
    txn.query(`
      CREATE INDEX IF NOT EXISTS chat_inquiries_user_last_message_idx
        ON chat_inquiries (user_id, last_message_at DESC)
    `),
    txn.query(`
      CREATE INDEX IF NOT EXISTS chat_inquiries_guest_token_idx
        ON chat_inquiries (guest_token_hash)
    `),
    txn.query(`
      CREATE TABLE IF NOT EXISTS chat_inquiry_messages (
        id TEXT PRIMARY KEY,
        inquiry_id TEXT NOT NULL REFERENCES chat_inquiries(id) ON DELETE CASCADE,
        -- customer | agent. 값 검증은 서버 데이터 계층에서 한다.
        sender TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `),
    txn.query(`
      CREATE INDEX IF NOT EXISTS chat_inquiry_messages_inquiry_created_idx
        ON chat_inquiry_messages (inquiry_id, created_at)
    `),
    // 인증번호·단기 토큰을 담을 자리. 지금은 만들어 두기만 하고 읽기·쓰기 코드는 없다.
    // 인증은 그대로 app_store JSONB의 codes를 쓴다. 다음 단계에서 이 테이블로 옮긴다.
    // storage_key는 지금 codes의 키를 그대로 쓴다("<휴대폰>", "signup:", "reset:",
    // "link:", "sociallink:", "withdraw:"). 키를 쪼개면 뜻이 달라져 원형을 유지한다.
    txn.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        storage_key TEXT PRIMARY KEY,
        -- 6자리 인증번호, 단기 토큰, 대기 상태 JSON이 모두 이 한 칸에 들어간다.
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        -- 검증 실패 횟수. 발급 코드에만 의미가 있고 토큰에는 0으로 남는다.
        attempts INTEGER NOT NULL DEFAULT 0,
        -- 재발송 쿨다운 계산에만 쓴다. 토큰에는 값이 없다.
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `),
  ]);
}

/**
 * 서버 인스턴스당 한 번만 실행하기 위한 기억. 실패하면 지워서 다음 요청이 다시 시도한다.
 * 기존 ensurePaymentsMigration과 같은 방식이다.
 */
let tableMigration: Promise<void> | null = null;

/**
 * 테이블·인덱스 준비. 호출부는 그대로 두고, 실제 DDL은 인스턴스당 한 번만 보낸다.
 * 매 요청마다 CREATE 문을 반복해 보내지 않게 하려는 것이고, 만드는 대상은 그대로다.
 */
export function ensureTable(sql: NonNullable<ReturnType<typeof sqlClient>>): Promise<void> {
  if (!tableMigration) {
    tableMigration = createTables(sql).catch((error) => {
      // 한 번 실패했다고 인스턴스가 영구히 막히지 않도록 기억을 지운다.
      tableMigration = null;
      throw error;
    });
  }
  return tableMigration;
}

/**
 * 예전에 만들어진 payments 테이블을 지금 모양으로 맞춘다.
 * ALTER TABLE은 바꿀 것이 없어도 테이블 잠금을 잡기 때문에
 * 모든 요청이 지나가는 ensureTable에 두지 않고 여기로 분리했다.
 * 결제 함수에서만, 서버 인스턴스당 한 번만 실행한다.
 * 세 문장 모두 여러 번 실행해도 안전하다.
 */
async function runPaymentsMigration(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await sql.transaction((txn) => [
    // 이미 nullable이면 아무 일도 일어나지 않는다.
    txn.query(`ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL`),
    txn.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_snapshot JSONB`),
    // 같은 결제 준비 건이 두 번 만들어지지 않도록 우리 쪽에서 막는다.
    txn.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payments_merchant_order_id_key
        ON payments (merchant_order_id)
    `),
  ]);
}

/** 서버 인스턴스당 한 번만 실행하기 위한 기억. 실패하면 지워서 다음에 다시 시도한다. */
let paymentsMigration: Promise<void> | null = null;

function ensurePaymentsMigration(sql: NonNullable<ReturnType<typeof sqlClient>>): Promise<void> {
  if (!paymentsMigration) {
    paymentsMigration = runPaymentsMigration(sql).catch((error) => {
      paymentsMigration = null;
      throw error;
    });
  }
  return paymentsMigration;
}

/**
 * 예전에 만들어진 app_store에 version 열을 더한다.
 * 기존 행은 DEFAULT 0으로 채워진다. 데이터를 지우거나 다시 쓰지 않는다.
 * ALTER는 바꿀 것이 없어도 잠금을 잡으므로 ensureTable이 아니라 여기에 두고
 * 서버 인스턴스당 한 번만 실행한다. 여러 번 실행해도 안전하다.
 */
async function runAppStoreVersionMigration(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await sql.query(
    `ALTER TABLE app_store ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0`,
  );
}

let appStoreVersionMigration: Promise<void> | null = null;

function ensureAppStoreVersion(sql: NonNullable<ReturnType<typeof sqlClient>>): Promise<void> {
  if (!appStoreVersionMigration) {
    appStoreVersionMigration = runAppStoreVersionMigration(sql).catch((error) => {
      appStoreVersionMigration = null;
      throw error;
    });
  }
  return appStoreVersionMigration;
}

/**
 * 저장이 다른 요청과 겹쳐 반영되지 않았다는 신호.
 * 이 오류가 나면 app_store와 함께 묶인 orders·payments 변경도 하나도 일어나지 않았다.
 * 호출부는 이 오류만 따로 잡아 409로 돌려준다.
 */
export class AppStoreConflictError extends Error {
  constructor() {
    super("APP_STORE_CONFLICT");
    this.name = "AppStoreConflictError";
  }
}

export function isAppStoreConflict(error: unknown): boolean {
  return error instanceof AppStoreConflictError;
}

/**
 * 읽은 시점의 version을 그 읽기가 돌려준 객체에 매달아 둔다.
 *
 * AppData 안에 넣으면 JSON에 섞여 저장되고 화면 응답에도 흘러갈 수 있어 밖에 둔다.
 * 모듈 전역 변수 하나에 담으면 동시에 들어온 요청끼리 값이 섞이므로,
 * 읽기마다 다른 객체를 키로 쓰는 WeakMap에 담는다. 객체가 사라지면 함께 사라진다.
 */
const readVersions = new WeakMap<AppData, number>();

function rememberVersion(data: AppData, version: number): AppData {
  readVersions.set(data, version);
  return data;
}

/**
 * 이 데이터가 어떤 version을 보고 만들어졌는지. 모르면 저장하지 않는다.
 * (readData를 거치지 않은 객체로 저장하면 남의 변경을 덮어쓸 수 있다)
 */
function expectedVersionOf(data: AppData): number {
  const version = readVersions.get(data);
  if (version === undefined) throw new AppStoreConflictError();
  return version;
}

/** 저장에 성공하면 그 객체의 기준 version을 올려 둔다. 같은 요청이 이어서 저장할 수 있다. */
function advanceVersion(data: AppData, version: number): void {
  readVersions.set(data, version);
}

function mergeData(value: unknown): AppData {
  if (!value || typeof value !== "object") return structuredClone(EMPTY);
  return { ...EMPTY, ...(value as AppData) };
}

/**
 * 저장된 내용을 그대로 읽는다. 읽기만 하고 아무것도 쓰지 않는다.
 *
 * 예전에는 여기서 testResetAt이 비어 있으면 회원·주문·상담·문의·후기·쿠폰을 비우고
 * 다시 저장하는 일회성 정리(clearTestDataOnce)가 함께 돌았다.
 * 2026-08-16 배포 때 테스트 데이터를 한 번 지우려고 넣은 코드이고 그 목적은 이미 끝났다.
 * 남겨 두면 testResetAt이 없는 저장소(새 DB, 예전 스냅샷 복원 등)를 처음 읽는 순간
 * 운영 데이터가 통째로 지워지므로 호출과 함수를 함께 걷어냈다.
 * testResetAt 필드 자체는 이미 저장된 JSON과의 호환을 위해 그대로 둔다.
 */
export async function readData(): Promise<AppData> {
  const sql = sqlClient();
  if (sql) {
    await ensureTable(sql);
    await ensureAppStoreVersion(sql);
    const rows = (await sql.query("SELECT data, version FROM app_store WHERE id = 1")) as {
      data: unknown;
      version: string | number;
    }[];
    // 행이 아직 없으면 "아무도 저장한 적 없음"을 -1로 표시한다.
    // 저장할 때 이 값이면 INSERT로 처음 만들고, 그사이 누가 만들었으면 충돌이 된다.
    if (!rows[0]) return rememberVersion(structuredClone(EMPTY), NO_ROW_VERSION);
    return rememberVersion(mergeData(rows[0].data), Number(rows[0].version));
  }

  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return mergeData(JSON.parse(raw));
  } catch {
    return structuredClone(EMPTY);
  }
}

/** app_store 행이 아직 없을 때 쓰는 기준값. 실제 version은 0부터 시작한다. */
const NO_ROW_VERSION = -1;

/**
 * version을 확인하며 저장한다. 조건이 맞을 때만 새 version을 돌려준다.
 * 돌려줄 행이 없으면(0행) 그사이 다른 요청이 저장한 것이므로 충돌이다.
 *
 * 뒤따르는 orders·payments 문장은 이 CTE가 행을 돌려줬을 때만 실행되도록
 * WHERE EXISTS (SELECT 1 FROM cas)로 묶는다. 한 문장 안에서 함께 실행되므로
 * "app_store는 안 바뀌었는데 주문만 들어가는" 중간 상태가 생기지 않는다.
 */
const CAS_UPDATE_CTE = `
  WITH cas AS (
    UPDATE app_store
    SET data = $1::jsonb, version = version + 1
    WHERE id = 1 AND version = $2
    RETURNING version
  )
`;

/** 행이 아직 없을 때. 같은 순간 둘이 만들면 하나만 성공한다. */
const CAS_INSERT_CTE = `
  WITH cas AS (
    INSERT INTO app_store (id, data, version)
    VALUES (1, $1::jsonb, 0)
    ON CONFLICT (id) DO NOTHING
    RETURNING version
  )
`;

function casHead(expectedVersion: number): string {
  return expectedVersion === NO_ROW_VERSION ? CAS_INSERT_CTE : CAS_UPDATE_CTE;
}

/** CAS 문장에 넘길 인자. INSERT 경로는 version 조건이 없어 data만 쓴다. */
function casParams(data: AppData, expectedVersion: number): unknown[] {
  return expectedVersion === NO_ROW_VERSION
    ? [JSON.stringify(data)]
    : [JSON.stringify(data), expectedVersion];
}

/** CAS 문장 뒤에 오는 값 인자의 시작 번호($1, $2를 이미 쓴 만큼 밀린다). */
function casParamCount(expectedVersion: number): number {
  return expectedVersion === NO_ROW_VERSION ? 1 : 2;
}

/** 저장 결과. 행이 없으면 충돌로 본다. */
function commitVersion(data: AppData, rows: { version: string | number }[]): void {
  if (!rows[0]) throw new AppStoreConflictError();
  advanceVersion(data, Number(rows[0].version));
}


export async function writeData(data: AppData): Promise<void> {
  const sql = sqlClient();
  if (sql) {
    await ensureTable(sql);
    await ensureAppStoreVersion(sql);
    const expected = expectedVersionOf(data);
    const rows = (await sql.query(
      `${casHead(expected)} SELECT version FROM cas`,
      casParams(data, expected),
    )) as { version: string | number }[];
    commitVersion(data, rows);
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * 함께 소비할 인증 1건. code가 null이면 키가 있고 만료되지 않았는지만 본다.
 * 토큰 자체가 비밀인 경우(소셜 연결 대기)는 키 소유가 곧 인증이라 code를 보지 않는다.
 */
export interface VerificationConsume {
  storageKey: string;
  code: string | null;
}

/**
 * 저장 결과. version 충돌은 예전처럼 AppStoreConflictError로 던지고,
 * 인증 값이 맞지 않는 경우만 값으로 돌려준다.
 * 둘을 섞으면 400이어야 할 응답이 409가 되어 뜻이 달라진다.
 */
export type VerificationConsumeResult = { ok: true } | { ok: false; reason: "code" };

/** VALUES 목록. 인자 형이 정해지지 않아 그냥 두면 안 되므로 text로 박아 둔다. */
function consumeValues(consumes: VerificationConsume[], start: number): string {
  return consumes
    .map((_, index) => `($${start + index * 2}::text, $${start + index * 2 + 1}::text)`)
    .join(", ");
}

/**
 * 넘긴 인증이 모두 살아 있는지 세는 조건식. 이 값이 건수와 같을 때만 저장한다.
 * 만료된 값은 세지 않으므로 지나간 코드로는 통과할 수 없다.
 */
function consumeMatchCount(consumes: VerificationConsume[], start: number): string {
  return `
    SELECT count(*) FROM verification_codes v
    JOIN (VALUES ${consumeValues(consumes, start)}) AS w(k, c) ON v.storage_key = w.k
    WHERE (w.c IS NULL OR v.code = w.c) AND v.expires_at > now()
  `;
}

/**
 * app_store 저장과 인증 소비를 한 문장으로 묶는다.
 *
 * 예전에는 인증번호가 app_store JSONB 안에 있어서 CAS 하나로 원자성이 따라왔다.
 * 테이블을 나눈 뒤에도 같은 보장을 유지하려고 양쪽을 서로의 조건으로 건다.
 *
 * - 인증이 하나라도 맞지 않으면 CAS의 WHERE가 거짓이 되어 app_store도 바뀌지 않는다.
 * - CAS가 0행이면 DELETE의 EXISTS가 거짓이 되어 인증도 지워지지 않는다.
 * - 여러 건이면 count가 건수와 같을 때만 통과하므로 하나만 지워지는 일이 없다.
 *
 * 넘긴 data 안에서 이미 지운 app_store.codes 값(전환 이전 인증)은 같은 JSONB에 들어 있어
 * 이 문장 하나로 함께 확정된다. 따로 묶을 것이 없다.
 */
export async function writeDataWithVerificationConsumes(
  data: AppData,
  consumes: VerificationConsume[],
): Promise<VerificationConsumeResult> {
  const sql = sqlClient();
  // 소비할 것이 없거나 파일 모드면 예전 저장 그대로다.
  if (!sql || consumes.length === 0) {
    await writeData(data);
    return { ok: true };
  }

  await ensureTable(sql);
  await ensureAppStoreVersion(sql);
  const expected = expectedVersionOf(data);
  const n = casParamCount(expected);
  const first = n + 1;
  const countParam = n + consumes.length * 2 + 1;
  const match = consumeMatchCount(consumes, first);

  // 행이 아직 없는 경우에도 인증 선조건을 걸어야 해서 casHead를 그대로 쓰지 못한다.
  const head =
    expected === NO_ROW_VERSION
      ? `
        WITH cas AS (
          INSERT INTO app_store (id, data, version)
          SELECT 1, $1::jsonb, 0
          WHERE (${match}) = $${countParam}
          ON CONFLICT (id) DO NOTHING
          RETURNING version
        )
      `
      : `
        WITH cas AS (
          UPDATE app_store
          SET data = $1::jsonb, version = version + 1
          WHERE id = 1 AND version = $2 AND (${match}) = $${countParam}
          RETURNING version
        )
      `;

  const rows = (await sql.query(
    `
      ${head},
      consumed AS (
        DELETE FROM verification_codes v
        USING (VALUES ${consumeValues(consumes, first)}) AS w(k, c)
        WHERE v.storage_key = w.k
          AND (w.c IS NULL OR v.code = w.c)
          AND v.expires_at > now()
          AND EXISTS (SELECT 1 FROM cas)
        RETURNING v.storage_key
      )
      SELECT
        (SELECT version FROM cas) AS version,
        (SELECT count(*) FROM consumed) AS consumed,
        (${match}) AS matched
    `,
    [
      ...casParams(data, expected),
      ...consumes.flatMap((item) => [item.storageKey, item.code]),
      consumes.length,
    ],
  )) as { version: string | number | null; matched: string | number }[];

  const row = rows[0];
  if (row && row.version !== null && row.version !== undefined) {
    advanceVersion(data, Number(row.version));
    return { ok: true };
  }
  // 저장되지 않은 이유를 가른다. 인증이 모자랐으면 인증 실패,
  // 인증은 멀쩡한데 저장이 안 됐으면 다른 요청과 겹친 것이다.
  if (Number(row?.matched ?? 0) < consumes.length) return { ok: false, reason: "code" };
  throw new AppStoreConflictError();
}

/**
 * 주문 저장. JSONB 전체와 orders 테이블에 같은 주문을 한 트랜잭션으로 남긴다.
 * 아직 읽기는 JSONB만 쓰므로, 테이블 쪽은 이후 전환을 위한 이중 기록이다.
 * DATABASE_URL이 없으면 기존 파일 저장으로 그대로 위임한다.
 */
export async function writeDataWithOrder(data: AppData, order: Order): Promise<void> {
  const sql = sqlClient();
  if (!sql) return writeData(data);

  // DDL은 문장 밖에서 먼저 보장한다.
  await ensureTable(sql);
  await ensureAppStoreVersion(sql);
  const expected = expectedVersionOf(data);
  const n = casParamCount(expected);

  // CAS가 행을 돌려줬을 때만 주문이 들어간다. 한 문장이라 중간 상태가 없다.
  const rows = (await sql.query(
    `
      ${casHead(expected)},
      saved AS (
        INSERT INTO orders (
          id, user_id, product, title, status,
          amount, base_amount, payment, details, created_at, updated_at
        )
        SELECT $${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5},
               $${n + 6}, $${n + 7}, $${n + 8}, $${n + 9}::jsonb,
               $${n + 10}::timestamptz, $${n + 10}::timestamptz
        WHERE EXISTS (SELECT 1 FROM cas)
        ON CONFLICT (id) DO NOTHING
      )
      SELECT version FROM cas
    `,
    [
      ...casParams(data, expected),
      order.id,
      order.userId,
      order.product,
      order.title,
      order.status,
      order.amount,
      order.baseAmount ?? null,
      order.payment,
      JSON.stringify(order.details ?? {}),
      order.createdAt,
    ],
  )) as { version: string | number }[];
  commitVersion(data, rows);
}

interface OrderRow {
  id: string;
  user_id: string;
  product: string;
  title: string;
  status: string;
  amount: number;
  base_amount: number | null;
  payment: string;
  details: unknown;
  created_at: string | Date;
}

/** orders 테이블 행을 기존 Order 형태로 되돌린다. */
function toOrder(row: OrderRow): Order {
  const details = (row.details ?? {}) as Record<string, string>;
  const createdAt =
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  return {
    id: row.id,
    userId: row.user_id,
    product: row.product as Order["product"],
    title: row.title,
    status: row.status as OrderStatus,
    amount: Number(row.amount),
    // 컬럼이 NULL이면 값이 없는 것으로 둔다. 예전 주문에는 정가 정보가 없다.
    ...(row.base_amount === null ? {} : { baseAmount: Number(row.base_amount) }),
    payment: row.payment,
    details,
    createdAt,
  };
}

const ORDER_COLUMNS = `id, user_id, product, title, status,
  amount, base_amount, payment, details, created_at`;

/** 목록 정렬은 기존 unshift 순서(최신 먼저)를 그대로 재현한다. */
const ORDER_SORT = "ORDER BY created_at DESC, id DESC";

/** 한 회원의 주문 목록. 상담 주문도 포함하며 화면에서 걸러 쓴다. */
export async function listOrdersByUser(userId: string): Promise<Order[]> {
  const sql = sqlClient();
  if (!sql) {
    const data = await readData();
    return data.orders.filter((item) => item.userId === userId);
  }
  await ensureTable(sql);
  const rows = (await sql.query(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE user_id = $1 ${ORDER_SORT}`,
    [userId],
  )) as OrderRow[];
  return rows.map(toOrder);
}

/** 관리자용 전체 주문 목록. */
export async function listAllOrders(): Promise<Order[]> {
  const sql = sqlClient();
  if (!sql) {
    const data = await readData();
    return data.orders;
  }
  await ensureTable(sql);
  const rows = (await sql.query(
    `SELECT ${ORDER_COLUMNS} FROM orders ${ORDER_SORT}`,
  )) as OrderRow[];
  return rows.map(toOrder);
}

/** 주문 1건. 소유자 확인은 호출한 쪽에서 한다. */
export async function getOrderById(id: string): Promise<Order | null> {
  const sql = sqlClient();
  if (!sql) {
    const data = await readData();
    return data.orders.find((item) => item.id === id) ?? null;
  }
  await ensureTable(sql);
  const rows = (await sql.query(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1`,
    [id],
  )) as OrderRow[];
  return rows[0] ? toOrder(rows[0]) : null;
}

/**
 * 주문 진행 상태 변경. JSONB와 orders 테이블이 어긋나지 않도록 함께 갱신한다.
 */
export async function writeDataWithOrderStatus(
  data: AppData,
  id: string,
  status: OrderStatus,
): Promise<void> {
  const sql = sqlClient();
  if (!sql) return writeData(data);

  await ensureTable(sql);
  await ensureAppStoreVersion(sql);
  const expected = expectedVersionOf(data);
  const n = casParamCount(expected);

  const rows = (await sql.query(
    `
      ${casHead(expected)},
      touched AS (
        UPDATE orders
        SET status = $${n + 2}, updated_at = now()
        WHERE id = $${n + 1} AND EXISTS (SELECT 1 FROM cas)
      )
      SELECT version FROM cas
    `,
    [...casParams(data, expected), id, status],
  )) as { version: string | number }[];
  commitVersion(data, rows);
}

/* ------------------------------------------------------------------ *
 * 결제(payments)
 *
 * 주문이 만들어지기 전 단계부터 기록하므로 order_id는 비워 둔 채로 시작한다.
 * 결제 기록은 JSONB로 대체할 수 없어 DATABASE_URL이 반드시 필요하다.
 * ------------------------------------------------------------------ */

interface PaymentRow {
  id: string;
  order_id: string | null;
  provider: string;
  merchant_order_id: string;
  pg_tid: string | null;
  requested_amount: number;
  approved_amount: number | null;
  cancelled_amount: number;
  status: string;
  method: string | null;
  approved_at: string | Date | null;
  cancelled_at: string | Date | null;
  order_snapshot: unknown;
  raw: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

const PAYMENT_COLUMNS = `id, order_id, provider, merchant_order_id, pg_tid,
  requested_amount, approved_amount, cancelled_amount, status, method,
  approved_at, cancelled_at, order_snapshot, raw, created_at, updated_at`;

function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.order_id,
    provider: row.provider,
    merchantOrderId: row.merchant_order_id,
    pgTid: row.pg_tid,
    requestedAmount: Number(row.requested_amount),
    approvedAmount: row.approved_amount === null ? null : Number(row.approved_amount),
    cancelledAmount: Number(row.cancelled_amount),
    status: row.status as PaymentStatus,
    method: row.method,
    approvedAt: toIso(row.approved_at),
    cancelledAt: toIso(row.cancelled_at),
    orderSnapshot: toJsonObject(row.order_snapshot),
    raw: toJsonObject(row.raw),
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
  };
}

/** 결제 기록은 파일 저장소로 대체할 수 없다. DB가 없으면 조용히 넘기지 않고 알린다. */
function paymentsClient() {
  const sql = sqlClient();
  if (!sql) {
    throw new Error("결제 정보는 DATABASE_URL이 설정된 환경에서만 저장할 수 있습니다.");
  }
  return sql;
}

/**
 * 결제 준비 기록. 주문이 아직 없으므로 order_id는 비워 둔다.
 * merchant_order_id가 이미 있으면 만들지 않고 null을 돌려준다.
 */
export async function createPayment(input: {
  provider: string;
  merchantOrderId: string;
  requestedAmount: number;
  status: PaymentStatus;
  method?: string | null;
  orderSnapshot?: Record<string, unknown> | null;
}): Promise<Payment | null> {
  const sql = paymentsClient();
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  const rows = (await sql.query(
    `
      INSERT INTO payments (
        id, provider, merchant_order_id, requested_amount, status, method, order_snapshot
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (merchant_order_id) DO NOTHING
      RETURNING ${PAYMENT_COLUMNS}
    `,
    [
      nowId(),
      input.provider,
      input.merchantOrderId,
      input.requestedAmount,
      input.status,
      input.method ?? null,
      input.orderSnapshot ? JSON.stringify(input.orderSnapshot) : null,
    ],
  )) as PaymentRow[];
  return rows[0] ? toPayment(rows[0]) : null;
}

/** 결제창에 넘긴 주문번호로 결제 1건을 찾는다. */
export async function getPaymentByMerchantOrderId(
  merchantOrderId: string,
): Promise<Payment | null> {
  const sql = paymentsClient();
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  const rows = (await sql.query(
    `SELECT ${PAYMENT_COLUMNS} FROM payments WHERE merchant_order_id = $1`,
    [merchantOrderId],
  )) as PaymentRow[];
  return rows[0] ? toPayment(rows[0]) : null;
}

/**
 * 승인 결과 기록. 주문을 만든 뒤 order_id와 PG 응답을 함께 남긴다.
 * method와 approvedAt은 넘기지 않으면 기존 값을 유지한다.
 */
export async function markPaymentApproved(input: {
  merchantOrderId: string;
  orderId: string;
  pgTid: string;
  approvedAmount: number;
  status: PaymentStatus;
  method?: string | null;
  approvedAt?: string | null;
  raw?: Record<string, unknown> | null;
}): Promise<Payment | null> {
  const sql = paymentsClient();
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  const rows = (await sql.query(
    `
      UPDATE payments
      SET order_id = $2,
          pg_tid = $3,
          approved_amount = $4,
          status = $5,
          method = COALESCE($6, method),
          approved_at = COALESCE($7::timestamptz, approved_at, now()),
          raw = $8::jsonb,
          updated_at = now()
      WHERE merchant_order_id = $1
      RETURNING ${PAYMENT_COLUMNS}
    `,
    [
      input.merchantOrderId,
      input.orderId,
      input.pgTid,
      input.approvedAmount,
      input.status,
      input.method ?? null,
      input.approvedAt ?? null,
      input.raw ? JSON.stringify(input.raw) : null,
    ],
  )) as PaymentRow[];
  return rows[0] ? toPayment(rows[0]) : null;
}

/**
 * 이미 만들어진 주문/상담에 결제를 연결하기만 한다.
 *
 * 관리자 재접수에서 "주문은 있는데 payments.order_id만 비어 있는" 건에만 쓴다.
 * 상태(status)·승인금액·pg_tid·raw는 건드리지 않는다. 승인 기록을 다시 쓰지 않는 것이
 * 이 함수의 존재 이유다(markPaymentApproved는 raw를 통째로 덮어쓴다).
 *
 * 조건에 order_id IS NULL과 status = 'paid'가 들어 있어 이미 연결된 건을 바꾸지 못하고,
 * 승인되지 않은 건에 주문을 붙일 수도 없다. 0행이면 연결하지 않았다는 뜻이다.
 */
export async function linkPaymentToOrder(input: {
  merchantOrderId: string;
  orderId: string;
}): Promise<boolean> {
  const sql = paymentsClient();
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  const rows = (await sql.query(
    `
      UPDATE payments
      SET order_id = $2, updated_at = now()
      WHERE merchant_order_id = $1
        AND order_id IS NULL
        AND status = 'paid'
      RETURNING id
    `,
    [input.merchantOrderId, input.orderId],
  )) as { id: string }[];
  return Boolean(rows[0]);
}

/**
 * 승인 API를 부르기 전에 결제 1건을 선점한다.
 * 단일 UPDATE 문이라 그 자체로 원자적이다. 같은 결제에 콜백이 동시에 두 번 들어오면
 * 뒤에 온 요청은 행 잠금이 풀린 뒤 조건을 다시 평가해 0행이 되므로,
 * 정확히 한 요청만 row를 받아 승인을 진행한다.
 * null을 받은 요청은 승인 API를 절대 호출하면 안 된다.
 */
export async function claimPaymentProcessing(merchantOrderId: string): Promise<Payment | null> {
  const sql = paymentsClient();
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  const rows = (await sql.query(
    `
      UPDATE payments
      SET status = 'processing',
          updated_at = now()
      WHERE merchant_order_id = $1
        AND status = 'ready'
      RETURNING ${PAYMENT_COLUMNS}
    `,
    [merchantOrderId],
  )) as PaymentRow[];
  return rows[0] ? toPayment(rows[0]) : null;
}

/**
 * 승인이 "명확히 거절된" 경우에만 부른다.
 * 통신 오류처럼 승인 여부를 알 수 없는 경우에는 절대 부르면 안 된다.
 * 그런 건은 processing으로 남겨 두고 사람이 확인해야 한다.
 */
export async function markPaymentFailed(input: {
  merchantOrderId: string;
  raw?: Record<string, unknown> | null;
}): Promise<Payment | null> {
  const sql = paymentsClient();
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  const rows = (await sql.query(
    `
      UPDATE payments
      SET status = 'failed',
          raw = COALESCE($2::jsonb, raw),
          updated_at = now()
      WHERE merchant_order_id = $1
        AND status = 'processing'
      RETURNING ${PAYMENT_COLUMNS}
    `,
    [input.merchantOrderId, input.raw ? JSON.stringify(input.raw) : null],
  )) as PaymentRow[];
  return rows[0] ? toPayment(rows[0]) : null;
}

/**
 * 승인 결과를 "승인을 선점한(processing) 결제 1건"에만 기록한다.
 * markPaymentApproved와 달리 status = 'processing' 조건이 붙어 있어,
 * 선점하지 못한 요청은 0행이 되어 null을 돌려받는다.
 * 호출한 쪽은 null을 "이미 처리됐거나 내가 선점한 건이 아님"으로 읽고
 * 주문을 만들지 않으면 된다.
 *
 * 기존 markPaymentApproved는 아직 호출하는 곳이 없지만 그대로 남겨 둔다.
 * order_id는 주문을 만들기 전에도 기록할 수 있어야 하므로 null을 허용한다.
 */
export async function claimPaymentApproved(input: {
  merchantOrderId: string;
  orderId?: string | null;
  pgTid: string;
  approvedAmount: number;
  method?: string | null;
  approvedAt?: string | null;
  raw?: Record<string, unknown> | null;
}): Promise<Payment | null> {
  const sql = paymentsClient();
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  const rows = (await sql.query(
    `
      UPDATE payments
      SET order_id = COALESCE($2, order_id),
          pg_tid = $3,
          approved_amount = $4,
          status = 'paid',
          method = COALESCE($5, method),
          approved_at = COALESCE($6::timestamptz, approved_at, now()),
          raw = COALESCE($7::jsonb, raw),
          updated_at = now()
      WHERE merchant_order_id = $1
        AND status = 'processing'
      RETURNING ${PAYMENT_COLUMNS}
    `,
    [
      input.merchantOrderId,
      input.orderId ?? null,
      input.pgTid,
      input.approvedAmount,
      input.method ?? null,
      input.approvedAt ?? null,
      input.raw ? JSON.stringify(input.raw) : null,
    ],
  )) as PaymentRow[];
  return rows[0] ? toPayment(rows[0]) : null;
}

/**
 * 승인 성공 뒤 주문을 만들 때 쓸 저장 경계.
 * app_store JSONB · orders INSERT · payments.order_id 연결을 한 트랜잭션으로 묶는다.
 * neon의 sql.transaction은 쿼리 배열만 받아 트랜잭션 안에서 분기할 수 없으므로,
 * "결제를 paid로 선점하는 조건부 UPDATE"는 이 함수 밖에서 먼저 끝내고
 * 여기서는 이미 선점된 결제에 주문을 이어 붙이기만 한다.
 * 아직 호출하는 곳은 없다. 4-2b에서 승인 라우트가 쓴다.
 */
export async function writeDataWithOrderForPayment(
  data: AppData,
  order: Order,
  merchantOrderId: string,
): Promise<void> {
  const sql = paymentsClient();
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  await ensureAppStoreVersion(sql);
  const expected = expectedVersionOf(data);
  const n = casParamCount(expected);

  // 주문 저장도 결제 연결도 CAS가 성공했을 때만 실행된다. 한 문장이라 함께 일어나거나 함께 없다.
  const rows = (await sql.query(
    `
      ${casHead(expected)},
      saved AS (
        INSERT INTO orders (
          id, user_id, product, title, status,
          amount, base_amount, payment, details, created_at, updated_at
        )
        SELECT $${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5},
               $${n + 6}, $${n + 7}, $${n + 8}, $${n + 9}::jsonb,
               $${n + 10}::timestamptz, $${n + 10}::timestamptz
        WHERE EXISTS (SELECT 1 FROM cas)
        ON CONFLICT (id) DO NOTHING
      ),
      linked AS (
        UPDATE payments
        SET order_id = $${n + 1}, updated_at = now()
        WHERE merchant_order_id = $${n + 11} AND EXISTS (SELECT 1 FROM cas)
      )
      SELECT version FROM cas
    `,
    [
      ...casParams(data, expected),
      order.id,
      order.userId,
      order.product,
      order.title,
      order.status,
      order.amount,
      order.baseAmount ?? null,
      order.payment,
      JSON.stringify(order.details ?? {}),
      order.createdAt,
      merchantOrderId,
    ],
  )) as { version: string | number }[];
  commitVersion(data, rows);
}

/**
 * 운영자가 확인해야 하는 결제 1건. 조회 전용이라 필요한 값만 담는다.
 * raw(PG 응답 원문)와 order_snapshot 전체는 절대 담지 않는다.
 */
export interface PaymentReviewItem {
  merchantOrderId: string;
  status: PaymentStatus;
  requestedAmount: number;
  approvedAmount: number | null;
  pgTid: string | null;
  method: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  /** order_snapshot에서 뽑은 최소 식별값. 신청 내용은 포함하지 않는다. */
  kind: string | null;
  goodsName: string | null;
  userId: string | null;
}

interface PaymentReviewRow {
  merchant_order_id: string;
  status: string;
  requested_amount: number;
  approved_amount: number | null;
  pg_tid: string | null;
  method: string | null;
  order_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  approved_at: string | Date | null;
  kind: string | null;
  goods_name: string | null;
  snapshot_user_id: string | null;
}

/** 조회에 필요한 컬럼만 고른다. raw와 order_snapshot 본문은 select하지 않는다. */
const PAYMENT_REVIEW_COLUMNS = `merchant_order_id, status, requested_amount, approved_amount,
  pg_tid, method, order_id, created_at, updated_at, approved_at,
  order_snapshot->>'kind' AS kind,
  order_snapshot->>'goodsName' AS goods_name,
  order_snapshot->>'userId' AS snapshot_user_id`;

function toPaymentReview(row: PaymentReviewRow): PaymentReviewItem {
  return {
    merchantOrderId: row.merchant_order_id,
    status: row.status as PaymentStatus,
    requestedAmount: Number(row.requested_amount),
    approvedAmount: row.approved_amount === null ? null : Number(row.approved_amount),
    pgTid: row.pg_tid,
    method: row.method,
    orderId: row.order_id,
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
    approvedAt: toIso(row.approved_at),
    kind: row.kind,
    goodsName: row.goods_name,
    userId: row.snapshot_user_id,
  };
}

/**
 * 사람이 확인해야 하는 결제만 모아 온다. 조회 전용이며 아무것도 바꾸지 않는다.
 *  stale    승인 결과를 확정하지 못한 채 10분 넘게 processing으로 남은 건
 *  unlinked 승인은 끝났는데 주문이 연결되지 않은 건(paid + order_id NULL)
 * 정상 결제(paid + order_id 있음)와 ready, 10분 미만 processing은 어느 쪽에도 들어가지 않는다.
 */
/**
 * 아직 끝나지 않은 결제(준비/승인 진행 중) 개수. 회원 탈퇴 가능 여부 판정에 쓴다.
 * payments 테이블에는 user_id 컬럼이 없고, 결제 준비 단계에는 order_id도 비어 있다.
 * 대신 결제 준비 때 저장한 order_snapshot.userId로 회원을 찾는다
 * (값을 넣는 곳: src/app/api/app/route.ts의 preparePayment).
 * DATABASE_URL이 없는 환경에는 결제 기록 자체가 없으므로 0을 돌려준다.
 */
export async function countPendingPaymentsByUser(userId: string): Promise<number> {
  const sql = sqlClient();
  if (!sql) return 0;
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  const rows = (await sql.query(
    `
      SELECT count(*)::int AS count
      FROM payments
      -- processing은 승인 여부가 불확실해 시간 제한 없이 막는다.
      -- ready는 결제창을 띄우기 전에 만들어져 이탈하면 그대로 남으므로 최근 것만 센다.
      -- 10분은 listPaymentsNeedingReview가 쓰는 결제 지연 판단 기준을 그대로 재사용한다.
      WHERE (
              status = 'processing'
              OR (
                status = 'ready'
                AND created_at > now() - interval '10 minutes'
              )
            )
        AND order_snapshot->>'userId' = $1
    `,
    [userId],
  )) as { count: number }[];
  return Number(rows[0]?.count ?? 0);
}

/**
 * 탈퇴한 회원의 주문에서 개인정보 사본(orders.details)을 정리한다.
 *
 * 주문은 app_store JSONB와 orders 테이블에 이중 기록되고(writeDataWithOrder),
 * DATABASE_URL이 있으면 읽기는 orders 테이블 쪽을 쓴다(listOrdersByUser/getOrderById).
 * JSONB만 정리하면 테이블 사본에 이름·연락처·사연이 그대로 남으므로 여기서 함께 지운다.
 *
 * keptKeys에 없는 키는 전부 버리는 allowlist 방식이다. 목록은 복제하지 않고
 * withdrawAccount.ts의 KEPT_DETAIL_KEYS를 호출부에서 그대로 넘겨받는다.
 * (이 파일을 withdrawAccount.ts가 import하므로 반대 방향 import는 순환이 된다.)
 *
 * details만 바꾼다. 주문 행을 지우지 않고 status·product·title·amount·payment도 건드리지 않는다.
 * DATABASE_URL이 없는 환경에는 orders 테이블 자체가 없으므로 아무것도 하지 않는다.
 */
export async function scrubOrderDetailsByUser(
  userId: string,
  keptKeys: readonly string[],
): Promise<void> {
  const sql = sqlClient();
  if (!sql) return;
  await ensureTable(sql);
  await sql.query(
    `
      UPDATE orders
      SET details = COALESCE(
            (
              SELECT jsonb_object_agg(kept.key, kept.value)
              FROM jsonb_each(orders.details) AS kept
              WHERE kept.key = ANY($2::text[])
            ),
            '{}'::jsonb
          ),
          updated_at = now()
      WHERE user_id = $1
        -- 남길 키만 있는 주문은 건드리지 않는다. 지울 것이 있는 행만 고른다.
        AND EXISTS (
          SELECT 1
          FROM jsonb_each(orders.details) AS extra
          WHERE extra.key <> ALL($2::text[])
        )
    `,
    [userId, keptKeys as string[]],
  );
}

/**
 * 탈퇴한 회원의 결제 스냅샷에서 신청 내용 사본(order_snapshot.details)만 지운다.
 * details는 Order/Consultation.details에 확정본이 있는 중복 사본이라 지워도 잃는 정보가 없다.
 *
 * 남기는 값: version/kind/userId/goodsName/baseAmount/amount/request/discount/preparedAt.
 * userId는 countPendingPaymentsByUser와 listPaymentsNeedingReview가 읽으므로 반드시 남긴다.
 * raw(PG 응답 원문)는 이 함수가 건드리지 않는다.
 *
 * 결제 상태로 대상을 가르지 않는다. 진행 중인 결제가 있는 회원은
 * findWithdrawBlockers에서 이미 탈퇴가 막히기 때문이다.
 * DATABASE_URL이 없는 환경에는 결제 기록 자체가 없으므로 아무것도 하지 않는다.
 */
export async function scrubPaymentSnapshotDetailsByUser(userId: string): Promise<void> {
  const sql = sqlClient();
  if (!sql) return;
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  await sql.query(
    `
      UPDATE payments
      SET order_snapshot = order_snapshot - 'details',
          updated_at = now()
      WHERE order_snapshot->>'userId' = $1
        AND order_snapshot->'details' IS NOT NULL
    `,
    [userId],
  );
}

export async function listPaymentsNeedingReview(): Promise<{
  stale: PaymentReviewItem[];
  unlinked: PaymentReviewItem[];
}> {
  const sql = paymentsClient();
  await ensureTable(sql);
  await ensurePaymentsMigration(sql);
  const [staleRows, unlinkedRows] = (await Promise.all([
    sql.query(
      `
        SELECT ${PAYMENT_REVIEW_COLUMNS}
        FROM payments
        WHERE status = 'processing'
          AND updated_at < now() - interval '10 minutes'
        ORDER BY updated_at DESC
        LIMIT 50
      `,
    ),
    sql.query(
      `
        SELECT ${PAYMENT_REVIEW_COLUMNS}
        FROM payments
        WHERE status = 'paid'
          AND order_id IS NULL
        ORDER BY approved_at DESC NULLS LAST, updated_at DESC
        LIMIT 50
      `,
    ),
  ])) as [PaymentReviewRow[], PaymentReviewRow[]];
  return {
    stale: staleRows.map(toPaymentReview),
    unlinked: unlinkedRows.map(toPaymentReview),
  };
}

export function nowId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 신규 회원의 기본값. 로그인 경로(연락처 / 이메일 / 카카오)가 여러 곳이라
 * 같은 모양의 회원이 만들어지도록 이 함수 하나만 사용한다.
 */
export function emptyUser(phone = "", name = "", email = "", loginId = ""): User {
  return {
    id: nowId(),
    phone: phone ? formatPhone(phone) : "",
    email: email ? normalizeEmail(email) : "",
    // 값을 주지 않으면 필드를 만들지 않는다. 소셜 회원처럼 아이디가 없는 회원과
    // 빈 문자열만 가진 회원이 뒤섞이지 않게 하기 위해서다.
    ...(loginId ? { loginId: normalizeLoginId(loginId) } : {}),
    name,
    gender: "",
    birth: "",
    birthTime: "",
    unknownTime: false,
    calendar: "solar",
    bloodType: "",
    points: 0,
    createdAt: new Date().toISOString(),
  };
}

export function welcomeCoupon(): Coupon {
  return {
    id: nowId(),
    title: "첫 방문 안내",
    desc: "신청과 상담 진행을 우선 안내해 드립니다.",
    createdAt: new Date().toISOString(),
  };
}

/** 신규 회원을 저장소에 등록하고 딸린 컬렉션을 함께 초기화한다. */
export function registerUser(data: AppData, user: User): User {
  data.users.push(user);
  data.coupons[user.id] = [welcomeCoupon()];
  data.wishlists[user.id] = [];
  data.notifications[user.id] = [];
  data.notificationSettings[user.id] = { order: true, consult: true, notice: false };
  return user;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function formatPhone(phone: string): string {
  const digits = normalizePhone(phone);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/**
 * 일반 로그인 아이디의 비교 기준. 대소문자를 구분하지 않으므로
 * 저장할 때도 찾을 때도 이 함수를 통과한 값만 쓴다. normalizeEmail과 같은 방식이다.
 */
export function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * 아이디로 쓸 수 있는 값인지. 판정은 normalizeLoginId를 거친 값을 기준으로 한다.
 *
 * - 4~20자
 * - 첫 글자는 영문 소문자
 * - 나머지는 영문 소문자·숫자·밑줄
 *
 * 첫 글자를 영문으로 제한하면 숫자만으로 된 아이디가 함께 막혀
 * 연락처처럼 보이는 값이 아이디가 되지 않는다.
 */
export function isValidLoginId(value: string): boolean {
  return /^[a-z][a-z0-9_]{3,19}$/.test(normalizeLoginId(value));
}

export function emailCodeKey(email: string): string {
  return `email:${normalizeEmail(email)}`;
}

/**
 * 비밀번호 해시. Node 내장 scrypt만 사용하며 외부 의존성을 추가하지 않는다.
 * 평문을 저장하지 않기 위한 최소 조치이고, 운영 전에 정책 재검토가 필요하다.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
