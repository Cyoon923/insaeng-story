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
import { ORDER_OPTION_PRICES } from "@/lib/server/pricing";
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
  | "more"
  | "contact"
  | "fallback";

interface ChatNode {
  /** 버튼과 사용자 말풍선에 함께 쓰는 질문 문구. */
  label: string;
  /** 답변. 가격이 들어가는 답변은 상수를 읽어 만든다. */
  answer: string;
  /** 답변 아래에 이어 붙일 다음 질문들. */
  next: readonly ChatNodeId[];
  mood?: DoryeongMood;
  display?: DoryeongDisplay;
}

/** 상품 가격을 상수에서 읽는다. 문장에 금액을 적지 않기 위한 도우미다. */
function productPriceFrom(id: (typeof LIFE_SONG_PRODUCTS)[number]["id"]): string {
  const product = LIFE_SONG_PRODUCTS.find((item) => item.id === id);
  return product ? formatPriceFrom(product.priceFrom) : "";
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
      className="flex min-w-[calc(50%-0.25rem)] flex-1 items-center gap-1.5 rounded-xl border border-[#e0d5c8] bg-[#fffdf9] px-3 py-2 text-left text-[13px] font-medium text-[#5c3d2e] active:bg-[#f5efe6]"
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
      "인생곡은 고객님의 이야기나 사주 정보를 담아\n세상에 하나뿐인 노래를 만들어 드리는 서비스예요 🐾\n이야기로 만드는 인생곡, 프리미엄 인생곡, 사주 인생곡 세 가지가 있어요.",
    next: ["compare", "choose", "price", "apply"],
  },
  compare: {
    label: "세 상품은 뭐가 달라요?",
    answer:
      "차이는 상담이 들어가는지예요 🐾\n· 이야기로 만드는 인생곡 — 직접 쓰신 이야기로 제작해요.\n· 사주 인생곡 — 상담 없이 사주 정보와 이야기로 제작해요.\n· 프리미엄 인생곡 — 사주상담과 스토리상담을 함께 진행해요.\n뮤직비디오는 세 상품 모두 추가 옵션이에요.",
    next: ["choose", "story", "premium", "saju-song"],
  },
  choose: {
    label: "어떤 걸 골라야 할까요?",
    answer:
      "이렇게 생각해 보시면 편해요 🐾\n· 하고 싶은 이야기가 있으시면 → 이야기로 만드는 인생곡\n· 상담까지 함께 받고 싶으시면 → 프리미엄 인생곡\n· 상담 없이 간편하게 원하시면 → 사주 인생곡",
    mood: "curious",
    next: ["story", "premium", "saju-song", "contact"],
  },
  story: {
    label: "이야기로 만드는 인생곡",
    answer: `직접 작성하신 자신의 이야기, 또는 소중한 분의 이야기를 바탕으로\n맞춤 가사와 음악을 만들어 드려요 🐾\n가격은 ${productPriceFrom("story")}이에요.\n사주상담과 영상은 기본 포함이 아니라 따로 선택하시는 부분이에요.`,
    next: ["video", "price", "apply", "duration"],
  },
  premium: {
    label: "프리미엄 인생곡",
    answer: `프리미엄은 일반 인생곡의 고급형이 아니라\n사주상담 → 스토리상담 → 인생곡 제작까지 함께하는 토탈 서비스예요 🐾\n가격은 ${productPriceFrom("premium")}이에요.\n뮤직비디오는 기본 포함이 아니라 추가 옵션이고, 전문 보컬 녹음은 포함되지 않아요.`,
    next: ["compare", "video", "apply", "more"],
  },
  "saju-song": {
    label: "사주 인생곡",
    answer: `상담 없이 사주 정보와 고객님의 이야기, 음악 취향을 함께 담아 만드는 인생곡이에요 🐾\n가격은 ${productPriceFrom("saju-song")}이에요.\n생년월일과 태어난 시간을 입력해 주시면 되고, 시간을 모르셔도 신청하실 수 있어요.`,
    next: ["compare", "price", "apply", "more"],
  },
  gift: {
    label: "선물로 만들고 싶어요",
    answer: "선물로 많이 찾아 주세요 🐾\n어떤 분께 드릴 선물인지 알려주시면 안내해 드릴게요.",
    mood: "curious",
    next: ["gift-parents", "gift-partner", "gift-family", "more"],
  },
  "gift-parents": {
    label: "부모님 선물",
    answer:
      "부모님 이야기를 노래로 담아 드리는 분들이 많으세요 🐾\n이야기로 만드는 인생곡에서 부모님을 이야기 주인공으로 선택하실 수 있어요.\n사주상담까지 함께 원하시면 프리미엄 인생곡도 있어요.",
    next: ["story", "premium", "video", "apply"],
  },
  "gift-partner": {
    label: "배우자·연인 선물",
    answer:
      "연인이나 배우자께 마음을 전하고 싶은 분들이 많이 신청하세요 🐾\n이야기로 만드는 인생곡에서 배우자·연인을 이야기 주인공으로 고르실 수 있어요.",
    next: ["story", "video", "apply", "more"],
  },
  "gift-family": {
    label: "가족·반려동물",
    answer:
      "가족과 반려동물의 이야기도 노래로 만들어 드려요 🐾\n이야기 주인공으로 가족과 반려동물을 선택하실 수 있어요.",
    next: ["story", "video", "apply", "more"],
  },
  video: {
    label: "영상 옵션",
    answer: `영상은 어느 상품이든 기본 포함이 아니라 추가 옵션이에요 🐾\n· 내 얼굴 AI 뮤직비디오 +${formatPrice(ORDER_OPTION_PRICES["ai-mv"])} — 얼굴 사진을 바탕으로 노래에 맞는 영상을 만들어요.\n· 추억사진 영상 제작 +${formatPrice(ORDER_OPTION_PRICES["photo-mv"])} — 보내주신 사진을 인생곡에 맞춰 영상으로 편집해요.\n사진은 결제 후 카카오톡으로 연락드려 받아요.`,
    next: ["price", "apply", "contact", "more"],
  },
  consulting: {
    label: "1:1 사주상담 알려주세요",
    answer: `인생곡과 별도로 이용하실 수 있는 전문 사주상담 서비스예요 🐾\n가격은 ${formatPriceFrom(CONSULTATION.priceFrom)}이고, 약 50분 동안 진행해요.`,
    next: ["teachers", "consult-method", "consult-fields", "price"],
  },
  "consult-fields": {
    label: "상담 분야",
    answer:
      "이런 분야를 살펴볼 수 있어요 🐾\n전체적인 운세 · 재물·금전 · 직장·사업 · 연애·인연 · 결혼·궁합 · 가족 · 진로 · 올해의 흐름",
    next: ["teachers", "consult-method", "apply", "more"],
  },
  teachers: {
    label: "선생님 소개",
    answer: [
      "등록된 상담 분야를 기준으로 알려드릴게요 🐾",
      ...TEACHERS.map((teacher) => `· ${teacher.name} — ${teacher.role}`),
      "신청 화면에서 원하시는 선생님을 직접 고르실 수 있어요.",
    ].join("\n"),
    next: ["consult-fields", "consult-method", "apply", "more"],
  },
  "consult-method": {
    label: "상담 방법",
    answer:
      "카카오톡 상담과 전화 상담 중 하나를 고르시면 돼요 🐾\n약 50분 동안 진행하고, 화상 상담은 하지 않아요.",
    next: ["consult-fields", "teachers", "apply", "more"],
  },
  apply: {
    label: "신청은 어떻게 해요?",
    answer:
      "상품을 고르시고 → 신청 정보를 입력하신 뒤 → 확인 및 결제까지 하시면 돼요 🐾\n하단 메뉴의 인생곡과 상담에서 바로 신청하실 수 있어요.",
    mood: "yes",
    next: ["duration", "price", "contact", "more"],
  },
  duration: {
    label: "제작 기간은 얼마나 걸리나요?",
    answer:
      "제작 기간은 상품에 따라 다르지만 보통 7~14일 정도 걸려요 🐾\n제작 내용과 진행 상황에 따라 기간이 달라질 수 있어요.",
    next: ["apply", "price", "contact", "more"],
  },
  price: {
    label: "가격이 궁금해요",
    answer: [
      "상품과 선택하신 옵션에 따라 달라져요 🐾",
      `· 이야기로 만드는 인생곡 ${productPriceFrom("story")}`,
      `· 사주 인생곡 ${productPriceFrom("saju-song")}`,
      `· 프리미엄 인생곡 ${productPriceFrom("premium")}`,
      `· 1:1 사주상담 ${formatPriceFrom(CONSULTATION.priceFrom)}`,
    ].join("\n"),
    next: ["video", "duration", "apply", "contact"],
  },
  more: {
    label: "다른 질문 보기",
    answer: "어떤 게 궁금하세요? 🐾",
    mood: "curious",
    next: ROOT_CHOICES,
  },
  contact: {
    label: "실제 상담원에게 문의하기",
    answer:
      "아래 문의 남기기에서 이름과 연락처를 적어 주시면\n상담원이 확인 후 연락드릴게요 🐾",
    mood: "waiting",
    display: "emphasis",
    next: ["more"],
  },
  fallback: {
    label: "다른 질문 보기",
    answer:
      "제가 정확하게 안내드리기 어려운 내용이에요 🐾\n실제 상담원에게 문의를 남겨주시면 확인 후 연락드리겠습니다.",
    mood: "waiting",
    next: ["contact", "more"],
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
    text: "안녕하세요 🐾 사주로그 AI 상담원 도령이에요.\n궁금한 게 있으시면 편하게 물어보세요.",
    mood: "greeting",
  },
  {
    keywords: ["고마워", "고마워요", "감사합니다", "감사해"],
    text: "도움이 되었다니 다행이에요 🐾\n또 궁금한 게 생기면 언제든 편하게 물어보세요.",
    mood: "goodday",
  },
  {
    keywords: ["안녕히가세요", "안녕히 가세요", "잘가", "다음에", "바이", "bye"],
    text: "좋은 하루 보내세요 🐾\n궁금한 게 생기면 다음에 또 찾아주세요.",
    mood: "goodday",
  },
];

/** 연락받을 방법. 상담 신청 화면에서 쓰는 방식과 같은 어휘를 쓴다. */
const CONTACT_METHODS = ["카카오톡", "전화", "문자"] as const;

type ContactMethod = (typeof CONTACT_METHODS)[number];

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
      <p className="max-w-[84%] whitespace-pre-line rounded-2xl rounded-tl-md bg-[#f5efe6] px-4 py-3.5 text-[17px] leading-[1.7] text-[#403A49]">
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
  "주문",
  "배송",
  "환불",
  "결제 취소",
  "언제 나와",
  "제가 신청",
  "신청한 노래",
  "제 노래",
  "내 노래",
  "언제 나와요",
  "진행 상황",
  "진행상황",
  "어떻게 됐",
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
 * 자유 입력을 대화 노드에 잇는다.
 * 적어 둔 말과 그대로 맞거나, 뜻이 분명한 단어 조합이 있을 때만 노드를 돌려준다.
 * 개인 사주·주문 확인처럼 챗봇이 답하지 않는 말과 애매한 문장은 null이다.
 */
function matchChatNode(question: string): ChatNodeId | null {
  const normalized = question.trim().toLowerCase().replace(/[?!.,~]/g, "");
  if (!normalized) return null;

  // 개인 사주·주문 확인은 상품 안내로 분류하지 않는다.
  if (hasAny(normalized, PERSONAL_WORDS)) return null;

  for (const { id, keywords } of NODE_KEYWORDS) {
    if (keywords.some((keyword) => normalized === keyword.toLowerCase())) return id;
  }

  // 가격과 선물 대상이 섞이면 무엇을 묻는지 분명하지 않아 넘기지 않는다.
  if (hasAny(normalized, PRICE_WORDS) && hasAny(normalized, GIFT_TARGET_WORDS)) return null;

  for (const rule of NODE_RULES) {
    if (rule.none && hasAny(normalized, rule.none)) continue;
    if (rule.all.every((group) => hasAny(normalized, group))) return rule.id;
  }

  return null;
}

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
    inquiryText.trim().length > 0;

  /**
   * 문의 폼 제출. 아직 서버에 저장하지 않고 화면에만 접수 안내를 남긴다.
   * 실제 접수는 이후 단계에서 붙인다.
   */
  const submitInquiry = () => {
    if (!canSubmitInquiry) return;
    const seq = (seqRef.current += 1);
    setMessages((previous) => [
      ...previous,
      {
        id: `u-${seq}`,
        role: "user",
        text: `상담원 문의\n이름: ${inquiryName.trim()}\n연락 방법: ${inquiryMethod}\n연락처: ${inquiryContact.trim()}\n내용: ${inquiryText.trim()}`,
      },
      {
        id: `d-${seq}`,
        role: "doryeong",
        text: "문의 잘 전달해둘게요 🐾\n상담원이 확인 후 연락드리겠습니다.\n조금만 기다려주세요.",
        mood: "waiting",
        display: "emphasis",
      },
    ]);
    setInquiryOpen(false);
    setInquiryName("");
    setInquiryMethod("카카오톡");
    setInquiryContact("");
    setInquiryText("");
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

          {/* 대화 영역. 첫 인사와 자주 묻는 질문 아래로 실제 대화가 이어진다. */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#faf8f5] px-4 py-4">
            <div className="space-y-2">
              <DoryeongBubble
                text={"안녕하세요 🐾 사주로그 AI 상담원 도령이에요.\n궁금한 게 있으시면 편하게 물어보세요."}
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
              {inquiryOpen ? (
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
                    <span className="text-[13px] font-bold text-[#403A49]">연락처</span>
                    <input
                      type="tel"
                      value={inquiryContact}
                      onChange={(event) => setInquiryContact(event.target.value)}
                      placeholder="연락받을 번호나 아이디"
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
                      문의 남기기
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
