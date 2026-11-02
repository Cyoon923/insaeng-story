import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/chatInquiryApi";
import { CURRENT_ADMIN_ACTOR } from "@/lib/server/adminSession";
import { prepareInquiryRetentionUpdate } from "@/lib/server/inquiryRetention";
import { getInquiryRetention, saveInquiryRetention, type RetentionTarget } from "@/lib/server/inquiryRetentionStore";
import { sqlClient } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});
const invalid = () => reply({ error: "요청 형식을 확인해 주세요." }, 400);
const failed = () => reply({ error: "보존 정보를 처리하지 못했습니다. 관리자 확인이 필요합니다." }, 500);
const missing = () => reply({ error: "문의 기록을 찾을 수 없습니다." }, 404);
const corrupt = () => reply({ error: "저장된 보존 정보를 확인해야 합니다. 덮어쓰지 않았습니다." }, 409);

function targetOf(kind: unknown, id: unknown): RetentionTarget | null {
  if (kind !== "inquiry" && kind !== "chat" && kind !== "refund") return null;
  if (typeof id !== "string" || !id.trim() || id.length > 200) return null;
  return { kind, id: id.trim() };
}

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const target = targetOf(params.get("kind"), params.get("id"));
  if (!target) return invalid();
  try {
    const result = await getInquiryRetention(target);
    if (result.kind === "not-found") return missing();
    if (result.kind === "invalid") return corrupt();
    return reply(result.kind === "unclassified"
      ? { retention: null, revision: 0 }
      : { retention: result.value, revision: result.value.revision });
  } catch {
    return failed();
  }
}

// Content-Length가 없어도 본문 읽기 자체를 상한에서 멈춘다.
async function readBody(request: Request): Promise<unknown> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        throw new RangeError("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return invalid();
  let body: unknown;
  try { body = await readBody(request); } catch (error) {
    return error instanceof RangeError
      ? reply({ error: "요청 내용이 너무 큽니다." }, 413) : invalid();
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalid();
  const input = body as Record<string, unknown>;
  if (Object.keys(input).length !== 4 || !["kind", "id", "expectedRevision", "decision"].every((key) => Object.hasOwn(input, key))) return invalid();
  const target = targetOf(input.kind, input.id);
  if (!target || !Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0) return invalid();
  const now = new Date().toISOString();
  const checked = prepareInquiryRetentionUpdate(null, 0, input.decision, CURRENT_ADMIN_ACTOR, now);
  if (!checked.ok) return invalid();
  const decision = checked.value.decision;
  // 정책 승인 전에는 분류만 저장한다. 근거·보존기간·삭제 허가는 만들지 않는다.
  if (decision.grounds.length || decision.complaintRecordIds.length > 50) return invalid();
  if (["general", "unclassified"].includes(decision.classification) && decision.complaintRecordIds.length) return invalid();
  if (["unclassified", "complaint", "mixed"].includes(decision.classification) && !decision.hold) return invalid();
  try {
    if (decision.complaintRecordIds.length) {
      const sql = sqlClient();
      if (!sql) return failed();
      // 요지나 개인정보를 읽지 않고 연결할 기록의 존재만 확인한다.
      const rows = await sql.query("SELECT id FROM complaint_records WHERE id = ANY($1::text[])", [decision.complaintRecordIds]) as { id: string }[];
      if (rows.length !== decision.complaintRecordIds.length) return invalid();
    }
    const result = await saveInquiryRetention(target, {
      expectedRevision: Number(input.expectedRevision), decision, actorId: CURRENT_ADMIN_ACTOR,
    }, undefined, now);
    if (result.ok) return reply({ retention: result.value, revision: result.value.revision });
    if (result.reason === "not-found") return missing();
    if (result.reason === "invalid-input") return invalid();
    if (result.reason === "invalid-stored-data") return corrupt();
    return reply({ error: "다른 변경이 저장되었습니다. 최신 정보를 다시 조회하고 확인해 주세요." }, 409);
  } catch {
    return failed();
  }
}
