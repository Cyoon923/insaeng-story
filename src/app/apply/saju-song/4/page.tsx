"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { PaySubmit } from "@/components/apply/PaySubmit";
import { SAJU_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { formatPrice, LIFE_SONG_PRODUCTS } from "@/lib/constants/products";
import { ORDER_OPTION_PRICES } from "@/lib/server/pricing";
import { getDraft } from "@/lib/client/api";
import {
  COPYRIGHT_CONSENT_LABEL,
  COPYRIGHT_NOTICE_PARAGRAPHS,
  COPYRIGHT_NOTICE_TITLE,
} from "@/lib/constants/legal";

const BASE_PRICE = LIFE_SONG_PRODUCTS[2].priceFrom;
/** 서버(src/lib/server/pricing.ts)와 같은 id·가격을 쓴다. 표시용 이름만 여기서 붙인다. */
const OPTION_PRICES = [
  { id: "ai-mv", name: "내 얼굴 AI 뮤직비디오", price: ORDER_OPTION_PRICES["ai-mv"] },
  { id: "photo-mv", name: "추억사진 영상 제작", price: ORDER_OPTION_PRICES["photo-mv"] },
  { id: "lyric-edit", name: "가사 수정 1회 추가", price: ORDER_OPTION_PRICES["lyric-edit"] },
];
const PAYMENT_METHODS = ["신용/체크카드", "무통장 입금", "카카오페이", "네이버페이"];
/** 지금 실제로 결제되는 유일한 수단. 나머지는 준비 중이라 고를 수 없다. */
const CARD_PAYMENT = "신용/체크카드";

function moodLabel(draft: Record<string, string>) {
  const parts = [draft.moods, draft.customMood].filter(Boolean);
  return parts.join(" / ") || "선택 없음";
}

function selectedOptions(draft: Record<string, string>) {
  const ids = (draft.optionIds ?? "").split(",").filter(Boolean);
  if (ids.length) return OPTION_PRICES.filter((opt) => ids.includes(opt.id));
  // optionIds 이전에 저장된 draft는 기존처럼 한글 이름으로 복원한다.
  const raw = draft.options ?? "";
  if (!raw) return [];
  return OPTION_PRICES.filter((opt) => raw.includes(opt.name));
}

function sajuLabel(draft: Record<string, string>) {
  const parts = [
    draft.name,
    draft.birth,
    draft.calendar,
    draft.unknownTime === "1" ? "태어난 시간 모름" : draft.birthTime,
  ].filter(Boolean);
  return parts.join(" / ") || "입력 없음";
}

export default function ApplyStep6Page() {
  const [agreed, setAgreed] = useState(false);
  // 취소·환불 [필수] 동의. 저작권 동의(agreed)와 독립적으로 관리한다.
  const [refundAgreed, setRefundAgreed] = useState(false);
  const [payment, setPayment] = useState(CARD_PAYMENT);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(getDraft("saju-song"));
  }, []);

  const options = selectedOptions(draft);
  const optionLabel = [
    options.map((opt) => opt.name).join(", ") || "없음",
    draft.videoStyle ? `영상 스타일: ${draft.videoStyle}` : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const optionsTotal = options.reduce((sum, opt) => sum + opt.price, 0);
  const finalPrice = BASE_PRICE + optionsTotal;
  const rows = [
    { label: "사주 정보", value: sajuLabel(draft), href: "/apply/saju-song/1" },
    { label: "가사 분위기", value: moodLabel(draft), href: "/apply/saju-song/2" },
    { label: "추가 옵션", value: optionLabel, href: "/apply/saju-song/3" },
    { label: "예상 제작 기간", value: "결제 후 평균 5~7일", href: "" },
  ];

  return (
    <ApplyLayout
      step={4}
      title="사주 인생곡 신청하기"
      basePath="/apply/saju-song"
      steps={SAJU_STEPS}
      prevHref="/apply/saju-song/3"
      hideNav
      heroText={"입력하신 내용을 확인하고\n결제를 진행해 주세요"}
    
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
    >
      <h2 className="text-[22px] font-bold text-[#403A49]">4. 확인 및 결제</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
        입력하신 정보를 확인하고 결제를 진행해 주세요. 결제 후 담당자가 확인한 뒤 제작을 시작하며,
        제작이 시작되면 주문 상태가 &ldquo;제작중&rdquo;으로 바뀝니다.
      </p>

      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <h3 className="text-[16px] font-bold text-[#403A49]">주문 정보 확인</h3>
        <div className="mt-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between border-b border-[#ebe3d8] py-3 last:border-0">
              <div>
                <p className="text-[13px] text-[#6B6570]">{row.label}</p>
                <p className="mt-0.5 text-[15px] font-medium text-[#3d2b1f]">{row.value}</p>
              </div>
              {row.href ? (
                <Link href={row.href} className="text-[13px] font-medium text-[#403A49]">
                  수정
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        <h3 className="text-[16px] font-bold text-[#403A49]">결제 금액 확인</h3>
        <div className="mt-3 space-y-2 text-[14px]">
          <div className="flex justify-between">
            <span className="text-[#6B6570]">사주 인생곡</span>
            <span className="text-[#3d2b1f]">{formatPrice(BASE_PRICE)}</span>
          </div>
          {options.map((opt) => (
            <div key={opt.name} className="flex justify-between">
              <span className="text-[#6B6570]">{opt.name}</span>
              <span className="text-[#3d2b1f]">+ {formatPrice(opt.price)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-[#f5efe6] p-4 text-center">
          <p className="text-[13px] text-[#6B6570]">최종 결제 금액</p>
          <p className="mt-1 text-[24px] font-bold text-[#403A49]">{formatPrice(finalPrice)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
        <h3 className="text-[16px] font-bold text-[#403A49]">사진 안내</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-[#403A49]">
          얼굴 사진, 추억 사진은 지금 올리지 않으셔도 됩니다. 결제 후 카카오톡으로 연락드려 사진을
          받겠습니다.
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
        <h3 className="text-[16px] font-bold text-[#403A49]">{COPYRIGHT_NOTICE_TITLE}</h3>
        {COPYRIGHT_NOTICE_PARAGRAPHS.map((text) => (
          <p key={text} className="mt-2 text-[13px] leading-relaxed text-[#403A49]">
            {text}
          </p>
        ))}
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[#403A49]"
          />
          <span className="text-[14px] leading-relaxed text-[#3d2b1f]">
            {COPYRIGHT_CONSENT_LABEL}
          </span>
        </label>
      </div>

      {/*
        취소·환불 [필수] 동의.
        이 문구가 어느 판인지는 legal.ts의 신청 동의 버전(= 시행일)이 가리킨다.
        문구를 고치면 그 상수도 함께 올려야 증빙이 가리키는 문구가 갈라지지 않는다.
      */}
      <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
        <h3 className="text-[16px] font-bold text-[#403A49]">취소·환불 안내 [필수]</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[#403A49]">
          맞춤 제작 상품의 특성상 제작 진행 상태에 따라 취소·환불이 제한될 수 있습니다. 자세한 기준은{" "}
          <Link href="/refund" className="font-semibold underline underline-offset-2">
            취소·환불 안내
          </Link>
          에서 확인하실 수 있습니다.
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={refundAgreed}
            onChange={(e) => setRefundAgreed(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[#403A49]"
          />
          <span className="text-[14px] leading-relaxed text-[#3d2b1f]">
            취소·환불 안내를 확인했으며 동의합니다. [필수]
          </span>
        </label>
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-[16px] font-bold text-[#403A49]">결제 방법 선택</h3>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((method) => {
            /*
             * 지금 실제로 결제되는 것은 카드뿐이다(PaySubmit의 CARD_ONLY_MESSAGE 방어와 같은 기준).
             * 나머지는 목록에서 빼지 않고 누를 수 없게 두고 "준비 중"임을 그 자리에서 알린다.
             * 고를 수 있게 두면 결제 단계까지 가서야 막혀 헛걸음이 된다.
             */
            const ready = method === CARD_PAYMENT;
            return (
              <button
                key={method}
                type="button"
                // disabled면 클릭 이벤트가 발생하지 않으므로 payment는 바뀌지 않는다.
                disabled={!ready}
                onClick={() => setPayment(method)}
                className={`min-h-12 rounded-xl text-[14px] font-medium flex flex-col items-center justify-center ${
                  payment === method
                    ? "bg-[#403A49] text-white"
                    : ready
                      ? "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
                      : "border border-[#ebe3d8] bg-[#f5efe6] text-[#9a938c]"
                }`}
              >
                {method}
                {ready ? null : (
                  <span className="mt-0.5 text-[12px] font-normal">준비 중</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {agreed && refundAgreed ? (
        <PaySubmit
          flow="saju-song"
          kind="order"
          product="saju-song"
          title="사주 인생곡"
          amount={finalPrice}
          optionIds={options.map((opt) => opt.id)}
          payment={payment}
          details={{
            // [필수] 동의 두 건을 각각 전달한다. 화면에서 따로 눌리므로 따로 보낸다.
            // 보내는 것은 동의 여부뿐이다. 시각과 버전은 서버가 채운다
            // (refundConsent / copyrightConsent 증빙).
            applyConsent: refundAgreed ? "1" : "",
            copyrightConsent: agreed ? "1" : "",
            사주정보: sajuLabel(draft),
            분위기: moodLabel(draft),
            옵션: optionLabel,
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
      <p className="mt-2 text-center text-[12px] text-[#6B6570]">
        모든 결제 정보는 안전하게 암호화되어 처리됩니다.
      </p>
    </ApplyLayout>
  );
}
