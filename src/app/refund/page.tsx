import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { BUSINESS_INFO, LEGAL_EFFECTIVE_DATE } from "@/lib/constants/legal";

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
        <p className="mt-1 text-[13px] leading-relaxed text-[#6B6570]">
          시행일: {LEGAL_EFFECTIVE_DATE}
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
            결제를 마치신 것만으로 제작이 시작되지는 않습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">인생곡 및 맞춤형 콘텐츠</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            인생곡은 고객님의 이야기, 사주 정보, 사진, 요청사항을 바탕으로 한 분만을 위해 개별
            제작되는 맞춤형 서비스입니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            제작이 시작된 이후에 요청하신 경우에도 자동으로 거절하지 않습니다. 실제로 진행된 작업
            범위와 제공 상태를 확인한 뒤 개별적으로 안내해 드리며, 이미 제공된 부분에 해당하는
            비용이 공제될 수 있습니다.
          </p>
          <div className="mt-3 rounded-xl bg-[#f5efe6] p-3">
            <p className="text-[15px] leading-relaxed text-[#3d2b1f]">
              여기서 &ldquo;제작 시작&rdquo;은 결제를 마치신 시점이 아니라, 고객님이 주신 자료를
              바탕으로 가사 작성, 음악 제작, 영상 제작 등 개별 제작 작업에 실제로 착수한 시점을
              말합니다.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#3d2b1f]">
              제작에 착수하면 주문 진행 상태가 &ldquo;제작중&rdquo;으로 바뀌며, 그 시각이 제작 시작
              시점으로 기록됩니다. MY의 주문 내역에서 지금 어느 단계인지 확인하실 수 있습니다.
            </p>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            프리미엄 인생곡은 사주상담, 스토리상담, 인생곡 제작, 뮤직비디오 제작으로 이어지는
            실제 진행 단계를 기준으로 확인해 드립니다. 미리 정해 둔 고정 공제율을 적용하지 않습니다.
          </p>
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
            예약하신 상담 시작 시각을 기준으로 안내해 드립니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            상담 시작 3시간 전까지 요청하시면 일반 취소·환불 절차로 처리해 드립니다. 상담 시작
            정확히 3시간 전에 요청하신 경우도 여기에 포함됩니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            상담 시작까지 3시간이 채 남지 않은 때에 요청하신 경우에는 자동으로 거절하지 않습니다.
            준비 상황과 진행 내용을 확인한 뒤 개별적으로 안내해 드립니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            예약하신 상담 시각이 지난 뒤에 요청하신 경우에도 자동으로 거절하지 않습니다. 상담이
            실제로 진행되었는지 등을 확인한 뒤 개별적으로 안내해 드립니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            연락이 닿지 않아 예약하신 시각에 상담을 진행하지 못한 경우에도 자동으로 거절하지
            않습니다. 사정을 확인한 뒤 개별적으로 안내해 드립니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            사주로그 또는 유비 선생의 사정으로 상담을 제공해 드리지 못하는 경우에는 전액 환불과
            무상 일정 변경 중에서 고객님이 선택하실 수 있습니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            어느 경우에도 관계 법령에 따른 고객님의 권리는 제한되지 않습니다.
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
            <a
              href={`mailto:${BUSINESS_INFO.email}`}
              className="font-semibold underline underline-offset-2"
            >
              {BUSINESS_INFO.email}
            </a>
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            요청하실 때 주문자 이름, 연락처, 주문 내역을 함께 알려 주시면 더 빠르게 확인해
            드릴 수 있습니다.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            환불은 세 단계로 나뉘며, 각 단계의 시각이 서로 다릅니다.
          </p>
          <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-[#5c3d2e]">
            <li>· 고객님의 요청 접수</li>
            <li>· 사주로그의 환불 승인</li>
            <li>· 결제사의 취소 처리와 사주로그의 환불 완료 확인</li>
          </ul>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            승인은 환불을 해 드리기로 정한 시점이고, 실제 환급은 결제사에서 이루어집니다. 사주로그가
            환불 완료로 처리하는 시점은 그 결과를 확인한 시점이라 승인 시점이나 결제사의 취소 시점과
            같지 않을 수 있습니다.
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
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            상호: {BUSINESS_INFO.name}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            대표: {BUSINESS_INFO.ceo}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            사업자등록번호: {BUSINESS_INFO.registrationNumber}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            통신판매업 신고번호: {BUSINESS_INFO.mailOrderNumber}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            주소: {BUSINESS_INFO.address}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            고객센터:{" "}
            <a href={`mailto:${BUSINESS_INFO.email}`} className="underline underline-offset-2">
              {BUSINESS_INFO.email}
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
