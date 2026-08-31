import { ChevronRight } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

const FAQS = [
  {
    question: "이야기를 잘 못해도 괜찮을까요?",
    answer:
      "괜찮습니다. 선생님이 따뜻하게 이끌어 드리며, 질문에 답하시는 것만으로도 충분합니다.",
  },
  {
    question: "노래는 어떤 장르로 만들어지나요?",
    answer: "고객님이 좋아하시는 가수와 노래를 참고하여, 원하시는 분위기에 맞게 제작합니다.",
  },
  {
    question: "제작 기간은 얼마나 걸리나요?",
    answer: "이야기로 만드는 인생곡은 결제 후 평균 7~10일, 프리미엄 인생곡은 상담 완료 후 평균 10~14일 정도 소요됩니다.",
  },
  {
    question: "수정은 몇 번까지 가능한가요?",
    answer: "기본 가사 수정 1회가 포함되어 있으며, 추가 수정은 옵션으로 선택하실 수 있습니다.",
  },
  {
    question: "프리미엄과 일반 인생곡의 차이는 무엇인가요?",
    answer:
      "프리미엄은 일반 인생곡의 고급형이 아닙니다. 사주상담, 스토리상담, 인생곡, 뮤직비디오가 포함된 토탈 서비스입니다. 전문 보컬 녹음은 포함되지 않습니다.",
  },
  {
    question: "사주 인생곡은 상담을 하나요?",
    answer: "하지 않습니다. 상담 없이 사주 정보와 당신의 이야기, 음악 취향을 반영해 인생곡을 제작합니다.",
  },
  {
    question: "처음 사주상담을 받아도 괜찮을까요?",
    answer: "괜찮습니다. 선생님이 편안하게 이끌어 드리며, 궁금한 것부터 천천히 살펴봅니다.",
  },
  {
    question: "1:1 사주상담은 어떻게 진행되나요?",
    answer: "카카오톡 상담 또는 전화 상담 중 하나를 선택해, 약 50분 동안 진행합니다. 화상 상담은 하지 않습니다.",
  },
  {
    question: "완성된 노래는 어떻게 사용할 수 있나요?",
    answer:
      "인생곡 제작물의 저작권은 비앤비 어드바이저리에 귀속됩니다. 고객은 개인 감상, 소장, 선물 용도로 사용할 수 있습니다. 상업적 이용, 재판매, 무단 배포, 2차 저작물 제작은 사전 동의 없이 할 수 없습니다.",
  },
];

export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = from === "my" ? "/my" : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="자주 묻는 질문" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">자주 묻는 질문</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">궁금한 내용을 확인해 보세요.</p>
      </section>

      <div className="space-y-3 px-4 pb-8">
        {FAQS.map((faq) => (
          <details key={faq.question} className="group rounded-2xl bg-white ring-1 ring-[#ebe3d8]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-[16px] font-semibold leading-snug text-[#403A49]">
              {faq.question}
              <ChevronRight className="h-5 w-5 shrink-0 text-[#8b6f5c] transition group-open:rotate-90" />
            </summary>
            <p className="border-t border-[#ebe3d8] px-4 py-3 text-[15px] leading-relaxed text-[#6B6570]">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </MobileShell>
  );
}
