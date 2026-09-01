/**
 * 네이버 OAuth 공통 설정. 서버에서만 사용하며 키를 클라이언트로 내보내지 않는다.
 * 제공 항목은 네이버 개발자센터에서 별명만 사용하도록 설정하고,
 * 이메일·전화번호는 요청하지 않는다.
 */
export const NAVER_STATE_COOKIE = "naver_oauth_state";

export const NAVER_AUTHORIZE_URL = "https://nid.naver.com/oauth2.0/authorize";
export const NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token";
export const NAVER_USER_URL = "https://openapi.naver.com/v1/nid/me";

export interface NaverConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** 환경변수가 하나라도 비어 있으면 null. 호출부에서 로그인 화면으로 되돌린다. */
export function naverConfig(): NaverConfig | null {
  const clientId = process.env.NAVER_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.NAVER_REDIRECT_URI?.trim() ?? "";
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
