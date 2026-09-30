/**
 * 관리자 후기 탭에서 쓰는 순수 함수. 화면과 관리자 API가 같이 쓴다.
 *
 * - 상품 종류 이름: 저장된 kind(없으면 제목으로 추정, reviewKindFromSaved와 같은 규칙)
 * - 대상 표시: targetKey("order:<id>" / "consult:<id>")의 종류와 id만. 회원 개인정보는 더하지 않는다.
 * - 삭제: id가 정확히 같은 후기 1건만 뺀다. 다른 후기·주문·상담은 건드리지 않는다.
 *
 * import 경로가 상대경로·type 전용인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import { reviewKindFromSaved, type ReviewKind } from "./constants/reviews.ts";
import type { Review } from "@/lib/types/app";

const KIND_LABELS: Record<ReviewKind, string> = {
  story: "이야기로 만드는 인생곡",
  premium: "프리미엄 인생곡",
  "saju-song": "사주 인생곡",
  consultation: "1:1 사주상담",
};

export function reviewKindLabel(title: string, kind?: string): string {
  return KIND_LABELS[reviewKindFromSaved(title ?? "", kind)];
}

export function reviewTargetLabel(targetKey: string | undefined): string {
  const key = targetKey ?? "";
  if (key.startsWith("order:") && key.length > 6) return `주문 ${key.slice(6)}`;
  if (key.startsWith("consult:") && key.length > 8) return `상담 ${key.slice(8)}`;
  return "대상 기록 없음";
}

/** id가 같은 후기 1건을 data에서 뺀다. 없으면 false이고 data는 그대로다. 저장은 호출부가 한다. */
export function removeReviewById(data: { reviews?: Review[] }, id: string): boolean {
  const target = id.trim();
  if (!target) return false;
  const list = data.reviews ?? [];
  const index = list.findIndex((item) => item.id === target);
  if (index < 0) return false;
  list.splice(index, 1);
  return true;
}
