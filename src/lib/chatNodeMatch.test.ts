/**
 * 도령 자유질문 매칭 회귀 테스트 (Stage 2 규칙 기반 1차).
 *
 * 실행: npx tsx --test src/lib/chatNodeMatch.test.ts
 *   (matchChatNode가 "use client" 컴포넌트 안에 있고 "@/..." 별칭을 쓰므로
 *    node --test로는 불러올 수 없다. 별칭과 tsx/JSX를 해석하는 tsx 런너로 돌린다.)
 *
 * 이 테스트가 지키는 것은 두 가지다.
 *   1) 이번에 넓힌 것(띄어쓰기·말끝)이 실제로 인식된다.
 *   2) 넓힌 대가로 기존 차단과 우선순위가 무너지지 않는다.
 * 특히 "관련 없는 문장이 아무 노드에나 붙지 않는다"를 함께 본다.
 * 인식률만 보면 과매칭이 늘었는지 알 수 없기 때문이다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { __chatMatchInternals } from "@/components/chat/ChatWidget";
import { CONSULTATION, LIFE_SONG_PRODUCTS } from "@/lib/constants/products";

const { matchChatNode, stripQuestionEnding, compactOf, CHAT_NODES, ROOT_CHOICES } =
  __chatMatchInternals;

/* ── 1. 기존 대표 표현 회귀 ─────────────────────────── */

test("기존 완전일치 표현이 그대로 같은 노드로 간다", () => {
  const cases: [string, string][] = [
    ["인생곡이 뭐야", "what-is"],
    ["인생곡이 뭐예요", "what-is"],
    ["상품 차이", "compare"],
    ["차이가 뭐야", "compare"],
    ["추천해줘", "choose"],
    ["이야기로 만드는 인생곡", "story"],
    ["프리미엄", "premium"],
    ["프리미엄 인생곡", "premium"],
    ["사주 인생곡", "saju-song"],
    ["사주곡", "saju-song"],
    ["선물", "gift"],
    ["부모님 선물", "gift-parents"],
  ];
  for (const [question, expected] of cases) {
    assert.equal(matchChatNode(question), expected, question);
  }
});

test("물음표와 앞뒤 공백은 예전처럼 무시한다", () => {
  assert.equal(matchChatNode("  인생곡이 뭐야?  "), "what-is");
  assert.equal(matchChatNode("프리미엄!"), "premium");
});

/* ── 2. 띄어쓰기 변형 ──────────────────────────────── */

test("띄어쓰기를 붙여 써도 같은 노드로 간다", () => {
  assert.equal(matchChatNode("사주인생곡"), "saju-song");
  assert.equal(matchChatNode("프리미엄인생곡"), "premium");
  assert.equal(matchChatNode("부모님선물"), "gift-parents");
  assert.equal(matchChatNode("상품차이"), "compare");
});

test("띄어쓰기를 더 넣어도 같은 노드로 간다", () => {
  assert.equal(matchChatNode("사주 인생 곡"), "saju-song");
  assert.equal(matchChatNode("부 모 님 선물"), "gift-parents");
});

test("compactOf는 공백만 없애고 나머지는 두다", () => {
  assert.equal(compactOf("사주 인생곡"), "사주인생곡");
  assert.equal(compactOf("프리미엄"), "프리미엄");
});

/* ── 3. 말끝 허용 (요청한 3개 포함) ─────────────────── */

test("요청한 말끝 표현이 인식된다", () => {
  assert.equal(matchChatNode("프리미엄이요"), "premium");
  assert.equal(matchChatNode("프리미엄인가요"), "premium");
  assert.equal(matchChatNode("사주곡이요"), "saju-song");
});

test("허용한 말끝만 떼고, 뗀 뒤 완전일치일 때만 잇는다", () => {
  assert.equal(matchChatNode("프리미엄예요"), "premium");
  assert.equal(matchChatNode("프리미엄인가"), "premium");
  assert.equal(matchChatNode("사주 인생곡이요"), "saju-song");
});

test("stripQuestionEnding은 말끝을 하나만 떼고 긴 것부터 본다", () => {
  assert.equal(stripQuestionEnding("프리미엄인가요"), "프리미엄");
  assert.equal(stripQuestionEnding("프리미엄이요"), "프리미엄");
  assert.equal(stripQuestionEnding("사주곡이요"), "사주곡");
  // 뗄 것이 없으면 null이다.
  assert.equal(stripQuestionEnding("프리미엄"), null);
  // 너무 짧아지면 떼지 않는다. "요"만 남겨 아무 데나 붙는 것을 막는다.
  assert.equal(stripQuestionEnding("요"), null);
  assert.equal(stripQuestionEnding("이요"), null);
});

test("일반 어미 제거기가 아니다", () => {
  /*
   * 허용 목록에 없는 말끝은 떼지 않는다. 떼기 시작하면 "프리미엄이" 같은 조각이
   * 키워드와 맞아 엉뚱한 노드로 간다.
   */
  assert.equal(stripQuestionEnding("프리미엄이"), null);
  assert.equal(stripQuestionEnding("프리미엄을"), null);
  assert.equal(stripQuestionEnding("프리미엄했다"), null);
});

/* ── 4. 개인 사주·운세 차단 (기존 유지) ─────────────── */

test("개인 사주와 운세 질문은 전용 노드로 간다", () => {
  // 못 알아들은 것이 아니라 하지 않기로 한 일이라 일반 fallback과 나눈다.
  for (const question of [
    "내 운세 알려줘",
    "사주 봐줘",
    "사주 봐주세요",
    "제 사주 풀이해 주세요",
    "올해 운세 어때",
  ]) {
    assert.equal(matchChatNode(question), "personal-saju", question);
  }
});

test("띄어쓰기로 차단을 빠져나가지 못한다", () => {
  /*
   * 공백 제거본까지 함께 보는 이유다. PERSONAL_WORDS에 "봐 주세요"와 "봐주세요"가
   * 모두 있지만, 새로 띄어 쓴 형태가 들어와도 막혀야 한다.
   */
  assert.equal(matchChatNode("사주 봐 주세요"), "personal-saju");
  assert.equal(matchChatNode("운 세 봐줘"), "personal-saju");
});

test("차단이 완전일치보다 먼저다", () => {
  // "사주 인생곡"은 노드가 있지만, 개인 풀이를 요청하면 상품 안내로 가지 않는다.
  assert.equal(matchChatNode("사주 인생곡 운세 봐줘"), "personal-saju");
});

/* ── 5. 모호 조합 차단 (기존 유지) ──────────────────── */

test("부모님과 가격이 섞이면 되묻는 노드로 간다", () => {
  // 답할 수 없는 질문이 아니라 갈래가 둘인 질문이라 문의로 보내지 않는다.
  assert.equal(matchChatNode("부모님 선물 가격"), "gift-or-price");
  assert.equal(matchChatNode("엄마 선물 얼마"), "gift-or-price");
  assert.equal(matchChatNode("아버지 인생곡 비용"), "gift-or-price");
});

test("띄어쓰기를 붙여도 모호 조합 판정은 그대로다", () => {
  assert.equal(matchChatNode("부모님선물가격"), "gift-or-price");
});

test("가격만 물으면 차단되지 않는다", () => {
  // 대상이 섞이지 않으면 무엇을 묻는지 분명하다.
  assert.notEqual(matchChatNode("가격 알려줘"), null);
});

/* ── 6. 과매칭 방지 ────────────────────────────────── */

test("관련 없는 문장만 일반 fallback으로 간다", () => {
  // null이면 호출부에서 fallback 노드가 된다. A(못 알아들음)만 여기로 온다.
  for (const question of [
    "오늘 날씨 어때",
    "점심 뭐 먹지",
    "ㅁㄴㅇㄹ",
    "asdf",
    "택배 언제 와요",
    "주차장 있나요",
  ]) {
    assert.equal(matchChatNode(question), null, question);
  }
});

test("빈 입력과 공백만 있는 입력은 null이다", () => {
  assert.equal(matchChatNode(""), null);
  assert.equal(matchChatNode("   "), null);
  assert.equal(matchChatNode("?"), null);
});

test("말끝만 있는 입력이 노드로 가지 않는다", () => {
  for (const question of ["요", "이요", "인가요", "예요"]) {
    assert.equal(matchChatNode(question), null, question);
  }
});

/* ── 7. A/B/C 전용 노드의 선택지 ───────────────────── */

test("B 노드는 1:1 사주상담을 바로 고를 수 있다", () => {
  const node = CHAT_NODES["personal-saju"];
  assert.ok(node.next?.includes("consulting"), "consulting이 있어야 한다");
  // 상담원 문의도 계속 고를 수 있어야 한다.
  assert.ok(node.next?.includes("contact"));
});

test("B 문구는 못 알아들었다고 말하지 않는다", () => {
  const { answer } = CHAT_NODES["personal-saju"];
  for (const banned of ["어려운 내용", "못 알아", "이해하지 못"]) {
    assert.equal(answer.includes(banned), false, banned);
  }
  // 하지 않는 일과 대신 갈 곳을 말한다.
  assert.ok(answer.includes("운세를 봐 드리지는 않아요"));
  assert.ok(answer.includes("1:1 사주상담"));
});

test("C 노드는 가격과 부모님 선물을 바로 고를 수 있다", () => {
  const node = CHAT_NODES["gift-or-price"];
  assert.ok(node.next?.includes("price"), "price가 있어야 한다");
  assert.ok(node.next?.includes("gift-parents"), "gift-parents가 있어야 한다");
});

test("C 문구는 되묻는다", () => {
  const { answer } = CHAT_NODES["gift-or-price"];
  assert.ok(answer.includes("어느 쪽이 궁금하신지"));
  assert.equal(answer.includes("어려운 내용"), false);
});

test("일반 fallback에서 대표 질문으로 바로 갈 수 있다", () => {
  const node = CHAT_NODES.fallback;
  for (const id of ROOT_CHOICES) {
    assert.ok(node.next?.includes(id), `${id}가 fallback 선택지에 있어야 한다`);
  }
  // 상담원 문의 버튼은 그대로 남는다.
  assert.ok(node.next?.includes("contact"));
});

test("세 경우가 서로 다른 노드로 간다", () => {
  const a = matchChatNode("오늘 날씨 어때") ?? "fallback";
  const b = matchChatNode("내 운세 알려줘");
  const c = matchChatNode("부모님 선물 가격");
  assert.equal(a, "fallback");
  assert.equal(b, "personal-saju");
  assert.equal(c, "gift-or-price");
  assert.equal(new Set([a, b, c]).size, 3);
});

test("새 노드가 노드 표에 실제로 있다", () => {
  // matchChatNode가 돌려준 id를 askNode가 CHAT_NODES에서 찾는다. 없으면 화면이 깨진다.
  for (const id of ["personal-saju", "gift-or-price", "fallback"] as const) {
    assert.ok(CHAT_NODES[id], id);
    assert.ok(CHAT_NODES[id].answer.length > 0, `${id} 답변이 비었다`);
  }
});

/* ── 8. 상품·상담 상세페이지 CTA ────────────────────── */

/** 상수에서 상품 하나를 꺼낸다. 없으면 테스트가 먼저 깨지게 둔다. */
function productOf(id: string) {
  const product = LIFE_SONG_PRODUCTS.find((item) => item.id === id);
  assert.ok(product, `${id} 상품 상수가 없다`);
  return product;
}

test("인생곡 3종 CTA는 상품 상수의 상세 주소와 같다", () => {
  for (const id of ["story", "premium", "saju-song"] as const) {
    const cta = CHAT_NODES[id].cta;
    assert.ok(cta, `${id}에 CTA가 있어야 한다`);
    assert.equal(cta.href, productOf(id).href, id);
  }
});

test("상담 CTA는 CONSULTATION.href와 같다", () => {
  const cta = CHAT_NODES.consulting.cta;
  assert.ok(cta);
  assert.equal(cta.href, CONSULTATION.href);
});

test("CTA는 신청 주소를 쓰지 않는다", () => {
  /*
   * 신청 경로는 비회원을 로그인 화면으로 돌려보낸다(proxy.ts의 matcher).
   * 도령은 비회원도 쓰므로 소개 화면으로 보낸다.
   */
  const applyHrefs = [
    ...LIFE_SONG_PRODUCTS.map((item) => item.applyHref),
    CONSULTATION.applyHref,
  ];
  for (const id of ["story", "premium", "saju-song", "consulting"] as const) {
    const href = CHAT_NODES[id].cta?.href;
    assert.ok(href);
    assert.equal(applyHrefs.includes(href), false, `${id}가 신청 주소를 쓴다`);
    assert.equal(href.startsWith("/apply/"), false, `${id}가 신청 경로다`);
  }
});

test("CTA 라벨이 목적을 바로 알 수 있게 적혀 있다", () => {
  const labels: [string, string][] = [
    ["story", "이야기로 만드는 인생곡 자세히 보기"],
    ["premium", "프리미엄 인생곡 자세히 보기"],
    ["saju-song", "사주 인생곡 자세히 보기"],
    ["consulting", "1:1 사주상담 자세히 보기"],
  ];
  for (const [id, label] of labels) {
    assert.equal(CHAT_NODES[id as keyof typeof CHAT_NODES].cta?.label, label, id);
  }
});

test("다른 노드에는 CTA가 붙지 않았다", () => {
  const allowed = new Set(["story", "premium", "saju-song", "consulting"]);
  for (const [id, node] of Object.entries(CHAT_NODES)) {
    if (allowed.has(id)) continue;
    assert.equal(node.cta, undefined, `${id}에 CTA가 생겼다`);
  }
});

test("CTA 주소가 비어 있지 않다", () => {
  // productHref는 상품을 못 찾으면 빈 문자열을 준다. 빈 링크가 화면에 나가면 안 된다.
  for (const id of ["story", "premium", "saju-song", "consulting"] as const) {
    const href = CHAT_NODES[id].cta?.href ?? "";
    assert.ok(href.startsWith("/"), `${id} 주소가 이상하다: ${href}`);
    assert.ok(href.length > 1, id);
  }
});
