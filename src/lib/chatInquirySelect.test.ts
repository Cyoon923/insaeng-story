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
const UNSEEN = readFileSync(new URL("./client/chatAgentUnseen.ts", import.meta.url), "utf8");
const HEADER = readFileSync(
  new URL("../components/layout/AppHeader.tsx", import.meta.url),
  "utf8",
);
const ADMIN = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const NOTES = readFileSync(
  new URL("../app/my/notifications/page.tsx", import.meta.url),
  "utf8",
);
/** 주석을 걷어낸 실행 코드. 설명에 적힌 낱말이 검사에 걸리지 않게 한다. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const WIDGET_CODE = stripComments(WIDGET);
const UNSEEN_CODE = stripComments(UNSEEN);
const HEADER_CODE = stripComments(HEADER);
const ADMIN_CODE = stripComments(ADMIN);
const NOTES_CODE = stripComments(NOTES);
/** 판정·기록·표시를 쓰는 화면 쪽 파일들. polling 금지는 이 셋 모두에 걸린다. */
const CLIENTS = [
  ["widget", WIDGET_CODE],
  ["header", HEADER_CODE],
  ["unseen", UNSEEN_CODE],
  ["notifications", NOTES_CODE],
] as const;

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
  assert.match(
    WIDGET_CODE,
    /if \(open && \(agentOpenRef\.current \|\| openAgentRequestedRef\.current\)\) \{/,
  );
  assert.match(WIDGET_CODE, /\}, \[open\]\);/);
});

test("polling이나 화면 전환 감시를 들이지 않는다", () => {
  for (const [name, code] of CLIENTS) {
    assert.doesNotMatch(code, /setInterval/, name);
    assert.doesNotMatch(code, /visibilitychange/, name);
    assert.doesNotMatch(code, /addEventListener\("focus"/, name);
    assert.doesNotMatch(code, /WebSocket|EventSource/, name);
  }
  assert.doesNotMatch(ADMIN_CODE, /setInterval/);
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
  // 저장소를 만지는 곳은 공용 helper 한 파일뿐이다(읽기 1 + 쓰기 1).
  assert.equal((UNSEEN_CODE.match(/localStorage\.(getItem|setItem|removeItem)/g) ?? []).length, 2);
  assert.doesNotMatch(WIDGET_CODE, /localStorage/);
  assert.doesNotMatch(HEADER_CODE, /localStorage/);
});

test("localStorage 접근은 모두 try/catch 안에 있다", () => {
  assert.match(UNSEEN_CODE, /try \{\s*return localStorage\.getItem\(AGENT_SEEN_KEY\);\s*\} catch \{/);
  assert.match(UNSEEN_CODE, /try \{\s*localStorage\.setItem\(AGENT_SEEN_KEY, value\);\s*\} catch \{/);
});

test("도령 버튼 N은 unseen 상태에만 붙는다", () => {
  // agentUnseen일 때만 N을 그린다.
  assert.match(WIDGET_CODE, /\{agentUnseen \? \(\s*<span[\s\S]{0,400}?>\s*N\s*<\/span>/);
  // false면 아무것도 그리지 않는다(같은 삼항의 else가 null이다).
  assert.match(WIDGET_CODE, /N\s*<\/span>\s*\)\s*: null\}/);
  // 새 답변이 있을 때 aria-label에 그 사실이 들어간다.
  assert.match(WIDGET_CODE, /agentUnseen\s*\?\s*"사주로그 안내 열기 \(새 상담원 답변 있음\)"/);
  // 상태는 boolean 하나뿐이다.
  assert.match(WIDGET_CODE, /const \[agentUnseen, setAgentUnseen\] = useState\(false\);/);
});

test("숫자 unread count를 새로 만들지 않는다", () => {
  for (const [name, code] of CLIENTS) {
    assert.doesNotMatch(code, /unreadCount|agentUnreadCount|unseenCount/, name);
  }
  // 도령 버튼과 종에 찍히는 글자는 개수가 아니라 N(New) 한 글자다.
  assert.match(WIDGET_CODE, />\s*N\s*<\/span>/);
  assert.match(HEADER_CODE, />\s*N\s*<\/span>/);
});

test("상단 종도 같은 unseen 기준으로 N을 붙인다", () => {
  // 판정은 공용 helper 하나를 쓴다(종만의 별도 시스템이 아니다).
  assert.match(HEADER_CODE, /import \{ AGENT_SEEN_EVENT, fetchUnseenAgentReply \} from "@\/lib\/client\/chatAgentUnseen";/);
  assert.match(HEADER_CODE, /fetchUnseenAgentReply\(\)\.then\(\(unseen\) => \{/);
  assert.match(HEADER_CODE, /\{agentUnseen \? \(\s*<span[\s\S]{0,400}?>\s*N\s*<\/span>/);
  assert.match(HEADER_CODE, /aria-label=\{agentUnseen \? "알림 \(새 상담원 답변 있음\)" : "알림"\}/);
  // 공용 helper는 기존 고객 목록 API만 쓴다(새 API 없음).
  assert.match(UNSEEN_CODE, /fetch\("\/api\/chat-inquiries\/me"\)/);
  assert.equal((UNSEEN_CODE.match(/fetch\(/g) ?? []).length, 1);
});

test("종을 누르는 것만으로는 읽음이 되지 않고, 이동 동작도 그대로다", () => {
  // 종은 여전히 /my/notifications로 가는 Link다.
  assert.match(HEADER_CODE, /<Link\s+href="\/my\/notifications"/);
  // 종 쪽에는 읽음 기록 호출이 없다.
  assert.doesNotMatch(HEADER_CODE, /writeAgentSeenAt/);
  assert.doesNotMatch(HEADER_CODE, /AGENT_SEEN_KEY/);
});

test("상담원 대화를 실제로 받아온 뒤에만 확인 시각을 적고 표시를 내린다", () => {
  // openAgentChat이 messages를 화면에 올린 다음 줄에서만 기록한다.
  assert.match(
    WIDGET_CODE,
    /setAgentMessages\(result\.messages\);\s*setAgentOpen\(true\);\s*writeAgentSeenAt\(result\.inquiry\.lastMessageAt\);\s*setAgentUnseen\(false\);/,
  );
  // 기록은 그 한 곳뿐이다. 버튼 클릭(setOpen)이나 자동 안내 화면에서는 적지 않는다.
  assert.equal((WIDGET_CODE.match(/writeAgentSeenAt\(/g) ?? []).length, 1);
  // 기록되면 같은 화면의 종도 함께 내려간다(공용 신호 하나로 알린다).
  assert.match(UNSEEN_CODE, /window\.dispatchEvent\(new Event\(AGENT_SEEN_EVENT\)\);/);
  assert.match(HEADER_CODE, /window\.addEventListener\(AGENT_SEEN_EVENT, onSeen\);/);
  assert.match(HEADER_CODE, /const onSeen = \(\) => setAgentUnseen\(false\);/);
  assert.doesNotMatch(WIDGET_CODE, /onClick=\{\(\) => \{[^}]*writeAgentSeenAt/);
});

test("배지 확인은 마운트 1회 + 패널 열기 때만 한다", () => {
  // 닫는 순간에는 다시 묻지 않는다.
  assert.match(WIDGET_CODE, /if \(!open\) \{\s*if \(mountLoadedRef\.current\) return;\s*mountLoadedRef\.current = true;\s*\}/);
  assert.match(WIDGET_CODE, /setAgentUnseen\(hasUnseenAgentReply\(found, readAgentSeenAt\(\)\)\);/);
  // 타임라인 재조회는 패널이 열려 있을 때만(또는 바깥에서 열기 부탁을 받았을 때만).
  assert.match(
    WIDGET_CODE,
    /if \(open && \(agentOpenRef\.current \|\| openAgentRequestedRef\.current\)\) \{/,
  );
});

/* ── 7. 관리자 첫 화면의 챗봇 문의 건수 ─────────────── */

test("관리자 화면을 읽을 때 챗봇 문의 목록도 한 번 부른다", () => {
  // 세션이 확인된 뒤(loadData 끝) 기존 목록 API를 그대로 한 번 부른다.
  assert.match(ADMIN_CODE, /setAuthed\(true\);\s*setLoading\(false\);\s*void loadChatThreads\(\);/);
  assert.match(ADMIN_CODE, /fetch\("\/api\/admin\/chat-inquiries", \{ cache: "no-store" \}\)/);
  // 첫 화면 숫자는 이 목록과 legacy 문의를 더해 만든다(새 count API 없음).
  assert.match(ADMIN_CODE, /chat: chatThreads\.length \+ chatItems\.length,/);
  assert.doesNotMatch(ADMIN_CODE, /chat-inquiries\/count|chat-inquiries-count/);
});

test("챗봇 문의 탭에 들어갈 때마다 최신 목록으로 다시 부른다", () => {
  assert.match(ADMIN_CODE, /if \(item\.id === "chat" && !chatLoading\) loadChatThreads\(\);/);
  // 최초 1회만 부르던 가드를 남겨 두지 않는다.
  assert.doesNotMatch(ADMIN_CODE, /chatLoaded/);
});

/* ── 8. MY 알림 페이지의 도령 답변 항목 ──────────────── */

test("알림 페이지도 같은 helper 하나로 판정한다", () => {
  assert.match(
    NOTES_CODE,
    /import \{\s*AGENT_SEEN_EVENT,\s*fetchUnseenAgentReply,\s*requestOpenAgentChat,\s*\} from "@\/lib\/client\/chatAgentUnseen";/,
  );
  assert.match(NOTES_CODE, /fetchUnseenAgentReply\(\)\.then\(\(unseen\) => \{/);
  // 별도 unread/count/read 상태를 만들지 않는다: boolean 하나뿐이다.
  assert.match(NOTES_CODE, /const \[agentUnseen, setAgentUnseen\] = useState\(false\);/);
  assert.doesNotMatch(NOTES_CODE, /unreadCount|unseenCount/);
  // 이 페이지는 chat 알림을 위해 새 API를 부르지 않는다(기존 fetchMe와 helper뿐).
  assert.doesNotMatch(NOTES_CODE, /fetch\("\/api\//);
});

test("unseen일 때만 도령 답변 항목을 보여 준다", () => {
  assert.match(
    NOTES_CODE,
    /\{agentUnseen \? \([\s\S]{0,600}?도령 상담원 답변이 도착했어요[\s\S]{0,300}?새 답변을 확인해 주세요\.[\s\S]{0,200}?\) : null\}/,
  );
});

test("알림 페이지는 읽음을 적지 않는다", () => {
  assert.doesNotMatch(NOTES_CODE, /writeAgentSeenAt/);
  assert.doesNotMatch(NOTES_CODE, /AGENT_SEEN_KEY/);
  assert.doesNotMatch(NOTES_CODE, /localStorage/);
  // 항목 클릭이 하는 일은 "열어 달라"는 부탁 하나뿐이다.
  assert.match(NOTES_CODE, /onClick=\{\(\) => requestOpenAgentChat\(\)\}/);
});

test("AGENT_SEEN_EVENT를 받으면 항목이 사라진다", () => {
  assert.match(NOTES_CODE, /const onSeen = \(\) => setAgentUnseen\(false\);/);
  assert.match(NOTES_CODE, /window\.addEventListener\(AGENT_SEEN_EVENT, onSeen\);/);
  assert.match(NOTES_CODE, /window\.removeEventListener\(AGENT_SEEN_EVENT, onSeen\);/);
});

test("도령 항목이 있으면 '받은 알림이 없습니다'로 보이지 않는다", () => {
  assert.match(NOTES_CODE, /notes\.length === 0 && !agentUnseen \?/);
  // 로그인 안내 문구는 그대로 둔다.
  assert.match(NOTES_CODE, /알림 기록은 로그인 후 저장됩니다\./);
  // 기존 알림 배열에 도령 항목을 끼워 넣지 않는다.
  assert.doesNotMatch(NOTES_CODE, /setNotes\(\[/);
});

/* ── 9. 알림 항목 클릭 → 도령 상담원 대화 열기 ──────── */

test("열기 부탁은 작은 custom event 하나로만 오간다", () => {
  assert.match(UNSEEN_CODE, /export const AGENT_OPEN_EVENT = "sajulog:chat-agent-open";/);
  assert.match(UNSEEN_CODE, /window\.dispatchEvent\(new Event\(AGENT_OPEN_EVENT\)\);/);
  assert.match(WIDGET_CODE, /window\.addEventListener\(AGENT_OPEN_EVENT, onOpenRequest\);/);
  assert.match(WIDGET_CODE, /window\.removeEventListener\(AGENT_OPEN_EVENT, onOpenRequest\)/);
  // Context·라우팅·전역 상태를 만들지 않는다.
  assert.doesNotMatch(WIDGET_CODE, /createContext|useContext/);
  assert.doesNotMatch(NOTES_CODE, /createContext|useContext/);
});

test("부탁을 받으면 기존 openAgentChat 경로로만 대화를 연다", () => {
  // id를 이미 알면 바로 기존 함수를 부른다.
  assert.match(WIDGET_CODE, /setOpen\(true\);\s*void openAgentChat\(id\);/);
  // 모르면 표시만 세우고, 목록을 받은 뒤 같은 함수로 잇는다.
  assert.match(WIDGET_CODE, /openAgentRequestedRef\.current = true;\s*setOpen\(true\);/);
  assert.match(
    WIDGET_CODE,
    /if \(open && \(agentOpenRef\.current \|\| openAgentRequestedRef\.current\)\) \{\s*openAgentRequestedRef\.current = false;\s*await openAgentChat\(found\.id\);/,
  );
  // 대화를 읽는 경로는 여전히 /me/[id] 하나뿐이다(새 fetch를 만들지 않았다).
  assert.equal(
    (WIDGET_CODE.match(/fetch\(`\/api\/chat-inquiries\/me\/\$\{encodeURIComponent\(inquiryId\)\}`\)/g) ?? [])
      .length,
    1,
  );
});

test("부탁을 받았다는 이유만으로는 읽음을 적지 않는다", () => {
  // 리스너 안에 읽음 기록이 없다.
  assert.doesNotMatch(
    WIDGET_CODE,
    /onOpenRequest = \(\) => \{[\s\S]{0,400}?writeAgentSeenAt/,
  );
  // 읽음은 여전히 타임라인을 받은 직후 한 곳뿐이다(실패하면 적지 않는다).
  assert.equal((WIDGET_CODE.match(/writeAgentSeenAt\(/g) ?? []).length, 1);
  assert.match(
    WIDGET_CODE,
    /setAgentMessages\(result\.messages\);\s*setAgentOpen\(true\);\s*writeAgentSeenAt\(result\.inquiry\.lastMessageAt\);/,
  );
});
