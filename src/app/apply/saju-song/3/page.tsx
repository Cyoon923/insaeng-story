"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { SAJU_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { formatPrice } from "@/lib/constants/products";
import { fetchMe, getDraft, saveDraft } from "@/lib/client/api";
import {
  checkSajuReportDelivery,
  ORDER_OPTION_PRICES,
  SAJU_CONSULTATION_OPTION_ID,
  SAJU_REPORT_OPTION_ID,
} from "@/lib/server/pricing";
import { isPromotionId, isPromotionOpen, PROMOTION_PRICES } from "@/lib/constants/promotions";
import { DEV_APPLY_PREVIEW } from "@/lib/devApplyPreview";
import type { User } from "@/lib/types/app";

const VIDEO_STYLES = [
  {
    name: "AI 실사 영상풍",
    desc: "실제 사람처럼 보이는 영상",
    image: "/images/video-style-live.png",
  },
  {
    name: "과거 레트로풍",
    desc: "옛날 사진처럼 따뜻하고 빛바랜 느낌",
    image: "/images/video-style-retro.png",
  },
  {
    name: "애니메이션풍",
    desc: "만화처럼 부드럽고 따뜻한 그림 느낌",
    image: "/images/video-style-animation.png",
  },
  {
    name: "스타일 상담 후 결정",
    desc: "어떤 스타일이 어울릴지 모르시겠다면 전화 상담을 통해 함께 결정해드립니다.",
    image: "/images/photo-video-style-consultation.png",
  },
];

const OPTIONS = [
  {
    id: "ai-mv",
    title: "내 얼굴 AI 뮤직비디오",
    price: 100000,
    desc: "얼굴 사진을 바탕으로 노래에 맞는 AI 뮤직비디오를 제작합니다.",
  },
  {
    id: "photo-mv",
    title: "추억사진 영상 제작",
    price: 50000,
    desc: "보내주신 사진을 인생곡에 맞춰 영상으로 편집합니다.",
  },
  {
    id: "lyric-edit",
    title: "가사 수정 1회 추가",
    price: 10000,
    desc: "기본 수정 1회에 더해 가사 수정을 1회 추가합니다.",
  },
  {
    id: SAJU_REPORT_OPTION_ID,
    title: "2026·2027년 사주풀이 리포트",
    // 가격은 서버 가격표에서 읽는다. 여기에 숫자를 따로 적으면 서버와 갈라진다.
    price: ORDER_OPTION_PRICES[SAJU_REPORT_OPTION_ID],
    desc: "2026년과 2027년의 전체 흐름, 핵심 키워드, 주의할 점과 활용 방향을 PDF로 정리해 드립니다.",
  },
  {
    id: SAJU_CONSULTATION_OPTION_ID,
    title: "1:1 사주상담",
    price: ORDER_OPTION_PRICES[SAJU_CONSULTATION_OPTION_ID],
    desc: "결제 후 등록하신 연락처로 상담 일정을 안내드립니다.",
    /** 오픈 이벤트 신청에서만 보여 준다. 정가 신청에는 팔지 않는 옵션이다. */
    eventOnly: true,
  },
];

/**
 * 지금 이 신청이 오픈 이벤트인지.
 *
 * 4단계와 같은 방식으로 draft의 값만 보고, 가격표·기간까지 맞을 때만 참이다.
 * 최종 판정은 서버가 한다(pricing.ts의 OPTION_ONLY_FOR_PROMOTION). 여기서는
 * 팔지 않는 옵션을 화면에 내지 않기 위해서만 쓴다.
 */
function isEventApply(draft: Record<string, string>): boolean {
  const promotion = draft.promotion;
  if (!isPromotionId(promotion)) return false;
  if (PROMOTION_PRICES[promotion].product !== "saju-song") return false;
  // localhost 미리보기에서는 오픈 전에도 화면만 보여 준다. 서버 판정은 그대로다.
  return isPromotionOpen(promotion) || DEV_APPLY_PREVIEW;
}

/** 리포트를 받는 방법. 저장값은 이 두 가지뿐이다. */
const DELIVERY_CHOICES = [
  { id: "kakao", label: "카카오톡" },
  { id: "email", label: "이메일" },
] as const;

export default function ApplyStep5Page() {
  const [selected, setSelected] = useState<string[]>([]);
  /** 오픈 이벤트 신청인지. 이벤트 전용 옵션을 낼지 정한다. */
  const [eventApply, setEventApply] = useState(false);
  const [videoStyle, setVideoStyle] = useState("AI 실사 영상풍");
  /** 리포트를 받는 방법. 아직 고르지 않았으면 빈 문자열이다. */
  const [delivery, setDelivery] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  /** 신청서에 적힌 연락처. 카카오톡으로 받을 때 어디로 가는지 보여 주기만 한다. */
  const [applyPhone, setApplyPhone] = useState("");

  /*
   * 저장은 이 함수 하나로만 한다.
   *
   * 옵션을 해제하거나 카카오톡으로 바꾸면 쓰지 않게 된 값을 빈 문자열로 덮어써
   * 지난 선택이 draft에 남지 않게 한다(영상 스타일을 비우는 기존 처리와 같다).
   * 휴대폰 번호는 저장하지 않는다. 신청서의 연락처(phone) 하나로 충분하다.
   */
  const persist = (ids: string[], style: string, nextDelivery: string, nextEmail: string) => {
    const labels = OPTIONS.filter((opt) => ids.includes(opt.id)).map((opt) => opt.title);
    const wantsReport = ids.includes(SAJU_REPORT_OPTION_ID);
    const usableDelivery = wantsReport ? nextDelivery : "";
    saveDraft("saju-song", {
      // 표시용 한글 문자열과, 서버가 금액을 계산할 때 쓰는 id를 함께 남긴다.
      options: labels.join(", "),
      optionIds: ids.join(","),
      videoStyle: ids.includes("ai-mv") ? style : "",
      sajuReportDelivery: usableDelivery,
      sajuReportEmail: usableDelivery === "email" ? nextEmail.trim() : "",
    });
  };

  useEffect(() => {
    const draft = getDraft("saju-song");
    const isEvent = isEventApply(draft);
    setEventApply(isEvent);
    /*
     * 이벤트 전용 옵션은 이벤트 신청에서만 되살린다. 이벤트 링크로 들어왔다가
     * 정가 신청으로 돌아온 경우에 지난 선택이 남아 있으면 서버가 주문을 만들지 않는다.
     */
    const sellable = OPTIONS.filter((opt) => isEvent || !opt.eventOnly);
    // 되돌아온 경우: optionIds가 있으면 그것을 쓰고, 예전 draft는 한글명으로 복원한다.
    const savedIds = (draft.optionIds ?? "").split(",").filter(Boolean);
    const ids = savedIds.length
      ? sellable.filter((opt) => savedIds.includes(opt.id)).map((opt) => opt.id)
      : draft.options
        ? sellable.filter((opt) => draft.options.includes(opt.title)).map((opt) => opt.id)
        : [];
    if (ids.length) setSelected(ids);
    if (draft.videoStyle) {
      const exists = VIDEO_STYLES.some((style) => style.name === draft.videoStyle);
      setVideoStyle(exists ? draft.videoStyle : "AI 실사 영상풍");
    }
    if (draft.sajuReportDelivery === "kakao" || draft.sajuReportDelivery === "email") {
      setDelivery(draft.sajuReportDelivery);
    }
    if (draft.sajuReportEmail) setReportEmail(draft.sajuReportEmail);
    // 1단계에서 받은 연락처. 카카오톡 안내에 보여 주기만 하고 다시 저장하지 않는다.
    if (draft.phone) setApplyPhone(draft.phone);
  }, []);

  /*
   * 이메일 기본값은 회원 정보에서 한 번만 가져온다.
   *
   * 이미 적어 둔 값이 있으면 건드리지 않는다. 소셜 가입 회원은 이메일이 비어 있을 수
   * 있어, 값이 없으면 빈 칸으로 두고 직접 적게 한다.
   *
   * ★ 판단 기준은 화면 상태가 아니라 draft다.
   *
   * 결제에 실리는 값은 draft이고(PaySubmit이 draft를 그대로 보낸다) 화면 상태는 그 사본일
   * 뿐이다. 응답이 늦게 도착했을 때 화면만 채우면, 입력칸에는 주소가 보이는데 draft는
   * 비어 있어 결제 단계에서 "이메일 주소를 입력해 주세요"로 막힌다.
   * 그래서 draft를 보고 정하고, 채울 때는 화면과 draft에 같은 값을 남긴다.
   */
  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        const user = (data?.user ?? null) as User | null;
        if (!user?.email) return;
        const draft = getDraft("saju-song");
        // 응답을 기다리는 사이에 직접 적으셨다면 그 값이 우선이다. 덮어쓰지 않는다.
        if (draft.sajuReportEmail) return;
        setReportEmail(user.email);
        // 이미 이메일로 받기로 한 상태라면 draft도 함께 맞춘다. 아직 고르지 않았다면
        // 나중에 고르는 순간 persist가 이 값을 담아 저장하므로 여기서 쓰지 않는다
        // (카카오톡을 고를 수도 있어, 쓰지 않을 주소를 미리 남기지 않는다).
        if (draft.sajuReportDelivery === "email") {
          saveDraft("saju-song", { sajuReportEmail: user.email });
        }
      })
      .catch(() => {
        // 회원 정보를 읽지 못해도 직접 입력으로 진행할 수 있다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      const style = id === "ai-mv" && !next.includes("ai-mv") ? "AI 실사 영상풍" : videoStyle;
      if (id === "ai-mv" && !next.includes("ai-mv")) {
        setVideoStyle("AI 실사 영상풍");
      }
      // 리포트를 빼면 받는 방법도 함께 지운다. 화면과 draft가 같은 상태를 보게 한다.
      const nextDelivery = next.includes(SAJU_REPORT_OPTION_ID) ? delivery : "";
      if (!next.includes(SAJU_REPORT_OPTION_ID)) setDelivery("");
      persist(next, style, nextDelivery, reportEmail);
      return next;
    });
  };

  const chooseDelivery = (next: string) => {
    setDelivery(next);
    persist(selected, videoStyle, next, reportEmail);
  };

  const changeReportEmail = (next: string) => {
    setReportEmail(next);
    persist(selected, videoStyle, delivery, next);
  };

  /*
   * 다음 단계로 가기 전 확인. 규칙은 서버와 같은 함수(checkSajuReportDelivery)가 정한다.
   * 화면에만 규칙을 두면 결제 단계에서 다른 이유로 막힐 수 있다.
   */
  const validateNext = () => {
    const check = checkSajuReportDelivery(selected, {
      sajuReportDelivery: delivery,
      sajuReportEmail: reportEmail,
    });
    return check.ok ? "" : check.error;
  };

  /** 이 신청에서 실제로 팔 수 있는 옵션만 화면에 낸다. */
  const visibleOptions = OPTIONS.filter((opt) => eventApply || !opt.eventOnly);

  const total = OPTIONS.filter((opt) => selected.includes(opt.id)).reduce(
    (sum, opt) => sum + (opt.price ?? 0),
    0
  );

  return (
    <ApplyLayout
      step={3}
      title="사주 인생곡 신청하기"
      basePath="/apply/saju-song"
      steps={SAJU_STEPS}
      prevHref="/apply/saju-song/2"
      nextHref="/apply/saju-song/4"
      validateNext={validateNext}
      heroText={"필요한 추가 옵션을\n선택해 주세요"}
    
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
    >
      <h2 className="text-[22px] font-bold text-[#403A49]">3. 추가 옵션을 선택해주세요</h2>
      <p className="mt-2 text-[14px] text-[#6B6570]">여러 개를 함께 선택하실 수 있습니다.</p>

      <div className="mt-5 space-y-3">
        {visibleOptions.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <div
              key={opt.id}
              className={`rounded-2xl border p-4 ${
                active ? "border-[#403A49] bg-[#faf6f1]" : "border-[#e8dfd4] bg-white"
              }`}
            >
              <button type="button" onClick={() => toggle(opt.id)} className="flex w-full items-start gap-3 text-left">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 text-[12px] ${
                    active ? "border-[#403A49] bg-[#403A49] text-white" : "border-[#d4c8ba] bg-white"
                  }`}
                >
                  {active ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-[#403A49]">{opt.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#6B6570]">{opt.desc}</p>
                  <p className="mt-2 text-[15px] font-bold text-[#403A49]">
                    {opt.price !== null ? `+ ${formatPrice(opt.price)}` : "가격 별도 문의"}
                  </p>
                </div>
              </button>

              {opt.id === "ai-mv" && active ? (
                <div className="mt-4 border-t border-[#ebe3d8] pt-4">
                  <p className="text-[17px] font-semibold text-[#403A49]">
                    영상 스타일 <span className="text-red-500">*</span>
                  </p>
                  <p className="mt-1 text-[14px] text-[#6B6570]">사진을 보고 1개를 골라 주세요.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {VIDEO_STYLES.map((style) => {
                      const styleActive = videoStyle === style.name;
                      return (
                        <button
                          key={style.name}
                          type="button"
                          onClick={() => {
                            setVideoStyle(style.name);
                            persist(selected, style.name, delivery, reportEmail);
                          }}
                          className={`overflow-hidden rounded-2xl bg-white text-left ${
                            styleActive ? "ring-2 ring-[#403A49]" : "ring-1 ring-[#ebe3d8]"
                          }`}
                        >
                          <div className="relative h-[88px] w-full bg-[#f5efe6]">
                            <Image src={style.image} alt="" fill className="object-cover" sizes="160px" />
                          </div>
                          <div className="px-2 py-2.5">
                            <p className="text-[14px] font-bold leading-snug text-[#3d2b1f]">{style.name}</p>
                            <p className="mt-1 text-[12px] leading-snug text-[#6B6570]">{style.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {opt.id === SAJU_REPORT_OPTION_ID && active ? (
                <div className="mt-4 border-t border-[#ebe3d8] pt-4">
                  <p className="text-[17px] font-semibold text-[#403A49]">
                    받으실 방법 <span className="text-red-500">*</span>
                  </p>
                  <p className="mt-1 text-[14px] text-[#6B6570]">1개를 골라 주세요.</p>
                  <div className="mt-3 flex gap-2">
                    {DELIVERY_CHOICES.map((choice) => {
                      const choiceActive = delivery === choice.id;
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => chooseDelivery(choice.id)}
                          className={`h-12 flex-1 rounded-xl text-[15px] font-semibold ${
                            choiceActive
                              ? "bg-[#403A49] text-white"
                              : "border border-[#d4c8ba] bg-white text-[#3d2b1f]"
                          }`}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>

                  {delivery === "kakao" ? (
                    <p className="mt-3 rounded-xl bg-[#f5efe6] p-3 text-[14px] leading-relaxed text-[#3d2b1f]">
                      {applyPhone
                        ? `신청 연락처 ${applyPhone}으로 보내드립니다.`
                        : "1단계에 적으신 신청 연락처로 보내드립니다."}
                    </p>
                  ) : null}

                  {delivery === "email" ? (
                    <div className="mt-3">
                      <label
                        className="block text-[15px] font-semibold text-[#403A49]"
                        htmlFor="saju-report-email"
                      >
                        이메일 주소 <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="saju-report-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={reportEmail}
                        onChange={(event) => changeReportEmail(event.target.value)}
                        placeholder="example@email.com"
                        className="mt-2 h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#403A49]"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f5efe6] p-4">
        <span className="text-[14px] text-[#3d2b1f]">선택한 추가 옵션 금액</span>
        <span className="text-[20px] font-bold text-[#403A49]">{formatPrice(total)}</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[#6B6570]">
        기본 상품 금액과 합산된 최종 금액은 다음 단계에서 확인하실 수 있습니다.
      </p>
    </ApplyLayout>
  );
}
