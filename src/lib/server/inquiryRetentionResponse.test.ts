/** 실행: node --import tsx --experimental-test-module-mocks --test src/lib/server/inquiryRetentionResponse.test.ts */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const privateMetadata = { version: 1, internalMarker: "must-not-leak" };
const inquiry = { id: "own", userId: "u-1", name: "sample", phone: "", method: "문자", product: "문의", message: "keep", createdAt: "2026-11-02T00:00:00Z", retention: privateMetadata };
const data = {
  users: [{ id: "u-1", name: "sample", phone: "", points: 0 }],
  inquiries: [inquiry, { ...inquiry, id: "other", userId: "u-2" }],
  orders: [], consultations: [], reviews: [], wishlists: {}, coupons: {}, notifications: {}, notificationSettings: {},
};
mock.module("@/lib/server/session", { namedExports: {
  getUserId: async () => "u-1", ensureDraftOwnerCookie: async () => {}, setUserId: async () => {}, clearUserId: async () => {},
} });
mock.module("@/lib/server/store", { namedExports: { readData: async () => data, listOrdersByUser: async () => [] } });
mock.module("@/lib/server/refundRequests", { namedExports: {
  listActiveRefundRequestsByUser: async () => [], listLatestRefundRequestsByUser: async () => [],
} });

test("실제 고객 GET 응답은 내부 메타정보를 제외하고 기존 문의 내용과 소유자 범위를 유지한다", async () => {
  const { GET } = await import("../../app/api/app/route.ts");
  const response = await GET();
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.inquiries.length, 1);
  assert.equal(json.inquiries[0].id, "own");
  assert.equal(json.inquiries[0].message, "keep");
  assert.equal("retention" in json.inquiries[0], false);
  assert.equal(JSON.stringify(json).includes("must-not-leak"), false);
  assert.equal(inquiry.retention, privateMetadata);
});
