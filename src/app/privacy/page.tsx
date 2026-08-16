import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = from === "signup" ? "/signup" : from === "my" ? "/my" : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="개인정보 처리방침" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#3d2b1f]">개인정보 처리방침</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">
          인생스토리는 이름과 연락처를 받을 때, 아래 내용으로만 사용합니다.
        </p>
      </section>

      <div className="space-y-4 px-4 pb-8">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">받는 정보</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            이름, 연락처, 이메일, 생년월일, 태어난 시간, 성별, 혈액형, 신청 내용, 유튜브 아이디(구독
            이벤트)
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">쓰는 이유</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            회원가입, 주문과 상담 진행, 이벤트 안내와 당첨 연락, 제작 안내
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">보관 기간</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            회원 정보는 탈퇴할 때까지 보관합니다. 주문·상담 기록은 관련 법령에 따라 보관할 수 있습니다.
            이벤트 신청은 이벤트 종료 후 지웁니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">다른 곳에 주지 않습니다</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            고객 동의 없이 개인정보를 다른 회사에 넘기지 않습니다. 결제 회사에는 결제에 필요한 정보만
            전달됩니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">고객의 권리</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            내 정보를 보거나, 고치거나, 지워 달라고 요청할 수 있습니다. MY의 개인정보 관리에서 고칠 수
            있습니다.
          </p>
        </section>

        <p className="text-[13px] leading-relaxed text-[#8b6f5c]">
          이 문구는 서비스 안내입니다. 출시 전 법률 검토가 필요합니다.{" "}
          <Link href="/guide" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
            이용 안내
          </Link>
          도 함께 확인해 주세요.
        </p>
      </div>
    </MobileShell>
  );
}
