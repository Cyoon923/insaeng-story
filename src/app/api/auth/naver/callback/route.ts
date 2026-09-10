import { NextResponse } from "next/server";
import {
  LOGIN_DEFAULT_PATH,
  LOGIN_NEXT_COOKIE,
  SOCIAL_LINK_VERIFY_PATH,
  safeNextPath,
} from "@/lib/loginRedirect";
import { setUserId } from "@/lib/server/session";
import { createSocialLinkPending } from "@/lib/server/socialLink";
import { getActiveUserId } from "@/lib/server/withdrawAccount";
import {
  createWithdrawVerification,
  OAUTH_PURPOSE_COOKIE,
  WITHDRAW_FAILED_PATH,
  WITHDRAW_PURPOSE,
  WITHDRAW_VERIFIED_PATH,
} from "@/lib/server/withdrawVerification";
import { readData, writeData } from "@/lib/server/store";
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
 * 네이버 고유 사용자 ID로 기존 회원을 찾는다. 이미 연결된 계정이면 그대로 로그인하고,
 * 처음 보는 계정이면 회원을 만들지 않고 대기 상태만 남긴 뒤 휴대폰 인증 화면으로 보낸다.
 * 세션은 기존 연락처 로그인과 동일하게 setUserId() 쿠키를 그대로 쓴다.
 * 어떤 단계에서 실패하든 사용자는 /login 으로 안전하게 되돌아간다.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const fail = (reason: string) => {
    const response = NextResponse.redirect(loginErrorUrl(origin, reason));
    response.cookies.delete(NAVER_STATE_COOKIE);
    // 목적 쿠키는 어느 경로로 끝나든 남기지 않는다.
    response.cookies.delete(OAUTH_PURPOSE_COOKIE);
    return response;
  };

  // 이 요청이 탈퇴 재인증인지. 쿠키가 없으면 지금까지와 같은 로그인 흐름이다.
  const purpose = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_PURPOSE_COOKIE}=`))
    ?.slice(OAUTH_PURPOSE_COOKIE.length + 1);

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

  /**
   * 탈퇴 재인증. 여기서 끝나며 아래 로그인 코드로는 내려가지 않는다.
   * setUserId()를 부르지 않고 User도 고치지 않는다. 본인 확인 토큰만 발급한다.
   * 실제 탈퇴는 이 토큰을 소비하는 별도 API가 하며 아직 만들지 않았다.
   */
  if (purpose === WITHDRAW_PURPOSE) {
    const withdrawFail = (reason: string) => {
      const response = NextResponse.redirect(
        new URL(`${WITHDRAW_FAILED_PATH}${reason}`, origin),
      );
      response.cookies.delete(NAVER_STATE_COOKIE);
      response.cookies.delete(OAUTH_PURPOSE_COOKIE);
      return response;
    };

    // 확인 방향은 "세션 회원 → 그 회원의 연결 id" 다.
    // naverId로 회원을 찾으면 다른 계정으로 들어와도 성립해 버린다.
    const activeUserId = await getActiveUserId();
    if (!activeUserId) return withdrawFail("session");
    const current = await readData();
    const me = current.users.find((item) => item.id === activeUserId);
    if (!me) return withdrawFail("session");
    // 비밀번호가 있는 회원은 소셜 재인증 대상이 아니다. 비밀번호를 다시 받는다.
    if (me.passwordHash) return withdrawFail("password");
    if (!me.naverId || me.naverId !== naverId) return withdrawFail("mismatch");

    await createWithdrawVerification({
      userId: me.id,
      provider: "naver",
      providerUserId: naverId,
    });
    const verified = NextResponse.redirect(new URL(WITHDRAW_VERIFIED_PATH, origin));
    verified.cookies.delete(NAVER_STATE_COOKIE);
    verified.cookies.delete(OAUTH_PURPOSE_COOKIE);
    return verified;
  }

  const data = await readData();
  const user = data.users.find((item) => item.naverId === naverId);
  if (!user) {
    // 처음 보는 네이버 계정: 회원을 만들지 않고 휴대폰 인증까지 대기 상태로만 둔다.
    await createSocialLinkPending({ provider: "naver", providerUserId: naverId, nickname });
    const pendingResponse = NextResponse.redirect(new URL(SOCIAL_LINK_VERIFY_PATH, origin));
    pendingResponse.cookies.delete(NAVER_STATE_COOKIE);
    pendingResponse.cookies.delete(OAUTH_PURPOSE_COOKIE);
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
  response.cookies.delete(NAVER_STATE_COOKIE);
  response.cookies.delete(LOGIN_NEXT_COOKIE);
  response.cookies.delete(OAUTH_PURPOSE_COOKIE);
  return response;
}
