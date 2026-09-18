/**
 * 정리 실행 route의 경계 테스트 (Privacy-Cleanup-Execution-API-1).
 *
 * 실행: node --test src/lib/server/cleanupExecuteRouteSource.test.ts
 *
 * 규칙 자체는 cleanupExecuteAdminApi.test.ts가 본다. 여기서는 이 경로가
 * **무엇을 이어 붙였고 무엇을 하지 않는지**만 본다.
 *
 * route를 import하지 않는다. 그쪽은 next/server와 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 경계가 무너지면 이 테스트가 먼저 깨진다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ROUTE = readFileSync(
  new URL("../../app/api/admin/cleanup/route.ts", import.meta.url),
  "utf8",
);
const MODULE = readFileSync(new URL("./cleanupExecuteAdminApi.ts", import.meta.url), "utf8");

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
  assert.match(ROUTE_CODE, /import \{ readJsonBody, requireAdmin \} from "@\/lib\/server\/chatInquiryApi";/);
  assert.match(ROUTE_CODE, /const denied = await requireAdmin\(\);\s*if \(denied\) return denied;/);
});

test("새 관리자 인증을 만들지 않는다", () => {
  for (const [name, code] of BOTH) {
    assert.equal(
      /cookies\(|createHmac|scrypt|ADMIN_PASSWORD|setAdminAuthenticated|isAdminAuthenticated/.test(
        code,
      ),
      false,
      name,
    );
  }
});

test("관리자 확인이 다른 무엇보다 먼저다", () => {
  // import 줄은 세지 않는다. POST 본문 안에서의 차례를 본다.
  const body = ROUTE_CODE.slice(ROUTE_CODE.indexOf("export async function POST"));
  const guard = body.indexOf("requireAdmin()");
  const now = body.indexOf("new Date()");
  const read = body.indexOf("readJsonBody(");
  const run = body.indexOf("runCleanupExecute(");

  assert.notEqual(guard, -1);
  assert.ok(guard < now, "관리자 확인보다 기준 시각을 먼저 만든다");
  assert.ok(guard < read, "관리자 확인보다 본문을 먼저 읽는다");
  assert.ok(guard < run, "관리자 확인보다 실행을 먼저 한다");
});

/* ── 한 번에 하나만 ─────────────────────────────────── */

test("여러 정리를 한꺼번에 돌리지 않는다", () => {
  for (const [name, code] of BOTH) {
    assert.equal(/Promise\.all|Promise\.allSettled|Promise\.race/.test(code), false, name);
  }
});

test("스스로 되풀이해 도는 구조가 아니다", () => {
  for (const [name, code] of BOTH) {
    assert.equal(/setInterval|setTimeout|while \(true\)|cron/i.test(code), false, name);
  }
});

test("route가 실행을 한 번만 부른다", () => {
  const calls = ROUTE_CODE.match(/runCleanupExecute\(/g) ?? [];
  assert.equal(calls.length, 1);
});

/* ── 저장소에 직접 닿지 않는다 ──────────────────────── */

test("접속 문자열을 직접 보지 않는다", () => {
  for (const [name, code] of BOTH) {
    assert.equal(/DATABASE_URL|process\.env|neon\(/.test(code), false, name);
  }
});

test("SQL을 직접 쓰지 않는다", () => {
  for (const [name, code] of BOTH) {
    assert.equal(/sql\.query|sql\.transaction|readData|writeData/.test(code), false, name);
    assert.equal(
      /SELECT |INSERT |UPDATE |DELETE FROM|DROP |ALTER TABLE|CREATE TABLE|ADD COLUMN/i.test(code),
      false,
      name,
    );
  }
});

test("규칙 모듈은 저장소를 아는 파일을 참조하지 않는다", () => {
  // 타입만 빌려 온다. 값을 가져오면 이 모듈이 DB 드라이버를 끌고 들어온다.
  const imports = [...MODULE.matchAll(/^import (type )?.*from "(.+)";$/gm)];
  for (const [line, isType, from] of imports) {
    assert.equal(isType, "type ", `값을 가져오고 있다: ${line}`);
    assert.equal(/store|verificationCodes|next\//.test(from), false, line);
  }
});

/* ── 실제 실행 함수를 그대로 이어 붙인다 ────────────── */

test("retention 함수는 retentionStore에서 가져온다", () => {
  // store.ts에서 가져오면 주문·결제·회원 경로가 통째로 배포 범위에 들어온다.
  assert.match(
    ROUTE_CODE,
    /import \{\s*cleanupLegacyVerificationCodes,\s*ensureRetentionSchema,\s*runRetentionCleanupOnce,\s*\} from "@\/lib\/server\/retentionStore";/,
  );
  assert.match(ROUTE_CODE, /import \{ sqlClient \} from "@\/lib\/server\/store";/);
});

test("기존 실행 함수 넷을 그대로 넘긴다", () => {
  assert.match(ROUTE_CODE, /databaseMode: \(\) => sqlClient\(\) !== null,/);
  assert.match(ROUTE_CODE, /prepareSchema: ensureRetentionSchema,/);
  assert.match(ROUTE_CODE, /runRetention: runRetentionCleanupOnce,/);
  assert.match(ROUTE_CODE, /cleanupLegacyCodes: cleanupLegacyVerificationCodes,/);
  assert.match(ROUTE_CODE, /deleteExpiredVerifications,/);
});

test("route가 판단을 하지 않는다", () => {
  // action·확인 문구·한도·사유를 route가 다시 해석하면 규칙이 두 벌이 된다.
  for (const forbidden of [
    "CLEANUP_ACTIONS",
    "RETENTION_LIMIT",
    "confirm",
    "prepare-schema",
    "legacy-codes",
    "expired-verifications",
    "discoveryFailed",
  ]) {
    assert.equal(ROUTE_CODE.includes(forbidden), false, forbidden);
  }
});

test("기준 시각을 한 번만 만든다", () => {
  const made = ROUTE_CODE.match(/new Date\(\)/g) ?? [];
  assert.equal(made.length, 1);
  assert.match(ROUTE_CODE, /const now = new Date\(\)\.toISOString\(\);/);
});

/* ── 응답에 담기는 것 ──────────────────────────────── */

test("route는 건별 결과를 아예 다루지 않는다", () => {
  assert.equal(/results/.test(ROUTE_CODE), false);
});

test("응답 모양에 건별 결과도 id도 kind도 없다", () => {
  /*
   * 규칙 모듈은 사유를 세려고 results를 읽는다. 읽는 것까지는 괜찮다.
   * 담으면 안 된다. 그래서 응답 모양 쪽만 본다.
   */
  const bodyShape = MODULE_CODE.slice(
    MODULE_CODE.indexOf("export interface RetentionBody"),
    MODULE_CODE.indexOf("export interface LegacyCodesBody"),
  );
  assert.notEqual(bodyShape, "");
  assert.equal(/\bresults\b|\bid\b|\bkind\b|\boutcome\b/.test(bodyShape), false);
  // 사유는 세어서 건수만 담는다.
  assert.match(MODULE_CODE, /reasons: countRetentionReasons\(summary\.results\),/);
});

test("응답 본문은 규칙 모듈이 만든 것을 그대로 보낸다", () => {
  assert.match(ROUTE_CODE, /NextResponse\.json\(response\.body, \{ status: response\.status \}\)/);
  // route가 값을 덧붙이지 않는다.
  assert.equal(/\.\.\.response\.body|Object\.assign/.test(ROUTE_CODE), false);
});

test("기록에 개인정보나 받은 오류를 남기지 않는다", () => {
  assert.equal(/console\./.test(ROUTE_CODE), false, "route는 아무것도 남기지 않는다");

  const warnings = MODULE_CODE.match(/console\.\w+\(.*\);/g) ?? [];
  assert.equal(warnings.length, 1);
  // 남기는 값은 action 하나뿐이고, 그 값은 정해 둔 넷 중 하나다.
  assert.equal(warnings[0], "console.warn(`[cleanup] execution failed (${action})`);");
  assert.equal(/\$\{error\}|error\.message|String\(error\)/.test(MODULE_CODE), false);
});

test("받은 오류를 잡기만 하고 담지 않는다", () => {
  assert.match(MODULE_CODE, /\} catch \{/);
  assert.equal(/catch \(/.test(MODULE_CODE), false);
});
