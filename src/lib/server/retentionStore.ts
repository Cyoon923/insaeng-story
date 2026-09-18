/**
 * 보관 만료 정리의 저장소 경계 (Privacy-Retention-Store-Split-1).
 *
 * 보관 만료 정리가 DB에 닿는 곳은 이 파일 하나뿐이다. store.ts에서 이리로 옮겨 왔고,
 * 옮기면서 바꾼 것은 **무엇을 읽고 언제 스키마를 바꾸는가** 둘뿐이다. 판정 규칙과
 * 지우는 범위는 순수 모듈들이 그대로 정한다(이 파일에는 그 규칙이 없다).
 *
 * ── 왜 나누는가 ──
 *
 * store.ts에는 주문·결제·회원·환불·적립금이 함께 있다. 정리 기능만 따로 배포하려면
 * 그 전부가 따라와야 했다. 정리가 실제로 필요한 것은 app_store 저장 규약과
 * orders·payments 문장 몇 개뿐이라, 그만 떼어 이 파일에 둔다.
 *
 * store.ts는 이 파일을 import하지 않는다. 방향은 언제나 한쪽이다
 * (retentionStore → store). 그래서 일반 주문·결제 경로가 정리 코드에 닿을 일이 없다.
 *
 * ── 스키마를 바꾸는 곳은 하나뿐이다 ──
 *
 * 보관 만료 전용 ALTER는 ensureRetentionSchema 안에서만 나간다. 후보 찾기도 정리
 * 실행도 열을 만들지 않는다. 관리자가 prepare-schema를 명시적으로 부르기 전에는
 * 어떤 일반 요청도 이 DDL에 닿을 수 없다.
 *
 * 더하는 열은 orders.retention_scrubbed_at 하나뿐이다. 전달 시각·제작 착수 시각·
 * 신청 동의는 여기서 만들지 않는다. 뜻이 다른 값이고 이 기능의 조건도 아니다.
 *
 * ── 완료 증빙은 app_store에서 읽는다 ──
 *
 * 주문의 전달 시각과 상담의 완료 시각은 상태 변경 경로가 JSONB에만 남긴다.
 * 그래서 후보 찾기도 JSONB만 본다. orders 테이블에 같은 이름의 열을 만들어
 * 일반 조회 경로가 그 열을 읽게 하면, 정리를 부르기도 전에 스키마가 바뀐다.
 *
 * ── 남기는 값 ──
 *
 * 결과에도 기록에도 개인정보를 담지 않는다. 받은 오류도 그대로 올리지 않는다.
 */
import { findRetentionCandidates } from "@/lib/server/retentionDiscovery";
import { runLegacyCodesCleanup } from "@/lib/server/legacyCodesCleanup";
import { planOrphanConsultationScrub } from "@/lib/server/retentionOrphanScrubPlan";
import { planRetentionScrub } from "@/lib/server/retentionScrubPlan";
import { RETENTION_KEPT_DETAIL_KEYS } from "@/lib/server/retentionScrub";
import { runRetentionCleanup } from "@/lib/server/retentionCleanupRunner";
import { runRetentionScrubWithRetry } from "@/lib/server/retentionScrubRetry";
import {
  AppStoreConflictError,
  appStoreCas,
  ensureTable,
  isAppStoreConflict,
  readData,
  sqlClient,
  writeData,
} from "@/lib/server/store";
import type { DiscoveryOrderRow, RetentionCandidate } from "@/lib/server/retentionDiscovery";
import type { LegacyCodesCleanupResult } from "@/lib/server/legacyCodesCleanup";
import type { OrphanScrubBlockedReason } from "@/lib/server/retentionOrphanScrubPlan";
import type { RetentionCleanupSummary } from "@/lib/server/retentionCleanupRunner";
import type { RetentionScrubBlockedReason } from "@/lib/server/retentionScrubPlan";
import type { AppData } from "@/lib/types/app";

/* ------------------------------------------------------------------ *
 * 보관 만료 전용 스키마
 * ------------------------------------------------------------------ */

/**
 * 보관 만료 정리가 쓰는 열을 더한다. 더하는 것은 하나뿐이다.
 *
 * retention_scrubbed_at은 "이 주문의 정리가 전부 끝난 시각"이다. 기존 행은 NULL로
 * 남는다("아직 하지 않음"). 값을 소급해 채우지 않는다.
 *
 * ALTER는 바꿀 것이 없어도 테이블 잠금을 잡는다. 그래서 아무 요청이나 지나가는
 * 자리에 두지 않고, 관리자가 부르는 ensureRetentionSchema 안에서만 실행한다.
 * 여러 번 실행해도 안전하다(IF NOT EXISTS).
 */
async function runRetentionOrdersColumn(sql: NonNullable<ReturnType<typeof sqlClient>>) {
  await sql.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS retention_scrubbed_at TIMESTAMPTZ`,
  );
}

/** 서버 인스턴스당 한 번만 실행하기 위한 기억. 실패하면 지워서 다음에 다시 시도한다. */
let retentionColumn: Promise<void> | null = null;

function ensureRetentionOrdersColumn(
  sql: NonNullable<ReturnType<typeof sqlClient>>,
): Promise<void> {
  if (!retentionColumn) {
    retentionColumn = runRetentionOrdersColumn(sql).catch((error) => {
      retentionColumn = null;
      throw error;
    });
  }
  return retentionColumn;
}

/* ------------------------------------------------------------------ *
 * 보관 만료 정리 (Privacy-Retention-Execution-1)
 * ------------------------------------------------------------------ */

/**
 * 보관 만료 정리 결과.
 *
 * blocked는 오류가 아니라 규칙이다. 아직 지울 때가 아니거나 판정할 근거가 없다는
 * 뜻이며, 이때 app_store도 orders도 payments도 하나도 바뀌지 않는다.
 * 저장이 겹쳐 밀린 경우(CAS 충돌)는 기존 관례대로 AppStoreConflictError를 던진다.
 */
export type RetentionScrubResult =
  | { applied: true; scrubbedAt: string; alreadyScrubbed: boolean }
  | { applied: false; reason: RetentionScrubBlockedReason };

/**
 * 보관 기간이 끝난 주문 1건의 콘텐츠성 개인정보를 **한 성공 경계 안에서** 지운다.
 *
 * 한 문장 안에서 함께 성립하거나 함께 없는 것:
 *   1) app_store.data.orders[]        대상 Order.details를 allowlist 결과로 교체
 *   2) app_store.data.consultations[] 상담 주문이면 같은 id 상담의 details 교체 + purpose 제거
 *   3) orders 테이블                  같은 id의 details를 **같은 allowlist**로 교체
 *   4) payments                       이 주문에 이미 연결된 결제의 order_snapshot에서
 *                                     details와 request.purpose 제거
 *   5) orders.retention_scrubbed_at   위가 전부 성립했을 때만 최초 1회 기록
 *
 * 따로 쓰면 "JSONB는 깨끗한데 orders 테이블에는 이름·연락처가 남는" 상태가 생긴다.
 * 그런데 운영의 읽기 경로가 바로 그 orders 테이블이라(getOrderById·listOrdersByUser)
 * 부분 성공은 곧 개인정보가 계속 조회된다는 뜻이다. 그래서 한 문장으로 묶는다
 * (writeDataWithOrderForPayment가 쓰는 것과 같은 방식이다).
 *
 * ── 대상 판정을 호출부가 우회할 수 없다 ──
 * 받는 것은 주문 id와 현재 시각뿐이다. 지울 대상도 남길 키도 호출부가 고르지 않는다.
 * 판정은 언제나 planRetentionScrub → decideRetentionEligibility 한 길을 거치고,
 * eligible이 아니면 SQL을 보내지 않는다(write 0).
 *
 * ── 결제 fail-closed ──
 * payments는 `order_id = <대상 주문 id>`인 행만 고른다.
 * order_id가 NULL인 결제는 SQL에서 NULL = 'o-1'이 참이 될 수 없어 절대 걸리지 않는다.
 * 그 스냅샷은 recommit이 주문을 되살리는 유일한 입력이라 여기서 건드리면 안 된다.
 * 다른 주문의 결제도 같은 조건으로 제외된다.
 *
 * ── details를 SQL에서도 allowlist로 다룬다 ──
 * details는 클라이언트가 임의 키를 섞을 수 있는 자리라 "지울 키 나열"로는 샌다.
 * 남길 키 목록은 TS와 SQL이 갈라지지 않도록 RETENTION_KEPT_DETAIL_KEYS 하나에서
 * 나온다. TS는 pickRetentionDetails가, SQL은 같은 배열을 $n::text[]로 받아 쓴다.
 *
 * 짝이 되는 Order가 없는 Consultation은 이번 단계의 대상이 아니다(planRetentionScrub 주석 참고).
 */
export async function scrubOrderForRetentionOnce(
  data: AppData,
  orderId: string,
  now: string,
): Promise<RetentionScrubResult> {
  const planned = planRetentionScrub(data, orderId, now);
  if (!planned.ok) return { applied: false, reason: planned.reason };
  const { order, consultation, orderDetails, consultationDetails, scrubbedAt } = planned.plan;

  /*
   * 정리한 상태로 직렬화하기 위해 data를 직접 바꾼다(다른 store 함수들과 같다.
   * 사본을 만들면 기준 version을 잃는다). 저장이 성립하지 않으면 아래에서 되돌린다.
   */
  const previousOrderDetails = order.details;
  const previousScrubbedAt = order.retentionScrubbedAt;
  const previousConsultDetails = consultation?.details;
  const previousPurpose = consultation?.purpose;
  const hadPurpose = consultation ? "purpose" in consultation : false;

  const revert = () => {
    order.details = previousOrderDetails;
    if (previousScrubbedAt === undefined) delete order.retentionScrubbedAt;
    else order.retentionScrubbedAt = previousScrubbedAt;
    if (consultation && previousConsultDetails) consultation.details = previousConsultDetails;
    if (consultation && hadPurpose) consultation.purpose = previousPurpose;
  };

  order.details = orderDetails;
  // 최초값만 남긴다. 이미 기록이 있으면 그대로 둔다(SQL의 COALESCE와 같은 규칙).
  const alreadyScrubbed = Boolean(order.retentionScrubbedAt);
  if (!alreadyScrubbed) order.retentionScrubbedAt = scrubbedAt;
  if (consultation && consultationDetails) {
    consultation.details = consultationDetails;
    // 빈 문자열을 대신 넣지 않는다. 키 자체를 없애 "기록 없음"으로 남긴다.
    delete consultation.purpose;
  }

  const sql = sqlClient();
  if (!sql) {
    // 파일 모드에는 orders·payments 테이블 자체가 없다. JSONB만 저장한다.
    try {
      await writeData(data);
    } catch (error) {
      revert();
      throw error;
    }
    return { applied: true, scrubbedAt: order.retentionScrubbedAt ?? scrubbedAt, alreadyScrubbed };
  }

  /*
   * 준비는 CAS에 필요한 것만 한다. 보관 만료 열(retention_scrubbed_at)은 여기서
   * 만들지 않는다. 그 일은 ensureRetentionSchema 한 곳이 하고, 관리자가 먼저 부른다.
   * 결제 스키마도 건드리지 않는다. 아래 문장이 쓰는 order_snapshot은 원래 있던 열이다.
   */
  await ensureTable(sql);
  await appStoreCas.ensureVersionColumn(sql);
  const expected = appStoreCas.expectedVersion(data);
  const n = appStoreCas.paramCount(expected);

  let rows: { version: string | number | null }[];
  try {
    rows = (await sql.query(
      `
        ${appStoreCas.head(expected)},
        scrubbed_order AS (
          UPDATE orders
          SET details = COALESCE(
                (
                  SELECT jsonb_object_agg(kept.key, kept.value)
                  FROM jsonb_each(orders.details) AS kept
                  WHERE kept.key = ANY($${n + 2}::text[])
                ),
                '{}'::jsonb
              ),
              -- 최초값만 남긴다. 다시 실행해도 처음 시각이 그대로다.
              retention_scrubbed_at = COALESCE(retention_scrubbed_at, $${n + 3}::timestamptz),
              updated_at = now()
          WHERE id = $${n + 1} AND EXISTS (SELECT 1 FROM cas)
        ),
        scrubbed_payment AS (
          /*
           * 지우는 것은 두 가지다. 신청 내용 사본(details)과 상담 목적 사본
           * (request.purpose). 둘 다 같은 주문·상담에 확정본이 있었고, 그 확정본은
           * 이 문장과 같은 성공 경계 안에서 이미 지워진다.
           *
           * request는 통째로 지우지 않는다. 남는 키(product·title·options·payment·
           * report·extraPerson·teacher·datetime·method·option)는 무엇을 어떤 구성으로
           * 팔았는지에 해당하고, 승인 재검증이 읽는 값과 같은 성격이다.
           * purpose만 성격이 다르다. "이 사람이 어떤 고민으로 상담했는가"라서
           * app_store 쪽에서도 키째 지운다(scrubConsultationForRetention).
           * 여기에 남겨 두면 같은 사실이 한쪽에만 남는다.
           *
           * request가 없거나 객체가 아니면 CASE의 ELSE로 가서 details만 빠진다.
           * purpose가 없으면 (request) - 'purpose'가 원래 값을 그대로 돌려주므로
           * 결과가 달라지지 않는다. 어느 경우에도 안전하게 아무 일도 하지 않는다.
           */
          UPDATE payments
          SET order_snapshot = CASE
                WHEN jsonb_typeof(order_snapshot -> 'request') = 'object'
                  THEN jsonb_set(
                         order_snapshot - 'details',
                         '{request}',
                         (order_snapshot -> 'request') - 'purpose'
                       )
                ELSE order_snapshot - 'details'
              END,
              updated_at = now()
          -- 이 주문에 이미 연결된 결제만. order_id가 NULL이면 이 조건이 참이 될 수 없어
          -- recommit의 복구 입력은 그대로 남는다. 다른 주문의 결제도 걸리지 않는다.
          WHERE order_id = $${n + 1}
            -- 지울 것이 하나라도 있을 때만 쓴다. 둘 다 없으면 이 행은 건드리지 않는다.
            AND (
              order_snapshot ? 'details'
              OR (
                jsonb_typeof(order_snapshot -> 'request') = 'object'
                AND (order_snapshot -> 'request') ? 'purpose'
              )
            )
            AND EXISTS (SELECT 1 FROM cas)
        )
        SELECT version FROM cas
      `,
      [
        ...appStoreCas.params(data, expected),
        order.id,
        RETENTION_KEPT_DETAIL_KEYS as unknown as string[],
        scrubbedAt,
      ],
    )) as typeof rows;
  } catch (error) {
    revert();
    throw error;
  }

  // 0행이면 그사이 다른 요청이 저장한 것이다. orders·payments도 함께 되돌아갔다.
  if (!rows[0] || rows[0].version === null || rows[0].version === undefined) {
    revert();
    throw new AppStoreConflictError();
  }
  appStoreCas.advance(data, Number(rows[0].version));
  return { applied: true, scrubbedAt: order.retentionScrubbedAt ?? scrubbedAt, alreadyScrubbed };
}

/**
 * 짝 없는 상담 정리 결과.
 *
 * blocked는 오류가 아니라 규칙이다. 대상이 아니거나 아직 지울 때가 아니라는 뜻이며,
 * 이때 app_store는 하나도 바뀌지 않는다. 저장이 겹쳐 밀린 경우(CAS 충돌)는
 * 기존 관례대로 AppStoreConflictError를 던진다.
 */
export type OrphanScrubResult =
  | { applied: true; scrubbedAt: string; alreadyScrubbed: boolean }
  | { applied: false; reason: OrphanScrubBlockedReason };

/**
 * 짝이 되는 주문이 없는 legacy 상담 1건의 콘텐츠성 개인정보를 지운다.
 *
 * 바꾸는 저장소는 **app_store 하나뿐이다.**
 * orders도 payments도 건드리지 않는다. 문장 자체에 그 테이블이 나오지 않는다.
 *
 * ── 왜 결제를 건드리지 않는가 ──
 * 주문이 없다는 사실은 "결제도 없다"는 뜻이 아니다. 승인은 끝났는데 주문이 만들어지지
 * 않은 결제가 바로 order_id가 NULL인 행이고, 그 order_snapshot.details는 recommit이
 * 주문을 되살리는 유일한 입력이다. 여기서 지우면 그 복구가 영영 불가능해진다.
 * 상담 id·merchantOrderId·userId로 결제를 짐작해 찾지 않는다. 주문을 거치지 않은
 * 연결은 전부 추측이고, 추측으로 결제 기록을 지우지 않는다.
 *
 * ── 대상 판정을 호출부가 우회할 수 없다 ──
 * 받는 것은 상담 id와 현재 시각뿐이다. 지울 대상도 남길 키도 호출부가 고르지 않는다.
 * 짝 주문 확인 → planOrphanConsultationScrub → decideRetentionEligibility 한 길을
 * 거치고, 통과하지 못하면 아무것도 저장하지 않는다(write 0).
 *
 * 주문이 있는 상담은 이 함수의 대상이 아니다. 그쪽은 주문·결제까지 함께 다뤄야 하므로
 * scrubOrderForRetentionOnce를 쓴다.
 */
export async function scrubOrphanConsultationForRetentionOnce(
  data: AppData,
  consultationId: string,
  now: string,
): Promise<OrphanScrubResult> {
  const id = String(consultationId ?? "").trim();
  const sql = sqlClient();

  /*
   * orders 테이블에 같은 id의 주문이 있는지 본다. app_store 사본만 보면
   * 테이블 쪽에만 남아 있는 주문을 놓친다(두 저장소가 어긋날 수 있다).
   * 조회에 실패하면 "있다"로 보고 진행하지 않는다(fail-closed).
   * DB가 없는 환경에는 orders 테이블 자체가 없어 확인할 것이 없다.
   */
  let pairedOrderInSql = false;
  if (sql && id) {
    await ensureTable(sql);
    try {
      const rows = (await sql.query(`SELECT 1 AS found FROM orders WHERE id = $1 LIMIT 1`, [
        id,
      ])) as { found: number }[];
      pairedOrderInSql = rows.length > 0;
    } catch {
      pairedOrderInSql = true;
    }
  }

  const planned = planOrphanConsultationScrub(data, id, now, { pairedOrderInSql });
  if (!planned.ok) return { applied: false, reason: planned.reason };
  const { index, consultation, nextConsultation, scrubbedAt } = planned.plan;

  /*
   * 정리한 상태로 직렬화하기 위해 data를 직접 바꾼다(다른 store 함수들과 같다.
   * 사본을 만들면 기준 version을 잃는다). 저장이 성립하지 않으면 되돌린다.
   */
  const alreadyScrubbed = Boolean(consultation.retentionScrubbedAt);
  const kept = alreadyScrubbed ? consultation.retentionScrubbedAt : scrubbedAt;
  data.consultations[index] = {
    ...nextConsultation,
    // 최초값만 남긴다. 이미 기록이 있으면 그대로 둔다.
    ...(kept ? { retentionScrubbedAt: kept } : {}),
  };

  try {
    // app_store 전체 blob CAS. 밀리면 commitVersion이 AppStoreConflictError를 던진다.
    await writeData(data);
  } catch (error) {
    data.consultations[index] = consultation;
    throw error;
  }
  return { applied: true, scrubbedAt: kept ?? scrubbedAt, alreadyScrubbed };
}

/* ------------------------------------------------------------------ *
 * 보관 만료 정리 재시도 (Privacy-Retention-Retry-1)
 * ------------------------------------------------------------------ */

/**
 * 재시도까지 포함한 결과.
 *
 * cas-conflict는 오류가 아니라 사실이다. 정해진 횟수만큼 모두 겹쳐서 놓쳤다는 뜻이며,
 * 이때 어느 저장소도 바뀌지 않았다. 나중에 다시 부르면 된다.
 */
export type RetentionScrubRetryResult<T> =
  | { ok: true; result: T; attempts: number }
  | { ok: false; reason: "cas-conflict"; attempts: number };

/**
 * 보관 기간이 끝난 주문 1건을 정리한다. 겹쳐서 밀리면 최신 자료로 다시 시도한다.
 *
 * 받는 것은 주문 id와 현재 시각뿐이다. 자료도 계획도 호출부가 넘기지 않는다.
 * **회차마다 readData로 새로 읽고** 그 자료로 판정부터 다시 한다. 밀린 사이에
 * 상태가 달라졌으면 달라진 대로 판단한다(아직 지울 때가 아니게 되었으면 지우지 않는다).
 *
 * 판정과 저장은 scrubOrderForRetentionOnce가 그대로 한다. 이 함수는 언제 다시 부를지만 정한다.
 */
export async function scrubOrderForRetentionWithRetry(
  orderId: string,
  now: string,
): Promise<RetentionScrubRetryResult<RetentionScrubResult>> {
  return runRetentionScrubWithRetry<RetentionScrubResult>({
    readData,
    attempt: (data) => scrubOrderForRetentionOnce(data, orderId, now),
    isConflict: isAppStoreConflict,
  });
}

/**
 * 짝 없는 legacy 상담 1건을 정리한다. 겹쳐서 밀리면 최신 자료로 다시 시도한다.
 *
 * 회차마다 scrubOrphanConsultationForRetentionOnce를 처음부터 다시 부르므로,
 * **짝이 되는 주문이 있는지도 회차마다 다시 확인된다**(app_store와 orders 테이블 양쪽).
 * 밀린 사이에 주문이 생겼다면 그 회차에서 paired-order-exists로 멈춘다. 그 답은
 * 겹침이 아니므로 다시 시도하지 않고 그대로 돌려준다.
 */
export async function scrubOrphanConsultationForRetentionWithRetry(
  consultationId: string,
  now: string,
): Promise<RetentionScrubRetryResult<OrphanScrubResult>> {
  return runRetentionScrubWithRetry<OrphanScrubResult>({
    readData,
    attempt: (data) => scrubOrphanConsultationForRetentionOnce(data, consultationId, now),
    isConflict: isAppStoreConflict,
  });
}

/* ------------------------------------------------------------------ *
 * 보관 만료 정리 스키마 준비 (Privacy-Cleanup-Execution-Core-1)
 * ------------------------------------------------------------------ */

/**
 * 스키마 준비 결과.
 *
 * supported:false는 오류가 아니라 사실이다. DB가 없는 환경에는 준비할 테이블 자체가
 * 없다는 뜻이며, 이때 아무 문장도 보내지 않았다. deleteExpiredVerifications와 같은 모양이다.
 */
export type RetentionSchemaResult = { supported: true } | { supported: false };

/**
 * 보관 만료 정리가 쓰는 자리를 미리 만들어 둔다 (Privacy-Cleanup-Execution-Core-1).
 *
 * 하는 일은 하나다. 이미 있는 준비 함수 셋을 부른다. 그뿐이다.
 * 새 migration 규칙을 여기서 만들지 않는다. 무엇을 만들지는 전부 그 셋이 정한다.
 *
 * ── 왜 따로 두는가 ──
 *
 * 이 파일에서 보관 만료 전용 ALTER를 보내는 곳은 **여기 하나뿐이다.**
 * 후보 찾기도, 정리 실행도 열을 만들지 않는다. 그래서 관리자가 이 action을 명시적으로
 * 부르기 전에는 어떤 요청도 보관 만료 DDL에 닿지 않는다.
 *
 * 준비가 끝나지 않은 채 정리를 부르면 저장문이 실패한다. 그 편이 옳다.
 * 스키마를 바꾸는 순간과 개인정보를 지우는 순간을 사람이 갈라서 확인할 수 있어야 한다.
 *
 * ── 하지 않는 것 ──
 *
 * 읽지 않는다(readData). 쓰지 않는다(writeData·UPDATE·DELETE·INSERT).
 * 정리를 실행하지 않는다. 결제 스키마도 건드리지 않는다.
 * 보관 만료 정리가 쓰는 payments.order_snapshot은 원래 있던 열이다.
 *
 * 여러 번 불러도 안전하다. 셋 모두 IF NOT EXISTS이고, 인스턴스당 한 번만 실제로 나간다.
 */
export async function ensureRetentionSchema(): Promise<RetentionSchemaResult> {
  const sql = sqlClient();
  // DB가 없으면 만들 자리가 없다. 아무 문장도 보내지 않는다(fail-closed).
  if (!sql) return { supported: false };

  await ensureTable(sql);
  await appStoreCas.ensureVersionColumn(sql);
  await ensureRetentionOrdersColumn(sql);
  return { supported: true };
}

/* ------------------------------------------------------------------ *
 * 보관 만료 후보 찾기 (Privacy-Retention-Discovery-1)
 * ------------------------------------------------------------------ */

/**
 * 후보를 읽지 못했다는 신호 (Privacy-Retention-Discovery-Failure-1).
 *
 * 이 오류가 나면 후보 목록을 만들지 못한 것이고, 그때는 아무것도 지우지 않는다.
 * "살펴볼 건이 없었다"와 뜻이 다르다. 그 둘을 같은 값으로 돌려주면 부른 쪽이
 * 정리가 끝났다고 읽는다.
 *
 * 받은 오류를 싣지 않는다(cause도 담지 않는다). 문장·인자·접속 정보가 섞여 있을 수
 * 있어서다. 담는 것은 어느 단계가 막혔는지를 가리키는 고정 문자열뿐이다.
 * AppStoreConflictError와 같은 방식이다.
 */
export class RetentionCandidateLookupError extends Error {
  constructor() {
    super("RETENTION_CANDIDATE_LOOKUP_FAILED");
    this.name = "RetentionCandidateLookupError";
  }
}


/**
 * 지금 살펴볼 만한 보관 만료 **후보**를 읽어 온다. 읽기만 한다.
 *
 * 돌려주는 것은 id뿐이다. 이름·연락처·사연은 물론 userId도 담지 않는다.
 *
 * ★ 후보는 허가가 아니다. 이 목록을 믿고 지우면 안 된다.
 *   실제 실행 경로(scrubOrderForRetentionWithRetry /
 *   scrubOrphanConsultationForRetentionWithRetry)가 최신 자료로 판정부터 다시 한다.
 *   그 사이에 상태가 달라졌으면 그때 멈춘다.
 *
 * ── 어디서 읽는가 ──
 * 주문의 기산점·정리 여부, 상담의 기산점은 전부 app_store에서 읽는다.
 * SQL에 묻는 것은 "orders 테이블에 이 id의 주문이 있는가" 하나뿐이다(짝 확인).
 * 만료 여부의 뜻은 SQL이 정하지 않는다. 날짜 판정은 언제나
 * findRetentionCandidates → decideRetentionEligibility 한 곳이 한다.
 *
 * orders 테이블을 읽지 못하면 RetentionCandidateLookupError를 던진다.
 * 빈 목록으로 이어 가지 않는다. 읽지 못한 것은 "후보가 없다"는 사실이 아니라 실패이고,
 * 그 둘이 같은 값이 되면 부른 쪽이 정리가 끝났다고 읽는다. 던지면 실행 경로가 그 자리에서
 * 멈추므로 한 건도 지우지 않는다.
 *
 * 짝 확인을 하지 못했을 때 orphan 후보를 내지 않는 규칙(sqlOrderIds = null)은 그대로
 * 남겨 둔다. 판정 계층(findRetentionCandidates)의 약속이라 이 경로 하나로 없앨 수 없다.
 */
export async function findRetentionScrubCandidates(
  now: string,
): Promise<RetentionCandidate[]> {
  const data = await readData();
  const appStoreOrderIds = new Set(data.orders.map((item) => item.id));

  /*
   * 기산점(deliveredAt)과 이미 정리했는지(retentionScrubbedAt)는 app_store에서만 읽는다.
   *
   * orders 테이블의 같은 이름 열을 보지 않는다. 그 열을 쓰려면 일반 주문 조회 경로가
   * 먼저 스키마를 바꿔야 하고, 그러면 관리자가 정리를 부르기도 전에 ALTER가 나간다.
   * 완료 증빙은 상태 변경 경로가 JSONB에만 남기므로 여기서도 JSONB만 본다.
   *
   * 판정 규칙은 그대로다. 값을 어디서 읽는지만 한 곳으로 모았다.
   */
  const orders: DiscoveryOrderRow[] = data.orders.map((item) => ({
    id: item.id,
    product: item.product,
    deliveredAt: item.deliveredAt ?? null,
    retentionScrubbedAt: item.retentionScrubbedAt ?? null,
  }));

  const sql = sqlClient();
  if (!sql) {
    /*
     * DB가 없는 환경에는 orders 테이블 자체가 없다. 확인할 것이 없으므로 빈 집합을
     * 넘긴다(확인했고 없었다는 뜻이다). 판정 함수는 SQL 환경과 똑같은 것을 쓴다.
     */
    return findRetentionCandidates(
      {
        orders,
        appStoreOrderIds,
        consultations: data.consultations,
        sqlOrderIds: new Set<string>(),
      },
      now,
    );
  }

  await ensureTable(sql);

  let sqlOrderIds: Set<string>;
  try {
    // 짝 확인용. 원래 있던 열 하나만 읽는다. 보관 만료 열을 보지 않는다.
    const rows = (await sql.query(`SELECT id FROM orders`)) as { id: string }[];
    sqlOrderIds = new Set(rows.map((row) => row.id));
  } catch {
    /*
     * 읽지 못했다. 빈 목록으로 이어 가지 않는다.
     *
     * 이어 가면 돌려주는 값이 "후보 0건"이 되어, 실제로 살펴볼 건이 없었던 경우와
     * 구분되지 않는다. 부른 쪽은 정리가 끝났다고 읽게 된다. 읽지 못한 것은 사실이
     * 아니라 실패이므로 실패로 올린다.
     *
     * 받은 오류는 버린다. 문장·인자·접속 정보가 섞여 있을 수 있다.
     * 남기는 기록은 어느 단계가 막혔는지뿐이고, 개인정보도 id도 담지 않는다.
     */
    console.warn("[retention] candidate lookup failed");
    throw new RetentionCandidateLookupError();
  }

  return findRetentionCandidates(
    { orders, appStoreOrderIds, consultations: data.consultations, sqlOrderIds },
    now,
  );
}

/* ------------------------------------------------------------------ *
 * 보관 만료 정리 수동 실행 (Privacy-Retention-Runner-1)
 * ------------------------------------------------------------------ */

/**
 * 보관 기간이 끝난 건을 찾아 하나씩 정리한다. 사람이 손으로 한 번 부르는 용도다.
 *
 * 되풀이하지 않는다. 일정에 따라 스스로 도는 구조(cron·worker)가 아니며,
 * 부른 만큼만 한 번 돈다.
 *
 * 여기서는 아무것도 판정하지 않는다. 후보 찾기·판정·저장·재시도는 모두 기존
 * 경로가 그대로 한다. 이 함수는 그 셋을 이어 붙이기만 한다.
 *
 * ★ 후보 목록을 삭제 허가로 쓰지 않는다. 각 건은 재시도 wrapper가 최신 자료를
 *   다시 읽어 판정부터 다시 하고, 그 사이에 상태가 달라졌으면 그때 멈춘다.
 *
 * 돌려주는 요약에는 kind와 id, 그리고 정해 둔 사유만 담긴다.
 *
 * limit은 반드시 받는다. 기본값을 두지 않는다. 기본값이 있으면 한도를 정하지 않은
 * 호출이 후보 전체를 지우게 되고, 그 사실이 코드에도 검사에도 드러나지 않는다.
 * 규칙과 검증은 runRetentionCleanup이 그대로 한다. 여기서는 넘기기만 한다.
 */
export async function runRetentionCleanupOnce(
  now: string,
  limit: number,
): Promise<RetentionCleanupSummary> {
  return runRetentionCleanup(
    {
      findCandidates: findRetentionScrubCandidates,
      scrubOrder: scrubOrderForRetentionWithRetry,
      scrubOrphanConsultation: scrubOrphanConsultationForRetentionWithRetry,
    },
    now,
    limit,
  );
}

/* ------------------------------------------------------------------ *
 * app_store.codes 인증정보 정리 (Privacy-Legacy-Codes-Cleanup-1)
 * ------------------------------------------------------------------ */

/**
 * app_store.data.codes에 남은 인증정보를 정리한다.
 *
 * 바꾸는 저장소는 app_store 하나뿐이다. verification_codes 테이블은 건드리지 않는다
 * (그쪽 정리는 deleteExpiredVerifications가 따로 한다. 저장소도 규칙도 다르다).
 *
 * 규칙은 모드에 따라 다르고, 그 판단을 여기서 한다.
 *   DATABASE_URL 있음 → "database". codes는 이미 아무도 읽지 않는 옛 값이라 통째로 비운다.
 *   DATABASE_URL 없음 → "file".     codes가 지금 쓰는 저장소라 기한이 지난 값만 덜어낸다.
 *
 * 규칙 자체와 재시도는 runLegacyCodesCleanup이 한다. 이 함수는 모드를 정하고
 * 저장소를 이어 붙이기만 한다.
 *
 * now는 서버가 만든 시각을 받는다. 파일 모드의 만료 판정에 쓴다.
 */
export async function cleanupLegacyVerificationCodes(
  now: number,
): Promise<LegacyCodesCleanupResult> {
  return runLegacyCodesCleanup(
    {
      mode: sqlClient() ? "database" : "file",
      readData,
      writeData,
      isConflict: isAppStoreConflict,
    },
    now,
  );
}
