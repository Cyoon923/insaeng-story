/**
 * 관리자 문의 처리 여부 테스트. 실행: node --test src/lib/adminInquiries.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isInquiryHandled, matchesInquiryFilter, setInquiryHandled } from "./adminInquiries.ts";
import type { Inquiry } from "@/lib/types/app";

const NOW = "2026-10-05T01:00:00.000Z";

function inquiry(id: string, overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id,
    name: "문의자",
    phone: "01000000000",
    method: "카카오톡",
    product: "무료 상담",
    message: "문의 내용",
    createdAt: "2026-10-04T00:00:00.000Z",
    ...overrides,
  };
}

test("handledAt이 없는 기존 문의는 미처리", () => {
  const old = inquiry("q1");
  assert.equal(isInquiryHandled(old), false);
  assert.equal(matchesInquiryFilter(old, "pending"), true);
  assert.equal(matchesInquiryFilter(old, "handled"), false);
  assert.equal(matchesInquiryFilter(old, "all"), true);
  const done = inquiry("q2", { handledAt: NOW });
  assert.equal(matchesInquiryFilter(done, "handled"), true);
  assert.equal(matchesInquiryFilter(done, "pending"), false);
});

test("처리 완료 → 서버 시각 기록, 되돌리기 → 기록 삭제, 다른 문의는 그대로", () => {
  const other = inquiry("q2", { handledAt: "2026-10-01T00:00:00.000Z" });
  const data = { inquiries: [inquiry("q1"), other, inquiry("q3")] };
  const before = JSON.stringify([data.inquiries[1], data.inquiries[2]]);

  const done = setInquiryHandled(data, "q1", true, NOW);
  assert.equal(done?.handledAt, NOW);
  assert.equal(JSON.stringify([data.inquiries[1], data.inquiries[2]]), before);

  const undone = setInquiryHandled(data, "q1", false, "2026-10-06T00:00:00.000Z");
  assert.equal(undone?.id, "q1");
  assert.equal("handledAt" in data.inquiries[0], false);
  assert.equal(JSON.stringify([data.inquiries[1], data.inquiries[2]]), before);
  // 이름·연락처·내용은 바뀌지 않는다.
  assert.equal(data.inquiries[0].phone, "01000000000");
  assert.equal(data.inquiries[0].message, "문의 내용");
});

test("없는 id·빈 id는 null이고 목록을 바꾸지 않는다", () => {
  const data = { inquiries: [inquiry("q1")] };
  const before = JSON.stringify(data);
  assert.equal(setInquiryHandled(data, "nope", true, NOW), null);
  assert.equal(setInquiryHandled(data, "  ", true, NOW), null);
  assert.equal(JSON.stringify(data), before);
});

test("관리자 API: markInquiryHandled는 관문 뒤, 입력 검증, 404, 서버 시각, CAS 저장", () => {
  const route = readFileSync(new URL("../app/api/admin/route.ts", import.meta.url), "utf8");
  const start = route.indexOf('if (action === "markInquiryHandled")');
  assert.ok(start > route.indexOf("isAdminAuthenticated())) {", route.indexOf("async function handlePost")));
  const block = route.slice(start, route.indexOf("\n  }\n", start));
  assert.match(block, /typeof body\.handled !== "boolean"/);
  assert.match(block, /status: 400/);
  assert.match(block, /setInquiryHandled\(data, id, body\.handled, new Date\(\)\.toISOString\(\)\)/);
  assert.match(block, /status: 404/);
  assert.match(block, /await writeData\(data\)/);
});
