/**
 * 관리자 문의·이벤트 신청의 처리 여부. 화면과 관리자 API가 같이 쓰는 순수 함수.
 *
 * 처리 여부는 Inquiry.handledAt 하나로만 본다(값이 있으면 처리 완료, 없으면 미처리).
 * 기존 문의에는 값이 없으므로 모두 미처리로 읽힌다. 따로 채우지 않는다.
 *
 * import 경로가 type 전용인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type { Inquiry } from "@/lib/types/app";

export type InquiryHandledFilter = "all" | "pending" | "handled";

export function isInquiryHandled(item: Pick<Inquiry, "handledAt">): boolean {
  return Boolean(item.handledAt);
}

export function matchesInquiryFilter(item: Pick<Inquiry, "handledAt">, filter: InquiryHandledFilter): boolean {
  if (filter === "all") return true;
  return filter === "handled" ? isInquiryHandled(item) : !isInquiryHandled(item);
}

/**
 * id가 같은 문의 1건의 처리 여부를 바꾼다. 없으면 null이고 data는 그대로다. 저장은 호출부가 한다.
 * handled=true면 nowIso(서버 시각)를 기록하고, false면 기록을 지운다.
 */
export function setInquiryHandled(
  data: { inquiries: Inquiry[] },
  id: string,
  handled: boolean,
  nowIso: string,
): Inquiry | null {
  const target = id.trim();
  if (!target) return null;
  const item = data.inquiries.find((row) => row.id === target);
  if (!item) return null;
  if (handled) item.handledAt = nowIso;
  else delete item.handledAt;
  return item;
}
