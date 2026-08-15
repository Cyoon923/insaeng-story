import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { formatPrice } from "@/lib/constants/products";
import { getUserId } from "@/lib/server/session";
import { readData } from "@/lib/server/store";

const STEPS = ["상담 신청", "사주정보 입력", "선생님과 1:1 상담", "상담 완료"] as const;

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) {
    return (
      <MobileShell>
        <AppHeader variant="page" title="상담 상세" backHref="/my/consultations" />
        <div className="px-4 py-10 text-center">
          <p className="text-[15px] text-[#8b6f5c]">로그인하면 상담 상세를 볼 수 있습니다.</p>
          <Link
            href="/login"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-[#5c3d2e] px-6 text-[15px] font-semibold text-white"
          >
            로그인하기
          </Link>
        </div>
      </MobileShell>
    );
  }

  const data = await readData();
  const item = data.consultations.find((row) => row.id === id && row.userId === userId);
  if (!item) notFound();

  const currentIndex = STEPS.indexOf(item.status);
  const counterpart = item.details.counterpartName
    ? `${item.details.counterpartName} / ${item.details.counterpartBirth || "생년월일 미입력"}`
    : item.details.extraPerson === "1"
      ? "입력 완료"
      : "없음";

  return (
    <MobileShell>
      <AppHeader variant="page" title="상담 상세" backHref="/my/consultations" />

      <section className="px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">{item.teacher}</h2>
            <p className="mt-1 text-[15px] text-[#5c3d2e]">{item.datetime}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#e8f3ea] px-2.5 py-0.5 text-[12px] font-medium text-[#3d6b45]">
            {item.status}
          </span>
        </div>
      </section>

      <section className="px-4 pb-5">
        <h3 className="mb-3 text-[17px] font-bold text-[#3d2b1f]">진행 상황</h3>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <ol className="space-y-3">
            {STEPS.map((step, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <li key={step} className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${
                      active
                        ? "bg-[#5c3d2e] text-white"
                        : done
                          ? "bg-[#5c3d2e]/20 text-[#5c3d2e]"
                          : "bg-[#f5efe6] text-[#8b6f5c]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`text-[15px] ${active ? "font-bold text-[#5c3d2e]" : "text-[#3d2b1f]"}`}>
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-5">
        <h3 className="mb-3 text-[17px] font-bold text-[#3d2b1f]">상담 정보</h3>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <div className="space-y-3">
            <Row label="선생님" value={item.teacher} />
            <Row label="날짜/시간" value={item.datetime} />
            <Row label="상담 목적" value={item.purpose || "미입력"} />
            <Row label="상담 방법" value={item.method} />
            <Row label="상담 옵션" value={item.option} />
            <Row label="상대방 정보" value={counterpart} />
            {item.details.content ? <Row label="상담 내용" value={item.details.content} /> : null}
            {item.details.name ? <Row label="신청자" value={`${item.details.name} / ${item.details.phone ?? ""}`} /> : null}
          </div>
        </div>
      </section>

      <section className="px-4 pb-8">
        <div className="rounded-2xl bg-[#f5efe6] p-4 text-center">
          <p className="text-[13px] text-[#8b6f5c]">결제 금액</p>
          <p className="mt-1 text-[22px] font-bold text-[#5c3d2e]">{formatPrice(item.amount)}</p>
        </div>
      </section>
    </MobileShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-[#8b6f5c]">{label}</p>
      <p className="whitespace-pre-wrap text-[15px] text-[#3d2b1f]">{value}</p>
    </div>
  );
}
