/**
 * 상담원 문의 보내기. 회원과 비회원 모두 쓴다.
 *
 * 회원이면 서명된 세션에서 얻은 활성 userId로, 비회원이면 httpOnly 쿠키의 토큰 해시로
 * 신원을 정한다. 어느 쪽이든 클라이언트가 보낸 신원 값은 쓰지 않는다.
 *
 * 진행 중(new/in_progress)인 문의방이 이미 있으면 새 방을 만들지 않고 그 방에 메시지를
 * 이어 붙인다. 한 사람과 주고받은 내용을 고객과 상담원이 한 대화창에서 계속 보기 위해서다.
 * 끝난 방(closed)밖에 없으면 새 방을 만든다.
 */
import { NextResponse } from "next/server";
import {
  createChatInquiry,
  addCustomerMessage,
  findOpenChatInquiryByGuestTokenHash,
  findOpenChatInquiryByUserId,
  getChatInquiryForGuest,
  getChatInquiryForUser,
  isChatContactMethod,
  normalizeMobilePhone,
  normalizeName,
  ChatInquiryError,
  type ChatInquiryThread,
} from "@/lib/server/chatInquiries";
import { ensureGuestTokenHash } from "@/lib/server/chatGuest";
import { getActiveUserId } from "@/lib/server/withdrawAccount";
import {
  badRequest,
  handleChatError,
  readJsonBody,
  toThreadView,
} from "@/lib/server/chatInquiryApi";

/** 문자열이 아닌 값을 String()으로 억지로 바꾸지 않는다. 객체가 이름으로 들어오는 일을 막는다. */
function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) return badRequest("요청 내용을 읽을 수 없습니다.");

  // 동의는 화면에서만 확인하지 않는다. 서버도 true인지 직접 본다.
  if (body.privacyAgreed !== true) {
    return badRequest("개인정보 수집·이용에 동의해 주세요.");
  }

  const name = text(body.name);
  const phone = text(body.phone);
  const contactMethod = text(body.contactMethod);
  const message = text(body.message);
  if (name === null || phone === null || contactMethod === null || message === null) {
    return badRequest("입력한 내용을 다시 확인해 주세요.");
  }

  try {
    // 기존 방을 이어 쓰는 경우에도 입력값 자체는 같은 기준으로 확인한다.
    // 확인만 하고 저장하지는 않는다. 기존 방의 고객정보는 그대로 둔다.
    normalizeName(name);
    normalizeMobilePhone(phone);
    if (!isChatContactMethod(contactMethod)) {
      throw new ChatInquiryError("연락받을 방법을 선택해 주세요.");
    }

    const userId = await getActiveUserId();
    // 회원은 userId로 방을 찾으므로 비회원 쿠키를 새로 발급하지 않는다.
    const guestTokenHash = userId ? null : await ensureGuestTokenHash();

    const open = userId
      ? await findOpenChatInquiryByUserId(userId)
      : await findOpenChatInquiryByGuestTokenHash(guestTokenHash as string);

    if (open) {
      const saved = await addCustomerMessage({
        inquiryId: open.id,
        userId,
        guestTokenHash,
        body: message,
      });
      if (saved) {
        const thread = userId
          ? await getChatInquiryForUser(open.id, userId)
          : await getChatInquiryForGuest(open.id, guestTokenHash as string);
        if (thread) return NextResponse.json(toThreadView(thread), { status: 201 });
      }
      // 찾은 직후 상담원이 그 방을 닫았을 수 있다. 그때는 아래에서 새 방을 만든다.
    }

    const created: ChatInquiryThread = await createChatInquiry({
      userId,
      guestTokenHash,
      name,
      phone,
      contactMethod,
      firstMessage: message,
    });

    return NextResponse.json(toThreadView(created), { status: 201 });
  } catch (error) {
    return handleChatError(error);
  }
}
