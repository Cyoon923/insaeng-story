/**
 * 소셜 로그인에서 처음 보는 계정을 만났을 때, 휴대폰 인증을 마칠 때까지
 * provider 정보를 서버에만 보관하기 위한 임시 상태.
 *
 * 브라우저에는 무작위 토큰만 httpOnly 쿠키로 내려간다.
 * provider / providerUserId / nickname은 서버 저장소에서만 읽을 수 있어
 * 사용자가 값을 바꿔 남의 소셜 계정을 자기 계정에 붙이는 일이 불가능하다.
 *
 * 이 파일은 저장 기반만 제공한다. OAuth 콜백 연결과 휴대폰 인증 화면은
 * 아직 이 함수를 호출하지 않는다.
 */
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { readData, writeData } from "@/lib/server/store";

const COOKIE = "social_link";

/** 대기 상태 유효시간. 기존 signup/reset 단기 토큰과 같은 15분을 쓴다. */
const PENDING_TTL_MS = 15 * 60 * 1000;

/**
 * 저장 키 접두사. 기존 SMS 인증이 쓰는 키(휴대폰 번호, 이메일 해시,
 * `signup:`, `reset:`)와 겹치지 않는 이름을 쓴다.
 */
const KEY_PREFIX = "sociallink:";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export type SocialProvider = "kakao" | "naver";

/** 휴대폰 인증을 마친 뒤 실제 연결에 쓰는 값. 서버에서만 읽는다. */
export interface SocialLinkPending {
  provider: SocialProvider;
  providerUserId: string;
  nickname: string;
  expiresAt: number;
}

function isProvider(value: unknown): value is SocialProvider {
  return value === "kakao" || value === "naver";
}

function storageKey(token: string): string {
  return `${KEY_PREFIX}${token}`;
}

/** 예측할 수 없는 토큰. 세션·인증번호와 같은 crypto 난수를 쓴다. */
function createToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * 저장된 문자열을 대기 상태로 되돌린다.
 * 형식이 어긋나면 null을 돌려주고 호출한 쪽에서 없는 것으로 처리한다.
 */
function parsePending(raw: string, expiresAt: number): SocialLinkPending | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (!isProvider(value.provider)) return null;
    const providerUserId = String(value.providerUserId ?? "");
    if (!providerUserId) return null;
    return {
      provider: value.provider,
      providerUserId,
      nickname: String(value.nickname ?? ""),
      expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * 대기 상태를 만들고 브라우저에는 토큰만 남긴다.
 * 이미 다른 대기 상태가 있으면 새 토큰이 쿠키를 덮어써 이전 것은 만료로 사라진다.
 */
export async function createSocialLinkPending(input: {
  provider: SocialProvider;
  providerUserId: string;
  nickname?: string;
}): Promise<string> {
  const token = createToken();
  const data = await readData();
  data.codes[storageKey(token)] = {
    // VerificationCode.code는 문자열이라 그대로 쓴다. 구조를 바꾸지 않기 위해서다.
    code: JSON.stringify({
      provider: input.provider,
      providerUserId: input.providerUserId,
      nickname: (input.nickname ?? "").trim(),
    }),
    expiresAt: Date.now() + PENDING_TTL_MS,
  };
  await writeData(data);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    path: "/",
    maxAge: PENDING_TTL_MS / 1000,
  });
  return token;
}

/**
 * 대기 상태를 읽기만 한다. 화면에 "카카오 계정을 연결합니다" 같은 안내를 보여줄 때 쓴다.
 * 만료되었거나 없으면 null이다.
 */
export async function readSocialLinkPending(): Promise<SocialLinkPending | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const data = await readData();
  const saved = data.codes[storageKey(token)];
  if (!saved || saved.expiresAt < Date.now()) return null;
  return parsePending(saved.code, saved.expiresAt);
}

/**
 * 대기 상태를 읽고 즉시 폐기한다. 실제 연결은 이 함수로 얻은 값으로만 해야 한다.
 * 저장소에서 지운 뒤 값을 돌려주므로 같은 토큰으로 두 번 연결할 수 없다.
 */
export async function consumeSocialLinkPending(): Promise<SocialLinkPending | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  if (!token) return null;

  const key = storageKey(token);
  const data = await readData();
  const saved = data.codes[key];
  if (!saved) return null;

  delete data.codes[key];
  await writeData(data);

  if (saved.expiresAt < Date.now()) return null;
  return parsePending(saved.code, saved.expiresAt);
}

/** 사용자가 연결을 그만두는 경우처럼, 값을 쓰지 않고 정리만 할 때 쓴다. */
export async function clearSocialLinkPending(): Promise<void> {
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
export const __socialLinkInternals = { COOKIE, KEY_PREFIX, PENDING_TTL_MS };
