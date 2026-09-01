import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { neon } from "@neondatabase/serverless";
import type { AppData, Coupon, User } from "@/lib/types/app";

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

async function ensureTable(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS app_store (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL
    )
  `);
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

export async function writeData(data: AppData): Promise<void> {
  const sql = sqlClient();
  if (sql) {
    await ensureTable(sql);
    await sql.query(
      `
        INSERT INTO app_store (id, data)
        VALUES (1, $1::jsonb)
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
      `,
      [JSON.stringify(data)],
    );
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
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
