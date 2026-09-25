/**
 * "아직 보지 못한 상담원 답변이 있는지"를 정하는 한 곳.
 *
 * 도령 위젯과 상단 알림 종이 같은 사실을 보게 하려고 여기에 모았다. 새 알림 시스템이 아니다.
 * 판단 재료는 둘뿐이다.
 *   1) 서버 사실: GET /api/chat-inquiries/me 응답의 lastMessageSender / lastMessageAt
 *   2) 브라우저 기록: localStorage 한 칸(마지막으로 상담원 대화를 확인한 시각)
 * 읽음 처리는 "상담원 대화의 최신 타임라인을 실제로 받아 화면에 올렸을 때"만 한다.
 * 종을 누른 것, 위젯을 연 것만으로는 읽음이 아니다.
 */

/** 확인 시각을 담는 칸. 기존 sajulog_ 접두사 관례를 따른다. */
export const AGENT_SEEN_KEY = "sajulog_chat_agent_seen_at";

/**
 * 읽음 기록이 바뀐 순간을 같은 화면의 다른 컴포넌트에 알리는 이름.
 * 상단 종은 도령 위젯 안쪽을 볼 수 없으므로 이 신호로 표시를 내린다.
 * 주기적으로 묻지 않는다(polling·focus·visibility 감시 없음).
 */
export const AGENT_SEEN_EVENT = "sajulog:chat-agent-seen";

/** 판정에 필요한 만큼만. /api/chat-inquiries/me 응답 한 줄의 부분집합이다. */
export interface ChatAgentInquiry {
  lastMessageAt: string;
  lastMessageSender?: "customer" | "agent";
}

/**
 * 아직 보지 못한 상담원 답변인지.
 *
 * 마지막 말이 상담원 것이고, 그 시각이 마지막으로 확인한 시각보다 나중일 때만 참이다.
 * 값이 없거나 날짜가 깨져 있으면 참으로 보지 않는다(같은 시각도 이미 본 것으로 본다).
 * 예외는 하나다. 상담원 답변은 있는데 확인 기록이 아예 없으면 아직 보지 않은 것이다.
 */
export function hasUnseenAgentReply(
  inquiry: ChatAgentInquiry | null,
  lastSeenAt: string | null,
): boolean {
  if (!inquiry || inquiry.lastMessageSender !== "agent") return false;
  const arrived = Date.parse(inquiry.lastMessageAt ?? "");
  if (Number.isNaN(arrived)) return false;
  if (!lastSeenAt) return true;
  const seen = Date.parse(lastSeenAt);
  if (Number.isNaN(seen)) return true;
  return arrived > seen;
}

/**
 * 확인 시각 읽기·쓰기. 브라우저 저장소를 쓸 수 없는 창(시크릿·차단)에서도
 * 도령이 그대로 동작해야 하므로 실패는 조용히 넘긴다. 표시만 한 번 더 보일 뿐이다.
 */
export function readAgentSeenAt(): string | null {
  try {
    return localStorage.getItem(AGENT_SEEN_KEY);
  } catch {
    return null;
  }
}

export function writeAgentSeenAt(value: string): void {
  try {
    localStorage.setItem(AGENT_SEEN_KEY, value);
  } catch {
    // 저장하지 못하면 다음에 표시가 한 번 더 보일 뿐이다. 기능은 그대로다.
  }
  try {
    window.dispatchEvent(new Event(AGENT_SEEN_EVENT));
  } catch {
    // 서버 렌더처럼 window가 없는 곳에서는 알릴 대상도 없다.
  }
}

/**
 * 지금 새 상담원 답변이 있는지 한 번 묻는다. 기존 고객 목록 API만 쓴다.
 * 문의방이 여럿이면 그중 하나라도 새 답변이면 참이다.
 * 실패하면 false다. 표시가 없을 뿐이고 다른 기능은 영향을 받지 않는다.
 */
export async function fetchUnseenAgentReply(): Promise<boolean> {
  try {
    const response = await fetch("/api/chat-inquiries/me");
    if (!response.ok) return false;
    const result = (await response.json()) as { inquiries?: ChatAgentInquiry[] };
    const lastSeenAt = readAgentSeenAt();
    return (result.inquiries ?? []).some((item) => hasUnseenAgentReply(item, lastSeenAt));
  } catch {
    return false;
  }
}
