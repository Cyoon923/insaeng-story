/**
 * 관리자 전용 정리 실행 (Privacy-Cleanup-Execution-API-1).
 *
 * 사람이 손으로 한 번에 한 가지씩 누르는 자리다. 일정에 따라 스스로 도는 구조가 아니다.
 *
 * 이 파일이 하는 일은 셋뿐이다. 관리자인지 확인하고, 기준 시각을 한 번 만들고,
 * 실제 실행 함수들을 규칙 모듈에 넘긴다. 판단은 전부 cleanupExecuteAdminApi.ts가 한다.
 * 여기에는 SQL도, 조건도, 새 인증도 없다.
 *
 * 한 요청에 한 가지만 실행한다. 여러 정리를 한꺼번에 돌리는 경로를 두지 않는다
 * (Promise.all로 묶지도 않는다). 정리는 되돌릴 수 없어서 실수의 폭을 좁혀 둔다.
 *
 * 응답에는 건수와 정해 둔 사유 이름만 담긴다. 주문 id·상담 id·회원 정보·SQL·접속 정보·
 * 받은 오류는 담지 않는다.
 */
import { NextResponse } from "next/server";
import { readJsonBody, requireAdmin } from "@/lib/server/chatInquiryApi";
import { runCleanupExecute } from "@/lib/server/cleanupExecuteAdminApi";
import {
  cleanupLegacyVerificationCodes,
  ensureRetentionSchema,
  runRetentionCleanupOnce,
} from "@/lib/server/retentionStore";
import {
  defaultInquiryCleanupDeps,
  runExpiredChatCleanup,
  runExpiredInquiryCleanup,
} from "@/lib/server/inquiryChatCleanupStore";
import { sqlClient } from "@/lib/server/store";
import { deleteExpiredVerifications } from "@/lib/server/verificationCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 1) 관리자 확인이 가장 먼저다.
  const denied = await requireAdmin();
  if (denied) return denied;

  // 2) 기준 시각은 여기서 한 번만 만든다. 그대로 ranAt·preparedAt이 된다.
  const now = new Date().toISOString();

  // 3) 본문은 기존 파서를 그대로 쓴다. JSON이 아니면 null이고, 규칙 모듈이 거절한다.
  const body = await readJsonBody(request);

  const response = await runCleanupExecute(
    {
      /*
       * 접속 문자열을 넘기지 않는다. 클라이언트를 만들 수 있는지 여부만 본다.
       * DATABASE_URL을 읽는 곳은 store.ts 하나로 둔다.
       */
      databaseMode: () => sqlClient() !== null,
      prepareSchema: ensureRetentionSchema,
      runRetention: runRetentionCleanupOnce,
      cleanupLegacyCodes: cleanupLegacyVerificationCodes,
      deleteExpiredVerifications,
      /*
       * 일반 문의·채팅 정리. 한도는 규칙 모듈이 정한 값을 그대로 받아 넘긴다.
       * 이 자리에서 한도를 만들지 않는다(호출부가 정하게 해 둔 구조를 지킨다).
       */
      cleanupExpiredInquiries: (now, limit) =>
        runExpiredInquiryCleanup(defaultInquiryCleanupDeps(), now, limit),
      cleanupExpiredChats: runExpiredChatCleanup,
    },
    body,
    now,
  );
  return NextResponse.json(response.body, { status: response.status });
}
