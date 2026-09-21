/**
 * 과거 탈퇴 회원 후기 잔존 현황 테스트 (Privacy-Reviews-Legacy-Diagnostic-2).
 *
 * 실행: node --test src/lib/server/reviewLegacyAggregate.test.ts
 *
 * 보는 것은 둘이다.
 * 1) 보내는 문장이 읽기 전용이고, 세는 칸이 서로 겹치지 않으며, 개인정보 값을 고르지 않는가.
 * 2) 돌려받은 건수를 응답으로 옮기는 규칙이 맞는가(읽지 못한 값을 0으로 적지 않는가).
 *
 * 분류 자체는 SQL 안에서 일어난다. 이 테스트는 DB에 접속하지 않으므로
 * 분류 결과를 실제로 실행해 보지는 않고, 문장이 그 규칙을 담고 있는지를 글자로 본다.
 * Production 질의는 이 단계에서 보내지 않는다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  REVIEW_ANONYMIZED_NAME,
  REVIEW_LEGACY_AGGREGATE_SQL,
  readCount,
  runReviewLegacyAggregate,
  type ReviewLegacyAggregateBody,
} from "./reviewLegacyAggregate.ts";

/** 집계 결과 한 행. 드라이버가 주는 모양(snake_case)을 그대로 흉내 낸다. */
function row(values: Partial<Record<string, unknown>> = {}) {
  return {
    total_reviews: 10,
    no_user_id: 4,
    linked_unknown: 1,
    linked_active: 3,
    linked_withdrawn: 2,
    withdrawn_name_not_anonymized: 1,
    ...values,
  };
}

function deps(rows: readonly Record<string, unknown>[], databaseMode = true) {
  return {
    databaseMode: () => databaseMode,
    queryAggregate: async () => rows,
  };
}

const NOW = "2026-09-21T00:00:00.000Z";

/* ── 문장: 읽기 전용 ─────────────────────────────── */

test("보내는 문장이 읽기 전용이다", () => {
  // 쓰기·스키마 변경 낱말이 하나도 없어야 한다. 이 자리는 확인만 하는 자리다.
  const forbidden = [
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bDELETE\b/i,
    /\bMERGE\b/i,
    /\bTRUNCATE\b/i,
    /\bCREATE\b/i,
    /\bALTER\b/i,
    /\bDROP\b/i,
    /\bGRANT\b/i,
    /\bCOPY\b/i,
    /\bFOR\s+UPDATE\b/i,
    /\bLOCK\b/i,
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(REVIEW_LEGACY_AGGREGATE_SQL), false, `${pattern} 가 문장에 있다`);
  }
  assert.match(REVIEW_LEGACY_AGGREGATE_SQL, /^\s*WITH\b/);
});

test("읽는 것이 app_store 한 행뿐이다", () => {
  assert.match(REVIEW_LEGACY_AGGREGATE_SQL, /FROM app_store WHERE id = 1/);
  // 다른 테이블을 보지 않는다. payments·orders는 이 질문과 무관하다.
  assert.equal(/\bFROM\s+payments\b/i.test(REVIEW_LEGACY_AGGREGATE_SQL), false);
  assert.equal(/\bFROM\s+orders\b/i.test(REVIEW_LEGACY_AGGREGATE_SQL), false);
});

test("바깥에서 들어오는 값이 문장에 섞이지 않는다", () => {
  // 매개변수 자리가 없다. 호출부가 넘기는 값도 없다.
  assert.equal(/\$\d/.test(REVIEW_LEGACY_AGGREGATE_SQL), false);
  assert.equal(REVIEW_LEGACY_AGGREGATE_SQL.includes("${"), false);
});

/* ── 문장: 무엇을 세는가 ─────────────────────────── */

test("탈퇴 판정이 withdrawnAt 하나다", () => {
  assert.match(REVIEW_LEGACY_AGGREGATE_SQL, /NULLIF\(u\.value->>'withdrawnAt', ''\) IS NOT NULL/);
  // 이름·연락처로 탈퇴를 판정하지 않는다. 그것들은 부수 효과일 뿐이다.
  assert.equal(/u\.value->>'phone'/.test(REVIEW_LEGACY_AGGREGATE_SQL), false);
  assert.equal(/u\.value->>'name'/.test(REVIEW_LEGACY_AGGREGATE_SQL), false);
});

test("네 칸이 서로 겹치지 않는다", () => {
  // linked / known / withdrawn 세 참·거짓의 조합으로 정확히 넷을 만든다.
  assert.match(REVIEW_LEGACY_AGGREGATE_SQL, /FILTER \(WHERE NOT linked\)::int AS no_user_id/);
  assert.match(
    REVIEW_LEGACY_AGGREGATE_SQL,
    /FILTER \(WHERE linked AND NOT known\)::int AS linked_unknown/,
  );
  assert.match(
    REVIEW_LEGACY_AGGREGATE_SQL,
    /FILTER \(WHERE linked AND known AND NOT withdrawn\)::int AS linked_active/,
  );
  assert.match(
    REVIEW_LEGACY_AGGREGATE_SQL,
    /FILTER \(WHERE linked AND known AND withdrawn\)::int AS linked_withdrawn/,
  );
});

test("이름 미익명화는 탈퇴 연결분 안에서만 센다", () => {
  assert.match(
    REVIEW_LEGACY_AGGREGATE_SQL,
    /WHERE linked AND known AND withdrawn AND name_not_anonymized/,
  );
  assert.match(
    REVIEW_LEGACY_AGGREGATE_SQL,
    new RegExp(`r\\.value->>'name' IS DISTINCT FROM '${REVIEW_ANONYMIZED_NAME}'`),
  );
});

test("빈 배열과 값 없는 후기를 안전하게 다룬다", () => {
  // users·reviews가 없거나 배열이 아니어도 질의가 죽지 않는다.
  const guards = REVIEW_LEGACY_AGGREGATE_SQL.match(/jsonb_typeof\(src\.data->'\w+'\) = 'array'/g);
  assert.equal(guards?.length, 2);
  // 빈 문자열 userId는 "없음"으로 본다. 코드의 truthy 판정과 같은 경계다.
  assert.match(REVIEW_LEGACY_AGGREGATE_SQL, /NULLIF\(r\.value->>'userId', ''\) AS user_id/);
  // 같은 id가 두 번 있어도 후기 건수가 부풀지 않게 회원을 id로 묶는다.
  assert.match(REVIEW_LEGACY_AGGREGATE_SQL, /GROUP BY u\.value->>'id'/);
});

test("개인정보 값을 고르지 않는다", () => {
  // 마지막 SELECT 목록에는 count만 있다. 값이 나갈 자리가 없다.
  const finalSelect = REVIEW_LEGACY_AGGREGATE_SQL.slice(
    REVIEW_LEGACY_AGGREGATE_SQL.lastIndexOf("SELECT"),
  );
  // JSONB에서 값을 꺼내는 연산이 하나도 없다. 꺼내지 않으면 내보낼 수도 없다.
  assert.equal(finalSelect.includes("->"), false);
  // 내보내는 칸은 정해 둔 여섯 개뿐이고, 전부 count에서 나온다.
  const aliases = [...finalSelect.matchAll(/AS (\w+)/g)].map((match) => match[1]);
  assert.deepEqual(aliases.sort(), [
    "linked_active",
    "linked_unknown",
    "linked_withdrawn",
    "no_user_id",
    "total_reviews",
    "withdrawn_name_not_anonymized",
  ]);
  assert.equal(finalSelect.match(/count\(\*\)/g)?.length, aliases.length);
  // 후기 본문·대상은 문장 어디에도 없다.
  assert.equal(REVIEW_LEGACY_AGGREGATE_SQL.includes("'text'"), false);
  assert.equal(REVIEW_LEGACY_AGGREGATE_SQL.includes("'targetKey'"), false);
});

/* ── 복사본 어긋남 ───────────────────────────────── */

test("test.sql의 문장이 이 상수와 같다", () => {
  /*
   * reviewLegacyAggregate.test.sql은 실제 PostgreSQL에서 분류 결과를 본다.
   * 그러려면 같은 문장을 파일에 옮겨 적어야 하는데, 옮긴 뒤 한쪽만 고치면
   * 검증이 다른 문장을 보게 된다. 표식 사이를 잘라 글자로 맞춰 둔다.
   */
  const source = readFileSync(new URL("./reviewLegacyAggregate.test.sql", import.meta.url), "utf8");
  const begin = source.indexOf(">>> REVIEW_LEGACY_AGGREGATE_SQL >>>");
  const end = source.indexOf("<<< REVIEW_LEGACY_AGGREGATE_SQL <<<");
  assert.notEqual(begin, -1, "test.sql에 시작 표식이 없다");
  assert.notEqual(end, -1, "test.sql에 끝 표식이 없다");
  const copied = source
    .slice(source.indexOf("\n", begin) + 1, source.lastIndexOf("\n", end))
    .trim();
  assert.equal(copied, REVIEW_LEGACY_AGGREGATE_SQL.trim());
});

/* ── 실행: 건수 읽기 ─────────────────────────────── */

test("여섯 칸을 그대로 옮긴다", async () => {
  const response = await runReviewLegacyAggregate(deps([row()]), NOW);
  assert.equal(response.status, 200);
  const body = response.body as ReviewLegacyAggregateBody;
  assert.deepEqual(body, {
    action: "review-legacy-aggregate",
    checkedAt: NOW,
    databaseMode: true,
    totalReviews: 10,
    linkedActive: 3,
    linkedWithdrawn: 2,
    linkedUnknown: 1,
    noUserId: 4,
    withdrawnNameNotAnonymized: 1,
  });
});

test("0건도 그대로 0으로 적는다", async () => {
  const zero = row({
    total_reviews: 0,
    no_user_id: 0,
    linked_unknown: 0,
    linked_active: 0,
    linked_withdrawn: 0,
    withdrawn_name_not_anonymized: 0,
  });
  const response = await runReviewLegacyAggregate(deps([zero]), NOW);
  assert.equal(response.status, 200);
  assert.equal((response.body as ReviewLegacyAggregateBody).totalReviews, 0);
});

test("드라이버가 문자열로 줘도 읽는다", async () => {
  const response = await runReviewLegacyAggregate(deps([row({ linked_withdrawn: "7" })]), NOW);
  assert.equal((response.body as ReviewLegacyAggregateBody).linkedWithdrawn, 7);
});

test("응답 본문에 개인정보 값이 담기지 않는다", async () => {
  const withExtra = { ...row(), name: "김채영", user_id: "u-1", text: "후기 본문" };
  const response = await runReviewLegacyAggregate(deps([withExtra]), NOW);
  const body = response.body as ReviewLegacyAggregateBody;
  assert.deepEqual(Object.keys(body).sort(), [
    "action",
    "checkedAt",
    "databaseMode",
    "linkedActive",
    "linkedUnknown",
    "linkedWithdrawn",
    "noUserId",
    "totalReviews",
    "withdrawnNameNotAnonymized",
  ]);
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("김채영"), false);
  assert.equal(serialized.includes("u-1"), false);
  assert.equal(serialized.includes("후기 본문"), false);
});

/* ── 실행: 셀 수 없을 때 ─────────────────────────── */

test("DB 모드가 아니면 질의를 보내지 않는다", async () => {
  let sent = 0;
  const response = await runReviewLegacyAggregate(
    {
      databaseMode: () => false,
      queryAggregate: async () => {
        sent += 1;
        return [row()];
      },
    },
    NOW,
  );
  assert.equal(sent, 0);
  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "DATABASE_MODE_REQUIRED",
    message: "데이터베이스 모드에서만 확인할 수 있습니다.",
    checkedAt: NOW,
    databaseMode: false,
  });
});

test("행이 없으면 0건으로 적지 않는다", async () => {
  const response = await runReviewLegacyAggregate(deps([]), NOW);
  assert.equal(response.status, 500);
  assert.equal(
    (response.body as { error: string }).error,
    "AGGREGATE_FAILED",
    "행이 없는 것을 0건으로 옮기면 안 된다",
  );
});

test("한 칸이라도 읽지 못하면 전부 실패로 다룬다", async () => {
  const response = await runReviewLegacyAggregate(deps([row({ linked_active: null })]), NOW);
  assert.equal(response.status, 500);
  assert.equal((response.body as { error: string }).error, "AGGREGATE_FAILED");
});

test("받은 오류를 밖으로 내보내지 않는다", async () => {
  const secret = "postgres://user:password@host/db";
  const response = await runReviewLegacyAggregate(
    {
      databaseMode: () => true,
      queryAggregate: async () => {
        throw new Error(secret);
      },
    },
    NOW,
  );
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(response.body).includes(secret), false);
  assert.deepEqual(response.body, {
    error: "AGGREGATE_FAILED",
    message: "후기 현황을 확인하지 못했습니다.",
    checkedAt: NOW,
    databaseMode: true,
  });
});

test("읽지 못한 값과 0을 구분한다", () => {
  assert.equal(readCount(0), 0);
  assert.equal(readCount("0"), 0);
  assert.equal(readCount(-1), null);
  assert.equal(readCount(1.5), null);
  assert.equal(readCount(""), null);
  assert.equal(readCount(null), null);
  assert.equal(readCount(undefined), null);
  assert.equal(readCount({}), null);
});
