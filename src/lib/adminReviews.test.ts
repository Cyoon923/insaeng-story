/**
 * 관리자 후기 관리 테스트. 실행: node --test src/lib/adminReviews.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { removeReviewById, reviewKindLabel, reviewTargetLabel } from "./adminReviews.ts";
import type { Review } from "@/lib/types/app";

function review(id: string, overrides: Partial<Review> = {}): Review {
  return {
    id,
    userId: "u-1",
    name: "고객",
    title: "사주 인생곡",
    rating: 5,
    text: "좋아요",
    createdAt: "2026-10-05T00:00:00.000Z",
    visible: false,
    kind: "saju-song",
    targetKey: `order:o-${id}`,
    ...overrides,
  };
}

test("상품 종류: 저장된 kind 우선, 없으면 제목으로 추정", () => {
  assert.equal(reviewKindLabel("", "story"), "이야기로 만드는 인생곡");
  assert.equal(reviewKindLabel("", "premium"), "프리미엄 인생곡");
  assert.equal(reviewKindLabel("", "saju-song"), "사주 인생곡");
  assert.equal(reviewKindLabel("", "consultation"), "1:1 사주상담");
  assert.equal(reviewKindLabel("프리미엄 인생곡", undefined), "프리미엄 인생곡");
  assert.equal(reviewKindLabel("1:1 사주상담", undefined), "1:1 사주상담");
});

test("대상 표시: 주문/상담 id만, 없으면 기록 없음", () => {
  assert.equal(reviewTargetLabel("order:o-1"), "주문 o-1");
  assert.equal(reviewTargetLabel("consult:c-1"), "상담 c-1");
  assert.equal(reviewTargetLabel(""), "대상 기록 없음");
  assert.equal(reviewTargetLabel(undefined), "대상 기록 없음");
  assert.equal(reviewTargetLabel("order:"), "대상 기록 없음");
});

test("삭제: 같은 id 1건만 빼고 나머지는 그대로", () => {
  const data = { reviews: [review("r1"), review("r2", { visible: true }), review("r3")] };
  assert.equal(removeReviewById(data, "r2"), true);
  assert.deepEqual(data.reviews.map((item) => item.id), ["r1", "r3"]);
  assert.equal(data.reviews[0].visible, false);
});

test("삭제: 없는 id·빈 id는 false이고 목록을 바꾸지 않는다", () => {
  const data = { reviews: [review("r1")] };
  assert.equal(removeReviewById(data, "nope"), false);
  assert.equal(removeReviewById(data, "  "), false);
  assert.equal(removeReviewById({}, "r1"), false);
  assert.equal(data.reviews.length, 1);
});

test("관리자 API: deleteReview는 id 검증 후 서버 목록에서 지우고 CAS로 저장한다", () => {
  const route = readFileSync(new URL("../app/api/admin/route.ts", import.meta.url), "utf8");
  const start = route.indexOf('if (action === "deleteReview")');
  assert.ok(start > route.indexOf("isAdminAuthenticated())) {", route.indexOf("async function handlePost")), "관리자 관문 뒤에 있다");
  const block = route.slice(start, route.indexOf("\n  }\n", start));
  assert.match(block, /status: 400/);
  assert.match(block, /removeReviewById\(data, id\)/);
  assert.match(block, /status: 404/);
  assert.match(block, /await writeData\(data\)/);
});
