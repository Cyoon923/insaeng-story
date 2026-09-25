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

/**
 * 처음 보는 소셜 계정을 만났을 때 거치던 휴대폰 인증 화면.
 *
 * @deprecated 신규 소셜 가입은 SOCIAL_SIGNUP_AGREE_PATH로 간다(가입 시 휴대폰을 받지 않는다).
 * 값과 화면은 남겨 둔다. 지우면 그 화면과 completeSocialLink까지 함께 걷어내야 하고,
 * 그건 이 변경의 범위가 아니다.
 */
export const SOCIAL_LINK_VERIFY_PATH = "/social-link/verify-phone";

/**
 * 처음 보는 소셜 계정을 만났을 때 보내는 필수 동의 화면.
 *
 * 여기서 휴대폰을 받지 않는다. 약관·개인정보 수집 [필수] 동의만 받고 회원을 만든다.
 * 휴대폰 본인확인은 실제 신청을 시작할 때 한 번 한다(/my/verify-phone).
 * OAuth 콜백과 화면이 같은 값을 쓰도록 여기에 둔다.
 */
export const SOCIAL_SIGNUP_AGREE_PATH = "/social-link/agree";
