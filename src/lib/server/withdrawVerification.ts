/**
 * 소셜 전용 회원(비밀번호가 없는 회원)이 탈퇴 직전에 마치는 본인 확인 상태.
 *
 * 카카오/네이버 재인증에 성공하면 이 파일이 1회용 토큰만 발급한다.
 * 탈퇴 자체는 여기서 하지 않는다. 실제 탈퇴 API가 이 토큰을 소비한 뒤에 실행한다.
 *
 * 브라우저에는 무작위 토큰만 httpOnly 쿠키로 내려간다.
 * userId·provider·providerUserId는 서버 저장소에서만 읽을 수 있어
 * 사용자가 값을 바꿔 남의 계정을 탈퇴시키는 일이 불가능하다.
 *
 * 구조는 src/lib/server/socialLink.ts와 같은 방식이다.
 * 다른 점은 TTL이 5분으로 더 짧고, 토큰이 회원 id에 묶여 있다는 것뿐이다.
 */
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { readData, writeData } from "@/lib/server/store";
import type { SocialProvider } from "@/lib/server/socialLink";

const COOKIE = "withdraw_verify";

/**
 * 본인 확인 유효시간. 재인증을 마치고 바로 탈퇴 버튼을 누르는 흐름이라
 * 기존 소셜 연결 대기(15분)보다 짧게 잡는다.
 */
const TTL_MS = 5 * 60 * 1000;

/**
 * 저장 키 접두사. 기존 키(휴대폰 번호, 이메일 해시, `signup:`, `reset:`,
 * `link:`, `sociallink:`)와 겹치지 않는 이름을 쓴다.
 */
const KEY_PREFIX = "withdraw:";

/**
 * OAuth 목적 쿠키. 값이 WITHDRAW_PURPOSE일 때만 콜백이 탈퇴 재인증으로 분기한다.
 * 쿠키가 없으면 지금까지의 로그인 흐름 그대로다.
 */
export const OAUTH_PURPOSE_COOKIE = "oauth_purpose";
export const WITHDRAW_PURPOSE = "withdraw";

/** 목적 쿠키 유효시간(초). 인가 화면을 오가는 동안만 살아 있으면 된다. */
export const OAUTH_PURPOSE_MAX_AGE = 60 * 10;

/**
 * 재인증을 마친 뒤 돌아가는 화면. 탈퇴 UI는 아직 없고, 앞으로 이 경로가 받는다.
 * 성공/실패 모두 고정 경로라 외부로 튕겨 나갈 수 없다.
 */
export const WITHDRAW_VERIFIED_PATH = "/my/withdraw?verified=1";
export const WITHDRAW_FAILED_PATH = "/my/withdraw?error=";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** 탈퇴 실행 API가 읽는 값. 서버에서만 읽는다. */
export interface WithdrawVerification {
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  /**
   * 재인증에서 받은 provider access token. 탈퇴 직전 연결 해제(카카오 unlink)에만 쓴다.
   * 서버 저장소에만 있고 브라우저·응답·로그에는 절대 나가지 않는다.
   * TTL 5분이 지나거나 한 번 소비되면 함께 사라진다.
   */
  accessToken?: string;
  issuedAt: number;
  expiresAt: number;
}

function isProvider(value: unknown): value is SocialProvider {
  return value === "kakao" || value === "naver";
}

function storageKey(token: string): string {
  return `${KEY_PREFIX}${token}`;
}

/** 예측할 수 없는 토큰. 세션·소셜 연결 대기와 같은 crypto 난수를 쓴다. */
function createToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * 저장된 문자열을 본인 확인 상태로 되돌린다.
 * 형식이 어긋나면 null을 돌려주고 호출한 쪽에서 없는 것으로 처리한다.
 */
function parseVerification(raw: string, expiresAt: number): WithdrawVerification | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (!isProvider(value.provider)) return null;
    const userId = String(value.userId ?? "");
    const providerUserId = String(value.providerUserId ?? "");
    if (!userId || !providerUserId) return null;
    const issuedAt = Number(value.issuedAt ?? 0);
    const accessToken = typeof value.accessToken === "string" ? value.accessToken : "";
    return {
      userId,
      provider: value.provider,
      providerUserId,
      ...(accessToken ? { accessToken } : {}),
      issuedAt: Number.isFinite(issuedAt) ? issuedAt : 0,
      expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * 본인 확인 상태를 만들고 브라우저에는 토큰만 남긴다.
 *
 * 이미 남아 있는 토큰이 있으면 먼저 지운다. 쿠키만 덮으면 저장소에 주인 없는
 * 값이 남아 만료될 때까지 떠돌기 때문이다.
 */
export async function createWithdrawVerification(input: {
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  /** 탈퇴 직전 연결 해제에 쓸 access token. 없으면 저장하지 않는다. */
  accessToken?: string;
}): Promise<string> {
  const store = await cookies();
  const previous = store.get(COOKIE)?.value;

  const token = createToken();
  const issuedAt = Date.now();
  const data = await readData();
  if (previous) delete data.codes[storageKey(previous)];
  data.codes[storageKey(token)] = {
    // VerificationCode.code는 문자열이라 그대로 쓴다. 구조를 바꾸지 않기 위해서다.
    code: JSON.stringify({
      userId: input.userId,
      provider: input.provider,
      providerUserId: input.providerUserId,
      ...(input.accessToken ? { accessToken: input.accessToken } : {}),
      issuedAt,
    }),
    expiresAt: issuedAt + TTL_MS,
  };
  await writeData(data);

  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    path: "/",
    maxAge: TTL_MS / 1000,
  });
  return token;
}

/**
 * 본인 확인 상태를 읽고 즉시 폐기한다. 탈퇴 실행은 이 함수로 얻은 값으로만 해야 한다.
 * 저장소에서 지운 뒤 값을 돌려주므로 같은 토큰으로 두 번 통과할 수 없다.
 *
 * 이 함수는 "재인증을 마쳤다"까지만 보장한다.
 * 세션 회원이 payload.userId와 같은지, 그 회원의 소셜 id가 그대로인지는
 * 탈퇴 실행 쪽에서 다시 확인해야 한다.
 */
export async function consumeWithdrawVerification(): Promise<WithdrawVerification | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const key = storageKey(token);
  const data = await readData();
  const saved = data.codes[key];
  if (!saved) {
    // 저장된 값이 없으면 쓸 것도 없다. 쿠키만 정리한다.
    store.delete(COOKIE);
    return null;
  }

  delete data.codes[key];
  // 저장이 끝난 뒤에 쿠키를 지운다. 먼저 지우면 저장에 실패했을 때
  // 본인 확인을 처음부터 다시 해야 하고, 소셜 연결을 이미 끊은 뒤라면 그 길마저 막힌다.
  await writeData(data);
  store.delete(COOKIE);

  if (saved.expiresAt < Date.now()) return null;
  return parseVerification(saved.code, saved.expiresAt);
}

/** 사용자가 탈퇴를 그만두는 경우처럼, 값을 쓰지 않고 정리만 할 때 쓴다. */
export async function clearWithdrawVerification(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  if (!token) return;

  const data = await readData();
  const key = storageKey(token);
  if (!data.codes[key]) return;
  delete data.codes[key];
  await writeData(data);
}

/** 테스트·검증용 내부 도우미. 런타임 동작에는 영향을 주지 않는다. */
export const __withdrawVerificationInternals = { COOKIE, KEY_PREFIX, TTL_MS };
