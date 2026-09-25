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

const { pickAgentInquiry, isOpenInquiry } = __chatInquiryInternals;

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
  assert.match(WIDGET_CODE, /if \(!open\) return;[\s\S]{0,400}?fetch\("\/api\/chat-inquiries\/me"\)/);
  assert.match(WIDGET_CODE, /if \(agentOpenRef\.current\) await openAgentChat\(found\.id\);/);
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
