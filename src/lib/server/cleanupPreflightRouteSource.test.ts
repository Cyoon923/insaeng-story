/**
 * 정리 사전 확인 route의 경계 테스트 (Privacy-Cleanup-Preflight-3).
 *
 * 실행: node --test src/lib/server/cleanupPreflightRouteSource.test.ts
 *
 * 규칙 자체는 cleanupPreflightAdminApi.test.ts가 본다. 여기서는 이 경로가
 * **저장소에 닿지 않는다**는 것과 관리자 경계만 본다.
 *
 * route를 import하지 않는다. 그쪽은 next/server와 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 경계가 무너지면 이 테스트가 먼저 깨진다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ROUTE = readFileSync(
  new URL("../../app/api/admin/cleanup-preflight/route.ts", import.meta.url),
  "utf8",
);
const MODULE = readFileSync(new URL("./cleanupPreflightAdminApi.ts", import.meta.url), "utf8");

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const ROUTE_CODE = stripComments(ROUTE);
const MODULE_CODE = stripComments(MODULE);
const BOTH = [
  ["route", ROUTE_CODE],
  ["module", MODULE_CODE],
] as const;

/* ── 실행 환경 ──────────────────────────────────────── */

test("nodejs 런타임과 force-dynamic을 고정한다", () => {
  assert.match(ROUTE_CODE, /export const runtime = "nodejs";/);
  assert.match(ROUTE_CODE, /export const dynamic = "force-dynamic";/);
});

/* ── POST only ──────────────────────────────────────── */

test("POST만 내보낸다", () => {
  const handlers = [...ROUTE_CODE.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(handlers, ["POST"]);
});

test("다른 메서드 처리기를 두지 않는다", () => {
  for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
    assert.equal(
      new RegExp(`export (async function|const) ${method}\\b`).test(ROUTE_CODE),
      false,
      `${method}가 열려 있다`,
    );
  }
});

/* ── 관리자 확인 ────────────────────────────────────── */

test("기존 requireAdmin을 그대로 쓴다", () => {
  assert.match(ROUTE_CODE, /import \{ requireAdmin \} from "@\/lib\/server\/chatInquiryApi";/);
  assert.match(ROUTE_CODE, /const denied = await requireAdmin\(\);\s*if \(denied\) return denied;/);
});

test("새 관리자 인증을 만들지 않는다", () => {
  assert.equal(
    /cookies\(|createHmac|ADMIN_PASSWORD|setAdminAuthenticated|isAdminAuthenticated/.test(
      ROUTE_CODE,
    ),
    false,
  );
});

test("관리자 확인이 다른 무엇보다 먼저다", () => {
  // import 줄은 세지 않는다. POST 본문 안에서의 차례를 본다.
  const body = ROUTE_CODE.slice(ROUTE_CODE.indexOf("export async function POST"));
  const guard = body.indexOf("requireAdmin()");
  const now = body.indexOf("new Date()");
  const check = body.indexOf("runCleanupPreflight(");
  assert.notEqual(guard, -1);
  assert.ok(guard < now, "관리자 확인보다 기준 시각을 먼저 만든다");
  assert.ok(guard < check, "관리자 확인보다 확인을 먼저 한다");
});

/* ── 기준 시각 ──────────────────────────────────────── */

test("기준 시각을 한 번만 만들어 넘긴다", () => {
  assert.equal([...ROUTE_CODE.matchAll(/new Date\(\)/g)].length, 1);
  assert.match(ROUTE_CODE, /const now = new Date\(\)\.toISOString\(\);/);
  assert.match(ROUTE_CODE, /\n\s*now,\n/);
});

/* ── 저장소에 닿지 않는다 ──────────────────────────── */

test("store에서 sqlClient 하나만 들여온다", () => {
  const imported = ROUTE_CODE.match(/import \{([^}]*)\} from "@\/lib\/server\/store";/);
  assert.notEqual(imported, null, "store import를 찾지 못했다");
  const names = imported![1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  assert.deepEqual(names, ["sqlClient"]);
});

test("순수 모듈은 저장소를 아는 파일을 들여오지 않는다", () => {
  assert.equal(/from "[^"]*store[^"]*"/.test(MODULE_CODE), false);
  assert.equal(/from "@\//.test(MODULE_CODE), false);
});

test("저장소를 준비하거나 읽는 함수를 부르지 않는다", () => {
  const forbidden = [
    "findRetentionScrubCandidates",
    "readData",
    "ensureTable",
    "ensureAppStoreVersion",
    "ensureOrdersMigration",
    "runOrdersMigration",
    "runRetentionCleanupOnce",
    "deleteExpiredVerifications",
    "cleanupLegacyVerificationCodes",
    "writeData",
  ];
  for (const [where, source] of BOTH) {
    for (const name of forbidden) {
      assert.equal(source.includes(name), false, `${where}에 ${name}이 있다`);
    }
  }
});

test("바꾸는 SQL이 없다", () => {
  const forbidden = ["INSERT", "UPDATE", "DELETE", "ALTER", "CREATE", "DROP", "TRUNCATE"];
  for (const [where, source] of BOTH) {
    for (const word of forbidden) {
      assert.equal(
        new RegExp(`\\b${word}\\b`).test(source),
        false,
        `${where}에 ${word}가 있다`,
      );
    }
  }
});

test("SQL을 직접 보내지 않는다", () => {
  for (const [where, source] of BOTH) {
    assert.equal(
      /sql\.query|sql\.transaction|sql`|SELECT /.test(source),
      false,
      `${where}가 쿼리를 보낸다`,
    );
  }
});

test("DB 모드는 클라이언트를 만들 수 있는지로만 판단한다", () => {
  assert.match(ROUTE_CODE, /databaseMode: \(\) => sqlClient\(\) !== null,/);
  // sqlClient의 결과로 다른 일을 하지 않는다. 부르는 곳이 이 한 줄뿐이다.
  assert.equal([...ROUTE_CODE.matchAll(/sqlClient\(\)/g)].length, 1);
});

/* ── 내보내지 않는 것 ──────────────────────────────── */

test("접속 정보를 만지지 않는다", () => {
  for (const [where, source] of BOTH) {
    assert.equal(
      /DATABASE_URL|process\.env|connectionString/.test(source),
      false,
      `${where}가 접속 정보를 만진다`,
    );
  }
});

test("기록을 남기지 않는다", () => {
  for (const [where, source] of BOTH) {
    assert.equal(/console\./.test(source), false, `${where}에 기록이 남는다`);
  }
});

test("후보 건수 경로가 되살아나지 않았다", () => {
  for (const [where, source] of BOTH) {
    assert.equal(
      /candidateCount|findCandidates|RetentionCandidate|discoveryOk/.test(source),
      false,
      `${where}에 후보 경로가 있다`,
    );
  }
});
