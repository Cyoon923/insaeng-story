/**
 * app_store.codes 정리 테스트 (Privacy-Legacy-Codes-Cleanup-1).
 *
 * 실행: node --test src/lib/server/legacyCodesCleanup.test.ts
 *
 * 저장소를 넘겨받는 구조라 DB가 필요 없다. 두 모드의 규칙과 재시도만 본다.
 * store.ts가 모드를 어떻게 정하는지는 legacyCodesCleanupSource.test.ts가 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_CODES_CLEANUP_MAX_ATTEMPTS,
  pruneExpiredCodes,
  runLegacyCodesCleanup,
  type LegacyCodesCleanupDeps,
} from "./legacyCodesCleanup.ts";
import type { AppData, VerificationCode } from "@/lib/types/app";

const NOW = 1_800_000_000_000;

/** 겹쳐서 밀렸다는 신호. store.ts의 AppStoreConflictError와 같은 자리다. */
class Conflict extends Error {
  constructor() {
    super("APP_STORE_CONFLICT");
    this.name = "AppStoreConflictError";
  }
}
const isConflict = (error: unknown) => error instanceof Conflict;

/** 저장 키 종류를 모두 섞어 둔다. 어느 종류도 따로 다루지 않는지 보기 위해서다. */
function sampleCodes(): Record<string, VerificationCode> {
  return {
    // 만료된 값
    "code:signup:01012345678": { code: "123456", expiresAt: NOW - 60_000, attempts: 3, sentAt: NOW - 360_000 },
    "code:reset:01099998888": { code: "654321", expiresAt: NOW - 1 },
    "signup:01012345678": { code: "tok-signup", expiresAt: NOW - 10_000 },
    "sociallink:deadbeef": {
      code: '{"provider":"kakao","providerUserId":"k-1","nickname":"길동"}',
      expiresAt: NOW - 10_000,
    },
    "withdraw:cafebabe": {
      code: '{"userId":"u-1","provider":"naver","providerUserId":"n-1","accessToken":"at-xyz"}',
      expiresAt: NOW - 10_000,
    },
    // 경계: 정확히 기한에 닿은 값
    "code:signup:01055556666": { code: "222222", expiresAt: NOW, sentAt: NOW - 30_000 },
    // 아직 살아 있는 값
    "reset:01099998888": { code: "tok-reset", expiresAt: NOW + 600_000 },
    "setid:01011112222": { code: "tok-setid", expiresAt: NOW + 600_000 },
    "link:01033334444": { code: "tok-link", expiresAt: NOW + 600_000 },
    "sociallink:alive": { code: '{"provider":"kakao","providerUserId":"k-2"}', expiresAt: NOW + 900_000 },
    "withdraw:alive": { code: '{"userId":"u-2","accessToken":"at-live"}', expiresAt: NOW + 300_000 },
  };
}

/** codes 말고도 내용이 있는 자료. 다른 부분이 그대로인지 보기 위해서다. */
function appData(codes: Record<string, VerificationCode>, tag = "read-1"): AppData {
  return {
    users: [{ id: "u-1" } as AppData["users"][number]],
    orders: [{ id: "o-1" } as AppData["orders"][number]],
    consultations: [],
    inquiries: [],
    reviews: [],
    wishlists: { "u-1": ["w-1"] },
    coupons: {},
    notifications: {},
    notificationSettings: {},
    codes,
    blockedSlots: [],
    adminPromo: { code: tag, percent: 0, createdAt: "2026-01-01T00:00:00.000Z" },
  };
}

/** 회차마다 새 객체를 돌려주는 저장소 흉내. */
function recorder(makeCodes: () => Record<string, VerificationCode> = sampleCodes) {
  const reads: string[] = [];
  const seen: AppData[] = [];
  const saved: AppData[] = [];
  return {
    reads,
    seen,
    saved,
    readData: async () => {
      const tag = `read-${reads.length + 1}`;
      reads.push(tag);
      const data = appData(makeCodes(), tag);
      seen.push(data);
      return data;
    },
    writeData: async (data: AppData) => {
      saved.push(data);
    },
  };
}

function deps(
  mode: "database" | "file",
  store: ReturnType<typeof recorder>,
  writeData?: LegacyCodesCleanupDeps["writeData"],
): LegacyCodesCleanupDeps {
  return { mode, readData: store.readData, writeData: writeData ?? store.writeData, isConflict };
}

/** console.warn을 가로채 무엇이 남았는지 본다. */
async function captureWarnings(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  try {
    await run();
  } finally {
    console.warn = original;
  }
  return lines;
}

/* ── 순수 선별 ─────────────────────────────────────── */

test("기한이 지난 값만 덜어낸다", () => {
  const { next, deleted } = pruneExpiredCodes(sampleCodes(), NOW);
  assert.equal(deleted, 5);
  assert.deepEqual(Object.keys(next).sort(), [
    "code:signup:01055556666",
    "link:01033334444",
    "reset:01099998888",
    "setid:01011112222",
    "sociallink:alive",
    "withdraw:alive",
  ]);
});

test("정확히 기한에 닿은 값은 남는다", () => {
  const { next, deleted } = pruneExpiredCodes({ a: { code: "x", expiresAt: NOW } }, NOW);
  assert.equal(deleted, 0);
  assert.deepEqual(Object.keys(next), ["a"]);
});

test("읽을 수 없는 기한은 남긴다", () => {
  // 판정하지 못한 것을 지우지 않는다.
  const odd = {
    a: { code: "x" } as unknown as VerificationCode,
    b: { code: "y", expiresAt: Number.NaN },
    c: { code: "z", expiresAt: "옛날" as unknown as number },
  };
  const { next, deleted } = pruneExpiredCodes(odd, NOW);
  assert.equal(deleted, 0);
  assert.deepEqual(Object.keys(next).sort(), ["a", "b", "c"]);
});

test("빈 값과 없는 값을 안전하게 다룬다", () => {
  assert.deepEqual(pruneExpiredCodes({}, NOW), { next: {}, deleted: 0 });
  assert.deepEqual(pruneExpiredCodes(undefined, NOW), { next: {}, deleted: 0 });
  assert.deepEqual(pruneExpiredCodes(null, NOW), { next: {}, deleted: 0 });
});

test("선별은 넘긴 묶음을 바꾸지 않는다", () => {
  const codes = sampleCodes();
  const snapshot = JSON.stringify(codes);
  pruneExpiredCodes(codes, NOW);
  assert.equal(JSON.stringify(codes), snapshot);
});

/* ── DB 모드 ───────────────────────────────────────── */

test("DB 모드는 종류를 가리지 않고 전부 비운다", async () => {
  const store = recorder();
  const result = await runLegacyCodesCleanup(deps("database", store), NOW);

  assert.deepEqual(result, { ok: true, mode: "database", deleted: 11, attempts: 1 });
  assert.equal(store.saved.length, 1);
  assert.deepEqual(store.saved[0].codes, {});
});

test("DB 모드는 아직 만료되지 않은 값도 지운다", async () => {
  // 만료 전이라는 상태에 기능적인 뜻이 이미 없다.
  const store = recorder(() => ({
    "reset:01099998888": { code: "tok", expiresAt: NOW + 600_000 },
    "withdraw:alive": { code: '{"accessToken":"at-live"}', expiresAt: NOW + 300_000 },
  }));
  const result = await runLegacyCodesCleanup(deps("database", store), NOW);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.deleted, 2);
  assert.deepEqual(store.saved[0].codes, {});
});

test("DB 모드에서 codes가 비어 있으면 저장하지 않는다", async () => {
  const store = recorder(() => ({}));
  const result = await runLegacyCodesCleanup(deps("database", store), NOW);

  assert.deepEqual(result, { ok: true, mode: "database", deleted: 0, attempts: 1 });
  assert.equal(store.saved.length, 0, "바꿀 것이 없는데 저장했다");
});

test("DB 모드는 now를 보지 않는다", async () => {
  // 어떤 시각을 넣어도 결과가 같다. 만료 판정을 하지 않기 때문이다.
  for (const when of [0, NOW, NOW + 10 ** 12]) {
    const store = recorder();
    const result = await runLegacyCodesCleanup(deps("database", store), when);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.deleted, 11, String(when));
  }
});

/* ── 파일 모드 ─────────────────────────────────────── */

test("파일 모드는 기한이 지난 값만 지운다", async () => {
  const store = recorder();
  const result = await runLegacyCodesCleanup(deps("file", store), NOW);

  assert.deepEqual(result, { ok: true, mode: "file", deleted: 5, attempts: 1 });
  assert.equal(store.saved.length, 1);
  assert.deepEqual(Object.keys(store.saved[0].codes).sort(), [
    "code:signup:01055556666",
    "link:01033334444",
    "reset:01099998888",
    "setid:01011112222",
    "sociallink:alive",
    "withdraw:alive",
  ]);
});

test("파일 모드는 진행 중인 인증을 끊지 않는다", async () => {
  const store = recorder();
  await runLegacyCodesCleanup(deps("file", store), NOW);
  const kept = store.saved[0].codes;

  // 가입·재설정·소셜 연결·탈퇴 재인증이 모두 살아 있어야 한다.
  assert.equal(kept["reset:01099998888"].code, "tok-reset");
  assert.equal(kept["setid:01011112222"].code, "tok-setid");
  assert.equal(kept["link:01033334444"].code, "tok-link");
  assert.equal(kept["sociallink:alive"].expiresAt, NOW + 900_000);
  assert.equal(kept["withdraw:alive"].expiresAt, NOW + 300_000);
  // 경계의 값도 남는다.
  assert.equal(kept["code:signup:01055556666"].code, "222222");
});

test("파일 모드에서 지울 것이 없으면 저장하지 않는다", async () => {
  const store = recorder(() => ({
    "reset:01099998888": { code: "tok", expiresAt: NOW + 600_000 },
    "code:signup:01055556666": { code: "222222", expiresAt: NOW },
  }));
  const result = await runLegacyCodesCleanup(deps("file", store), NOW);

  assert.deepEqual(result, { ok: true, mode: "file", deleted: 0, attempts: 1 });
  assert.equal(store.saved.length, 0, "바꿀 것이 없는데 저장했다");
});

test("파일 모드에서 codes가 비어 있으면 저장하지 않는다", async () => {
  const store = recorder(() => ({}));
  const result = await runLegacyCodesCleanup(deps("file", store), NOW);
  assert.deepEqual(result, { ok: true, mode: "file", deleted: 0, attempts: 1 });
  assert.equal(store.saved.length, 0);
});

test("파일 모드는 기준 시각을 옮기면 경계가 함께 옮겨 간다", async () => {
  const store = recorder();
  const result = await runLegacyCodesCleanup(deps("file", store), NOW + 1);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // 경계에 있던 값이 이제 만료다.
  assert.equal(result.deleted, 6);
  assert.equal("code:signup:01055556666" in store.saved[0].codes, false);
});

/* ── 재시도 ────────────────────────────────────────── */

test("1회 겹친 뒤 최신 자료로 성공한다", async () => {
  const store = recorder();
  let calls = 0;
  const result = await runLegacyCodesCleanup(
    deps("database", store, async (data) => {
      calls += 1;
      if (calls === 1) throw new Conflict();
      store.saved.push(data);
    }),
    NOW,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.attempts, 2);
  assert.deepEqual(store.reads, ["read-1", "read-2"]);
  // 두 번째 회차가 저장한 것은 두 번째로 읽은 자료다.
  assert.equal(store.saved[0].adminPromo?.code, "read-2");
});

test("2회 겹친 뒤에도 마지막 회차에서 성공한다", async () => {
  const store = recorder();
  let calls = 0;
  const result = await runLegacyCodesCleanup(
    deps("file", store, async (data) => {
      calls += 1;
      if (calls <= 2) throw new Conflict();
      store.saved.push(data);
    }),
    NOW,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.attempts, 3);
  assert.deepEqual(store.reads, ["read-1", "read-2", "read-3"]);
  assert.equal(store.saved[0].adminPromo?.code, "read-3");
});

test("세 번 모두 겹치면 충돌로 끝난다", async () => {
  const store = recorder();
  const result = await runLegacyCodesCleanup(
    deps("database", store, async () => {
      throw new Conflict();
    }),
    NOW,
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "cas-conflict",
    mode: "database",
    attempts: 3,
  });
  assert.deepEqual(store.reads, ["read-1", "read-2", "read-3"]);
  assert.equal(store.saved.length, 0);
});

test("회차마다 자료를 새로 읽고 지난 회차 것을 쓰지 않는다", async () => {
  const store = recorder();
  await runLegacyCodesCleanup(
    deps("database", store, async () => {
      throw new Conflict();
    }),
    NOW,
  );
  assert.equal(store.seen.length, 3);
  assert.equal(new Set(store.seen).size, 3, "같은 객체를 다시 썼다");
});

test("겹침이 아닌 오류는 그대로 올린다", async () => {
  const store = recorder();
  const boom = new Error("disk full");
  await assert.rejects(
    runLegacyCodesCleanup(
      deps("file", store, async () => {
        throw boom;
      }),
      NOW,
    ),
    (error: unknown) => error === boom,
  );
  // 이유를 모르는 채로 다시 지우지 않는다.
  assert.deepEqual(store.reads, ["read-1"]);
});

test("저장에 실패하면 자료를 되돌린다", async () => {
  const store = recorder();
  let captured: AppData | null = null;
  await runLegacyCodesCleanup(
    deps("database", store, async (data) => {
      captured = data;
      throw new Conflict();
    }),
    NOW,
    1,
  );
  // 실패한 회차의 자료에 원래 codes가 돌아와 있어야 한다.
  assert.notEqual(captured, null);
  assert.equal(Object.keys(captured!.codes).length, 11);
});

test("최초 시도를 포함해 세 번이다", () => {
  assert.equal(LEGACY_CODES_CLEANUP_MAX_ATTEMPTS, 3);
});

/* ── codes 말고는 바꾸지 않는다 ────────────────────── */

test("다른 자료는 그대로다", async () => {
  const store = recorder();
  await runLegacyCodesCleanup(deps("database", store), NOW);
  const written = store.saved[0];

  assert.deepEqual(written.users, [{ id: "u-1" }]);
  assert.deepEqual(written.orders, [{ id: "o-1" }]);
  assert.deepEqual(written.wishlists, { "u-1": ["w-1"] });
  assert.equal(written.adminPromo?.code, "read-1");
});

test("저장한 것은 읽은 그 객체다", async () => {
  // 사본을 만들면 CAS 기준 version을 잃는다.
  const store = recorder();
  await runLegacyCodesCleanup(deps("file", store), NOW);
  assert.equal(store.saved[0], store.seen[0]);
});

/* ── 다시 실행해도 안전하다 ───────────────────────── */

test("두 번째 실행에서는 지울 것이 없다", async () => {
  for (const mode of ["database", "file"] as const) {
    let codes = sampleCodes();
    const store = {
      reads: [] as string[],
      seen: [] as AppData[],
      saved: [] as AppData[],
      readData: async () => {
        store.reads.push(`read-${store.reads.length + 1}`);
        const data = appData(codes);
        store.seen.push(data);
        return data;
      },
      writeData: async (data: AppData) => {
        // 저장된 내용을 다음 읽기에 반영한다.
        codes = data.codes;
        store.saved.push(data);
      },
    };

    const first = await runLegacyCodesCleanup(deps(mode, store), NOW);
    const second = await runLegacyCodesCleanup(deps(mode, store), NOW);

    assert.equal(first.ok && first.deleted > 0, true, mode);
    assert.deepEqual(second, { ok: true, mode, deleted: 0, attempts: 1 }, mode);
    assert.equal(store.saved.length, 1, `${mode}: 두 번째 실행이 저장했다`);
  }
});

/* ── 결과와 기록에 담기는 것 ──────────────────────── */

test("결과에 키나 값이 담기지 않는다", async () => {
  for (const mode of ["database", "file"] as const) {
    const store = recorder();
    const result = await runLegacyCodesCleanup(deps(mode, store), NOW);
    const dumped = JSON.stringify(result);
    for (const secret of [
      "01012345678",
      "123456",
      "tok-signup",
      "at-xyz",
      "providerUserId",
      "u-1",
      "code:signup",
      "sociallink",
    ]) {
      assert.equal(dumped.includes(secret), false, `${mode}: ${secret}`);
    }
    assert.deepEqual(Object.keys(result).sort(), ["attempts", "deleted", "mode", "ok"]);
  }
});

test("기록에 키·값·오류 내용이 남지 않는다", async () => {
  const store = recorder();
  const lines = await captureWarnings(async () => {
    await runLegacyCodesCleanup(
      deps("database", store, async () => {
        throw new Conflict();
      }),
      NOW,
    );
  });

  assert.deepEqual(lines, [
    "[legacy-codes] store conflict on attempt 1 (database)",
    "[legacy-codes] store conflict on attempt 2 (database)",
    "[legacy-codes] store conflict on attempt 3 (database)",
    "[legacy-codes] store conflict exhausted (database)",
  ]);
  for (const line of lines) {
    for (const secret of ["01012345678", "123456", "at-xyz", "APP_STORE_CONFLICT", "sociallink"]) {
      assert.equal(line.includes(secret), false, line);
    }
  }
});

test("성공하면 아무 기록도 남기지 않는다", async () => {
  for (const mode of ["database", "file"] as const) {
    const store = recorder();
    const lines = await captureWarnings(async () => {
      await runLegacyCodesCleanup(deps(mode, store), NOW);
    });
    assert.deepEqual(lines, [], mode);
  }
});
