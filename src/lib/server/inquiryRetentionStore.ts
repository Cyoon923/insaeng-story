/** 내부 저장 계층. 관리자 인증을 마친 호출부만 사용한다. 현재 API·화면에는 연결하지 않는다. */
import { readInquiryRetention, prepareInquiryRetentionUpdate } from "./inquiryRetention.ts";
import type { InquiryRetentionRead } from "../types/inquiryRetention.ts";
import type { AppData } from "../types/app.ts";
import { readData, writeData, isAppStoreConflict, sqlClient } from "@/lib/server/store";

export type RetentionTarget = { kind: "inquiry" | "chat" | "refund"; id: string };
export interface RetentionSql {
  query: (text: string, params: unknown[]) => Promise<unknown>;
}
export interface InquiryRetentionDeps {
  readData: () => Promise<AppData>;
  writeData: (data: AppData) => Promise<void>;
  isConflict: (error: unknown) => boolean;
  sql: () => RetentionSql | null;
}
const defaults: InquiryRetentionDeps = { readData, writeData, isConflict: isAppStoreConflict, sql: sqlClient };
const tables = { chat: "chat_inquiries", refund: "refund_requests" } as const;
const validTarget = (target: RetentionTarget) =>
  target && ["inquiry", "chat", "refund"].includes(target.kind) && typeof target.id === "string" && target.id.trim().length > 0;

type Stored = { found: false } | { found: true; raw: unknown; data?: AppData };

async function readStored(target: RetentionTarget, deps: InquiryRetentionDeps): Promise<Stored> {
  if (target.kind === "inquiry") {
    const data = await deps.readData();
    const item = data.inquiries.find((row) => row.id === target.id);
    return item ? { found: true, raw: item.retention, data } : { found: false };
  }
  const sql = deps.sql();
  if (!sql) throw new Error("INQUIRY_RETENTION_DATABASE_REQUIRED");
  // 테이블명은 고정 목록만 사용한다. migration을 자동 실행하지 않는다.
  const rows = await sql.query(`SELECT retention FROM ${tables[target.kind]} WHERE id = $1`, [target.id]) as { retention: unknown }[];
  return rows[0] ? { found: true, raw: rows[0].retention } : { found: false };
}

export async function getInquiryRetention(target: RetentionTarget, deps: InquiryRetentionDeps = defaults): Promise<InquiryRetentionRead | { kind: "not-found" }> {
  if (!validTarget(target)) throw new Error("INQUIRY_RETENTION_INVALID_TARGET");
  const stored = await readStored(target, deps);
  return stored.found ? readInquiryRetention(stored.raw) : { kind: "not-found" };
}

/** 서버에서 얻은 actorId를 사용한다. expectedRevision은 읽었을 때의 값(미분류는 0)이다. */
export async function saveInquiryRetention(
  target: RetentionTarget,
  input: { expectedRevision: number; decision: unknown; actorId: string },
  deps: InquiryRetentionDeps = defaults,
  now: string = new Date().toISOString(),
) {
  if (!validTarget(target)) return { ok: false as const, reason: "invalid-input" as const };
  // 잘못된 입력은 저장소를 읽기 전에도 거절한다.
  const checked = prepareInquiryRetentionUpdate(null, 0, input.decision, input.actorId, now);
  if (!checked.ok || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) return { ok: false as const, reason: "invalid-input" as const };
  const stored = await readStored(target, deps);
  if (!stored.found) return { ok: false as const, reason: "not-found" as const };
  const next = prepareInquiryRetentionUpdate(stored.raw, input.expectedRevision, input.decision, input.actorId, now);
  if (!next.ok) return next;
  if (target.kind === "inquiry") {
    const data = stored.data!;
    const item = data.inquiries.find((row) => row.id === target.id)!;
    const previous = item.retention;
    item.retention = next.value;
    try { await deps.writeData(data); } catch (error) {
      if (previous === undefined) delete item.retention;
      else item.retention = previous;
      // 다른 관리자의 판정을 재시도로 덮어쓰지 않는다. 최신 값을 다시 보고 판단한다.
      if (deps.isConflict(error)) return { ok: false as const, reason: "conflict" as const };
      throw error;
    }
  } else {
    const sql = deps.sql();
    if (!sql) throw new Error("INQUIRY_RETENTION_DATABASE_REQUIRED");
    // 읽은 JSON 전체와 비교하고 이력 추가·현재 판정 갱신을 같은 UPDATE에서 처리한다.
    const rows = await sql.query(
      `UPDATE ${tables[target.kind]} SET retention = $2::jsonb
       WHERE id = $1 AND retention IS NOT DISTINCT FROM $3::jsonb RETURNING id`,
      [target.id, JSON.stringify(next.value), stored.raw == null ? null : JSON.stringify(stored.raw)],
    ) as { id: string }[];
    if (rows.length === 0) return { ok: false as const, reason: "conflict" as const };
  }
  return next;
}
