import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { BUSINESS_INFO, COPYRIGHT_NOTICE_PARAGRAPHS, LEGAL_EFFECTIVE_DATE } from "@/lib/constants/legal";

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref =
    from === "signup"
      ? "/signup"
      : from === "social"
        ? "/social-link/verify-phone"
        : from === "menu"
          ? "/menu"
          : from === "my"
            ? "/my"
            : "/";

  return (
    <MobileShell>
      <AppHeader variant="page" title="이용약관" backHref={backHref} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">이용약관</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          사주로그 서비스를 이용할 때 꼭 알아 두실 내용입니다.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6B6570]">
          시행일: {LEGAL_EFFECTIVE_DATE}
        </p>
      </section>

      <div className="space-y-4 px-4 pb-8">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">목적과 운영 주체</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            이 약관은 사주로그가 제공하는 서비스를 고객님이 이용하실 때의 기본 내용을 안내합니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            사주로그는 {BUSINESS_INFO.name}가 운영하는 서비스입니다. 이 약관에서 &ldquo;회사&rdquo;는
            {BUSINESS_INFO.name}를, &ldquo;서비스&rdquo;는 사주로그를 말합니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">회원가입과 계정</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            회원가입은 휴대폰 본인 확인을 거쳐 진행합니다. 아이디, 비밀번호, 이름, 휴대폰 번호를
            받습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            카카오나 네이버 계정으로도 가입하고 로그인하실 수 있습니다. 이때에도 휴대폰 본인 확인을
            함께 진행합니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            아이디는 다른 회원과 겹치지 않아야 하며, 비밀번호는 고객님께서 직접 관리해 주셔야 합니다.
            휴대폰 번호는 본인 확인과 계정 찾기에 사용되므로 정확하게 입력해 주세요.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            개인정보를 어떻게 다루는지는{" "}
            <Link href="/privacy" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
              개인정보 처리방침
            </Link>
            에서 확인하실 수 있습니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">서비스</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            사주로그는 아래 서비스를 제공합니다.
          </p>
          <ul className="mt-2 space-y-1 text-[15px] leading-relaxed text-[#5c3d2e]">
            <li>· 이야기로 만드는 인생곡</li>
            <li>· 프리미엄 인생곡</li>
            <li>· 사주 인생곡</li>
            <li>· 1:1 사주상담</li>
            <li>· 이벤트</li>
          </ul>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            인생곡에는 AI 뮤직비디오, 추억사진 영상, 가사 수정 추가와 같은 추가 옵션을 함께
            신청하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            1:1 사주상담은 카카오톡 또는 전화로 약 50분 동안 진행합니다. 화상 상담은 하지 않습니다.
            상담에는 상담 기록 요약 리포트, 추가 인원(궁합) 같은 추가 옵션을 선택하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            각 서비스의 내용과 금액은 해당 상품 화면에서 안내해 드립니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">신청과 결제</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            인생곡과 1:1 사주상담은 로그인하신 회원만 신청하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            정확한 이름과 연락처를 남겨 주셔야 안내가 가능합니다. 신청하신 내용과 연락처가 정확하지
            않으면 진행이 늦어질 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            결제 금액은 상품 기본 금액과 고객님이 선택하신 추가 옵션을 더해 계산합니다. 금액은 서버에서
            다시 확인하므로, 화면에 보이는 금액과 실제 청구 금액이 다르지 않습니다.
          </p>
          <div className="mt-3 rounded-xl bg-[#f5efe6] p-3">
            <p className="text-[15px] leading-relaxed text-[#3d2b1f]">
              현재 결제는 신용·체크카드로만 하실 수 있습니다. 무통장 입금과 간편결제는 준비 중이라
              지금은 선택하셔도 결제가 진행되지 않습니다. 무료 쿠폰이나 적립금으로 결제 금액이
              모두 채워지는 경우에는 결제 없이 신청만 접수됩니다.
            </p>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5c3d2e]">
            신청하신 내용은 MY에서 진행 상황을 확인하실 수 있습니다. 인생곡은 신청접수, 상담진행,
            제작중, 완성/전달, 완료 순서로 진행됩니다. 1:1 사주상담은 상담 신청, 사주정보 입력,
            선생님과 1:1 상담, 상담 완료 순서로 진행됩니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">쿠폰 · 적립금 · 추천인</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            사주로그에는 쿠폰, 적립금, 추천인 코드, 할인 코드가 있습니다. 결제하실 때 조건에 맞는
            혜택을 사용하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            무료 쿠폰이나 적립금으로 결제 금액이 모두 채워지면 결제 없이 신청만 접수됩니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            추천인 코드를 사용하시면 신청하신 분께 할인이 적용되고, 추천해 주신 분께는 적립금이
            쌓입니다. 보유하신 쿠폰과 적립금은 MY에서 확인하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            각 혜택의 사용 조건은 쿠폰과 코드마다 다르며, 해당 화면에서 안내해 드립니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">취소 · 환불</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            결제를 마치신 것만으로 제작이 시작되지는 않습니다. 실제 맞춤 제작이 시작되기 전에는
            취소와 전액 환불을 요청하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            제작이 시작된 뒤에 요청하신 경우에도 자동으로 거절하지 않습니다. 실제로 진행된 작업과
            제공 상태, 그리고 관계 법령에 따라 확인한 뒤 안내해 드립니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            1:1 사주상담은 예약하신 상담 시작 시각을 기준으로 정확히 3시간 전까지 요청하시면 일반
            취소·환불 절차로 처리해 드립니다. 3시간이 채 남지 않은 때, 예약하신 시각이 지난 뒤,
            상담에 참여하지 못하신 경우에도 자동으로 거절하지 않고 개별적으로 확인해 드립니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            회사 또는 선생님의 사정으로 상담을 제공해 드리지 못하는 경우에는 전액 환불과 무상 일정
            변경 중에서 고객님이 선택하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            이 약관은 관계 법령에 따른 소비자의 권리를 제한하지 않습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            자세한 기준과 요청 방법은{" "}
            <Link href="/refund" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
              취소·환불 정책
            </Link>
            을 확인해 주세요.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">저작권과 창작물 이용</h3>
          {COPYRIGHT_NOTICE_PARAGRAPHS.map((text) => (
            <p key={text} className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
              {text}
            </p>
          ))}
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            같은 내용을 신청 마지막 단계에서도 한 번 더 확인해 드립니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">회원 탈퇴</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            회원 탈퇴는 MY에서 하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            진행 중인 주문이나 상담, 결제가 있으면 먼저 마무리하신 뒤에 탈퇴하실 수 있습니다.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            탈퇴하시면 보유하신 적립금과 쿠폰은 사라지며 되돌릴 수 없습니다. 탈퇴 후 개인정보가 어떻게
            처리되는지는{" "}
            <Link href="/privacy" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
              개인정보 처리방침
            </Link>
            에서 확인해 주세요.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <h3 className="text-[17px] font-bold text-[#403A49]">문의</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            서비스 이용, 취소·환불, 약관에 대한 문의는 아래로 연락해 주세요.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            <a href="mailto:code8jmk@gmail.com" className="font-semibold underline underline-offset-2">
              code8jmk@gmail.com
            </a>
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
            앱 안의 문의하기로도 남기실 수 있습니다.
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
          <Link href="/privacy" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
            개인정보 처리방침
          </Link>
          도 함께 확인해 주세요.
        </p>
      </div>
    </MobileShell>
  );
}
