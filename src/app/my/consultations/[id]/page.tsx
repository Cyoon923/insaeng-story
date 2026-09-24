import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { RefundCompletedBanner } from "@/components/my/RefundCompletedBanner";
import { RefundRequestSection } from "@/components/my/RefundRequestSection";
import { formatPrice } from "@/lib/constants/products";
import { canRequestConsultationRefund } from "@/lib/refundRequestSection";
import { getOrderById, readData } from "@/lib/server/store";
import { getActiveUserId } from "@/lib/server/withdrawAccount";

const STEPS = ["상담 신청", "사주정보 입력", "선생님과 1:1 상담", "상담 완료"] as const;

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getActiveUserId();
  if (!userId) {
    return (
      <MobileShell>
        <AppHeader variant="page" title="상담 상세" backHref="/my/consultations" />
        <div className="px-4 py-10 text-center">
          <p className="text-[15px] text-[#6B6570]">로그인하면 상담 상세를 볼 수 있습니다.</p>
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
  const item = data.consultations.find((row) => row.id === id && row.userId === userId);
  if (!item) notFound();

  /*
   * 환불 문의는 주문에 귀속되므로 상담과 짝이 되는 주문을 서버에서 직접 읽는다.
   * 주소로 받은 id를 그대로 믿지 않고, 읽어 온 주문의 주인·종류·id를 모두 맞춰 본다.
   * 짝이 되는 주문이 없는 옛 상담에서는 접수 영역을 띄우지 않는다.
   */
  const order = await getOrderById(id);
  const refundable = canRequestConsultationRefund(order, userId, item.id);

  const currentIndex = STEPS.indexOf(item.status);
  const counterpart = item.details.counterpartName
    ? `${item.details.counterpartName} / ${item.details.counterpartBirth || "생년월일 미입력"}`
    : item.details.extraPerson === "1"
      ? "입력 완료"
      : "없음";

  return (
    <MobileShell>
      <AppHeader variant="page" title="상담 상세" backHref="/my/consultations" />

      {/*
       * 환불이 끝난 건에서만 나온다. 예약 정보와 진행 단계는 지우지 않되,
       * 환불 사실이 먼저 읽히도록 이 배너를 위에 둔다.
       */}
      {order && refundable ? <RefundCompletedBanner orderId={order.id} /> : null}

      <section className="px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-[22px] font-bold text-[#403A49]">{item.teacher}</h2>
            <p className="mt-1 text-[15px] text-[#403A49]">{item.datetime}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#e8f3ea] px-2.5 py-0.5 text-[12px] font-medium text-[#3d6b45]">
            {item.status}
          </span>
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
        <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">상담 정보</h3>
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
          <p className="text-[13px] text-[#6B6570]">결제 금액</p>
          <p className="mt-1 text-[22px] font-bold text-[#403A49]">{formatPrice(item.amount)}</p>
        </div>
      </section>

      {/* 환불 문의. 상태 조회·접수는 클라이언트 쪽에서 한다(이 화면은 서버 컴포넌트다). */}
      {order && refundable ? (
        <RefundRequestSection orderId={order.id} />
      ) : (
        /*
         * 짝이 되는 결제 주문을 찾지 못한 상담. "환불 불가"가 아니라 이 화면에서
         * 바로 접수할 수 없다는 뜻이므로, 기존 문의 경로만 짧게 안내한다.
         */
        <section className="px-4 pb-8">
          <p className="rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-[#6B6570] ring-1 ring-[#ebe3d8]">
            환불 문의는 상담원에게 문의를 남겨 주세요.
          </p>
        </section>
      )}
    </MobileShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-[#6B6570]">{label}</p>
      <p className="whitespace-pre-wrap text-[15px] text-[#3d2b1f]">{value}</p>
    </div>
  );
}
