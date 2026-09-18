/**
 * 콘텐츠성 개인정보 보관 만료 판정 (Privacy-Retention-Eligibility-1).
 *
 * 묻는 것은 하나다. "이 건의 콘텐츠성 개인정보를 지금 지워도 되는가."
 * 판정만 한다. **아무것도 지우지 않고, 저장하지도, 시각을 만들지도 않는다.**
 *
 * 정책: 서비스 완료 후 1년. 기산점은 완료 증빙뿐이다.
 *   · 인생곡(story / saju-song / premium) : Order.deliveredAt
 *   · 1:1 사주상담                        : Consultation.completedAt
 *
 * serviceCompletion.ts와 섞지 않는다. 저쪽은 "언제 끝났는가"를 **기록**하는 규칙이고,
 * 이쪽은 그 기록을 읽어 "지워도 되는가"를 **판정**한다. 뜻이 다르고 바뀌는 이유도 다르다.
 *
 * 한쪽으로 치우쳐 있다(fail-closed). 판정하지 못하면 지우지 않는다.
 * 지우지 못해 사람이 한 번 더 보는 것은 되돌릴 수 있지만, 지운 개인정보는 되돌릴 수 없다.
 *
 * 현재 시각을 함수 안에서 만들지 않고 인자로 받는다. 시각에 따라 답이 달라지는 판정이라
 * 경계를 테스트로 고정할 수 있어야 하기 때문이다(Date.now()를 숨기지 않는다).
 *
 * status는 보지 않는다. "완료"·"완성/전달"·"상담 완료"로 저장되어 있어도 증빙이 없으면
 * 대상이 아니다. createdAt·updatedAt·productionStartedAt·scheduledAt으로 추정하지도 않는다
 * (전부 다른 뜻의 시각이다).
 */
import type { Consultation, Order } from "@/lib/types/app";

/** 보관 기간. 달력 기준 1년이며 이 파일 밖에서 바꾸지 않는다. */
export const RETENTION_YEARS = 1;

export type RetentionEligibility =
  /** 완료 증빙으로부터 보관 기간이 지났다. 지워도 되는 상태다. */
  | { kind: "eligible"; evidenceAt: string; eligibleAt: string }
  /** 아직 보관 기간 중이다. 언제부터 대상이 되는지 함께 알려 준다. */
  | { kind: "not-yet"; evidenceAt: string; eligibleAt: string }
  /** 완료 증빙이 없다. 이 구조가 생기기 전의 건이 여기 해당한다. */
  | { kind: "missing-evidence" }
  /** 증빙은 있으나 시각으로 읽을 수 없다. */
  | { kind: "invalid-evidence" }
  /** 넘어온 현재 시각을 읽을 수 없다. 아무것도 판정하지 않는다. */
  | { kind: "invalid-now" };

/**
 * ISO 8601 날짜·시각. 서버가 남기는 값(new Date().toISOString())의 형태다.
 *
 * Date.parse는 "0000"이나 "Dec 2026" 같은 느슨한 문자열도 받아들인다. 삭제 여부를
 * 가르는 판정이라 그런 값을 시각으로 인정하지 않는다. 날짜와 시각이 모두 갖춰진
 * 형태만 통과시키고, 나머지는 읽을 수 없는 값으로 본다(fail-closed).
 */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** 시각으로 읽히는 값인지. 빈 값·공백·느슨한 문자열은 받지 않는다. */
function parseTime(value: string): number | null {
  const trimmed = value.trim();
  if (!ISO_DATE_TIME.test(trimmed)) return null;
  const parsed = Date.parse(trimmed);
  // 형태가 맞아도 2026-13-45처럼 존재하지 않는 날짜는 NaN이 된다.
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 증빙 시각으로부터 보관 기간이 끝나는 시각.
 *
 * 달력 기준으로 연도에 1을 더한다(86400초 × 365 같은 고정 길이를 쓰지 않는다.
 * 윤년이 끼면 하루가 어긋나기 때문이다).
 *
 * 다음 해에 같은 월·일이 있으면 그대로 쓴다. 없으면 그 달의 마지막 날로 맞춘다.
 * 2월 29일이 여기 해당한다.
 *
 *   2024-02-29T10:00:00Z → 2025-02-28T10:00:00Z
 *
 * 3월 1일로 넘기지 않는다. 넘기면 만료일이 증빙한 달을 벗어나 다음 달이 되는데,
 * "2월에 끝난 건"의 만료가 3월로 읽히는 쪽이 하루 차이보다 더 헷갈린다.
 * 시·분·초는 그대로 둔다. 만료는 그 날 0시가 아니라 증빙과 같은 시각이다.
 */
export function retentionEligibleAt(evidenceAt: string): string | null {
  const parsed = parseTime(evidenceAt);
  if (parsed === null) return null;
  const at = new Date(parsed);
  const year = at.getUTCFullYear() + RETENTION_YEARS;
  const month = at.getUTCMonth();
  // 다음 해 같은 달의 마지막 날. 다음 달 0일이 이번 달 말일이다.
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(at.getUTCDate(), lastDayOfMonth);
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      at.getUTCHours(),
      at.getUTCMinutes(),
      at.getUTCSeconds(),
      at.getUTCMilliseconds(),
    ),
  ).toISOString();
}

/**
 * 완료 증빙 1건을 보고 지워도 되는지 판정한다.
 *
 * 경계는 고객에게 불리하지 않은 쪽으로 정한다. 정확히 만료 시각에 도달한 순간부터
 * eligible이다(>=). 그 이전은 not-yet이다.
 *
 * 증빙이 미래 시각이면 만료 시각도 미래라 자연히 not-yet이 된다. 따로 막지 않는다.
 */
export function decideRetentionEligibility(
  evidenceAt: string | null | undefined,
  now: string,
): RetentionEligibility {
  // 현재 시각을 읽지 못하면 아무것도 판정하지 않는다(fail-closed).
  const nowMs = parseTime(now);
  if (nowMs === null) return { kind: "invalid-now" };

  // 키가 없거나 비어 있으면 "기록 없음"이다. status로 대신 판단하지 않는다.
  if (evidenceAt === null || evidenceAt === undefined || evidenceAt.trim() === "") {
    return { kind: "missing-evidence" };
  }

  const eligibleAt = retentionEligibleAt(evidenceAt);
  if (eligibleAt === null) return { kind: "invalid-evidence" };

  const evidenceIso = new Date(parseTime(evidenceAt) as number).toISOString();
  if (nowMs >= Date.parse(eligibleAt)) {
    return { kind: "eligible", evidenceAt: evidenceIso, eligibleAt };
  }
  return { kind: "not-yet", evidenceAt: evidenceIso, eligibleAt };
}

/**
 * 인생곡 주문(story / saju-song / premium)의 판정.
 *
 * 기산점은 deliveredAt 하나뿐이다. 상품 종류를 가리지 않는다(세 상품이 같은 규칙이다).
 * 상담도 결제 귀속 주문이 함께 만들어지지만, 상담의 기산점은 Consultation.completedAt이라
 * 그쪽은 아래 함수로 판정한다.
 */
export function decideOrderRetention(order: Order, now: string): RetentionEligibility {
  return decideRetentionEligibility(order.deliveredAt, now);
}

/** 1:1 사주상담의 판정. 기산점은 completedAt 하나뿐이다. */
export function decideConsultationRetention(
  consultation: Consultation,
  now: string,
): RetentionEligibility {
  return decideRetentionEligibility(consultation.completedAt, now);
}
