/**
 * 보관 만료 정리 **후보** 찾기 (Privacy-Retention-Discovery-1).
 *
 * 하는 일은 하나다. "지금 살펴볼 만한 건이 무엇인가"를 골라 id만 돌려준다.
 * 저장하지 않고, 지우지 않고, 받은 값을 바꾸지도 않는다.
 *
 * ── 후보는 허가가 아니다 ──
 *
 * 여기서 나온 것은 **후보**일 뿐이다. "지워도 된다"는 결론이 아니다.
 * 이 목록을 읽은 순간과 실제로 지우는 순간 사이에 무엇이든 달라질 수 있다.
 * 상담이 다시 열릴 수도, 짝이 되는 주문이 생길 수도, 다른 요청이 먼저 정리할 수도 있다.
 *
 * 그래서 실행 경로(scrubOrderForRetentionWithRetry /
 * scrubOrphanConsultationForRetentionWithRetry)는 이 목록을 믿지 않는다.
 * 회차마다 최신 자료를 다시 읽어 판정부터 다시 한다. 이 목록만 보고 지울 수 있는
 * 구조를 만들지 않는다. 돌려주는 값에 id 말고 아무것도 담지 않는 이유도 같다.
 * 판단에 쓸 재료를 주면 그 재료로 판단하려는 코드가 생긴다.
 *
 * ── 날짜 규칙을 새로 만들지 않는다 ──
 *
 * 무엇이 만료되었는지는 언제나 decideRetentionEligibility 한 곳이 정한다.
 * 여기서는 "어떤 값을 그 함수에 넣을 것인가"만 고른다.
 * SQL은 넓게 추리기만 하고, 뜻은 전부 이 파일과 그 판정 함수에서 정해진다.
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import { decideRetentionEligibility } from "./retentionEligibility.ts";
import type { Consultation, OrderProduct } from "@/lib/types/app";

/** 정리 대상이 될 수 있는 상품. 이 넷 밖의 값은 후보로 보지 않는다. */
const RETENTION_PRODUCTS: readonly OrderProduct[] = [
  "story",
  "saju-song",
  "premium",
  "consultation",
];

/**
 * 후보 1건.
 *
 * id만 담는다. 이름·연락처·사주·사연·상담 내용은 물론 userId도 담지 않는다.
 * 후보 목록은 "누구의 무엇"이 아니라 "어느 건"을 가리키는 값이다.
 */
export type RetentionCandidate =
  | { kind: "order"; id: string }
  | { kind: "orphan-consultation"; id: string };

/**
 * 후보를 고르는 데 필요한 주문 1행.
 *
 * 저장소에서 읽은 값 중 판정에 쓰는 것만 담는다. details는 담지 않는다
 * (후보를 고르는 데 필요 없고, 담으면 개인정보가 이 계층까지 올라온다).
 */
export interface DiscoveryOrderRow {
  id: string;
  product: OrderProduct;
  /** 인생곡의 기산점. 없으면 "기록 없음"이다. */
  deliveredAt?: string | null;
  /** 이미 정리가 끝났으면 값이 있다. 날짜 판정에는 절대 쓰지 않는다. */
  retentionScrubbedAt?: string | null;
}

/**
 * 후보를 고르는 데 필요한 저장소 상태.
 *
 * 저장소를 직접 부르지 않고 넘겨받는다. DB 없이 이 규칙을 확인할 수 있어야 하고,
 * 실제 저장소를 아는 쪽은 store.ts 하나로 두기 위해서다.
 */
export interface RetentionDiscoveryInput {
  /** 아직 정리하지 않은 주문 행. SQL이 넓게 추려 온 것을 그대로 받는다. */
  orders: readonly DiscoveryOrderRow[];
  /** app_store에 있는 모든 주문 id. 짝 확인에 쓴다. */
  appStoreOrderIds: ReadonlySet<string>;
  /** app_store의 상담 전체. 상담의 기산점은 여기에만 있다. */
  consultations: readonly Consultation[];
  /**
   * orders 테이블에 있는 주문 id 전부.
   *
   * null은 "확인하지 못했음"이다. 그때는 짝이 없다고 단정하지 않고 orphan 후보를
   * 하나도 내지 않는다(fail-closed). DB가 없는 환경에서는 테이블 자체가 없으므로
   * 빈 집합을 넘긴다(확인했고 없었다는 뜻이다).
   */
  sqlOrderIds: ReadonlySet<string> | null;
}

/** 값이 실제로 들어 있는 문자열인지. 빈 값·공백은 "기록 없음"으로 본다. */
function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * 지금 살펴볼 만한 건을 고른다. 읽기만 한다.
 *
 * 주문 후보
 *   · 정리 대상 상품이어야 한다.
 *   · 아직 정리하지 않았어야 한다(retentionScrubbedAt 없음).
 *   · 인생곡은 deliveredAt, 상담 주문은 **같은 id 상담의 completedAt**이 기산점이다.
 *     상담 주문의 delivered_at으로 판정하지 않는다. 뜻이 다른 시각이다.
 *     짝이 되는 상담을 찾지 못하면 후보로 내지 않는다(기산점을 읽을 수 없다).
 *
 * orphan 상담 후보
 *   · 아직 정리하지 않았어야 한다.
 *   · 짝이 되는 주문이 app_store에도 orders 테이블에도 없어야 한다.
 *   · completedAt이 기산점이다.
 *
 * 어느 쪽도 createdAt·updatedAt·status·productionStartedAt·scheduledAt·datetime으로
 * 추정하지 않는다. retentionScrubbedAt도 날짜 판정에 쓰지 않는다(정리한 시각이지
 * 서비스가 끝난 시각이 아니다).
 *
 * now는 서버가 만든 시각을 받는다. 시각에 따라 답이 달라지는 판정이라 함수 안에서
 * 만들지 않는다.
 */
export function findRetentionCandidates(
  input: RetentionDiscoveryInput,
  now: string,
): RetentionCandidate[] {
  const candidates: RetentionCandidate[] = [];
  // 같은 건이 두 번 들어가지 않게 한다(같은 id 행이 겹쳐 와도 한 번만 센다).
  const taken = new Set<string>();

  const consultationById = new Map<string, Consultation>();
  for (const item of input.consultations) consultationById.set(item.id, item);

  /* ── 주문 후보 ── */
  for (const row of input.orders) {
    const id = String(row.id ?? "").trim();
    if (!id || taken.has(`order:${id}`)) continue;
    if (!RETENTION_PRODUCTS.includes(row.product)) continue;
    // 이미 끝난 건은 다시 세지 않는다. 이 값 자체는 날짜 판정에 쓰지 않는다.
    if (hasText(row.retentionScrubbedAt)) continue;

    let evidence: string | null | undefined;
    if (row.product === "consultation") {
      const paired = consultationById.get(id);
      // 짝 상담이 없으면 기산점을 읽을 수 없다. 주문의 deliveredAt으로 대신하지 않는다.
      if (!paired) continue;
      evidence = paired.completedAt;
    } else {
      evidence = row.deliveredAt;
    }

    if (decideRetentionEligibility(evidence, now).kind !== "eligible") continue;
    taken.add(`order:${id}`);
    candidates.push({ kind: "order", id });
  }

  /* ── orphan 상담 후보 ── */
  for (const item of input.consultations) {
    const id = String(item.id ?? "").trim();
    if (!id || taken.has(`orphan-consultation:${id}`)) continue;
    if (hasText(item.retentionScrubbedAt)) continue;

    // 짝이 하나라도 있으면 orphan이 아니다. 주문이 있는 상담은 주문 경로가 다룬다.
    if (input.appStoreOrderIds.has(id)) continue;
    // 확인하지 못했으면 없다고 단정하지 않는다.
    if (input.sqlOrderIds === null || input.sqlOrderIds.has(id)) continue;

    if (decideRetentionEligibility(item.completedAt, now).kind !== "eligible") continue;
    taken.add(`orphan-consultation:${id}`);
    candidates.push({ kind: "orphan-consultation", id });
  }

  return candidates;
}
