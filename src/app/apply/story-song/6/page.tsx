"use client";

import { useState } from "react";
import Link from "next/link";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { PaySubmit } from "@/components/apply/PaySubmit";
import { formatPrice, LIFE_SONG_PRODUCTS } from "@/lib/constants/products";

const BASE_PRICE = LIFE_SONG_PRODUCTS[0].priceFrom;
const OPTIONS = [
  { name: "내 얼굴 AI 뮤직비디오", price: 100000 },
  { name: "추억사진 영상 제작", price: 50000 },
  { name: "가사 수정 1회 추가", price: 10000 },
];
const OPTIONS_TOTAL = OPTIONS.reduce((sum, item) => sum + item.price, 0);
const FINAL_PRICE = BASE_PRICE + OPTIONS_TOTAL;

const ORDER_ROWS = [
  { label: "이야기 주인공", value: "부모님", href: "/apply/story-song/2" },
  { label: "가사 분위기", value: "따뜻한 / 잔잔한 / 희망적인", href: "/apply/story-song/4" },
  { label: "추가 옵션", value: "AI 뮤직비디오, 추억사진 영상, 가사 수정 1회", href: "/apply/story-song/5" },
  { label: "예상 제작 기간", value: "결제 후 평균 7~10일", href: "" },
];

const PAYMENT_METHODS = ["신용/체크카드", "무통장 입금", "카카오페이", "네이버페이"];

export default function ApplyStep6Page() {
  const [agreed, setAgreed] = useState(false);
  const [payment, setPayment] = useState("신용/체크카드");

  return (
    <ApplyLayout step={6} prevHref="/apply/story-song/5" hideNav>
      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">6. 확인 및 결제</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">
        입력하신 정보를 확인하고 결제를 진행해 주세요. 주문 완료 후 제작이 시작됩니다.
      </p>

      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <h3 className="text-[18px] font-bold text-[#3d2b1f]">주문 정보 확인</h3>
        <div className="mt-2">
          {ORDER_ROWS.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3 border-b border-[#ebe3d8] py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-[14px] text-[#8b6f5c]">{row.label}</p>
                <p className="mt-0.5 text-[16px] font-medium leading-snug text-[#3d2b1f]">{row.value}</p>
              </div>
              {row.href ? (
                <Link href={row.href} className="shrink-0 pt-1 text-[15px] font-semibold text-[#5c3d2e]">
                  수정
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <h3 className="text-[18px] font-bold text-[#3d2b1f]">결제 금액 확인</h3>
        <div className="mt-3 space-y-2 text-[16px]">
          <div className="flex justify-between gap-3">
            <span className="text-[#8b6f5c]">이야기로 만드는 인생곡</span>
            <span className="shrink-0 text-[#3d2b1f]">{formatPrice(BASE_PRICE)}</span>
          </div>
          {OPTIONS.map((opt) => (
            <div key={opt.name} className="flex justify-between gap-3">
              <span className="text-[#8b6f5c]">{opt.name}</span>
              <span className="shrink-0 text-[#3d2b1f]">+ {formatPrice(opt.price)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-[#f5efe6] p-4 text-center">
          <p className="text-[15px] text-[#8b6f5c]">최종 결제 금액</p>
          <p className="mt-1 text-[26px] font-bold text-[#5c3d2e]">{formatPrice(FINAL_PRICE)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
        <h3 className="text-[18px] font-bold text-[#3d2b1f]">사진 안내</h3>
        <p className="mt-2 text-[16px] leading-relaxed text-[#5c3d2e]">
          얼굴 사진, 추억 사진은 지금 올리지 않으셔도 됩니다. 결제 후 카카오톡으로 연락드려 사진을
          받겠습니다.
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
        <h3 className="text-[18px] font-bold text-[#3d2b1f]">저작권 및 이용 안내 [필수]</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5c3d2e]">
          인생곡 제작물의 저작권은 인생스토리가 보유합니다. 고객은 개인 감상, 소장, 선물 용도로 사용할 수
          있습니다. 상업적 이용, 재판매, 무단 배포, 2차 저작물 제작은 사전 동의 없이 할 수 없습니다.
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-7 w-7 accent-[#5c3d2e]"
          />
          <span className="text-[16px] leading-relaxed text-[#3d2b1f]">
            저작권 및 창작물 이용 안내를 확인했으며 동의합니다. [필수]
          </span>
        </label>
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-[18px] font-bold text-[#3d2b1f]">결제 방법 선택</h3>
        <div className="grid grid-cols-2 gap-3">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPayment(method)}
              className={`min-h-14 rounded-xl px-2 text-[16px] font-semibold ${
                payment === method
                  ? "bg-[#5c3d2e] text-white"
                  : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {agreed ? (
        <PaySubmit
          flow="story"
          kind="order"
          product="story"
          title="이야기로 만드는 인생곡"
          amount={FINAL_PRICE}
          payment={payment}
          details={{
            주인공: "부모님",
            분위기: "따뜻한 / 잔잔한 / 희망적인",
            옵션: "AI 뮤직비디오, 추억사진 영상, 가사 수정 1회",
          }}
          label={`${formatPrice(FINAL_PRICE)} 결제하기`}
        />
      ) : (
        <button
          type="button"
          disabled
          className="mt-6 flex h-16 w-full items-center justify-center rounded-lg bg-[#5c3d2e] text-[18px] font-bold text-white opacity-40"
        >
          {formatPrice(FINAL_PRICE)} 결제하기
        </button>
      )}
      <p className="mt-2 text-center text-[14px] text-[#8b6f5c]">
        모든 결제 정보는 안전하게 암호화되어 처리됩니다.
      </p>
    </ApplyLayout>
  );
}
