import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_NEXT_COOKIE } from "@/lib/loginRedirect";

/** 세션 쿠키. src/lib/server/session.ts와 같은 이름을 쓴다. */
const SESSION_COOKIE = "insaeng_uid";

/**
 * 신청 절차는 회원만 진행할 수 있다. 상품·상담 소개 화면은 그대로 열어 두고,
 * 실제 신청 단계에 들어올 때만 로그인 화면으로 보낸다.
 * 돌아갈 주소는 쿼리와 쿠키에 함께 남겨, 일반 로그인과 소셜 로그인이
 * 같은 경로로 복귀하도록 한다.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const next = `${pathname}${search}`;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(LOGIN_NEXT_COOKIE, next, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}

/** 무료 상담·이벤트(/apply/free-consult, /apply/event)는 비회원도 접수하므로 제외한다. */
export const config = {
  matcher: [
    "/apply/story-song/:path*",
    "/apply/premium/:path*",
    "/apply/saju-song/:path*",
    "/apply/consultation/:path*",
  ],
};
