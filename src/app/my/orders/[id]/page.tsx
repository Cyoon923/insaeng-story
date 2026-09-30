import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { RefundCompletedBanner } from "@/components/my/RefundCompletedBanner";
import { RefundRequestSection } from "@/components/my/RefundRequestSection";
import { formatPrice } from "@/lib/constants/products";
import { getOrderById, readData } from "@/lib/server/store";
import { hasCompletedRefundRequestForOrder } from "@/lib/server/refundRequests";
import { getActiveUserId } from "@/lib/server/withdrawAccount";
import { SAJU_CONSULTATION_OPTION_ID } from "@/lib/server/pricing";
import {
  eventConsultationBookHref,
  findEventConsultation,
  isEventConsultationOrder,
} from "@/lib/server/eventConsultation";

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
  sajuReportDelivery: "사주풀이 리포트 받는 방법",
  sajuReportEmail: "사주풀이 리포트 이메일",
  method: "상담 방법",
  birth: "생년월일",
  birthTime: "태어난 시간",
  calendar: "양력/음력",
  bloodType: "혈액형",
  gender: "성별",
};

/** 저장된 코드값을 고객이 읽는 말로 바꾼다. 모르는 값은 그대로 보여 준다. */
function detailValue(key: string, value: string): string {
  if (key === "sajuReportDelivery") {
    if (value === "kakao") return "카카오톡";
    if (value === "email") return "이메일";
  }
  return value;
}

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

/**
 * 이 주문에 오픈 이벤트 1:1 사주상담이 함께 신청되었는지.
 *
 * 서버가 확정한 옵션 id 목록(details.optionIds)만 본다. 한글 옵션 문자열(options)은
 * 안내용이라 문구가 바뀌면 판정이 흔들린다. 상담 예약은 따로 만들어지지 않으므로
 * 이 주문 화면에서 안내까지 함께 보여 준다.
 */
function hasSajuConsultation(details: Record<string, string>): boolean {
  return (details.optionIds ?? "").split(",").includes(SAJU_CONSULTATION_OPTION_ID);
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getActiveUserId();
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

  // 본인 주문만 열람할 수 있다. 소유자가 다르면 존재 자체를 알리지 않는다.
  const order = await getOrderById(id);
  if (!order || order.userId !== userId) notFound();
  // OPEN EVENT 상담 포함 주문이면 이미 예약한 상담을 찾는다. 예약 가능 여부 최종 판단은 서버 예약 관문이 한다.
  const eventConsultation = isEventConsultationOrder(order)
    ? findEventConsultation((await readData()).consultations, order.id, userId)
    : undefined;
  /*
   * 환불이 끝난 이벤트 주문에는 새 예약 버튼을 두지 않는다(서버 관문도 거절한다).
   * 이미 예약한 상담은 취소 표시(cancelledAt)가 아직 없어도 환불 완료면 취소로 보인다.
   */
  const eventOrderRefunded = isEventConsultationOrder(order)
    ? await hasCompletedRefundRequestForOrder(order.id)
    : false;

  const currentIndex = STEPS.indexOf(order.status);
  const rows = Object.entries(order.details)
    .filter(([key, value]) => value && LABELS[key])
    .map(([key, value]) => ({ label: LABELS[key], value: detailValue(key, value) }));

  return (
    <MobileShell>
      <AppHeader variant="page" title="주문 상세" backHref="/my/orders" />

      {/* 환불이 끝난 건에서만 나온다. 아래 진행 단계는 그대로 두고 이력으로 남긴다. */}
      <RefundCompletedBanner orderId={order.id} />

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
            {/* 상담을 함께 신청한 주문에만 나온다. 예약은 따로 만들어지지 않는다. */}
            {isEventConsultationOrder(order) ? (
              <div>
                <p className="text-[13px] text-[#6B6570]">1:1 사주상담</p>
                {eventConsultation && (eventConsultation.cancelledAt || eventOrderRefunded) ? (
                  <p className="text-[15px] text-[#3d2b1f]">
                    주문이 환불되어 상담 예약({eventConsultation.datetime})이 취소되었습니다.
                  </p>
                ) : eventConsultation ? (
                  <>
                    <p className="text-[15px] text-[#3d2b1f]">
                      {eventConsultation.datetime} · {eventConsultation.teacher}
                    </p>
                    <Link
                      href={`/my/consultations/${encodeURIComponent(eventConsultation.id)}`}
                      className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-[#403A49] bg-white text-[15px] font-semibold text-[#403A49]"
                    >
                      예약한 상담 보기
                    </Link>
                  </>
                ) : eventOrderRefunded ? (
                  <p className="text-[15px] text-[#3d2b1f]">환불된 주문이라 상담을 예약할 수 없습니다.</p>
                ) : (
                  <>
                    <p className="text-[15px] text-[#3d2b1f]">
                      이벤트에 포함된 상담입니다. 원하시는 날짜와 시간을 직접 예약해 주세요.
                    </p>
                    <Link
                      href={eventConsultationBookHref(order.id)}
                      className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#403A49] text-[15px] font-semibold text-white"
                    >
                      1:1 사주상담 예약하기
                    </Link>
                  </>
                )}
              </div>
            ) : hasSajuConsultation(order.details) ? (
              <div>
                <p className="text-[13px] text-[#6B6570]">1:1 사주상담</p>
                <p className="text-[15px] text-[#3d2b1f]">
                  결제 후 등록하신 연락처로 상담 일정을 안내드립니다.
                </p>
              </div>
            ) : null}
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

      {/* 환불 문의. 이 화면은 서버 컴포넌트라 상태 조회·접수는 클라이언트 쪽에서 한다. */}
      <RefundRequestSection orderId={order.id} />
    </MobileShell>
  );
}
