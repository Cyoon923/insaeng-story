"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearDraft, fetchMe, getDraft, postApp } from "@/lib/client/api";
import { formatPrice } from "@/lib/constants/products";
import type { Coupon, CouponProduct } from "@/lib/types/app";

export function PaySubmit({
  flow,
  kind,
  product,
  title,
  amount,
  payment,
  details,
  label,
}: {
  flow: string;
  kind: "order" | "consultation";
  product?: "story" | "premium" | "saju-song";
  title: string;
  amount: number;
  payment: string;
  details: Record<string, string>;
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  // 로그인 여부는 기존 세션 판별(GET /api/app 의 user)을 그대로 쓴다.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
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

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setLoggedIn(Boolean(data.user));
        setCoupons((data.coupons ?? []) as Coupon[]);
        setPoints(Number(data.user?.points ?? 0) || 0);
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
      const merged: Record<string, string> = {
        ...details,
        ...draft,
        referralCode: usingCoupon ? "" : referralCode.trim().toUpperCase(),
        couponId,
        usePoints: !usingCoupon && usePoints ? "1" : "",
      };
      if (kind === "order") {
        const result = await postApp({
          action: "createOrder",
          product,
          title,
          amount,
          payment,
          details: merged,
        });
        // 서버가 주문을 만든 뒤에만 이 플로우 draft를 비운다.
        clearDraft(flow);
        router.push(`/apply/complete?type=order&id=${result.order.id}`);
      } else {
        const result = await postApp({
          action: "createConsultation",
          title,
          amount,
          payment,
          teacher: merged.teacher ?? "유비 선생",
          datetime: merged.datetime ?? "",
          purpose: merged.purpose ?? "",
          method: merged.method ?? "카카오톡 상담",
          option: merged.option ?? "없음",
          details: merged,
        });
        // 서버가 상담을 만든 뒤에만 이 플로우 draft를 비운다.
        clearDraft(flow);
        router.push(`/apply/complete?type=consult&id=${result.consultation.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제에 실패했습니다.");
    } finally {
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
            : payment === "무통장 입금"
              ? "신청하고 입금 안내받기"
              : label}
      </button>
      <p className="mt-2 text-center text-[13px] leading-relaxed text-[#6B6570]">
        {usingCoupon
          ? "쿠폰으로 신청만 접수됩니다. 결제는 하지 않습니다."
          : payAmount === 0 && pointsToUse > 0
            ? "적립금으로 신청만 접수됩니다. 결제는 하지 않습니다."
          : payment === "무통장 입금"
            ? "신청을 받아 둔 뒤, 입금 계좌를 카카오톡 또는 전화로 알려 드립니다."
            : "카드·간편결제는 결제사 등록 후 바로 결제됩니다. 지금은 신청만 접수됩니다."}
      </p>
    </div>
  );
}
