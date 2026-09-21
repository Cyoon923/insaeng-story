/**
 * 관리자 전용 일반 문의·채팅 정리 사전 확인 (Privacy-Inquiries-Chat-Cleanup-3).
 *
 * 사람이 손으로 한 번 눌러 보는 자리다. **아무것도 지우지 않는다.**
 * 같은 90일 규칙으로 "지금 몇 건이 만료 상태인가"만 센다.
 *
 * 기존 /api/admin/cleanup-preflight와 나란히 두는 이유
 * - 그쪽은 "지금 DB 모드인가" 하나만 보는 자리이고, 건수를 세지 않기로 정해 둔 곳이다
 *   (세려면 스키마를 먼저 바꿔야 해서 확인하는 자리가 아니게 되기 때문이다).
 * - 이 정리는 사정이 다르다. chat_inquiries·app_store 모두 이미 있는 구조라
 *   CREATE도 ALTER도 없이 셀 수 있다. 그래서 그 파일의 뜻을 바꾸지 않고 따로 둔다.
 *
 * 보내는 문장은 SELECT count(*) 하나뿐이고, app_store는 기존 읽기 경로로 읽는다.
 * DELETE·UPDATE·writeData를 부르지 않으며, 부를 수단도 이 파일에 없다.
 *
 * 응답에는 건수와 시각만 담긴다. 문의 id·이름·연락처·본문·회원 정보·SQL·접속 정보·
 * 받은 오류는 담지 않는다.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/chatInquiryApi";
import {
  defaultInquiryCleanupDeps,
  runInquiryChatCleanupPreflight,
} from "@/lib/server/inquiryChatCleanupStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 거절 사유마다 상태 코드가 하나로 정해져 있다. 문구도 고정이다. */
const FAILURE = {
  "invalid-now": { status: 500, message: "기준 시각을 만들지 못했습니다." },
  "database-required": { status: 409, message: "데이터베이스 모드에서만 확인할 수 있습니다." },
  "count-failed": { status: 500, message: "만료 건수를 확인하지 못했습니다." },
} as const;

export async function POST() {
  // 1) 관리자 확인이 가장 먼저다. 여기서 막히면 질의를 한 번도 보내지 않는다.
  const denied = await requireAdmin();
  if (denied) return denied;

  // 2) 기준 시각은 여기서 한 번만 만든다. 그대로 checkedAt이 되고 cutoff의 기준이 된다.
  const now = new Date().toISOString();

  let result;
  try {
    // 읽는 수단만 넘긴다. 쓰는 수단(writeData)은 넘기지 않는다.
    result = await runInquiryChatCleanupPreflight(
      { readData: defaultInquiryCleanupDeps().readData },
      now,
    );
  } catch {
    // 받은 오류는 버린다. 문장·인자·접속 정보가 섞여 있을 수 있다.
    console.warn("[inquiry-chat-preflight] count failed");
    return NextResponse.json(
      { error: "count-failed", message: FAILURE["count-failed"].message },
      { status: FAILURE["count-failed"].status },
    );
  }

  if (!result.ok) {
    const failure = FAILURE[result.reason];
    return NextResponse.json(
      { error: result.reason, message: failure.message },
      { status: failure.status },
    );
  }

  return NextResponse.json({
    action: "expired-inquiries-chat-preflight",
    checkedAt: result.checkedAt,
    cutoff: result.cutoff,
    expiredLegacyInquiries: result.expiredLegacyInquiries,
    expiredChatInquiries: result.expiredChatInquiries,
  });
}
