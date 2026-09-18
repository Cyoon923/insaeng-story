/**
 * 결제 복구 현황 경로의 경계 테스트 (Privacy-Payment-Recovery-Aggregate-1).
 *
 * 실행: node --test src/lib/server/paymentRecoveryAggregateSource.test.ts
 *
 * 규칙 자체는 paymentRecoveryAggregate.test.ts가 본다. 여기서는 이 경로가
 * **저장소를 바꾸지 않는다**는 것과 관리자 경계, 그리고 이 경로가 다른 요청에
 * 끼어들지 않는다는 것만 본다.
 *
 * route를 import하지 않는다. 그쪽은 next/server와 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 경계가 무너지면 이 테스트가 먼저 깨진다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";

const ROUTE_PATH = "../../app/api/admin/payments/recovery-aggregate/route.ts";
const ROUTE = readFileSync(new URL(ROUTE_PATH, import.meta.url), "utf8");
const MODULE = readFileSync(new URL("./paymentRecoveryAggregate.ts", import.meta.url), "utf8");

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

test("관리자 확인이 DB 접근보다 먼저다", () => {
  const body = ROUTE_CODE.slice(ROUTE_CODE.indexOf("export async function POST"));
  const guard = body.indexOf("requireAdmin()");
  const now = body.indexOf("new Date()");
  const client = body.indexOf("sqlClient()");
  const run = body.indexOf("runPaymentRecoveryAggregate(");
  assert.notEqual(guard, -1);
  assert.ok(guard < now, "관리자 확인보다 기준 시각을 먼저 만든다");
  assert.ok(guard < client, "관리자 확인보다 저장소에 먼저 닿는다");
  assert.ok(guard < run, "관리자 확인보다 집계를 먼저 한다");
});

/* ── 기준 시각 ──────────────────────────────────────── */

test("기준 시각을 한 번만 만들어 넘긴다", () => {
  assert.equal([...ROUTE_CODE.matchAll(/new Date\(\)/g)].length, 1);
  assert.match(ROUTE_CODE, /const now = new Date\(\)\.toISOString\(\);/);
});

/* ── 저장소 경계 ────────────────────────────────────── */

test("store에서 sqlClient 하나만 들여온다", () => {
  const imported = ROUTE_CODE.match(/import \{([^}]*)\} from "@\/lib\/server\/store";/);
  assert.notEqual(imported, null, "store import를 찾지 못했다");
  const names = imported![1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  assert.deepEqual(names, ["sqlClient"]);
});

test("순수 모듈은 아무것도 들여오지 않는다", () => {
  assert.equal(/^\s*import\b/m.test(MODULE_CODE), false);
});

test("스키마를 준비하는 함수를 부르지 않는다", () => {
  const forbidden = [
    "ensureTable",
    "ensurePaymentsMigration",
    "ensureRetentionSchema",
    "ensureOrdersMigration",
    "ensureVersionColumn",
    "runPaymentsMigration",
    "writeData",
    "readData",
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
      assert.equal(new RegExp(`\\b${word}\\b`).test(source), false, `${where}에 ${word}가 있다`);
    }
  }
});

test("route에는 SQL이 없고 모듈의 상수만 보낸다", () => {
  assert.equal(/\bSELECT\b/.test(ROUTE_CODE), false, "route가 질의문을 들고 있다");
  assert.match(ROUTE_CODE, /sql\.query\(PAYMENT_RECOVERY_AGGREGATE_SQL\)/);
  assert.equal([...ROUTE_CODE.matchAll(/sql\.query\(/g)].length, 1);
  assert.equal(/sql\.transaction/.test(ROUTE_CODE), false);
});

/* ── 내보내지 않는 것 ──────────────────────────────── */

test("식별자 컬럼이 어디에도 조회되지 않는다", () => {
  const selectList = MODULE_CODE.slice(
    MODULE_CODE.indexOf("SELECT"),
    MODULE_CODE.indexOf("FROM payments"),
  );
  for (const column of [
    "merchant_order_id",
    "pg_tid",
    "order_snapshot",
    "cancel_response_raw",
    "user_id",
  ]) {
    assert.equal(selectList.includes(column), false, `${column}을 고르고 있다`);
  }
  assert.equal(/\braw\b/.test(selectList), false, "raw를 고르고 있다");
});

test("응답 타입에 배열이나 자유 키가 없다", () => {
  const bodyType = MODULE_CODE.slice(
    MODULE_CODE.indexOf("interface PaymentRecoveryAggregateBody"),
    MODULE_CODE.indexOf("export const PAYMENT_RECOVERY_AGGREGATE_ERRORS"),
  );
  assert.equal(/\[\]/.test(bodyType), false, "배열이 있다");
  assert.equal(/Record</.test(bodyType), false, "자유 키가 있다");
  assert.equal(/\[key:/.test(bodyType), false, "인덱스 시그니처가 있다");
});

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

test("받은 오류를 응답에 담지 않는다", () => {
  assert.match(MODULE_CODE, /\}\s*catch\s*\{/);
  assert.equal(/catch\s*\(/.test(MODULE_CODE), false, "오류 값을 붙잡고 있다");
});

/* ── 다른 요청에 끼어들지 않는다 ──────────────────── */

test("이 모듈을 쓰는 Production 파일은 전용 route 하나뿐이다", () => {
  const roots = [new URL("../../app/", import.meta.url), new URL("../", import.meta.url)];
  const hits: string[] = [];
  const walk = (dir: URL) => {
    for (const entry of readdirSync(dir)) {
      const child = new URL(`${entry}${entry.includes(".") ? "" : "/"}`, dir);
      if (statSync(child).isDirectory()) {
        walk(child);
        continue;
      }
      if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
      if (entry.includes(".test.")) continue;
      const text = readFileSync(child, "utf8");
      if (text.includes("paymentRecoveryAggregate")) hits.push(child.pathname);
    }
  };
  for (const root of roots) walk(root);
  const importers = hits.filter((path) => !path.endsWith("paymentRecoveryAggregate.ts"));
  assert.deepEqual(
    importers.map((path) => path.slice(path.indexOf("/src/"))),
    ["/src/app/api/admin/payments/recovery-aggregate/route.ts"],
  );
});
