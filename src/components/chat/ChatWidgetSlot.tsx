"use client";

import { usePathname } from "next/navigation";
import { ChatWidget } from "./ChatWidget";

/**
 * 챗봇을 어디에 띄울지만 정하는 얇은 껍데기.
 *
 * 관리자 화면(/admin)에서는 도령이 플로팅 버튼이 상담원 답변 입력창 위에 겹쳐
 * 화면을 가린다. 관리자는 챗봇으로 문의할 일이 없으므로 그 경로에서만 그리지 않는다.
 * 판단을 여기서 하는 이유는 ChatWidget 안에 관리자 전용 조건을 넣지 않기 위해서다.
 * MobileShell은 서버 컴포넌트라 usePathname을 쓸 수 없어 이 껍데기가 대신 읽는다.
 */
export function ChatWidgetSlot() {
  const pathname = usePathname();
  // /admin 과 그 하위 경로만 제외한다. /administrator 같은 다른 경로는 그대로 둔다.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <ChatWidget />;
}
