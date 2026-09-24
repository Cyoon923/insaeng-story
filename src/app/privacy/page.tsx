import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { BUSINESS_INFO, LEGAL_EFFECTIVE_DATE } from "@/lib/constants/legal";

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref =
    from === "signup" ? "/signup" : from === "menu" ? "/menu" : from === "my" ? "/my" : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="개인정보 처리방침" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">개인정보 처리방침</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          사주로그(사업자: {BUSINESS_INFO.name})는 아래 내용으로만 개인정보를 사용합니다.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6B6570]">
          시행일: {LEGAL_EFFECTIVE_DATE}
        </p>
      </section>

      <div className="space-y-4 px-4 pb-8">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">회원가입할 때 받는 정보</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            아이디, 비밀번호, 이름, 휴대폰 번호
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            비밀번호는 그대로 보관하지 않습니다. 원래 값으로 되돌릴 수 없는 안전한 형태로 바꾸어
            저장하므로, 저희도 고객님의 비밀번호를 볼 수 없습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            휴대폰 번호는 본인 확인과 연락을 위해 받습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">서비스를 신청할 때 받는 정보</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            생년월일, 태어난 시간, 성별, 혈액형, 양력·음력, 신청 내용과 상담 내용
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            인생곡 제작과 사주상담에 필요한 정보입니다. 회원가입할 때는 받지 않고, 실제로
            신청하실 때 받습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">이벤트에 신청할 때 받는 정보</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            이름, 연락처, 그리고 유튜브 아이디처럼 해당 이벤트 화면에서 안내해 드린 정보
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">결제할 때</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            결제는 결제 회사를 통해 이루어지며, 결제에 필요한 정보가 그 과정에서 처리됩니다.
            사주로그는 결제 승인에 필요한 내용만 주고받습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">카카오·네이버로 로그인할 때</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            카카오나 네이버로 간편하게 로그인하시면, 사주로그는 그 계정을 알아보기 위한 계정
            식별정보와 프로필에 있는 이름(닉네임) 등 로그인에 필요한 정보를 처리합니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            간편로그인으로 처음 가입하실 때에도 본인 확인을 위해 휴대폰 번호를 함께 받습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">쓰는 이유</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            회원가입과 로그인, 본인 확인, 주문과 상담 진행, 이벤트 안내와 당첨 연락, 제작 안내
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">보관 기간</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            회원 정보는 탈퇴하실 때까지 보관합니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            서비스에 쓰인 상세 정보는 아래 기준으로 정리합니다.
          </p>
          <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-[#5c3d2e]">
            <li>· 인생곡 신청 상세 정보: 제작물을 전달해 드린 뒤 1년</li>
            <li>· 1:1 사주상담 상세 정보: 상담을 마친 뒤 1년</li>
            <li>· 문의와 상담원 대화: 90일</li>
            <li>· 제작을 위해 받은 사진: 최종 제작물을 전달해 드린 뒤 30일</li>
          </ul>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            기간이 지난 기록은 관리자가 확인하는 정리 절차를 통해 지웁니다. 전달이나 상담 완료
            시각이 남아 있지 않은 예전 기록은 날짜를 임의로 만들어 계산하지 않고, 사람이 따로
            확인합니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            거래에 관한 기록은 관계 법령에서 정한 기간 동안 보관합니다.
          </p>
          <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-[#5c3d2e]">
            <li>· 표시·광고에 관한 기록: 6개월</li>
            <li>· 계약 또는 청약철회 등에 관한 기록: 5년</li>
            <li>· 대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
            <li>· 소비자의 불만 또는 분쟁처리에 관한 기록: 3년</li>
          </ul>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            이 기록도 기간이 지나면 관리자가 확인하는 절차를 통해 정리합니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">다른 곳에 주지 않습니다</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            고객 동의 없이 개인정보를 다른 회사에 넘기지 않습니다. 결제 회사에는 결제에 필요한
            정보만 전달됩니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">회원 탈퇴</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            탈퇴하시면 이름, 아이디, 비밀번호, 연락처, 생년월일·태어난 시간·혈액형 같은 사주 정보,
            카카오·네이버 계정 식별정보처럼 고객님을 직접 알아볼 수 있는 정보는 지우거나 알아볼 수
            없는 형태로 바꿉니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            다만 이미 진행된 주문·상담·결제 기록은 필요한 범위에서 남을 수 있습니다. 이 기록을
            어느 신청 건과 연결할지 알아보기 위한 내부 식별정보와 탈퇴하신 시각도 함께 남습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            진행 중인 주문이나 상담, 결제가 있으면 먼저 마무리하신 뒤에 탈퇴하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            남겨 주신 후기는 탈퇴하신 뒤에도 남을 수 있습니다. 다만 작성자 이름은 알아볼 수 없는
            표시로 바꾸고, 어느 회원이 썼는지 알 수 있는 연결도 함께 지웁니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">고객의 권리</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            내 정보를 보거나, 고치거나, 지워 달라고 요청하실 수 있습니다. 고치실 수 있는 정보는
            MY의 개인정보 관리에서 바로 바꾸실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            휴대폰 번호처럼 본인 확인이 필요한 정보는 화면에서 바로 바꿀 수 없고, 별도 확인 절차가
            필요할 수 있습니다.
          </p>
        </section>

        <p className="text-[13px] leading-relaxed text-[#6B6570]">
          <Link href="/guide" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
            이용 안내
          </Link>
          도 함께 확인해 주세요.
        </p>
      </div>
    </MobileShell>
  );
}
