/**
 * 회원 동의 증빙(User.consents)을 만드는 순수 함수 모음.
 *
 * 일반 가입(signupComplete)과 소셜 신규가입(completeSocialLink)이
 * 같은 구조로 동의를 남기도록, 레코드 생성 규칙을 이 파일 한곳에 둔다.
 *
 * 규칙
 * - 버전은 언제나 lib/constants/legal.ts의 상수에서 읽는다.
 *   클라이언트가 보낸 version은 받지도, 저장하지도 않는다.
 * - 동의 시각은 서버가 만든다.
 * - 기존 회원의 consents를 만들어 주지 않는다. 이 파일의 함수는
 *   "지금 실제로 동의 행위가 있었다"는 호출부에서만 부른다.
 *
 * 회원 동의는 일반 가입(signupComplete)과 소셜 신규가입(completeSocialLink)
 * 두 곳이 모두 buildRequiredConsents를 부른다.
 * 신청 동의(buildOrderConsent / buildCopyrightConsent)는 applyOrder.ts의
 * commitOrder·commitConsultation에서만 부른다.
 *
 * 버전 상수만 상대경로로 가져온다. 다른 순수 모듈들과 같은 이유다
 * (Node 내장 테스트 러너로 이 파일을 직접 실행하기 위해서다).
 *
 * 호출부는 buildRequiredConsents로 저장하기 직전에 반드시
 * areLegalVersionsConfirmed()를 확인해야 한다. 버전이 확정되기 전에 저장하면
 * 자리표시자 값이 증빙에 남는다.
 */
import {
  ORDER_CONSENT_VERSION,
  SIGNUP_PRIVACY_VERSION,
  TERMS_VERSION,
} from "../constants/legal.ts";
import type {
  ConsentEvent,
  ConsentEventType,
  ConsentRecord,
  UserConsents,
} from "@/lib/types/app";

/** 필수 동의 검증 결과. 실패하면 error를 그대로 사용자에게 보여줄 수 있다. */
export type RequiredConsentCheck = { ok: true } | { ok: false; error: string };

/**
 * 가입 요청이 필수 약관 2종에 동의했는지 확인한다.
 *
 * 값이 정확히 true일 때만 통과시킨다. "1", "true" 같은 문자열이나
 * 값이 없는 경우는 모두 미동의로 본다. 동의는 넉넉하게 해석하지 않는다.
 */
export function checkRequiredConsents(body: Record<string, unknown>): RequiredConsentCheck {
  if (body.termsAgreed !== true || body.privacyAgreed !== true) {
    return { ok: false, error: "필수 약관에 동의해 주세요." };
  }
  return { ok: true };
}

/**
 * 가입 시점의 필수 동의 2종을 만든다.
 *
 * 호출 전에 checkRequiredConsents가 통과했어야 한다. 그래서 여기서는
 * agreed: false인 필수 레코드를 만들지 않는다. 회원이 만들어졌다는 것은
 * 곧 필수 약관에 동의했다는 뜻이 된다.
 *
 * 선택(마케팅) 항목은 만들지 않는다. 키가 없는 상태가 "묻지 않았음"이고,
 * 마케팅 동의는 채널별로 따로 다루기 때문이다.
 *
 * 현재 상태(terms·privacy)와 행위 기록(history)을 **여기 한 곳에서 함께** 만든다.
 * 두 곳에서 따로 만들면 시각이나 버전이 갈라질 수 있다. 같은 now 하나와 같은
 * 상수에서 둘 다 나오므로 어긋날 자리가 없다.
 */
export function buildRequiredConsents(now = new Date().toISOString()): UserConsents {
  // 이용약관(/terms)
  const terms: ConsentRecord = { agreed: true, agreedAt: now, version: TERMS_VERSION };
  // 회원가입 개인정보 수집 및 이용 동의(/privacy/collection).
  // 공개 처리방침(/privacy)이 아니라 가입 시 동의받는 문서의 버전을 남긴다.
  const privacy: ConsentRecord = {
    agreed: true,
    agreedAt: now,
    version: SIGNUP_PRIVACY_VERSION,
  };
  return {
    terms,
    privacy,
    // 최초 동의도 행위 하나다. 나중 재동의와 같은 모양으로 남긴다.
    history: [toConsentEvent("terms", terms), toConsentEvent("privacy", privacy)],
  };
}

/**
 * 현재 상태 레코드를 같은 값의 행위 기록으로 옮긴다.
 *
 * 시각·버전을 여기서 새로 만들지 않는다. 받은 레코드의 값을 그대로 쓰므로
 * 현재 상태와 기록이 반드시 같은 순간·같은 버전을 가리킨다.
 * agreedAt이 없는 레코드는 시각을 지어내지 않고 넘기지 않는다(호출부가 보장한다).
 */
function toConsentEvent(type: ConsentEventType, record: ConsentRecord): ConsentEvent {
  return {
    type,
    agreed: record.agreed,
    occurredAt: record.agreedAt ?? "",
    version: record.version,
  };
}

/**
 * 행위 기록을 뒤에 붙인 **새 배열**을 만든다. 인자는 바꾸지 않는다.
 *
 * 이 함수가 하는 일은 둘뿐이다. 뒤에 붙이거나, 붙이지 않거나.
 * 이미 있는 원소를 고치거나 지우거나 순서를 바꾸지 않는다(append-only).
 *
 * 같은 답을 다시 적지 않는다
 * - 같은 type의 **마지막** 기록이 version도 agreed도 같으면 붙이지 않는다.
 *   같은 문구에 같은 답을 다시 낸 것은 새 사실이 아니다.
 * - 마지막 것만 본다. 배열 전체에서 같은 값을 찾지 않는다. 그렇게 하면
 *   철회한 뒤 같은 버전에 다시 동의한 사실이 기록되지 않는다.
 * - 다른 type의 기록은 사이에 몇 개가 끼어 있어도 판정에 영향을 주지 않는다.
 *
 * history가 없는 회원(이 구조가 생기기 전)에게도 그대로 쓸 수 있다.
 * 없던 배열을 새로 만들 뿐, 기존 terms·privacy 레코드를 옮겨 오지 않는다.
 */
export function appendConsentEvent(
  history: readonly ConsentEvent[] | undefined,
  event: ConsentEvent,
): ConsentEvent[] {
  const next = Array.isArray(history) ? [...history] : [];
  const last = lastEventOfType(next, event.type);
  if (last && last.version === event.version && last.agreed === event.agreed) {
    return next;
  }
  next.push(event);
  return next;
}

/** 그 종류의 마지막 기록. 없으면 null이다. */
export function lastEventOfType(
  history: readonly ConsentEvent[] | undefined,
  type: ConsentEventType,
): ConsentEvent | null {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.type === type) return history[i];
  }
  return null;
}

/**
 * 신청(주문·상담) 1건의 [필수] 동의가 들어왔는지 확인한다.
 *
 * 회원가입 동의와 같은 엄격함을 쓴다. 값이 정확히 true일 때만 통과시키고
 * "1", "true" 같은 문자열은 미동의로 본다.
 *
 * 화면이 보내는 값은 boolean 하나뿐이다. 동의 시각과 버전은 서버가 채운다.
 */
export function checkOrderConsent(agreed: unknown): RequiredConsentCheck {
  if (agreed !== true) {
    return { ok: false, error: "취소·환불 안내에 동의해 주세요." };
  }
  return { ok: true };
}

/**
 * 인생곡 신청 1건의 [필수] 저작권·창작물 이용 동의가 들어왔는지 확인한다.
 *
 * checkOrderConsent와 같은 엄격함을 쓰되 **축이 다르다**. 화면에 체크박스가
 * 둘이고 따로 눌리므로, 한쪽 동의로 다른 쪽을 대신 통과시키지 않는다.
 *
 * 1:1 사주상담에는 이 동의 화면이 없어 이 함수를 부르지 않는다.
 */
export function checkCopyrightConsent(agreed: unknown): RequiredConsentCheck {
  if (agreed !== true) {
    return { ok: false, error: "저작권 및 창작물 이용 안내에 동의해 주세요." };
  }
  return { ok: true };
}

/**
 * 신청 1건의 동의 증빙을 만든다. 호출 전에 checkOrderConsent가 통과했어야 한다.
 *
 * 시각은 **서버가 그 동의를 최초로 검증한 시각**이며 호출부가 넘긴다.
 * 0원 신청은 검증과 이 호출이 같은 요청 안에 있어 그 자리의 시각이고,
 * 카드결제는 preparePayment가 검증 직후 만든 시각이 승인 경로까지 운반된다.
 * 클라이언트가 보낸 agreedAt이나 version은 받지도, 저장하지도 않는다.
 *
 * agreedAt이 undefined면 키를 만들지 않는다. 시각을 모르는 경우
 * (동의시각이 없던 시절에 준비된 결제의 복구)에 createdAt이나 지금 시각으로
 * 추정해 채우면, 실제로는 모르는 값을 아는 것처럼 기록하게 된다.
 * 버전은 ORDER_CONSENT_VERSION 상수에서 읽는다.
 */
export function buildOrderConsent(agreedAt: string | undefined): ConsentRecord {
  return {
    agreed: true,
    ...(agreedAt ? { agreedAt } : {}),
    version: ORDER_CONSENT_VERSION,
  };
}

/**
 * 저작권 동의 증빙. buildOrderConsent와 같은 규칙이며 시각도 같은 값을 받는다.
 *
 * 버전 상수를 새로 만들지 않고 ORDER_CONSENT_VERSION을 그대로 쓴다.
 * 두 문구가 같은 신청 화면에서 함께 개정되고, 신청 저장을 여는 관문도
 * isOrderConsentVersionConfirmed() 하나뿐이라 축을 늘릴 이유가 없다.
 */
export function buildCopyrightConsent(agreedAt: string | undefined): ConsentRecord {
  return {
    agreed: true,
    ...(agreedAt ? { agreedAt } : {}),
    version: ORDER_CONSENT_VERSION,
  };
}

/**
 * 결제 스냅샷에 담긴 서버 동의시각을 읽는다. 값이 UTC ISO 문자열로 그대로
 * 돌아오지 않으면 undefined다.
 *
 * 이 값은 서버(preparePayment)가 쓴 것이지만 저장은 JSONB라 형식을 다시 본다.
 * 검사는 toISOString() 왕복 일치 하나뿐이다. 우리가 넣는 값이 그 형식이므로,
 * 그보다 느슨한 검사는 통과시킬 필요가 없는 문자열을 통과시키게 된다.
 */
export function readServerConsentedAt(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString() === value ? value : undefined;
}

/**
 * 현재 상태를 담는 키들. history는 배열이라 이 축에 들어가지 않는다.
 * 이 타입을 두지 않으면 readConsent가 history까지 받아들이게 된다.
 */
export type ConsentRecordKey = Exclude<keyof UserConsents, "history">;

/**
 * 기존 회원(consents === undefined)까지 안전하게 읽는 헬퍼.
 * 기록이 없으면 "동의한 적 없음"이 아니라 "기록 없음"이므로 null을 준다.
 *
 * 현재 상태 레코드만 읽는다. 행위 기록은 lastEventOfType으로 따로 본다.
 */
export function readConsent(
  consents: UserConsents | undefined,
  key: ConsentRecordKey,
): ConsentRecord | null {
  return consents?.[key] ?? null;
}
