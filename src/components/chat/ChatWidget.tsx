"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send, X } from "lucide-react";
import {
  CONSULTATION,
  LIFE_SONG_PRODUCTS,
  formatPrice,
  formatPriceFrom,
} from "@/lib/constants/products";
import { CONSULT_OPTION_PRICES, ORDER_OPTION_PRICES } from "@/lib/server/pricing";
import { TEACHERS } from "@/lib/constants/consultationTeachers";

/**
 * 사주로그 AI 안내 도령이의 화면 껍데기.
 *
 * 이 단계에서는 아직 AI에 묻지 않는다. 빠른 질문은 미리 적어 둔 답변을
 * 화면에만 붙여 UI를 확인하는 용도다. 입력창에 글자는 칠 수 있지만
 * 전송 버튼은 아직 잠겨 있고, 어떤 경우에도 네트워크 요청을 보내지 않는다.
 *
 * 위치 규칙
 * - 하단 메뉴(BottomNav, h-60px, z-50) 바로 위 오른쪽에 둔다. 메뉴를 가리지 않는다.
 * - 모바일 셸과 같은 max-w-[430px] 안에서 움직여 데스크톱에서도 셸 옆에 붙지 않는다.
 * - iPhone 홈 인디케이터만큼 safe-area를 더해 띄운다.
 * - z는 BottomNav(50)보다 위, BenefitNotice(90)·상담 모달(95)보다 아래로 둔다.
 */
const BOTTOM_NAV_HEIGHT = "60px";

/**
 * 도령이 표정. 지금은 avatar만 화면에 쓰고, 나머지는 답변 종류에 따라
 * 골라 쓸 수 있도록 이름만 정해 둔다. (실제 사용은 AI 연결 단계에서)
 */
export const DORYEONG_FACES = {
  avatar: "/images/doryeong-chatbot-avatar.png",
  greeting: "/images/doryeong-chatbot-greeting.png",
  curious: "/images/doryeong-chatbot-curious.png",
  helpful: "/images/doryeong-chatbot-helpful.png",
  yes: "/images/doryeong-chatbot-yes.png",
  waiting: "/images/doryeong-chatbot-waiting.png",
  goodday: "/images/doryeong-chatbot-goodday.png",
} as const;

export type DoryeongFace = keyof typeof DORYEONG_FACES;

/** 도령이를 크게 볼 때만 쓰는 프로필 이미지. 말풍선·헤더 얼굴과는 별개 파일이다. */
const DORYEONG_PROFILE_IMAGE = "/images/image923.png";

/**
 * 답변 성격에 맞는 표정. AI를 붙일 때 답변을 만들면서 이 값 중 하나를 고른다.
 * greeting 첫 인사 / curious 되묻기 / helpful 안내 / yes 확인 /
 * waiting 처리 중 / goodday 마무리 인사
 */
export type DoryeongMood = "greeting" | "curious" | "helpful" | "yes" | "waiting" | "goodday";

/**
 * 표정 이름을 실제 이미지 경로로 바꾼다. 모르는 값이면 기본 얼굴을 쓴다.
 * 인사는 "상담원" 표기까지 들어 있는 기본 아이콘을 그대로 쓴다.
 */
export function faceSrcOf(mood: DoryeongMood | undefined): string {
  if (!mood || mood === "greeting") return DORYEONG_FACES.avatar;
  return DORYEONG_FACES[mood] ?? DORYEONG_FACES.avatar;
}

/** 도령이 메시지를 얼마나 강조해 보여줄지. 인사·기다림·작별에만 emphasis를 쓴다. */
export type DoryeongDisplay = "normal" | "emphasis";

/** 대화 한 줄. AI 연결 단계에서 이 배열에 메시지가 쌓인다. */
export interface ChatMessage {
  id: string;
  role: "user" | "doryeong";
  text: string;
  /** 도령이 메시지에만 쓴다. 없으면 기본 얼굴로 그린다. */
  mood?: DoryeongMood;
  /**
   * 도령이 메시지를 그리는 방식. 없으면 normal.
   * normal 작은 얼굴 + 말풍선 / emphasis 조금 큰 얼굴 + 말풍선
   */
  display?: DoryeongDisplay;
  /** 도령이 답변 아래에 붙는 다음 질문들. 없으면 버튼을 그리지 않는다. */
  choices?: readonly ChatNodeId[];
  /** 답변 아래에 붙는 화면 이동 링크. 없으면 그리지 않는다. */
  cta?: ChatCta;
}

/**
 * 선택형 대화 트리.
 *
 * 답변은 화면·상수에 이미 있는 공식 내용만 쓰고, 금액은 문장에 적지 않고
 * 상품·옵션 상수에서 읽어 붙인다. 여기서는 어떤 요청도 보내지 않는다.
 */
export type ChatNodeId =
  | "what-is"
  | "compare"
  | "choose"
  | "story"
  | "premium"
  | "saju-song"
  | "gift"
  | "gift-parents"
  | "gift-partner"
  | "gift-family"
  | "video"
  | "consulting"
  | "consult-fields"
  | "teachers"
  | "consult-method"
  | "apply"
  | "duration"
  | "price"
  | "coupon"
  | "payment"
  | "refund"
  | "lyric-edit"
  | "delivery"
  | "copyright"
  | "account"
  | "my-orders"
  | "photo"
  | "schedule-change"
  | "consult-options"
  | "help-pages"
  | "more"
  | "contact"
  | "personal-saju"
  | "gift-or-price"
  | "fallback";

/** 답변 아래에 한 개만 붙는 화면 이동 링크. href는 상수에서 읽어 채운다. */
interface ChatCta {
  label: string;
  href: string;
}

interface ChatNode {
  /** 버튼과 사용자 말풍선에 함께 쓰는 질문 문구. */
  label: string;
  /** 답변. 가격이 들어가는 답변은 상수를 읽어 만든다. */
  answer: string;
  /** 답변 아래에 이어 붙일 다음 질문들. */
  next: readonly ChatNodeId[];
  mood?: DoryeongMood;
  display?: DoryeongDisplay;
  /**
   * 답변 아래에 붙는 화면 이동 링크. 없는 노드가 대부분이라 선택 항목으로 둔다.
   * 상품·상담 소개 화면으로만 보낸다(신청 화면은 보내지 않는다).
   */
  cta?: ChatCta;
}

/** 상품 가격을 상수에서 읽는다. 문장에 금액을 적지 않기 위한 도우미다. */
function productPriceFrom(id: (typeof LIFE_SONG_PRODUCTS)[number]["id"]): string {
  const product = LIFE_SONG_PRODUCTS.find((item) => item.id === id);
  return product ? formatPriceFrom(product.priceFrom) : "";
}

/**
 * 상품 상세페이지 주소. 가격과 같은 방식으로 상수에서 읽는다.
 * 주소를 문장에 적어 두면 상품 경로가 바뀔 때 도령만 옛 주소를 안내하게 된다.
 * 신청 주소(applyHref)가 아니라 소개 주소(href)를 쓴다. 신청 경로는 비회원을
 * 로그인 화면으로 돌려보내므로(proxy.ts), 도령에서는 먼저 소개 화면을 보여 준다.
 */
function productHref(id: (typeof LIFE_SONG_PRODUCTS)[number]["id"]): string {
  const product = LIFE_SONG_PRODUCTS.find((item) => item.id === id);
  return product ? product.href : "";
}

/** 선택지 버튼 앞에 붙이는 아이콘. 없는 노드는 아이콘 없이 문구만 보여 준다. */
const NODE_ICONS: Partial<Record<ChatNodeId, string>> = {
  "what-is": "🎵",
  compare: "✨",
  choose: "✨",
  story: "🎵",
  premium: "🎵",
  "saju-song": "🎵",
  gift: "🎁",
  "gift-parents": "🎁",
  "gift-partner": "🎁",
  "gift-family": "🎁",
  video: "🎬",
  consulting: "🔮",
  "consult-fields": "🔮",
  "consult-method": "📞",
  teachers: "👤",
  duration: "⏱️",
  price: "💳",
  coupon: "🎟️",
  payment: "💰",
  refund: "↩︎",
  "lyric-edit": "✏️",
  delivery: "🎧",
  copyright: "©️",
  account: "👤",
  "my-orders": "📋",
  photo: "📷",
  "schedule-change": "🗓️",
  "consult-options": "🧾",
  "help-pages": "📚",
  apply: "📝",
  more: "↩️",
  contact: "💬",
};

/** 처음 보여 주는 대표 질문. "다른 질문 보기"도 이 목록으로 돌아온다. */
const ROOT_CHOICES: readonly ChatNodeId[] = [
  "what-is",
  "compare",
  "price",
  "consulting",
  "apply",
];

/** 선택지 버튼 하나. 첫 화면과 대화 중 선택지가 같은 모양을 쓴다. */
function ChoiceButton({ id, onSelect }: { id: ChatNodeId; onSelect: (id: ChatNodeId) => void }) {
  const icon = NODE_ICONS[id];
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className="flex min-w-[calc(50%-0.25rem)] flex-1 items-center gap-1.5 rounded-xl border border-[#e0d5c8] bg-[#fffdf9] px-2.5 py-2 text-left text-[13px] font-medium leading-snug text-[#5c3d2e] break-keep active:bg-[#f5efe6]"
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span className="min-w-0 flex-1">{CHAT_NODES[id].label}</span>
    </button>
  );
}

const CHAT_NODES: Record<ChatNodeId, ChatNode> = {
  "what-is": {
    label: "인생곡이 뭐예요?",
    answer:
      "인생곡은 고객님의 이야기나 사주 정보를 담아\n세상에 하나뿐인 노래를 만들어 드리는 서비스예요 🐾\n\n이야기로 만드는 인생곡,\n프리미엄 인생곡,\n사주 인생곡 세 가지가 있어요.",
    next: ["compare", "choose", "price", "apply"],
  },
  compare: {
    label: "세 상품은 뭐가 달라요?",
    answer:
      "차이는 상담이 들어가는지예요 🐾\n\n· 이야기로 만드는 인생곡\n  직접 쓰신 이야기로 제작해요.\n\n· 사주 인생곡\n  상담 없이 사주 정보와 이야기로 제작해요.\n\n· 프리미엄 인생곡\n  사주상담과 스토리상담을 함께 진행해요.\n\n뮤직비디오는 세 상품 모두 추가 옵션이에요.",
    next: ["choose", "story", "premium", "saju-song"],
  },
  choose: {
    label: "어떤 걸 골라야 할까요?",
    answer:
      "이렇게 생각해 보시면 편해요 🐾\n\n· 하고 싶은 이야기가 있으시면\n  → 이야기로 만드는 인생곡\n\n· 상담까지 함께 받고 싶으시면\n  → 프리미엄 인생곡\n\n· 상담 없이 간편하게 원하시면\n  → 사주 인생곡",
    mood: "curious",
    next: ["story", "premium", "saju-song", "contact"],
  },
  story: {
    label: "이야기로 만드는 인생곡",
    answer: `직접 작성하신 자신의 이야기,\n또는 소중한 분의 이야기를 바탕으로\n맞춤 가사와 음악을 만들어 드려요 🐾\n\n가격은 ${productPriceFrom("story")}이에요.\n\n사주상담과 영상은 기본 포함이 아니라\n따로 선택하시는 부분이에요.`,
    next: ["video", "price", "lyric-edit", "duration"],
    cta: { label: "이야기로 만드는 인생곡 자세히 보기", href: productHref("story") },
  },
  premium: {
    label: "프리미엄 인생곡",
    answer: `프리미엄은 일반 인생곡의 고급형이 아니라\n사주상담 → 스토리상담 → 인생곡 제작까지\n함께하는 토탈 서비스예요 🐾\n\n가격은 ${productPriceFrom("premium")}이에요.\n\n뮤직비디오는 기본 포함이 아니라 추가 옵션이고,\n전문 보컬 녹음은 포함되지 않아요.`,
    next: ["compare", "video", "lyric-edit", "apply"],
    cta: { label: "프리미엄 인생곡 자세히 보기", href: productHref("premium") },
  },
  "saju-song": {
    label: "사주 인생곡",
    answer: `상담 없이 사주 정보와 고객님의 이야기,\n음악 취향을 함께 담아 만드는 인생곡이에요 🐾\n\n가격은 ${productPriceFrom("saju-song")}이에요.\n\n생년월일과 태어난 시간을 입력해 주시면 되고,\n시간을 모르셔도 신청하실 수 있어요.`,
    next: ["compare", "price", "lyric-edit", "apply"],
    cta: { label: "사주 인생곡 자세히 보기", href: productHref("saju-song") },
  },
  gift: {
    label: "선물로 만들고 싶어요",
    answer: "선물로 많이 찾아 주세요 🐾\n\n어떤 분께 드릴 선물인지 알려주시면\n안내해 드릴게요.",
    mood: "curious",
    next: ["gift-parents", "gift-partner", "gift-family", "more"],
  },
  "gift-parents": {
    label: "부모님 선물",
    answer:
      "부모님 이야기를 노래로 담아 드리는 분들이\n많으세요 🐾\n\n이야기로 만드는 인생곡에서 부모님을\n이야기 주인공으로 선택하실 수 있어요.\n\n사주상담까지 함께 원하시면\n프리미엄 인생곡도 있어요.",
    next: ["story", "premium", "video", "apply"],
  },
  "gift-partner": {
    label: "배우자·연인 선물",
    answer:
      "연인이나 배우자께 마음을 전하고 싶은 분들이\n많이 신청하세요 🐾\n\n이야기로 만드는 인생곡에서 배우자·연인을\n이야기 주인공으로 고르실 수 있어요.",
    next: ["story", "video", "apply", "more"],
  },
  "gift-family": {
    label: "가족·반려동물",
    answer:
      "가족과 반려동물의 이야기도\n노래로 만들어 드려요 🐾\n\n이야기 주인공으로 가족과 반려동물을\n선택하실 수 있어요.",
    next: ["story", "video", "apply", "more"],
  },
  video: {
    label: "영상 옵션",
    answer: `영상은 어느 상품이든 기본 포함이 아니라\n추가 옵션이에요 🐾\n\n· 내 얼굴 AI 뮤직비디오 +${formatPrice(ORDER_OPTION_PRICES["ai-mv"])}\n  얼굴 사진을 바탕으로\n  노래에 맞는 영상을 만들어요.\n\n· 추억사진 영상 제작 +${formatPrice(ORDER_OPTION_PRICES["photo-mv"])}\n  보내주신 사진을 인생곡에 맞춰\n  영상으로 편집해요.\n\n사진은 결제 후 카카오톡으로 연락드려 받아요.`,
    next: ["photo", "price", "apply", "more"],
  },
  consulting: {
    label: "1:1 사주상담 알려주세요",
    answer: `인생곡과 별도로 이용하실 수 있는\n전문 사주상담 서비스예요 🐾\n\n가격은 ${formatPriceFrom(CONSULTATION.priceFrom)}이고,\n약 50분 동안 진행해요.`,
    next: ["teachers", "consult-method", "consult-options", "schedule-change"],
    cta: { label: "1:1 사주상담 자세히 보기", href: CONSULTATION.href },
  },
  "consult-fields": {
    label: "상담 분야",
    answer:
      "이런 분야를 살펴볼 수 있어요 🐾\n\n전체적인 운세 · 재물·금전\n직장·사업 · 연애·인연\n결혼·궁합 · 가족\n진로 · 올해의 흐름",
    next: ["teachers", "consult-method", "apply", "more"],
  },
  teachers: {
    label: "선생님 소개",
    answer: [
      "등록된 상담 분야를 기준으로 알려드릴게요 🐾",
      TEACHERS.map((teacher) => `· ${teacher.name}\n  ${teacher.role}`).join("\n\n"),
      "신청 화면에서 원하시는 선생님을\n직접 고르실 수 있어요.",
    ].join("\n\n"),
    next: ["consult-fields", "consult-method", "apply", "more"],
  },
  "consult-method": {
    label: "상담 방법",
    answer:
      "카카오톡 상담과 전화 상담 중\n하나를 고르시면 돼요 🐾\n\n약 50분 동안 진행하고,\n화상 상담은 하지 않아요.",
    next: ["schedule-change", "consult-fields", "teachers", "apply"],
  },
  apply: {
    label: "신청은 어떻게 해요?",
    answer:
      "상품을 고르시고 →\n신청 정보를 입력하신 뒤 →\n확인 및 결제까지 하시면 돼요 🐾\n\n하단 메뉴의 인생곡과 상담에서\n바로 신청하실 수 있어요.",
    mood: "yes",
    next: ["duration", "payment", "my-orders", "more"],
  },
  duration: {
    label: "제작 기간은 얼마나 걸리나요?",
    answer:
      "제작 기간은 상품에 따라 다르지만\n보통 7~14일 정도 걸려요 🐾\n\n제작 내용과 진행 상황에 따라\n기간이 달라질 수 있어요.",
    next: ["delivery", "my-orders", "apply", "more"],
  },
  price: {
    label: "가격이 궁금해요",
    answer: [
      "상품과 선택하신 옵션에 따라 달라져요 🐾\n",
      `· 이야기로 만드는 인생곡 ${productPriceFrom("story")}`,
      `· 사주 인생곡 ${productPriceFrom("saju-song")}`,
      `· 프리미엄 인생곡 ${productPriceFrom("premium")}`,
      `· 1:1 사주상담 ${formatPriceFrom(CONSULTATION.priceFrom)}`,
    ].join("\n"),
    next: ["payment", "coupon", "video", "apply"],
  },
  coupon: {
    label: "쿠폰이 궁금해요",
    answer:
      "받으신 쿠폰은 MY → 쿠폰함에서 확인하실 수 있어요 🐾\n로그인하시면 보여요.\n\n쿠폰 코드를 직접 입력하는 칸은 따로 없어요.\n받으신 쿠폰이 쿠폰함에 바로 들어가요.\n\n사용은 신청 마지막 확인 및 결제 단계에서\n무료 쿠폰을 골라 주시면 돼요.\n\n쿠폰마다 사용할 수 있는 상품이 정해져 있고,\n이미 사용한 쿠폰은 다시 쓸 수 없어요.",
    next: ["apply", "price", "contact", "more"],
  },
  payment: {
    label: "결제 방법이 궁금해요",
    answer:
      "신청 마지막 확인 및 결제 단계에서\n결제 수단을 고르실 수 있어요 🐾\n\n· 신용/체크카드\n· 무통장 입금\n· 카카오페이\n· 네이버페이\n\n결제가 잘 되었는지 확인이 필요하시면\n상담원에게 문의를 남겨 주세요.",
    next: ["refund", "apply", "contact", "more"],
  },
  refund: {
    label: "환불·취소 규정이 궁금해요",
    answer:
      "결제를 마치신 것만으로 제작이 시작되지는 않아요 🐾\n실제 제작이 시작되기 전에는\n취소와 전액 환불을 요청하실 수 있어요.\n\n제작이 시작된 뒤에 요청하셔도\n자동으로 거절하지 않아요.\n실제로 진행된 작업과 제공 상태,\n그리고 관계 법령에 따라 확인해 드려요.\n\n1:1 사주상담은 예약하신 시각 기준\n정확히 3시간 전까지 요청하시면\n일반 취소·환불 절차로 처리해 드려요.\n3시간이 안 남았거나 상담 시각이 지난 경우에도\n자동으로 거절하지 않고 개별적으로 확인해 드려요.\n\n저희나 선생님 사정으로 상담을 못 하게 되면\n전액 환불과 무상 일정 변경 중에서\n고객님이 고르실 수 있어요.\n\n관계 법령에 따른 고객님의 권리는\n이 안내로 제한되지 않아요.\n\n이미 신청하신 건의 취소나 환불은\n상담원에게 문의를 남겨 주세요.",
    next: ["payment", "contact", "apply", "more"],
  },
  "lyric-edit": {
    label: "가사 수정은 몇 번 되나요?",
    answer: `기본 가사 수정 1회가 포함되어 있어요 🐾\n\n더 고치고 싶으시면\n가사 수정 1회 추가 옵션(+${formatPrice(ORDER_OPTION_PRICES["lyric-edit"])})을\n선택하실 수 있어요.`,
    next: ["delivery", "duration", "apply", "more"],
  },
  delivery: {
    label: "완성곡은 어떻게 받아요?",
    answer:
      "완성된 노래는 음원 파일로 전달해 드려요 🐾\n\n뮤직비디오 옵션을 선택하신 경우에는\n영상도 함께 전달해 드려요.",
    next: ["copyright", "duration", "lyric-edit", "more"],
  },
  copyright: {
    label: "완성곡을 어디까지 쓸 수 있어요?",
    answer:
      "개인 감상과 소장, 선물은 물론\n개인적인 비상업 SNS 게시나 개인 행사에도\n편하게 쓰실 수 있어요 🐾\n\n판매나 유료 배포, 재판매,\n사업·브랜드 광고처럼 상업적으로 쓰실 때에는\n미리 협의가 필요해요.\n\n주신 사진과 사연의 권리는 고객님께 그대로 있고,\n저희는 주문하신 인생곡의 제작·수정·전달에\n필요한 범위에서만 이용해요.\n\n완성물을 홈페이지나 YouTube, 광고, 사례 소개에\n공개하는 건 신청 때 받는 [필수] 동의에 들어 있지 않아요.\n필요하면 그때 따로 여쭤봐요.",
    next: ["delivery", "contact", "apply", "more"],
  },
  account: {
    label: "회원가입·로그인이 궁금해요",
    answer:
      "회원가입은 휴대폰 인증으로 하실 수 있어요 🐾\n\n로그인은 세 가지 방법이 있어요.\n· 휴대폰 번호와 비밀번호\n· 카카오 로그인\n· 네이버 로그인\n\n비밀번호를 잊으셨다면\n로그인 화면의 비밀번호 찾기에서\n휴대폰 인증으로 다시 설정하실 수 있어요.\n\n상담원 문의는 로그인하지 않아도\n남기실 수 있어요.",
    next: ["apply", "contact", "coupon", "more"],
  },
  "my-orders": {
    label: "신청 내역은 어디서 봐요?",
    answer:
      "MY 화면에서 확인하실 수 있어요 🐾\n\n· 나의 주문 내역\n· 1:1 사주상담 내역\n\n로그인하시면 보여요.\n\n제가 개별 진행 상황까지는 확인해 드릴 수 없어서,\n궁금하시면 상담원에게 문의를 남겨 주세요.",
    next: ["account", "contact", "duration", "more"],
  },
  photo: {
    label: "사진은 언제 보내요?",
    answer:
      "사진은 지금 올리지 않으셔도 괜찮아요 🐾\n\n얼굴 사진과 추억 사진은\n결제 후 카카오톡으로 연락드려 받아요.",
    next: ["video", "apply", "duration", "more"],
  },
  "schedule-change": {
    label: "상담 일정을 바꾸고 싶어요",
    answer:
      "상담이 시작되기 전에는\n취소를 요청하실 수 있어요 🐾\n\n상담 일정 변경은 고객센터를 통해\n요청해 주시면 돼요.\n\n실제 변경이나 취소는\n아래에서 상담원에게 문의를 남겨 주세요.",
    next: ["contact", "consult-method", "refund", "more"],
  },
  "consult-options": {
    label: "상담 추가 옵션이 궁금해요",
    answer: `1:1 사주상담에는 두 가지 옵션이 있어요 🐾\n\n· 상담 기록 요약 리포트 +${formatPrice(CONSULT_OPTION_PRICES.report)}\n\n· 추가 인원 1명(궁합) +${formatPrice(CONSULT_OPTION_PRICES.extraPerson)}\n\n상담 신청 화면에서 원하시는 옵션을\n골라 주시면 돼요.`,
    next: ["consulting", "consult-method", "apply", "more"],
  },
  "help-pages": {
    label: "공지사항·자주 묻는 질문",
    answer:
      "하단 메뉴 MY에서 찾으실 수 있어요 🐾\n\n· 공지사항 — 이용 안내와 변경 사항\n· 자주 묻는 질문 — 제작 기간, 수정,\n  상담 진행 같은 안내\n\n주소로는 /notice 와 /faq 예요.",
    next: ["contact", "apply", "more"],
  },
  more: {
    label: "다른 질문 보기",
    answer: "어떤 게 궁금하세요? 🐾",
    mood: "curious",
    next: [...ROOT_CHOICES, "help-pages"],
  },
  contact: {
    label: "실제 상담원에게 문의하기",
    answer:
      "아래 문의 남기기에서\n이름과 연락처를 적어 주시면\n상담원이 확인 후 연락드릴게요 🐾",
    mood: "waiting",
    display: "emphasis",
    next: ["more"],
  },
  /*
   * 개인 사주·운세 질문에 답하는 자리. 일반 fallback과 나누는 이유는 사실이 다르기 때문이다.
   * 이 질문은 못 알아들은 것이 아니라 도령이 하지 않기로 한 일이다
   * (개인 사주를 풀이하지 않는다 / 운세를 판단하지 않는다).
   * 그래서 "어렵다"고 말하지 않고, 대신 선생님과 보는 자리를 바로 안내한다.
   */
  "personal-saju": {
    label: "개인 사주·운세가 궁금해요",
    answer:
      "저는 개인 사주를 풀어 드리거나\n운세를 봐 드리지는 않아요 🐾\n\n사주를 자세히 보고 싶으시면\n1:1 사주상담에서 선생님과 함께\n살펴보실 수 있어요.",
    mood: "curious",
    next: ["consulting", "teachers", "contact", "more"],
  },
  /*
   * 가격과 선물 대상이 함께 있어 무엇을 묻는지 갈라지지 않는 자리.
   * 답할 수 없는 질문이 아니라 갈래가 둘인 질문이라, 문의로 보내지 않고 한 번 되묻는다.
   * 되묻는 두 갈래는 이미 있는 노드를 그대로 쓴다(price / gift-parents).
   */
  "gift-or-price": {
    label: "선물과 가격 중 무엇이 궁금하세요?",
    answer:
      "어느 쪽이 궁금하신지\n한 가지만 알려 주시겠어요? 🐾\n\n· 금액이 궁금하시면 가격 안내\n· 부모님께 드릴 선물이 궁금하시면\n  부모님 선물 안내로 보여 드릴게요.",
    mood: "curious",
    next: ["price", "gift-parents", "contact", "more"],
  },
  /*
   * 실제로 못 알아들은 질문만 여기로 온다.
   * 대표 질문(ROOT_CHOICES)을 바로 붙여, more를 한 번 더 누르지 않게 한다.
   */
  fallback: {
    label: "다른 질문 보기",
    answer:
      "제가 정확하게 안내드리기 어려운 내용이에요 🐾\n\n아래에서 골라 보시거나,\n실제 상담원에게 문의를 남겨 주시면\n확인 후 연락드리겠습니다.",
    mood: "waiting",
    next: ["contact", ...ROOT_CHOICES],
  },
};

/**
 * 자주 묻는 주제와 임시 답변.
 *
 * answer는 UI 확인용으로 손으로 적은 문구다. AI를 붙일 때 이 값을 지우고
 * chatKnowledge 기반 응답으로 바꾼다. 지금은 어떤 요청도 보내지 않는다.
 */
// 첫 화면 질문이 대표 질문 버튼으로 통일되어 지금은 화면에 그리지 않는다. 답변 데이터는 남겨 둔다.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const QUICK_QUESTIONS = [
  {
    icon: "🎵",
    label: "인생곡이 뭐예요?",
    answer:
      "인생곡은 세상에 하나뿐인 나만의 노래예요.\n고객님의 이야기나 사주 정보를 바탕으로 만들어드려요.",
  },
  {
    icon: "✨",
    label: "인생곡 종류 차이",
    answer:
      "이야기로 만드는 인생곡은 직접 쓴 이야기로 만들어요.\n프리미엄 인생곡은 상담과 인생곡 제작을 함께 해요.\n사주 인생곡은 사주 정보로 만들어요.\n뮤직비디오는 추가 옵션이에요.",
  },
  {
    icon: "🔮",
    label: "사주상담 안내",
    // AI 연결 단계에서는 선생님 이름을 문구에 적지 않고
    // src/lib/constants/consultationTeachers.ts의 현재 데이터를 읽어 안내한다.
    answer:
      "1:1 사주상담은 여러 선생님 중에서 고르실 수 있어요.\n상담 분야와 가능한 일정을 보고 선택하시면 돼요.",
  },
  {
    icon: "💳",
    label: "가격·옵션",
    answer:
      "가격은 상품과 선택한 옵션에 따라 달라져요.\n궁금한 상품을 말씀해 주시면 안내해드릴게요.",
  },
  {
    icon: "📝",
    label: "신청 방법",
    answer:
      "상품 선택 → 신청 정보 입력 → 확인 및 결제 순서예요.\n어렵지 않으니 편하게 진행하시면 돼요.",
  },
] as const;

/**
 * 인사·감사·작별처럼 뜻이 분명한 말에만 붙는 기본 인사말.
 * 자연어 분류가 아니라 적어 둔 말과 그대로 맞는지만 본다.
 */
const LOCAL_GREETING_REPLIES: {
  keywords: readonly string[];
  text: string;
  mood: DoryeongMood;
}[] = [
  {
    keywords: ["안녕하세요", "안녕", "하이", "hello", "hi"],
    text: "안녕하세요 🐾\n사주로그 AI 상담원 도령이에요.\n\n궁금한 게 있으시면\n편하게 물어보세요.",
    mood: "greeting",
  },
  {
    keywords: ["고마워", "고마워요", "감사합니다", "감사해"],
    text: "도움이 되었다니 다행이에요 🐾\n\n또 궁금한 게 생기면\n언제든 편하게 물어보세요.",
    mood: "goodday",
  },
  {
    keywords: ["안녕히가세요", "안녕히 가세요", "잘가", "다음에", "바이", "bye"],
    text: "좋은 하루 보내세요 🐾\n\n궁금한 게 생기면\n다음에 또 찾아주세요.",
    mood: "goodday",
  },
];

/** 연락받을 방법. 상담 신청 화면에서 쓰는 방식과 같은 어휘를 쓴다. */
const CONTACT_METHODS = ["카카오톡", "문자"] as const;

type ContactMethod = (typeof CONTACT_METHODS)[number];

/**
 * 상담원 문의방. /api/chat-inquiries 응답에 들어 있는 값만 담는다.
 * 서버가 이름·연락처를 되돌려주지 않으므로 여기에도 없다.
 */
interface ChatInquiryView {
  id: string;
  status: string;
  contactMethod: string;
  createdAt: string;
  lastMessageAt: string;
}

/** 문의방 안의 메시지 한 줄. customer는 고객, agent는 사람 상담원이다. */
interface ChatInquiryMessageView {
  id: string;
  sender: "customer" | "agent";
  body: string;
  createdAt: string;
}

/** 아직 끝나지 않은 문의방인지. 진행 중일 때만 대화를 이어 갈 수 있다. */
function isOpenInquiry(inquiry: ChatInquiryView | null): boolean {
  return inquiry?.status === "new" || inquiry?.status === "in_progress";
}

/**
 * 위젯이 이어서 보여 줄 문의방 하나.
 *
 * 진행 중인 방이 있으면 그 방을 쓴다. 없으면 가장 최근에 말이 오간 방을 쓴다.
 * 끝난 방(closed)도 후보에 넣는 이유는 마지막 상담원 답변을 다시 읽을 수 있어야
 * 하기 때문이다. 끝난 방에서 고객이 말을 더할 수 없는 정책은 그대로다.
 * 서버가 이미 최근순으로 주지만, 순서에 기대지 않고 lastMessageAt으로 직접 고른다.
 */
function pickAgentInquiry(
  inquiries: ChatInquiryView[] | undefined,
): ChatInquiryView | null {
  if (!inquiries?.length) return null;
  const open = inquiries.find((item) => isOpenInquiry(item));
  if (open) return open;
  return inquiries.reduce((latest, item) =>
    item.lastMessageAt > latest.lastMessageAt ? item : latest,
  );
}

/** 내부 상태값을 그대로 보여 주지 않고 사람이 읽는 문구로 바꾼다. */
function inquiryStatusLabel(status: string): string {
  if (status === "closed") return "상담이 끝난 대화예요";
  if (status === "in_progress") return "상담원이 대화 중이에요";
  return "상담원이 확인하고 있어요";
}

/**
 * 사람 상담원 말풍선.
 * 도령이(고양이 아바타)와 같은 사람으로 보이지 않도록 얼굴 이미지를 쓰지 않고
 * 이름표만 붙인다. 배경도 도령이 말풍선과 다른 흰색을 쓴다.
 */
function AgentBubble({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[12px] font-bold leading-tight text-[#6B6570]">👤 사주로그 상담원</p>
      <p className="max-w-[88%] whitespace-pre-line break-keep rounded-2xl rounded-tl-md border border-[#ebe3d8] bg-white px-4 py-3.5 text-[16px] leading-[1.75] text-[#403A49] [overflow-wrap:anywhere]">
        {text}
      </p>
    </div>
  );
}

/**
 * 도령이 말풍선. 왼쪽 정렬 + 표정 프로필 + 크림색 배경.
 * display가 emphasis면 표정을 조금 크게 보여 준다(인사·기다림·작별용).
 */
function DoryeongBubble({
  text,
  mood,
  display = "normal",
  onFaceClick,
}: {
  text: string;
  mood?: DoryeongMood;
  display?: DoryeongDisplay;
  /** 주면 강조 얼굴을 눌러 도령이를 크게 볼 수 있다. */
  onFaceClick?: () => void;
}) {
  const emphasis = display === "emphasis";
  const face = (
    <Image
      src={faceSrcOf(mood)}
      alt=""
      width={240}
      height={240}
      className="h-[80px] w-[74px] shrink-0 object-contain"
    />
  );
  return (
    <div className="flex items-start gap-2">
      {emphasis ? (
        // 강조 답변은 원형 틀 없이 표정 PNG를 그대로 보여 준다. 투명 배경을 살린다.
        onFaceClick ? (
          <button type="button" onClick={onFaceClick} aria-label="도령이 크게 보기" className="shrink-0">
            {face}
          </button>
        ) : (
          face
        )
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f3eefb]">
          <Image
            src={faceSrcOf(mood)}
            alt=""
            width={72}
            height={72}
            className="h-8 w-8 object-contain"
          />
        </span>
      )}
      <p className="max-w-[88%] whitespace-pre-line break-keep rounded-2xl rounded-tl-md bg-[#f5efe6] px-4 py-3.5 text-[17px] leading-[1.75] text-[#403A49] [overflow-wrap:anywhere]">
        {text}
      </p>
    </div>
  );
}

/** 사용자 말풍선. 오른쪽 정렬 + 브라운 배경 + 흰 글자. */
function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[78%] whitespace-pre-line rounded-2xl rounded-tr-md bg-[#403A49] px-4 py-3 text-[16px] leading-relaxed text-white">
        {text}
      </p>
    </div>
  );
}

/**
 * 자유 입력을 대화 노드에 잇는 표현 목록.
 * 여기 적힌 말과 그대로 맞으면 바로 그 노드로 보낸다.
 */
const NODE_KEYWORDS: { id: ChatNodeId; keywords: readonly string[] }[] = [
  { id: "what-is", keywords: ["인생곡이 뭐야", "인생곡이 뭐예요", "인생곡 알려줘", "인생곡이란"] },
  {
    id: "compare",
    keywords: ["상품 차이", "뭐가 달라", "뭐가 달라요", "인생곡 차이", "차이가 뭐야"],
  },
  { id: "choose", keywords: ["뭐가 좋아", "어떤 걸 골라", "어떤 걸 골라야 할까요", "추천해줘"] },
  { id: "story", keywords: ["이야기로 만드는 인생곡", "이야기 인생곡", "일반 인생곡"] },
  { id: "premium", keywords: ["프리미엄이 뭐야", "프리미엄 알려줘", "프리미엄", "프리미엄 인생곡"] },
  { id: "saju-song", keywords: ["사주곡이 뭐야", "사주 인생곡 알려줘", "사주 인생곡", "사주곡"] },
  { id: "gift", keywords: ["선물", "선물하고 싶어", "선물로 만들고 싶어요"] },
  { id: "gift-parents", keywords: ["부모님 선물", "엄마 선물", "아빠 선물", "어머니 선물", "아버지 선물"] },
  {
    id: "gift-partner",
    keywords: ["남편 선물", "아내 선물", "연인 선물", "배우자 선물", "여자친구 선물", "남자친구 선물"],
  },
  { id: "gift-family", keywords: ["가족 선물", "반려동물", "강아지 노래", "고양이 노래"] },
  { id: "video", keywords: ["뮤직비디오", "영상 옵션", "영상도 돼", "영상도 되나요", "영상"] },
  { id: "consulting", keywords: ["사주상담", "상담 받고 싶어", "사주 상담", "상담"] },
  { id: "consult-fields", keywords: ["상담 분야", "뭘 상담할 수 있어"] },
  { id: "teachers", keywords: ["선생님", "누가 상담해", "선생님 소개"] },
  { id: "consult-method", keywords: ["상담 방법", "상담 어떻게 해", "전화 상담", "카톡 상담"] },
  { id: "apply", keywords: ["신청 방법", "어떻게 신청해", "신청은 어떻게 해요", "신청"] },
  { id: "price", keywords: ["가격", "얼마야", "얼마예요", "비용", "가격이 궁금해요"] },
  {
    id: "duration",
    keywords: ["제작 기간", "제작기간", "기간", "제작 기간은 얼마나 걸리나요"],
  },
  {
    id: "coupon",
    keywords: ["쿠폰", "쿠폰함", "할인쿠폰", "할인 쿠폰", "쿠폰이 궁금해요"],
  },
  {
    id: "payment",
    keywords: ["결제", "결제 방법", "결제방법", "무통장", "카카오페이", "네이버페이", "카드 결제"],
  },
  { id: "refund", keywords: ["환불", "취소", "청약철회", "환불 규정", "취소 규정"] },
  { id: "lyric-edit", keywords: ["가사 수정", "가사수정", "수정"] },
  { id: "delivery", keywords: ["완성곡", "음원 파일", "전달 방식", "음원"] },
  { id: "copyright", keywords: ["저작권", "상업적 이용", "재판매"] },
  {
    id: "my-orders",
    keywords: ["신청 내역", "주문 내역", "상담 내역", "내역"],
  },
  { id: "photo", keywords: ["사진", "사진 준비", "얼굴 사진", "추억 사진"] },
  {
    id: "schedule-change",
    keywords: ["상담 일정 변경", "상담 날짜 변경", "상담 시간 변경", "상담 취소"],
  },
  {
    id: "consult-options",
    keywords: ["상담 옵션", "상담 추가 옵션", "리포트", "상담 리포트", "궁합"],
  },
  {
    id: "help-pages",
    keywords: ["공지사항", "공지", "faq", "자주 묻는 질문", "이용 안내"],
  },
  {
    id: "account",
    keywords: [
      "회원가입",
      "가입",
      "로그인",
      "카카오 로그인",
      "네이버 로그인",
      "비밀번호",
      "비밀번호 찾기",
      "비밀번호 재설정",
    ],
  },
];

/**
 * 개인 사주 풀이나 내 주문 확인처럼 챗봇이 답하지 않는 말.
 * 하나라도 들어 있으면 상품 안내로 분류하지 않고 상담원 안내로 보낸다.
 */
const PERSONAL_WORDS = [
  "운세",
  "봐줘",
  "봐주세요",
  "봐 주세요",
  "풀이",
  "사주 좀",
  "내 사주",
  "제 사주",
  "궁합 좀",
  "배송",
  "제가 신청",
  "신청한 노래",
  "제 노래",
  "내 노래",
  "확인해 주세요",
];

/** 노래를 만들고 싶다는 뜻이 드러나는 말. 대상 단어 하나만으로 분류하지 않기 위해 함께 본다. */
const GIFT_INTENT_WORDS = [
  "선물",
  "노래",
  "인생곡",
  "곡",
  "만들",
  "제작",
  "해주",
  "해 주",
  "드리",
  "하고 싶",
  "하려",
  "생신",
  "생일",
  "환갑",
  "칠순",
  "기념일",
];

/**
 * 보수적인 문장 규칙. 위에서부터 살펴보고 처음 맞는 것을 쓴다.
 * all: 각 묶음에서 최소 한 단어씩 모두 나와야 한다.
 * none: 하나라도 나오면 이 규칙은 쓰지 않는다.
 */
const NODE_RULES: {
  id: ChatNodeId;
  all: readonly (readonly string[])[];
  none?: readonly string[];
}[] = [
  {
    // 내 주문·신청이 지금 어디까지 왔는지는 계정마다 달라 상담원에게 넘긴다.
    id: "contact",
    all: [
      ["주문", "신청", "제작", "작업", "진행"],
      [
        "언제 나와",
        "언제 완성",
        "언제 받",
        "어디까지",
        "얼마나 됐",
        "됐어요",
        "됐나요",
        "어떻게 됐",
        "확인해 주",
        "확인해줘",
      ],
    ],
  },
  {
    // 로그인·인증이 실제로 막힌 상황은 계정마다 달라 상담원에게 넘긴다.
    id: "contact",
    all: [
      ["로그인", "계정", "인증", "인증 문자", "문자", "비밀번호"],
      ["안 돼", "안돼", "안 되", "안되", "안 와", "안와", "못 받", "실패", "오류", "막혀", "잠겼"],
    ],
  },
  {
    // 결제·환불의 개별 처리나 상태 확인은 챗봇이 판단하지 않고 상담원에게 넘긴다.
    id: "contact",
    all: [
      ["결제", "환불", "취소", "입금"],
      ["해 주", "해주", "해줘", "언제", "안 됐", "안됐", "실패", "중복", "두 번", "두번", "확인해"],
    ],
  },
  {
    // 내 쿠폰이 실제로 어떤 상태인지 확인해야 하는 질문은 상담원에게 넘긴다.
    id: "contact",
    all: [
      ["쿠폰"],
      ["적용이 안", "안 돼", "안돼", "안 되", "안되", "사라졌", "없어졌", "못 쓰", "오류", "문제"],
    ],
  },
  {
    id: "gift-parents",
    all: [["부모님", "부모", "엄마", "어머니", "아빠", "아버지", "장인", "장모"], GIFT_INTENT_WORDS],
  },
  {
    id: "gift-partner",
    all: [
      ["남편", "아내", "와이프", "신랑", "여자친구", "남자친구", "여친", "남친", "연인", "배우자"],
      GIFT_INTENT_WORDS,
    ],
  },
  {
    id: "gift-family",
    all: [["반려동물", "강아지", "고양이", "가족", "딸", "아들", "손주", "손자", "손녀"], GIFT_INTENT_WORDS],
  },
  {
    id: "schedule-change",
    all: [["상담"], ["날짜 변경", "시간 변경", "일정 변경", "변경", "바꿀", "바꾸", "취소", "미루", "옮기"]],
  },
  {
    id: "photo",
    all: [["사진"], ["언제", "어디", "보내", "올려", "올리", "준비", "나중에", "필요"]],
  },
  { id: "my-orders", all: [["신청 내역", "주문 내역", "상담 내역"]] },
  {
    id: "my-orders",
    all: [
      ["신청 내역", "주문 내역", "상담 내역", "내역", "진행 상황", "진행상황", "신청", "주문"],
      ["어디", "확인", "볼 수", "보나요", "봐요", "보려면", "조회"],
    ],
  },
  {
    id: "consult-options",
    all: [["상담 내용", "상담 기록"], ["정리", "요약", "받을 수", "주나요", "되나요", "남겨"]],
  },
  {
    id: "consult-options",
    all: [
      ["리포트", "궁합", "추가 인원", "두 명", "둘이", "상담 옵션"],
      ["상담", "같이", "함께", "받을 수", "되나요", "돼요", "가능", "얼마", "정리"],
    ],
  },
  {
    id: "help-pages",
    all: [["공지", "faq", "자주 묻는 질문", "이용 안내"], ["어디", "있어요", "있나요", "볼 수", "봐요", "확인"]],
  },
  { id: "compare", all: [["차이", "달라", "다른 점", "다른점", "비교"]] },
  {
    id: "choose",
    all: [
      ["골라", "고를", "선택", "추천", "어떤 상품", "어떤 걸", "뭘", "뭐를"],
      ["모르겠", "할까", "해야", "좋을까", "맞을까", "해주", "해 주", "줘", "주세요"],
    ],
  },
  { id: "story", all: [["이야기로 만드는", "이야기 인생곡", "일반 인생곡"]] },
  { id: "saju-song", all: [["사주 인생곡", "사주인생곡", "사주곡"]] },
  {
    id: "premium",
    all: [["프리미엄"], ["뭐", "무엇", "알려", "설명", "궁금", "대해", "어떤", "어떻게"]],
  },
  {
    id: "what-is",
    all: [["인생곡"], ["뭐", "무엇", "뭔가", "알려", "궁금", "설명", "이란", "어떤 서비스"]],
  },
  {
    id: "video",
    all: [
      ["뮤직비디오", "영상", "mv"],
      ["만들", "제작", "추가", "가능", "되나", "돼", "될까", "할 수", "옵션", "같이", "함께"],
    ],
  },
  {
    id: "consult-method",
    all: [
      ["상담"],
      ["전화", "카톡", "카카오톡", "화상", "방식", "어떻게 진행", "어떻게 해", "어떻게 하", "어떻게 받"],
    ],
  },
  { id: "teachers", all: [["선생님", "누가 상담", "누가 봐"]] },
  { id: "consult-fields", all: [["상담"], ["분야", "무슨 상담", "어떤 상담", "뭘 상담"]] },
  {
    id: "consulting",
    all: [
      ["사주상담", "사주 상담", "상담"],
      ["받고 싶", "알려", "궁금", "뭐", "가능", "신청", "하고 싶", "있나", "있어"],
    ],
  },
  {
    id: "apply",
    all: [
      ["신청", "접수", "주문하려"],
      ["어떻게", "방법", "하려면", "하고 싶", "되나", "돼", "할까", "해야"],
    ],
  },
  {
    id: "duration",
    all: [
      ["제작", "만드는", "만드는 데", "완성", "기간", "며칠", "얼마나"],
      ["얼마나", "며칠", "기간", "언제쯤", "걸려", "걸리", "걸릴", "소요"],
    ],
    // 돈 이야기는 기간이 아니라 가격 안내로 보낸다.
    none: ["가격", "비용", "금액"],
  },
  { id: "coupon", all: [["쿠폰"]] },
  {
    id: "account",
    all: [
      ["회원가입", "가입", "로그인", "비밀번호", "계정"],
      ["어떻게", "방법", "하나요", "해야", "되나요", "돼요", "가능", "찾", "잊", "재설정", "바꾸"],
    ],
  },
  { id: "copyright", all: [["저작권", "상업적", "재판매", "2차 저작", "유튜브에 올려", "판매해도"]] },
  {
    id: "lyric-edit",
    all: [["가사"], ["수정", "고치", "고쳐", "바꿀", "바꾸", "몇 번", "다시"]],
  },
  {
    id: "delivery",
    all: [["완성곡", "완성된 노래", "음원", "노래", "영상"], ["어떻게 받", "받아요", "받나요", "전달", "파일"]],
  },
  { id: "refund", all: [["환불", "청약철회"]] },
  { id: "refund", all: [["취소"], ["규정", "가능", "돼요", "되나요", "할 수", "방법"]] },
  {
    id: "payment",
    all: [["결제", "무통장", "카카오페이", "네이버페이", "카드"], ["방법", "수단", "되나요", "돼요", "가능", "어떻게", "할 수"]],
  },
  { id: "price", all: [["가격", "비용", "금액", "얼마"]] },
  { id: "gift", all: [["선물"], ["하고 싶", "할까", "만들", "노래", "추천", "하려"]] },
];

/** 가격 질문과 선물 대상이 한 문장에 같이 있으면 핵심 의도가 분명하지 않다고 본다. */
const PRICE_WORDS = ["가격", "비용", "금액", "얼마"];
const GIFT_TARGET_WORDS = [
  "부모님",
  "엄마",
  "어머니",
  "아빠",
  "아버지",
  "남편",
  "아내",
  "연인",
  "배우자",
  "반려동물",
];

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

/**
 * 띄어쓰기만 다른 말을 같은 말로 보기 위한 비교용 문자열.
 * "사주 인생곡"과 "사주인생곡"이 갈라지지 않게 한다. 원문 정규화는 그대로 두고
 * 비교할 때만 쓴다(화면에 보여 주는 값은 바뀌지 않는다).
 */
function compactOf(text: string): string {
  return text.replace(/\s+/g, "");
}

/** 문장과 그 공백 제거본 중 어느 쪽에라도 걸리면 참. 띄어쓰기로 규칙이 새지 않게 한다. */
function hasAnyLoose(texts: readonly string[], words: readonly string[]): boolean {
  return texts.some((text) => hasAny(text, words));
}

/**
 * 완전일치 검사에서 떼어 볼 말끝. 도령에게 실제로 들어오는 형태만 적는다.
 *
 * 일반적인 어미 제거기를 만들지 않는다. 한국어 어미를 폭넓게 자르면
 * "프리미엄이" 같은 조각까지 키워드와 맞아 엉뚱한 노드로 가기 쉽다.
 * 여기 적힌 말끝만, 그것도 완전일치가 실패했을 때만 한 번 떼어 본다.
 *
 * 긴 것을 앞에 둔다. "인가요"를 "요"보다 먼저 봐야 "프리미엄인가요"가
 * "프리미엄인가"가 아니라 "프리미엄"이 된다.
 */
const QUESTION_ENDINGS = ["인가요", "이에요", "이예요", "예요", "에요", "이요", "인가", "요"] as const;

/**
 * 말끝을 하나만 떼어 돌려준다. 뗄 것이 없으면 null이다.
 * 너무 짧아지는 경우(남는 글자가 한 글자 이하)는 떼지 않는다. "요"만 남기면
 * 아무 키워드에나 걸릴 수 있기 때문이다.
 */
function stripQuestionEnding(text: string): string | null {
  for (const ending of QUESTION_ENDINGS) {
    if (text.endsWith(ending) && text.length - ending.length >= 2) {
      return text.slice(0, text.length - ending.length);
    }
  }
  return null;
}

/**
 * 자유 입력을 대화 노드에 잇는다.
 * 적어 둔 말과 그대로 맞거나, 뜻이 분명한 단어 조합이 있을 때만 노드를 돌려준다.
 * 개인 사주·주문 확인처럼 챗봇이 답하지 않는 말과 애매한 문장은 null이다.
 *
 * 판정 순서는 바꾸지 않는다.
 *   개인 질문 차단 → 완전일치 → 모호 조합 차단 → 조합 규칙 → null(fallback)
 * 띄어쓰기와 말끝은 "같은 말로 볼 후보"를 늘릴 뿐, 순서와 규칙 자체는 그대로다.
 */
function matchChatNode(question: string): ChatNodeId | null {
  const normalized = question.trim().toLowerCase().replace(/[?!.,~]/g, "");
  if (!normalized) return null;

  // 띄어쓰기만 다른 말을 같은 말로 보기 위한 비교 대상. 원문도 함께 본다.
  const compact = compactOf(normalized);
  const loose = normalized === compact ? [normalized] : [normalized, compact];

  /*
   * 개인 사주·주문 확인은 상품 안내로 분류하지 않는다.
   * 공백 제거본까지 함께 보는 이유는 "사주 봐 주세요"처럼 띄어 쓴 말로
   * 이 차단을 빠져나가지 못하게 하기 위해서다.
   */
  if (hasAnyLoose(loose, PERSONAL_WORDS)) return "personal-saju";

  /*
   * 완전일치. 부분일치로 바꾸지 않는다(짧은 키워드가 긴 문장을 가로챈다).
   * 대신 같은 말로 볼 수 있는 후보를 넓힌다: 원문, 공백 제거본,
   * 그리고 각각에서 말끝을 하나 떼어 본 것.
   */
  const exactTargets = new Set<string>(loose);
  for (const text of loose) {
    const stripped = stripQuestionEnding(text);
    if (stripped) exactTargets.add(stripped);
  }

  for (const { id, keywords } of NODE_KEYWORDS) {
    for (const keyword of keywords) {
      const lowered = keyword.toLowerCase();
      if (exactTargets.has(lowered) || exactTargets.has(compactOf(lowered))) return id;
    }
  }

  /*
   * 가격과 선물 대상이 섞이면 무엇을 묻는지 분명하지 않다.
   * 답할 수 없는 질문은 아니므로 문의로 넘기지 않고 되묻는 노드로 보낸다.
   */
  if (hasAnyLoose(loose, PRICE_WORDS) && hasAnyLoose(loose, GIFT_TARGET_WORDS)) {
    return "gift-or-price";
  }

  for (const rule of NODE_RULES) {
    if (rule.none && hasAnyLoose(loose, rule.none)) continue;
    if (rule.all.every((group) => hasAnyLoose(loose, group))) return rule.id;
  }

  return null;
}

/**
 * 테스트·검증용 내부 도우미. 런타임 동작에는 영향을 주지 않는다.
 * (기존 socialLink.ts의 __socialLinkInternals와 같은 방식)
 */
export const __chatMatchInternals = {
  matchChatNode,
  stripQuestionEnding,
  compactOf,
  CHAT_NODES,
  ROOT_CHOICES,
};

/** 상담원 문의방 선택 규칙의 테스트용 출구. 같은 방식으로 런타임에는 영향이 없다. */
export const __chatInquiryInternals = {
  pickAgentInquiry,
  isOpenInquiry,
  inquiryStatusLabel,
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  // AI 연결 전이라 처음에는 비어 있다. 지금은 빠른 질문으로만 쌓인다.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  // 말풍선 key로만 쓰는 일련번호. 같은 질문을 여러 번 눌러도 값이 겹치지 않는다.
  const seqRef = useRef(0);

  // 실제 상담원 문의 폼. 아직 서버에 보내지 않고 화면에만 결과를 남긴다.
  const [inputValue, setInputValue] = useState("");
  // 도령이를 크게 보는 팝업. 얼굴을 눌렀을 때만 연다.
  const [profileOpen, setProfileOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryMethod, setInquiryMethod] = useState<ContactMethod>("카카오톡");
  const [inquiryContact, setInquiryContact] = useState("");
  const [inquiryText, setInquiryText] = useState("");
  const [inquiryAgreed, setInquiryAgreed] = useState(false);
  // 전송 중에는 버튼을 잠가 같은 문의가 두 번 접수되지 않게 한다.
  const [inquirySending, setInquirySending] = useState(false);
  const [inquiryError, setInquiryError] = useState("");

  // 사람 상담원과의 대화 화면. 도령이 자동 안내와 같은 패널 안의 별도 화면이다.
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentInquiry, setAgentInquiry] = useState<ChatInquiryView | null>(null);
  const [agentMessages, setAgentMessages] = useState<ChatInquiryMessageView[]>([]);
  const [agentInput, setAgentInput] = useState("");
  // 전송 중에는 버튼을 잠가 같은 메시지가 두 번 올라가지 않게 한다.
  const [agentSending, setAgentSending] = useState(false);
  const [agentError, setAgentError] = useState("");
  const agentEndRef = useRef<HTMLDivElement>(null);
  // 아래 재조회 effect가 지금 상담원 대화 화면인지 보기 위한 거울.
  // 이 값을 effect의 의존 목록에 넣으면 화면을 열 때마다 effect가 다시 돌아
  // 같은 요청이 두 번 나간다. 그래서 상태가 아니라 ref로 읽는다.
  const agentOpenRef = useRef(false);

  useEffect(() => {
    // 팝업이 열려 있을 때만 ESC를 듣는다.
    if (!profileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [profileOpen]);

  useEffect(() => {
    // 새 말풍선이 생기면 대화 영역 아래가 보이게 한다. 패널 안에서만 움직인다.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    // 상담원 대화도 새 메시지가 오면 아래가 보이게 한다.
    if (!agentOpen) return;
    agentEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [agentOpen, agentMessages]);

  useEffect(() => {
    // 상담원 대화 화면인지 ref에 옮겨 둔다. 아래 재조회 effect는 이 값만 본다.
    agentOpenRef.current = agentOpen;
  }, [agentOpen]);

  /**
   * UI 확인용 임시 동작. 질문을 그대로 사용자 말풍선에 넣고,
   * 미리 적어 둔 답변을 도령이 말풍선에 잇는다. 서버에 아무것도 묻지 않는다.
   */
  // 위 QUICK_QUESTIONS와 함께 남겨 둔다. 지금은 화면에서 호출하지 않는다.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const askQuickQuestion = (label: string, answer: string) => {
    const seq = (seqRef.current += 1);
    setMessages((previous) => [
      ...previous,
      { id: `u-${seq}`, role: "user", text: label },
      { id: `d-${seq}`, role: "doryeong", text: answer, mood: "helpful" },
    ]);
  };

  /**
   * 선택한 질문을 사용자 말풍선으로 남기고, 그 답변과 다음 선택지를 잇는다.
   * askedText가 있으면 사용자가 직접 친 문장을 그대로 말풍선에 쓴다.
   */
  const askNode = (id: ChatNodeId, askedText?: string) => {
    const node = CHAT_NODES[id];
    const seq = (seqRef.current += 1);
    setMessages((previous) => [
      ...previous,
      { id: `u-${seq}`, role: "user", text: askedText ?? node.label },
      {
        id: `d-${seq}`,
        role: "doryeong",
        text: node.answer,
        mood: node.mood ?? "helpful",
        display: node.display,
        choices: node.next,
        cta: node.cta,
      },
    ]);
    if (id === "contact") setInquiryOpen(true);
  };

  const canSend = inputValue.trim().length > 0;

  /**
   * 자유 입력 전송. 지금은 질문을 사용자 말풍선으로만 남긴다.
   * 도령이 답변은 AI 연결 단계에서 붙인다. 서버에 아무것도 묻지 않는다.
   */
  const sendInput = () => {
    const question = inputValue.trim();
    if (!question) return;
    const seq = (seqRef.current += 1);
    const normalized = question.toLowerCase();
    const reply = LOCAL_GREETING_REPLIES.find((item) => item.keywords.includes(normalized));
    if (reply) {
      setMessages((previous) => [
        ...previous,
        { id: `u-${seq}`, role: "user", text: question },
        {
          id: `d-${seq}`,
          role: "doryeong",
          text: reply.text,
          mood: reply.mood,
          display: "emphasis",
        },
      ]);
      setInputValue("");
      return;
    }

    // 뜻이 분명한 말만 대화 노드로 잇는다. 아니면 상담원 안내로 보낸다.
    seqRef.current -= 1;
    askNode(matchChatNode(question) ?? "fallback", question);
    setInputValue("");
  };

  const canSubmitInquiry =
    inquiryName.trim().length > 0 &&
    inquiryContact.trim().length > 0 &&
    inquiryText.trim().length > 0 &&
    inquiryAgreed &&
    !inquirySending;

  /**
   * 상담원 대화 화면 열기. 전체 타임라인을 서버에서 다시 읽어 온다.
   * 실패하면 화면을 바꾸지 않고 간단한 안내만 남긴다.
   */
  const openAgentChat = async (inquiryId: string) => {
    setAgentError("");
    try {
      const response = await fetch(`/api/chat-inquiries/me/${encodeURIComponent(inquiryId)}`);
      if (!response.ok) {
        setInquiryError("대화를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const result = (await response.json()) as {
        inquiry: ChatInquiryView;
        messages: ChatInquiryMessageView[];
      };
      setAgentInquiry(result.inquiry);
      setAgentMessages(result.messages);
      setAgentOpen(true);
    } catch {
      setInquiryError("연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.");
    }
  };

  useEffect(() => {
    // 패널을 열 때마다 내 문의방을 다시 찾아본다.
    // 관리자가 답변한 뒤 고객이 위젯을 닫았다 다시 열면 그 답변이 보여야 한다.
    // 여는 순간에만 한 번 묻는다. polling도, 화면 전환 감시도 하지 않는다.
    // 실패해도 도령이 자동 안내는 그대로 쓸 수 있어야 하므로 화면에 오류를 띄우지 않는다.
    if (!open) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/chat-inquiries/me");
        if (!response.ok) return;
        const result = (await response.json()) as { inquiries?: ChatInquiryView[] };
        const found = pickAgentInquiry(result.inquiries);
        if (cancelled || !found) return;
        setAgentInquiry(found);
        // 상담원 대화 화면을 보던 채로 닫았던 경우다. 그 방의 타임라인도 다시 읽어
        // 그 사이 들어온 상담원 답변이 화면에 들어오게 한다. 기존 조회 경로를 그대로 쓴다.
        if (agentOpenRef.current) await openAgentChat(found.id);
      } catch {
        // 첫 방문이거나 연결이 잠깐 끊긴 경우다. 문의 폼을 그대로 보여 주면 된다.
      }
    })();
    return () => {
      cancelled = true;
    };
    // open이 참이 되는 순간에만 돈다. agentOpen/agentInquiry를 넣으면 대화를 열 때마다
    // 다시 돌아 같은 요청이 겹친다. 그래서 위 agentOpenRef로 읽는다.
  }, [open]);

  /**
   * 문의 폼 제출. 새 문의방 API로 보낸다.
   * 서버가 진행 중인 방을 찾으면 그 방에 메시지가 이어 붙고, 없으면 새 방이 만들어진다.
   * 어느 쪽이든 응답 형태가 같아 여기서 따로 나누지 않는다.
   * 실패하면 입력값을 그대로 두고 다시 시도할 수 있게 한다.
   */
  const submitInquiry = async () => {
    if (!canSubmitInquiry) return;
    setInquirySending(true);
    setInquiryError("");

    const name = inquiryName.trim();
    const phone = inquiryContact.trim();
    const message = inquiryText.trim();

    try {
      const response = await fetch("/api/chat-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          contactMethod: inquiryMethod,
          message,
          privacyAgreed: true,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { inquiry?: ChatInquiryView; messages?: ChatInquiryMessageView[]; error?: string }
        | null;
      if (!response.ok || !result?.inquiry) {
        setInquiryError(result?.error ?? "문의 접수에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      // 접수 안내로 끝내지 않고 바로 상담원 대화 화면으로 넘어간다.
      setAgentInquiry(result.inquiry);
      setAgentMessages(result.messages ?? []);
      setAgentOpen(true);
      setAgentError("");
      setAgentInput("");
    } catch {
      setInquiryError("연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.");
      return;
    } finally {
      setInquirySending(false);
    }

    setInquiryOpen(false);
    setInquiryText("");
    setInquiryError("");
    // 다음에 새 문의를 남길 때 동의를 다시 받는다.
    setInquiryAgreed(false);
  };

  const canSendAgentMessage =
    !!agentInquiry && isOpenInquiry(agentInquiry) && agentInput.trim().length > 0 && !agentSending;

  /**
   * 상담원 대화에 메시지 추가. 이미 접수된 방에 덧붙이는 것이라
   * 개인정보 동의를 다시 받지 않는다.
   * 실패하면 입력값을 지우지 않고 그대로 둔다.
   */
  const sendAgentMessage = async () => {
    if (!canSendAgentMessage || !agentInquiry) return;
    setAgentSending(true);
    setAgentError("");
    try {
      const response = await fetch("/api/chat-inquiries/me/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId: agentInquiry.id, message: agentInput.trim() }),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: ChatInquiryMessageView; error?: string }
        | null;
      if (!response.ok || !result?.message) {
        setAgentError("메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const saved = result.message;
      setAgentMessages((previous) => [...previous, saved]);
      setAgentInput("");
    } catch {
      setAgentError("연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setAgentSending(false);
    }
  };

  return (
    // 셸 폭에 맞춘 고정 레이어. 빈 영역이 화면 터치를 막지 않도록 pointer-events를 끈다.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-[430px]">
      {profileOpen ? (
        // 도령이를 크게 보는 팝업. 이미지 안에 문구가 있어 따로 설명을 붙이지 않는다.
        <div
          className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setProfileOpen(false)}
          role="presentation"
        >
          <div className="relative" onClick={(event) => event.stopPropagation()} role="presentation">
            <Image
              src={DORYEONG_PROFILE_IMAGE}
              alt="도령이"
              width={1254}
              height={1254}
              className="h-auto max-h-[80vh] w-auto max-w-[86vw] rounded-2xl object-contain"
            />
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              aria-label="닫기"
              className="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <section
          className="pointer-events-auto mx-3 flex h-[76vh] max-h-[640px] flex-col overflow-hidden rounded-2xl border border-[#ebe3d8] bg-[#fffdf9] shadow-[0_6px_24px_rgba(64,58,73,0.18)]"
          style={{
            marginBottom: `calc(${BOTTOM_NAV_HEIGHT} + env(safe-area-inset-bottom) + 12px)`,
          }}
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-[#ebe3d8] px-4 py-3">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label="도령이 크게 보기"
              className="shrink-0"
            >
              <Image
                src={DORYEONG_FACES.avatar}
                alt=""
                width={667}
                height={727}
                className="h-11 w-10 object-contain"
              />
            </button>
            <span className="min-w-0 flex-1">
              <h2 className="text-[16px] font-bold leading-tight text-[#403A49]">사주로그 AI 안내</h2>
              <p className="mt-0.5 text-[12px] leading-tight text-[#6B6570]">
                도령이가 알려드려요 🐾
              </p>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-lg p-2 text-[#6B6570] hover:bg-[#f5efe6]"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {agentOpen && agentInquiry ? (
            // 상담원 대화 화면. 도령이 자동 안내와 같은 패널 안의 별도 화면이다.
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-[#ebe3d8] bg-[#fffdf9] px-4 py-2">
                <button
                  type="button"
                  onClick={() => setAgentOpen(false)}
                  className="rounded-lg px-2 py-1 text-[14px] font-medium text-[#6B6570] active:bg-[#f5efe6]"
                >
                  ← 뒤로
                </button>
                <span className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold leading-tight text-[#403A49]">상담원 대화</p>
                  <p className="mt-0.5 text-[12px] leading-tight text-[#6B6570]">
                    {inquiryStatusLabel(agentInquiry.status)}
                  </p>
                </span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-[#faf8f5] px-4 py-4">
                {agentMessages.map((message) =>
                  message.sender === "customer" ? (
                    <UserBubble key={message.id} text={message.body} />
                  ) : (
                    <AgentBubble key={message.id} text={message.body} />
                  ),
                )}
                {agentError ? (
                  <p className="text-[13px] leading-relaxed text-red-600">{agentError}</p>
                ) : null}
                <div ref={agentEndRef} />
              </div>

              <div className="shrink-0 border-t border-[#ebe3d8] bg-[#fffdf9] px-4 py-3">
                {isOpenInquiry(agentInquiry) ? (
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <input
                      type="text"
                      value={agentInput}
                      maxLength={1000}
                      onChange={(event) => setAgentInput(event.target.value)}
                      onKeyDown={(event) => {
                        // 한글 조합 중 Enter는 글자 확정용이라 전송하지 않는다.
                        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                        event.preventDefault();
                        sendAgentMessage();
                      }}
                      placeholder="상담원에게 보낼 내용을 입력해주세요"
                      aria-label="상담원에게 보낼 메시지"
                      className="h-12 w-full min-w-0 flex-1 rounded-xl border border-[#e8dfd4] bg-white px-3 text-[16px] text-[#403A49] outline-none placeholder:text-[#9c96a6]"
                    />
                    <button
                      type="button"
                      onClick={sendAgentMessage}
                      disabled={!canSendAgentMessage}
                      aria-label="보내기"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#403A49] text-white disabled:opacity-40"
                    >
                      <Send className="h-5 w-5" strokeWidth={1.8} />
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] leading-relaxed text-[#6B6570]">
                    상담이 끝난 대화예요. 새로 궁금한 점이 있으시면 뒤로 가서 다시 문의해 주세요.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
          {/* 대화 영역. 첫 인사와 자주 묻는 질문 아래로 실제 대화가 이어진다. */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#faf8f5] px-4 py-4">
            <div className="space-y-2">
              <DoryeongBubble
                text={"안녕하세요 🐾\n사주로그 AI 상담원 도령이에요.\n\n궁금한 게 있으시면\n편하게 물어보세요."}
                mood="greeting"
                display="emphasis"
                onFaceClick={() => setProfileOpen(true)}
              />
              <p className="pl-11 text-[13px] leading-relaxed text-[#6B6570]">
                상품, 사주상담, 가격과 신청 방법을 물어보세요.
              </p>
              {/* 대화 트리로 들어가는 입구. 누르면 답변과 다음 질문이 이어진다. */}
              <div className="flex flex-wrap gap-2 pl-11">
                {ROOT_CHOICES.map((choiceId) => (
                  <ChoiceButton key={choiceId} id={choiceId} onSelect={askNode} />
                ))}
              </div>
            </div>

            <section className="rounded-2xl border border-[#ebe3d8] bg-white p-3">
              <p className="text-[13px] leading-relaxed text-[#6B6570]">
                AI 안내로 해결되지 않으셨나요?
              </p>
              {agentInquiry && !isOpenInquiry(agentInquiry) ? (
                // 끝난 대화도 답변을 다시 읽을 수 있게 둔다. 읽기 전용이라는 것이
                // 문구에서 드러나게 하고, 아래 새 문의 경로는 그대로 남겨 둔다.
                <button
                  type="button"
                  onClick={() => openAgentChat(agentInquiry.id)}
                  className="mt-2 h-11 w-full rounded-xl border border-[#e0d5c8] bg-[#fffdf9] text-[15px] font-semibold text-[#6B6570] active:bg-[#f5efe6]"
                >
                  지난 상담 답변 보기
                </button>
              ) : null}
              {isOpenInquiry(agentInquiry) && agentInquiry ? (
                // 이미 진행 중인 대화가 있으면 새 폼을 또 쓰게 하지 않는다.
                <button
                  type="button"
                  onClick={() => openAgentChat(agentInquiry.id)}
                  className="mt-2 h-11 w-full rounded-xl border border-[#403A49] bg-[#fffdf9] text-[15px] font-semibold text-[#403A49] active:bg-[#f5efe6]"
                >
                  상담원과 대화 이어가기
                </button>
              ) : inquiryOpen ? (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-[13px] font-bold text-[#403A49]">이름</span>
                    <input
                      type="text"
                      value={inquiryName}
                      onChange={(event) => setInquiryName(event.target.value)}
                      placeholder="이름을 입력해 주세요"
                      className="mt-1 h-11 w-full rounded-xl border border-[#e8dfd4] bg-[#fffdf9] px-3 text-[15px] text-[#403A49] outline-none focus:border-[#403A49]"
                    />
                  </label>

                  <div>
                    <span className="text-[13px] font-bold text-[#403A49]">연락받을 방법</span>
                    <div className="mt-1 flex gap-2">
                      {CONTACT_METHODS.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setInquiryMethod(method)}
                          aria-pressed={inquiryMethod === method}
                          className={`h-10 flex-1 rounded-xl border text-[14px] font-medium ${
                            inquiryMethod === method
                              ? "border-[#403A49] bg-[#403A49] text-white"
                              : "border-[#e0d5c8] bg-[#fffdf9] text-[#5c3d2e]"
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-[13px] font-bold text-[#403A49]">휴대폰 번호</span>
                    <input
                      type="tel"
                      value={inquiryContact}
                      onChange={(event) => setInquiryContact(event.target.value)}
                      placeholder="010-0000-0000"
                      className="mt-1 h-11 w-full rounded-xl border border-[#e8dfd4] bg-[#fffdf9] px-3 text-[15px] text-[#403A49] outline-none focus:border-[#403A49]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[13px] font-bold text-[#403A49]">문의 내용</span>
                    <textarea
                      value={inquiryText}
                      onChange={(event) => setInquiryText(event.target.value)}
                      rows={3}
                      placeholder="궁금한 내용을 적어 주세요"
                      className="mt-1 w-full resize-none rounded-xl border border-[#e8dfd4] bg-[#fffdf9] px-3 py-2 text-[15px] leading-relaxed text-[#403A49] outline-none focus:border-[#403A49]"
                    />
                  </label>

                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={inquiryAgreed}
                      onChange={(event) => setInquiryAgreed(event.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[#403A49]"
                    />
                    <span className="text-[13px] leading-relaxed text-[#6B6570]">
                      상담 문의 접수를 위해 이름, 휴대폰 번호, 문의 내용을 수집·이용하는 것에
                      동의합니다.{" "}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#403A49] underline"
                      >
                        개인정보 처리방침
                      </a>
                    </span>
                  </label>

                  {inquiryError ? (
                    <p className="text-[13px] leading-relaxed text-red-600">{inquiryError}</p>
                  ) : null}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInquiryOpen(false)}
                      className="h-11 rounded-xl border border-[#e0d5c8] bg-[#fffdf9] px-4 text-[15px] font-medium text-[#6B6570]"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={submitInquiry}
                      disabled={!canSubmitInquiry}
                      className="h-11 flex-1 rounded-xl bg-[#403A49] text-[15px] font-semibold text-white disabled:opacity-40"
                    >
                      {inquirySending ? "접수 중…" : "문의 남기기"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setInquiryOpen(true)}
                  className="mt-2 h-11 w-full rounded-xl border border-[#403A49] bg-[#fffdf9] text-[15px] font-semibold text-[#403A49] active:bg-[#f5efe6]"
                >
                  실제 상담원에게 문의하기
                </button>
              )}
            </section>

            {messages.map((message) =>
              message.role === "user" ? (
                <UserBubble key={message.id} text={message.text} />
              ) : (
                <div key={message.id} className="space-y-2">
                  <DoryeongBubble
                    text={message.text}
                    mood={message.mood}
                    display={message.display}
                  />
                  {/*
                    화면 이동 링크. 같은 탭으로 옮겨 가고, 이동 뒤 상태를 따로 정리하지
                    않는다(페이지가 바뀌면 위젯도 함께 새로 그려진다).
                    기존 문의 폼의 <a>와 같은 방식이라 라우터를 새로 들이지 않는다.
                  */}
                  {message.cta ? (
                    <div className="pl-11">
                      <a
                        href={message.cta.href}
                        className="flex h-11 w-full items-center justify-center rounded-xl bg-[#403A49] text-[14px] font-semibold text-white active:opacity-90"
                      >
                        {message.cta.label}
                      </a>
                    </div>
                  ) : null}
                  {message.choices && message.choices.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pl-11">
                      {message.choices.map((choiceId) => (
                        <ChoiceButton key={choiceId} id={choiceId} onSelect={askNode} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
            )}
            <div ref={endRef} />
          </div>

          <div className="shrink-0 border-t border-[#ebe3d8] bg-[#fffdf9] px-4 py-3">
            <div className="flex w-full min-w-0 items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  // 한글 조합 중 Enter는 글자 확정용이라 전송하지 않는다.
                  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  sendInput();
                }}
                placeholder="궁금한 내용을 입력해주세요"
                aria-label="메시지 입력"
                className="h-12 w-full min-w-0 flex-1 rounded-xl border border-[#e8dfd4] bg-white px-3 text-[16px] text-[#403A49] outline-none placeholder:text-[#9c96a6] disabled:bg-white"
              />
              <button
                type="button"
                onClick={sendInput}
                disabled={!canSend}
                aria-label="보내기"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#403A49] text-white disabled:opacity-40"
              >
                <Send className="h-5 w-5" strokeWidth={1.8} />
              </button>
            </div>
          </div>
            </>
          )}
        </section>
      ) : (
        <div
          className="flex justify-end px-3"
          style={{
            paddingBottom: `calc(${BOTTOM_NAV_HEIGHT} + env(safe-area-inset-bottom) + 12px)`,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto relative flex h-[92px] w-[84px] items-center justify-center"
            aria-label="사주로그 AI 안내 열기"
          >
            {/* 이미지 뒤에서 아주 은은하게 번지는 보라 glow. 움직임이 크지 않게 6초 주기로 둔다. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(ellipse_at_center,rgba(124,92,214,0.28)_0%,rgba(124,92,214,0)_70%)] [animation-duration:6s]"
            />
            {/* 이미지 안에 상담원 표기까지 들어 있어 그대로 다 보이게 둔다. 잘라내지 않는다. */}
            <Image
              src={DORYEONG_FACES.avatar}
              alt=""
              width={667}
              height={727}
              className="relative h-[92px] w-[84px] object-contain drop-shadow-[0_3px_8px_rgba(64,58,73,0.25)]"
            />
          </button>
        </div>
      )}
    </div>
  );
}
