export type ReviewKind = "story" | "premium" | "saju-song" | "consultation";

export interface Review {
  id: string;
  kind: ReviewKind;
  name: string;
  rating: number;
  text: string;
}

export const SONG_REVIEWS: Review[] = [
  {
    id: "story-1",
    kind: "story",
    name: "김○○ 님",
    rating: 5,
    text: "어머니 생신에 노래를 선물했어요. 이야기를 적었을 뿐인데, 그 마음이 그대로 노래가 되었습니다.",
  },
  {
    id: "story-2",
    kind: "story",
    name: "이○○ 님",
    rating: 5,
    text: "남편과 함께한 날을 노래로 남겼습니다. 가족이 함께 들으며 오래 간직하고 있습니다.",
  },
  {
    id: "premium-1",
    kind: "premium",
    name: "박○○ 님",
    rating: 5,
    text: "상담부터 노래, 영상까지 한 번에 진행되어 마음이 놓였습니다. 선물로 드리기에도 좋았습니다.",
  },
  {
    id: "premium-2",
    kind: "premium",
    name: "최○○ 님",
    rating: 5,
    text: "제 이야기를 천천히 들어 주시고, 그 흐름이 노래에 담겼습니다. 혼자 결정하기 어려울 때 도움이 되었습니다.",
  },
  {
    id: "saju-1",
    kind: "saju-song",
    name: "정○○ 님",
    rating: 5,
    text: "상담 없이 사주와 이야기만 남겼는데도, 지금 저에게 필요한 말이 노래에 있었습니다.",
  },
  {
    id: "saju-2",
    kind: "saju-song",
    name: "한○○ 님",
    rating: 5,
    text: "바쁠 때 간단히 신청할 수 있어 좋았습니다. 완성된 노래를 들으니 마음이 한결 가벼워졌습니다.",
  },
];

export const CONSULT_REVIEWS: Review[] = [
  {
    id: "consult-1",
    kind: "consultation",
    name: "윤○○ 님",
    rating: 5,
    text: "유비 선생이 편하게 이끌어 주셨어요. 진로가 막막했는데, 지금의 흐름을 이해하게 되었습니다.",
  },
  {
    id: "consult-2",
    kind: "consultation",
    name: "송○○ 님",
    rating: 5,
    text: "전화로 50분 동안 차근차근 이야기했습니다. 혼자 고민하던 마음을 나누니 방향이 보였습니다.",
  },
  {
    id: "consult-3",
    kind: "consultation",
    name: "오○○ 님",
    rating: 5,
    text: "가족 일로 상담받았습니다. 상대를 탓하지 않고, 관계를 살펴 주셔서 마음이 놓였습니다.",
  },
];

export function reviewsForProduct(slug: string): Review[] {
  return SONG_REVIEWS.filter((item) => item.kind === slug);
}
