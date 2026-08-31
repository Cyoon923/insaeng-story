"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { PaySubmit } from "@/components/apply/PaySubmit";
import { CONSULT_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { formatPrice } from "@/lib/constants/products";
import { getDraft } from "@/lib/client/api";

const BASE_PRICE = 100000;
const REPORT_PRICE = 20000;
const EXTRA_PRICE = 50000;
const PAYMENT_METHODS = ["신용/체크카드", "무통장 입금", "카카오페이", "네이버페이"];

export default function ConsultationStep4Page() {
  const [agreed, setAgreed] = useState(false);
  const [payment, setPayment] = useState("신용/체크카드");
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(getDraft("consultation"));
  }, []);

  const hasReport = draft.report === "1" || (draft.option ?? "").includes("상담 기록 요약 리포트");
  const hasExtra = draft.extraPerson === "1" || (draft.option ?? "").includes("추가 인원");
  const extraTotal = (hasReport ? REPORT_PRICE : 0) + (hasExtra ? EXTRA_PRICE : 0);
  const finalPrice = BASE_PRICE + extraTotal;
  const selfInfo = [draft.name, draft.birth].filter(Boolean).join(" / ") || "입력 없음";
  const counterpartInfo = hasExtra
    ? [draft.counterpartName, draft.counterpartBirth].filter(Boolean).join(" / ") || "입력 없음"
    : "";
  const contentLabel = draft.content?.trim() ? draft.content.trim() : "작성 없음";

  return (
    <ApplyLayout
      step={4}
      title="사주 분석 시작하기"
      basePath="/apply/consultation"
      steps={CONSULT_STEPS}
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
      prevHref="/apply/consultation/3"
      hideNav
      heroText={"선택한 상담 내용을 확인하고\n결제를 진행해 주세요"}
    >
      <h2 className="font-serif text-[22px] font-bold text-[#403A49]">4. 확인 및 결제</h2>

      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <h3 className="text-[16px] font-bold text-[#403A49]">상담 정보</h3>
        <div className="mt-3 space-y-2 text-[14px]">
          <Row label="본인 상담 정보" value={selfInfo} href="/apply/consultation/2" />
          <Row label="선생님" value={draft.teacher || "선택 없음"} href="/apply/consultation/1" />
          <Row label="날짜/시간" value={draft.datetime || "선택 없음"} href="/apply/consultation/1" />
          <Row label="상담 목적" value={draft.purpose || "선택 없음"} href="/apply/consultation/1" />
          <Row label="상담 방법" value={draft.method || "선택 없음"} href="/apply/consultation/3" />
          <Row label="상담 옵션" value={draft.option || "없음"} href="/apply/consultation/1" />
          {hasExtra ? (
            <Row label="상대방 정보" value={counterpartInfo} href="/apply/consultation/2" />
          ) : null}
          <Row label="상담 내용" value={contentLabel} href="/apply/consultation/3" />
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
        <div className="flex justify-between text-[14px]">
          <span className="text-[#6B6570]">1:1 사주상담</span>
          <span>{formatPrice(BASE_PRICE)}</span>
        </div>
        {hasReport ? (
          <div className="mt-2 flex justify-between text-[14px]">
            <span className="text-[#6B6570]">상담 기록 요약 리포트</span>
            <span>+ {formatPrice(REPORT_PRICE)}</span>
          </div>
        ) : null}
        {hasExtra ? (
          <div className="mt-2 flex justify-between text-[14px]">
            <span className="text-[#6B6570]">추가 인원 1명 (궁합)</span>
            <span>+ {formatPrice(EXTRA_PRICE)}</span>
          </div>
        ) : null}
        <p className="mt-4 text-center text-[13px] text-[#6B6570]">최종 금액</p>
        <p className="text-center text-[24px] font-bold text-[#403A49]">{formatPrice(finalPrice)}</p>
      </div>

      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <p className="text-[15px] font-bold text-[#403A49]">취소·환불 안내</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#403A49]">
          상담이 시작되기 전에는 취소와 환불을 요청할 수 있습니다. 상담 시간이 지난 뒤에는 환불이 어려울 수
          있습니다.
        </p>
        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[#403A49]"
          />
          <span className="text-[14px] leading-relaxed text-[#3d2b1f]">
            <Link href="/terms" className="font-medium text-[#403A49] underline underline-offset-2">
              이용약관
            </Link>
            의 상담 이용 안내 및 취소·환불 규정에 동의합니다. [필수]
          </span>
        </label>
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-[16px] font-bold text-[#403A49]">결제수단</h3>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPayment(method)}
              className={`h-12 rounded-xl text-[14px] font-medium ${
                payment === method ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
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
          amount={finalPrice}
          payment={payment}
          details={{
            teacher: draft.teacher || "",
            datetime: draft.datetime || "",
            purpose: draft.purpose || "",
            method: draft.method || "카카오톡 상담",
            option: draft.option || "없음",
          }}
          label={`${formatPrice(finalPrice)} 결제하기`}
        />
      ) : (
        <button
          type="button"
          disabled
          className="mt-6 flex h-14 w-full items-center justify-center rounded-lg bg-[#403A49] text-[16px] font-bold text-white opacity-40"
        >
          {formatPrice(finalPrice)} 결제하기
        </button>
      )}
    </ApplyLayout>
  );
}

function Row({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-start justify-between border-b border-[#ebe3d8] py-2 last:border-0">
      <div className="min-w-0 pr-3">
        <p className="text-[13px] text-[#6B6570]">{label}</p>
        <p className="text-[15px] font-medium leading-snug text-[#3d2b1f]">{value}</p>
      </div>
      <Link href={href} className="shrink-0 text-[13px] text-[#403A49]">
        수정
      </Link>
    </div>
  );
}
