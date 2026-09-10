import { NextResponse } from "next/server";
import {
  LOGIN_DEFAULT_PATH,
  LOGIN_NEXT_COOKIE,
  SOCIAL_LINK_VERIFY_PATH,
  safeNextPath,
} from "@/lib/loginRedirect";
import { setUserId } from "@/lib/server/session";
import { createSocialLinkPending } from "@/lib/server/socialLink";
import { readData, writeData } from "@/lib/server/store";
import {
  KAKAO_STATE_COOKIE,
  KAKAO_TOKEN_URL,
  KAKAO_USER_URL,
  kakaoConfig,
  loginErrorUrl,
} from "@/lib/server/kakao";

export const dynamic = "force-dynamic";

interface KakaoTokenResponse {
  access_token?: string;
}

interface KakaoUserResponse {
  id?: number | string;
  kakao_account?: {
    profile?: { nickname?: string };
  };
}

/**
 * 카카오 인가 코드를 받아 토큰 교환 → 사용자 조회까지 마친 뒤,
 * 카카오 사용자 ID로 기존 회원을 찾는다. 이미 연결된 계정이면 그대로 로그인하고,
 * 처음 보는 계정이면 회원을 만들지 않고 대기 상태만 남긴 뒤 휴대폰 인증 화면으로 보낸다.
 * 세션은 기존 연락처 로그인과 동일하게 setUserId() 쿠키를 그대로 쓴다.
 * 어떤 단계에서 실패하든 사용자는 /login 으로 안전하게 되돌아간다.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const fail = (reason: string) => {
    const response = NextResponse.redirect(loginErrorUrl(origin, reason));
    response.cookies.delete(KAKAO_STATE_COOKIE);
    return response;
  };

  const config = kakaoConfig();
  if (!config) return fail("kakao_config");

  // 사용자가 카카오 화면에서 취소한 경우도 여기로 돌아온다.
  if (requestUrl.searchParams.get("error")) return fail("kakao_cancelled");

  const code = requestUrl.searchParams.get("code") ?? "";
  const state = requestUrl.searchParams.get("state") ?? "";
  const savedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${KAKAO_STATE_COOKIE}=`))
    ?.slice(KAKAO_STATE_COOKIE.length + 1);

  if (!code) return fail("kakao_code");
  if (!state || !savedState || state !== savedState) return fail("kakao_state");

  let kakaoId = "";
  let nickname = "";
  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.restApiKey,
      redirect_uri: config.redirectUri,
      code,
    });
    if (config.clientSecret) tokenBody.set("client_secret", config.clientSecret);

    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: tokenBody,
      cache: "no-store",
    });
    if (!tokenRes.ok) return fail("kakao_token");
    const token = (await tokenRes.json()) as KakaoTokenResponse;
    if (!token.access_token) return fail("kakao_token");

    const userRes = await fetch(KAKAO_USER_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (!userRes.ok) return fail("kakao_profile");
    const profile = (await userRes.json()) as KakaoUserResponse;
    if (profile.id === undefined || profile.id === null) return fail("kakao_profile");

    kakaoId = String(profile.id);
    nickname = (profile.kakao_account?.profile?.nickname ?? "").trim();
  } catch {
    return fail("kakao_network");
  }

  const data = await readData();
  const user = data.users.find((item) => item.kakaoId === kakaoId);
  if (!user) {
    // 처음 보는 카카오 계정: 회원을 만들지 않고 휴대폰 인증까지 대기 상태로만 둔다.
    await createSocialLinkPending({ provider: "kakao", providerUserId: kakaoId, nickname });
    const pendingResponse = NextResponse.redirect(new URL(SOCIAL_LINK_VERIFY_PATH, origin));
    pendingResponse.cookies.delete(KAKAO_STATE_COOKIE);
    // login_next는 인증을 마친 뒤 복귀에 써야 하므로 여기서 지우지 않는다.
    return pendingResponse;
  }
  if (nickname && !user.name) {
    user.name = nickname;
  }
  await writeData(data);
  await setUserId(user.id);

  // 신청 화면에서 로그인으로 넘어온 경우 그 자리로 되돌려 보낸다.
  const savedNext = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOGIN_NEXT_COOKIE}=`))
    ?.slice(LOGIN_NEXT_COOKIE.length + 1);
  // 쿠키 값은 저장될 때 인코딩되므로 되돌린 뒤 검사한다.
  const next = safeNextPath(savedNext ? decodeURIComponent(savedNext) : null);
  const response = NextResponse.redirect(new URL(next ?? LOGIN_DEFAULT_PATH, origin));
  response.cookies.delete(KAKAO_STATE_COOKIE);
  response.cookies.delete(LOGIN_NEXT_COOKIE);
  return response;
}
