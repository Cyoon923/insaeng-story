/**
 * 상담원 답변 저장.
 *
 * 저장에 성공한 뒤 알림톡을 보내는 순서를 나중에 덧붙일 수 있도록,
 * 저장과 응답 사이에 다른 일을 끼워 두지 않는다. 이번 단계에서는 발송 코드가 없다.
 */
import { NextResponse } from "next/server";
import { addAgentMessage, getChatInquiryForAdmin } from "@/lib/server/chatInquiries";
import {
  badRequest,
  handleChatError,
  notFound,
  readJsonBody,
  requireAdmin,
  toMessageView,
} from "@/lib/server/chatInquiryApi";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body) return badRequest("요청 내용을 읽을 수 없습니다.");
  if (typeof body.message !== "string") return badRequest("답변 내용을 입력해 주세요.");

  try {
    const { id } = await params;

    // addAgentMessage는 없는 방과 끝난 방을 모두 null로 돌려준다.
    // 관리자에게는 둘을 구분해 알려 주는 편이 도움이 되므로 먼저 방을 읽는다.
    const existing = await getChatInquiryForAdmin(id);
    if (!existing) return notFound();
    if (existing.inquiry.status === "closed") {
      return NextResponse.json(
        { error: "상담이 종료된 문의입니다. 상태를 다시 진행 중으로 바꾼 뒤 답변해 주세요." },
        { status: 409 },
      );
    }

    // 길이·공백 검증은 데이터 계층의 normalizeBody가 한다(최대 1000자).
    const saved = await addAgentMessage(id, body.message);
    if (!saved) return notFound();

    return NextResponse.json({ message: toMessageView(saved) }, { status: 201 });
  } catch (error) {
    return handleChatError(error);
  }
}
