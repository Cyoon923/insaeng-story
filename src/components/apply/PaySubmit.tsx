"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearDraft, fetchMe, getDraft, postApp } from "@/lib/client/api";
import { openNicepayCard } from "@/lib/client/nicepay";
import { formatPrice } from "@/lib/constants/products";
import { phoneDigits } from "@/lib/phoneVerification";
import type { Coupon, CouponProduct } from "@/lib/types/app";

/** 결제수단 선택 화면이 쓰는 값. NICEPAY 연결은 아직 이 카드 결제만 지원한다. */
const CARD_PAYMENT = "신용/체크카드";
const CARD_ONLY_MESSAGE = "지금은 신용/체크카드로만 결제할 수 있습니다. 결제수단을 카드로 선택해 주세요.";

export function PaySubmit({
  flow,
  kind,
  product,
  title,
  amount,
  payment,
  details,
  label,
  optionIds = [],
}: {
  flow: string;
  kind: "order" | "consultation";
  product?: "story" | "premium" | "saju-song";
  title: string;
  amount: number;
  payment: string;
  details: Record<string, string>;
  label: string;
  /** 서버가 금액을 다시 계산할 때 쓰는 옵션 id. 표시용 한글 문자열과 별개다. */
  optionIds?: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  // 로그인 여부는 기존 세션 판별(GET /api/app 의 user)을 그대로 쓴다.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  /** 휴대폰 본인확인을 마쳤는지. 아직 모르는 동안은 null이다. */
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponId, setCouponId] = useState("");
  const [points, setPoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const couponProduct: CouponProduct = kind === "consultation" ? "consultation" : (product ?? "story");
  const usableCoupons = coupons.filter((item) => item.product === couponProduct && !item.usedAt);
  const usingCoupon = Boolean(couponId);
  const normalizedCode = referralCode.trim().toUpperCase();
  const previewDiscount = !usingCoupon && normalizedCode.startsWith("IS") ? 10000 : 0;
  const afterDiscount = usingCoupon ? 0 : Math.max(0, amount - previewDiscount);
  const pointsToUse = !usingCoupon && usePoints ? Math.min(points, afterDiscount) : 0;
  const payAmount = Math.max(0, afterDiscount - pointsToUse);

  /**
   * 결제창에서 돌아왔을 때 버튼을 다시 풀어 주는 1회성 감시의 해제 함수.
   * 감시가 걸려 있지 않으면 null이다.
   */
  const releasePaymentWatch = useRef<(() => void) | null>(null);

  // 화면을 벗어나도 리스너가 남지 않게 한다.
  useEffect(() => () => releasePaymentWatch.current?.(), []);

  /**
   * NICEPAY 결제창에서 원래 화면으로 돌아오면 loading을 한 번만 푼다.
   * 결제창이 떠 있는 동안에는 아무 일도 하지 않으므로 재클릭이 막힌 상태가 유지된다.
   * 모바일처럼 returnUrl로 페이지가 실제 이동하는 경우에는 페이지가 사라지면서
   * 리스너도 함께 사라지므로 기존 결제 흐름에 관여하지 않는다.
   */
  const watchPaymentWindowReturn = () => {
    if (typeof window === "undefined") return;
    releasePaymentWatch.current?.();

    const cleanup = () => {
      releasePaymentWatch.current = null;
      window.removeEventListener("focus", handleReturn);
      document.removeEventListener("visibilitychange", handleVisible);
    };
    const handleReturn = () => {
      cleanup();
      setLoading(false);
    };
    const handleVisible = () => {
      if (document.visibilityState === "visible") handleReturn();
    };

    releasePaymentWatch.current = cleanup;
    window.addEventListener("focus", handleReturn);
    document.addEventListener("visibilitychange", handleVisible);
  };

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setLoggedIn(Boolean(data.user));
        setCoupons((data.coupons ?? []) as Coupon[]);
        setPoints(Number(data.user?.points ?? 0) || 0);
        // 서버 관문(preparePayment / createOrder / createConsultation)과 같은 기준으로
        // 본인확인 여부만 미리 읽어 둔다. 판정을 화면으로 옮기는 것이 아니라,
        // 막힐 것을 알면서 결제 화면으로 보내지 않기 위한 안내다.
        setPhoneVerified(phoneDigits(String(data.user?.phone ?? "")).length >= 10);
      })
      .catch(() => {
        setLoggedIn(false);
      });
  }, []);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const draft = getDraft(flow);
      if (!draft.phone) {
        throw new Error("1단계에서 이름과 연락처를 입력해 주세요.");
      }
      if (!loggedIn) {
        // 연락처만으로 계정을 만들지 않는다. 비밀번호 없는 회원이 생기기 때문이다.
        throw new Error("신청을 접수하려면 먼저 로그인해 주세요.");
      }
      /**
       * 휴대폰 본인확인 전이면 인증 화면으로 보낸다.
       *
       * 서버 관문을 대신하는 것이 아니다. 서버는 그대로 막고 있고(STEP 1),
       * 여기서 막히는 대신 인증 화면으로 안내해 사용자가 막다른 길에 빠지지 않게 한다.
       * 네 상품이 이 컴포넌트를 함께 쓰므로 한 곳만 고치면 모두에 걸린다.
       * 돌아올 주소는 기존 규칙(safeNextPath: /apply/ 경로만)으로 서버가 다시 검사한다.
       */
      if (phoneVerified === false) {
        const back = `${window.location.pathname}${window.location.search}`;
        router.push(`/my/verify-phone?next=${encodeURIComponent(back)}`);
        return;
      }
      const merged: Record<string, string> = {
        ...details,
        ...draft,
        referralCode: usingCoupon ? "" : referralCode.trim().toUpperCase(),
        couponId,
        usePoints: !usingCoupon && usePoints ? "1" : "",
      };

      // 신청 내용은 두 흐름이 똑같이 쓴다. 유료/0원 판단은 서버가 한다.
      const applyBody: Record<string, unknown> =
        kind === "order"
          ? {
              product,
              title,
              options: optionIds,
              payment,
              details: merged,
            }
          : {
              title,
              report: merged.report === "1" ? "1" : "",
              extraPerson: merged.extraPerson === "1" ? "1" : "",
              payment,
              teacher: merged.teacher ?? "유비 선생",
              datetime: merged.datetime ?? "",
              purpose: merged.purpose ?? "",
              method: merged.method ?? "카카오톡 상담",
              option: merged.option ?? "없음",
              details: merged,
            };

      // 결제가 필요해 보이는데 카드가 아니면 결제 준비 자체를 하지 않는다.
      // 쓸모없는 ready 결제 기록이 남지 않는다.
      if (payAmount > 0 && payment !== CARD_PAYMENT) {
        throw new Error(CARD_ONLY_MESSAGE);
      }

      // 금액은 서버가 다시 계산한다. 화면의 payAmount는 결제창에 넘기지 않는다.
      const prepared = await postApp({ action: "preparePayment", kind, ...applyBody });

      if (prepared.requiresPayment) {
        if (payment !== CARD_PAYMENT) {
          throw new Error(CARD_ONLY_MESSAGE);
        }
        // 유료 주문은 여기서 끝낸다. 주문/상담은 NICEPAY 승인 성공 뒤에만 만든다.
        // draft도 아직 지우지 않는다.
        // 결제창이 닫혀 이 화면으로 돌아오는 경우에만 버튼을 푼다.
        watchPaymentWindowReturn();
        await openNicepayCard({
          merchantOrderId: String(prepared.merchantOrderId),
          amount: Number(prepared.amount),
          goodsName: String(prepared.goodsName),
          onError: (message) => {
            releasePaymentWatch.current?.();
            setError(message);
            setLoading(false);
          },
        });
        return;
      }

      // 최종 0원(무료 쿠폰·적립금)은 기존 신청 흐름을 그대로 쓴다.
      if (kind === "order") {
        const result = await postApp({ action: "createOrder", ...applyBody });
        // 서버가 주문을 만든 뒤에만 이 플로우 draft를 비운다.
        clearDraft(flow);
        router.push(`/apply/complete?type=order&id=${result.order.id}`);
      } else {
        const result = await postApp({ action: "createConsultation", ...applyBody });
        // 서버가 상담을 만든 뒤에만 이 플로우 draft를 비운다.
        clearDraft(flow);
        router.push(`/apply/complete?type=consult&id=${result.consultation.id}`);
      }
    } catch (err) {
      releasePaymentWatch.current?.();
      setError(err instanceof Error ? err.message : "결제에 실패했습니다.");
      // 성공 경로는 결제창이 열리거나 완료 화면으로 이동하므로 버튼을 잠근 채로 둔다.
      // 실패했을 때만 다시 누를 수 있게 푼다.
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      {usableCoupons.length > 0 ? (
        <div className="mb-6">
          <p className="text-[16px] font-bold text-[#403A49]">무료 쿠폰</p>
          <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">있으면 골라 주세요. 없으면 넘어가도 됩니다.</p>
          <div className="mt-2 space-y-2">
            {usableCoupons.map((item) => {
              const active = couponId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCouponId(active ? "" : item.id);
                    if (!active) setUsePoints(false);
                  }}
                  className={`w-full rounded-xl px-4 py-3 text-left ${
                    active ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
                  }`}
                >
                  <p className="text-[15px] font-semibold">{item.title}</p>
                  <p className={`mt-1 text-[13px] ${active ? "text-white/80" : "text-[#6B6570]"}`}>
                    {active ? "이 쿠폰으로 무료 신청합니다" : "누르면 무료로 신청됩니다"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!usingCoupon ? (
        <>
          <label className="block text-[16px] font-bold text-[#403A49]" htmlFor="referral-code">
            추천인 코드
          </label>
          <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">없으면 비워 두세요.</p>
          <input
            id="referral-code"
            value={referralCode}
            onChange={(event) => setReferralCode(event.target.value)}
            placeholder="예: IS12AB34"
            className="mt-2 h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]"
          />
          {normalizedCode ? (
            <p className="mt-2 text-[14px] leading-relaxed text-[#5c3d2e]">
              {previewDiscount
                ? `코드가 맞으면 ${formatPrice(previewDiscount)} 할인됩니다.`
                : "코드가 맞으면 할인이 적용됩니다."}
              {previewDiscount ? (
                <>
                  <br />
                  결제 금액 {formatPrice(afterDiscount)}
                </>
              ) : null}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[15px] font-semibold leading-relaxed text-[#5c3d2e]">
          무료 쿠폰이 적용되어 결제 금액은 0원입니다.
        </p>
      )}

      {!usingCoupon && points > 0 ? (
        <div className="mt-6">
          <p className="text-[16px] font-bold text-[#403A49]">적립금</p>
          <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">
            보유 {formatPrice(points)} · 누르면 결제 금액에서 깎입니다.
          </p>
          <button
            type="button"
            onClick={() => setUsePoints((current) => !current)}
            className={`mt-2 w-full rounded-xl px-4 py-3 text-left ${
              usePoints ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
            }`}
          >
            <p className="text-[15px] font-semibold">
              {usePoints ? `${formatPrice(pointsToUse)} 사용` : "적립금 쓰기"}
            </p>
            <p className={`mt-1 text-[13px] ${usePoints ? "text-white/80" : "text-[#6B6570]"}`}>
              {usePoints
                ? `결제 금액 ${formatPrice(payAmount)}`
                : "결제 금액에서 적립금만큼 깎습니다"}
            </p>
          </button>
        </div>
      ) : null}
      {loggedIn === false ? (
        <div className="mt-4 rounded-xl bg-[#F7F6F8] p-4">
          <p className="text-[15px] font-semibold text-[#403A49]">로그인 후 신청할 수 있습니다</p>
          <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">
            지금까지 입력하신 내용은 그대로 저장되어 있습니다. 로그인하신 뒤 이 화면으로 돌아오시면
            이어서 신청하실 수 있습니다.
          </p>
          <Link
            href="/login"
            className="mt-3 flex h-14 w-full items-center justify-center rounded-lg bg-[#403A49] text-[16px] font-bold text-white"
          >
            로그인하러 가기
          </Link>
          <Link
            href="/signup"
            className="mt-2 flex h-12 w-full items-center justify-center rounded-lg border border-[#403A49] bg-white text-[15px] font-semibold text-[#403A49]"
          >
            회원가입
          </Link>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-center text-[14px] text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={loading || loggedIn !== true}
        className="mt-4 flex h-14 w-full items-center justify-center rounded-lg bg-[#403A49] text-[16px] font-bold text-white disabled:opacity-40"
      >
        {loading
          ? "처리 중..."
          : usingCoupon
            ? "무료로 신청하기"
            : payAmount === 0 && pointsToUse > 0
              ? "적립금으로 신청하기"
              : label}
      </button>
      {/*
        결제 안내는 실제 동작만 말한다. 유료 결제는 카드로만 되고 그 자리에서 진행된다
        (아래 submit의 CARD_ONLY_MESSAGE 방어와 같은 기준). 무통장 입금·간편결제는
        지금 동작하지 않으므로 접수·입금 안내를 약속하는 문구를 두지 않는다.
        쿠폰·적립금으로 결제 금액이 0원이 되는 경우만 결제 없이 접수된다.
      */}
      <p className="mt-2 text-center text-[13px] leading-relaxed text-[#6B6570]">
        {usingCoupon
          ? "쿠폰으로 신청만 접수됩니다. 결제는 하지 않습니다."
          : payAmount === 0 && pointsToUse > 0
            ? "적립금으로 신청만 접수됩니다. 결제는 하지 않습니다."
            : "신용/체크카드로 결제가 진행됩니다."}
      </p>
    </div>
  );
}
