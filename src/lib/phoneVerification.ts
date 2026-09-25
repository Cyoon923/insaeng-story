/**
 * 휴대폰 본인확인 판정. 순수 함수 하나뿐이다.
 *
 * ── 왜 별도 필드를 두지 않는가 ──
 *
 * User.phone에 값을 쓰는 곳은 저장소 전체에 가입 시점 하나뿐이고(store.ts의
 * emptyUser를 부르는 signupComplete / completeSocialLink), 두 호출부 모두 SMS
 * 인증 토큰을 검증한 뒤에야 도달한다. updateProfile은 phone을 의도적으로 무시한다
 * (인증 없이 남의 번호를 적는 것을 막기 위해서다).
 *
 * 그래서 "활성 회원의 phone이 비어 있지 않다"는 곧 "그 번호로 SMS 인증을 통과했다"다.
 * phoneVerifiedAt 같은 필드를 새로 만들면 기존 회원의 과거 인증 시각을 지어내야 하는데,
 * 그런 기록은 만들지 않는다(consents.ts와 같은 원칙). 이미 있는 값으로 판정한다.
 *
 * 이 판정이 성립하는 조건은 위 불변식 하나다. phone에 값을 쓰는 새 경로를 열려면
 * 반드시 SMS 인증을 거치게 해야 한다. phoneVerification.test.ts가 이 불변식을
 * 원문으로 고정한다.
 *
 * ── 왜 import가 없는가 ──
 *
 * node --test로 이 파일을 직접 실행하기 위해서다. store.ts(normalizePhone)와
 * withdrawAccount.ts(isActiveUser)는 둘 다 "@/" 경로를 런타임에 쓰고 있어
 * 테스트 러너에서 불러올 수 없다. 두 판정이 갈라지지 않도록,
 * 테스트가 저 두 파일의 원문과 이 파일의 규칙이 같은지 함께 확인한다.
 *
 * ── 이 파일에 서버 전용 import를 넣지 말 것 ──
 *
 * 이 파일이 lib/server 밖에 있는 이유가 그것이다. 서버와 화면이 같은 판정을 써야 해서
 * (api/app 라우트·withdrawAccount·applyOrder / PaySubmit·ApplyPhoneGate·verify-phone 화면)
 * 양쪽에서 불러올 수 있는 자리에 둔다. 여기에 저장소·세션·node 내장 모듈을 들이면
 * 클라이언트 번들이 깨진다.
 *
 * 저장소나 세션을 보는 판정이 필요하면 withdrawAccount.ts의 getVerifiedUserId처럼
 * 저장소를 아는 파일에 두고 이 파일의 함수를 불러 쓴다.
 */
import type { User } from "@/lib/types/app";

/**
 * 번호에서 숫자만 남긴다. store.ts의 normalizePhone과 같은 규칙이며,
 * 저장 형식("010-1234-5678")에 판정이 딸려가지 않게 하려고 쓴다.
 *
 * 이 파일에 둔 이유는 순수 모듈로 남겨야 해서다(위 주석 참고).
 * 두 곳이 갈라지지 않는지는 phoneVerification.test.ts가 원문으로 확인한다.
 */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * 휴대폰 인증을 마친 활성 회원인지.
 *
 * - withdrawnAt이 있으면 탈퇴 회원이다. 탈퇴 비식별화가 phone을 ""로 비우지만,
 *   판정은 withdrawAccount.ts의 isActiveUser와 같은 기준(withdrawnAt)으로 명시한다.
 * - 자릿수 기준 10은 기존 인증 진입점(sendCode / verifyCode / completeSocialLink)이
 *   쓰는 값과 같다. 여기서 더 엄하게 보면 이미 가입한 회원이 막힌다.
 */
export function hasVerifiedPhone(user: User | null | undefined): boolean {
  if (!user || user.withdrawnAt) return false;
  return phoneDigits(user.phone).length >= 10;
}
