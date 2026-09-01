import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { formatPrice } from "@/lib/constants/products";
import { getUserId } from "@/lib/server/session";
import { readData } from "@/lib/server/store";

const STEPS = ["신청접수", "상담진행", "제작중", "완성/전달", "완료"] as const;

const IMAGES: Record<string, string> = {
  story: "/images/photo-writing.jpg",
  premium: "/images/photo-premium-life.png",
  "saju-song": "/images/photo-ohaeng.png",
};

const LABELS: Record<string, string> = {
  name: "이름",
  phone: "연락처",
  protagonist: "이야기 주인공",
  memory: "가장 기억에 남는 순간",
  message: "꼭 전하고 싶은 말",
  image: "기억하고 싶은 모습",
  free: "하고 싶은 말",
  story: "당신의 이야기",
  moods: "가사 분위기",
  customMood: "직접 입력한 분위기",
  songs: "참고곡",
  options: "추가 옵션",
  videoStyle: "영상 스타일",
  method: "상담 방법",
  birth: "생년월일",
  birthTime: "태어난 시간",
  calendar: "양력/음력",
  bloodType: "혈액형",
  gender: "성별",
};

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) {
    return (
      <MobileShell>
        <AppHeader variant="page" title="주문 상세" backHref="/my/orders" />
        <div className="px-4 py-10 text-center">
          <p className="text-[15px] text-[#6B6570]">로그인하면 주문 상세를 볼 수 있습니다.</p>
          <Link
            href="/login"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
          >
            로그인하기
          </Link>
        </div>
      </MobileShell>
    );
  }

  const data = await readData();
  const order = data.orders.find((item) => item.id === id && item.userId === userId);
  if (!order) notFound();

  const currentIndex = STEPS.indexOf(order.status);
  const rows = Object.entries(order.details)
    .filter(([key, value]) => value && LABELS[key])
    .map(([key, value]) => ({ label: LABELS[key], value }));

  return (
    <MobileShell>
      <AppHeader variant="page" title="주문 상세" backHref="/my/orders" />

      <section className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#f5efe6]">
            <Image
              src={IMAGES[order.product] ?? "/images/photo-hero.jpg"}
              alt=""
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-[22px] font-bold text-[#403A49]">{order.title}</h2>
              <span className="rounded-full bg-[#f5efe6] px-2.5 py-0.5 text-[12px] font-medium text-[#403A49]">
                {order.status}
              </span>
            </div>
            <p className="mt-1 text-[14px] text-[#6B6570]">신청일 {formatDate(order.createdAt)}</p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-5">
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">진행 상황</h3>
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
                        ? "bg-[#403A49] text-white"
                        : done
                          ? "bg-[#403A49]/20 text-[#403A49]"
                          : "bg-[#f5efe6] text-[#6B6570]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`text-[15px] ${active ? "font-bold text-[#403A49]" : "text-[#403A49]"}`}>
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-5">
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">주문 정보</h3>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <p className="text-[15px] font-semibold text-[#403A49]">{order.title}</p>
          <div className="mt-3 space-y-2">
            {rows.map((row) => (
              <div key={row.label}>
                <p className="text-[13px] text-[#6B6570]">{row.label}</p>
                <p className="whitespace-pre-wrap text-[15px] text-[#3d2b1f]">{row.value}</p>
              </div>
            ))}
            <div>
              <p className="text-[13px] text-[#6B6570]">결제수단</p>
              <p className="text-[15px] text-[#3d2b1f]">{order.payment}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-8">
        <div className="rounded-2xl bg-[#f5efe6] p-4 text-center">
          <p className="text-[13px] text-[#6B6570]">결제 금액</p>
          <p className="mt-1 text-[22px] font-bold text-[#403A49]">{formatPrice(order.amount)}</p>
        </div>
      </section>
    </MobileShell>
  );
}
