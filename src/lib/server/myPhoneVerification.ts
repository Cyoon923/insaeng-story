/**
 * 로그인한 회원의 최초 휴대폰 본인확인 (소셜 간편가입 STEP 4).
 *
 * 지금 로그인한 회원에게 인증된 번호를 붙이거나, 그 번호의 기존 회원이 있으면
 * provider 연결만 그쪽으로 옮기고 이 회원을 종료한다. 옮기는 회원 데이터는
 * kakaoId 또는 naverId 하나뿐이다(STEP 3 absorbSocialShell). 범용 merge는 없다.
 *
 * ── 기존 completeSocialLink와 무엇이 다른가 ──
 *
 * completeSocialLink는 "세션이 없는" 신규 소셜 가입 전용이고, 로그인 상태면 거부한다.
 * 그 거부는 남의 계정으로 세션이 바뀌는 것을 막는 실제 보안 장치라 건드리지 않는다.
 * 이 파일은 그 반대(로그인 상태)만 다루는 별도 경로이며, 안전성의 근거가 다르다.
 *
 *   completeSocialLink : SMS 토큰 + 서버 대기 상태(social_link 쿠키)
 *   여기               : SMS 토큰 + 서버 세션
 *
 * 둘 다 토큰 하나로는 통과할 수 없다. 두 번째 근거가 서로 다르므로 토큰 종류를
 * 나누지 않아도 한쪽 경로가 다른 쪽을 대신할 수 없다.
 *
 * ── 이 파일이 받지 않는 값 ──
 *
 * userId / targetId / providerUserId / kakaoId / naverId / provider.
 * 지금 회원은 호출부가 세션에서 정하고, 흡수 대상은 인증된 번호로 서버가 찾고,
 * provider는 그 회원이 실제로 가진 필드에서 읽는다. 클라이언트가 고를 수 있는 것은
 * "어떤 번호를 인증할지"뿐이고, 그 번호는 SMS를 받아야 통과한다.
 *
 * ── 저장 경계 ──
 *
 * 성공 경로는 app_store 변경과 인증 토큰 소비를 한 번의 CAS write로 확정한다(deps.commit).
 * 저장이 실패하면 토큰도 남는다. 토큰만 먼저 사라지는 순서를 만들지 않는다.
 * 세션 전환은 이 파일이 하지 않는다. 저장이 확정된 뒤 호출부가 한다.
 */
import { absorbSocialShell } from "./socialShellAbsorb.ts";
import type { AbsorbBlocker, AbsorbProvider, ShellHistoryCounts } from "./socialShellAbsorb.ts";
import { phoneDigits } from "../phoneVerification.ts";
import type { AppData, User } from "@/lib/types/app";
import type { VerificationSource } from "@/lib/server/verificationCodes";

/**
 * CAS가 겹쳐 밀렸을 때 다시 해 보는 횟수. 기존 정리 작업들과 같은 3을 쓴다
 * (RETENTION_SCRUB_MAX_ATTEMPTS / LEGACY_CODES_CLEANUP_MAX_ATTEMPTS / INQUIRY_CLEANUP_MAX_ATTEMPTS).
 * 무한히 돌지 않는다. 다 밀리면 아무것도 바뀌지 않은 상태로 끝내고 사용자가 다시 누르게 한다.
 */
export const MY_PHONE_VERIFICATION_MAX_ATTEMPTS = 3;

/** 인증 토큰을 담는 키. completeSocialLink가 쓰는 것과 같은 규칙이다. */
export function linkTokenKey(phone: string): string {
  return `link:${phone}`;
}

/** 자동으로 기존 회원에 연결할 수 없는 이유. 사람이 처리해야 하는 경우다. */
export type AbsorbUnavailableReason =
  /** 지금 회원에게 이미 이력이 있다. 어떤 이력인지는 blockers에 담긴다. */
  | { kind: "history"; blockers: AbsorbBlocker[] }
  /** 소셜 연결이 없다. 일반 가입 회원이거나 연결이 끊긴 상태다. */
  | { kind: "no-provider" }
  /** 카카오와 네이버가 모두 붙어 있다. "임시 신규 소셜 회원"이라는 전제가 깨졌다. */
  | { kind: "multiple-providers" }
  /** 비밀번호가 있다. 일반 가입 회원은 흡수 대상이 아니다. */
  | { kind: "password" }
  /** provider 연결이 겹쳐 옮길 수 없다(기존 회원에 다른 계정이 붙어 있는 등). */
  | { kind: "provider-conflict"; reason: string };

/**
 * 결과.
 *
 * - verified          : 이 회원에게 인증된 번호를 저장했다. 세션 그대로.
 * - already-verified  : 이미 같은 번호를 가지고 있다. 아무것도 바꾸지 않았다(중복 요청).
 * - absorbed          : 기존 회원으로 연결을 옮기고 이 회원을 종료했다.
 *                       호출부가 **저장 확정 뒤에** setUserId(targetId)를 한다.
 * - absorb-unavailable: 자동 연결 불가. 아무것도 바꾸지 않았다.
 * - phone-already-set : 이 회원은 이미 다른 번호로 인증되어 있다. 번호 변경 경로가 아니다.
 * - token-expired     : 이 번호에 대한 서버 발급 토큰이 없거나 맞지 않는다.
 * - not-eligible      : 세션이 가리키는 회원이 없거나 탈퇴했다.
 * - retry-later       : 저장이 정해진 횟수만큼 모두 겹쳐 밀렸다. 아무것도 바뀌지 않았다.
 */
export type MyPhoneVerificationResult =
  | { kind: "verified"; userId: string; phone: string }
  | { kind: "already-verified"; userId: string }
  | { kind: "absorbed"; targetId: string; shellId: string; provider: AbsorbProvider }
  | { kind: "absorb-unavailable"; reason: AbsorbUnavailableReason }
  | { kind: "phone-already-set" }
  | { kind: "token-expired" }
  | { kind: "not-eligible" }
  | { kind: "retry-later"; attempts: number };

/** 이 흐름이 쓰는 바깥 기능. 테스트에서 바꿔 끼울 수 있도록 인자로 받는다. */
export interface MyPhoneVerificationDeps {
  /** 시도마다 최신 저장소를 읽는다. 회차마다 새 객체여야 한다(CAS 기준 version이 붙는다). */
  readData: () => Promise<AppData>;
  /** 그 키의 인증 값. completeSocialLink와 같은 readVerification을 넘긴다. */
  readToken: (
    key: string,
    data: AppData,
  ) => Promise<{ code: string; source: VerificationSource } | null>;
  /** listOrdersByUser(userId).length */
  countOrders: (userId: string) => Promise<number>;
  /** listChatInquiriesByUserId(userId).length */
  countChatInquiries: (userId: string) => Promise<number>;
  /** store.ts의 formatPhone. 저장 형식을 기존 회원과 같게 맞춘다. */
  formatPhone: (phone: string) => string;
  /** withdrawAccount.ts의 anonymizeWithdrawnUser. */
  anonymize: (data: AppData, user: User) => User;
  /**
   * app_store 변경과 인증 토큰 소비를 한 문장으로 확정한다.
   * CAS가 밀리면 예외를 던지고(isConflict로 판별), 토큰이 맞지 않으면 ok:false다.
   */
  commit: (
    data: AppData,
    key: string,
    code: string,
    source: VerificationSource,
  ) => Promise<{ ok: boolean }>;
  /** store.ts의 isAppStoreConflict. */
  isConflict: (error: unknown) => boolean;
}

/** shell이 가진 소셜 연결. 클라이언트가 고르지 않고 실제 필드에서 읽는다. */
function resolveProvider(
  user: User,
): { ok: true; provider: AbsorbProvider } | { ok: false; reason: AbsorbUnavailableReason } {
  // 비밀번호가 있으면 일반 가입 회원이다. 임시 소셜 회원이라는 전제가 성립하지 않는다.
  if (user.passwordHash) return { ok: false, reason: { kind: "password" } };
  const hasKakao = Boolean(user.kakaoId);
  const hasNaver = Boolean(user.naverId);
  // 둘 다 있으면 어느 쪽을 옮겨야 하는지 알 수 없다. 한쪽만 옮기면 다른 쪽이 사라진다.
  if (hasKakao && hasNaver) return { ok: false, reason: { kind: "multiple-providers" } };
  if (hasKakao) return { ok: true, provider: "kakao" };
  if (hasNaver) return { ok: true, provider: "naver" };
  return { ok: false, reason: { kind: "no-provider" } };
}

/**
 * 한 번의 시도. 최신 data 위에서 판정하고 저장까지 한다.
 *
 * CAS가 밀리면 예외가 올라가고, 바깥 루프가 **새로 읽은** data로 처음부터 다시 부른다.
 * 그래서 이 함수는 넘겨받은 data만 보고, 지난 회차의 값을 하나도 기억하지 않는다.
 */
async function attemptOnce(
  data: AppData,
  input: { userId: string; phone: string; token: string },
  deps: MyPhoneVerificationDeps,
): Promise<MyPhoneVerificationResult> {
  const { userId, phone, token } = input;

  // 1) 세션이 가리키는 회원. 탈퇴했으면 여기서 끝낸다.
  const me = data.users.find((item) => item.id === userId) ?? null;
  if (!me || me.withdrawnAt) return { kind: "not-eligible" };

  const mine = phoneDigits(me.phone);

  /**
   * 2) 이미 같은 번호를 가지고 있으면 멱등 성공이다.
   *
   * 토큰 확인보다 앞에 둔다. 앞선 요청이 성공하면서 토큰을 소비했으므로, 토큰을 먼저
   * 보면 두 번째 요청이 "만료"로 끝나 사용자가 실패로 본다. 여기서는 아무것도 바꾸지
   * 않고, 부르는 사람은 이 번호의 주인인 세션 본인이라 알려 주는 것도 없다.
   */
  if (mine !== "" && mine === phone) return { kind: "already-verified", userId };

  /**
   * 3) 다른 번호로 이미 인증된 회원은 거부한다.
   *
   * 이 경로는 "최초 1회 인증"이고 번호 변경 수단이 아니다. 변경을 열면 updateProfile이
   * phone을 무시하는 규칙(인증 없이 남의 번호를 적는 것을 막는다)을 우회하는 길이 된다.
   */
  if (mine !== "") return { kind: "phone-already-set" };

  // 4) 서버가 이 번호로 발급한 토큰인지. 번호와 토큰이 함께 맞아야 한다.
  const saved = await deps.readToken(linkTokenKey(phone), data);
  if (!saved || !token || saved.code !== token) return { kind: "token-expired" };

  /**
   * 5) 흡수 대상은 **인증된 번호로만** 찾는다. 요청에서 받지 않는다.
   *    탈퇴 회원은 보지 않는다. 탈퇴하면 phone이 ""가 되므로 어차피 걸리지 않지만,
   *    판정을 값에 기대지 않고 명시한다.
   */
  const target =
    data.users.find(
      (item) => !item.withdrawnAt && item.id !== userId && phoneDigits(item.phone) === phone,
    ) ?? null;

  const key = linkTokenKey(phone);

  // 6) 그 번호의 기존 회원이 없으면 지금 회원에게 붙인다. 세션은 그대로다.
  if (!target) {
    me.phone = deps.formatPhone(phone);
    const committed = await deps.commit(data, key, saved.code, saved.source);
    if (!committed.ok) return { kind: "token-expired" };
    return { kind: "verified", userId, phone: me.phone };
  }

  // 7) 기존 회원이 있다. 지금 회원(shell)의 소셜 연결만 옮길 수 있는지 본다.
  const resolved = resolveProvider(me);
  if (!resolved.ok) return { kind: "absorb-unavailable", reason: resolved.reason };

  /**
   * 8) 이력 개수는 저장 직전에 새로 읽는다. STEP 1/2가 정상 흐름에서 이력이 생기지
   *    않게 막고 있지만, 그 사실만 믿고 판정을 생략하지 않는다.
   *    CAS가 밀려 다시 시도할 때도 이 자리를 다시 지나므로 값이 낡지 않는다.
   */
  const counts: ShellHistoryCounts = {
    orders: await deps.countOrders(userId),
    chatInquiries: await deps.countChatInquiries(userId),
  };

  /**
   * 9) provider 이전 → shell 종료. 저장은 아직 하지 않는다(absorbSocialShell 안에 write가 없다).
   *
   * 이력 판정(findAbsorbBlockers)을 여기서 미리 부르지 않는다. absorbSocialShell이
   * 같은 판정을 하고 막힌 사유를 refusal에 담아 돌려주므로, 미리 부르면 같은 검사가
   * 두 벌이 되고 한쪽만 고쳐질 자리가 생긴다. 사유는 아래에서 그대로 옮긴다.
   */
  const absorbed = absorbSocialShell(
    data,
    { shellId: userId, targetId: target.id, provider: resolved.provider, counts },
    { anonymize: deps.anonymize },
  );

  if (absorbed.kind === "refused") {
    if (absorbed.refusal.reason === "shell-not-empty") {
      return {
        kind: "absorb-unavailable",
        reason: { kind: "history", blockers: absorbed.refusal.blockers },
      };
    }
    return {
      kind: "absorb-unavailable",
      reason: { kind: "provider-conflict", reason: absorbed.refusal.reason },
    };
  }

  /**
   * 이미 끝나 있던 경우. data는 바뀌지 않았지만 토큰은 소비해 둔다.
   * 남겨 두면 같은 토큰으로 다시 부를 수 있고, 어차피 이 번호의 인증은 끝난 일이다.
   */
  if (absorbed.kind === "already-absorbed") {
    const committed = await deps.commit(data, key, saved.code, saved.source);
    if (!committed.ok) return { kind: "token-expired" };
    return {
      kind: "absorbed",
      targetId: target.id,
      shellId: userId,
      provider: resolved.provider,
    };
  }

  // 10) 이전·종료·토큰 소비를 한 번의 CAS write로 확정한다.
  const committed = await deps.commit(data, key, saved.code, saved.source);
  if (!committed.ok) return { kind: "token-expired" };

  return { kind: "absorbed", targetId: target.id, shellId: userId, provider: resolved.provider };
}

/**
 * 로그인한 회원의 최초 휴대폰 본인확인을 끝낸다.
 *
 * 저장이 겹쳐 밀린 경우에만 다시 시도한다. 회차마다 저장소를 새로 읽고, 이력 개수도
 * 새로 읽고, 흡수 대상도 다시 찾고, provider 충돌도 다시 판정한다. 지난 회차에서
 * 고친 data는 버린다(그 객체를 다시 쓰면 낡은 version으로 남의 변경을 덮어쓴다).
 *
 * 정해진 횟수를 모두 밀리면 retry-later로 끝낸다. 그때 어느 저장소도 바뀌지 않았다.
 */
export async function completeMyPhoneVerification(
  input: { userId: string; phone: string; token: string },
  deps: MyPhoneVerificationDeps,
  maxAttempts: number = MY_PHONE_VERIFICATION_MAX_ATTEMPTS,
): Promise<MyPhoneVerificationResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // 회차마다 새로 읽는다. 지난 회차의 data도 판정도 쓰지 않는다.
    const data = await deps.readData();
    try {
      return await attemptOnce(data, input, deps);
    } catch (error) {
      // 겹쳐서 밀린 경우가 아니면 그대로 올린다. 이유를 모른 채 다시 하지 않는다.
      if (!deps.isConflict(error)) throw error;
      // 개인정보는 남기지 않는다. 몇 번째 시도였는지만 남긴다.
      console.warn(`[my-phone] store conflict on attempt ${attempt}`);
    }
  }
  console.warn("[my-phone] store conflict exhausted");
  return { kind: "retry-later", attempts: maxAttempts };
}
