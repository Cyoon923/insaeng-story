import { redirect } from "next/navigation";
import { readData } from "@/lib/server/store";
import { getActiveUserId } from "@/lib/server/withdrawAccount";
import { hasVerifiedPhone } from "@/lib/phoneVerification";
import { safeNextPath } from "@/lib/loginRedirect";
import { MyVerifyPhoneForm } from "./MyVerifyPhoneForm";

export const dynamic = "force-dynamic";

/**
 * 로그인한 회원의 최초 휴대폰 본인확인 화면.
 *
 * /social-link/verify-phone(신규 소셜 가입용)과 다른 화면이다. 그쪽은 세션이 없는 상태에서
 * 회원을 만드는 흐름이고 필수 약관 동의를 함께 받는다. 여기는 이미 가입한 회원이
 * 번호만 확인하는 자리라 약관을 다시 받지 않는다. 두 화면을 합치면 그 차이가 섞인다.
 *
 * 이미 본인확인을 마친 회원은 들어올 이유가 없어 MY로 보낸다. 서버 판정을 화면에서
 * 다시 구현하지 않고 hasVerifiedPhone 하나를 그대로 쓴다.
 */
export default async function MyVerifyPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const userId = await getActiveUserId();
  if (!userId) redirect("/login");

  const data = await readData();
  const me = data.users.find((item) => item.id === userId) ?? null;
  if (!me) redirect("/login");
  if (hasVerifiedPhone(me)) redirect("/my");

  // 돌아갈 주소는 기존 규칙(신청 경로만 허용)으로만 통과시킨다.
  const params = await searchParams;
  const next = safeNextPath(params.next ?? null);

  return <MyVerifyPhoneForm next={next} />;
}
