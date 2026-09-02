import { NextResponse } from "next/server";
import { LOGIN_DEFAULT_PATH, LOGIN_NEXT_COOKIE, safeNextPath } from "@/lib/loginRedirect";
import { setUserId } from "@/lib/server/session";
import { emptyUser, readData, registerUser, writeData } from "@/lib/server/store";
import { loginErrorUrl } from "@/lib/server/kakao";
import {
  NAVER_STATE_COOKIE,
  NAVER_TOKEN_URL,
  NAVER_USER_URL,
  naverConfig,
} from "@/lib/server/naver";

export const dynamic = "force-dynamic";

interface NaverTokenResponse {
  access_token?: string;
  error?: string;
}

interface NaverUserResponse {
  resultcode?: string;
  response?: {
    id?: string;
    nickname?: string;
  };
}

/**
 * 네이버 인가 코드를 받아 토큰 교환 → 프로필 조회까지 마친 뒤,
 * 네이버 고유 사용자 ID로 기존 회원을 찾고 없으면 새로 만든다.
 * 세션은 기존 연락처 로그인과 동일하게 setUserId() 쿠키를 그대로 쓴다.
 * 어떤 단계에서 실패하든 사용자는 /login 으로 안전하게 되돌아간다.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const fail = (reason: string) => {
    const response = NextResponse.redirect(loginErrorUrl(origin, reason));
    response.cookies.delete(NAVER_STATE_COOKIE);
    return response;
  };

  const config = naverConfig();
  if (!config) return fail("naver_config");

  // 사용자가 네이버 동의 화면에서 취소한 경우도 여기로 돌아온다.
  if (requestUrl.searchParams.get("error")) return fail("naver_cancelled");

  const code = requestUrl.searchParams.get("code") ?? "";
  const state = requestUrl.searchParams.get("state") ?? "";
  const savedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${NAVER_STATE_COOKIE}=`))
    ?.slice(NAVER_STATE_COOKIE.length + 1);

  if (!code) return fail("naver_code");
  if (!state || !savedState || state !== savedState) return fail("naver_state");

  let naverId = "";
  let nickname = "";
  try {
    const tokenUrl = new URL(NAVER_TOKEN_URL);
    tokenUrl.searchParams.set("grant_type", "authorization_code");
    tokenUrl.searchParams.set("client_id", config.clientId);
    tokenUrl.searchParams.set("client_secret", config.clientSecret);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("state", state);

    const tokenRes = await fetch(tokenUrl, { cache: "no-store" });
    if (!tokenRes.ok) return fail("naver_token");
    // 네이버는 실패도 200으로 돌려주며 error 필드로 알린다.
    const token = (await tokenRes.json()) as NaverTokenResponse;
    if (token.error || !token.access_token) return fail("naver_token");

    const userRes = await fetch(NAVER_USER_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (!userRes.ok) return fail("naver_profile");
    const profile = (await userRes.json()) as NaverUserResponse;
    if (profile.resultcode !== "00" || !profile.response?.id) return fail("naver_profile");

    naverId = String(profile.response.id);
    nickname = (profile.response.nickname ?? "").trim();
  } catch {
    return fail("naver_network");
  }

  const data = await readData();
  let user = data.users.find((item) => item.naverId === naverId);
  if (!user) {
    // 이메일과 연락처는 제공 항목이 아니므로 비워 둔다. MY에서 직접 채운다.
    user = { ...emptyUser("", nickname || "네이버 회원"), naverId };
    registerUser(data, user);
  } else if (nickname && !user.name) {
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
  response.cookies.delete(NAVER_STATE_COOKIE);
  response.cookies.delete(LOGIN_NEXT_COOKIE);
  return response;
}
