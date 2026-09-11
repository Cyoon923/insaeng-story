import { NextResponse } from "next/server";
import { LOGIN_DEFAULT_PATH, LOGIN_NEXT_COOKIE, safeNextPath } from "@/lib/loginRedirect";
import { setUserId } from "@/lib/server/session";
import { getActiveUserId } from "@/lib/server/withdrawAccount";
import {
  createWithdrawVerification,
  OAUTH_PURPOSE_COOKIE,
  WITHDRAW_FAILED_PATH,
  WITHDRAW_PURPOSE,
  WITHDRAW_VERIFIED_PATH,
} from "@/lib/server/withdrawVerification";
import { emptyUser, readData, registerUser, writeData } from "@/lib/server/store";
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
      response.cookies.delete(KAKAO_STATE_COOKIE);
      response.cookies.delete(OAUTH_PURPOSE_COOKIE);
      return response;
    };

    // 확인 방향은 "세션 회원 → 그 회원의 연결 id" 다.
    // kakaoId로 회원을 찾으면 다른 계정으로 들어와도 성립해 버린다.
    const activeUserId = await getActiveUserId();
    if (!activeUserId) return withdrawFail("session");
    const current = await readData();
    const me = current.users.find((item) => item.id === activeUserId);
    if (!me) return withdrawFail("session");
    // 비밀번호가 있는 회원은 소셜 재인증 대상이 아니다. 비밀번호를 다시 받는다.
    if (me.passwordHash) return withdrawFail("password");
    if (!me.kakaoId || me.kakaoId !== kakaoId) return withdrawFail("mismatch");

    await createWithdrawVerification({
      userId: me.id,
      provider: "kakao",
      providerUserId: kakaoId,
    });
    const verified = NextResponse.redirect(new URL(WITHDRAW_VERIFIED_PATH, origin));
    verified.cookies.delete(KAKAO_STATE_COOKIE);
    verified.cookies.delete(OAUTH_PURPOSE_COOKIE);
    return verified;
  }

  const data = await readData();
  let user = data.users.find((item) => item.kakaoId === kakaoId);
  if (!user) {
    /**
     * 처음 보는 카카오 계정: 휴대폰 인증을 받지 않고 바로 회원을 만든다.
     * 번호는 비워 둔다. 주문·상담은 신청 1단계에서 번호를 직접 받으므로 진행에 지장이 없다.
     *
     * 같은 번호나 같은 이름의 기존 회원과 자동으로 합치지 않는다.
     * 계정 연결은 본인이 원할 때 completeSocialLink(휴대폰 인증)로만 한다.
     */
    user = registerUser(data, {
      ...emptyUser("", nickname || "카카오 회원"),
      kakaoId,
    });
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
  response.cookies.delete(KAKAO_STATE_COOKIE);
  response.cookies.delete(LOGIN_NEXT_COOKIE);
  response.cookies.delete(OAUTH_PURPOSE_COOKIE);
  return response;
}
