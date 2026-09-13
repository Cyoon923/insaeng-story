/**
 * 관리자 문의방 상세 조회와 상담 상태 변경.
 *
 * 관리자는 방 주인이 아니므로 id만으로 읽는다. 대신 모든 메서드가 관리자 세션을 먼저 본다.
 */
import { NextResponse } from "next/server";
import {
  getChatInquiryForAdmin,
  updateChatInquiryStatus,
} from "@/lib/server/chatInquiries";
import {
  badRequest,
  handleChatError,
  notFound,
  readJsonBody,
  requireAdmin,
  toAdminInquiryView,
  toAdminThreadView,
} from "@/lib/server/chatInquiryApi";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const thread = await getChatInquiryForAdmin(id);
    if (!thread) return notFound();
    return NextResponse.json(toAdminThreadView(thread));
  } catch (error) {
    return handleChatError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body) return badRequest("요청 내용을 읽을 수 없습니다.");

  try {
    const { id } = await params;
    // 값 검증은 updateChatInquiryStatus가 isChatInquiryStatus로 한다.
    // 허용되지 않은 값이면 ChatInquiryError가 올라와 400이 된다.
    const inquiry = await updateChatInquiryStatus(id, body.status);
    if (!inquiry) return notFound();
    return NextResponse.json({ inquiry: toAdminInquiryView(inquiry) });
  } catch (error) {
    return handleChatError(error);
  }
}
