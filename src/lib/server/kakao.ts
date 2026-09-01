/**
 * 카카오 OAuth 공통 설정. 서버에서만 사용하며 키를 클라이언트로 내보내지 않는다.
 * 동의항목은 닉네임(profile_nickname)만 사용하고 이메일은 요구하지 않는다.
 */
export const KAKAO_STATE_COOKIE = "kakao_oauth_state";
export const KAKAO_SCOPE = "profile_nickname";

export const KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";
export const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
export const KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me";

export interface KakaoConfig {
  restApiKey: string;
  clientSecret: string;
  redirectUri: string;
}

/** 환경변수가 하나라도 비어 있으면 null. 호출부에서 로그인 화면으로 되돌린다. */
export function kakaoConfig(): KakaoConfig | null {
  const restApiKey = process.env.KAKAO_REST_API_KEY?.trim() ?? "";
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.KAKAO_REDIRECT_URI?.trim() ?? "";
  if (!restApiKey || !redirectUri) return null;
  return { restApiKey, clientSecret, redirectUri };
}

/** 실패는 항상 로그인 화면으로 되돌린다. 사용자에게는 사유만 짧게 알린다. */
export function loginErrorUrl(origin: string, reason: string): URL {
  const url = new URL("/login", origin);
  url.searchParams.set("error", reason);
  return url;
}
