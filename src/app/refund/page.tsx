import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

export default async function RefundPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref =
    from === "signup" ? "/signup" : from === "menu" ? "/menu" : from === "my" ? "/my" : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="취소·환불 정책" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">취소·환불 정책</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          사주로그 서비스의 취소와 환불에 대한 안내입니다.
        </p>
      </section>

      <div className="space-y-4 px-4 pb-8">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">기본 원칙</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            사주로그는 맞춤형 인생곡 제작, 디지털 콘텐츠 제작, 1:1 사주상담 서비스를 제공합니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            취소와 환불은 서비스의 진행 단계와 제공 여부에 따라 달라질 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            관계 법령에서 소비자에게 더 유리한 규정이 적용되는 경우, 해당 법령을 따릅니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">제작 또는 상담 시작 전</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            결제 후라도 제작이나 상담이 시작되기 전에는 취소와 전액 환불을 요청하실 수 있습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">인생곡 및 맞춤형 콘텐츠</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            인생곡은 고객님의 이야기, 사주 정보, 사진, 요청사항을 바탕으로 한 분만을 위해 개별
            제작되는 맞춤형 서비스입니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            제작이 시작된 이후에는 실제로 진행된 작업 범위에 따라 취소와 환불이 제한되거나, 이미
            제공된 부분에 해당하는 비용이 공제될 수 있습니다.
          </p>
          <div className="mt-3 rounded-xl bg-[#f5efe6] p-3">
            <p className="text-[15px] leading-relaxed text-[#3d2b1f]">
              여기서 &ldquo;제작 시작&rdquo;은 고객님이 주신 자료를 바탕으로 가사 작성, 음악 제작,
              영상 제작 등 개별 제작 작업에 착수한 시점을 말합니다.
            </p>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            최종 음원, 영상 등 디지털 콘텐츠의 제공이 시작된 경우에는 관계 법령에 따라 청약철회가
            제한될 수 있습니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            다만 제공된 결과물이 상품 설명 또는 계약 내용과 다르게 이행된 경우에는, 관계 법령에 따른
            취소·환불 권리가 제한되지 않습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">1:1 사주상담</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            상담이 시작되기 전에는 취소를 요청하실 수 있습니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            상담이 이미 시작되었거나, 고객님의 사유로 예약된 상담 시간이 지난 경우에는 제공된 서비스
            범위에 따라 환불이 제한될 수 있습니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            상담 일정 변경은 고객센터를 통해 요청해 주세요.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">추가 옵션</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            AI 뮤직비디오, 추억사진 영상 등 개별 제작되는 추가 옵션도 해당 옵션의 제작이 시작되었는지
            여부에 따라 위와 같은 원칙이 적용됩니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">환불 요청 방법</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            아래 이메일로 취소·환불을 요청해 주세요.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            <a href="mailto:code8jmk@gmail.com" className="font-semibold underline underline-offset-2">
              code8jmk@gmail.com
            </a>
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            요청하실 때 주문자 이름, 연락처, 주문 내역을 함께 알려 주시면 더 빠르게 확인해
            드릴 수 있습니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            환불이 승인된 이후 실제로 환급되는 시점은 결제수단과 카드사·금융기관의 처리 기간에 따라
            차이가 날 수 있습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">법정 권리 안내</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            이 정책은 관계 법령에 따른 소비자의 청약철회, 계약 해제, 손해배상 등 법정 권리를 제한하지
            않습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">사업자 정보</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">상호: 비앤비어드바이저리</p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">대표: 정문경</p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            사업자등록번호: 158-25-00095
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            주소: 경기도 안산시 단원구 시화호수로 623, 2825호 (성곡동, 아티스큐브2차)
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            고객센터:{" "}
            <a href="mailto:code8jmk@gmail.com" className="underline underline-offset-2">
              code8jmk@gmail.com
            </a>
          </p>
        </section>

        <p className="text-[13px] leading-relaxed text-[#6B6570]">
          함께 확인해 주세요.{" "}
          <Link href="/terms" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
            이용약관
          </Link>
          {" · "}
          <Link href="/privacy" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
            개인정보 처리방침
          </Link>
        </p>
      </div>
    </MobileShell>
  );
}
