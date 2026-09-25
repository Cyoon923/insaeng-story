import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/constants/legal";

export default async function PrivacyCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref =
    from === "signup" ? "/signup" : from === "social" ? "/social-link/verify-phone" : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="개인정보 수집 및 이용 동의" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">
          개인정보 수집 및 이용 동의
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          회원가입을 위해 아래와 같이 개인정보를 받습니다.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6B6570]">
          시행일: {LEGAL_EFFECTIVE_DATE}
        </p>
      </section>

      <div className="space-y-4 px-4 pb-8">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">회원가입할 때 받는 정보</h3>
          <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-[#5c3d2e]">
            <li>· 아이디 (필수)</li>
            <li>· 비밀번호 (필수)</li>
            <li>· 이름 (필수)</li>
            <li>· 휴대폰 번호 (필수)</li>
          </ul>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            비밀번호는 그대로 보관하지 않습니다. 원래 값으로 되돌릴 수 없는 형태로 바꾸어
            저장하므로, 저희도 고객님의 비밀번호를 볼 수 없습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">
            카카오·네이버로 가입할 때 받는 정보
          </h3>
          <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-[#5c3d2e]">
            <li>· 이름 또는 닉네임 (카카오·네이버 프로필에서 제공받습니다)</li>
            <li>· 카카오 또는 네이버 계정 식별정보</li>
          </ul>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            간편가입에서는 아이디와 비밀번호를 만들지 않습니다. 가입하실 때 휴대폰 번호도 받지
            않습니다. 휴대폰 번호는 상품이나 상담을 신청하실 때 본인 확인을 위해 한 번만 받습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">가입 과정에서 함께 만들어지는 정보</h3>
          <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-[#5c3d2e]">
            <li>· 회원번호와 가입일시</li>
            <li>· 휴대폰 본인 확인에 사용하는 인증번호와 인증정보</li>
          </ul>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            회원번호는 고객님의 신청 내역을 알아보기 위해 서비스가 자동으로 만드는 번호입니다.
            인증번호는 본인 확인이 끝나면 바로 지워집니다. 아이디·비밀번호로 가입하실 때는 가입
            과정에서, 카카오·네이버로 가입하실 때는 상품이나 상담을 처음 신청하실 때 본인 확인을
            합니다. 확인을 마치면 인증에 사용한 정보도 함께 지워집니다. 중간에 그만두신 경우에는
            일정 시간이 지나면 더 이상 사용할 수 없게 되며, 같은 번호로 다시 인증하시면 이전 값은
            새 값으로 바뀝니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">쓰는 이유</h3>
          <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-[#5c3d2e]">
            <li>· 회원을 알아보고 계정을 관리하기 위해</li>
            <li>· 로그인할 때 본인이 맞는지 확인하기 위해</li>
            <li>· 휴대폰으로 본인 확인을 하기 위해</li>
            <li>· 같은 분이 여러 번 가입하지 않도록 하기 위해</li>
            <li>· 아이디 찾기와 비밀번호 재설정 등 계정을 다시 찾기 위해</li>
            <li>· 서비스를 신청하실 때 회원인지 확인하기 위해</li>
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">언제까지 보관하나요</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            회원 정보는 탈퇴하실 때까지 보관합니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            탈퇴하시면 아이디, 비밀번호, 이름, 휴대폰 번호, 생년월일·태어난 시간·혈액형 같은
            사주 정보, 카카오·네이버 계정 식별정보처럼 고객님을 직접 알아볼 수 있는 정보는 지우거나
            알아볼 수 없는 형태로 바꿉니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            다만 이미 진행된 주문·상담·결제 기록은 남을 수 있습니다. 이 기록을 어느 신청 건과
            연결할지 알아보기 위한 회원번호와 탈퇴하신 시각도 함께 남습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            관련 법령에 따라 더 보관해야 하는 기록이 있을 수 있습니다. 자세한 내용은{" "}
            <Link href="/privacy" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
              개인정보 처리방침
            </Link>
            을 확인해 주세요.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">동의하지 않으셔도 되나요</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            필수 항목에 동의하지 않으면 회원가입을 완료할 수 없습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            위 항목은 모두 회원가입에 반드시 필요한 정보이며, 선택 항목은 없습니다.
          </p>
        </section>

        <p className="text-[13px] leading-relaxed text-[#6B6570]">
          서비스 전체의 개인정보 처리 내용은{" "}
          <Link href="/privacy" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
            개인정보 처리방침
          </Link>
          에서 확인해 주세요.
        </p>
      </div>
    </MobileShell>
  );
}
