/**
 * 안내 챗봇에 넣을 지식 텍스트를 만든다.
 *
 * 방침
 * - 공개된 안내 데이터만 쓴다. 회원·주문·결제·상담 예약 같은 저장소는 읽지 않는다.
 *   (store.ts / session.ts / DB를 import하지 않는 것이 이 파일의 핵심 규칙이다.)
 * - 가격과 링크는 여기서 새로 적지 않고 products.ts / pricing.ts 값을 그대로 옮긴다.
 *   값이 바뀌면 안내 문구도 함께 바뀐다.
 * - 부수효과 없는 순수 함수다. 같은 상수에서는 언제나 같은 문자열이 나온다.
 */
import {
  CONSULTATION,
  LIFE_SONG_PRODUCTS,
  formatPrice,
  formatPriceFrom,
} from "@/lib/constants/products";
import { CONSULT_OPTION_PRICES, ORDER_OPTION_PRICES } from "@/lib/server/pricing";
import { FAQS } from "@/lib/constants/faq";
import { NOTICES } from "@/lib/constants/notices";
import { TEACHERS } from "@/lib/constants/consultationTeachers";

/** 인생곡 추가 옵션의 화면 이름. 가격은 pricing.ts에서 가져온다. */
const ORDER_OPTION_LABELS: Record<keyof typeof ORDER_OPTION_PRICES, string> = {
  "ai-mv": "내 얼굴 AI 뮤직비디오",
  "photo-mv": "추억사진 영상 제작",
  "lyric-edit": "가사 수정 1회 추가",
};

/** 1:1 사주상담 추가 옵션의 화면 이름. 가격은 pricing.ts에서 가져온다. */
const CONSULT_OPTION_LABELS: Record<keyof typeof CONSULT_OPTION_PRICES, string> = {
  report: "상담 기록 요약 리포트",
  extraPerson: "추가 인원 1명 (궁합)",
};

/**
 * 챗봇이 지켜야 할 경계. 지식보다 먼저 읽히도록 맨 앞에 둔다.
 * 여기에 적힌 일은 챗봇이 할 수 없고, 해서도 안 된다.
 */
export function buildChatBoundaries(): string {
  return [
    "역할: 사주로그 서비스 이용을 안내한다. 아래 공개 정보만 근거로 답한다.",
    "",
    "하지 않는 일:",
    "- 개인 사주를 풀이하지 않는다.",
    "- 운세를 판단하거나 예측하지 않는다.",
    "- 주문 상태나 진행 상황을 조회하지 않는다.",
    "- 회원 개인정보를 조회하거나 알려주지 않는다.",
    "- 결제를 실행하지 않는다.",
    "- 상담 예약을 대신 잡지 않는다.",
    "- 관리자 기능을 실행하지 않는다.",
    "",
    "답변 규칙:",
    "- 아래 자료에 없는 내용은 추측하지 않고 모른다고 말한다.",
    "- 가격과 링크는 아래 자료에 적힌 값만 쓰고 새로 만들지 않는다.",
    "- 개인 사주 풀이나 운세를 물으면 1:1 사주상담 신청을 안내한다.",
    "- 주문 상태나 개인정보를 물으면 MY 화면이나 고객 문의를 안내한다.",
  ].join("\n");
}

/** 인생곡 3종 + 1:1 사주상담의 이름·설명·가격·링크. */
export function buildProductKnowledge(): string {
  const lines: string[] = ["[상품 안내]"];

  for (const product of LIFE_SONG_PRODUCTS) {
    lines.push(
      `- ${product.title}: ${product.description} / 가격 ${formatPriceFrom(product.priceFrom)} / 소개 ${product.href} / 신청 ${product.applyHref}`,
    );
  }
  lines.push(
    `- ${CONSULTATION.title}: ${CONSULTATION.description} / 가격 ${formatPriceFrom(CONSULTATION.priceFrom)} / 소개 ${CONSULTATION.href} / 신청 ${CONSULTATION.applyHref}`,
  );

  return lines.join("\n");
}

/** 추가 옵션과 금액. 인생곡과 상담을 나눠 적는다. */
export function buildOptionKnowledge(): string {
  const lines: string[] = ["[추가 옵션]", "인생곡 옵션:"];

  for (const [id, label] of Object.entries(ORDER_OPTION_LABELS)) {
    const price = ORDER_OPTION_PRICES[id as keyof typeof ORDER_OPTION_PRICES];
    lines.push(`- ${label}: +${formatPrice(price)}`);
  }

  lines.push("1:1 사주상담 옵션:");
  for (const [id, label] of Object.entries(CONSULT_OPTION_LABELS)) {
    const price = CONSULT_OPTION_PRICES[id as keyof typeof CONSULT_OPTION_PRICES];
    lines.push(`- ${label}: +${formatPrice(price)}`);
  }

  return lines.join("\n");
}

/** 상담 선생님 소개. 상담 가능한 분야를 안내할 때 쓴다. */
export function buildTeacherKnowledge(): string {
  const lines: string[] = ["[1:1 사주상담 선생님]"];

  for (const teacher of TEACHERS) {
    lines.push(`- ${teacher.name} (${teacher.badge}): ${teacher.role} / ${teacher.desc}`);
  }

  return lines.join("\n");
}

/** 자주 묻는 질문 원문. 화면(/faq)과 같은 값이다. */
export function buildFaqKnowledge(): string {
  const lines: string[] = ["[자주 묻는 질문]"];

  for (const faq of FAQS) {
    lines.push(`Q. ${faq.question}`);
    lines.push(`A. ${faq.answer}`);
  }

  return lines.join("\n");
}

/** 공지사항 원문. 화면(/notice)과 같은 값이다. */
export function buildNoticeKnowledge(): string {
  const lines: string[] = ["[공지사항]"];

  for (const notice of NOTICES) {
    lines.push(`- (${notice.date}) ${notice.title}: ${notice.body}`);
  }

  return lines.join("\n");
}

/**
 * 위 조각을 모두 합친 하나의 지식 텍스트.
 * 챗봇 API가 생기면 이 값을 시스템 프롬프트에 그대로 넣는다.
 */
export function buildChatKnowledge(): string {
  return [
    buildChatBoundaries(),
    buildProductKnowledge(),
    buildOptionKnowledge(),
    buildTeacherKnowledge(),
    buildFaqKnowledge(),
    buildNoticeKnowledge(),
  ].join("\n\n");
}
