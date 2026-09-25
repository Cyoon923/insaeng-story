import { redirect } from "next/navigation";
import { SOCIAL_SIGNUP_AGREE_PATH } from "@/lib/loginRedirect";
import { readSocialLinkPending } from "@/lib/server/socialLink";

export const dynamic = "force-dynamic";

/**
 * 옛 소셜 가입 경로. 더 이상 화면을 보여 주지 않고 지금의 가입 경로로 보낸다.
 *
 * ── 왜 화면을 남겨 두고 보내기만 하는가 ──
 *
 * 신규 소셜 가입은 휴대폰을 받지 않는다(필수 동의만 받는다). 두 콜백은 이미
 * /social-link/agree로 보내지만, 두 흐름이 같은 대기 상태(social_link 쿠키 +
 * 서버 저장소)를 쓰기 때문에 이 주소를 직접 열면 옛 화면이 그대로 동작했다.
 * 그 화면은 인증한 번호의 기존 회원에 바로 연결하는 옛 정책을 실행한다.
 * 지금 정책에서 번호 기반 연결은 가입이 아니라 최초 본인확인에서만 한다
 * (/my/verify-phone → completeMyPhoneVerification).
 *
 * 그래서 주소만 무력화하고 파일·컴포넌트·action은 남긴다. 지우려면 VerifyPhoneForm과
 * completeSocialLink까지 함께 걷어내야 하고, 그건 이 정리의 범위가 아니다.
 * completeSocialLink의 "로그인 상태면 거부" 게이트도 그대로 둔다.
 *
 * VerifyPhoneForm은 이제 어디서도 렌더하지 않는다. 파일은 그대로 남아 있다.
 */
export default async function SocialLinkVerifyPhonePage() {
  const pending = await readSocialLinkPending();
  // 대기 상태가 있으면 지금의 가입 경로(필수 동의)로 이어 준다.
  // 여기까지 온 사람은 소셜 로그인을 막 끝낸 신규 가입자다. 처음부터 다시 시키지 않는다.
  if (pending) redirect(SOCIAL_SIGNUP_AGREE_PATH);

  // 대기 상태가 없거나 만료됐으면 처음(로그인)부터 다시 하게 한다.
  redirect("/login");
}
