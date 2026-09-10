import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  KAKAO_AUTHORIZE_URL,
  KAKAO_SCOPE,
  KAKAO_STATE_COOKIE,
  kakaoConfig,
  loginErrorUrl,
} from "@/lib/server/kakao";
import {
  OAUTH_PURPOSE_COOKIE,
  OAUTH_PURPOSE_MAX_AGE,
  WITHDRAW_PURPOSE,
} from "@/lib/server/withdrawVerification";

export const dynamic = "force-dynamic";

/**
 * 카카오 로그인 시작점. CSRF 방지용 state를 만들어 httpOnly 쿠키에 남기고
 * 같은 값을 인가 URL에 실어 보낸다. callback에서 두 값을 대조한다.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const config = kakaoConfig();
  if (!config) {
    return NextResponse.redirect(loginErrorUrl(origin, "kakao_config"));
  }

  const state = randomBytes(16).toString("hex");
  const authorize = new URL(KAKAO_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", config.restApiKey);
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", KAKAO_SCOPE);
  authorize.searchParams.set("state", state);

  const response = NextResponse.redirect(authorize);
  response.cookies.set(KAKAO_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  // 탈퇴 재인증으로 들어온 경우에만 목적을 남긴다. 일반 로그인은 이 쿠키가 없다.
  // 값은 서버만 읽고 쓰며, 콜백이 분기 여부와 관계없이 지운다.
  if (new URL(request.url).searchParams.get("purpose") === WITHDRAW_PURPOSE) {
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
