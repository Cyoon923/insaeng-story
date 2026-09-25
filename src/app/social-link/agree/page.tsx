import { redirect } from "next/navigation";
import { readSocialLinkPending } from "@/lib/server/socialLink";
import { SocialSignupAgreeForm } from "./SocialSignupAgreeForm";

export const dynamic = "force-dynamic";

/**
 * 신규 소셜 가입의 필수 동의 화면.
 *
 * 카카오·네이버로 처음 들어온 계정이 거치는 유일한 가입 단계다. 휴대폰은 받지 않는다.
 * 대기 상태(social_link 쿠키 + 서버 저장소)가 살아 있을 때만 열린다.
 * providerUserId 같은 값은 서버에서만 읽고 화면으로 내려보내지 않는다.
 */
export default async function SocialSignupAgreePage() {
  const pending = await readSocialLinkPending();
  // 대기 상태가 없거나 만료됐으면 처음(로그인)부터 다시 하게 한다.
  if (!pending) redirect("/login");

  // 복귀 경로(login_next)는 서버의 completeSocialSignup에서 safeNextPath로 판단한다.
  return <SocialSignupAgreeForm provider={pending.provider} />;
}
