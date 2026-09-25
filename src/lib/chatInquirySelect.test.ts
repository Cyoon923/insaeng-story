/**
 * 상담원 답변 표시 복구 회귀 테스트 (Stage 2 도령, A-1/A-2).
 *
 * 실행: npx tsx --test src/lib/chatInquirySelect.test.ts
 *   (선택 규칙이 "use client" 컴포넌트 안에 있고 "@/..." 별칭을 쓰므로
 *    node --test로는 불러올 수 없다. chatNodeMatch.test.ts와 같은 런너를 쓴다.)
 *
 * 순수 규칙(어느 문의방을 보여줄지, 끝난 방에 입력을 허용할지)은 함수를 직접 부른다.
 * 위젯이 "패널을 열 때마다 다시 조회하는가"는 함수로 부를 수 없으므로,
 * 저장소의 다른 구조 테스트와 같은 방식으로 원문을 글자로 읽어 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { __chatInquiryInternals } from "@/components/chat/ChatWidget";

const { pickAgentInquiry, isOpenInquiry, hasUnseenAgentReply, AGENT_SEEN_KEY } =
  __chatInquiryInternals;

const WIDGET = readFileSync(
  new URL("../components/chat/ChatWidget.tsx", import.meta.url),
  "utf8",
);
/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const WIDGET_CODE = WIDGET.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

type View = Parameters<typeof pickAgentInquiry>[0] extends (infer T)[] | undefined ? T : never;

function view(id: string, status: string, lastMessageAt: string): View {
  return { id, status, contactMethod: "카카오톡", createdAt: lastMessageAt, lastMessageAt };
}

/** 마지막 발신자까지 붙인 목록 응답 한 줄. */
function listed(lastMessageAt: string, sender?: "customer" | "agent"): View {
  return { ...view("i-1", "in_progress", lastMessageAt), ...(sender ? { lastMessageSender: sender } : {}) };
}

const REPLY_AT = "2026-09-26T10:00:00.000Z";

/* ── 1. 어느 문의방을 보여주는가 ─────────────────────── */

test("문의방이 없으면 null이다", () => {
  assert.equal(pickAgentInquiry(undefined), null);
  assert.equal(pickAgentInquiry([]), null);
});

test("진행 중인 방이 있으면 끝난 방보다 먼저 고른다", () => {
  const closedNewer = view("closed-1", "closed", "2026-09-26T10:00:00.000Z");
  const open = view("open-1", "in_progress", "2026-09-20T10:00:00.000Z");
  assert.equal(pickAgentInquiry([closedNewer, open])?.id, "open-1");
  assert.equal(pickAgentInquiry([open, closedNewer])?.id, "open-1");
  // 아직 상담원이 손대지 않은 new도 진행 중으로 본다.
  assert.equal(pickAgentInquiry([closedNewer, view("open-2", "new", "2026-09-01T00:00:00.000Z")])?.id, "open-2");
});

test("진행 중인 방이 없으면 가장 최근에 말이 오간 끝난 방을 고른다", () => {
  const older = view("closed-old", "closed", "2026-08-01T00:00:00.000Z");
  const newer = view("closed-new", "closed", "2026-09-25T00:00:00.000Z");
  assert.equal(pickAgentInquiry([older, newer])?.id, "closed-new");
  // 서버가 주는 순서에 기대지 않는다.
  assert.equal(pickAgentInquiry([newer, older])?.id, "closed-new");
});

/* ── 2. 끝난 방의 읽기 전용 정책 ─────────────────────── */

test("끝난 방은 읽을 수는 있어도 입력을 허용하지 않는다", () => {
  const closed = view("closed-1", "closed", "2026-09-25T00:00:00.000Z");
  // 고른다(= 열어서 답변을 읽을 수 있다).
  assert.equal(pickAgentInquiry([closed])?.id, "closed-1");
  // 입력창·전송 조건은 isOpenInquiry 하나만 본다.
  assert.equal(isOpenInquiry(closed), false);
  assert.equal(isOpenInquiry(view("a", "new", "x")), true);
  assert.equal(isOpenInquiry(view("b", "in_progress", "x")), true);
  assert.equal(isOpenInquiry(null), false);
});

test("끝난 방 진입 버튼은 읽기 전용임이 드러나는 문구를 쓴다", () => {
  assert.match(WIDGET_CODE, /지난 상담 답변 보기/);
  assert.match(WIDGET_CODE, /상담원과 대화 이어가기/);
  // 입력창은 여전히 isOpenInquiry로만 열린다.
  assert.match(WIDGET_CODE, /canSendAgentMessage =\s*\n?\s*!!agentInquiry && isOpenInquiry\(agentInquiry\)/);
});

/* ── 3. 패널을 열 때마다 다시 조회하는 구조 ──────────── */

test("최초 1회만 조회하던 가드를 두지 않는다", () => {
  assert.doesNotMatch(WIDGET_CODE, /inquiryLoadedRef/);
});

test("패널이 열릴 때 목록을 조회하고, 대화 화면이면 타임라인까지 다시 읽는다", () => {
  assert.match(WIDGET_CODE, /if \(!open\) \{[\s\S]{0,200}?\}[\s\S]{0,400}?fetch\("\/api\/chat-inquiries\/me"\)/);
  assert.match(WIDGET_CODE, /if \(open && agentOpenRef\.current\) await openAgentChat\(found\.id\);/);
  assert.match(WIDGET_CODE, /\}, \[open\]\);/);
});

test("polling이나 화면 전환 감시를 들이지 않는다", () => {
  assert.doesNotMatch(WIDGET_CODE, /setInterval/);
  assert.doesNotMatch(WIDGET_CODE, /visibilitychange/);
  assert.doesNotMatch(WIDGET_CODE, /addEventListener\("focus"/);
});

/* ── 4. 기존 생성·이어쓰기 경로는 그대로다 ───────────── */

test("문의 생성과 메시지 추가는 기존 API를 그대로 쓴다", () => {
  assert.match(WIDGET_CODE, /fetch\("\/api\/chat-inquiries", \{/);
  assert.match(WIDGET_CODE, /fetch\("\/api\/chat-inquiries\/me\/messages", \{/);
  assert.match(WIDGET_CODE, /fetch\(`\/api\/chat-inquiries\/me\/\$\{encodeURIComponent\(inquiryId\)\}`\)/);
  // 새 API를 만들지 않았다: chat-inquiries 호출은 위 네 곳뿐이다.
  assert.equal((WIDGET_CODE.match(/\/api\/chat-inquiries/g) ?? []).length, 4);
});

/* ── 5. 새 상담원 답변 판정 (dot 배지) ───────────────── */

test("상담원이 마지막으로 말했고 확인 기록이 없으면 새 답변으로 본다", () => {
  assert.equal(hasUnseenAgentReply(listed(REPLY_AT, "agent"), null), true);
  // 저장소를 읽지 못해 빈 값이 온 경우도 같다(readAgentSeenAt이 null을 준다).
  assert.equal(hasUnseenAgentReply(listed(REPLY_AT, "agent"), ""), true);
});

test("상담원 답변이 확인 시각보다 나중이면 새 답변이다", () => {
  assert.equal(
    hasUnseenAgentReply(listed(REPLY_AT, "agent"), "2026-09-26T09:59:59.999Z"),
    true,
  );
});

test("확인 시각과 답변 시각이 같으면 이미 본 것으로 본다", () => {
  assert.equal(hasUnseenAgentReply(listed(REPLY_AT, "agent"), REPLY_AT), false);
});

test("답변이 확인 시각보다 오래되었으면 새 답변이 아니다", () => {
  assert.equal(hasUnseenAgentReply(listed(REPLY_AT, "agent"), "2026-09-27T00:00:00.000Z"), false);
});

test("마지막으로 말한 사람이 고객이면 새 답변이 아니다", () => {
  assert.equal(hasUnseenAgentReply(listed(REPLY_AT, "customer"), null), false);
});

test("마지막 발신자를 알 수 없으면 새 답변으로 보지 않는다", () => {
  // 필드가 없는 예전 응답과도 안전하게 지낸다.
  assert.equal(hasUnseenAgentReply(listed(REPLY_AT), null), false);
  assert.equal(hasUnseenAgentReply(null, null), false);
});

test("날짜가 비었거나 깨져 있으면 새 답변으로 보지 않는다", () => {
  assert.equal(hasUnseenAgentReply(listed("", "agent"), null), false);
  assert.equal(hasUnseenAgentReply(listed("어제", "agent"), null), false);
  // 확인 시각 쪽이 깨진 경우는 확인 기록이 없는 것과 같게 본다.
  assert.equal(hasUnseenAgentReply(listed(REPLY_AT, "agent"), "깨진 값"), true);
});

/* ── 6. 배지가 붙는 자리와 읽음 기록 시점 ────────────── */

test("확인 시각은 sajulog_ 접두사 키 하나에만 담는다", () => {
  assert.equal(AGENT_SEEN_KEY, "sajulog_chat_agent_seen_at");
  // 이 키 말고 다른 저장소 칸을 새로 만들지 않는다.
  assert.equal((WIDGET_CODE.match(/localStorage\.(getItem|setItem|removeItem)/g) ?? []).length, 2);
  // 상수 선언 + 읽기 + 쓰기 + 테스트 출구, 네 곳뿐이다.
  assert.equal((WIDGET_CODE.match(/AGENT_SEEN_KEY/g) ?? []).length, 4);
});

test("localStorage 접근은 모두 try/catch 안에 있다", () => {
  assert.match(WIDGET_CODE, /try \{\s*return localStorage\.getItem\(AGENT_SEEN_KEY\);\s*\} catch \{/);
  assert.match(WIDGET_CODE, /try \{\s*localStorage\.setItem\(AGENT_SEEN_KEY, value\);\s*\} catch \{/);
});

test("점은 unseen 상태에만 붙고 숫자를 쓰지 않는다", () => {
  // 플로팅 버튼 영역에서 agentUnseen일 때만 점을 그린다.
  assert.match(WIDGET_CODE, /\{agentUnseen \? \(\s*<span[\s\S]{0,200}?rounded-full/);
  // 새 답변이 있을 때 aria-label에 그 사실이 들어간다.
  assert.match(WIDGET_CODE, /agentUnseen\s*\?\s*"사주로그 AI 안내 열기 \(새 상담원 답변 있음\)"/);
  // 숫자 카운트를 만들지 않는다: 상태는 boolean 하나뿐이다.
  assert.match(WIDGET_CODE, /const \[agentUnseen, setAgentUnseen\] = useState\(false\);/);
  assert.doesNotMatch(WIDGET_CODE, /unreadCount|agentUnreadCount/);
});

test("상담원 대화를 실제로 받아온 뒤에만 확인 시각을 적고 점을 내린다", () => {
  // openAgentChat이 messages를 화면에 올린 다음 줄에서만 기록한다.
  assert.match(
    WIDGET_CODE,
    /setAgentMessages\(result\.messages\);\s*setAgentOpen\(true\);\s*writeAgentSeenAt\(result\.inquiry\.lastMessageAt\);\s*setAgentUnseen\(false\);/,
  );
  // 기록은 그 한 곳뿐이다. 버튼 클릭(setOpen)이나 자동 안내 화면에서는 적지 않는다.
  assert.equal((WIDGET_CODE.match(/writeAgentSeenAt\(/g) ?? []).length, 2);
  assert.doesNotMatch(WIDGET_CODE, /onClick=\{\(\) => \{[^}]*writeAgentSeenAt/);
});

test("배지 확인은 마운트 1회 + 패널 열기 때만 한다", () => {
  // 닫는 순간에는 다시 묻지 않는다.
  assert.match(WIDGET_CODE, /if \(!open\) \{\s*if \(mountLoadedRef\.current\) return;\s*mountLoadedRef\.current = true;\s*\}/);
  assert.match(WIDGET_CODE, /setAgentUnseen\(hasUnseenAgentReply\(found, readAgentSeenAt\(\)\)\);/);
  // 타임라인 재조회는 패널이 열려 있을 때만.
  assert.match(WIDGET_CODE, /if \(open && agentOpenRef\.current\) await openAgentChat\(found\.id\);/);
});
