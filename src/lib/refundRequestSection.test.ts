/**
 * 고객 환불 문의 화면 규칙 테스트 (Refund-Customer-Song-UI-1).
 *
 * 실행: node --test src/lib/refundRequestSection.test.ts
 * 순수 함수라 브라우저도 DB도 필요 없다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  REFUND_ACTIVE_MESSAGE,
  REFUND_COMPLETED_MESSAGE,
  REFUND_MESSAGE_MAX,
  REFUND_REASON_OPTIONS,
  REFUND_REJECTED_GUIDE,
  REFUND_REJECTED_MESSAGE,
  REFUND_UNAVAILABLE_MESSAGE,
  canRequestConsultationRefund,
  checkRefundForm,
  hasCompletedRefundForOrder,
  refundSectionState,
} from "./refundRequestSection.ts";
import type {
  ActiveRefundRequestSummary,
  ActiveRefundRequestsView,
  LatestRefundRequestSummary,
  LatestRefundRequestsView,
  Order,
} from "@/lib/types/app";

const ORDER_ID = "o-is-abc";

function summary(
  overrides: Partial<ActiveRefundRequestSummary> = {},
): ActiveRefundRequestSummary {
  return {
    id: "r-1",
    orderId: ORDER_ID,
    status: "requested",
    requestedAt: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

function view(overrides: Partial<ActiveRefundRequestsView> = {}): ActiveRefundRequestsView {
  return { items: [summary()], loaded: true, ...overrides };
}

/** 활성 문의가 없는 성공 응답. 끝난 상태 검사에서 기본으로 쓴다. */
const NO_ACTIVE: ActiveRefundRequestsView = { items: [], loaded: true };

function latestItem(
  overrides: Partial<LatestRefundRequestSummary> = {},
): LatestRefundRequestSummary {
  return {
    id: "r-1",
    orderId: ORDER_ID,
    status: "rejected",
    requestedAt: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

/** 최신 문의 묶음. 기본은 "이력 없음(조회 성공)"이다. */
function latest(overrides: Partial<LatestRefundRequestsView> = {}): LatestRefundRequestsView {
  return { items: [], loaded: true, ...overrides };
}

/* ── 활성 상태 표시 ───────────────────────────────────── */

test("requested·reviewing·approved 문구가 각각 다르다", () => {
  assert.equal(REFUND_ACTIVE_MESSAGE.requested, "환불 문의가 접수되었습니다.");
  assert.equal(REFUND_ACTIVE_MESSAGE.reviewing, "환불 문의를 확인하고 있습니다.");
  assert.equal(REFUND_ACTIVE_MESSAGE.approved, "환불이 승인되어 처리 중입니다.");
});

test("approved를 환불 완료로 표현하지 않는다", () => {
  assert.equal(REFUND_ACTIVE_MESSAGE.approved.includes("완료"), false);
  assert.equal(REFUND_ACTIVE_MESSAGE.approved.includes("입금"), false);
});

/* ── 해당 주문의 활성 문의 탐색 ───────────────────────── */

test("같은 orderId의 활성 문의를 찾는다", () => {
  const state = refundSectionState(view(), latest(), ORDER_ID);
  assert.equal(state.kind, "active");
  assert.equal(state.kind === "active" ? state.request.id : null, "r-1");
});

test("다른 주문의 문의는 이 주문 상태로 읽지 않는다", () => {
  const state = refundSectionState(
    view({ items: [summary({ orderId: "o-other" })] }),
    latest(),
    ORDER_ID,
  );
  assert.deepEqual(state, { kind: "none" });
});

test("조회에 성공했고 활성 문의가 없으면 none이다", () => {
  assert.deepEqual(refundSectionState(view({ items: [] }), latest(), ORDER_ID), { kind: "none" });
});

test("여러 건이 와도 이 주문 것 하나만 고른다", () => {
  const state = refundSectionState(
    view({ items: [summary({ id: "r-2", orderId: "o-other" }), summary({ id: "r-3" })] }),
    latest(),
    ORDER_ID,
  );
  assert.equal(state.kind === "active" ? state.request.id : null, "r-3");
});

/* ── loaded = false ───────────────────────────────────── */

test("loaded=false는 문의 없음이 아니라 unavailable이다", () => {
  assert.deepEqual(refundSectionState({ items: [], loaded: false }, latest(), ORDER_ID), {
    kind: "unavailable",
  });
});

test("응답 자체가 없어도 문의 없음으로 읽지 않는다", () => {
  assert.deepEqual(refundSectionState(undefined, latest(), ORDER_ID), { kind: "unavailable" });
  assert.deepEqual(refundSectionState(null, latest(), ORDER_ID), { kind: "unavailable" });
});

/* ── 끝난 문의 (Refund-Customer-Closed-UI-1) ──────────── */

test("활성 문의가 있으면 끝난 이력보다 먼저 본다", () => {
  for (const status of ["requested", "reviewing", "approved"] as const) {
    const state = refundSectionState(
      view({ items: [summary({ status })] }),
      // 두 목록이 같은 주문을 가리켜도 처리 중인 쪽이 먼저다.
      latest({ items: [latestItem({ status })] }),
      ORDER_ID,
    );
    assert.equal(state.kind, "active", status);
    assert.equal(state.kind === "active" ? state.request.status : null, status);
  }
});

test("활성이 없고 최신이 rejected면 종료로 읽는다", () => {
  const state = refundSectionState(NO_ACTIVE, latest({ items: [latestItem()] }), ORDER_ID);
  assert.equal(state.kind, "rejected");
  assert.equal(state.kind === "rejected" ? state.request.id : null, "r-1");
});

test("활성이 없고 최신이 completed면 종료로 읽는다", () => {
  const state = refundSectionState(
    NO_ACTIVE,
    latest({ items: [latestItem({ status: "completed" })] }),
    ORDER_ID,
  );
  assert.equal(state.kind, "completed");
});

test("끝난 상태에서는 새 신청 대상이 아니다", () => {
  for (const status of ["rejected", "completed"] as const) {
    const state = refundSectionState(
      NO_ACTIVE,
      latest({ items: [latestItem({ status })] }),
      ORDER_ID,
    );
    // 새 문의 버튼을 내밀어도 되는 상태는 none 하나뿐이다.
    assert.notEqual(state.kind, "none", status);
  }
});

test("활성도 이력도 없을 때만 none이다", () => {
  assert.deepEqual(refundSectionState(NO_ACTIVE, latest(), ORDER_ID), { kind: "none" });
});

test("최신 목록을 읽지 못했으면 종료 여부를 단정하지 않는다", () => {
  // 활성 조회가 성공해도, 끝난 문의를 확인하지 못한 상태로 신청 버튼을 내밀지 않는다.
  assert.deepEqual(refundSectionState(NO_ACTIVE, { items: [], loaded: false }, ORDER_ID), {
    kind: "unavailable",
  });
  assert.deepEqual(refundSectionState(NO_ACTIVE, undefined, ORDER_ID), { kind: "unavailable" });
  assert.deepEqual(refundSectionState(NO_ACTIVE, null, ORDER_ID), { kind: "unavailable" });
});

test("두 목록이 어긋나면 문의 없음으로 읽지 않는다", () => {
  for (const status of ["requested", "reviewing", "approved"] as const) {
    // 최신은 처리 중이라는데 활성 목록에는 없다. 어느 쪽이 맞는지 화면이 고르지 않는다.
    const state = refundSectionState(
      NO_ACTIVE,
      latest({ items: [latestItem({ status })] }),
      ORDER_ID,
    );
    assert.deepEqual(state, { kind: "inconsistent" }, status);
  }
});

test("다른 주문의 이력을 이 주문 상태로 읽지 않는다", () => {
  const state = refundSectionState(
    NO_ACTIVE,
    latest({ items: [latestItem({ orderId: "o-other", status: "completed" })] }),
    ORDER_ID,
  );
  assert.deepEqual(state, { kind: "none" });
});

test("주문 id가 비어 있으면 아무 결론도 내지 않는다", () => {
  assert.deepEqual(refundSectionState(NO_ACTIVE, latest(), "   "), { kind: "unavailable" });
});

test("rejected와 completed 문구가 서로 다르다", () => {
  assert.equal(REFUND_REJECTED_MESSAGE, "환불 문의 검토가 종료되었습니다.");
  assert.equal(REFUND_REJECTED_GUIDE, "추가로 확인하실 내용은 상담원에게 문의해 주세요.");
  assert.equal(REFUND_COMPLETED_MESSAGE, "환불 처리가 완료되었습니다.");
  assert.notEqual(REFUND_REJECTED_MESSAGE, REFUND_COMPLETED_MESSAGE);
});

test("거절 안내에 환불 불가나 사유를 적지 않는다", () => {
  for (const banned of ["불가", "거절", "사유", "rejected"]) {
    assert.equal(REFUND_REJECTED_MESSAGE.includes(banned), false, banned);
    assert.equal(REFUND_REJECTED_GUIDE.includes(banned), false, banned);
  }
});

test("완료 문구는 approved의 처리 중 문구와 구분된다", () => {
  assert.notEqual(REFUND_COMPLETED_MESSAGE, REFUND_ACTIVE_MESSAGE.approved);
  // approved는 아직 처리 중이고, completed만 완료다. 두 말을 섞지 않는다.
  assert.equal(REFUND_COMPLETED_MESSAGE.includes("처리 중"), false);
  assert.equal(REFUND_ACTIVE_MESSAGE.approved.includes("완료"), false);
});

test("어긋난 상태 안내는 읽지 못했을 때와 같은 말을 쓴다", () => {
  assert.equal(
    REFUND_UNAVAILABLE_MESSAGE,
    "환불 문의 상태를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요.",
  );
  // 내부 사정(어느 목록이 무엇을 담았는지)을 알리지 않는다.
  for (const leak of ["active", "latest", "목록", "동기화"]) {
    assert.equal(REFUND_UNAVAILABLE_MESSAGE.includes(leak), false, leak);
  }
});

test("끝난 상태를 고르는 데 쓰는 값은 네 개뿐이다", () => {
  const state = refundSectionState(
    NO_ACTIVE,
    latest({ items: [latestItem({ status: "completed" })] }),
    ORDER_ID,
  );
  assert.equal(state.kind, "completed");
  if (state.kind !== "completed") return;
  assert.deepEqual(Object.keys(state.request).sort(), ["id", "orderId", "requestedAt", "status"]);
});

/* ── 입력 검증(UX용) ──────────────────────────────────── */

test("사유를 고르지 않으면 보내지 않는다", () => {
  assert.deepEqual(checkRefundForm({ reason: "", message: "" }), {
    ok: false,
    message: "환불 문의 사유를 선택해 주세요.",
  });
  // 목록에 없는 값도 막는다. 자유 문자열은 저장되지 않는다.
  assert.equal(checkRefundForm({ reason: "made-up", message: "" }).ok, false);
});

test("기타 + 빈 내용은 거절한다", () => {
  assert.deepEqual(checkRefundForm({ reason: "other", message: "   " }), {
    ok: false,
    message: "자세한 내용을 적어 주세요.",
  });
  assert.deepEqual(checkRefundForm({ reason: "other", message: "사정이 생겼습니다." }), {
    ok: true,
  });
});

test("기타가 아니면 내용은 선택이다", () => {
  for (const option of REFUND_REASON_OPTIONS) {
    if (option.value === "other") continue;
    assert.deepEqual(checkRefundForm({ reason: option.value, message: "" }), { ok: true });
  }
});

test("500자는 되고 501자는 안 된다", () => {
  assert.equal(REFUND_MESSAGE_MAX, 500);
  assert.deepEqual(checkRefundForm({ reason: "schedule", message: "가".repeat(500) }), {
    ok: true,
  });
  assert.deepEqual(checkRefundForm({ reason: "schedule", message: "가".repeat(501) }), {
    ok: false,
    message: "자세한 내용은 500자까지 입력할 수 있습니다.",
  });
});

test("사유 5종을 화면에 모두 내민다", () => {
  assert.deepEqual(
    REFUND_REASON_OPTIONS.map((option) => option.value),
    ["change-of-mind", "schedule", "service-issue", "duplicate-payment", "other"],
  );
});

/* ── 상담 상세에서 영역을 띄울 조건 (Refund-Customer-Consultation-UI-1) ── */

const USER_ID = "u-1";
const CONSULT_ID = "c-is-abc";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: CONSULT_ID,
    userId: USER_ID,
    product: "consultation",
    title: "1:1 사주상담",
    status: "신청접수",
    amount: 100000,
    payment: "신용/체크카드",
    details: {},
    createdAt: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

test("정상 상담 + 같은 회원의 상담 주문이면 띄운다", () => {
  assert.equal(canRequestConsultationRefund(order(), USER_ID, CONSULT_ID), true);
});

test("짝이 되는 주문이 없으면 띄우지 않는다", () => {
  assert.equal(canRequestConsultationRefund(null, USER_ID, CONSULT_ID), false);
  assert.equal(canRequestConsultationRefund(undefined, USER_ID, CONSULT_ID), false);
});

test("다른 회원의 주문으로는 띄우지 않는다", () => {
  assert.equal(canRequestConsultationRefund(order({ userId: "u-2" }), USER_ID, CONSULT_ID), false);
  // 세션이 비어 있으면 어떤 주문으로도 띄우지 않는다.
  assert.equal(canRequestConsultationRefund(order(), "", CONSULT_ID), false);
  assert.equal(canRequestConsultationRefund(order(), "   ", CONSULT_ID), false);
});

test("상담 결제 주문이 아니면 띄우지 않는다", () => {
  for (const product of ["story", "premium", "saju-song"] as const) {
    assert.equal(canRequestConsultationRefund(order({ product }), USER_ID, CONSULT_ID), false);
  }
});

test("지금 보는 상담과 다른 주문이면 띄우지 않는다", () => {
  assert.equal(canRequestConsultationRefund(order({ id: "c-other" }), USER_ID, CONSULT_ID), false);
});

/* ── 상세 대표 상태 판단 (Refund-Completed-Detail-Presentation-1) ── */

test("completed면 참이다", () => {
  assert.equal(
    hasCompletedRefundForOrder(latest({ items: [latestItem({ status: "completed" })] }), ORDER_ID),
    true,
  );
});

test("completed가 아닌 상태는 전부 거짓이다", () => {
  for (const status of ["requested", "reviewing", "approved", "rejected"] as const) {
    assert.equal(
      hasCompletedRefundForOrder(latest({ items: [latestItem({ status })] }), ORDER_ID),
      false,
      status,
    );
  }
});

test("읽지 못한 응답을 환불 완료로 추정하지 않는다", () => {
  assert.equal(
    hasCompletedRefundForOrder(
      { items: [latestItem({ status: "completed" })], loaded: false },
      ORDER_ID,
    ),
    false,
  );
  assert.equal(hasCompletedRefundForOrder(undefined, ORDER_ID), false);
  assert.equal(hasCompletedRefundForOrder(null, ORDER_ID), false);
});

test("다른 주문의 환불 완료는 이 주문에 영향을 주지 않는다", () => {
  assert.equal(
    hasCompletedRefundForOrder(
      latest({ items: [latestItem({ orderId: "o-other", status: "completed" })] }),
      ORDER_ID,
    ),
    false,
  );
});

test("이력이 없거나 주문 id가 비어 있으면 거짓이다", () => {
  assert.equal(hasCompletedRefundForOrder(latest(), ORDER_ID), false);
  assert.equal(
    hasCompletedRefundForOrder(latest({ items: [latestItem({ status: "completed" })] }), "  "),
    false,
  );
});
