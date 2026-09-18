/**
 * 관리자 수동 정리 실행 테스트 (Privacy-Cleanup-Execution-API-1).
 *
 * 실행: node --test src/lib/server/cleanupExecuteAdminApi.test.ts
 *
 * 실행 함수를 전부 넘겨받는 구조라 DB가 필요 없다. 이 테스트는 아무것도 저장하지 않고
 * 아무것도 지우지 않는다. 무엇을 거절하고 무엇을 한 번만 실행하는지, 그리고 응답에
 * 무엇이 담기지 않는지를 본다.
 *
 * route가 무엇을 이어 붙였는지는 cleanupExecuteRouteSource.test.ts가 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CLEANUP_ACTIONS,
  CLEANUP_ERRORS,
  RETENTION_LIMIT,
  countRetentionReasons,
  runCleanupExecute,
  type CleanupAction,
  type CleanupExecuteDeps,
  type RetentionRunOutcome,
} from "./cleanupExecuteAdminApi.ts";

const NOW = "2026-09-18T00:00:00.000Z";

/** 정리 결과 한 벌. 필요한 값만 덮어쓴다. */
const summary = (over: Partial<RetentionRunOutcome> = {}): RetentionRunOutcome => ({
  discovered: 0,
  processed: 0,
  remaining: 0,
  succeeded: 0,
  blocked: 0,
  conflicts: 0,
  errors: 0,
  discoveryFailed: false,
  results: [],
  ...over,
});

interface Harness {
  deps: CleanupExecuteDeps;
  calls: Record<keyof Omit<CleanupExecuteDeps, "databaseMode">, number>;
  seen: {
    retention: { now: string; limit: number }[];
    legacy: number[];
    expired: Date[];
  };
  /** 실행 함수를 통틀어 몇 번 불렀는지. */
  total: () => number;
}

/** 호출 횟수와 넘겨받은 값을 기록하는 실행 함수 묶음. */
function harness(
  options: {
    databaseMode?: boolean;
    retention?: RetentionRunOutcome;
    schemaSupported?: boolean;
    expiredSupported?: boolean;
    legacyOk?: boolean;
    throwOn?: keyof Omit<CleanupExecuteDeps, "databaseMode">;
  } = {},
): Harness {
  const calls = {
    prepareSchema: 0,
    runRetention: 0,
    cleanupLegacyCodes: 0,
    deleteExpiredVerifications: 0,
  };
  const seen: Harness["seen"] = { retention: [], legacy: [], expired: [] };
  const boom = (name: keyof typeof calls) => {
    if (options.throwOn === name) {
      throw new Error("SELECT phone FROM orders WHERE phone = '010-0000-0000'");
    }
  };

  const deps: CleanupExecuteDeps = {
    databaseMode: () => options.databaseMode !== false,
    prepareSchema: async () => {
      calls.prepareSchema += 1;
      boom("prepareSchema");
      return options.schemaSupported === false ? { supported: false } : { supported: true };
    },
    runRetention: async (now, limit) => {
      calls.runRetention += 1;
      seen.retention.push({ now, limit });
      boom("runRetention");
      return options.retention ?? summary();
    },
    cleanupLegacyCodes: async (now) => {
      calls.cleanupLegacyCodes += 1;
      seen.legacy.push(now);
      boom("cleanupLegacyCodes");
      return options.legacyOk === false
        ? { ok: false, attempts: 3 }
        : { ok: true, deleted: 4, attempts: 1 };
    },
    deleteExpiredVerifications: async (now) => {
      calls.deleteExpiredVerifications += 1;
      seen.expired.push(now);
      boom("deleteExpiredVerifications");
      return options.expiredSupported === false
        ? { supported: false }
        : { supported: true, deleted: 7 };
    },
  };

  return {
    deps,
    calls,
    seen,
    total: () => Object.values(calls).reduce((sum, n) => sum + n, 0),
  };
}

/** 그 action을 실행하는 데 필요한 최소 본문. */
function bodyFor(action: CleanupAction): Record<string, unknown> {
  return action === "retention"
    ? { action, confirm: action, limit: RETENTION_LIMIT }
    : { action, confirm: action };
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

/* ── 허용된 action ──────────────────────────────────── */

test("실행할 수 있는 것이 넷뿐이다", () => {
  assert.deepEqual(
    [...CLEANUP_ACTIONS],
    ["prepare-schema", "retention", "legacy-codes", "expired-verifications"],
  );
});

test("action마다 정해진 함수 하나만 부른다", async () => {
  const expected: Record<CleanupAction, keyof Harness["calls"]> = {
    "prepare-schema": "prepareSchema",
    retention: "runRetention",
    "legacy-codes": "cleanupLegacyCodes",
    "expired-verifications": "deleteExpiredVerifications",
  };

  for (const action of CLEANUP_ACTIONS) {
    const h = harness();
    const response = await runCleanupExecute(h.deps, bodyFor(action), NOW);

    assert.equal(response.status, 200, action);
    assert.equal(h.total(), 1, `${action}: 실행 함수를 한 번만 불러야 한다`);
    assert.equal(h.calls[expected[action]], 1, action);
  }
});

test("스키마 준비가 다른 정리를 부르지 않는다", async () => {
  const h = harness();
  await runCleanupExecute(h.deps, bodyFor("prepare-schema"), NOW);

  assert.equal(h.calls.runRetention, 0);
  assert.equal(h.calls.cleanupLegacyCodes, 0);
  assert.equal(h.calls.deleteExpiredVerifications, 0);
});

test("인증정보 정리와 만료 정리가 서로를, 그리고 보관 만료 정리를 부르지 않는다", async () => {
  const legacy = harness();
  await runCleanupExecute(legacy.deps, bodyFor("legacy-codes"), NOW);
  assert.equal(legacy.calls.deleteExpiredVerifications, 0);
  assert.equal(legacy.calls.runRetention, 0);
  assert.equal(legacy.calls.prepareSchema, 0);

  const expired = harness();
  await runCleanupExecute(expired.deps, bodyFor("expired-verifications"), NOW);
  assert.equal(expired.calls.cleanupLegacyCodes, 0);
  assert.equal(expired.calls.runRetention, 0);
  assert.equal(expired.calls.prepareSchema, 0);
});

/* ── action 거절 ───────────────────────────────────── */

test("action이 없거나 모르는 값이거나 여럿이면 거절한다", async () => {
  const bodies: (Record<string, unknown> | null)[] = [
    null,
    {},
    { confirm: "retention" },
    { action: "", confirm: "" },
    { action: "Retention", confirm: "Retention" },
    { action: " retention ", confirm: " retention " },
    { action: "retention,legacy-codes", confirm: "retention,legacy-codes" },
    { action: ["retention"], confirm: ["retention"] },
    { action: ["retention", "legacy-codes"] },
    { action: 1 },
    { action: { name: "retention" } },
    { action: null },
    { action: true },
    { action: "cleanup" },
  ];

  for (const body of bodies) {
    const h = harness();
    const response = await runCleanupExecute(h.deps, body, NOW);

    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(response.body, {
      error: "INVALID_ACTION",
      message: CLEANUP_ERRORS.INVALID_ACTION,
    });
    assert.equal(h.total(), 0, `${JSON.stringify(body)}: 실행했다`);
  }
});

/* ── 확인 문구 ─────────────────────────────────────── */

test("확인 문구가 없거나 다르면 어떤 action도 실행하지 않는다", async () => {
  const wrong = [undefined, "", "yes", "RETENTION", "retention ", true, 1, null, ["retention"]];

  for (const action of CLEANUP_ACTIONS) {
    for (const confirm of wrong) {
      const h = harness();
      const body: Record<string, unknown> = { action, limit: RETENTION_LIMIT };
      if (confirm !== undefined) body.confirm = confirm;

      const response = await runCleanupExecute(h.deps, body, NOW);
      assert.equal(response.status, 400, `${action}/${String(confirm)}`);
      assert.deepEqual(response.body, {
        error: "CONFIRM_REQUIRED",
        message: CLEANUP_ERRORS.CONFIRM_REQUIRED,
      });
      assert.equal(h.total(), 0, `${action}/${String(confirm)}: 실행했다`);
    }
  }
});

test("다른 action의 이름을 적어도 실행하지 않는다", async () => {
  const h = harness();
  const response = await runCleanupExecute(
    h.deps,
    { action: "retention", confirm: "legacy-codes", limit: RETENTION_LIMIT },
    NOW,
  );

  assert.equal(response.status, 400);
  assert.equal(h.total(), 0);
});

test("스키마 준비도 확인 문구를 요구한다", async () => {
  const h = harness();
  const response = await runCleanupExecute(h.deps, { action: "prepare-schema" }, NOW);

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "CONFIRM_REQUIRED",
    message: CLEANUP_ERRORS.CONFIRM_REQUIRED,
  });
  assert.equal(h.calls.prepareSchema, 0);
});

/* ── DB 모드 ───────────────────────────────────────── */

test("파일 모드에서는 어떤 action도 실행하지 않는다", async () => {
  for (const action of CLEANUP_ACTIONS) {
    const h = harness({ databaseMode: false });
    const response = await runCleanupExecute(h.deps, bodyFor(action), NOW);

    assert.equal(response.status, 409, action);
    assert.deepEqual(response.body, {
      error: "DATABASE_MODE_REQUIRED",
      message: CLEANUP_ERRORS.DATABASE_MODE_REQUIRED,
    });
    assert.equal(h.total(), 0, `${action}: 실행했다`);
  }
});

test("준비할 자리가 없다는 답을 준비했다고 바꾸지 않는다", async () => {
  const h = harness({ schemaSupported: false });
  const response = await runCleanupExecute(h.deps, bodyFor("prepare-schema"), NOW);

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "DATABASE_MODE_REQUIRED",
    message: CLEANUP_ERRORS.DATABASE_MODE_REQUIRED,
  });
});

test("지울 저장소가 없다는 답을 지웠다고 바꾸지 않는다", async () => {
  const h = harness({ expiredSupported: false });
  const response = await runCleanupExecute(h.deps, bodyFor("expired-verifications"), NOW);

  assert.equal(response.status, 409);
  assert.equal(JSON.stringify(response.body).includes("deleted"), false);
});

/* ── 한도 ──────────────────────────────────────────── */

test("보관 만료 정리는 숫자 1만 받는다", async () => {
  const bad = [undefined, 0, -1, 2, 10, 1.5, 0.999, Number.NaN, Number.POSITIVE_INFINITY, "1", true, null, [1]];

  for (const limit of bad) {
    const h = harness();
    const body: Record<string, unknown> = { action: "retention", confirm: "retention" };
    if (limit !== undefined) body.limit = limit;

    const response = await runCleanupExecute(h.deps, body, NOW);
    assert.equal(response.status, 400, String(limit));
    assert.deepEqual(response.body, {
      error: "INVALID_LIMIT",
      message: CLEANUP_ERRORS.INVALID_LIMIT,
    });
    assert.equal(h.total(), 0, `limit=${String(limit)}: 후보를 읽거나 실행했다`);
  }
});

test("한도는 1 하나뿐이고 그대로 정리 쪽에 넘어간다", async () => {
  assert.equal(RETENTION_LIMIT, 1);

  const h = harness();
  await runCleanupExecute(h.deps, bodyFor("retention"), NOW);
  assert.deepEqual(h.seen.retention, [{ now: NOW, limit: 1 }]);
});

test("다른 action에는 한도가 필요 없다", async () => {
  for (const action of ["prepare-schema", "legacy-codes", "expired-verifications"] as const) {
    const h = harness();
    const response = await runCleanupExecute(h.deps, { action, confirm: action }, NOW);
    assert.equal(response.status, 200, action);
  }
});

/* ── 기준 시각 ─────────────────────────────────────── */

test("받은 시각 하나를 모양만 바꿔 넘긴다", async () => {
  const legacy = harness();
  await runCleanupExecute(legacy.deps, bodyFor("legacy-codes"), NOW);
  assert.deepEqual(legacy.seen.legacy, [Date.parse(NOW)]);

  const expired = harness();
  await runCleanupExecute(expired.deps, bodyFor("expired-verifications"), NOW);
  assert.equal(expired.seen.expired.length, 1);
  assert.equal(expired.seen.expired[0].toISOString(), NOW);
});

/* ── 응답에 담기는 것 ──────────────────────────────── */

test("보관 만료 정리 응답에 정해진 값만 담긴다", async () => {
  const h = harness({
    retention: summary({
      discovered: 9,
      processed: 1,
      remaining: 8,
      succeeded: 1,
      results: [{ reason: undefined }],
    }),
  });
  const response = await runCleanupExecute(h.deps, bodyFor("retention"), NOW);

  assert.deepEqual(Object.keys(response.body).sort(), [
    "action",
    "blocked",
    "conflicts",
    "discovered",
    "discoveryFailed",
    "errors",
    "processed",
    "ranAt",
    "reasons",
    "remaining",
    "succeeded",
  ]);
});

test("응답에 건별 결과도 id도 kind도 담기지 않는다", async () => {
  const h = harness({
    retention: summary({
      discovered: 3,
      processed: 1,
      remaining: 2,
      blocked: 1,
      results: [
        { kind: "order", id: "o-비밀", outcome: "blocked", reason: "not-yet" },
      ] as unknown as RetentionRunOutcome["results"],
    }),
  });
  const response = await runCleanupExecute(h.deps, bodyFor("retention"), NOW);
  const text = JSON.stringify(response.body);

  assert.equal(text.includes("results"), false);
  assert.equal(text.includes("o-비밀"), false);
  assert.equal(text.includes("kind"), false);
  assert.equal(text.includes("outcome"), false);
});

test("남은 수는 정리 쪽 값을 그대로 쓴다", async () => {
  const h = harness({ retention: summary({ discovered: 42, processed: 1, remaining: 41 }) });
  const response = await runCleanupExecute(h.deps, bodyFor("retention"), NOW);

  assert.equal((response.body as { discovered: number }).discovered, 42);
  assert.equal((response.body as { processed: number }).processed, 1);
  assert.equal((response.body as { remaining: number }).remaining, 41);
});

test("후보를 읽지 못한 사실이 그대로 남는다", async () => {
  const h = harness({ retention: summary({ discoveryFailed: true }) });
  const response = await runCleanupExecute(h.deps, bodyFor("retention"), NOW);

  assert.equal(response.status, 200);
  const body = response.body as unknown as Record<string, unknown>;
  assert.equal(body.discoveryFailed, true);
  assert.equal(body.discovered, 0);
  assert.equal(body.processed, 0);
  assert.equal(body.remaining, 0);
  // 끝났다고 읽힐 자리를 두지 않는다.
  assert.equal("ok" in body, false);
  assert.equal("completed" in body, false);
});

test("사유는 정해 둔 값만 세고 모르는 값은 버린다", async () => {
  const counts = countRetentionReasons([
    { reason: "not-yet" },
    { reason: "not-yet" },
    { reason: "cas-conflict" },
    { reason: "scrub-failed" },
    { reason: "paired-order-exists" },
    { reason: "010-1234-5678" },
    { reason: "drop table orders" },
    { reason: "__proto__" },
    { reason: "constructor" },
    {},
  ]);

  assert.deepEqual(counts, {
    "not-yet": 2,
    "cas-conflict": 1,
    "scrub-failed": 1,
    "paired-order-exists": 1,
  });
});

test("인증정보 정리 응답에 내부 사정을 담지 않는다", async () => {
  const h = harness();
  const response = await runCleanupExecute(h.deps, bodyFor("legacy-codes"), NOW);

  assert.deepEqual(response.body, {
    action: "legacy-codes",
    ranAt: NOW,
    deleted: 4,
    attempts: 1,
    ok: true,
  });
  // 어느 규칙으로 정리했는지는 밖에서 알 필요가 없다.
  assert.equal(JSON.stringify(response.body).includes("mode"), false);
});

test("겹쳐서 밀렸으면 지웠다고 말하지 않는다", async () => {
  const h = harness({ legacyOk: false });
  const response = await runCleanupExecute(h.deps, bodyFor("legacy-codes"), NOW);

  assert.deepEqual(response.body, {
    action: "legacy-codes",
    ranAt: NOW,
    deleted: 0,
    attempts: 3,
    ok: false,
  });
});

test("스키마 준비와 만료 정리 응답도 정해진 값뿐이다", async () => {
  const schema = await runCleanupExecute(harness().deps, bodyFor("prepare-schema"), NOW);
  assert.deepEqual(schema.body, { action: "prepare-schema", preparedAt: NOW, ok: true });

  const expired = await runCleanupExecute(
    harness().deps,
    bodyFor("expired-verifications"),
    NOW,
  );
  assert.deepEqual(expired.body, {
    action: "expired-verifications",
    ranAt: NOW,
    deleted: 7,
    ok: true,
  });
});

/* ── 실행이 실패했을 때 ────────────────────────────── */

test("받은 오류가 응답에도 기록에도 새지 않는다", async () => {
  const secret = "SELECT phone FROM orders WHERE phone = '010-0000-0000'";

  for (const action of CLEANUP_ACTIONS) {
    const throwOn = {
      "prepare-schema": "prepareSchema",
      retention: "runRetention",
      "legacy-codes": "cleanupLegacyCodes",
      "expired-verifications": "deleteExpiredVerifications",
    } as const;
    const h = harness({ throwOn: throwOn[action] });

    let response!: Awaited<ReturnType<typeof runCleanupExecute>>;
    const lines = await captureWarnings(async () => {
      response = await runCleanupExecute(h.deps, bodyFor(action), NOW);
    });

    assert.equal(response.status, 500, action);
    assert.deepEqual(response.body, {
      error: "CLEANUP_FAILED",
      message: CLEANUP_ERRORS.CLEANUP_FAILED,
    });
    assert.equal(JSON.stringify(response.body).includes(secret), false, action);
    assert.deepEqual(lines, [`[cleanup] execution failed (${action})`]);
    for (const line of lines) {
      assert.equal(line.includes(secret), false, line);
      assert.equal(/010-|SELECT|Error/.test(line), false, line);
    }
  }
});

test("거절할 때는 아무 기록도 남기지 않는다", async () => {
  const lines = await captureWarnings(async () => {
    await runCleanupExecute(harness().deps, { action: "nope" }, NOW);
    await runCleanupExecute(harness().deps, { action: "retention" }, NOW);
    await runCleanupExecute(harness({ databaseMode: false }).deps, bodyFor("retention"), NOW);
  });
  assert.deepEqual(lines, []);
});
