import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "insaeng_uid";

/** 로그인 유지 기간. 기존과 같은 30일. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 서명 대상 문자열의 용도 구분자. 관리자 세션 서명과 섞이지 않게 한다. */
const TOKEN_PREFIX = "user";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * 개발 전용 서명키. SESSION_SECRET을 로컬에 두지 않아도 로그인을 확인할 수 있게 한다.
 * 운영에서는 아래 sessionKey()가 이 값을 절대 사용하지 않는다.
 */
const DEV_SECRET = "insaeng-dev-session-secret";

/**
 * 회원 세션 서명키. 관리자 비밀번호(ADMIN_PASSWORD)와 분리된 별도 값을 쓴다.
 * 운영에서 SESSION_SECRET이 없으면 null이고, 발급도 검증도 실패한다.
 */
function sessionKey(): string | null {
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  if (secret) return `${TOKEN_PREFIX}:${secret}`;
  return IS_PRODUCTION ? null : `${TOKEN_PREFIX}:${DEV_SECRET}`;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

/** 길이가 달라도 예외 없이 false를 돌려주는 상수시간 비교. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** userId에 구분자(".")가 섞여도 안전하도록 base64url로 담는다. */
function encodeId(userId: string): string {
  return Buffer.from(userId, "utf8").toString("base64url");
}

function decodeId(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  const userId = Buffer.from(encoded, "base64url").toString("utf8");
  // 되돌린 값을 다시 인코딩해 같은지 본다. 어긋나면 조작된 값이다.
  return userId && encodeId(userId) === encoded ? userId : null;
}

/** 토큰 형식: "<base64url(userId)>.<만료시각(ms)>.<HMAC-SHA256>" */
function createToken(userId: string, key: string): string {
  const encoded = encodeId(userId);
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  return `${encoded}.${expiresAt}.${sign(`${TOKEN_PREFIX}.${encoded}.${expiresAt}`, key)}`;
}

/**
 * 서명과 만료를 모두 확인하고 userId를 돌려준다.
 * userId와 만료시각이 함께 서명되므로 어느 쪽을 바꿔도 검증에 실패한다.
 */
function readToken(token: string | undefined, key: string): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encoded, expiresAt, signature] = parts;
  if (!encoded || !signature) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (Number(expiresAt) <= Date.now()) return null;
  if (!safeEqual(signature, sign(`${TOKEN_PREFIX}.${encoded}.${expiresAt}`, key))) return null;

  return decodeId(encoded);
}

/** 서명과 만료를 통과한 세션에서만 userId를 돌려준다. 원본 userId 쿠키는 인정하지 않는다. */
export async function getUserId(): Promise<string | null> {
  const key = sessionKey();
  if (!key) return null;
  const store = await cookies();
  return readToken(store.get(COOKIE)?.value, key);
}

/**
 * 로그인 성공 시 세션 발급. 운영에서 SESSION_SECRET이 없으면 발급하지 않고 false를 돌려준다.
 * 기존 호출부는 반환값을 쓰지 않으므로 그대로 동작한다.
 */
export async function setUserId(userId: string): Promise<boolean> {
  const key = sessionKey();
  if (!key) return false;
  const store = await cookies();
  store.set(COOKIE, createToken(userId, key), {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return true;
}

export async function clearUserId(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** 테스트·검증용 내부 도우미. 런타임 동작에는 영향을 주지 않는다. */
export const __sessionInternals = { createToken, readToken, SESSION_TTL_MS };
