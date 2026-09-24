import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { BUSINESS_INFO, COPYRIGHT_NOTICE_PARAGRAPHS } from "@/lib/constants/legal";

const SERVICES = [
  {
    title: "이야기로 만드는 인생곡",
    desc: "직접 쓴 이야기 또는 소중한 사람의 이야기로 맞춤 가사와 음악을 만듭니다.",
  },
  {
    title: "프리미엄 인생곡",
    desc: "사주상담, 스토리상담, 인생곡 제작까지 함께 진행하는 토탈 서비스입니다. 뮤직비디오는 추가 옵션이며, 전문 보컬 녹음은 포함되지 않습니다.",
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
  const backHref = from === "menu" ? "/menu" : from === "my" ? "/my" : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="이용 안내" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">이용 안내</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          사주로그 서비스를 처음 이용하실 때 참고해 주세요.
        </p>
      </section>

      <section className="px-4 pb-6">
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">서비스 안내</h3>
        <div className="space-y-3">
          {SERVICES.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <p className="text-[16px] font-bold text-[#403A49]">{item.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">진행 과정</h3>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <p className="text-[15px] leading-relaxed text-[#3d2b1f]">
            신청접수 → 상담진행 → 제작중 → 완성/전달 → 완료
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
            진행 상황은 MY에서 확인하실 수 있습니다.
          </p>
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">상담 방식</h3>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <p className="text-[15px] leading-relaxed text-[#3d2b1f]">카카오톡 상담 또는 전화 상담</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
            화상 상담은 하지 않습니다. 1:1 사주상담은 약 50분입니다.
          </p>
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">취소·환불</h3>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <p className="text-[15px] leading-relaxed text-[#3d2b1f]">
            결제를 마치신 것만으로 제작이 시작되지는 않습니다. 실제 제작이나 상담이 시작되기 전에는
            취소와 전액 환불을 요청하실 수 있습니다.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
            제작이 시작된 뒤에 요청하신 경우에도 자동으로 거절하지 않습니다. 실제로 진행된 작업과
            제공 상태, 관계 법령에 따라 확인한 뒤 안내해 드립니다.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
            1:1 사주상담은 예약하신 시각 기준 정확히 3시간 전까지 요청하시면 일반 취소·환불 절차로
            처리해 드립니다. 3시간이 채 남지 않은 때, 상담 시각이 지난 뒤, 상담에 참여하지 못하신
            경우에도 자동으로 거절하지 않고 개별적으로 확인해 드립니다.
          </p>
        </div>
      </section>

      <section className="px-4 pb-6">
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">사업자 정보</h3>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <p className="text-[15px] leading-relaxed text-[#3d2b1f]">상호: {BUSINESS_INFO.name}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#3d2b1f]">대표: {BUSINESS_INFO.ceo}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#3d2b1f]">
            사업자등록번호: {BUSINESS_INFO.registrationNumber}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#3d2b1f]">
            통신판매업 신고번호: {BUSINESS_INFO.mailOrderNumber}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#3d2b1f]">
            주소: {BUSINESS_INFO.address}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#3d2b1f]">
            고객센터:{" "}
            <a href={`mailto:${BUSINESS_INFO.email}`} className="underline underline-offset-2">
              {BUSINESS_INFO.email}
            </a>
          </p>
        </div>
      </section>

      <section className="px-4 pb-8">
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">저작권 안내</h3>
        <div className="rounded-2xl bg-[#f5efe6] p-4">
          {COPYRIGHT_NOTICE_PARAGRAPHS.map((text, index) => (
            <p
              key={text}
              className={
                index === 0
                  ? "text-[15px] leading-relaxed text-[#3d2b1f]"
                  : "mt-2 text-[14px] leading-relaxed text-[#6B6570]"
              }
            >
              {text}
            </p>
          ))}
        </div>
      </section>
    </MobileShell>
  );
}
