import { ChevronRight } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

const NOTICES = [
  {
    date: "2026.08.15",
    title: "인생곡 이용 및 저작권 안내",
    body: "인생곡 제작물의 저작권은 비앤비 어드바이저리에 귀속됩니다. 고객은 개인 감상, 소장, 선물 용도로 사용할 수 있습니다. 상업적 이용, 재판매, 무단 배포, 2차 저작물 제작은 사전 동의 없이 할 수 없습니다.",
  },
  {
    date: "2026.08.15",
    title: "1:1 사주상담 진행 안내",
    body: "상담은 카카오톡 또는 전화로 약 50분 진행합니다. 화상 상담은 하지 않습니다. 기본 가격은 100,000원부터입니다.",
  },
  {
    date: "2026.08.15",
    title: "제작 기간 안내",
    body: "이야기로 만드는 인생곡은 결제 후 평균 7~10일, 사주 인생곡은 평균 5~7일, 프리미엄 인생곡은 상담 완료 후 평균 10~14일 정도 소요됩니다.",
  },
];

export default async function NoticePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = from === "menu" ? "/menu" : from === "my" ? "/my" : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="공지사항" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">공지사항</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          사주로그의 소식을 확인하세요.
        </p>
      </section>

      <div className="space-y-3 px-4 pb-8">
        {NOTICES.map((notice) => (
          <details key={notice.title} className="group rounded-2xl bg-white ring-1 ring-[#ebe3d8]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
              <div className="min-w-0 text-left">
                <p className="text-[13px] text-[#6B6570]">{notice.date}</p>
                <p className="mt-1 text-[16px] font-semibold leading-snug text-[#403A49]">{notice.title}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#8b6f5c] transition group-open:rotate-90" />
            </summary>
            <p className="border-t border-[#ebe3d8] px-4 py-3 text-[15px] leading-relaxed text-[#6B6570]">
              {notice.body}
            </p>
          </details>
        ))}
      </div>
    </MobileShell>
  );
}
