/**
 * 인증번호·단기 토큰 저장소.
 *
 * 예전에는 이 값들이 app_store JSONB의 codes 안에 함께 들어 있었다.
 * 인증 한 번마다 app_store 전체의 version이 올라가 관계없는 요청끼리 겹쳤기 때문에
 * verification_codes 테이블로 옮긴다.
 *
 * 이 파일이 지키는 규칙은 세 가지다.
 *
 * 1. 새로 만드는 값은 verification_codes에만 쓴다. app_store.codes에는 더 쓰지 않는다.
 * 2. 읽을 때는 verification_codes를 먼저 보고, 없을 때만 app_store.codes를 본다.
 *    이 fallback은 이 전환 이전에 발급되어 아직 TTL이 살아 있는 인증만 살리기 위한
 *    임시 경로다. 가장 긴 TTL이 15분이라 그 시간이 지나면 쓰이지 않는다.
 * 3. DATABASE_URL이 없는 파일 모드에서는 예전처럼 app_store.codes만 쓴다.
 *
 * 값을 어디서 읽었는지는 VerificationSource로 구분한다. 소비하는 방법이 다르기 때문이다.
 * - "table"  : verification_codes에서 지운다. app_store와 함께 지워야 하면
 *              store.ts의 writeDataWithVerificationConsumes로 한 문장에 묶는다.
 * - "legacy" : app_store.codes에서 지운다. 이 값은 어차피 app_store JSONB 안에 있어서
 *              기존처럼 writeData 한 번이면 회원 변경과 같은 트랜잭션이 된다.
 *
 * TTL·쿨다운·시도 횟수 같은 규칙은 옮기기 전과 똑같다. 여기서 새로 만들지 않는다.
 */
import { ensureTable, readData, sqlClient, writeData } from "@/lib/server/store";
import type { AppData, VerificationCode } from "@/lib/types/app";

/** 값을 어디서 읽었는지. 소비 방법이 달라서 반드시 함께 들고 다닌다. */
export type VerificationSource = "table" | "legacy";

/** 저장된 인증 1건. app_store.codes의 VerificationCode와 뜻이 같다. */
export interface VerificationRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  /** 재발송 쿨다운 계산에만 쓴다. 토큰에는 값이 없다. */
  sentAt: number | null;
  source: VerificationSource;
}

/** epoch ms를 TIMESTAMPTZ로 넘기기 위한 값. SQL 쪽에서 to_timestamp로 되돌린다. */
function toSeconds(ms: number): number {
  return ms / 1000;
}

interface CodeRow {
  code: string;
  expires_at_ms: string | number;
  attempts: string | number;
  sent_at_ms: string | number | null;
}

const SELECT_COLUMNS = `
  code,
  (EXTRACT(EPOCH FROM expires_at) * 1000)::bigint AS expires_at_ms,
  attempts,
  (EXTRACT(EPOCH FROM sent_at) * 1000)::bigint AS sent_at_ms
`;

function toRecord(row: CodeRow): VerificationRecord {
  return {
    code: row.code,
    expiresAt: Number(row.expires_at_ms),
    attempts: Number(row.attempts ?? 0),
    sentAt: row.sent_at_ms === null ? null : Number(row.sent_at_ms),
    source: "table",
  };
}

/** app_store.codes에 남아 있는 예전 값. 필드 이름만 맞춰 준다. */
function toLegacyRecord(saved: VerificationCode): VerificationRecord {
  return {
    code: saved.code,
    expiresAt: saved.expiresAt,
    attempts: saved.attempts ?? 0,
    sentAt: saved.sentAt ?? null,
    source: "legacy",
  };
}

/**
 * 인증 1건을 읽는다. 만료된 값은 없는 것으로 본다.
 *
 * data를 넘기면 verification_codes에 없을 때 그 내용의 codes를 fallback으로 본다.
 * 파일 모드에서는 fallback만 쓴다.
 */
export async function readVerification(
  storageKey: string,
  data?: AppData,
): Promise<VerificationRecord | null> {
  const now = Date.now();
  const sql = sqlClient();

  if (sql) {
    await ensureTable(sql);
    const rows = (await sql.query(
      `SELECT ${SELECT_COLUMNS} FROM verification_codes WHERE storage_key = $1`,
      [storageKey],
    )) as CodeRow[];
    if (rows[0]) {
      const record = toRecord(rows[0]);
      // 만료된 값은 없는 것으로 보고 그 자리에서 치운다(예전 checkCode와 같은 방식).
      if (record.expiresAt < now) {
        await deleteVerification(storageKey);
        return null;
      }
      return record;
    }
    // DB 모드에서는 verification_codes가 유일한 저장소다.
    // 값이 없으면 없는 것으로 확정하고 app_store.codes로 내려가지 않는다.
    return null;
  }

  // 파일 모드 전용 경로. DATABASE_URL이 없을 때만 여기까지 온다.
  const saved = data?.codes?.[storageKey];
  if (!saved) return null;
  if (saved.expiresAt < now) return null;
  return toLegacyRecord(saved);
}

/**
 * 인증번호를 발급한다. 같은 키로의 재발송은 쿨다운이 지난 뒤에만 된다.
 *
 * 조회와 저장을 한 문장으로 합쳐, 같은 순간 두 번 눌러도 한 번만 발송되게 한다.
 * 쿨다운에 걸리면 남은 초를 돌려준다(기존 429 문구를 그대로 쓰기 위해서다).
 */
export async function issueCode(input: {
  storageKey: string;
  code: string;
  expiresAt: number;
  sentAt: number;
  cooldownMs: number;
}): Promise<{ ok: true } | { ok: false; waitSeconds: number }> {
  const sql = sqlClient();

  if (!sql) {
    // 파일 모드. 예전 동작 그대로 app_store.codes에 쓴다.
    const data = await readData();
    const saved = data.codes[input.storageKey];
    const left = saved?.sentAt ? saved.sentAt + input.cooldownMs - Date.now() : 0;
    if (left > 0) return { ok: false, waitSeconds: Math.ceil(left / 1000) };
    data.codes[input.storageKey] = {
      code: input.code,
      expiresAt: input.expiresAt,
      attempts: 0,
      sentAt: input.sentAt,
    };
    await writeData(data);
    return { ok: true };
  }

  await ensureTable(sql);
  const rows = (await sql.query(
    `
      INSERT INTO verification_codes (storage_key, code, expires_at, attempts, sent_at)
      VALUES ($1, $2, to_timestamp($3), 0, to_timestamp($4))
      ON CONFLICT (storage_key) DO UPDATE
        SET code = EXCLUDED.code,
            expires_at = EXCLUDED.expires_at,
            attempts = 0,
            sent_at = EXCLUDED.sent_at
        WHERE verification_codes.sent_at IS NULL
           OR verification_codes.sent_at <= to_timestamp($5)
      RETURNING storage_key
    `,
    [
      input.storageKey,
      input.code,
      toSeconds(input.expiresAt),
      toSeconds(input.sentAt),
      toSeconds(input.sentAt - input.cooldownMs),
    ],
  )) as { storage_key: string }[];
  if (rows[0]) return { ok: true };

  // 저장되지 않았다면 쿨다운이 남아 있다는 뜻이다. 남은 초를 다시 읽어 알려 준다.
  const current = (await sql.query(
    `SELECT (EXTRACT(EPOCH FROM sent_at) * 1000)::bigint AS sent_at_ms
       FROM verification_codes WHERE storage_key = $1`,
    [input.storageKey],
  )) as { sent_at_ms: string | number | null }[];
  const sentAt = current[0]?.sent_at_ms == null ? 0 : Number(current[0].sent_at_ms);
  const left = sentAt + input.cooldownMs - Date.now();
  return { ok: false, waitSeconds: left > 0 ? Math.ceil(left / 1000) : 1 };
}

/**
 * 단기 토큰을 저장한다. 쿨다운도 시도 횟수도 없는 값이라 조건 없이 덮어쓴다.
 * signup/reset/link, 소셜 연결 대기, 탈퇴 재인증이 모두 이 함수를 쓴다.
 */
export async function putToken(input: {
  storageKey: string;
  code: string;
  expiresAt: number;
}): Promise<void> {
  const sql = sqlClient();

  if (!sql) {
    const data = await readData();
    data.codes[input.storageKey] = { code: input.code, expiresAt: input.expiresAt };
    await writeData(data);
    return;
  }

  await ensureTable(sql);
  await sql.query(
    `
      INSERT INTO verification_codes (storage_key, code, expires_at, attempts, sent_at)
      VALUES ($1, $2, to_timestamp($3), 0, NULL)
      ON CONFLICT (storage_key) DO UPDATE
        SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = NULL
    `,
    [input.storageKey, input.code, toSeconds(input.expiresAt)],
  );
}

/** 인증 1건을 지운다. 없으면 아무 일도 일어나지 않는다. */
export async function deleteVerification(storageKey: string): Promise<void> {
  const sql = sqlClient();
  if (!sql) return;
  await ensureTable(sql);
  await sql.query(`DELETE FROM verification_codes WHERE storage_key = $1`, [storageKey]);
}

/**
 * 내가 방금 저장한 값일 때만 지운다. SMS 발송에 실패했을 때 쓴다.
 * 그 사이 다른 요청이 새 코드를 저장했다면 지우면 안 되므로 code와 sent_at을 함께 본다.
 */
export async function deleteIssuedCode(input: {
  storageKey: string;
  code: string;
  sentAt: number;
}): Promise<void> {
  const sql = sqlClient();
  if (!sql) {
    const data = await readData();
    const saved = data.codes[input.storageKey];
    if (saved && saved.code === input.code && saved.sentAt === input.sentAt) {
      delete data.codes[input.storageKey];
      await writeData(data);
    }
    return;
  }
  await ensureTable(sql);
  await sql.query(
    `
      DELETE FROM verification_codes
      WHERE storage_key = $1 AND code = $2 AND sent_at = to_timestamp($3)
    `,
    [input.storageKey, input.code, toSeconds(input.sentAt)],
  );
}

/**
 * 틀린 인증번호를 넣었을 때 시도 횟수를 1 올린다.
 * 정해진 횟수를 넘기면 그 자리에서 폐기한다(기존 checkCode와 같은 규칙).
 */
export async function registerFailedAttempt(input: {
  storageKey: string;
  maxAttempts: number;
  source: VerificationSource;
  /** legacy 값일 때 시도 횟수를 올릴 저장 내용. 저장은 호출부가 한다. */
  data?: AppData;
}): Promise<void> {
  if (input.source === "legacy") {
    const saved = input.data?.codes?.[input.storageKey];
    if (!saved) return;
    const attempts = (saved.attempts ?? 0) + 1;
    if (attempts >= input.maxAttempts) delete input.data!.codes[input.storageKey];
    else saved.attempts = attempts;
    return;
  }

  const sql = sqlClient();
  if (!sql) return;
  await ensureTable(sql);
  const rows = (await sql.query(
    `
      UPDATE verification_codes
      SET attempts = attempts + 1
      WHERE storage_key = $1
      RETURNING attempts
    `,
    [input.storageKey],
  )) as { attempts: string | number }[];
  if (rows[0] && Number(rows[0].attempts) >= input.maxAttempts) {
    await deleteVerification(input.storageKey);
  }
}

/**
 * 토큰 1건을 그 자리에서 소비한다. app_store를 함께 바꾸지 않는 경로에서만 쓴다.
 * 조건에 맞는 행을 지우면서 값을 돌려주므로 같은 토큰으로 두 번 통과할 수 없다.
 *
 * 새 테이블에 없으면 app_store.codes도 본다. 전환 이전에 발급된 토큰을 살리기 위해서다.
 */
export async function consumeVerification(
  storageKey: string,
  expectedCode: string | null,
): Promise<VerificationRecord | null> {
  const sql = sqlClient();

  if (sql) {
    await ensureTable(sql);
    const rows = (await sql.query(
      `
        DELETE FROM verification_codes
        WHERE storage_key = $1
          AND ($2::text IS NULL OR code = $2::text)
          AND expires_at > now()
        RETURNING ${SELECT_COLUMNS}
      `,
      [storageKey, expectedCode],
    )) as CodeRow[];
    if (rows[0]) return toRecord(rows[0]);
    // DB 모드에서는 지우지 못했으면 소비 실패로 확정한다.
    // app_store.codes로 내려가면 관계없는 app_store version이 올라간다.
    return null;
  }

  // 파일 모드 전용 경로. DATABASE_URL이 없을 때만 여기까지 온다.
  const data = await readData();
  const saved = data.codes[storageKey];
  if (!saved) return null;
  if (expectedCode !== null && saved.code !== expectedCode) return null;
  delete data.codes[storageKey];
  await writeData(data);
  if (saved.expiresAt < Date.now()) return null;
  return toLegacyRecord(saved);
}

/**
 * 인증번호 검증 결과. 맞으면 어디서 읽었는지(source)를 함께 돌려준다.
 * 소비는 여기서 하지 않는다. 회원 변경과 함께 지워야 하는 경로가 있기 때문이다.
 */
export type CheckResult =
  | { ok: true; source: VerificationSource }
  // source가 "legacy"면 app_store 쪽 값이 바뀌었다는 뜻이라 호출부가 저장해야 남는다.
  // null이면 저장할 것이 없으므로 app_store를 건드리지 않는다.
  | { ok: false; error: string; source: VerificationSource | null };

/**
 * 예전 route.ts의 checkCode와 같은 규칙이다.
 * 없거나 만료면 폐기하고 실패, 맞으면 성공, 틀리면 시도 횟수를 올리고
 * 정해진 횟수를 넘기면 폐기한다.
 *
 * legacy 값의 시도 횟수는 넘겨받은 data 위에서만 올린다. 저장은 호출부가 한다.
 */
export async function checkCode(input: {
  data: AppData;
  storageKey: string;
  input: string;
  maxAttempts: number;
}): Promise<CheckResult> {
  const message = "인증번호가 올바르지 않습니다.";
  const saved = await readVerification(input.storageKey, input.data);
  if (!saved) {
    // 만료된 legacy 값이 남아 있으면 예전처럼 함께 치운다.
    const hadLegacy = Boolean(input.data.codes[input.storageKey]);
    if (hadLegacy) delete input.data.codes[input.storageKey];
    return { ok: false, error: message, source: hadLegacy ? "legacy" : null };
  }

  if (saved.code === input.input && input.input.length > 0) {
    return { ok: true, source: saved.source };
  }

  await registerFailedAttempt({
    storageKey: input.storageKey,
    maxAttempts: input.maxAttempts,
    source: saved.source,
    data: input.data,
  });
  if (saved.attempts + 1 >= input.maxAttempts) {
    return {
      ok: false,
      error: "인증 시도 횟수를 초과했습니다. 인증번호를 다시 받아주세요.",
      source: saved.source,
    };
  }
  return { ok: false, error: message, source: saved.source };
}
