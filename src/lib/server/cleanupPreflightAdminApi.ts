/**
 * Production 최초 정리 직전의 사전 확인 (Privacy-Cleanup-Preflight-1, -3에서 축소).
 *
 * 이 모듈은 아무것도 읽지도 쓰지도 않는다. 넘겨받은 참/거짓 하나를 정리해 돌려줄 뿐이다.
 *
 * ── 왜 DB 모드 확인 하나로 줄였나 (Privacy-Cleanup-Preflight-3) ──
 *
 * 처음에는 보관 만료 정리 후보 건수도 함께 보았다. 그러려면 후보 찾기를 불러야
 * 하는데, 그 경로는 저장소를 준비하는 과정(ensureTable·ensureOrdersMigration)을
 * 지나며 CREATE·ALTER를 보낸다. "확인만 하는 자리"가 스키마를 바꾸는 셈이었다.
 *
 * 게다가 그 건수는 지금 Production에서 셀 수 없다. 후보 판정에 쓰는 orders의
 * delivered_at·retention_scrubbed_at이 아직 없어서, 컬럼을 만드는 ALTER가 먼저
 * 일어나야만 답이 나온다. 확인하려고 바꾸는 순서가 된다.
 *
 * 건수는 정리를 실제로 돌릴 때 그 결과가 이미 돌려준다
 * (RetentionCleanupSummary.discovered). 같은 값을 두 경로로 구하지 않는다.
 * 스키마를 바꾸는 일은 실제로 정리하는 자리 한 곳에 모은다.
 *
 * ── 내보내지 않는 것 ──
 *
 * DATABASE_URL 값도, 접속 정보(host·user·password)도 담지 않는다.
 * databaseMode는 참/거짓 하나뿐이다.
 */

/**
 * 사전 확인에 필요한 바깥 세계. 참/거짓을 주는 함수 하나뿐이다.
 *
 * 저장소를 읽는 수단도 쓰는 수단도 두지 않는다. 둘 수 없게 해 두면 나중에도
 * 이 자리에서 저장소에 닿을 수 없다.
 *
 * databaseMode는 store.ts가 sqlClient() 유무로 정한다. 이 모듈은 process.env를
 * 보지 않는다(저장소를 아는 곳을 store.ts 하나로 두는 기존 경계를 그대로 따른다).
 */
export interface CleanupPreflightDeps {
  /** DB 모드인지. 참/거짓만 받는다. 접속 문자열을 받지 않는다. */
  databaseMode: () => boolean;
}

/** 사전 확인 결과. 세 값뿐이다. */
export interface CleanupPreflightResult {
  /** 기준 시각(ISO). 이 답이 언제의 사실인지를 적어 둔다. */
  checkedAt: string;
  /** 지금 Production 정리를 시작해도 되는 상태인지. */
  cleanupReady: boolean;
  /** DB 모드 여부. 값이 아니라 여부다. */
  databaseMode: boolean;
}

/** 관리자에게 돌려줄 응답. */
export interface CleanupPreflightResponse {
  status: number;
  body: CleanupPreflightResult;
}

/**
 * 사전 확인을 한 번 한다.
 *
 * now는 밖에서 받는다. 요청 처리 시작 시각 하나를 그대로 적기 위해서다.
 * 함수 안에서 만들면 부른 시각과 적힌 시각이 갈라진다.
 *
 * cleanupReady는 databaseMode와 같다. 지금 이 자리에서 확인할 수 있는 조건이
 * 그것뿐이기 때문이다. 조건을 더 얹으려면 저장소를 읽어야 하고, 그 순간 이 자리는
 * 더 이상 읽기만 하는 자리가 아니게 된다.
 */
export function runCleanupPreflight(
  deps: CleanupPreflightDeps,
  now: string,
): CleanupPreflightResult {
  const databaseMode = deps.databaseMode();
  return { checkedAt: now, cleanupReady: databaseMode, databaseMode };
}

/**
 * 결과를 응답으로 바꾼다.
 *
 * 상태 코드는 언제나 200이다. 확인 자체는 끝났고, 준비되지 않았다는 것도 확인의
 * 결과이지 요청의 실패가 아니다. 관리자는 cleanupReady를 보고 판단한다.
 */
export function toCleanupPreflightResponse(
  result: CleanupPreflightResult,
): CleanupPreflightResponse {
  return { status: 200, body: result };
}
