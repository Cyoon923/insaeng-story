import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { loginErrorUrl } from "@/lib/server/kakao";
import {
  NAVER_AUTHORIZE_URL,
  NAVER_STATE_COOKIE,
  naverConfig,
} from "@/lib/server/naver";
import {
  OAUTH_PURPOSE_COOKIE,
  OAUTH_PURPOSE_MAX_AGE,
  WITHDRAW_PURPOSE,
} from "@/lib/server/withdrawVerification";

export const dynamic = "force-dynamic";

/**
 * 네이버 로그인 시작점. CSRF 방지용 state를 만들어 httpOnly 쿠키에 남기고
 * 같은 값을 인가 URL에 실어 보낸다. callback에서 두 값을 대조한다.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const config = naverConfig();
  if (!config) {
    return NextResponse.redirect(loginErrorUrl(origin, "naver_config"));
  }

  const isWithdrawPurpose =
    new URL(request.url).searchParams.get("purpose") === WITHDRAW_PURPOSE;

  const state = randomBytes(16).toString("hex");
  const authorize = new URL(NAVER_AUTHORIZE_URL);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("state", state);

  // 일반 로그인은 네이버 로그인 세션이 남아 있어도 재인증을 요청한다.
  // 탈퇴 재인증(purpose=withdraw)은 "지금 로그인한 본인"을 확인하는 절차라
  // 재인증 요청을 끼우지 않고 기존 동작을 그대로 둔다.
  if (!isWithdrawPurpose) {
    authorize.searchParams.set("auth_type", "reauthenticate");
  }

  const response = NextResponse.redirect(authorize);
  response.cookies.set(NAVER_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  // 탈퇴 재인증으로 들어온 경우에만 목적을 남긴다. 일반 로그인은 이 쿠키가 없다.
  // 값은 서버만 읽고 쓰며, 콜백이 분기 여부와 관계없이 지운다.
  if (isWithdrawPurpose) {
    response.cookies.set(OAUTH_PURPOSE_COOKIE, WITHDRAW_PURPOSE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: OAUTH_PURPOSE_MAX_AGE,
    });
  }
  return response;
}
