/**
 * 관리자 목록에 지금 상담 정보를 붙이는 규칙 테스트 (Refund-Request-Admin-Read-1).
 *
 * 실행: node --test src/lib/server/refundRequestAdminView.test.ts
 * (기존 단계들과 같은 방식. 새 테스트 라이브러리를 더하지 않는다.)
 *
 * JOIN 질의·정렬·전체 이력 반환은 refundRequests.test.sql에서 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  attachConsultations,
  loadedAdminRefundRequests,
  unavailableAdminRefundRequests,
} from "./refundRequestAdminView.ts";
import type { AdminRefundRequestBase } from "./refundRequestAdminView.ts";
import type { Consultation } from "@/lib/types/app";

function base(overrides: Partial<AdminRefundRequestBase> = {}): AdminRefundRequestBase {
  return {
    id: "r-1",
    orderId: "o-1",
    userId: "u-1",
    status: "requested",
    requestedAt: "2026-08-12T00:00:00.000Z",
    reason: "schedule",
    message: null,
    productionStartedAtSnapshot: null,
    scheduledAtSnapshot: null,
    cancelWindowSnapshot: null,
    cancelWindowPolicyVersion: null,
    decidedAt: null,
    handledBy: null,
    // 아직 종결되지 않은 문의라 null이다. 승인 시각으로 대신 채우지 않는다.
    completedAt: null,
    refundExecution: "unknown",
    // 원장 기록 유무. 기본값은 "기록 없음"이며, 복원이 필요하다는 뜻이 아니다.
    hasPointsRestoreRecord: false,
    order: {
      product: "story",
      title: "이야기로 만드는 인생곡",
      amount: 100000,
      status: "신청접수",
      productionStartedAt: null,
    },
    ...overrides,
  };
}

function consultation(overrides: Partial<Consultation> = {}): Consultation {
  return {
    id: "c-1",
    userId: "u-1",
    teacher: "유비 선생",
    datetime: "8월 12일(화) 오전 10:00",
    scheduledAt: "2026-08-12T01:00:00.000Z",
    purpose: "재물·금전",
    method: "카카오톡 상담",
    option: "없음",
    status: "상담 신청",
    amount: 100000,
    details: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("인생곡 주문에는 상담을 붙이지 않는다", () => {
  const [item] = attachConsultations([base()], [consultation({ id: "o-1" })]);
  // id가 우연히 같아도 상담 상품이 아니면 붙이지 않는다.
  assert.equal(item.consultation, null);
});

test("상담 주문에는 같은 id의 상담을 붙인다", () => {
  const items = attachConsultations(
    [base({ orderId: "c-1", order: { ...base().order, product: "consultation" } })],
    [consultation()],
  );
  assert.deepEqual(items[0].consultation, {
    scheduledAt: "2026-08-12T01:00:00.000Z",
    status: "상담 신청",
  });
});

test("상담을 찾지 못하면 값을 지어내지 않고 null로 둔다", () => {
  const items = attachConsultations(
    [base({ orderId: "c-없음", order: { ...base().order, product: "consultation" } })],
    [consultation()],
  );
  assert.equal(items[0].consultation, null);
});

test("예약 절대시각 기록이 없으면 null을 유지한다", () => {
  const items = attachConsultations(
    [base({ orderId: "c-1", order: { ...base().order, product: "consultation" } })],
    // 표시 문구(datetime)는 있지만 scheduledAt이 없는 옛 예약.
    [consultation({ scheduledAt: undefined })],
  );
  assert.deepEqual(items[0].consultation, { scheduledAt: null, status: "상담 신청" });
  // datetime에서 연도를 추론해 만들어 넣지 않는다.
  assert.equal(items[0].consultation?.scheduledAt, null);
});

test("접수 당시 값과 지금 값을 각각 따로 담는다", () => {
  const items = attachConsultations(
    [
      base({
        orderId: "c-1",
        // 접수 당시: 예약 시각이 있었고 취소창은 여유가 있었다.
        scheduledAtSnapshot: "2026-08-12T01:00:00.000Z",
        cancelWindowSnapshot: { kind: "normal-request", remainingMinutes: 181 },
        cancelWindowPolicyVersion: "consult-cancel-window-3h-v1",
        order: { ...base().order, product: "consultation" },
      }),
    ],
    // 지금: 상담 상태가 진행되었다.
    [consultation({ status: "선생님과 1:1 상담" })],
  );
  const item = items[0];
  // 두 값이 한 칸에 합쳐지지 않고 나란히 남아 있어야 한다.
  assert.equal(item.scheduledAtSnapshot, "2026-08-12T01:00:00.000Z");
  assert.equal(item.consultation?.status, "선생님과 1:1 상담");
  assert.deepEqual(item.cancelWindowSnapshot, { kind: "normal-request", remainingMinutes: 181 });
  assert.equal(item.cancelWindowPolicyVersion, "consult-cancel-window-3h-v1");
  // 서버가 "환불 가능/불가" 같은 결론 칸을 만들지 않는다.
  assert.equal("refundable" in item, false);
  assert.equal("decision" in item, false);
});

test("맞춤상품은 접수 당시 snapshot과 지금 값이 달라도 둘 다 남는다", () => {
  const [item] = attachConsultations(
    [
      base({
        // 접수 당시에는 제작 착수 기록이 없었다.
        productionStartedAtSnapshot: null,
        order: { ...base().order, productionStartedAt: "2026-08-13T00:00:00.000Z" },
      }),
    ],
    [],
  );
  assert.equal(item.productionStartedAtSnapshot, null);
  assert.equal(item.order.productionStartedAt, "2026-08-13T00:00:00.000Z");
  // 접수 뒤에 생긴 값으로 snapshot을 덮어쓰지 않는다.
  assert.notEqual(item.productionStartedAtSnapshot, item.order.productionStartedAt);
});

test("여러 건을 붙여도 순서를 바꾸지 않는다", () => {
  const items = attachConsultations(
    [base({ id: "r-3" }), base({ id: "r-2" }), base({ id: "r-1" })],
    [],
  );
  assert.deepEqual(items.map((item) => item.id), ["r-3", "r-2", "r-1"]);
});

/* ── 조회 성공/실패 구분 (Refund-Admin-Read-State-1) ───── */

test("조회 성공 + 데이터는 loaded true와 그 목록을 그대로 담는다", () => {
  const [item] = attachConsultations([base()], []);
  const view = loadedAdminRefundRequests([item]);
  assert.equal(view.loaded, true);
  assert.equal(view.items.length, 1);
  assert.equal(view.items[0].id, "r-1");
});

test("조회 성공 + 0건은 loaded true에 빈 목록이다(문의 없음)", () => {
  const view = loadedAdminRefundRequests([]);
  assert.deepEqual(view, { items: [], loaded: true });
});

test("조회 실패는 loaded false에 빈 목록이며 실패 사유를 담지 않는다", () => {
  const view = unavailableAdminRefundRequests();
  assert.deepEqual(view, { items: [], loaded: false });
  // 내부 오류 내용이 응답으로 새어 나가지 않는다.
  assert.equal("error" in view, false);
  assert.equal("reason" in view, false);
  assert.equal("message" in view, false);
});

test("0건 성공과 조회 실패는 목록이 같아도 서로 구분된다", () => {
  const empty = loadedAdminRefundRequests([]);
  const failed = unavailableAdminRefundRequests();
  assert.deepEqual(empty.items, failed.items);
  assert.notEqual(empty.loaded, failed.loaded);
});

test("실패 묶음은 호출할 때마다 새로 만들어 고쳐 써도 번지지 않는다", () => {
  const first = unavailableAdminRefundRequests();
  first.items.push(attachConsultations([base()], [])[0]);
  assert.deepEqual(unavailableAdminRefundRequests(), { items: [], loaded: false });
});
