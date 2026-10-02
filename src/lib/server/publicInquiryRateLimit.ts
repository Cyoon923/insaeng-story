/**
 * 공개 문의 반복 요청 제한 (P1-06 Stage 2).
 *
 * 로그인 없이 쓰는 세 경로의 IP당 횟수를 센다.
 * - createInquiry(무료상담·이벤트 신청): 1시간 20회
 * - POST /api/chat-inquiries(상담원 문의방 열기·이어 쓰기): 1시간 20회
 * - POST /api/chat-inquiries/me/messages(내 문의방 메시지): 1시간 60회
 *
 * 카운터는 로그인·SMS 제한과 같은 저장소(loginAttemptStoreFor, verification_codes의 접두어 키)를 쓴다.
 * 키에는 IP 원문을 넣지 않고 SHA-256 해시만 넣는다. 새 테이블·환경변수는 없다.
 * IP를 알 수 없으면(Vercel 밖, 헤더 없음) 세지 않는다. 한 버킷으로 묶으면 모두가 함께 막힌다.
 * 호출부는 입력 검증을 통과한 뒤, 실제 저장·쿠키 발급 직전에 부른다.
 */
import { createHash } from "node:crypto";
import type { LoginAttemptStore } from "./loginRateLimit.ts";

const HOUR_MS = 60 * 60 * 1000;

export const PUBLIC_INQUIRY_LIMITS = {
  inquiry: { max: 20, windowMs: HOUR_MS },
  chat: { max: 20, windowMs: HOUR_MS },
  chatMessage: { max: 60, windowMs: HOUR_MS },
} as const;

export type PublicInquiryScope = keyof typeof PUBLIC_INQUIRY_LIMITS;

export const PUBLIC_INQUIRY_RATE_LIMITED_MESSAGE = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";

/** loginRateLimit.clientIp가 IP를 알 수 없을 때 돌려주는 값. */
const UNKNOWN_IP = "unknown";

export function publicInquiryKey(scope: PublicInquiryScope, ip: string): string {
  return `inqrl:${scope}:ip:h:${createHash("sha256").update(ip).digest("hex")}`;
}

/** 이번 요청까지 세어 한도 안인지. 저장소가 없거나(파일 모드) IP를 모르면 제한하지 않는다. */
export async function gatePublicInquiry(
  store: LoginAttemptStore,
  scope: PublicInquiryScope,
  ip: string,
): Promise<boolean> {
  if (ip === UNKNOWN_IP) return true;
  const limit = PUBLIC_INQUIRY_LIMITS[scope];
  const attempts = await store.hit(publicInquiryKey(scope, ip), limit.windowMs);
  return attempts === null || attempts <= limit.max;
}
