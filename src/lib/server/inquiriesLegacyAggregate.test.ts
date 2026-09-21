/**
 * 문의 잔존 현황 테스트 (Privacy-Inquiries-Chat-Diagnostic-2).
 *
 * 실행: node --test src/lib/server/inquiriesLegacyAggregate.test.ts
 *
 * 보는 것은 둘이다.
 * 1) 보내는 문장이 읽기 전용이고, 세는 칸이 서로 겹치지 않으며, 개인정보 값을 고르지 않는가.
 * 2) 돌려받은 건수를 응답으로 옮기는 규칙이 맞는가(읽지 못한 값을 0으로 적지 않는가).
 *
 * 분류 자체는 SQL 안에서 일어난다. 이 테스트는 DB에 접속하지 않으므로 분류 결과를
 * 실제로 실행해 보지는 않고, 문장이 그 규칙을 담고 있는지를 글자로 본다.
 * 실제 분류는 inquiriesLegacyAggregate.test.sql이 임시 PostgreSQL에서 본다.
 * Production 질의는 어느 단계에서도 보내지 않는다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  CHAT_INQUIRIES_AGGREGATE_SQL,
  CHAT_TABLES_PRESENT_SQL,
  INQUIRY_ANONYMIZED_NAME,
  LEGACY_INQUIRIES_AGGREGATE_SQL,
  readBoolean,
  readCount,
  runInquiriesLegacyAggregate,
  type InquiriesLegacyAggregateBody,
} from "./inquiriesLegacyAggregate.ts";

const ALL_SQL = [
  CHAT_TABLES_PRESENT_SQL,
  LEGACY_INQUIRIES_AGGREGATE_SQL,
  CHAT_INQUIRIES_AGGREGATE_SQL,
];

const NOW = "2026-09-21T00:00:00.000Z";

/** 집계 결과 한 행. 드라이버가 주는 모양(snake_case)을 그대로 흉내 낸다. */
function legacyRow(values: Record<string, unknown> = {}) {
  return {
    total: 10,
    member_linked_active: 3,
    member_linked_withdrawn: 2,
    member_linked_unknown: 1,
    guest_no_user_id: 4,
    withdrawn_name_not_anonymized: 1,
    withdrawn_phone_not_cleared: 1,
    withdrawn_message_present: 2,
    withdrawn_user_id_present: 2,
    guest_name_present: 4,
    guest_phone_present: 4,
    guest_message_present: 3,
    ...values,
  };
}

function chatRow(values: Record<string, unknown> = {}) {
  return {
    total: 7,
    member_linked_active: 2,
    member_linked_withdrawn: 2,
    member_linked_unknown: 1,
    guest_with_token: 1,
    unlinked_no_user_no_guest_token: 1,
    withdrawn_name_not_anonymized: 1,
    withdrawn_phone_not_cleared: 0,
    withdrawn_user_id_present: 2,
    guest_name_present: 1,
    guest_phone_present: 1,
    total_messages: 9,
    messages_for_active_member_inquiry: 3,
    messages_for_withdrawn_member_inquiry: 3,
    messages_for_unknown_member_inquiry: 1,
    messages_for_guest_inquiry: 1,
    messages_for_unlinked_inquiry: 1,
    orphan_messages: 0,
    withdrawn_message_body_present: 3,
    guest_message_body_present: 1,
    ...values,
  };
}

function deps(options: {
  databaseMode?: boolean;
  present?: unknown;
  legacy?: readonly Record<string, unknown>[];
  chat?: readonly Record<string, unknown>[];
  failOn?: "present" | "legacy" | "chat";
} = {}) {
  const sent: string[] = [];
  return {
    sent,
    deps: {
      databaseMode: () => options.databaseMode !== false,
      queryChatTablesPresent: async () => {
        sent.push("present");
        if (options.failOn === "present") throw new Error("boom");
        return [{ chat_tables_present: options.present ?? true }];
      },
      queryLegacyInquiries: async () => {
        sent.push("legacy");
        if (options.failOn === "legacy") throw new Error("boom");
        return options.legacy ?? [legacyRow()];
      },
      queryChatInquiries: async () => {
        sent.push("chat");
        if (options.failOn === "chat") throw new Error("boom");
        return options.chat ?? [chatRow()];
      },
    },
  };
}

/* ── 문장: 읽기 전용 ─────────────────────────────── */

test("보내는 문장이 모두 읽기 전용이다", () => {
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
  for (const sql of ALL_SQL) {
    for (const pattern of forbidden) {
      assert.equal(pattern.test(sql), false, `${pattern} 가 문장에 있다`);
    }
  }
});

test("바깥에서 들어오는 값이 문장에 섞이지 않는다", () => {
  // 매개변수 자리가 없다. 호출부가 넘기는 값도 없다.
  for (const sql of ALL_SQL) {
    assert.equal(/\$\d/.test(sql), false);
    assert.equal(sql.includes("${"), false);
  }
});

test("테이블 존재 확인이 테이블을 만들지 않는다", () => {
  // to_regclass는 없는 이름에 NULL을 준다. 여기서 CREATE가 나가면 안 된다.
  assert.match(CHAT_TABLES_PRESENT_SQL, /to_regclass\('public\.chat_inquiries'\)/);
  assert.match(CHAT_TABLES_PRESENT_SQL, /to_regclass\('public\.chat_inquiry_messages'\)/);
  assert.match(CHAT_TABLES_PRESENT_SQL, /AS chat_tables_present/);
});

/* ── 문장: 무엇을 세는가 ─────────────────────────── */

test("탈퇴 판정이 withdrawnAt 하나다", () => {
  for (const sql of [LEGACY_INQUIRIES_AGGREGATE_SQL, CHAT_INQUIRIES_AGGREGATE_SQL]) {
    assert.match(sql, /NULLIF\(u\.value->>'withdrawnAt', ''\) IS NOT NULL/);
    // 이름·연락처로 탈퇴를 판정하지 않는다. 그것들은 부수 효과일 뿐이다.
    assert.equal(/u\.value->>'phone'/.test(sql), false);
    assert.equal(/u\.value->>'name'/.test(sql), false);
    // 같은 id가 두 번 있어도 건수가 부풀지 않게 회원을 id로 묶는다.
    assert.match(sql, /GROUP BY u\.value->>'id'/);
  }
});

test("[A] 네 칸이 서로 겹치지 않는다", () => {
  const sql = LEGACY_INQUIRIES_AGGREGATE_SQL;
  assert.match(sql, /FILTER \(WHERE linked AND known AND NOT withdrawn\)::int AS member_linked_active/);
  assert.match(sql, /FILTER \(WHERE linked AND known AND withdrawn\)::int AS member_linked_withdrawn/);
  assert.match(sql, /FILTER \(WHERE linked AND NOT known\)::int AS member_linked_unknown/);
  assert.match(sql, /FILTER \(WHERE NOT linked\)::int AS guest_no_user_id/);
  // 빈 문자열 userId는 "없음"으로 본다. 코드의 truthy 판정과 같은 경계다.
  assert.match(sql, /NULLIF\(i\.value->>'userId', ''\) AS user_id/);
});

test("[B] 다섯 칸이 서로 겹치지 않고 guest와 unlinked를 가른다", () => {
  const sql = CHAT_INQUIRIES_AGGREGATE_SQL;
  assert.match(sql, /NULLIF\(c\.user_id, ''\) IS NOT NULL AS linked/);
  assert.match(sql, /NULLIF\(c\.guest_token_hash, ''\) IS NOT NULL AS tokened/);
  assert.match(sql, /FILTER \(WHERE NOT linked AND tokened\)::int AS guest_with_token/);
  assert.match(
    sql,
    /FILTER \(WHERE NOT linked AND NOT tokened\)::int AS unlinked_no_user_no_guest_token/,
  );
  // guest_token_hash의 존재 여부는 guestWithToken의 정의 자체다. 같은 칸을 두 번 두지 않는다.
  assert.equal(sql.includes("guest_token_hash_present"), false);
});

test("[C] 여섯 칸이 서로 겹치지 않고 orphan을 따로 센다", () => {
  const sql = CHAT_INQUIRIES_AGGREGATE_SQL;
  for (const alias of [
    "messages_for_active_member_inquiry",
    "messages_for_withdrawn_member_inquiry",
    "messages_for_unknown_member_inquiry",
    "messages_for_guest_inquiry",
    "messages_for_unlinked_inquiry",
    "orphan_messages",
  ]) {
    assert.ok(sql.includes(`AS ${alias}`), `${alias} 가 없다`);
  }
  // 소속 문의방이 없는 메시지를 지우지 않고 세려면 LEFT JOIN이어야 한다.
  assert.match(sql, /FROM chat_inquiry_messages m\s*\n\s*LEFT JOIN inquiry ON inquiry\.inquiry_id = m\.inquiry_id/);
  assert.match(sql, /FILTER \(WHERE inquiry\.inquiry_id IS NULL\)::int AS orphan_messages/);
});

test("이름 미익명화는 탈퇴 연결분 안에서만 센다", () => {
  for (const sql of [LEGACY_INQUIRIES_AGGREGATE_SQL, CHAT_INQUIRIES_AGGREGATE_SQL]) {
    assert.match(sql, /WHERE linked AND known AND withdrawn AND name_not_anonymized/);
    assert.ok(sql.includes(`IS DISTINCT FROM '${INQUIRY_ANONYMIZED_NAME}'`));
  }
});

test("app_store가 비었거나 배열이 아니어도 안전하게 다룬다", () => {
  const legacyGuards = LEGACY_INQUIRIES_AGGREGATE_SQL.match(
    /jsonb_typeof\(src\.data->'\w+'\) = 'array'/g,
  );
  assert.equal(legacyGuards?.length, 2); // users, inquiries
  const chatGuards = CHAT_INQUIRIES_AGGREGATE_SQL.match(
    /jsonb_typeof\(src\.data->'\w+'\) = 'array'/g,
  );
  assert.equal(chatGuards?.length, 1); // users
});

test("개인정보 값을 고르지 않는다", () => {
  // [A] 마지막 SELECT 목록에는 count만 있다. 값이 나갈 자리가 없다.
  const legacyFinal = LEGACY_INQUIRIES_AGGREGATE_SQL.slice(
    LEGACY_INQUIRIES_AGGREGATE_SQL.lastIndexOf("SELECT"),
  );
  assert.equal(legacyFinal.includes("->"), false);
  const legacyAliases = [...legacyFinal.matchAll(/AS (\w+)/g)].map((match) => match[1]);
  assert.equal(legacyFinal.match(/count\(\*\)/g)?.length, legacyAliases.length);

  // [B]+[C] 마지막 SELECT는 앞 CTE가 이미 센 건수를 이름으로만 옮긴다.
  const chatFinal = CHAT_INQUIRIES_AGGREGATE_SQL.slice(
    CHAT_INQUIRIES_AGGREGATE_SQL.lastIndexOf("SELECT"),
  );
  assert.equal(chatFinal.includes("->"), false);
  for (const column of ["name", "phone", "body", "user_id", "guest_token_hash"]) {
    assert.equal(
      new RegExp(`\\b(c|m)\\.${column}\\b`).test(chatFinal),
      false,
      `${column} 가 마지막 SELECT에 있다`,
    );
  }
  // 본문은 비었는지 아닌지만 본다. 값을 꺼내거나 길이를 재지 않는다.
  assert.equal(/\bm\.body\b/.test(CHAT_INQUIRIES_AGGREGATE_SQL.replace(/NULLIF\(m\.body, ''\)/g, "")), false);
  assert.equal(/length\(|substr|left\(|right\(/i.test(CHAT_INQUIRIES_AGGREGATE_SQL), false);
  // 문의 내용도 마찬가지다.
  assert.equal(
    /length\(|substr|left\(|right\(/i.test(LEGACY_INQUIRIES_AGGREGATE_SQL),
    false,
  );
});

/* ── 복사본 어긋남 ───────────────────────────────── */

test("test.sql의 문장들이 이 상수들과 같다", () => {
  /*
   * inquiriesLegacyAggregate.test.sql은 실제 PostgreSQL에서 분류 결과를 본다.
   * 그러려면 같은 문장을 파일에 옮겨 적어야 하는데, 옮긴 뒤 한쪽만 고치면
   * 검증이 다른 문장을 보게 된다. 표식 사이를 잘라 글자로 맞춰 둔다.
   */
  const source = readFileSync(
    new URL("./inquiriesLegacyAggregate.test.sql", import.meta.url),
    "utf8",
  );
  const pairs: [string, string][] = [
    ["LEGACY_INQUIRIES_AGGREGATE_SQL", LEGACY_INQUIRIES_AGGREGATE_SQL],
    ["CHAT_INQUIRIES_AGGREGATE_SQL", CHAT_INQUIRIES_AGGREGATE_SQL],
  ];
  for (const [name, expected] of pairs) {
    const begin = source.indexOf(`>>> ${name} >>>`);
    const end = source.indexOf(`<<< ${name} <<<`);
    assert.notEqual(begin, -1, `test.sql에 ${name} 시작 표식이 없다`);
    assert.notEqual(end, -1, `test.sql에 ${name} 끝 표식이 없다`);
    const copied = source.slice(source.indexOf("\n", begin) + 1, source.lastIndexOf("\n", end));
    assert.equal(copied.trim(), expected.trim(), `${name} 복사본이 다르다`);
  }
});

/* ── 값 읽기 ─────────────────────────────────────── */

test("건수는 숫자와 문자열을 모두 받고, 아니면 읽지 못한 것으로 본다", () => {
  assert.equal(readCount(0), 0);
  assert.equal(readCount("12"), 12);
  assert.equal(readCount(-1), null);
  assert.equal(readCount("a"), null);
  assert.equal(readCount(null), null);
  assert.equal(readCount(undefined), null);
});

test("테이블 존재 여부는 참·거짓만 인정한다", () => {
  assert.equal(readBoolean(true), true);
  assert.equal(readBoolean(false), false);
  assert.equal(readBoolean("t"), true);
  assert.equal(readBoolean("f"), false);
  assert.equal(readBoolean(null), null);
  assert.equal(readBoolean(1), null);
});

/* ── 실행 ────────────────────────────────────────── */

test("DB 모드가 아니면 질의를 한 번도 보내지 않는다", async () => {
  const { deps: d, sent } = deps({ databaseMode: false });
  const response = await runInquiriesLegacyAggregate(d, NOW);
  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "DATABASE_MODE_REQUIRED",
    message: "데이터베이스 모드에서만 확인할 수 있습니다.",
    checkedAt: NOW,
    databaseMode: false,
  });
  assert.deepEqual(sent, []);
});

test("세 묶음을 그대로 옮긴다", async () => {
  const response = await runInquiriesLegacyAggregate(deps().deps, NOW);
  assert.equal(response.status, 200);
  const body = response.body as InquiriesLegacyAggregateBody;
  assert.equal(body.action, "inquiries-legacy-aggregate");
  assert.equal(body.checkedAt, NOW);
  assert.equal(body.databaseMode, true);
  assert.equal(body.chatTablesPresent, true);
  assert.deepEqual(body.legacyInquiries, {
    total: 10,
    memberLinkedActive: 3,
    memberLinkedWithdrawn: 2,
    memberLinkedUnknown: 1,
    guestNoUserId: 4,
    withdrawnNameNotAnonymized: 1,
    withdrawnPhoneNotCleared: 1,
    withdrawnMessagePresent: 2,
    withdrawnUserIdPresent: 2,
    guestNamePresent: 4,
    guestPhonePresent: 4,
    guestMessagePresent: 3,
  });
  assert.deepEqual(body.chatInquiries, {
    total: 7,
    memberLinkedActive: 2,
    memberLinkedWithdrawn: 2,
    memberLinkedUnknown: 1,
    guestWithToken: 1,
    unlinkedNoUserNoGuestToken: 1,
    withdrawnNameNotAnonymized: 1,
    withdrawnPhoneNotCleared: 0,
    withdrawnUserIdPresent: 2,
    guestNamePresent: 1,
    guestPhonePresent: 1,
  });
  assert.deepEqual(body.chatInquiryMessages, {
    totalMessages: 9,
    messagesForActiveMemberInquiry: 3,
    messagesForWithdrawnMemberInquiry: 3,
    messagesForUnknownMemberInquiry: 1,
    messagesForGuestInquiry: 1,
    messagesForUnlinkedInquiry: 1,
    orphanMessages: 0,
    withdrawnMessageBodyPresent: 3,
    guestMessageBodyPresent: 1,
  });
});

test("chat 테이블이 없으면 [A]만 세고 나머지는 null이다", async () => {
  const { deps: d, sent } = deps({ present: false });
  const response = await runInquiriesLegacyAggregate(d, NOW);
  assert.equal(response.status, 200);
  const body = response.body as InquiriesLegacyAggregateBody;
  assert.equal(body.chatTablesPresent, false);
  assert.equal(body.legacyInquiries.total, 10);
  // 세지 못한 칸을 0으로 적지 않는다. 칸을 지우지도 않는다.
  assert.deepEqual(Object.values(body.chatInquiries), Array(11).fill(null));
  assert.deepEqual(Object.values(body.chatInquiryMessages), Array(9).fill(null));
  // chat 질의는 보내지 않는다.
  assert.deepEqual(sent, ["present", "legacy"]);
});

test("0건도 그대로 0으로 적는다", async () => {
  const zeros = (row: Record<string, unknown>) =>
    Object.fromEntries(Object.keys(row).map((key) => [key, 0]));
  const response = await runInquiriesLegacyAggregate(
    deps({ legacy: [zeros(legacyRow())], chat: [zeros(chatRow())] }).deps,
    NOW,
  );
  assert.equal(response.status, 200);
  const body = response.body as InquiriesLegacyAggregateBody;
  assert.equal(body.legacyInquiries.total, 0);
  assert.equal(body.chatInquiries.total, 0);
  assert.equal(body.chatInquiryMessages.totalMessages, 0);
});

test("질의가 실패하면 고정 문구로만 거절한다", async () => {
  for (const failOn of ["present", "legacy", "chat"] as const) {
    const response = await runInquiriesLegacyAggregate(deps({ failOn }).deps, NOW);
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      error: "AGGREGATE_FAILED",
      message: "문의 현황을 확인하지 못했습니다.",
      checkedAt: NOW,
      databaseMode: true,
    });
  }
});

test("행이 없거나 칸을 읽지 못하면 일부만 채워 돌려주지 않는다", async () => {
  const cases = [
    deps({ legacy: [] }),
    deps({ chat: [] }),
    deps({ present: "maybe" }),
    deps({ legacy: [legacyRow({ guest_message_present: null })] }),
    deps({ chat: [chatRow({ orphan_messages: "many" })] }),
  ];
  for (const { deps: d } of cases) {
    const response = await runInquiriesLegacyAggregate(d, NOW);
    assert.equal(response.status, 500);
    assert.equal("error" in response.body && response.body.error, "AGGREGATE_FAILED");
  }
});
