/**
 * 일반 문의·채팅 보존기간 정리 테스트 (Privacy-Inquiries-Chat-Cleanup-2).
 *
 * 실행: node --test src/lib/server/inquiryChatCleanup.test.ts
 *
 * 보는 것은 셋이다.
 * 1) 만료 경계: 90일 직전·정확히 90일·초과, 읽을 수 없는 값, 미래 값.
 * 2) legacy 실행: 배열 순서 유지, limit, CAS 재시도, 변경 0건이면 저장하지 않음.
 * 3) 채팅 질의: 파라미터 바인딩, 한도, 조건에 상태·회원·토큰이 없음, 메시지 직접 삭제 없음.
 *
 * 실제 DB에 접속하지 않는다. 저장 실행 모듈(inquiryChatCleanupStore.ts)은
 * store.ts를 통해 DB 드라이버를 불러오므로, 그쪽은 원문을 글자로 읽어 경계를 본다
 * (paymentRawPresenceSource.test.ts와 같은 방식).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  COUNT_EXPIRED_CHAT_SQL,
  DELETE_CHAT_BY_IDS_SQL,
  INQUIRY_CHAT_RETENTION_DAYS,
  SELECT_EXPIRED_CHAT_IDS_SQL,
  cleanupCutoff,
  countExpiredInquiries,
  isExpiredAt,
  isValidCleanupLimit,
  parseIsoTime,
  pruneExpiredInquiries,
} from "./inquiryChatCleanup.ts";

const NOW = "2026-09-21T00:00:00.000Z";
const CUTOFF = cleanupCutoff(NOW) as string;

/** 기준 시각에서 days일 전. 테스트가 직접 날짜를 적지 않게 한다. */
function daysBefore(iso: string, days: number): string {
  return new Date(Date.parse(iso) - days * 24 * 60 * 60 * 1000).toISOString();
}

/* ── cutoff ─────────────────────────────────────── */

test("보존기간은 이 정책 전용 상수 90일이다", () => {
  assert.equal(INQUIRY_CHAT_RETENTION_DAYS, 90);
  assert.equal(CUTOFF, daysBefore(NOW, 90));
});

test("읽을 수 없는 now면 cutoff가 없다", () => {
  for (const bad of ["", "   ", "2026-09-21", "Dec 2026", "2026-13-45T00:00:00Z", "오늘"]) {
    assert.equal(cleanupCutoff(bad), null, `${bad} 를 시각으로 받았다`);
  }
  assert.equal(parseIsoTime(null), null);
  assert.equal(parseIsoTime(12345), null);
});

test("기간이 양의 정수가 아니면 cutoff가 없다", () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.equal(cleanupCutoff(NOW, bad), null, `${bad} 일을 받았다`);
  }
});

/* ── 만료 경계 ──────────────────────────────────── */

test("90일 직전은 남기고, 정확히 90일도 남기고, 초과만 지운다", () => {
  // 89일 전 = 아직 보존 기간 안.
  assert.equal(isExpiredAt(daysBefore(NOW, 89), CUTOFF), false);
  // 정확히 cutoff와 같은 시각은 지우지 않는다(이전만 만료다).
  assert.equal(isExpiredAt(CUTOFF, CUTOFF), false);
  // 1밀리초만 더 오래됐으면 만료.
  assert.equal(isExpiredAt(new Date(Date.parse(CUTOFF) - 1).toISOString(), CUTOFF), true);
  assert.equal(isExpiredAt(daysBefore(NOW, 91), CUTOFF), true);
});

test("읽을 수 없거나 없는 시각은 지우지 않는다", () => {
  for (const bad of [undefined, null, "", "   ", "2026-09-21", "Dec 2026", 12345, {}, []]) {
    assert.equal(isExpiredAt(bad, CUTOFF), false, `${String(bad)} 를 만료로 봤다`);
  }
  // 존재하지 않는 날짜도 마찬가지다.
  assert.equal(isExpiredAt("2026-02-30T00:00:00.000Z", CUTOFF), false);
});

test("미래 시각은 지우지 않는다", () => {
  assert.equal(isExpiredAt("2027-01-01T00:00:00.000Z", CUTOFF), false, "미래가 만료로 보인다");
  assert.equal(isExpiredAt(daysBefore(NOW, -10), CUTOFF), false);
});

test("윤년·월말 경계에서도 고정 90일로 센다", () => {
  const leapNow = "2028-05-29T12:00:00.000Z"; // 2028은 윤년
  const leapCutoff = cleanupCutoff(leapNow) as string;
  assert.equal(leapCutoff, daysBefore(leapNow, 90));
  // 2월 29일이 낀 구간도 90일 계산이 흔들리지 않는다.
  assert.equal(isExpiredAt(daysBefore(leapNow, 91), leapCutoff), true);
  assert.equal(isExpiredAt(daysBefore(leapNow, 90), leapCutoff), false);
  // 시각대가 +09:00으로 적힌 값도 같은 순간으로 읽는다.
  assert.equal(isExpiredAt("2026-01-01T09:00:00+09:00", CUTOFF), true);
});

/* ── limit ──────────────────────────────────────── */

test("limit은 양의 정수만 인정한다", () => {
  for (const ok of [1, 5, 1000]) assert.equal(isValidCleanupLimit(ok), true);
  for (const bad of [0, -1, 1.5, Number.NaN, "5", null, undefined, {}]) {
    assert.equal(isValidCleanupLimit(bad), false, `${String(bad)} 를 한도로 받았다`);
  }
});

/* ── legacy 배열 정리 ───────────────────────────── */

const OLD = daysBefore(NOW, 200);
const FRESH = daysBefore(NOW, 10);

test("만료 원소만 덜어내고 순서를 그대로 지킨다", () => {
  const items = [
    { id: "a", createdAt: FRESH },
    { id: "b", createdAt: OLD },
    { id: "c", createdAt: FRESH },
    { id: "d", createdAt: OLD },
  ];
  const { next, deleted } = pruneExpiredInquiries(items, CUTOFF, 10);
  assert.equal(deleted, 2);
  assert.deepEqual(next.map((item) => item.id), ["a", "c"]);
  // 인자는 바꾸지 않는다.
  assert.equal(items.length, 4);
});

test("한 번에 limit개까지만 지운다", () => {
  const items = [
    { id: "a", createdAt: OLD },
    { id: "b", createdAt: OLD },
    { id: "c", createdAt: OLD },
  ];
  const { next, deleted } = pruneExpiredInquiries(items, CUTOFF, 2);
  assert.equal(deleted, 2);
  // 남은 만료 건은 다음 실행에서 이어서 지운다. 순서는 그대로다.
  assert.deepEqual(next.map((item) => item.id), ["c"]);
});

test("빈 배열·키 부재·배열 아님을 안전하게 다룬다", () => {
  assert.deepEqual(pruneExpiredInquiries([], CUTOFF, 5), { next: [], deleted: 0 });
  assert.deepEqual(pruneExpiredInquiries(undefined, CUTOFF, 5), { next: [], deleted: 0 });
  assert.deepEqual(pruneExpiredInquiries(null, CUTOFF, 5), { next: [], deleted: 0 });
  assert.deepEqual(
    pruneExpiredInquiries({ a: 1 } as unknown as { createdAt?: unknown }[], CUTOFF, 5),
    { next: [], deleted: 0 },
  );
});

test("시각이 이상한 원소와 객체가 아닌 원소는 남긴다", () => {
  const items = [
    { id: "a" },
    { id: "b", createdAt: "" },
    { id: "c", createdAt: "2026-13-45T00:00:00Z" },
    { id: "d", createdAt: daysBefore(NOW, -5) },
    12345 as unknown as { createdAt?: unknown },
    null as unknown as { createdAt?: unknown },
    { id: "e", createdAt: OLD },
  ];
  const { next, deleted } = pruneExpiredInquiries(items, CUTOFF, 10);
  assert.equal(deleted, 1);
  assert.equal(next.length, items.length - 1);
});

test("한도가 잘못되면 아무것도 지우지 않는다", () => {
  const items = [{ id: "a", createdAt: OLD }];
  const { next, deleted } = pruneExpiredInquiries(items, CUTOFF, 0);
  assert.equal(deleted, 0);
  assert.equal(next.length, 1);
});

/* ── 채팅 질의 ──────────────────────────────────── */

test("대상 선택은 cutoff와 한도를 파라미터로만 받는다", () => {
  assert.match(SELECT_EXPIRED_CHAT_IDS_SQL, /WHERE last_message_at < \$1::timestamptz/);
  assert.match(SELECT_EXPIRED_CHAT_IDS_SQL, /LIMIT \$2/);
  // 값을 문장에 끼워 넣는 자리가 없다.
  assert.equal(SELECT_EXPIRED_CHAT_IDS_SQL.includes("${"), false);
  // 고르는 것은 id뿐이다. 이름·연락처·본문은 SELECT 목록에 없다.
  assert.match(SELECT_EXPIRED_CHAT_IDS_SQL, /SELECT id FROM chat_inquiries/);
});

test("삭제 조건에 상태·회원·비회원 토큰이 없다", () => {
  for (const sql of [SELECT_EXPIRED_CHAT_IDS_SQL, DELETE_CHAT_BY_IDS_SQL]) {
    for (const forbidden of ["status", "user_id", "guest_token_hash"]) {
      assert.equal(sql.includes(forbidden), false, `${forbidden} 가 조건에 있다`);
    }
  }
});

test("메시지를 직접 지우지 않는다", () => {
  assert.match(DELETE_CHAT_BY_IDS_SQL, /DELETE FROM chat_inquiries WHERE id = ANY\(\$1::text\[\]\)/);
  assert.equal(DELETE_CHAT_BY_IDS_SQL.includes("chat_inquiry_messages"), false);
  assert.equal(SELECT_EXPIRED_CHAT_IDS_SQL.includes("chat_inquiry_messages"), false);
  // 돌려받는 것은 값이 아니라 상수다(건수만 센다).
  assert.match(DELETE_CHAT_BY_IDS_SQL, /RETURNING 1/);
});

test("다른 표를 보지 않는다", () => {
  const both = SELECT_EXPIRED_CHAT_IDS_SQL + DELETE_CHAT_BY_IDS_SQL;
  for (const table of [
    "complaint_records",
    "refund_requests",
    "orders",
    "payments",
    "consultations",
    "app_store",
  ]) {
    assert.equal(both.includes(table), false, `${table} 를 참조한다`);
  }
});

/* ── 실행 모듈 경계(원문) ──────────────────────── */

const STORE = readFileSync(new URL("./inquiryChatCleanupStore.ts", import.meta.url), "utf8");
const STORE_CODE = STORE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("실행 모듈이 한도를 반드시 받는다", () => {
  // limit에 기본값을 숨겨 두지 않는다.
  assert.match(STORE_CODE, /now: string,\s*limit: number,\s*maxAttempts/);
  assert.match(STORE_CODE, /now: string,\s*limit: number,\s*\): Promise<ChatCleanupResult>/);
  assert.equal(/limit: number = /.test(STORE_CODE), false);
  // 한도·시각이 잘못되면 시작하지 않는다.
  assert.equal(STORE_CODE.match(/isValidCleanupLimit\(limit\)/g)?.length, 2);
  // 실행 둘 + 사전 확인 하나. 어느 경로도 시각을 스스로 만들지 않는다.
  assert.equal(STORE_CODE.match(/cleanupCutoff\(now\)/g)?.length, 3);
});

test("legacy 실행이 회차마다 다시 읽고 충돌만 재시도한다", () => {
  assert.match(STORE_CODE, /const data = await deps\.readData\(\);/);
  assert.match(STORE_CODE, /if \(deleted === 0\) return \{ ok: true, deleted: 0/);
  assert.match(STORE_CODE, /if \(!deps\.isConflict\(error\)\) throw error;/);
  assert.match(STORE_CODE, /data\.inquiries = previous;/);
  // inquiries 말고 다른 app_store 키를 건드리지 않는다.
  const assigned = [...STORE_CODE.matchAll(/data\.(\w+) =/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(assigned)], ["inquiries"]);
});

test("실행 모듈이 다른 기능을 끌어오지 않는다", () => {
  for (const forbidden of [
    "complaint",
    "refund",
    "payments",
    "consultation",
    "chat_inquiry_messages",
    "cron",
    "schedule",
  ]) {
    assert.equal(STORE_CODE.includes(forbidden), false, `${forbidden} 를 참조한다`);
  }
  // SQL은 규칙 모듈의 상수만 쓴다. 이 자리에서 문장을 만들지 않는다.
  assert.equal(/DELETE FROM|SELECT .* FROM/.test(STORE_CODE), false);
});

test("결과에 id·이름·본문이 담기지 않는다", () => {
  assert.match(STORE_CODE, /return \{ ok: true, deleted/);
  for (const forbidden of ["ids }", "rows }", "name", "phone", "message", "body"]) {
    assert.equal(STORE_CODE.includes(forbidden), false, `${forbidden} 가 결과에 있다`);
  }
});

/* ── 관리자 연결 경계(원문) ─────────────────────── */

const ADMIN_API = readFileSync(new URL("./cleanupExecuteAdminApi.ts", import.meta.url), "utf8");
const ADMIN_CODE = ADMIN_API.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const EXEC_ROUTE = readFileSync(
  new URL("../../app/api/admin/cleanup/route.ts", import.meta.url),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const PRE_ROUTE = readFileSync(
  new URL("../../app/api/admin/inquiries-chat-cleanup-preflight/route.ts", import.meta.url),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("새 action이 기존 목록에 더해졌고 한도가 1로 고정이다", () => {
  assert.match(ADMIN_CODE, /"expired-inquiries-chat",\n\] as const;/);
  assert.match(ADMIN_CODE, /export const INQUIRY_CHAT_CLEANUP_LIMIT = 1;/);
  // 본문의 limit이 정확히 그 값이 아니면 실행하지 않는다.
  assert.match(
    ADMIN_CODE,
    /action === "expired-inquiries-chat" && body\?\.limit !== INQUIRY_CHAT_CLEANUP_LIMIT/,
  );
  // 실행에 넘기는 한도도 같은 상수 하나뿐이다(양쪽 다).
  assert.equal(
    ADMIN_CODE.match(/\(now, INQUIRY_CHAT_CLEANUP_LIMIT\)/g)?.length,
    2,
    "legacy·chat 모두 상수 한도를 넘겨야 한다",
  );
  // retention 한도와 섞지 않는다.
  assert.equal(/cleanupExpiredInquiries\(now, RETENTION_LIMIT\)/.test(ADMIN_CODE), false);
});

test("같은 now를 두 정리에 그대로 넘긴다", () => {
  assert.match(ADMIN_CODE, /deps\.cleanupExpiredInquiries\(now, INQUIRY_CHAT_CLEANUP_LIMIT\)/);
  assert.match(ADMIN_CODE, /deps\.cleanupExpiredChats\(now, INQUIRY_CHAT_CLEANUP_LIMIT\)/);
  // 실행 자리에서 시각을 새로 만들지 않는다.
  assert.equal(/new Date\(\)/.test(ADMIN_CODE), false);
});

test("legacy가 실패하면 채팅을 실행하지 않고 그대로 적는다", () => {
  assert.match(ADMIN_CODE, /if \(!legacy\.ok\) \{/);
  assert.match(ADMIN_CODE, /chat: \{ ran: false, ok: false, deleted: 0 \}/);
  // 실패를 성공 건수로 바꾸지 않는다.
  assert.match(ADMIN_CODE, /legacy: \{ ran: true, ok: false, deleted: 0, attempts: legacy\.attempts, reason: legacy\.reason \}/);
  assert.match(ADMIN_CODE, /chat: chat\.ok\s*\?\s*\{ ran: true, ok: true, deleted: chat\.deleted \}\s*:\s*\{ ran: true, ok: false, deleted: 0, reason: chat\.reason \}/);
});

test("실행 route가 기존 관문과 기준 시각을 그대로 쓴다", () => {
  assert.match(EXEC_ROUTE, /const denied = await requireAdmin\(\);\s*if \(denied\) return denied;/);
  assert.match(EXEC_ROUTE, /cleanupExpiredInquiries: \(now, limit\) =>/);
  assert.match(EXEC_ROUTE, /cleanupExpiredChats: runExpiredChatCleanup,/);
  // route가 한도를 지어내지 않는다.
  assert.equal(/limit: 1|, 1\)/.test(EXEC_ROUTE), false);
});

test("preflight는 읽기만 한다", () => {
  assert.match(PRE_ROUTE, /const denied = await requireAdmin\(\);\s*if \(denied\) return denied;/);
  assert.match(PRE_ROUTE, /runInquiryChatCleanupPreflight\(\s*\{ readData: defaultInquiryCleanupDeps\(\)\.readData \},/);
  for (const forbidden of ["writeData", "DELETE", "UPDATE", "runExpiredChatCleanup", "runExpiredInquiryCleanup"]) {
    assert.equal(PRE_ROUTE.includes(forbidden), false, `preflight가 ${forbidden} 를 쓴다`);
  }
  // 응답은 건수와 시각뿐이다.
  assert.match(PRE_ROUTE, /expiredLegacyInquiries: result\.expiredLegacyInquiries/);
  assert.match(PRE_ROUTE, /expiredChatInquiries: result\.expiredChatInquiries/);
  // 돌려주는 키는 다섯 개뿐이다(건수·시각·cutoff·action).
  const responseBlock = PRE_ROUTE.slice(PRE_ROUTE.lastIndexOf("return NextResponse.json({"));
  const keys = [...responseBlock.matchAll(/^\s{4}(\w+):/gm)].map((match) => match[1]);
  assert.deepEqual(keys, [
    "action",
    "checkedAt",
    "cutoff",
    "expiredLegacyInquiries",
    "expiredChatInquiries",
  ]);
  // 결과에서 개인정보 필드를 읽는 곳이 없다.
  for (const forbidden of ["result.name", "result.phone", "result.body", "result.userId", "result.items"]) {
    assert.equal(PRE_ROUTE.includes(forbidden), false, `preflight가 ${forbidden} 를 읽는다`);
  }
});

test("만료 건수 질의가 삭제와 같은 조건을 쓴다", () => {
  assert.match(COUNT_EXPIRED_CHAT_SQL, /WHERE last_message_at < \$1::timestamptz/);
  assert.match(COUNT_EXPIRED_CHAT_SQL, /count\(\*\)::int AS expired/);
  for (const forbidden of ["status", "user_id", "guest_token_hash", "DELETE", "UPDATE"]) {
    assert.equal(COUNT_EXPIRED_CHAT_SQL.includes(forbidden), false, `${forbidden} 가 있다`);
  }
});

test("legacy 만료 건수는 읽을 수 없는 시각을 세지 않는다", () => {
  const items = [
    { id: "a", createdAt: OLD },
    { id: "b", createdAt: FRESH },
    { id: "c", createdAt: "" },
    { id: "d" },
    { id: "e", createdAt: "2026-02-30T00:00:00.000Z" },
    { id: "f", createdAt: daysBefore(NOW, -3) },
    { id: "g", createdAt: OLD },
  ];
  assert.equal(countExpiredInquiries(items, CUTOFF), 2);
  assert.equal(countExpiredInquiries(undefined, CUTOFF), 0);
  assert.equal(countExpiredInquiries([], CUTOFF), 0);
  // 세기만 하고 배열을 바꾸지 않는다.
  assert.equal(items.length, 7);
});

test("preflight 실행 경로가 쓰기 수단을 갖지 않는다", () => {
  const begin = STORE_CODE.indexOf("export async function runInquiryChatCleanupPreflight");
  assert.notEqual(begin, -1);
  const block = STORE_CODE.slice(begin);
  for (const forbidden of ["writeData", "DELETE_CHAT_BY_IDS_SQL", "SELECT_EXPIRED_CHAT_IDS_SQL"]) {
    assert.equal(block.includes(forbidden), false, `preflight가 ${forbidden} 를 쓴다`);
  }
  // 세지 못하면 0으로 적지 않는다.
  assert.match(block, /return \{ ok: false, reason: "count-failed" \};/);
});
