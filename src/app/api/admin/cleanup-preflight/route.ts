/**
 * 관리자 전용 정리 사전 확인 (Privacy-Cleanup-Preflight-1, -3에서 축소).
 *
 * Production에서 최초 정리를 시작하기 **직전에** 사람이 한 번 눌러 보는 자리다.
 * 확인하는 것은 하나뿐이다. 지금 이 런타임이 DB 모드인가.
 *
 * ── 저장소에 닿지 않는다 ──
 *
 * DB 쿼리를 한 번도 보내지 않는다. sqlClient()는 접속 문자열 유무를 보고 클라이언트를
 * 만들 뿐이라(store.ts) 이 호출만으로는 연결도 요청도 일어나지 않는다.
 * 저장소를 준비하는 경로(ensureTable·ensureOrdersMigration 등)에도 들어가지 않으므로
 * CREATE도 ALTER도 나가지 않는다.
 *
 * 후보 건수를 여기서 세지 않는 이유는 cleanupPreflightAdminApi.ts에 적어 두었다.
 * 요약하면, 세려면 스키마를 먼저 바꿔야 해서 "확인하는 자리"가 아니게 된다.
 *
 * 응답에는 개인정보도 접속 정보도 담지 않는다. DB 모드 여부(참/거짓)뿐이다.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/chatInquiryApi";
import {
  runCleanupPreflight,
  toCleanupPreflightResponse,
} from "@/lib/server/cleanupPreflightAdminApi";
import { sqlClient } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // 1) 관리자 확인이 가장 먼저다.
  const denied = await requireAdmin();
  if (denied) return denied;

  // 2) 기준 시각은 여기서 한 번만 만든다. 그대로 checkedAt이 된다.
  const now = new Date().toISOString();

  const response = toCleanupPreflightResponse(
    runCleanupPreflight(
      {
        /*
         * 접속 문자열을 넘기지 않는다. 클라이언트를 만들 수 있는지 여부만 본다.
         * DATABASE_URL을 읽는 곳은 store.ts 하나로 둔다.
         */
        databaseMode: () => sqlClient() !== null,
      },
      now,
    ),
  );
  return NextResponse.json(response.body, { status: response.status });
}
