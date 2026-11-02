/**
 * 결제 ↔ 주문 연결 호출 규칙 (결정적 주문 id).
 *
 * 실행: npx tsx --test src/lib/server/paymentOrderLinkRules.test.ts
 *
 * payments.order_id를 쓰는 함수 중 writeDataWithOrderForPayment는 연결 UPDATE에 order_id 조건이 없다.
 * 그래도 안전한 이유는 "모든 호출부가 같은 결제의 결정적 id(orderIdForPayment / consultationIdForPayment)만 넘긴다"는
 * 규칙 때문이다(감사 결론). 새 호출부가 이 규칙을 깨면 이 테스트가 먼저 실패하도록 원문으로 고정한다.
 * 코드를 실행하지 않고 원문만 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../../", import.meta.url).pathname;
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** src 아래 테스트가 아닌 .ts/.tsx 원문 전부. */
function sources(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) {
        out.push({ path: full.slice(SRC.length), text: readFileSync(full, "utf8") });
      }
    }
  };
  walk(SRC);
  return out;
}

const RETURN = read("app/api/payments/nicepay/return/route.ts");
const RECOMMIT = read("app/api/admin/payments/recommit/route.ts");

test("writeDataWithOrderForPayment를 쓰는 곳은 카드 return·카드 recommit뿐이다", () => {
  const users = sources()
    // 호출(…Payment()이나 값 참조(: …Payment)만 센다. 주석 속 언급(retentionStore 등)은 제외한다.
    .filter(
      (f) =>
        f.path !== "lib/server/store.ts" &&
        /writeDataWithOrderForPayment\(|: writeDataWithOrderForPayment\b/.test(f.text),
    )
    .map((f) => f.path)
    .sort();
  assert.deepEqual(users, [
    "app/api/admin/payments/recommit/route.ts",
    "app/api/payments/nicepay/return/route.ts",
  ]);
});

test("카드 return: 주문·상담 확정 id는 결정적 id이고 같은 merchantOrderId로 연결한다", () => {
  assert.match(RETURN, /orderId: orderIdForPayment\(merchantOrderId\),/);
  assert.match(RETURN, /consultationId: consultationIdForPayment\(merchantOrderId\),/);
  assert.equal(RETURN.match(/writeDataWithOrderForPayment\(next, order, merchantOrderId\)/g)?.length, 2);
  // 승인 확정 UPDATE는 order_id를 넘기지 않는다(COALESCE로 기존 값 유지).
  const claim = RETURN.slice(RETURN.indexOf("await claimPaymentApproved({"), RETURN.indexOf("});", RETURN.indexOf("await claimPaymentApproved({")));
  assert.equal(/orderId/.test(claim), false);
});

test("카드 recommit: targetId는 결정적 id이고 확정·연결 모두 targetId만 쓴다", () => {
  assert.match(
    RECOMMIT,
    /const targetId =\s*kind === "consultation"\s*\? consultationIdForPayment\(merchantOrderId\)\s*: orderIdForPayment\(merchantOrderId\);/,
  );
  assert.match(RECOMMIT, /linkPaymentToOrder\(\{ merchantOrderId, orderId: targetId \}\)/);
  assert.match(RECOMMIT, /orderId: targetId,/);
  assert.match(RECOMMIT, /consultationId: targetId,/);
  assert.equal(RECOMMIT.match(/writeDataWithOrderForPayment\(next, order, merchantOrderId\)/g)?.length, 2);
});

test("linkPaymentToOrder 호출부는 카드 recommit 한 곳이다(결정적 id)", () => {
  const users = sources()
    .filter((f) => f.path !== "lib/server/store.ts" && /linkPaymentToOrder\(/.test(f.text))
    .map((f) => f.path)
    .sort();
  assert.deepEqual(users, ["app/api/admin/payments/recommit/route.ts"]);
});

test("markPaymentApproved(조건 없는 order_id 덮어쓰기)는 여전히 호출부가 없다", () => {
  const users = sources().filter((f) => f.path !== "lib/server/store.ts" && /markPaymentApproved\(/.test(f.text));
  assert.deepEqual(users.map((f) => f.path), []);
});
