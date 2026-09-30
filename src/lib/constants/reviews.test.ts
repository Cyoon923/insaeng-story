/**
 * 공개 후기 표시 규칙 테스트. 실행: node --test src/lib/constants/reviews.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { pickHomeReviews, REVIEW_KIND_LABELS, reviewKindFromQuery } from "./reviews.ts";

const r = (id: string, rating: number) => ({ id, rating });

test("?kind= 값은 네 가지 상품 종류만 받고 나머지는 전체(null)", () => {
  for (const kind of ["story", "premium", "saju-song", "consultation"] as const) {
    assert.equal(reviewKindFromQuery(kind), kind);
    assert.ok(REVIEW_KIND_LABELS[kind]);
  }
  for (const bad of [null, undefined, "", "all", "STORY", "saju", "consultation "]) {
    assert.equal(reviewKindFromQuery(bad), null, String(bad));
  }
});

test("홈 후기: 0개면 섹션을 숨긴다(null)", () => {
  assert.equal(pickHomeReviews([]), null);
});

test("홈 후기: 1개면 1개와 그 별점", () => {
  const home = pickHomeReviews([r("a", 4)]);
  assert.deepEqual(home, { items: [r("a", 4)], summary: { count: 1, average: 4 } });
});

test("홈 후기: 3개 넘으면 앞(최신) 3개만, 평균·개수는 전체 기준", () => {
  const home = pickHomeReviews([r("a", 5), r("b", 4), r("c", 5), r("d", 3)]);
  assert.deepEqual(home?.items.map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(home?.summary, { count: 4, average: 4.3 });
});
