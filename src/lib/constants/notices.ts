import { COPYRIGHT_NOTICE_TEXT } from "@/lib/constants/legal";

/**
 * 공지사항. /notice 화면과 챗봇 안내가 같은 값을 본다.
 * 내용을 고치면 두 곳에 함께 반영된다.
 */
export interface NoticeItem {
  date: string;
  title: string;
  body: string;
}

export const NOTICES: NoticeItem[] = [
  {
    date: "2026.08.15",
    title: "인생곡 이용 및 저작권 안내",
    body: COPYRIGHT_NOTICE_TEXT,
  },
  {
    date: "2026.08.15",
    title: "1:1 사주상담 진행 안내",
    body: "상담은 카카오톡 또는 전화로 약 50분 진행합니다. 화상 상담은 하지 않습니다. 기본 가격은 100,000원부터입니다.",
  },
  {
    date: "2026.08.15",
    title: "제작 기간 안내",
    body: "이야기로 만드는 인생곡은 결제 후 평균 7~10일, 사주 인생곡은 평균 5~7일, 프리미엄 인생곡은 상담 완료 후 평균 10~14일 정도 소요됩니다.",
  },
];
