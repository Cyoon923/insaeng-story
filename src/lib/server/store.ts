import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { neon } from "@neondatabase/serverless";
import type { AppData, Coupon, Order, OrderStatus, User } from "@/lib/types/app";

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

function sqlClient() {
  if (!canUseDatabase()) return null;
  return neon(databaseUrl());
}

/**
 * 필요한 테이블을 보장한다. 모두 IF NOT EXISTS라 여러 번 실행해도 안전하다.
 * orders/payments는 아직 어느 경로에서도 읽고 쓰지 않는 빈 테이블이며,
 * 현재 데이터는 그대로 app_store JSONB에만 저장된다.
 * DDL을 한 트랜잭션으로 묶어 기존과 같은 왕복 1회를 유지한다.
 */
async function ensureTable(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await sql.transaction((txn) => [
    txn.query(`
      CREATE TABLE IF NOT EXISTS app_store (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL
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
        order_id TEXT NOT NULL REFERENCES orders(id),
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
        raw JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `),
    txn.query(`
      CREATE INDEX IF NOT EXISTS payments_order_created_idx
        ON payments (order_id, created_at DESC)
    `),
  ]);
}

function mergeData(value: unknown): AppData {
  if (!value || typeof value !== "object") return structuredClone(EMPTY);
  return { ...EMPTY, ...(value as AppData) };
}

async function clearTestDataOnce(data: AppData): Promise<AppData> {
  if (data.testResetAt) return data;
  data.users = [];
  data.orders = [];
  data.consultations = [];
  data.inquiries = [];
  data.reviews = [];
  data.wishlists = {};
  data.coupons = {};
  data.notifications = {};
  data.notificationSettings = {};
  data.codes = {};
  data.testResetAt = new Date().toISOString();
  await writeData(data);
  return data;
}

export async function readData(): Promise<AppData> {
  const sql = sqlClient();
  if (sql) {
    await ensureTable(sql);
    const rows = (await sql.query("SELECT data FROM app_store WHERE id = 1")) as { data: unknown }[];
    if (!rows[0]) return clearTestDataOnce(structuredClone(EMPTY));
    return clearTestDataOnce(mergeData(rows[0].data));
  }

  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return clearTestDataOnce(mergeData(JSON.parse(raw)));
  } catch {
    return clearTestDataOnce(structuredClone(EMPTY));
  }
}

const APP_STORE_UPSERT = `
  INSERT INTO app_store (id, data)
  VALUES (1, $1::jsonb)
  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
`;

export async function writeData(data: AppData): Promise<void> {
  const sql = sqlClient();
  if (sql) {
    await ensureTable(sql);
    await sql.query(APP_STORE_UPSERT, [JSON.stringify(data)]);
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * 주문 저장. JSONB 전체와 orders 테이블에 같은 주문을 한 트랜잭션으로 남긴다.
 * 아직 읽기는 JSONB만 쓰므로, 테이블 쪽은 이후 전환을 위한 이중 기록이다.
 * DATABASE_URL이 없으면 기존 파일 저장으로 그대로 위임한다.
 */
export async function writeDataWithOrder(data: AppData, order: Order): Promise<void> {
  const sql = sqlClient();
  if (!sql) return writeData(data);

  // DDL은 트랜잭션 밖에서 먼저 보장한다.
  await ensureTable(sql);
  await sql.transaction((txn) => [
    txn.query(APP_STORE_UPSERT, [JSON.stringify(data)]),
    txn.query(
      `
        INSERT INTO orders (
          id, user_id, product, title, status,
          amount, base_amount, payment, details, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz, $10::timestamptz)
        ON CONFLICT (id) DO NOTHING
      `,
      [
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
    ),
  ]);
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
  await sql.transaction((txn) => [
    txn.query(APP_STORE_UPSERT, [JSON.stringify(data)]),
    txn.query(
      `
        UPDATE orders
        SET status = $2, updated_at = now()
        WHERE id = $1
      `,
      [id, status],
    ),
  ]);
}

export function nowId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 신규 회원의 기본값. 로그인 경로(연락처 / 이메일 / 카카오)가 여러 곳이라
 * 같은 모양의 회원이 만들어지도록 이 함수 하나만 사용한다.
 */
export function emptyUser(phone = "", name = "", email = ""): User {
  return {
    id: nowId(),
    phone: phone ? formatPhone(phone) : "",
    email: email ? normalizeEmail(email) : "",
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
