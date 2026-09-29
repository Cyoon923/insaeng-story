"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe, postApp } from "@/lib/client/api";
import type { Coupon } from "@/lib/types/app";

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

/**
 * 사용기한(UTC ISO)을 한국 날짜로 보여 준다.
 *
 * 서버가 그 날 한국 시각 23:59:59로 저장하므로, 여기서도 +9시간을 더해
 * 한국 달력으로 읽어야 안내한 날짜와 같은 값이 보인다.
 * 값이 없는 쿠폰(기한 없음, 예전 쿠폰)은 빈 문자열이라 이 줄 자체가 나오지 않는다.
 */
function formatExpiry(value: string | undefined) {
  if (!value) return "";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return new Date(at.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", ".");
}

/** 쿠폰이 어떤 상품에 쓰이는지. 저장된 코드값을 사람이 읽는 말로 바꾼다. */
const PRODUCT_LABELS: Record<string, string> = {
  story: "이야기로 만드는 인생곡",
  premium: "프리미엄 인생곡",
  "saju-song": "사주 인생곡",
  consultation: "1:1 사주상담",
};

export default function CouponsPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemDone, setRedeemDone] = useState("");

  useEffect(() => {
    fetchMe().then((data) => {
      setLoggedIn(Boolean(data.user));
      setCoupons(data.coupons ?? []);
      setLoaded(true);
    });
  }, []);

  /**
   * 받은 코드를 등록한다. 화면은 코드 문자열만 보내고, 이 코드가 어떤 쿠폰인지는
   * 서버가 정한다(대소문자·공백 정리도 서버가 한다). 성공하면 서버가 돌려준
   * 목록으로 바로 갈아 끼워, 다시 불러오지 않아도 새 쿠폰이 보인다.
   */
  async function handleRedeem() {
    if (!code.trim() || redeeming) return;
    setRedeeming(true);
    setRedeemError("");
    setRedeemDone("");
    try {
      const data = await postApp({ action: "redeemCouponCode", code });
      setCoupons((data.coupons ?? []) as Coupon[]);
      setCode("");
      setRedeemDone("쿠폰이 등록되었습니다.");
    } catch (error) {
      setRedeemError(error instanceof Error ? error.message : "쿠폰을 등록하지 못했습니다.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <MobileShell>
      <AppHeader variant="page" title="쿠폰함" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">쿠폰함</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          받으신 쿠폰을 여기에서 확인하세요.
        </p>
      </section>

      {/* 코드 등록은 로그인한 회원에게만 보여 준다. 비회원에게는 아래 안내가 그대로 나온다. */}
      {loaded && loggedIn ? (
        <section className="px-4 pb-5">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe3d8]">
            <label htmlFor="coupon-code" className="block text-[16px] font-bold text-[#403A49]">
              쿠폰 코드 등록
            </label>
            <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">
              받으신 코드를 입력해 주세요.
            </p>
            <input
              id="coupon-code"
              type="text"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setRedeemError("");
                setRedeemDone("");
              }}
              className="mt-3 h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] uppercase text-[#403A49] outline-none focus:border-[#403A49]"
              placeholder="예) SAJULOG-OPEN"
            />
            <button
              type="button"
              onClick={handleRedeem}
              disabled={!code.trim() || redeeming}
              className="mt-3 flex h-14 w-full items-center justify-center rounded-xl bg-[#403A49] text-[16px] font-bold text-white disabled:opacity-40"
            >
              {redeeming ? "등록 중..." : "쿠폰 등록"}
            </button>
            {redeemDone ? (
              <p className="mt-3 text-[15px] font-semibold text-[#3d6b45]">{redeemDone}</p>
            ) : null}
            {redeemError ? (
              <p className="mt-3 text-[15px] font-semibold text-[#b4402f]">{redeemError}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="space-y-3 px-4 pb-8">
        {loaded && !loggedIn ? (
          <div className="rounded-2xl bg-white px-5 py-12 text-center ring-1 ring-[#ebe3d8]">
            <Ticket className="mx-auto h-10 w-10 text-[#8b6f5c]" strokeWidth={1.4} />
            <p className="mt-4 text-[17px] font-bold text-[#403A49]">로그인이 필요합니다</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
              로그인하면 받은 쿠폰을 확인할 수 있습니다.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
            >
              로그인하기
            </Link>
          </div>
        ) : null}
        {loaded && loggedIn && coupons.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-12 text-center ring-1 ring-[#ebe3d8]">
            <Ticket className="mx-auto h-10 w-10 text-[#8b6f5c]" strokeWidth={1.4} />
            <p className="mt-4 text-[17px] font-bold text-[#403A49]">보유한 쿠폰이 없습니다</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
              진행 중인 이벤트에서
              <br />
              혜택을 확인하실 수 있습니다.
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
            >
              이벤트 보기
            </Link>
          </div>
        ) : null}
        {coupons.map((coupon) => (
          <div key={coupon.id} className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe3d8]">
            <div className="flex items-start gap-3">
              <Ticket className="mt-0.5 h-6 w-6 text-[#403A49]" />
              <div>
                <p className="text-[16px] font-bold text-[#403A49]">{coupon.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">{coupon.desc}</p>
                {/* 상품·기한·코드는 저장된 값이 있을 때만 보여 준다. 예전 쿠폰에는 없다. */}
                {coupon.product ? (
                  <p className="mt-2 text-[13px] text-[#6B6570]">
                    {PRODUCT_LABELS[coupon.product] ?? coupon.product}
                  </p>
                ) : null}
                {formatExpiry(coupon.expiresAt) ? (
                  <p className="mt-1 text-[13px] text-[#6B6570]">
                    {formatExpiry(coupon.expiresAt)}까지
                  </p>
                ) : null}
                {coupon.sourceCode ? (
                  <p className="mt-1 text-[12px] tracking-wide text-[#6B6570]">
                    쿠폰 코드 {coupon.sourceCode}
                  </p>
                ) : null}
                <p className="mt-2 text-[12px] text-[#6B6570]">
                  {coupon.usedAt
                    ? "사용함"
                    : coupon.product
                      ? "신청할 때 쓰면 무료입니다"
                      : `받은 날 ${formatDate(coupon.createdAt)}`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}
