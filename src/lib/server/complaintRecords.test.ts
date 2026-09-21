/**
 * 불만 기록 저장 계층의 경계 테스트 (Privacy-Complaint-Implementation-2, Step 2).
 *
 * 실행: node --test src/lib/server/complaintRecords.test.ts
 *
 * complaintRecords.ts를 import하지 않는다. 그쪽은 DB 드라이버(@neondatabase/serverless)를
 * 불러오고, 함수마다 실제 연결을 요구한다. 대신 원문을 글자로 읽는다.
 * 경계가 무너지면 이 테스트가 먼저 깨진다(paymentRawPresenceSource.test.ts와 같은 방식).
 *
 * 값 규칙 자체는 complaintRecordRules.test.ts가 본다. 여기서는
 * "저장 계층이 그 규칙을 쓰는가", "스키마에 담지 말아야 할 것이 없는가",
 * "처리 완료가 조건부 UPDATE로 한 번만 되는가"를 본다.
 *
 * 실제 PostgreSQL 실행은 이번 단계에서 하지 않는다(실DB 접근 금지).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./complaintRecords.ts", import.meta.url), "utf8");

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** 문장 하나를 이름으로 잘라 온다(SQL 검사를 문장 단위로 하기 위해서다). */
function statement(marker: string): string {
  const begin = CODE.indexOf(marker);
  assert.notEqual(begin, -1, `${marker} 문장이 없다`);
  const end = CODE.indexOf("`", begin);
  return CODE.slice(begin, end === -1 ? undefined : end);
}

/* ── 마이그레이션 ───────────────────────────────── */

test("테이블과 인덱스를 IF NOT EXISTS로만 만든다", () => {
  assert.match(CODE, /CREATE TABLE IF NOT EXISTS complaint_records/);
  assert.match(CODE, /CREATE INDEX IF NOT EXISTS complaint_records_status_created_idx/);
  // 여러 번 실행해도 결과가 같아야 한다. 지우거나 바꾸는 DDL을 두지 않는다.
  for (const forbidden of [/\bDROP\b/, /\bTRUNCATE\b/, /ALTER TABLE complaint_records/]) {
    assert.equal(forbidden.test(CODE), false, `${forbidden} 가 있다`);
  }
});

test("인스턴스당 한 번만 실행하고 실패하면 기억을 지운다", () => {
  assert.match(CODE, /let complaintRecordsMigration: Promise<void> \| null = null;/);
  assert.match(CODE, /if \(!complaintRecordsMigration\)/);
  assert.match(CODE, /complaintRecordsMigration = null;\s*throw error;/);
});

test("store.ts의 ensureTable을 부르지 않는다", () => {
  // FK가 없어 다른 테이블을 먼저 만들 이유가 없다. 남의 DDL을 끌어오지 않는다.
  assert.equal(/ensureTable/.test(CODE), false);
  assert.match(CODE, /import \{ nowId, sqlClient \} from "@\/lib\/server\/store";/);
});

/* ── 스키마 ─────────────────────────────────────── */

test("컬럼이 정해진 열 개뿐이다", () => {
  const ddl = statement("CREATE TABLE IF NOT EXISTS complaint_records");
  const columns = [...ddl.matchAll(/^\s{8}(\w+) /gm)].map((match) => match[1]);
  assert.deepEqual(columns, [
    "id",
    "source_type",
    "category",
    "summary",
    "created_at",
    "status",
    "handled_at",
    "user_id",
    "order_id",
    "handled_by",
  ]);
});

test("nullable 경계가 설계대로다", () => {
  const ddl = statement("CREATE TABLE IF NOT EXISTS complaint_records");
  for (const notNull of ["source_type", "category", "summary", "created_at", "status"]) {
    assert.match(ddl, new RegExp(`${notNull} \\w+ NOT NULL`), `${notNull} 가 NOT NULL이 아니다`);
  }
  for (const nullable of ["handled_at", "user_id", "order_id", "handled_by"]) {
    assert.equal(
      new RegExp(`${nullable} \\w+ NOT NULL`).test(ddl),
      false,
      `${nullable} 가 NOT NULL이다`,
    );
  }
});

test("FK를 두지 않는다", () => {
  // 원본 문의·주문·회원이 사라져도 이 기록은 그대로 남아야 한다.
  assert.equal(/REFERENCES/.test(CODE), false);
  assert.equal(/ON DELETE/.test(CODE), false);
});

test("금지된 개인정보 필드가 저장 모델에 없다", () => {
  for (const forbidden of [
    "name",
    "phone",
    "guest_token",
    "guestToken",
    "source_id",
    "sourceId",
    "body",
    "message",
    "amount",
    "pg_tid",
    "raw",
  ]) {
    assert.equal(
      new RegExp(`\\b${forbidden}\\b`).test(CODE),
      false,
      `${forbidden} 가 저장 모델에 있다`,
    );
  }
});

/* ── 생성 ───────────────────────────────────────── */

test("값 규칙은 Step 1 순수 모듈을 그대로 쓴다", () => {
  assert.match(
    CODE,
    /import \{\s*normalizeComplaintSummary,\s*requireComplaintCategory,\s*requireComplaintSourceType,\s*requireComplaintTransition,\s*\} from "@\/lib\/server\/complaintRecordRules";/,
  );
  // 저장 계층이 분류·길이 규칙을 다시 정의하지 않는다.
  assert.equal(/500/.test(CODE), false);
  assert.equal(/"service"|"payment"|"delivery"|"privacy"/.test(CODE), false);
});

test("id·접수 시각·상태를 서버가 만든다", () => {
  const insert = statement("INSERT INTO complaint_records");
  // status 자리에 값이 아니라 'open' 리터럴이 박혀 있다. 호출부가 정할 수 없다.
  assert.match(insert, /VALUES \(\$1, \$2, \$3, \$4, \$5, 'open', \$6, \$7\)/);
  assert.match(CODE, /\[nowId\(\), sourceType, category, summary, new Date\(\)\.toISOString\(\), userId, orderId\]/);
  // handled_at·handled_by는 INSERT에 아예 없다(처리 완료 때만 생긴다).
  assert.equal(/handled_at/.test(insert), false);
  assert.equal(/handled_by/.test(insert), false);
});

test("입력 타입에 개인정보 자리가 없다", () => {
  const begin = CODE.indexOf("export interface CreateComplaintRecordInput");
  assert.notEqual(begin, -1, "입력 타입이 없다");
  const input = CODE.slice(begin, CODE.indexOf("\n}", begin));
  const fields = [...input.matchAll(/^\s{2}(\w+)\??:/gm)].map((match) => match[1]);
  assert.deepEqual(fields, ["sourceType", "category", "summary", "userId", "orderId"]);
});

test("빈 문자열 참조를 null로 모은다", () => {
  assert.match(CODE, /function optionalRef\(value: string \| null \| undefined\): string \| null/);
  assert.match(CODE, /const text = \(value \?\? ""\)\.trim\(\);\s*return text \? text : null;/);
  assert.match(CODE, /const userId = optionalRef\(input\.userId\);/);
  assert.match(CODE, /const orderId = optionalRef\(input\.orderId\);/);
});

/* ── 목록 ───────────────────────────────────────── */

test("목록은 읽기만 하고 최근 접수가 위로 온다", () => {
  const select = statement("SELECT ${COMPLAINT_RECORD_COLUMNS} FROM complaint_records ORDER BY");
  assert.match(select, /ORDER BY created_at DESC/);
  // 목록에 조건을 두지 않는다. 처리 완료 건도 관리자에게 보인다.
  assert.equal(/WHERE/.test(select), false);
});

/* ── 처리 완료(CAS) ─────────────────────────────── */

test("조건부 UPDATE로 open일 때만 바꾼다", () => {
  const update = statement("UPDATE complaint_records");
  assert.match(update, /WHERE id = \$1 AND status = 'open'/);
  assert.match(update, /RETURNING/);
  // 동시에 두 요청이 들어와도 두 번째는 0행을 받는다. 그때 성공으로 돌려주지 않는다.
  assert.match(CODE, /if \(rows\[0\]\) \{\s*return \{ ok: true, record: toComplaintRecord\(rows\[0\]\) \};/);
});

test("handled_at·handled_by를 덮어쓰지 않는다", () => {
  const update = statement("UPDATE complaint_records");
  assert.match(update, /handled_at = COALESCE\(handled_at, \$3::timestamptz\)/);
  assert.match(update, /handled_by = COALESCE\(handled_by, \$4\)/);
});

test("0행의 이유를 없는 기록과 이미 처리된 기록으로 가른다", () => {
  assert.match(CODE, /SELECT id FROM complaint_records WHERE id = \$1/);
  assert.match(
    CODE,
    /return found\[0\] \? \{ ok: false, reason: "already-handled" \} : \{ ok: false, reason: "not-found" \};/,
  );
  // 실패를 성공 모양으로 돌려주는 길이 없다.
  const successes = [...CODE.matchAll(/return \{ ok: true/g)];
  assert.equal(successes.length, 1);
});

test("전이는 순수 모듈이 판단하고, 처리자 없는 기록을 남기지 않는다", () => {
  assert.match(CODE, /requireComplaintTransition\("open", "handled"\)/);
  assert.match(CODE, /const handledBy = input\.handledBy\.trim\(\);\s*if \(!handledBy\) \{/);
});

test("handled 기록을 되돌리거나 증빙을 고치는 문장이 없다", () => {
  // 증빙 수정 API는 이번 단계에서 만들지 않는다. 그 문장 자체가 없어야 한다.
  assert.equal(/SET status = 'open'/.test(CODE), false);
  assert.equal(/SET category/.test(CODE), false);
  assert.equal(/SET summary/.test(CODE), false);
  assert.equal(/DELETE FROM complaint_records/.test(CODE), false);
  // UPDATE는 처리 완료 하나뿐이다.
  assert.equal(CODE.match(/UPDATE complaint_records/g)?.length, 1);
});

/* ── 환경 ───────────────────────────────────────── */

test("DATABASE_URL이 없으면 저장하지 않고 실패한다", () => {
  assert.match(CODE, /function complaintClient\(\)/);
  assert.match(CODE, /if \(!sql\) \{\s*throw new Error\(/);
});

test("이번 단계에서 다른 기능을 끌어오지 않는다", () => {
  for (const forbidden of ["refundRequests", "readData", "writeData", "next/server", "cleanup"]) {
    assert.equal(CODE.includes(forbidden), false, `${forbidden} 를 참조한다`);
  }
});
