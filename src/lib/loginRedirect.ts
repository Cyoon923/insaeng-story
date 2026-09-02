/**
 * 로그인 후 원래 가려던 신청 화면으로 돌려보내기 위한 공통 규칙.
 * 서버(미들웨어·OAuth 콜백)와 클라이언트(로그인 화면)가 함께 쓴다.
 */
export const LOGIN_NEXT_COOKIE = "login_next";

/** 로그인 뒤 기본 이동지. 돌아갈 곳이 없으면 여기로 보낸다. */
export const LOGIN_DEFAULT_PATH = "/my";

/**
 * 돌아갈 주소로 쓸 수 있는 값만 통과시킨다.
 * 외부 주소로 튕겨 보내지 못하도록 신청 플로우 경로만 허용한다.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/apply/")) return null;
  // "//example.com" 같은 프로토콜 상대 주소를 막는다.
  if (value.startsWith("//")) return null;
  return value;
}
