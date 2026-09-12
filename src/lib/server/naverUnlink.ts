/**
 * 네이버 연동 해제(Token Revocation). 회원탈퇴 직전에 한 번만 호출한다.
 *
 * 방침
 * - 탈퇴 재인증에서 받은 사용자 access token과 기존 앱 자격증명만 쓴다.
 * - 토큰·시크릿 값은 호출에만 쓰고 반환값·로그·오류 문구 어디에도 담지 않는다.
 * - 판정은 HTTP 상태 코드로만 한다. 성공 응답은 본문이 비어 있을 수 있어
 *   본문 파싱으로 성공을 판단하면 안 된다.
 *   (카카오와 달리 네이버 revoke는 상태 코드가 결과를 그대로 알려준다.)
 */
import { naverConfig } from "@/lib/server/naver";

/** 연동 해제 엔드포인트. 로그인·토큰 발급과는 다른 주소다. */
const NAVER_REVOKE_URL = "https://nid.naver.com/oauth2.0/revoke";

/**
 * ok     폐기했거나 이미 폐기되어 있었다. 어느 쪽이든 목적이 이뤄졌으므로 탈퇴를 계속한다.
 * failed 폐기하지 못했거나 결과를 알 수 없다. 탈퇴를 중단한다.
 */
export type NaverUnlinkResult = "ok" | "failed";

/**
 * 연동을 해제한다. 400/401/503 같은 실패 응답과 네트워크 오류는 전부 failed로 돌려준다.
 * 실패를 성공으로 바꾸지 않는 쪽이 안전하다. 탈퇴가 끝나면 naverId가 지워져
 * 어떤 계정을 해제해야 하는지 다시 알아낼 방법이 없기 때문이다.
 */
export async function unlinkNaver(accessToken: string): Promise<NaverUnlinkResult> {
  if (!accessToken) return "failed";

  const config = naverConfig();
  if (!config) return "failed";

  try {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      token: accessToken,
      token_type_hint: "access_token",
    });

    const response = await fetch(NAVER_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body,
      cache: "no-store",
      // 응답이 오지 않으면 탈퇴 요청 전체가 매달린다. 10초에서 끊고 실패로 본다.
      signal: AbortSignal.timeout(10_000),
    });

    // 200이면 폐기됐거나 이미 없는 토큰이다. 둘 다 연결이 남지 않은 상태다.
    // 본문은 비어 있을 수 있으므로 읽지 않는다.
    return response.status === 200 ? "ok" : "failed";
  } catch {
    // 네트워크 오류·타임아웃. 해제됐는지 알 수 없으므로 실패로 둔다.
    return "failed";
  }
}
