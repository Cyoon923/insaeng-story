import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { neon } from "@neondatabase/serverless";
import type { AppData } from "@/lib/types/app";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "app-data.json");

const EMPTY: AppData = {
  users: [],
  orders: [],
  consultations: [],
  inquiries: [],
  wishlists: {},
  coupons: {},
  notifications: {},
  notificationSettings: {},
  codes: {},
  blockedSlots: [],
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

export async function readData(): Promise<AppData> {
  const sql = sqlClient();
  if (sql) {
    await ensureTable(sql);
    const rows = (await sql.query("SELECT data FROM app_store WHERE id = 1")) as { data: unknown }[];
    if (!rows[0]) return structuredClone(EMPTY);
    return mergeData(rows[0].data);
  }

  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return mergeData(JSON.parse(raw));
  } catch {
    return structuredClone(EMPTY);
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
