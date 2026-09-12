import { ChevronRight } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { FAQS } from "@/lib/constants/faq";

export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = from === "menu" ? "/menu" : from === "my" ? "/my" : "/";

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
