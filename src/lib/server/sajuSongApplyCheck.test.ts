/**
 * 새 사주 인생곡 신청 규칙(checkSajuSongApply): 가사 수정 옵션 미판매, 가사 이름 사용(lyricNameUse) 필수.
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/sajuSongApplyCheck.test.ts
 *
 * 실제 /api/app POST(preparePayment)와 GET을 부른다. 세션·회원 상태·저장소(store)·환불 문의만
 * 대역으로 바꾸고 가격 계산·동의·검증은 실제 코드를 쓴다(preparePaymentCheckout.test.ts와 같은 방식).
 * DB·PG에 닿지 않는다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";
import { calcOrderAmount, checkSajuSongApply } from "./pricing.ts";
import { PROMOTION_PRICES } from "../constants/promotions.ts";

const created: Record<string, unknown>[] = [];

/** 예전 주문: lyricNameUse 없이 가사 수정 옵션이 남아 있는 확정 주문. */
const OLD_ORDER = {
  id: "o-old",
  userId: "u-1",
  product: "saju-song",
  title: "사주 인생곡",
  amount: 109000,
  status: "제작중",
  details: { name: "홍길동", options: "가사 수정 1회 추가", optionIds: "lyric-edit" },
  createdAt: "2026-09-01T00:00:00.000Z",
};

function appData() {
  return {
    users: [{ id: "u-1", name: "테스트", phone: "010-1234-5678", points: 0 }],
    orders: [],
    consultations: [],
    inquiries: [],
    reviews: [],
    wishlists: {},
    coupons: {},
    couponCodes: {},
    notifications: {},
    notificationSettings: {},
    codes: {},
    blockedSlots: [],
    adminPromo: null,
  };
}

mock.module("@/lib/server/session", {
  namedExports: {
    getUserId: async () => "u-1",
    setUserId: async () => {},
    clearUserId: async () => {},
    ensureDraftOwnerCookie: async () => {},
  },
});
mock.module("@/lib/server/withdrawAccount", { namedExports: { isActiveUser: () => true } });
mock.module("@/lib/server/refundRequests", {
  namedExports: {
    listActiveRefundRequestsByUser: async () => [],
    listLatestRefundRequestsByUser: async () => [],
  },
});
mock.module("@/lib/server/store", {
  namedExports: {
    readData: async () => appData(),
    isAppStoreConflict: () => false,
    nowId: () => "n1",
    normalizePhone: (value: string) => value.replace(/\D/g, ""),
    hasActiveCheckoutPayment: async () => false,
    createPayment: async (input: Record<string, unknown>) => {
      created.push(input);
      return { merchantOrderId: input.merchantOrderId, requestedAmount: input.requestedAmount };
    },
    listOrdersByUser: async () => [structuredClone(OLD_ORDER)],
  },
});

async function route() {
  return import("../../app/api/app/route.ts");
}

async function prepare(product: string, options: string[], details: Record<string, string>) {
  created.length = 0;
  const response = await (await route()).POST(
    new Request("https://example.test/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preparePayment",
        kind: "order",
        product,
        title: "인생곡",
        options,
        payment: "신용/체크카드",
        details: { applyConsent: "1", copyrightConsent: "1", ...details },
      }),
    }),
  );
  return { status: response.status, json: await response.json() };
}

test("새 사주 인생곡: lyricNameUse 없음·잘못된 값은 결제 준비를 막는다", async () => {
  const cases: Record<string, string>[] = [{}, { lyricNameUse: "" }, { lyricNameUse: "yes" }, { lyricNameUse: "INCLUDE" }];
  for (const details of cases) {
    const result = await prepare("saju-song", [], details);
    assert.equal(result.status, 400, JSON.stringify(details));
    assert.equal(result.json.error, "노래에 이름을 넣을지 선택해 주세요.");
    assert.equal(created.length, 0);
  }
});

test("새 사주 인생곡: include / exclude는 정상 결제 준비되고 snapshot에 그대로 남는다", async () => {
  for (const value of ["include", "exclude"]) {
    const result = await prepare("saju-song", ["photo-mv"], { lyricNameUse: value });
    assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(created.length, 1);
    assert.equal(created[0].requestedAmount, 149000);
    const snapshot = created[0].orderSnapshot as { details: Record<string, string> };
    assert.equal(snapshot.details.lyricNameUse, value);
  }
});

test("새 사주 인생곡: 가사 수정 옵션은 결제 준비를 막는다", async () => {
  const result = await prepare("saju-song", ["lyric-edit"], { lyricNameUse: "include" });
  assert.equal(result.status, 400);
  assert.match(result.json.error, /선택할 수 없는 옵션/);
  assert.equal(created.length, 0);
});

test("다른 인생곡 상품은 영향 없음: 가사 수정 옵션도, lyricNameUse 없이도 그대로 결제 준비된다", async () => {
  for (const product of ["story", "premium"]) {
    const base = calcOrderAmount(product, [])!.amount;
    const result = await prepare(product, ["lyric-edit"], {});
    assert.equal(result.status, 200, `${product} ${JSON.stringify(result.json)}`);
    assert.equal(created[0].requestedAmount, base + 10000);
  }
  assert.deepEqual(checkSajuSongApply("story", ["lyric-edit"], {}), { ok: true });
  assert.deepEqual(checkSajuSongApply("premium", ["lyric-edit"], {}), { ok: true });
});

test("예전 주문은 lyricNameUse가 없어도(가사 수정이 있어도) 조회가 그대로 된다", async () => {
  const response = await (await route()).GET();
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.orders.length, 1);
  assert.equal(json.orders[0].id, "o-old");
  assert.equal(json.orders[0].details.optionIds, "lyric-edit");
  assert.equal("lyricNameUse" in json.orders[0].details, false);
});

test("예전 데이터 재계산(승인·재확정·환불)은 그대로: calcOrderAmount는 가사 수정을 계속 계산한다", () => {
  const base = calcOrderAmount("saju-song", [])!.amount;
  assert.equal(calcOrderAmount("saju-song", ["lyric-edit"])!.amount, base + 10000);
});

test("OPEN EVENT 19,900원: 기본가와 옵션 합산", () => {
  assert.equal(PROMOTION_PRICES["saju-song-open-2026"].basePrice, 19900);
  assert.equal(calcOrderAmount("saju-song", [], "saju-song-open-2026")!.amount, 19900);
  assert.equal(calcOrderAmount("saju-song", ["photo-mv"], "saju-song-open-2026")!.amount, 69900);
  assert.equal(
    calcOrderAmount("saju-song", ["saju-consultation"], "saju-song-open-2026")!.amount,
    119900,
  );
});

test("0원 신청(createOrder)도 같은 규칙을 commitOrder 전에 본다", () => {
  const source = readFileSync(new URL("../../app/api/app/route.ts", import.meta.url), "utf8");
  const createOrder = source.slice(source.indexOf('if (action === "createOrder")'));
  const check = createOrder.indexOf("checkSajuSongApply(");
  const commit = createOrder.indexOf("await commitOrder(");
  assert.ok(check > 0 && check < commit, "commitOrder 전에 검사");
  assert.match(createOrder.slice(check, commit), /body\.product,/);
});
