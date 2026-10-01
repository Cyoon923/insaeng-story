/**
 * 상담원 문의 욕설 검사 테스트. 실행: node --test src/lib/server/chatProfanity.test.ts
 *
 * chatInquiries.ts는 DB 드라이버를 불러오므로 저장 전 차단 여부는 원문으로 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CHAT_PROFANITY_MESSAGE, containsBlockedExpression } from "./chatProfanity.ts";

test("명백한 욕설을 막는다", () => {
  for (const text of [
    "시발 왜 답이 없어요",
    "씨발",
    "이 병신아",
    "개새끼들",
    "ㅅㅂ 진짜",
    "미친년",
    "지랄하지 마세요",
    "좆같네",
    "FUCK you",
  ]) {
    assert.equal(containsBlockedExpression(text), true, text);
  }
});

test("공백·특수문자·숫자를 끼운 단순 우회를 막는다", () => {
  for (const text of [
    "병신년아",
    "병신 년아",
    "시 발",
    "시.발",
    "시1발",
    "씨-발",
    "ㅅ ㅂ",
    "병 신",
    "개 새 끼",
    "개 새끼",
    "시​발",
    "ｓｈｉｔ ｆｕｃｋ",
  ]) {
    assert.equal(containsBlockedExpression(text), true, text);
  }
});

test("정상 문장과 사주 용어·상담 문장은 통과한다", () => {
  for (const text of [
    "병신년 운세가 궁금합니다",
    "병신일주가 맞나요?",
    "병신 년 운세가 궁금해요",
    "병신 년 운세가 궁금합니다",
    "병신년 아니면 정유년인가요",
    "시발점이 언제인가요?",
    "18일에 상담하고 싶어요",
    "요즘 너무 힘들어요",
    "죽고 싶다는 생각이 들어요",
    "이혼 문제로 상담하고 싶어요",
    "남편의 바람 때문에 힘들어요",
    "폭력 문제로 상담받고 싶어요",
    "성관계 문제로 고민이 있어요",
    "신제품 출시 발표 시기를 보고 싶어요",
    "보지 못한 상담 답변이 있나요",
    "미친 듯이 바빠서 짜증나요",
    "프리미엄 인생곡 가격이 궁금합니다",
  ]) {
    assert.equal(containsBlockedExpression(text), false, text);
  }
});

test("차단 안내 문구", () => {
  assert.equal(CHAT_PROFANITY_MESSAGE, "부적절한 표현이 포함되어 있어 메시지를 보낼 수 없습니다.");
});

const SRC = readFileSync(new URL("./chatInquiries.ts", import.meta.url), "utf8");

/** export된 함수 하나의 본문. 다음 export까지 자른다. */
function bodyOf(name: string): string {
  const start = SRC.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, name);
  const end = SRC.indexOf("\nexport ", start + 1);
  return SRC.slice(start, end < 0 ? undefined : end);
}

test("chatInquiries는 차단 시 안내 문구로 ChatInquiryError를 던진다", () => {
  assert.match(SRC, /throw new ChatInquiryError\(CHAT_PROFANITY_MESSAGE\)/);
});

for (const name of ["createChatInquiry", "addCustomerMessage"]) {
  test(`${name}는 normalizeBody 다음, DB 작업 전에 검사한다`, () => {
    const body = bodyOf(name);
    const check = body.indexOf("assertCustomerMessageAllowed(body)");
    assert.ok(check > body.indexOf("normalizeBody("));
    assert.ok(check < body.indexOf("requireSql()"));
  });
}

test("addAgentMessage에는 검사를 적용하지 않는다", () => {
  assert.doesNotMatch(bodyOf("addAgentMessage"), /assertCustomerMessageAllowed|containsBlockedExpression/);
});
