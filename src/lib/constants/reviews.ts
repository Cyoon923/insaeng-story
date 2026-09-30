export type ReviewKind = "story" | "premium" | "saju-song" | "consultation";

export interface Review {
  id: string;
  kind: ReviewKind;
  name: string;
  rating: number;
  text: string;
  /** 신청 자격 검증을 거쳐 남긴 후기인지. 대상 정보(targetKey)가 있는 경우만 true. */
  verified: boolean;
}

/**
 * 공개 화면에 쓰는 이름 마스킹. 저장된 원본 이름은 그대로 두고 표시할 때만 가린다.
 * 김채영 → 김*영 / 김영 → 김* / 홍 → *
 */
export function maskName(name: string): string {
  const value = name.trim();
  if (!value) return "";
  const chars = [...value];
  if (chars.length === 1) return "*";
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

/**
 * 공개 후기 집계. 후기가 없으면 null을 돌려주고, 화면에서는 아무것도 표시하지 않는다.
 * 평균은 소수점 첫째 자리까지.
 */
export function summarizeReviews(reviews: { rating: number }[]): { count: number; average: number } | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, item) => sum + item.rating, 0);
  return { count: reviews.length, average: Math.round((total / reviews.length) * 10) / 10 };
}

export function reviewKindFromSaved(title: string, kind?: string): ReviewKind {
  if (kind === "story" || kind === "premium" || kind === "saju-song" || kind === "consultation") {
    return kind;
  }
  if (title.includes("프리미엄")) return "premium";
  if (title.includes("사주 인생곡")) return "saju-song";
  if (title.includes("사주상담")) return "consultation";
  return "story";
}

/**
 * 화면에 보여 줄 후기. 관리자가 공개한 실제 후기만 사용하며,
 * 후기가 없으면 빈 배열을 돌려준다. 샘플 후기로 대체하지 않는다.
 */
export function displayReviewsForProduct(
  slug: string,
  published: {
    id: string;
    name: string;
    rating: number;
    text: string;
    kind?: string;
    title?: string;
    verified?: boolean;
  }[],
): Review[] {
  return published
    .filter((item) => reviewKindFromSaved(item.title ?? "", item.kind) === slug)
    .map((item) => ({
      id: item.id,
      kind: slug as ReviewKind,
      name: item.name,
      rating: item.rating,
      text: item.text,
      verified: Boolean(item.verified),
    }));
}

/** 공개 후기 목록·홈에서 쓰는 상품 종류 짧은 이름. */
export const REVIEW_KIND_LABELS: Record<ReviewKind, string> = {
  story: "이야기 인생곡",
  premium: "프리미엄 인생곡",
  "saju-song": "사주 인생곡",
  consultation: "1:1 사주상담",
};

/** 주소의 ?kind= 값. 네 가지 상품 종류만 받고, 그 밖의 값이나 빈 값은 null(= 전체)이다. */
export function reviewKindFromQuery(value: string | null | undefined): ReviewKind | null {
  return value === "story" || value === "premium" || value === "saju-song" || value === "consultation"
    ? value
    : null;
}

/**
 * 홈 후기 섹션에 보여 줄 값. 공개 후기는 서버가 최신순으로 준다(createReview가 앞에 추가).
 * 최신 limit개와 전체 공개 후기의 평균·개수를 돌려준다. 후기가 없으면 null(섹션을 숨긴다).
 */
export function pickHomeReviews<T extends { rating: number }>(
  published: T[],
  limit = 3,
): { items: T[]; summary: { count: number; average: number } } | null {
  const summary = summarizeReviews(published);
  if (!summary) return null;
  return { items: published.slice(0, limit), summary };
}
