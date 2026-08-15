import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

export default async function ApplyCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const { type, id } = await searchParams;
  const isInquiry = type === "inquiry";
  const isConsult = type === "consult";
  const detailHref = isInquiry
    ? "/"
    : id
      ? isConsult
        ? `/my/consultations/${id}`
        : `/my/orders/${id}`
      : isConsult
        ? "/my/consultations"
        : "/my/orders";

  return (
    <MobileShell>
      <AppHeader variant="page" title="신청 완료" backHref="/" showActions={false} />

      <div className="px-5 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#5c3d2e] text-[28px] text-white">
          ✓
        </div>
        <h2 className="mt-5 font-serif text-[24px] font-bold leading-snug text-[#3d2b1f]">
          신청이 접수되었습니다
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#8b6f5c]">
          {isInquiry ? (
            <>
              남겨 주신 연락처로
              <br />
              카카오톡 또는 전화로 안내드리겠습니다.
            </>
          ) : isConsult ? (
            <>
              상담 신청을 저장했습니다.
              <br />
              일정이 가까워지면 연락드리겠습니다.
            </>
          ) : (
            <>
              신청 내용을 저장했습니다.
              <br />
              제작이 시작되면 연락드리겠습니다.
            </>
          )}
        </p>
      </div>

      <div className="mx-4 rounded-2xl bg-white p-5 ring-1 ring-[#ebe3d8]">
        <p className="text-[13px] text-[#8b6f5c]">현재 진행 상태</p>
        <p className="mt-1 text-[18px] font-bold text-[#5c3d2e]">신청접수</p>
        <p className="mt-3 text-[14px] leading-relaxed text-[#3d2b1f]">
          {isInquiry
            ? "문의 접수 → 연락 안내 → 상품 안내"
            : isConsult
              ? "상담 신청 → 사주정보 입력 → 선생님과 1:1 상담 → 상담 완료"
              : "신청접수 → 상담진행 → 제작중 → 완성/전달 → 완료"}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#8b6f5c]">
          {isInquiry
            ? "유료 1:1 사주상담이 아닙니다. 상품 안내를 위한 무료 문의입니다."
            : "진행 상황은 MY에서 확인하실 수 있습니다."}
        </p>
      </div>

      <div className="mt-8 px-4 pb-8">
        <Link
          href={detailHref}
          className="flex h-14 w-full items-center justify-center rounded-lg bg-[#5c3d2e] text-[16px] font-bold text-white"
        >
          {isInquiry ? "홈으로" : isConsult ? "상담 상세 보기" : "주문 상세 보기"}
        </Link>
        {isInquiry ? null : (
          <Link
            href="/"
            className="mt-3 flex h-14 w-full items-center justify-center rounded-full border-2 border-[#5c3d2e] text-[16px] font-semibold text-[#5c3d2e]"
          >
            홈으로
          </Link>
        )}
      </div>
    </MobileShell>
  );
}
