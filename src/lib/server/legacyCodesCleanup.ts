/**
 * app_store.codes에 남은 인증정보 정리 (Privacy-Legacy-Codes-Cleanup-1).
 *
 * 저장소를 직접 부르지 않는다. 읽기·쓰기·충돌 판정을 넘겨받아 규칙만 정한다.
 * DB 없이 이 규칙을 확인할 수 있어야 하고, 실제 저장소를 아는 쪽을 store.ts
 * 하나로 두기 위해서다.
 *
 * ── 두 모드의 규칙이 다르다 ──
 *
 * DB 모드에서 authoritative한 저장소는 verification_codes 테이블이다.
 * app_store.codes는 그 전환 이전에 남은 값이고, 지금은 **인증을 통과시키는
 * 경로가 하나도 없다**(readVerification·consumeVerification 모두 DB 모드에서
 * 테이블만 보고 확정한다). 새로 쓰는 경로도 없다. 남겨 둘 이유가 없으므로
 * 통째로 비운다. expiresAt으로 가르지 않는 이유는, 만료 전이라는 상태에
 * 기능적인 뜻이 이미 없기 때문이다.
 *
 * 파일 모드는 정반대다. 여기서는 app_store.codes가 **지금 쓰는 저장소**다.
 * issueCode·putToken이 여기에 쓰고 readVerification·consumeVerification이
 * 여기서 읽는다. 통째로 비우면 진행 중인 가입·재설정·소셜 연결·탈퇴 재인증이
 * 그 자리에서 끊긴다. 그래서 기한이 지난 값만 덜어낸다.
 *
 * 한 규칙을 양쪽에 쓰지 않는다. 모드를 가르는 일은 store.ts가 한다.
 *
 * ── 지우지 않는 것 ──
 *
 * verification_codes 테이블은 건드리지 않는다. 저장소가 다르고, 그쪽 정리는
 * deleteExpiredVerifications가 따로 한다. 두 정리를 섞지 않는다.
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type { AppData, VerificationCode } from "@/lib/types/app";

/** 최초 시도를 포함한 최대 시도 횟수. */
export const LEGACY_CODES_CLEANUP_MAX_ATTEMPTS = 3;

/** 어느 규칙으로 정리했는지. 두 모드의 뜻이 달라 결과에 함께 담는다. */
export type LegacyCodesCleanupMode = "database" | "file";

/**
 * 정리 결과.
 *
 * cas-conflict는 오류가 아니라 사실이다. 정해진 횟수만큼 모두 겹쳐서 놓쳤다는
 * 뜻이며, 이때 저장소는 하나도 바뀌지 않았다. 나중에 다시 부르면 된다.
 *
 * deleted는 지운 건수뿐이다. 키에는 휴대폰 번호가, 값에는 인증번호·토큰·소셜
 * 정보·접근 토큰이 들어 있어 하나도 밖으로 내보내지 않는다.
 */
export type LegacyCodesCleanupResult =
  | { ok: true; mode: LegacyCodesCleanupMode; deleted: number; attempts: number }
  | { ok: false; reason: "cas-conflict"; mode: LegacyCodesCleanupMode; attempts: number };

/**
 * 정리에 필요한 바깥 세계.
 *
 * mode는 store.ts가 DATABASE_URL 유무를 보고 정한다. 이 모듈은 그 판단을 하지 않는다.
 */
export interface LegacyCodesCleanupDeps {
  mode: LegacyCodesCleanupMode;
  /** 시도마다 최신 자료를 읽는다. 회차마다 새 객체여야 한다(CAS 기준 version이 붙는다). */
  readData: () => Promise<AppData>;
  /** 정리한 자료를 저장한다. 겹쳐서 밀리면 충돌 오류를 던져야 한다. */
  writeData: (data: AppData) => Promise<void>;
  /** 이 오류가 "겹쳐서 밀림"인지. store.ts의 isAppStoreConflict를 넘긴다. */
  isConflict: (error: unknown) => boolean;
}

/** 저장된 인증 묶음. AppData.codes와 같은 모양이다. */
type CodeMap = Record<string, VerificationCode>;

/**
 * 기한이 지난 값만 덜어낸 **새 묶음**을 만든다. 인자는 바꾸지 않는다.
 *
 * 정확히 기한에 닿은 값(expiresAt === now)은 남긴다. 그 순간까지는 아직 쓸 수 있는
 * 값으로 보는 쪽이 사용자에게 불리하지 않고, 읽는 쪽(readVerification)도
 * expiresAt < now일 때만 없는 것으로 다룬다. 같은 경계를 쓴다.
 *
 * expiresAt이 수로 읽히지 않는 값은 남긴다. 판정하지 못한 것을 지우지 않는다(fail-closed).
 */
export function pruneExpiredCodes(
  codes: CodeMap | null | undefined,
  now: number,
): { next: CodeMap; deleted: number } {
  const next: CodeMap = {};
  let deleted = 0;
  for (const [key, value] of Object.entries(codes ?? {})) {
    const expiresAt = value?.expiresAt;
    if (typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt < now) {
      deleted += 1;
      continue;
    }
    next[key] = value;
  }
  return { next, deleted };
}

/**
 * app_store.codes를 모드에 맞는 규칙으로 정리한다.
 *
 * 겹쳐서 밀리면 최신 자료를 **다시 읽어** 처음부터 다시 한다. 지난 회차의 자료도
 * 정리 결과도 다시 쓰지 않는다. 밀린 사이에 새 인증이 저장되었을 수 있고,
 * 파일 모드에서는 그 값이 아직 살아 있을 수 있기 때문이다.
 *
 * 겹침이 아닌 오류는 그대로 올린다. 이유를 모른 채로 다시 지우지 않는다.
 *
 * 지울 것이 없으면 저장하지 않는다. app_store는 한 행에 전체 자료를 담아
 * 저장이 곧 전체 재작성이라, 바꿀 것이 없는데 쓰면 관계없는 요청과 경합만 만든다.
 *
 * now는 서버가 만든 시각을 받는다. 파일 모드의 만료 판정에 쓴다. 시각에 따라 답이
 * 달라지는 일이라 함수 안에서 만들지 않는다(경계를 테스트로 고정할 수 있어야 한다).
 */
export async function runLegacyCodesCleanup(
  deps: LegacyCodesCleanupDeps,
  now: number,
  maxAttempts: number = LEGACY_CODES_CLEANUP_MAX_ATTEMPTS,
): Promise<LegacyCodesCleanupResult> {
  const { mode } = deps;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // 회차마다 새로 읽는다. 지난 회차의 자료도 결과도 쓰지 않는다.
    const data = await deps.readData();
    const codes = data.codes ?? {};

    /*
     * DB 모드는 통째로 비운다. 파일 모드는 기한이 지난 값만 덜어낸다.
     * 두 규칙을 한 줄로 합치지 않는다. 합치면 한쪽을 고칠 때 다른 쪽이 따라 바뀐다.
     */
    const { next, deleted } =
      mode === "database"
        ? { next: {} as CodeMap, deleted: Object.keys(codes).length }
        : pruneExpiredCodes(codes, now);

    // 바꿀 것이 없으면 저장하지 않는다.
    if (deleted === 0) return { ok: true, mode, deleted: 0, attempts: attempt };

    /*
     * 자리를 바꿔 끼운다(다른 store 함수들과 같이 data를 직접 바꾼다.
     * 사본을 만들면 기준 version을 잃는다). codes 말고는 건드리지 않는다.
     */
    const previous = data.codes;
    data.codes = next;
    try {
      await deps.writeData(data);
    } catch (error) {
      data.codes = previous;
      // 겹쳐서 밀린 경우가 아니면 그대로 올린다.
      if (!deps.isConflict(error)) throw error;
      // 개인정보는 남기지 않는다. 모드와 몇 번째 시도였는지만 남긴다.
      console.warn(`[legacy-codes] store conflict on attempt ${attempt} (${mode})`);
      continue;
    }
    return { ok: true, mode, deleted, attempts: attempt };
  }

  console.warn(`[legacy-codes] store conflict exhausted (${mode})`);
  return { ok: false, reason: "cas-conflict", mode, attempts: maxAttempts };
}
