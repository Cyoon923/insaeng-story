/**
 * 보관 만료 건의 콘텐츠성 개인정보 제거 (Privacy-Retention-Scrub-1).
 *
 * 하는 일은 하나다. "이 주문·상담 1건에서 무엇이 남고 무엇이 빠지는가"를 정한
 * **새 객체를 만들어 돌려준다**. 아무것도 저장하지 않고, 지우지 않고, 시각도 만들지 않는다.
 * 실제 반영(DB update)·대상 선정(cron)·삭제 실행은 이 파일에 없다.
 *
 * 지워도 되는 건인지는 여기서 묻지 않는다. 그 판정은 retentionEligibility.ts가 한다.
 * 저쪽은 "지워도 되는가"를 판정하고, 이쪽은 "지우면 무엇이 남는가"를 만든다.
 * 뜻이 다르고 바뀌는 이유도 달라 한 파일에 두지 않는다.
 *
 * ── 탈퇴(withdrawAccount.ts)와 같은 목록을 쓰지 않는 이유 ──
 *
 * 탈퇴한 회원은 로그인 자체가 막혀(isActiveUser) MY 화면을 볼 수 없다. 보관 만료는
 * 다르다. 회원은 그대로 살아 있고 MY 목록·상세를 계속 본다. 그래서 "남겨도 보이지
 * 않는 값"과 "지우면 화면에서 사라지는 값"의 뜻이 두 경우에 다르다.
 * 또 탈퇴는 회원 1명의 모든 건을 한 번에 다루지만, 보관 만료는 건 1개씩 다룬다.
 *
 * 두 목록은 겹치는 키가 많지만 같은 값이 아니다. 한쪽을 고치면 다른 쪽이 따라
 * 바뀌는 구조를 만들지 않으려고 KEPT_DETAIL_KEYS를 import하지 않고 따로 적는다.
 * (탈퇴 목록에 없는 subject·scheduledDate가 여기에는 있고, 탈퇴가 남기는
 *  purpose는 여기서 빠진다.)
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type { Consultation, Order } from "@/lib/types/app";

/**
 * 보관 만료 뒤에도 details에 남기는 키. 여기 없는 키는 전부 빠진다.
 *
 * allowlist인 이유는 details가 Record<string, string>이고 신청 화면의 draft가
 * 통째로 들어오기 때문이다(components/apply/PaySubmit.tsx). 클라이언트가 임의 키를
 * 섞을 수 있는 자리라, 지울 키를 나열하는 방식이면 입력칸이 하나 늘 때마다
 * 개인정보가 새어 남는다. 모르는 키는 남기지 않고 버린다.
 *
 * 남기는 값은 거래·정산 구조정보뿐이다. 이름·연락처·사주정보·사연·상담 내용·
 * 상대방 정보는 여기에 없다.
 */
export const RETENTION_KEPT_DETAIL_KEYS = [
  // 어떤 상품을 어떤 구성으로 팔았는지. self/parents 같은 코드값이라 식별력이 없다.
  "protagonistId",
  "subject",
  // 상담 일정·구성.
  "teacher",
  "datetime",
  "scheduledDate",
  "method",
  "option",
  // 상품가·옵션가 구성.
  "optionIds",
  "options",
  "videoStyle",
  "report",
  "extraPerson",
  // 할인 근거.
  "couponId",
  "couponTitle",
  "couponFree",
  "referralCode",
  "referralDiscount",
  "referralType",
  "referralPercent",
  "usePoints",
  "pointsUsed",
] as const;

const RETENTION_KEPT_DETAIL_KEY_SET = new Set<string>(RETENTION_KEPT_DETAIL_KEYS);

/** 보관 만료 뒤에 남기는 키인지. */
export function isRetentionKeptDetailKey(key: string): boolean {
  return RETENTION_KEPT_DETAIL_KEY_SET.has(key);
}

/**
 * details에서 보존 키만 남긴 **새 객체**를 돌려준다. 인자는 바꾸지 않는다.
 *
 * 값이 없는 키는 애초에 담기지 않으므로 빈 객체가 될 수 있다.
 * details 자체가 없는 예전 자료(undefined·null)도 빈 객체로 다룬다. 이 단계에서
 * 판정이 멈추면 개인정보가 남은 채로 지나가므로 읽지 못한 값을 예외로 만들지 않는다.
 */
export function pickRetentionDetails(
  details: Record<string, string> | null | undefined,
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    if (RETENTION_KEPT_DETAIL_KEY_SET.has(key)) kept[key] = value;
  }
  return kept;
}

/**
 * 인생곡 주문 1건의 보관 만료 결과.
 *
 * 바꾸는 것은 details뿐이다. id·userId·product·title·status·amount·baseAmount·
 * payment·createdAt과 완료 증빙(productionStartedAt·deliveredAt), 신청 동의
 * 증빙(refundConsent·copyrightConsent)은 그대로 둔다.
 * 거래가 있었다는 사실과 그 근거는 남는다.
 *
 * 원본을 바꾸지 않고 새 객체를 돌려준다. 호출부가 원본과 결과를 비교할 수 있어야
 * "무엇이 빠지는지" 확인한 뒤에 반영할 수 있기 때문이다.
 */
export function scrubOrderForRetention(order: Order): Order {
  return { ...order, details: pickRetentionDetails(order.details) };
}

/**
 * 1:1 사주상담 1건의 보관 만료 결과.
 *
 * details는 주문과 같은 목록으로 정리하고, 본체에서는 purpose만 뺀다.
 * purpose는 "이 사람이 어떤 고민으로 상담했는가"라 상담 일정·구성과 성격이 다르다.
 *
 * 빈 문자열이나 "삭제됨" 같은 값을 넣지 않는다. 그런 값은 "목적을 적지 않고 신청한
 * 상담"과 구분되지 않아, 나중에 보는 쪽이 없는 기록을 있는 것처럼 읽게 된다.
 * 키 자체를 만들지 않아 "기록 없음"으로 남긴다(Consultation.purpose는 그래서 선택 항목이다).
 *
 * teacher·datetime·scheduledAt·method·option·status·amount·id·userId·createdAt과
 * 완료 증빙 completedAt은 그대로 둔다.
 */
export function scrubConsultationForRetention(consultation: Consultation): Consultation {
  // purpose만 빼고 나머지를 그대로 옮긴다. 원본은 바뀌지 않는다.
  const { purpose: _removed, ...rest } = consultation;
  void _removed;
  return { ...rest, details: pickRetentionDetails(consultation.details) };
}

/**
 * 결제 스냅샷에서 신청 내용 사본(order_snapshot.details)만 뺀 **새 객체**.
 *
 * 이 단계에서는 어떤 Payment도 바꾸지 않는다. 앞으로 실제 반영을 만들 때 쓸 수
 * 있도록 "무엇이 남는가"만 순수 함수로 고정해 둔다.
 *
 * details를 빼도 거래증빙은 잃지 않는다. 금액 재계산 입력(request)·할인 판단
 * 근거(discount)·귀속(userId)·기본가·최종가가 모두 따로 담겨 있고, 승인 재검증
 * 경로는 처음부터 details를 읽지 않는다(api/payments/nicepay/return, admin/payments/recommit).
 * details는 Order/Consultation.details에 확정본이 있는 중복 사본이다.
 *
 * 스냅샷이 없으면(null·객체가 아님) null을 돌려준다. 빈 객체를 지어내지 않는다.
 */
export function stripPaymentSnapshotDetails(
  snapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const { details: _removed, ...rest } = snapshot;
  void _removed;
  return rest;
}
