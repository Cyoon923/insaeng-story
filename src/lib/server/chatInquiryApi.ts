/**
 * 고객용 상담원 문의 API의 공통 응답 형태와 오류 처리.
 *
 * 방침
 * - 응답에는 화면에 필요한 값만 담는다. 이름·연락처처럼 이미 고객이 입력한 값은 되돌려주지 않고,
 *   guest_token_hash 같은 내부 값은 어떤 경우에도 담지 않는다.
 * - 없는 방과 남의 방을 구분해 알려주지 않는다. 둘 다 404다.
 */
import { NextResponse } from "next/server";
import type {
  ChatInquiry,
  ChatInquiryListItem,
  ChatInquiryMessage,
  ChatInquirySender,
  ChatInquiryThread,
} from "@/lib/server/chatInquiries";
import { ChatInquiryError } from "@/lib/server/chatInquiries";
import { isAdminAuthenticated } from "@/lib/server/adminSession";

/**
 * 목록·상세에서 공통으로 쓰는 문의방 요약.
 *
 * lastMessageSender는 목록에서만 채워진다. 고객 화면이 "마지막 말이 상담원 것인지"만
 * 보고 새 답변 표시를 정하기 위한 값이다. 말의 본문은 담지 않는다.
 */
export interface ChatInquiryView {
  id: string;
  status: string;
  contactMethod: string;
  createdAt: string;
  lastMessageAt: string;
  lastMessageSender?: ChatInquirySender;
}

/**
 * 목록이 준 값(ChatInquiryListItem)이면 마지막 발신자를 함께 담고,
 * 상세·생성이 준 값(ChatInquiry)이면 그 칸 없이 예전과 같은 모양을 준다.
 * 저장된 값이 예상 밖이면 담지 않는다. 화면은 없는 값을 "새 답변 없음"으로 본다.
 */
export function toInquiryView(inquiry: ChatInquiry | ChatInquiryListItem): ChatInquiryView {
  const sender = (inquiry as ChatInquiryListItem).lastMessageSender;
  return {
    id: inquiry.id,
    status: inquiry.status,
    contactMethod: inquiry.contactMethod,
    createdAt: inquiry.createdAt,
    lastMessageAt: inquiry.lastMessageAt,
    ...(sender === "agent" || sender === "customer" ? { lastMessageSender: sender } : {}),
  };
}

export function toMessageView(message: ChatInquiryMessage) {
  return {
    id: message.id,
    sender: message.sender,
    body: message.body,
    createdAt: message.createdAt,
  };
}

/** 문의방 하나와 그 안의 메시지. 생성·상세 응답이 같은 모양을 쓴다. */
export function toThreadView(thread: ChatInquiryThread) {
  return {
    inquiry: toInquiryView(thread.inquiry),
    messages: thread.messages.map(toMessageView),
  };
}

/**
 * 관리자 화면에 필요한 값. 고객용 응답과 달리 이름·연락처를 함께 준다.
 * guest_token_hash는 애초에 ChatInquiry에 없고, userId는 지금 관리자 화면에서
 * 쓰지 않으므로 담지 않는다.
 */
export function toAdminInquiryView(inquiry: ChatInquiry) {
  return {
    id: inquiry.id,
    name: inquiry.name,
    phone: inquiry.phone,
    contactMethod: inquiry.contactMethod,
    status: inquiry.status,
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.updatedAt,
    lastMessageAt: inquiry.lastMessageAt,
  };
}

/** 관리자 상세. 메시지는 데이터 계층이 이미 created_at 오름차순으로 준다. */
export function toAdminThreadView(thread: ChatInquiryThread) {
  return {
    inquiry: toAdminInquiryView(thread.inquiry),
    messages: thread.messages.map(toMessageView),
  };
}

/**
 * 관리자 인증. 기존 관리자 API(/api/admin)와 같은 세션 쿠키와 같은 401 응답을 쓴다.
 * 통과하면 null을 돌려주고, 막히면 그대로 반환할 응답을 돌려준다.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdminAuthenticated()) return null;
  return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** 없는 방과 남의 방을 같은 응답으로 돌려준다. */
export function notFound() {
  return NextResponse.json({ error: "문의 내용을 찾을 수 없습니다." }, { status: 404 });
}

/** 본문이 JSON이 아니면 null. 객체가 아니어도 null이다. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 값이 잘못된 경우(ChatInquiryError)는 안내 문구를 그대로 400으로 보낸다.
 * 그 밖의 오류는 내부 사정을 드러내지 않도록 같은 문구로 500을 돌려준다.
 */
export function handleChatError(error: unknown) {
  if (error instanceof ChatInquiryError) return badRequest(error.message);
  console.error("[chat-inquiries]", error);
  return NextResponse.json(
    { error: "잠시 후 다시 시도해 주세요." },
    { status: 500 },
  );
}
