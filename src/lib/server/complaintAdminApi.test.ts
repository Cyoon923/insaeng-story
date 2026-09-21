/**
 * 불만 기록 관리자 API의 입력·응답과 route 경계 테스트
 * (Privacy-Complaint-Implementation-3, Step 3).
 *
 * 실행: node --test src/lib/server/complaintAdminApi.test.ts
 *
 * 두 가지를 본다.
 * 1) 순수 모듈: 무엇을 읽고 무엇을 읽지 않는가, 실패를 어떻게 구분하는가.
 * 2) route 원문: 관리자 확인 뒤에 있는가, handledBy를 body에서 읽지 않는가,
 *    GET이 목록을 내려주는가, 기존 action이 그대로 남아 있는가.
 *
 * route를 import하지 않는다. 그쪽은 next/server와 DB 드라이버를 불러오기 때문이다.
 * 대신 원문을 글자로 읽는다(paymentRawPresenceSource.test.ts와 같은 방식).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  markComplaintHandledFailureResponse,
  readCreateComplaintRecordBody,
  readMarkComplaintHandledBody,
} from "./complaintAdminApi.ts";

const ROUTE = readFileSync(new URL("../../app/api/admin/route.ts", import.meta.url), "utf8");
const PAGE = readFileSync(new URL("../../app/admin/page.tsx", import.meta.url), "utf8");

/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const ROUTE_CODE = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/* ── 승격 입력 읽기 ─────────────────────────────── */

test("관리자가 정하는 값만 읽는다", () => {
  const parsed = readCreateComplaintRecordBody({
    sourceType: "chat",
    category: "service",
    summary: "  환불 지연 불만  ",
    userId: "u-1",
    orderId: "o-1",
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(Object.keys(parsed.body), [
    "sourceType",
    "category",
    "summary",
    "userId",
    "orderId",
  ]);
  // 분류·요지는 여기서 판정하지 않고 그대로 넘긴다(규칙은 저장 계층이 부른다).
  assert.equal(parsed.body.summary, "  환불 지연 불만  ");
});

test("금지된 필드는 읽지 않는다", () => {
  const parsed = readCreateComplaintRecordBody({
    sourceType: "chat",
    category: "service",
    summary: "요지",
    // 아래는 전부 저장 계층에 닿지 않아야 한다.
    name: "홍길동",
    phone: "01011112222",
    guestTokenHash: "abc",
    sourceId: "c-1",
    message: "대화 전문",
    body: "대화 전문",
    amount: 100000,
    pgTid: "tid",
    status: "handled",
    createdAt: "2020-01-01T00:00:00.000Z",
    handledAt: "2020-01-01T00:00:00.000Z",
    handledBy: "someone",
  });
  const keys = Object.keys(parsed.body);
  for (const forbidden of [
    "name",
    "phone",
    "guestTokenHash",
    "sourceId",
    "message",
    "body",
    "amount",
    "pgTid",
    "status",
    "createdAt",
    "handledAt",
    "handledBy",
  ]) {
    assert.equal(keys.includes(forbidden), false, `${forbidden} 를 읽는다`);
  }
});

test("선택 연결은 값이 없으면 null이다", () => {
  const parsed = readCreateComplaintRecordBody({
    sourceType: "inquiry",
    category: "other",
    summary: "요지",
  });
  assert.equal(parsed.body.userId, null);
  assert.equal(parsed.body.orderId, null);

  const blank = readCreateComplaintRecordBody({ userId: "   ", orderId: 5 });
  assert.equal(blank.body.userId, null);
  assert.equal(blank.body.orderId, null);
});

/* ── 처리 완료 입력 읽기 ────────────────────────── */

test("기록 id만 읽고, 없으면 거절한다", () => {
  const ok = readMarkComplaintHandledBody({ complaintRecordId: " r-1 ", handledBy: "someone" });
  assert.deepEqual(ok, { ok: true, complaintRecordId: "r-1" });

  for (const body of [{}, { complaintRecordId: "" }, { complaintRecordId: "  " }, { complaintRecordId: 5 }]) {
    const fail = readMarkComplaintHandledBody(body);
    assert.equal(fail.ok, false);
    assert.equal(fail.ok === false && fail.status, 400);
  }
});

/* ── 실패 응답 ──────────────────────────────────── */

test("이미 처리된 것과 없는 것을 구분한다", () => {
  assert.equal(markComplaintHandledFailureResponse("not-found").status, 404);
  assert.equal(markComplaintHandledFailureResponse("already-handled").status, 409);
  // 어떤 회원·주문인지 드러내지 않는다.
  for (const reason of ["not-found", "already-handled"] as const) {
    const response = markComplaintHandledFailureResponse(reason);
    assert.equal(/userId|orderId|회원|주문/.test(response.error), false);
  }
});

/* ── route 경계 ─────────────────────────────────── */

test("두 action이 관리자 확인 뒤에 있다", () => {
  const guard = ROUTE_CODE.indexOf("if (!(await isAdminAuthenticated()))");
  assert.notEqual(guard, -1);
  for (const action of ['action === "createComplaintRecord"', 'action === "markComplaintHandled"']) {
    const at = ROUTE_CODE.indexOf(action);
    assert.notEqual(at, -1, `${action} 가 없다`);
    assert.ok(at > guard, `${action} 가 관리자 확인보다 앞에 있다`);
  }
  // 새 인증·권한 체계를 만들지 않는다. 기존 관문(import + GET + POST) 그대로다.
  assert.equal(ROUTE_CODE.match(/isAdminAuthenticated/g)?.length, 3);
  assert.equal(/requireAdmin|adminOnly|checkComplaintAdmin/.test(ROUTE_CODE), false);
});

test("GET이 목록을 내려주되 실패를 loaded로 구분한다", () => {
  assert.match(ROUTE_CODE, /await listComplaintRecordsForAdmin\(\)/);
  assert.match(ROUTE_CODE, /complaintRecords = \{ items: \[\], loaded: false \};/);
  assert.match(ROUTE_CODE, /^\s{4}complaintRecords,$/m);
});

test("handledBy를 클라이언트에서 받지 않는다", () => {
  assert.match(
    ROUTE_CODE,
    /markComplaintHandled\(\{\s*complaintRecordId: parsed\.complaintRecordId,\s*handledBy: CURRENT_ADMIN_ACTOR,\s*\}\)/,
  );
  assert.equal(/handledBy: body\./.test(ROUTE_CODE), false);
  assert.equal(/body\.handledBy/.test(ROUTE_CODE), false);
});

test("상태·시각을 클라이언트에서 받지 않는다", () => {
  /*
   * body.status는 기존 주문·상담 상태 변경 action이 쓴다. 불만 승격 블록만 잘라서 본다.
   * 끝 앵커로 다른 action 이름을 쓰지 않는다. 그 action이 있고 없고에 따라 검사 구간이
   * 달라지면, 이 테스트가 불만 경로가 아니라 옆 기능의 존재 여부를 보게 된다.
   * 바로 다음 action이 무엇이든 그 시작 지점까지만 본다.
   */
  const begin = ROUTE_CODE.indexOf('action === "createComplaintRecord"');
  assert.notEqual(begin, -1, "승격 action이 없다");
  const next = ROUTE_CODE.indexOf('if (action === "', begin + 1);
  const block = ROUTE_CODE.slice(begin, next === -1 ? undefined : next);
  for (const forbidden of ["body.status", "body.createdAt", "body.handledAt", "body.summary", "body.sourceType"]) {
    assert.equal(block.includes(forbidden), false, `불만 경로가 ${forbidden} 를 읽는다`);
  }
  assert.match(block, /const parsed = readCreateComplaintRecordBody\(body\);/);
});

test("규칙 위반은 400, 그 밖의 실패는 고정 문구 500이다", () => {
  assert.match(
    ROUTE_CODE,
    /if \(error instanceof ComplaintRecordError\) \{\s*return NextResponse\.json\(\{ error: error\.message \}, \{ status: 400 \}\);/,
  );
  assert.match(ROUTE_CODE, /console\.error\("\[admin\] complaint record create failed", error\);/);
  assert.match(ROUTE_CODE, /console\.error\("\[admin\] complaint record handle failed", error\);/);
});

test("환불 문의 중복 판정을 새로 만들지 않는다", () => {
  const begin = ROUTE_CODE.indexOf('action === "createComplaintRecord"');
  const end = ROUTE_CODE.indexOf('action === "markComplaintHandled"');
  const block = ROUTE_CODE.slice(begin, end);
  for (const forbidden of ["refundRequest", "RefundRequest", "hasCompletedRefund"]) {
    assert.equal(block.includes(forbidden), false, `승격 경로가 ${forbidden} 를 본다`);
  }
});

/**
 * 불만 기능을 넣기 전부터 있던 관리자 action.
 *
 * 이 목록에 그 뒤에 생긴 기능(환불 관리자 처리 등)을 넣지 않는다. 넣으면 이 테스트가
 * "불만 변경이 기존 것을 지웠는가"가 아니라 "옆 기능이 있는가"를 보게 되고,
 * 그 기능 없이 불만 변경만 떼어 확인할 수 없게 된다.
 */
const ACTIONS_BEFORE_COMPLAINT = [
  "login",
  "logout",
  "toggleBlockSlot",
  "generateAdminPromo",
  "adjustPoints",
  "giveCoupon",
  "notifyPromoCode",
  "updateOrderStatus",
  "updateConsultationStatus",
  "toggleReviewVisible",
];

test("기존 관리자 action이 그대로 남아 있다", () => {
  const actions = [...ROUTE_CODE.matchAll(/action === "(\w+)"/g)].map((match) => match[1]);
  for (const existing of ACTIONS_BEFORE_COMPLAINT) {
    assert.ok(actions.includes(existing), `${existing} 가 사라졌다`);
  }
  // 새 action은 둘뿐이고 이름이 겹치지 않는다.
  assert.equal(actions.filter((name) => name === "createComplaintRecord").length, 1);
  assert.equal(actions.filter((name) => name === "markComplaintHandled").length, 1);
  assert.equal(new Set(actions).size, actions.length);
});

/* ── 관리자 화면 경계 ───────────────────────────── */

const PAGE_CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("화면이 보내는 값은 분류·요지와 출처뿐이다", () => {
  assert.match(PAGE_CODE, /action: "createComplaintRecord"/);
  assert.match(PAGE_CODE, /category: complaintCategory/);
  assert.match(PAGE_CODE, /summary,/);
  assert.match(PAGE_CODE, /orderId: null/);
  // 상태·시각·처리자는 보내지 않는다. 서버가 정한다.
  for (const forbidden of ["status:", "createdAt:", "handledAt:", "handledBy:"]) {
    assert.equal(
      PAGE_CODE.includes(`${forbidden} complaint`) || PAGE_CODE.includes(`${forbidden} "handled"`),
      false,
      `화면이 ${forbidden} 를 보낸다`,
    );
  }
});

test("처리 완료는 기록 id만 보낸다", () => {
  assert.match(
    PAGE_CODE,
    /JSON\.stringify\(\{ action: "markComplaintHandled", complaintRecordId \}\)/,
  );
});

test("요지를 대화 내용으로 자동으로 채우지 않는다", () => {
  assert.match(PAGE_CODE, /const summary = complaintSummary\.trim\(\);/);
  assert.equal(/setComplaintSummary\(\s*(message|selectedChat|item)/.test(PAGE_CODE), false);
  // 빈 값은 보내지 않고, 화면에서도 500자로 막는다.
  assert.match(PAGE_CODE, /if \(!summary \|\| complaintSaving\) return;/);
  assert.match(PAGE_CODE, /maxLength=\{COMPLAINT_SUMMARY_MAX\}/);
  assert.match(PAGE_CODE, /const COMPLAINT_SUMMARY_MAX = 500;/);
});

test("목록에 개인정보를 표시하지 않는다", () => {
  const begin = PAGE_CODE.indexOf("불만·분쟁 기록");
  assert.notEqual(begin, -1);
  const block = PAGE_CODE.slice(begin, PAGE_CODE.indexOf("tab === \"schedule\"", begin));
  for (const forbidden of ["item.userId", "item.orderId", "item.name", "item.phone", "lastMessageBody"]) {
    assert.equal(block.includes(forbidden), false, `목록이 ${forbidden} 를 보여 준다`);
  }
  for (const shown of ["item.category", "item.summary", "item.sourceType", "item.createdAt", "item.handledAt", "item.status"]) {
    assert.ok(block.includes(shown), `${shown} 가 목록에 없다`);
  }
});

test("처리 완료 버튼은 open에만 있고, 수정·삭제·재오픈 UI가 없다", () => {
  assert.match(PAGE_CODE, /item\.status === "open" \? \(/);
  for (const forbidden of ["deleteComplaint", "reopenComplaint", "updateComplaint", "editComplaint"]) {
    assert.equal(PAGE_CODE.includes(forbidden), false, `${forbidden} UI가 있다`);
  }
});
