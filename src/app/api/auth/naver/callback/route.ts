import { NextResponse } from "next/server";
import {
  LOGIN_DEFAULT_PATH,
  LOGIN_NEXT_COOKIE,
  SOCIAL_LINK_VERIFY_PATH,
  safeNextPath,
} from "@/lib/loginRedirect";
import { setUserId } from "@/lib/server/session";
import { getActiveUserId, isActiveUser } from "@/lib/server/withdrawAccount";
import {
  createWithdrawVerification,
  OAUTH_PURPOSE_COOKIE,
  WITHDRAW_FAILED_PATH,
  WITHDRAW_PURPOSE,
  WITHDRAW_VERIFIED_PATH,
} from "@/lib/server/withdrawVerification";
import { readData, writeData } from "@/lib/server/store";
import { createSocialLinkPending } from "@/lib/server/socialLink";
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
 * 네이버 고유 사용자 ID로 기존 활성 회원을 찾는다. 이미 연결된 계정이면 그대로 로그인하고,
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
  // 탈퇴 재인증에서만 쓴다. 일반 로그인 경로에서는 사용하지 않고 응답에도 담지 않는다.
  let accessToken = "";
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
    accessToken = token.access_token;
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
      // 탈퇴 직전 연동 해제에 쓴다. 서버 저장소에만 남고 5분 뒤 또는 소비 즉시 사라진다.
      accessToken,
    });
    const verified = NextResponse.redirect(new URL(WITHDRAW_VERIFIED_PATH, origin));
    verified.cookies.delete(NAVER_STATE_COOKIE);
    verified.cookies.delete(OAUTH_PURPOSE_COOKIE);
    return verified;
  }

  // 이름은 별명만 쓴다. 실명은 받지도 읽지도 않는다.
  // 별명이 없으면 빈 문자열이며, 신규 가입에서 기본값("네이버 회원")으로 채워진다.
  const displayName = nickname;

  const data = await readData();
  const user = data.users.find((item) => isActiveUser(item) && item.naverId === naverId);

  if (!user) {
    /**
     * 이미 로그인한 상태에서 처음 보는 네이버 계정으로 들어온 경우.
     * 대기 상태를 만들기 전에 여기서 끝낸다. 만들어 두면 휴대폰 인증까지 진행한 뒤
     * 마지막 단계(completeSocialLink)에서야 막혀 헛걸음이 된다.
     * 세션은 그대로 두고 회원도 만들지 않으며 연결도 하지 않는다.
     */
    if (await getActiveUserId()) {
      return fail("naver_logged_in");
    }

    /**
     * 처음 보는 네이버 계정: 여기서는 회원을 만들지 않는다.
     * provider 정보만 서버 대기 상태에 남기고 휴대폰 인증 화면으로 보낸다.
     * 인증을 마치면 그 번호의 회원에 연결하거나, 없을 때만 회원을 하나 만든다.
     * (연결·생성은 completeSocialLink가 한다)
     *
     * 같은 번호나 같은 이름의 기존 회원과 자동으로 합치지 않는다.
     * access token은 대기 상태에 담지 않는다.
     */
    await createSocialLinkPending({
      provider: "naver",
      providerUserId: naverId,
      nickname: displayName,
    });
    const pendingResponse = NextResponse.redirect(new URL(SOCIAL_LINK_VERIFY_PATH, origin));
    pendingResponse.cookies.delete(NAVER_STATE_COOKIE);
    pendingResponse.cookies.delete(OAUTH_PURPOSE_COOKIE);
    // 복귀 경로는 연결을 마친 뒤 completeSocialLink가 읽는다. 여기서 지우지 않는다.
    return pendingResponse;
  }

  if (displayName && !user.name) {
    // 이미 이름이 있는 회원은 건드리지 않는다. 본인이 고친 이름을 로그인이 덮으면 안 된다.
    user.name = displayName;
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
