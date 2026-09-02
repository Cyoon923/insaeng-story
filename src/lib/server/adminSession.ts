import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "insaeng_admin";

/** 관리자 세션 유지 시간. 기존 쿠키 maxAge(8시간)와 같게 둔다. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** 서명 대상 문자열의 용도 구분자. 다른 곳의 서명과 섞이지 않게 한다. */
const TOKEN_PREFIX = "admin";

/**
 * 관리자 비밀번호. 설정되어 있지 않으면 null을 돌려주고,
 * 호출부에서 로그인 자체를 거부한다. 기본 비밀번호로 대체하지 않는다.
 */
export function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim() ?? "";
  return password || null;
}

/**
 * 서명 키. 별도 환경변수를 늘리지 않고 ADMIN_PASSWORD에서 파생한다.
 * 비밀번호가 없으면 서명도 검증도 할 수 없으므로 null이다.
 */
function signingKey(): string | null {
  const password = getAdminPassword();
  return password ? `${TOKEN_PREFIX}:${password}` : null;
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

/** 토큰 형식: "<만료시각(ms)>.<HMAC-SHA256>" */
function createToken(key: string): string {
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  return `${expiresAt}.${sign(`${TOKEN_PREFIX}.${expiresAt}`, key)}`;
}

/** 서명과 만료를 모두 확인한다. 하나라도 어긋나면 false. */
function verifyToken(token: string | undefined, key: string): boolean {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const expiresAt = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(expiresAt) || !signature) return false;
  if (Number(expiresAt) <= Date.now()) return false;

  return safeEqual(signature, sign(`${TOKEN_PREFIX}.${expiresAt}`, key));
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const key = signingKey();
  if (!key) return false;
  const store = await cookies();
  return verifyToken(store.get(COOKIE)?.value, key);
}

/**
 * 관리자 세션 발급. ADMIN_PASSWORD가 없으면 발급하지 않고 false를 돌려준다.
 */
export async function setAdminAuthenticated(): Promise<boolean> {
  const key = signingKey();
  if (!key) return false;
  const store = await cookies();
  store.set(COOKIE, createToken(key), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return true;
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** 테스트·검증용 내부 도우미. 런타임 동작에는 영향을 주지 않는다. */
export const __adminSessionInternals = { createToken, verifyToken, SESSION_TTL_MS };
