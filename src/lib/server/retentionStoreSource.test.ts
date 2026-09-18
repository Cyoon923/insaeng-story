/**
 * 보관 만료 저장소 경계 테스트 (Privacy-Retention-Store-Split-1).
 *
 * 실행: node --test src/lib/server/retentionStoreSource.test.ts
 *
 * 지키려는 불변조건은 하나다.
 *   **관리자가 prepare-schema를 명시적으로 부르기 전에는, 어떤 일반 Production
 *     요청에서도 보관 만료 orders DDL이 실행되지 않는다.**
 *
 * 그 불변조건은 "누가 retentionStore를 import할 수 있는가"로 지켜진다. 정리 코드에
 * 닿는 Production 경로가 cleanup route 하나뿐이면, 다른 요청은 DDL에 닿을 길이 없다.
 *
 * 파일을 import하지 않는다. 그쪽은 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다. 경계가 무너지면 이 테스트가 먼저 깨진다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SRC = fileURLToPath(new URL("../..", import.meta.url));
const RETENTION_STORE = readFileSync(
  new URL("./retentionStore.ts", import.meta.url),
  "utf8",
);
const STORE = readFileSync(new URL("./store.ts", import.meta.url), "utf8");

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const RETENTION_CODE = stripComments(RETENTION_STORE);
const STORE_CODE = stripComments(STORE);

/** src 아래 모든 .ts/.tsx. 테스트 파일은 뺀다(배포에 들어가지 않는다). */
function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(name)) continue;
      if (/\.test\.tsx?$/.test(name)) continue;
      found.push(full);
    }
  };
  walk(SRC);
  return found;
}

/* ── ★ 불변조건 ─────────────────────────────────────── */

test("retentionStore를 쓰는 Production 코드가 cleanup route 하나뿐이다", () => {
  /*
   * 여기가 이 파일의 핵심이다. 일반 요청이 도달하는 어떤 파일도 retentionStore를
   * 가져오지 않으면, prepare-schema를 부르기 전에는 보관 만료 DDL이 실행될 수 없다.
   */
  const importers = sourceFiles().filter((file) =>
    /from "@\/lib\/server\/retentionStore"|from "\.\/retentionStore/.test(
      readFileSync(file, "utf8"),
    ),
  );
  assert.deepEqual(
    importers.map((file) => path.relative(SRC, file)),
    [path.join("app", "api", "admin", "cleanup", "route.ts")],
  );
});

test("store.ts는 retentionStore를 가져오지 않는다", () => {
  // 방향이 한쪽이어야 한다. 되가져오면 일반 주문·결제 경로가 정리 코드에 닿는다.
  assert.equal(/retentionStore/.test(STORE_CODE), false);
});

test("보관 만료 ALTER가 이 파일 밖에 없다", () => {
  /*
   * 예외를 두지 않는다. retentionStore 말고 어느 파일이든 이 열을 만들면
   * 일반 요청이 그 경로로 스키마를 바꾸게 되고, 불변조건이 깨진다.
   */
  const others = sourceFiles().filter(
    (file) =>
      !file.endsWith(path.join("server", "retentionStore.ts")) &&
      /ADD COLUMN IF NOT EXISTS retention_scrubbed_at/.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(
    others.map((file) => path.relative(SRC, file)),
    [],
    "retentionStore 밖에서 보관 만료 열을 만든다",
  );
});

test("정리 실행과 후보 찾기는 열을 만들지 않는다", () => {
  // 열을 만드는 자리는 ensureRetentionSchema 하나뿐이어야 한다.
  const callers = RETENTION_CODE.match(/ensureRetentionOrdersColumn\(sql\)/g) ?? [];
  assert.equal(callers.length, 1);

  const schema = RETENTION_CODE.slice(
    RETENTION_CODE.indexOf("export async function ensureRetentionSchema"),
  );
  assert.match(schema.slice(0, 400), /ensureRetentionOrdersColumn\(sql\)/);
});

test("더하는 열이 하나뿐이다", () => {
  const alters = RETENTION_STORE.match(/ADD COLUMN IF NOT EXISTS [\w ]+/g) ?? [];
  assert.deepEqual(alters, ["ADD COLUMN IF NOT EXISTS retention_scrubbed_at TIMESTAMPTZ"]);
});

/* ── 배포 closure ───────────────────────────────────── */

test("환불·적립금·결제조회에 의존하지 않는다", () => {
  for (const forbidden of [
    "refundRequests",
    "refundPayment",
    "refundExecution",
    "pointTransactions",
    "pointsRestore",
    "paymentLookup",
    "refundPaymentReconciliation",
    "consultationCancelWindow",
    "consents",
    "nicepay",
  ]) {
    assert.equal(RETENTION_CODE.includes(forbidden), false, forbidden);
  }
});

test("가져오는 것이 store의 primitive와 retention 순수 모듈뿐이다", () => {
  const froms = [...RETENTION_STORE.matchAll(/^import (?:type )?[\s\S]*?from "(.+)";$/gm)].map(
    (m) => m[1],
  );
  const allowed = new Set([
    "@/lib/server/store",
    "@/lib/server/retentionDiscovery",
    "@/lib/server/retentionScrub",
    "@/lib/server/retentionScrubPlan",
    "@/lib/server/retentionOrphanScrubPlan",
    "@/lib/server/retentionScrubRetry",
    "@/lib/server/retentionCleanupRunner",
    "@/lib/server/legacyCodesCleanup",
    "@/lib/types/app",
  ]);
  for (const from of froms) assert.equal(allowed.has(from), true, from);
});

/* ── CAS를 새로 만들지 않는다 ───────────────────────── */

test("app_store 저장 규약을 복제하지 않는다", () => {
  // 규약이 두 벌이 되면 한쪽만 고쳐졌을 때 저장소가 조용히 어긋난다.
  assert.equal(/WITH cas AS/.test(RETENTION_CODE), false, "CAS 문장을 직접 적고 있다");
  assert.equal(/version = version \+ 1|ON CONFLICT \(id\) DO NOTHING/.test(RETENTION_CODE), false);
  assert.equal(/NO_ROW_VERSION|__version/.test(RETENTION_CODE), false);
});

test("store가 내보낸 통로로만 CAS를 쓴다", () => {
  assert.match(STORE_CODE, /export const appStoreCas = \{/);
  for (const key of [
    "head: casHead",
    "params: casParams",
    "paramCount: casParamCount",
    "expectedVersion: expectedVersionOf",
    "advance: advanceVersion",
    "ensureVersionColumn: ensureAppStoreVersion",
  ]) {
    assert.equal(STORE_CODE.includes(key), true, key);
  }
  // 통로는 가리키기만 한다. 값을 새로 만들지 않는다.
  const block = STORE_CODE.slice(
    STORE_CODE.indexOf("export const appStoreCas = {"),
    STORE_CODE.indexOf("} as const;", STORE_CODE.indexOf("export const appStoreCas = {")),
  );
  assert.equal(/=>|function|`/.test(block), false, "통로 안에서 새 구현을 만들고 있다");
});

/* ── 결제 스냅샷 정리의 atomic 의미 ─────────────────── */

test("결제 스냅샷 정리가 같은 문장 안에서 함께 일어난다", () => {
  const scrub = RETENTION_CODE.slice(
    RETENTION_CODE.indexOf("export async function scrubOrderForRetentionOnce"),
    RETENTION_CODE.indexOf("export type OrphanScrubResult"),
  );
  // CAS가 성립했을 때만 orders·payments가 바뀐다(중간 상태가 생기지 않는다).
  assert.match(scrub, /\$\{appStoreCas\.head\(expected\)\},/);
  assert.match(scrub, /UPDATE orders/);
  assert.match(scrub, /UPDATE payments/);
  assert.match(scrub, /order_snapshot - 'details'/);
  const guards = scrub.match(/EXISTS \(SELECT 1 FROM cas\)/g) ?? [];
  assert.equal(guards.length, 2, "orders와 payments 둘 다 CAS에 묶여 있어야 한다");
  const queries = scrub.match(/sql\.query\(/g) ?? [];
  assert.equal(queries.length, 1, "한 문장이어야 한다");
});

test("원래 있던 결제 열만 쓴다", () => {
  // 취소 감사 열은 환불 기능의 것이다. 정리가 그 스키마를 끌고 오지 않는다.
  assert.equal(/ensurePaymentsMigration/.test(RETENTION_CODE), false);
  for (const column of [
    "cancel_attempted_at",
    "cancel_execution_status",
    "cancel_result_kind",
    "cancel_response_raw",
  ]) {
    assert.equal(RETENTION_CODE.includes(column), false, column);
  }
});
