/**
 * 관리자 전용 문의 잔존 현황 확인 (Privacy-Inquiries-Chat-Diagnostic-2).
 *
 * 사람이 손으로 한 번 눌러 보는 자리다. 일정에 따라 스스로 돌지 않고, 다른 화면이나
 * API가 지나가는 길에 함께 불리지도 않는다. 이 경로 하나만 부른다.
 *
 * 이 파일이 하는 일은 셋뿐이다. 관리자인지 확인하고, 기준 시각을 한 번 만들고,
 * 정해진 질의들을 보낼 수단을 규칙 모듈에 넘긴다. 판단도 질의문도
 * inquiriesLegacyAggregate.ts에 있다. 여기에는 SQL도, 조건도, 새 인증도 없다.
 *
 * 아무것도 바꾸지 않는다. 보내는 문장은 SELECT뿐이고, 여러 번 불러도 결과 외에는
 * 달라지는 것이 없다. 저장소를 준비하는 경로(readData·ensureTable·ensureAppStoreVersion)에
 * 들어가지 않으므로 CREATE도 ALTER도 나가지 않는다.
 *
 * 응답에는 건수와 시각만 담긴다. 이름·연락처·문의 내용·메시지 본문·userId·
 * guest token과 SQL·접속 정보·받은 오류는 담지 않는다.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/chatInquiryApi";
import {
  CHAT_INQUIRIES_AGGREGATE_SQL,
  CHAT_TABLES_PRESENT_SQL,
  LEGACY_INQUIRIES_AGGREGATE_SQL,
  runInquiriesLegacyAggregate,
} from "@/lib/server/inquiriesLegacyAggregate";
import { sqlClient } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // 1) 관리자 확인이 가장 먼저다. 여기서 막히면 질의를 한 번도 보내지 않는다.
  const denied = await requireAdmin();
  if (denied) return denied;

  // 2) 기준 시각은 여기서 한 번만 만든다. 그대로 checkedAt이 된다.
  const now = new Date().toISOString();

  /*
   * 접속 문자열을 넘기지 않는다. 클라이언트를 만들 수 있는지 여부와, 정해진 질의를
   * 보내는 수단만 넘긴다. DATABASE_URL을 읽는 곳은 store.ts 하나로 둔다.
   */
  const sql = sqlClient();
  const send = async (text: string) => {
    if (!sql) throw new Error("database mode required");
    return (await sql.query(text)) as readonly Record<string, unknown>[];
  };

  const response = await runInquiriesLegacyAggregate(
    {
      databaseMode: () => sql !== null,
      // 보낼 문장은 모듈이 정한 상수들뿐이다. 이 자리에서 만들지 않는다.
      queryChatTablesPresent: () => send(CHAT_TABLES_PRESENT_SQL),
      queryLegacyInquiries: () => send(LEGACY_INQUIRIES_AGGREGATE_SQL),
      queryChatInquiries: () => send(CHAT_INQUIRIES_AGGREGATE_SQL),
    },
    now,
  );
  return NextResponse.json(response.body, { status: response.status });
}
