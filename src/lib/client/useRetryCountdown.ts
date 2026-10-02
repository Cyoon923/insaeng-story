"use client";

import { useEffect, useState } from "react";
import { retryAfterSeconds } from "@/lib/client/api";

/**
 * 인증번호 재요청 안내 문구. 서버 smsRateLimitedMessage와 같은 형식이다
 * (같은지는 useRetryCountdown.test.ts가 고정한다).
 * 1분 미만은 초, 1시간 미만은 분·초, 그 이상은 시간·분(분은 올림)으로 적는다.
 */
export function verificationRetryMessage(waitSeconds: number): string {
  let wait: string;
  if (waitSeconds < 60) {
    wait = `${waitSeconds}초`;
  } else if (waitSeconds < 60 * 60) {
    const minutes = Math.floor(waitSeconds / 60);
    const seconds = waitSeconds % 60;
    wait = seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
  } else {
    const totalMinutes = Math.ceil(waitSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    wait = minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }
  return `인증번호는 ${wait} 후 다시 요청할 수 있습니다.`;
}

function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * 인증번호 재요청 대기시간을 1초씩 줄여 보여 준다.
 *
 * 서버가 429와 함께 준 Retry-After만 기준으로 삼는다. 화면 시계로 허용 여부를 정하지 않으며
 * (서버 제한이 최종 판단이다), 0초가 되어도 자동으로 다시 요청하지 않는다.
 * 제한은 번호별이라, 막힌 번호와 지금 입력한 번호가 같을 때만 안내하고 버튼을 잠근다.
 */
export function useRetryCountdown() {
  const [state, setState] = useState<{ phone: string; left: number } | null>(null);

  useEffect(() => {
    if (!state || state.left <= 0) return;
    const timer = setTimeout(() => {
      setState((prev) => (prev ? { ...prev, left: prev.left - 1 } : prev));
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  /** 오류에 Retry-After가 있으면 그 번호로 countdown을 (다시) 시작하고 true. 없으면 false. */
  const startFrom = (error: unknown, phone: string): boolean => {
    const seconds = retryAfterSeconds(error);
    if (seconds === null) return false;
    setState({ phone: digits(phone), left: seconds });
    return true;
  };

  /** 이 번호의 남은 초. 막힌 번호가 아니거나 끝났으면 0이다. */
  const left = (phone: string): number =>
    state && state.phone === digits(phone) ? Math.max(0, state.left) : 0;

  /** 화면에 보일 안내 문구. 남은 시간이 없으면 빈 문자열이다. */
  const message = (phone: string): string => {
    const seconds = left(phone);
    return seconds > 0 ? verificationRetryMessage(seconds) : "";
  };

  return { startFrom, left, message };
}
