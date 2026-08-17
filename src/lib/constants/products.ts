export type LifeSongId = "story" | "premium" | "saju-song";

export interface LifeSongProduct {
  id: LifeSongId;
  slug: string;
  title: string;
  shortTitle: string;
  badge?: string;
  description: string;
  priceFrom: number;
  href: string;
  applyHref: string;
  icon: string;
  accent: string;
  heroImage: string;
}

/** 인생곡 탭 안의 3가지 카테고리 */
export const LIFE_SONG_PRODUCTS: LifeSongProduct[] = [
  {
    id: "story",
    slug: "story",
    title: "이야기로 만드는 인생곡",
    shortTitle: "인생곡",
    badge: "이야기로 만드는",
    description: "직접 작성한 이야기를 바탕으로 맞춤 가사와 음악을 제작합니다.",
    priceFrom: 149000,
    href: "/products/story",
    applyHref: "/apply/story-song/1",
    icon: "pencil",
    accent: "#5c3d2e",
    heroImage: "/images/photo-writing.jpg",
  },
  {
    id: "premium",
    slug: "premium",
    title: "프리미엄 인생곡",
    shortTitle: "프리미엄",
    badge: "토탈 맞춤",
    description: "사주상담 → 스토리상담 → 인생곡 → 뮤직비디오까지 한 번에",
    priceFrom: 399000,
    href: "/products/premium",
    applyHref: "/apply/premium/1",
    icon: "crown",
    accent: "#c4a574",
    heroImage: "/images/photo-premium-life.png",
  },
  {
    id: "saju-song",
    slug: "saju-song",
    title: "사주 인생곡",
    shortTitle: "사주 인생곡",
    badge: "상담 없음",
    description: "상담 없이 사주 정보와 이야기로 인생곡을 제작합니다.",
    priceFrom: 199000,
    href: "/products/saju-song",
    applyHref: "/apply/saju-song/1",
    icon: "sparkles",
    accent: "#7c6b9e",
    heroImage: "/images/photo-ohaeng.png",
  },
];

export const CONSULTATION = {
  title: "1:1 사주상담",
  description: "인생곡과 별도로 이용할 수 있는 전문 사주상담 서비스입니다.",
  priceFrom: 100000,
  href: "/consultation",
  applyHref: "/apply/consultation/1",
};

/** @deprecated LIFE_SONG_PRODUCTS 또는 CONSULTATION 사용 */
export const PRODUCTS = LIFE_SONG_PRODUCTS;

export function formatPrice(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function formatPriceFrom(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원~`;
}
