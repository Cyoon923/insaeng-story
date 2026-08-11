"use client";

import { useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { formatPrice } from "@/lib/constants/products";
import { cn } from "@/lib/utils";

const BASE_PRICE = 240000;
const OPTIONS_TOTAL = 160000;
const FINAL_PRICE = BASE_PRICE + OPTIONS_TOTAL;

const PAYMENT_METHODS = ["신용/체크카드", "무통장 입금", "카카오페이", "네이버페이"];

export default function ApplyStep6Page() {
  const [agreed, setAgreed] = useState(false);
  const [payment, setPayment] = useState("신용/체크카드");

  return (
    <ApplyLayout step={6} prevHref="/apply/story-song/5" hideNav>
      <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-xl font-bold text-brown-dark">
        6. 확인 및 결제
      </h2>
      <p className="mt-2 text-sm text-brown-light">입력하신 정보를 확인하고 결제를 진행해 주세요.</p>

      <div className="mt-5 space-y-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
          <h3 className="mb-3 text-sm font-bold text-brown-dark">주문 정보 확인</h3>
          {[
            ["이야기 주인공", "부모님"],
            ["가사 분위기", "따뜻한 / 잔잔한 / 희망적인"],
            ["추가 옵션", "AI MV, 추억사진 영상, 가사 수정, 선물 패키지"],
            ["예상 제작 기간", "결제 후 평균 7~10일"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between border-b border-border py-2 last:border-0">
              <span className="text-xs text-brown-light">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-right text-xs font-medium text-brown-dark">{value}</span>
                <button type="button" className="text-[10px] text-brown underline">
                  수정
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
          <h3 className="mb-3 text-sm font-bold text-brown-dark">결제 금액 확인</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-brown-light">기본 제작 상품 (인생곡)</span>
              <span>{formatPrice(BASE_PRICE)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brown-light">추가 옵션 합계</span>
              <span>+ {formatPrice(OPTIONS_TOTAL)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>할인 금액</span>
              <span>- 0원</span>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-ivory p-4 text-center">
            <p className="text-xs text-brown-light">최종 결제 금액</p>
            <p className="text-2xl font-bold text-brown">{formatPrice(FINAL_PRICE)}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#f5ebe3] p-4">
          <h3 className="text-sm font-bold text-brown-dark">저작권 및 창작물 이용 안내 [필수]</h3>
          <p className="mt-2 text-xs leading-relaxed text-brown-light">
            제작된 창작물(가사, 음원, 영상 등)의 저작권은 인생스토리가 가집니다. 고객은 완성된 창작물을
            개인적인 감상, 소장, 선물 등의 목적으로 이용할 수 있습니다. 상업적 이용, 재판매, 무단 배포,
            2차 저작물 제작 등은 인생스토리의 사전 동의 없이 할 수 없습니다.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brown"
            />
            <span className="text-xs text-brown-dark">
              위 내용을 모두 확인하였으며 이에 동의합니다. [필수]
            </span>
          </label>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-brown-dark">결제 방법 선택</h3>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPayment(method)}
                className={cn(
                  "rounded-xl border py-3 text-xs font-medium",
                  payment === method ? "border-brown bg-brown/10 text-brown" : "border-border bg-white"
                )}
              >
                {method}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!agreed}
        className="mt-6 flex w-full items-center justify-center rounded-full bg-brown py-4 text-base font-bold text-white disabled:opacity-40"
      >
        🔒 {formatPrice(FINAL_PRICE)} 결제하기 &gt;
      </button>
      <p className="mt-2 text-center text-[10px] text-brown-light">
        모든 결제 정보는 안전하게 암호화되어 처리됩니다.
      </p>
    </ApplyLayout>
  );
}
