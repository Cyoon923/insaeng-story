/**
 * 고객용 상담원 문의 API에서 "누가 보냈는가"를 정하는 곳.
 *
 * 방침
 * - 회원은 서명된 세션 쿠키에서 얻은 활성 userId만 쓴다. 클라이언트가 보낸 userId는 받지 않는다.
 * - 비회원은 httpOnly 쿠키에 담긴 원문 토큰으로만 자기 방을 다시 찾는다.
 *   원문 토큰은 쿠키 밖으로 나가지 않는다. 응답에도, 로그에도 담지 않는다.
 * - DB에는 해시만 남는다. 쿠키를 잃어버리면 비회원은 지난 방을 볼 수 없다. 의도한 동작이다.
 */
import { cookies } from "next/headers";
import { createGuestToken, hashGuestToken } from "@/lib/server/chatInquiries";
import { getVerifiedUserId } from "@/lib/server/withdrawAccount";

/** 기존 쿠키(insaeng_uid 등)와 겹치지 않는 이름. */
export const CHAT_GUEST_COOKIE = "sajulog_chat_guest";

/** 비회원이 자기 문의방을 다시 찾을 수 있는 기간. 60일. */
export const CHAT_GUEST_TTL_SECONDS = 60 * 24 * 60 * 60;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** createGuestToken()이 만드는 형식. 이 모양이 아니면 없는 것으로 본다. */
function isGuestToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/** 쿠키에 담긴 원문 토큰. 형식이 어긋나면 null이다. */
async function readGuestToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CHAT_GUEST_COOKIE)?.value;
  return isGuestToken(value) ? value : null;
}

/** 쿠키의 토큰을 해시로 바꿔 돌려준다. 쿠키가 없으면 null이다. */
export async function readGuestTokenHash(): Promise<string | null> {
  const token = await readGuestToken();
  return token ? hashGuestToken(token) : null;
}

async function writeGuestCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CHAT_GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    path: "/",
    maxAge: CHAT_GUEST_TTL_SECONDS,
  });
}

/**
 * 비회원 토큰을 준비한다. 이미 쿠키가 있으면 그대로 쓰고 만료만 60일로 미룬다.
 * 같은 기기에서 다시 문의하면 지난 문의방이 목록에 함께 보이게 하려는 것이다.
 * 돌려주는 값은 해시뿐이다. 원문은 쿠키에만 남는다.
 */
export async function ensureGuestTokenHash(): Promise<string> {
  const existing = await readGuestToken();
  const token = existing ?? createGuestToken();
  await writeGuestCookie(token);
  return hashGuestToken(token);
}

/** 읽기 요청에서 쓰는 신원. 회원이면 userId, 비회원이면 토큰 해시. 둘 다 없을 수 있다. */
export interface ChatRequester {
  userId: string | null;
  guestTokenHash: string | null;
}

/**
 * 지금 요청의 신원. 쿠키를 새로 발급하지 않는다.
 * 회원이면 비회원 쿠키가 함께 있어도 회원 쪽으로 본다.
 *
 * 회원으로 인정하는 기준은 휴대폰 본인확인까지 마친 회원이다(getVerifiedUserId).
 * 본인확인 전에는 회원 id에 문의방을 묶지 않고 아래 비회원 쿠키 경로를 그대로 쓴다.
 * 보내는 쪽(POST /api/chat-inquiries)과 읽는 쪽이 같은 기준을 써야 자기 방을
 * 다시 찾을 수 있으므로, 양쪽 모두 이 판정 하나를 본다.
 */
export async function resolveChatRequester(): Promise<ChatRequester> {
  const userId = await getVerifiedUserId();
  if (userId) return { userId, guestTokenHash: null };
  return { userId: null, guestTokenHash: await readGuestTokenHash() };
}
