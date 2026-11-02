import type { InquiryRetention, InquiryRetentionDecision, InquiryRetentionRead } from "../types/inquiryRetention.ts";
import { parseIsoTime } from "./inquiryChatCleanup.ts";

const classifications = ["unclassified", "general", "complaint", "transaction", "mixed"];
const holdReasons = ["classification-review", "ongoing-handling", "ongoing-dispute", "legal-proceeding"];
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) =>
  Object.keys(v).length === names.length && names.every((key) => Object.hasOwn(v, key));
const token = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const time = (v: unknown): v is string => typeof v === "string" && parseIsoTime(v) !== null;
const nullableTime = (v: unknown) => v === null || time(v);

/** 자유 서술 필드는 받지 않는다. 저장소로 들어가기 전에 알 수 없는 키도 거절한다. */
export function isInquiryRetentionDecision(value: unknown): value is InquiryRetentionDecision {
  if (!record(value) || !keys(value, ["classification", "resolvedAt", "grounds", "hold", "complaintRecordIds"])) return false;
  if (!classifications.includes(String(value.classification)) || !nullableTime(value.resolvedAt)) return false;
  if (!Array.isArray(value.grounds) || value.grounds.length > 2) return false;
  const seen = new Set<string>();
  for (const ground of value.grounds) {
    if (!record(ground) || !keys(ground, ["code", "policyVersion", "startsAt", "endsAt"])) return false;
    if (ground.code !== "complaint-record" && ground.code !== "transaction-record") return false;
    if (seen.has(ground.code) || !token(ground.policyVersion)) return false;
    seen.add(ground.code);
    if (!nullableTime(ground.startsAt) || !nullableTime(ground.endsAt)) return false;
    if (ground.endsAt !== null && (ground.startsAt === null || Date.parse(String(ground.endsAt)) < Date.parse(String(ground.startsAt)))) return false;
  }
  if (value.hold !== null) {
    if (!record(value.hold) || !keys(value.hold, ["reason", "reviewAt"])) return false;
    if (!holdReasons.includes(String(value.hold.reason)) || !time(value.hold.reviewAt)) return false;
  }
  if (!Array.isArray(value.complaintRecordIds) || !value.complaintRecordIds.every(token)) return false;
  return new Set(value.complaintRecordIds).size === value.complaintRecordIds.length;
}

/** 값 없음과 손상을 구분하며 손상·미지원 버전은 덮어쓰지 않는다. */
export function readInquiryRetention(value: unknown): InquiryRetentionRead {
  if (value === null || value === undefined) return { kind: "unclassified" };
  if (!record(value) || !keys(value, ["version", "revision", "decision", "scrubbedAt", "history"])) return { kind: "invalid" };
  if (value.version !== 1 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || value.scrubbedAt !== null) return { kind: "invalid" };
  if (!isInquiryRetentionDecision(value.decision) || !Array.isArray(value.history) || value.history.length !== value.revision) return { kind: "invalid" };
  let previous = -Infinity;
  for (let i = 0; i < value.history.length; i += 1) {
    const event = value.history[i];
    if (!record(event) || !keys(event, ["revision", "actorId", "at", "decision"])) return { kind: "invalid" };
    if (event.revision !== i + 1 || !token(event.actorId) || !time(event.at) || !isInquiryRetentionDecision(event.decision)) return { kind: "invalid" };
    if (Date.parse(event.at) < previous) return { kind: "invalid" };
    previous = Date.parse(event.at);
  }
  // JSONB는 객체 키 순서를 보존하지 않으므로 순서를 정규화해 마지막 판정과 비교한다.
  const canonical = (v: InquiryRetentionDecision) => JSON.stringify({
    classification: v.classification, resolvedAt: v.resolvedAt,
    grounds: v.grounds.map((g) => [g.code, g.policyVersion, g.startsAt, g.endsAt]),
    hold: v.hold ? [v.hold.reason, v.hold.reviewAt] : null,
    complaintRecordIds: v.complaintRecordIds,
  });
  if (canonical(value.decision) !== canonical(value.history[value.history.length - 1].decision)) return { kind: "invalid" };
  return { kind: "stored", value: structuredClone(value) as unknown as InquiryRetention };
}

export type RetentionUpdate =
  | { ok: true; value: InquiryRetention }
  | { ok: false; reason: "invalid-input" | "invalid-stored-data" | "conflict" };

/** actorId와 now는 인증된 관리자·서버에서 주입한다. 요청 body의 이력은 받지 않는다. */
export function prepareInquiryRetentionUpdate(
  current: unknown, expectedRevision: number, decision: unknown, actorId: string, now: string,
): RetentionUpdate {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !token(actorId) || !time(now) || !isInquiryRetentionDecision(decision)) return { ok: false, reason: "invalid-input" };
  if (decision.resolvedAt && Date.parse(decision.resolvedAt) > Date.parse(now)) return { ok: false, reason: "invalid-input" };
  if (decision.hold && Date.parse(decision.hold.reviewAt) <= Date.parse(now)) return { ok: false, reason: "invalid-input" };
  const stored = readInquiryRetention(current);
  if (stored.kind === "invalid") return { ok: false, reason: "invalid-stored-data" };
  const previous = stored.kind === "stored" ? stored.value : null;
  if ((previous?.revision ?? 0) !== expectedRevision) return { ok: false, reason: "conflict" };
  if (previous && Date.parse(previous.history[previous.history.length - 1].at) > Date.parse(now)) return { ok: false, reason: "invalid-input" };
  const revision = expectedRevision + 1;
  if (!Number.isSafeInteger(revision)) return { ok: false, reason: "invalid-input" };
  const nextDecision = structuredClone(decision);
  return { ok: true, value: {
    version: 1, revision, decision: nextDecision, scrubbedAt: null,
    history: [...(previous?.history ?? []), { revision, actorId, at: now, decision: structuredClone(nextDecision) }],
  } };
}
