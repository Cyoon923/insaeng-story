import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

const SERVICES = [
  {
    title: "이야기로 만드는 인생곡",
    desc: "직접 쓴 이야기 또는 소중한 사람의 이야기로 맞춤 가사와 음악을 만듭니다.",
  },
  {
    title: "프리미엄 인생곡",
    desc: "사주상담, 스토리상담, 인생곡, 뮤직비디오까지 함께 진행하는 토탈 서비스입니다. 전문 보컬 녹음은 포함되지 않습니다.",
  },
  {
    title: "사주 인생곡",
    desc: "상담 없이 사주 정보와 당신의 이야기, 음악 취향을 반영해 인생곡을 만듭니다.",
  },
  {
    title: "1:1 사주상담",
    desc: "인생곡과 별도로 받는 전문 사주상담입니다. 기본 100,000원부터, 약 50분입니다.",
  },
];

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = from === "my" ? "/my" : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="이용 안내" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#3d2b1f]">이용 안내</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">
          인생스토리 서비스를 처음 이용하실 때 참고해 주세요.
        </p>
      </section>

      <section className="px-4 pb-6">
        <h3 className="mb-3 text-[17px] font-bold text-[#3d2b1f]">서비스 안내</h3>
        <div className="space-y-3">
          {SERVICES.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <p className="text-[16px] font-bold text-[#3d2b1f]">{item.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="mb-3 text-[17px] font-bold text-[#3d2b1f]">진행 과정</h3>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <p className="text-[15px] leading-relaxed text-[#3d2b1f]">
            신청접수 → 상담진행 → 제작중 → 완성/전달 → 완료
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
            진행 상황은 MY에서 확인하실 수 있습니다.
          </p>
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="mb-3 text-[17px] font-bold text-[#3d2b1f]">상담 방식</h3>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <p className="text-[15px] leading-relaxed text-[#3d2b1f]">카카오톡 상담 또는 전화 상담</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
            화상 상담은 하지 않습니다. 1:1 사주상담은 약 50분입니다.
          </p>
        </div>
      </section>

      <section className="px-4 pb-8">
        <h3 className="mb-3 text-[17px] font-bold text-[#3d2b1f]">저작권 안내</h3>
        <div className="rounded-2xl bg-[#f5efe6] p-4">
          <p className="text-[15px] leading-relaxed text-[#3d2b1f]">
            인생곡 제작물의 저작권은 인생스토리가 보유합니다. 고객은 개인 감상, 소장, 선물 용도로 사용할 수
            있습니다.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
            상업적 이용, 재판매, 무단 배포, 2차 저작물 제작은 사전 동의 없이 할 수 없습니다.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[#8b6f5c]">
            이 문구는 서비스 안내입니다. 출시 전 법률 검토가 필요하며, 변호사 확인 전까지 최종 약관으로 쓰지
            않습니다.
          </p>
        </div>
      </section>
    </MobileShell>
  );
}
