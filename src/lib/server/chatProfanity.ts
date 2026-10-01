/**
 * 상담원 문의 고객 메시지의 욕설 검사. 순수 함수만 둔다(DB·로그 없음).
 *
 * 방침
 * - 명백한 욕설·성적 비하·심한 인격 모욕만 막는다. 부정적 감정, 위기 표현,
 *   이혼·바람·폭력 같은 상담 주제는 막지 않는다. 놓치는 편이 오탐보다 낫다.
 * - 정규화는 비교용 문자열에만 한다. 저장되는 원문은 바꾸지 않는다.
 * - 자모 재조합·발음 추정은 하지 않는다. 오탐이 크게 늘기 때문이다.
 */

/** 차단 시 고객에게 보여 주는 문구. */
export const CHAT_PROFANITY_MESSAGE = "부적절한 표현이 포함되어 있어 메시지를 보낼 수 없습니다.";

/**
 * 막을 표현. 두 글자 이하는 띄어쓰기로 나뉜 낱말 안에서만 찾는다.
 * "출시 발표"처럼 낱말을 붙였을 때 생기는 오탐을 피하기 위해서다.
 * 세 글자 이상은 공백을 모두 뺀 문장 전체에서 찾는다("개 새끼" 대응).
 */
const BLOCKED = [
  "시발", "씨발", "씨바", "씨팔", "시팔", "썅", "좆", "병신", "븅신", "지랄",
  "ㅅㅂ", "ㅆㅂ", "ㅄ", "ㅂㅅ", "니미", "엠창", "느금", "창녀", "씹년", "씹새",
  "개새끼", "개새기", "개색기", "개색끼", "개세끼", "개쌔끼", "니애미", "니에미",
  "미친년", "미친놈", "미친새끼", "씹할", "걸레년", "화냥년", "fuck", "bitch",
];

/**
 * 막는 말과 겹치는 정상 용어. 검사 전에 먼저 지운다.
 * 병신(丙申)은 사주의 간지라 년·월·일·시와 함께 자주 쓰인다.
 */
const ALLOWED = [
  "병신년", "병신월", "병신일", "병신시", "병신생", "병신해", "시발점", "시발역",
];

/** NFKC, 소문자. 글자(한글·자모·영문 등)와 공백만 남긴다. "시.발", "시1발"이 "시발"이 된다. */
function clean(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\s]/gu, "");
}

const BLOCKED_SHORT = BLOCKED.map(clean).filter((word) => [...word].length <= 2);
const BLOCKED_LONG = BLOCKED.map(clean).filter((word) => [...word].length > 2);
/**
 * "병신 년"처럼 글자 사이에 공백이 있어도 허용어로 본다.
 * 바로 뒤에 부르는 말 "아"가 낱말 끝으로 붙으면("병신년아") 사람을 부르는 모욕이라 허용하지 않는다.
 * "병신년 아니면"처럼 "아"로 시작하는 다른 낱말은 그대로 허용한다.
 */
const ALLOWED_PATTERNS = ALLOWED.map(
  (word) => new RegExp(`${[...clean(word)].join("\\s*")}(?!\\s*아(?!\\p{L}))`, "gu"),
);

/**
 * 한 글자짜리 낱말이 이어지면 붙인다. "시 발", "ㅅ ㅂ" 같은 띄어쓰기 우회 대응이다.
 * 두 글자 이상 낱말은 붙이지 않는다.
 */
function wordsOf(text: string): string[] {
  const words: string[] = [];
  let previousSingle = false;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const single = [...word].length === 1;
    if (single && previousSingle) words[words.length - 1] += word;
    else words.push(word);
    previousSingle = single;
  }
  return words;
}

/** 막을 표현이 있으면 참. */
export function containsBlockedExpression(text: string): boolean {
  let target = clean(text);
  for (const pattern of ALLOWED_PATTERNS) target = target.replace(pattern, " ");

  const compact = target.replace(/\s+/g, "");
  if (BLOCKED_LONG.some((word) => compact.includes(word))) return true;
  return wordsOf(target).some((word) => BLOCKED_SHORT.some((blocked) => word.includes(blocked)));
}
