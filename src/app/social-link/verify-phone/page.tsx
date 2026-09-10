import { redirect } from "next/navigation";
import { readSocialLinkPending } from "@/lib/server/socialLink";
import { VerifyPhoneForm } from "./VerifyPhoneForm";

export const dynamic = "force-dynamic";

/**
 * 소셜 로그인에서 처음 보는 계정을 만났을 때 거치는 휴대폰 인증 화면.
 * 대기 상태(social_link 쿠키 + 서버 저장소)가 살아 있을 때만 열린다.
 * providerUserId 같은 값은 서버에서만 읽고 화면으로 내려보내지 않는다.
 */
export default async function SocialLinkVerifyPhonePage() {
  const pending = await readSocialLinkPending();
  // 대기 상태가 없거나 만료됐으면 처음(로그인)부터 다시 하게 한다.
  if (!pending) redirect("/login");

  // 연결 후 복귀 경로(login_next)는 서버의 completeSocialLink에서 safeNextPath로 판단한다.
  return <VerifyPhoneForm provider={pending.provider} />;
}
