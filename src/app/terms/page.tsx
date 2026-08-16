import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = from === "signup" ? "/signup" : from === "my" ? "/my" : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="이용약관" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#3d2b1f]">이용약관</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">
          인생스토리 서비스를 이용할 때 꼭 알아 두실 내용입니다.
        </p>
      </section>

      <div className="space-y-4 px-4 pb-8">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">서비스</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            이야기로 만드는 인생곡, 프리미엄 인생곡, 사주 인생곡, 1:1 사주상담, 이벤트를 제공합니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">저작권</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            인생곡 제작물의 저작권은 인생스토리가 보유합니다. 고객은 개인 감상, 소장, 선물 용도로 사용할 수
            있습니다. 상업적 이용, 재판매, 무단 배포, 2차 저작물 제작은 사전 동의 없이 할 수 없습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">취소·환불</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            제작이나 상담이 시작되기 전에는 취소와 환불을 요청할 수 있습니다. 제작이 시작된 뒤, 또는 상담
            시간이 지난 뒤에는 환불이 어려울 수 있습니다. 자세한 안내는 신청 후 연락으로 도와드립니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#3d2b1f]">신청과 연락</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            정확한 이름과 연락처를 남겨 주셔야 안내가 가능합니다. 상담은 카카오톡 또는 전화로 진행하며,
            화상 상담은 하지 않습니다.
          </p>
        </section>

        <p className="text-[13px] leading-relaxed text-[#8b6f5c]">
          이 문구는 서비스 안내입니다. 출시 전 법률 검토가 필요합니다.{" "}
          <Link href="/privacy" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
            개인정보 처리방침
          </Link>
          도 함께 확인해 주세요.
        </p>
      </div>
    </MobileShell>
  );
}
