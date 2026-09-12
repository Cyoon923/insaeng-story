/**
 * 카카오 연결 끊기(unlink). 회원탈퇴 직전에 한 번만 호출한다.
 *
 * 방침
 * - 탈퇴 재인증에서 받은 사용자 access token만 쓴다. Admin Key는 쓰지 않는다.
 * - 토큰 값은 호출에만 쓰고 반환값·로그 어디에도 담지 않는다.
 * - 결과를 세 가지로만 나눈다. 호출한 쪽이 "탈퇴를 계속할지"를 이 값으로 판단한다.
 *   (nicepayApprove.ts가 승인 결과를 approved/declined/unknown으로 나누는 방식과 같다.)
 */
import { KAKAO_UNLINK_URL } from "@/lib/server/kakao";

/**
 * ok      연결을 끊었다. 탈퇴를 계속한다.
 * already 이미 끊겨 있었다. 목적이 이미 이뤄졌으므로 탈퇴를 계속한다.
 * failed  끊지 못했거나 결과를 알 수 없다. 탈퇴를 중단한다.
 */
export type KakaoUnlinkResult = "ok" | "already" | "failed";

/** 응답 본문 중 판정에 쓰는 값만 본다. 나머지는 읽지 않는다. */
interface KakaoErrorBody {
  code?: number;
}

/**
 * 이미 앱과 연결되어 있지 않은 사용자를 가리키는 카카오 오류 코드.
 * 이 경우에만 "목적이 이미 달성됨"으로 보고 탈퇴를 계속한다.
 *
 * -401(유효하지 않거나 만료된 토큰)은 여기에 넣지 않는다.
 * 연결이 실제로 끊겼는지 알 수 없는 상태라 성공으로 간주하면 안 된다.
 */
const ALREADY_UNLINKED_CODES = new Set([-101]);

/**
 * 연결을 끊는다. 네트워크 오류나 알 수 없는 응답은 전부 failed로 돌려준다.
 * 실패를 성공으로 바꾸지 않는 쪽이 안전하다. 탈퇴가 끝나면 kakaoId가 지워져
 * 어떤 계정을 끊어야 하는지 다시 알아낼 방법이 없기 때문이다.
 */
export async function unlinkKakao(accessToken: string): Promise<KakaoUnlinkResult> {
  if (!accessToken) return "failed";

  try {
    const response = await fetch(KAKAO_UNLINK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      cache: "no-store",
    });

    if (response.ok) return "ok";

    // 400·401 응답 중 -101(이미 연결되지 않은 사용자)만 성공으로 본다.
    // 같은 상태 코드라도 토큰 문제(-401)는 아래에서 failed로 떨어진다.
    if (response.status === 400 || response.status === 401) {
      try {
        const body = (await response.json()) as KakaoErrorBody;
        if (typeof body.code === "number" && ALREADY_UNLINKED_CODES.has(body.code)) {
          return "already";
        }
      } catch {
        // 본문을 읽지 못하면 판단할 수 없으므로 실패로 둔다.
      }
    }
    return "failed";
  } catch {
    // 네트워크 오류·타임아웃. 끊겼는지 알 수 없으므로 실패로 둔다.
    return "failed";
  }
}
