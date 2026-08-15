"use client";

import { useState } from "react";
import Link from "next/link";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { PaySubmit } from "@/components/apply/PaySubmit";
import { CONSULT_STEPS } from "@/components/apply/ApplyStepper";
import { formatPrice } from "@/lib/constants/products";

const BASE_PRICE = 100000;
const EXTRA = 50000;
const FINAL_PRICE = BASE_PRICE + EXTRA;
const PAYMENT_METHODS = ["신용/체크카드", "무통장 입금", "카카오페이", "네이버페이"];

export default function ConsultationStep4Page() {
  const [agreed, setAgreed] = useState(false);
  const [payment, setPayment] = useState("신용/체크카드");

  return (
    <ApplyLayout
      step={4}
      title="1:1 사주상담 시작하기"
      basePath="/apply/consultation"
      steps={CONSULT_STEPS}
      prevHref="/apply/consultation/3"
      hideNav
      heroText={"선택한 상담 내용을 확인하고\n결제를 진행해 주세요"}
    >
      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">4. 확인 및 결제</h2>

      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <h3 className="text-[16px] font-bold text-[#3d2b1f]">상담 정보</h3>
        <div className="mt-3 space-y-2 text-[14px]">
          <Row label="본인 상담 정보" value="입력 완료" href="/apply/consultation/2" />
          <Row label="선생님" value="유비 선생" href="/apply/consultation/1" />
          <Row label="날짜/시간" value="8월 12일(화) 오전 10:00" href="/apply/consultation/1" />
          <Row label="상담 목적" value="직업 · 사업 고민" href="/apply/consultation/1" />
          <Row label="상담 방법" value="카카오톡 상담" href="/apply/consultation/3" />
          <Row label="상담 옵션" value="추가 인원 1명(궁합)" href="/apply/consultation/1" />
          <Row label="상대방 정보" value="입력 완료" href="/apply/consultation/2" />
          <Row label="상담 내용" value="작성 완료" href="/apply/consultation/3" />
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
        <div className="flex justify-between text-[14px]">
          <span className="text-[#8b6f5c]">1:1 사주상담</span>
          <span>{formatPrice(BASE_PRICE)}</span>
        </div>
        <div className="mt-2 flex justify-between text-[14px]">
          <span className="text-[#8b6f5c]">추가 인원 1명 (궁합)</span>
          <span>+ {formatPrice(EXTRA)}</span>
        </div>
        <p className="mt-4 text-center text-[13px] text-[#8b6f5c]">최종 금액</p>
        <p className="text-center text-[24px] font-bold text-[#5c3d2e]">{formatPrice(FINAL_PRICE)}</p>
      </div>

      <label className="mt-5 flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[#5c3d2e]"
        />
        <span className="text-[14px] leading-relaxed text-[#3d2b1f]">
          상담 이용 안내 및 취소·환불 규정에 동의합니다. [필수]
        </span>
      </label>

      <div className="mt-5">
        <h3 className="mb-3 text-[16px] font-bold text-[#3d2b1f]">결제수단</h3>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPayment(method)}
              className={`h-12 rounded-xl text-[14px] font-medium ${
                payment === method ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {agreed ? (
        <PaySubmit
          flow="consultation"
          kind="consultation"
          title="1:1 사주상담"
          amount={FINAL_PRICE}
          payment={payment}
          details={{
            teacher: "유비 선생",
            datetime: "8월 12일(화) 오전 10:00",
            purpose: "직업 · 사업 고민",
            method: "카카오톡 상담",
            option: "추가 인원 1명(궁합)",
          }}
          label={`${formatPrice(FINAL_PRICE)} 결제하기`}
        />
      ) : (
        <button
          type="button"
          disabled
          className="mt-6 flex h-14 w-full items-center justify-center rounded-lg bg-[#5c3d2e] text-[16px] font-bold text-white opacity-40"
        >
          {formatPrice(FINAL_PRICE)} 결제하기
        </button>
      )}
    </ApplyLayout>
  );
}

function Row({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-start justify-between border-b border-[#ebe3d8] py-2 last:border-0">
      <div>
        <p className="text-[13px] text-[#8b6f5c]">{label}</p>
        <p className="text-[15px] font-medium text-[#3d2b1f]">{value}</p>
      </div>
      <Link href={href} className="text-[13px] text-[#5c3d2e]">
        수정
      </Link>
    </div>
  );
}
