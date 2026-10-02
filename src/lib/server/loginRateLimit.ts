/**
 * 로그인 반복 시도 제한(아이디·비밀번호 로그인, 관리자 로그인).
 *
 * 카운터는 기존 verification_codes 테이블에 이 파일 전용 접두어(loginrl:) 키로 둔다.
 * 그 테이블은 정확한 storage_key 단위로만 읽고 지우므로 인증번호 키와 섞이지 않는다.
 * 새 테이블·환경변수는 없다.
 *
 * 규칙
 * - 비밀번호를 확인하기 전에 먼저 1을 올리고(한 문장 UPSERT), 한도를 넘으면 확인하지 않는다.
 *   병렬로 몰아 보내도 창 안에서 한도보다 많이 시도할 수 없다.
 * - 창이 끝난 키는 다음 시도에서 1부터 새로 시작한다.
 * - 성공하면 계정+IP(관리자는 IP) 키만 지운다. IP 전체 키는 다른 사람의 시도까지 담고 있어 지우지 않는다.
 * - 없는 아이디도 입력값 그대로 센다. 잠김 응답은 계정 유무와 무관하게 같다.
 * - 키에는 아이디·IP 원문을 넣지 않고 SHA-256 해시만 넣는다.
 * - DATABASE_URL이 없는 파일 모드(로컬 개발)에서는 아무것도 하지 않는다.
 */
import { createHash } from "node:crypto";
import { isIP } from "node:net";

const WINDOW_MS = 15 * 60 * 1000;

export const LOGIN_LIMITS = {
  /** 일반 로그인: 같은 아이디 + 같은 IP. */
  account: { max: 10, windowMs: WINDOW_MS },
  /** 일반 로그인: 같은 IP 전체(여러 아이디를 훑는 시도). */
  ip: { max: 50, windowMs: WINDOW_MS },
  /** 관리자 로그인: 같은 IP. */
  admin: { max: 5, windowMs: WINDOW_MS },
} as const;

export const LOGIN_RATE_LIMITED_MESSAGE = "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.";

const UNKNOWN_IP = "unknown";

/**
 * 요청 IP. Vercel에서만 프록시 헤더를 믿는다(엣지가 클라이언트 IP로 채운다).
 * x-forwarded-for는 첫 값만 쓰고, 없으면 x-real-ip. IP 형식이 아니면 unknown 한 버킷이다.
 * Vercel 밖에서는 헤더를 누구나 넣을 수 있으므로 읽지 않는다.
 */
export function clientIp(headers: Pick<Headers, "get">, trustProxy: boolean): string {
  if (!trustProxy) return UNKNOWN_IP;
  const forwarded = (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
  const candidate = forwarded || (headers.get("x-real-ip") ?? "").trim();
  return candidate && isIP(candidate) ? candidate : UNKNOWN_IP;
}

/** 이 요청의 IP. 운영(Vercel)에서만 헤더를 쓴다. */
export function requestIp(request: Request): string {
  return clientIp(request.headers, Boolean(process.env.VERCEL));
}

function hashed(parts: string[]): string {
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export function accountAttemptKey(loginId: string, ip: string): string {
  return `loginrl:acct:${hashed([loginId, ip])}`;
}

export function ipAttemptKey(ip: string): string {
  return `loginrl:ip:${hashed([ip])}`;
}

export function adminAttemptKey(ip: string): string {
  return `loginrl:admin:${hashed([ip])}`;
}

/** 카운터 저장소. hit은 이번 시도를 포함한 창 안 횟수, 저장소가 없으면 null. */
export interface LoginAttemptStore {
  hit: (key: string, windowMs: number) => Promise<number | null>;
  /**
   * hit과 같이 센 뒤, 이 창이 끝나기까지 남은 시간(ms)도 함께 준다. 저장소가 없으면 null.
   * 인증번호 발송 제한이 남은 대기시간을 알려 주는 데만 쓴다. 로그인 관문은 쓰지 않는다.
   */
  hitWithWait?: (key: string, windowMs: number) => Promise<{ attempts: number; waitMs: number } | null>;
  clear: (key: string) => Promise<void>;
}

/** 이번 시도까지 세어 한도를 넘었는지. 저장소가 없으면(null) 제한하지 않는다. */
async function over(store: LoginAttemptStore, key: string, limit: { max: number; windowMs: number }) {
  const attempts = await store.hit(key, limit.windowMs);
  return attempts !== null && attempts > limit.max;
}

/**
 * 일반 로그인 관문. 두 키를 모두 센 뒤 하나라도 넘으면 막는다.
 * 통과하면 성공 시 지울 계정+IP 키를 돌려준다.
 */
export async function gatePasswordLogin(
  store: LoginAttemptStore,
  loginId: string,
  ip: string,
): Promise<{ ok: true; accountKey: string } | { ok: false }> {
  const accountKey = accountAttemptKey(loginId, ip);
  const accountOver = await over(store, accountKey, LOGIN_LIMITS.account);
  const ipOver = await over(store, ipAttemptKey(ip), LOGIN_LIMITS.ip);
  return accountOver || ipOver ? { ok: false } : { ok: true, accountKey };
}

/** 관리자 로그인 관문. 통과하면 성공 시 지울 IP 키를 돌려준다. */
export async function gateAdminLogin(
  store: LoginAttemptStore,
  ip: string,
): Promise<{ ok: true; adminKey: string } | { ok: false }> {
  const adminKey = adminAttemptKey(ip);
  return (await over(store, adminKey, LOGIN_LIMITS.admin)) ? { ok: false } : { ok: true, adminKey };
}

/** 이 파일이 쓰는 SQL 기능만. store.ts의 sqlClient() 결과와 같은 모양이다. */
export interface LoginAttemptSql {
  query: (text: string, params: unknown[]) => Promise<unknown>;
}

/**
 * verification_codes 기반 저장소. code는 쓰지 않으므로 빈 문자열이다.
 * 창이 끝난 행은 attempts=1과 새 만료 시각으로 다시 시작한다.
 * sql이 없으면(파일 모드) 세지도 막지도 않는다.
 */
export function loginAttemptStoreFor(
  sql: LoginAttemptSql | null,
  ensure: () => Promise<void> = async () => {},
): LoginAttemptStore {
  if (!sql) {
    return { hit: async () => null, hitWithWait: async () => null, clear: async () => {} };
  }
  /*
   * 카운터 UPSERT. hit과 hitWithWait가 같은 문장을 쓰고 RETURNING만 다르다.
   * 막힌 요청도 attempts만 늘고 expires_at은 그대로라, 창의 끝(해제 시각)은 늘어나지 않는다.
   */
  const upsert = (returning: string, key: string, windowMs: number) =>
    sql.query(
      `
          INSERT INTO verification_codes (storage_key, code, expires_at, attempts)
          VALUES ($1, '', now() + ($2::bigint * interval '1 millisecond'), 1)
          ON CONFLICT (storage_key) DO UPDATE SET
            attempts = CASE
              WHEN verification_codes.expires_at <= now() THEN 1
              ELSE verification_codes.attempts + 1
            END,
            expires_at = CASE
              WHEN verification_codes.expires_at <= now()
                THEN now() + ($2::bigint * interval '1 millisecond')
              ELSE verification_codes.expires_at
            END
          RETURNING ${returning}
        `,
      [key, windowMs],
    );
  return {
    hit: async (key, windowMs) => {
      await ensure();
      const rows = (await upsert("attempts", key, windowMs)) as { attempts: number | string }[];
      return Number(rows[0]?.attempts ?? 0);
    },
    hitWithWait: async (key, windowMs) => {
      await ensure();
      // 남은 시간은 DB 시계로 잰다(expires_at과 같은 시계라 서버 간 시차가 끼지 않는다).
      const rows = (await upsert(
        "attempts, GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expires_at - now())) * 1000))::bigint AS wait_ms",
        key,
        windowMs,
      )) as { attempts: number | string; wait_ms: number | string }[];
      return { attempts: Number(rows[0]?.attempts ?? 0), waitMs: Number(rows[0]?.wait_ms ?? 0) };
    },
    clear: async (key) => {
      await ensure();
      await sql.query(`DELETE FROM verification_codes WHERE storage_key = $1`, [key]);
    },
  };
}

/** 제품 코드용 기본 저장소. */
export async function defaultLoginAttemptStore(): Promise<LoginAttemptStore> {
  const { ensureTable, sqlClient } = await import("@/lib/server/store");
  const sql = sqlClient();
  return loginAttemptStoreFor(sql, sql ? () => ensureTable(sql) : undefined);
}
