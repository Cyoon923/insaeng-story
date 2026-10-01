/**
 * 인증번호 SMS 발송 제한 (P1-06 1단계).
 *
 * 목적별 60초 재발송 쿨다운(issueCode)은 그대로 두고, 그 위에 목적과 무관한 횟수 제한을 더한다.
 * - 같은 전화번호: 1시간 5회, 24시간 10회
 * - 같은 IP: 1시간 20회 (IP를 알 수 없으면 생략한다)
 *
 * 카운터는 로그인 제한과 같은 저장소(loginAttemptStoreFor, verification_codes의 접두어 키)를 쓴다.
 * 키에는 번호·IP 원문을 넣지 않고 SHA-256 해시만 넣는다. 새 테이블·환경변수는 없다.
 *
 * 순서
 * 1) 쿨다운이 남았으면 카운터를 건드리지 않고 거절한다(재요청 버튼을 눌러도 한도가 줄지 않는다).
 * 2) 발송 직전에 세 카운터를 모두 센다. 하나라도 넘으면 코드 저장·SMS 발송 없이 거절한다.
 * 3) issueCode로 코드를 저장한다(원자적 쿨다운). 동시 요청에 졌으면 거절한다.
 * 4) SMS를 보낸다. 실패하면 방금 저장한 코드만 지운다. 카운터는 되돌리지 않는다
 *    (되돌리면 실패를 반복시켜 한도를 무력화할 수 있고, 동시 요청 사이에서 정확히 되돌릴 수 없다).
 */
import { createHash } from "node:crypto";
import type { LoginAttemptStore } from "./loginRateLimit.ts";

const HOUR_MS = 60 * 60 * 1000;

export const SMS_SEND_LIMITS = {
  /** 같은 전화번호, 목적 무관. */
  phoneHour: { max: 5, windowMs: HOUR_MS },
  phoneDay: { max: 10, windowMs: 24 * HOUR_MS },
  /** 같은 IP. 번호를 바꿔 가며 보내는 시도를 막는다. */
  ipHour: { max: 20, windowMs: HOUR_MS },
} as const;

export const SMS_RATE_LIMITED_MESSAGE = "인증번호 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";

/** loginRateLimit.clientIp가 IP를 알 수 없을 때 돌려주는 값. 이때는 IP 제한을 하지 않는다. */
const UNKNOWN_IP = "unknown";

function hashed(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function smsPhoneHourKey(phone: string): string {
  return `smsrl:phone:h:${hashed(phone)}`;
}

export function smsPhoneDayKey(phone: string): string {
  return `smsrl:phone:d:${hashed(phone)}`;
}

export function smsIpHourKey(ip: string): string {
  return `smsrl:ip:h:${hashed(ip)}`;
}

/**
 * 이번 발송까지 세어 한도 안인지. 카운터는 모두 센 뒤 판정한다.
 * 저장소가 없으면(파일 모드, hit = null) 제한하지 않는다.
 */
export async function gateSmsSend(store: LoginAttemptStore, phone: string, ip: string): Promise<boolean> {
  const checks: [string, { max: number; windowMs: number }][] = [
    [smsPhoneHourKey(phone), SMS_SEND_LIMITS.phoneHour],
    [smsPhoneDayKey(phone), SMS_SEND_LIMITS.phoneDay],
  ];
  if (ip !== UNKNOWN_IP) checks.push([smsIpHourKey(ip), SMS_SEND_LIMITS.ipHour]);
  let allowed = true;
  for (const [key, limit] of checks) {
    const attempts = await store.hit(key, limit.windowMs);
    if (attempts !== null && attempts > limit.max) allowed = false;
  }
  return allowed;
}

export type SendCodeOutcome =
  | { kind: "sent" }
  | { kind: "cooldown"; waitSeconds: number }
  | { kind: "rate-limited" }
  | { kind: "send-failed" };

export interface SendCodeDeps {
  /** 이 목적·번호 키의 남은 쿨다운(초). 0이면 없음. */
  cooldownLeft: () => Promise<number>;
  store: LoginAttemptStore;
  /** 기존 verificationCodes.issueCode. */
  issueCode: () => Promise<{ ok: true } | { ok: false; waitSeconds: number }>;
  /** 실제 SMS 발송. 개발 환경처럼 보내지 않을 때는 null이다. */
  send: (() => Promise<void>) | null;
  /** 기존 verificationCodes.deleteIssuedCode(이번에 저장한 code·sentAt일 때만 지움). */
  deleteIssued: () => Promise<void>;
}

export async function runSendCode(
  input: { phone: string; ip: string },
  deps: SendCodeDeps,
): Promise<SendCodeOutcome> {
  const wait = await deps.cooldownLeft();
  if (wait > 0) return { kind: "cooldown", waitSeconds: wait };

  if (!(await gateSmsSend(deps.store, input.phone, input.ip))) return { kind: "rate-limited" };

  const issued = await deps.issueCode();
  if (!issued.ok) return { kind: "cooldown", waitSeconds: issued.waitSeconds };

  if (deps.send) {
    try {
      await deps.send();
    } catch {
      await deps.deleteIssued();
      return { kind: "send-failed" };
    }
  }
  return { kind: "sent" };
}
