/**
 * 보관 만료 정리 실행 테스트 (Privacy-Retention-Runner-1).
 *
 * 실행: node --test src/lib/server/retentionCleanupRunner.test.ts
 *
 * 저장소도 정리 함수도 넘겨받는 구조라 DB가 필요 없다. 이 테스트는 아무것도
 * 저장하지 않고 아무것도 지우지 않는다. 진행 규칙만 본다.
 *
 * 정리 규칙과 판정은 retentionScrub* / retentionEligibility 테스트가 본다.
 * store.ts가 무엇을 넘기는지는 retentionCleanupRunnerSource.test.ts가 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  RETENTION_CLEANUP_ERROR_REASON,
  runRetentionCleanup,
  type RetentionCleanupDeps,
  type RetentionCleanupSummary,
  type RunnerRetryOutcome,
} from "./retentionCleanupRunner.ts";
import type { RetentionCandidate } from "./retentionDiscovery.ts";

const NOW = "2026-09-01T00:00:00.000Z";

/**
 * 이 파일에 나오는 어느 후보 수보다 큰 한도. "전부 처리한다"는 뜻으로 쓴다.
 * 한도에는 기본값이 없어서 모든 호출이 값을 적어야 한다. 그래서 한 곳에 둔다.
 */
const ALL = 50;

const ok = (attempts = 1): RunnerRetryOutcome => ({
  ok: true,
  result: { applied: true },
  attempts,
});
const blocked = (reason: string, attempts = 1): RunnerRetryOutcome => ({
  ok: true,
  result: { applied: false, reason },
  attempts,
});
const conflict = (attempts = 3): RunnerRetryOutcome => ({
  ok: false,
  reason: "cas-conflict",
  attempts,
});

/** 호출을 순서대로 기록하는 실행 함수 묶음. */
function harness(
  candidates: RetentionCandidate[],
  behaviour: (candidate: RetentionCandidate, call: number) => Promise<RunnerRetryOutcome>,
) {
  const calls: string[] = [];
  /** 지금 실행 중인 건이 있는지. 겹치면 동시에 보낸 것이다. */
  let inFlight = 0;
  let overlapped = false;

  const run = (kind: RetentionCandidate["kind"]) => async (id: string, now: string) => {
    inFlight += 1;
    if (inFlight > 1) overlapped = true;
    calls.push(`${kind}:${id}:${now}`);
    try {
      // 한 틱 쉬어 준다. 동시에 보냈다면 여기서 겹친다.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return await behaviour({ kind, id } as RetentionCandidate, calls.length);
    } finally {
      inFlight -= 1;
    }
  };

  const deps: RetentionCleanupDeps = {
    findCandidates: async () => candidates,
    scrubOrder: run("order"),
    scrubOrphanConsultation: run("orphan-consultation"),
  };
  return {
    deps,
    calls,
    get overlapped() {
      return overlapped;
    },
  };
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

/* ── 후보가 없을 때 ─────────────────────────────────── */

test("후보가 없으면 아무것도 실행하지 않는다", async () => {
  const h = harness([], async () => ok());
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.deepEqual(summary, {
    discovered: 0,
    processed: 0,
    remaining: 0,
    succeeded: 0,
    blocked: 0,
    conflicts: 0,
    errors: 0,
    discoveryFailed: false,
    results: [],
  });
  assert.deepEqual(h.calls, []);
});

/* ── 성공 ───────────────────────────────────────────── */

test("주문 후보 1건을 주문 경로로 처리한다", async () => {
  const h = harness([{ kind: "order", id: "o-1" }], async () => ok(2));
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.deepEqual(h.calls, [`order:o-1:${NOW}`]);
  assert.equal(summary.discovered, 1);
  assert.equal(summary.succeeded, 1);
  assert.deepEqual(summary.results, [
    { kind: "order", id: "o-1", outcome: "succeeded", attempts: 2 },
  ]);
});

test("짝 없는 상담 후보 1건을 상담 경로로 처리한다", async () => {
  const h = harness([{ kind: "orphan-consultation", id: "c-1" }], async () => ok());
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.deepEqual(h.calls, [`orphan-consultation:c-1:${NOW}`]);
  assert.equal(summary.succeeded, 1);
  assert.equal(summary.results[0].kind, "orphan-consultation");
});

test("성공한 건에는 사유를 담지 않는다", async () => {
  const h = harness([{ kind: "order", id: "o-1" }], async () => ok());
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);
  assert.equal("reason" in summary.results[0], false);
});

/* ── 섞여 있을 때 ──────────────────────────────────── */

test("섞인 후보를 받은 순서대로 알맞은 경로로 보낸다", async () => {
  const candidates: RetentionCandidate[] = [
    { kind: "order", id: "o-1" },
    { kind: "orphan-consultation", id: "c-1" },
    { kind: "order", id: "o-2" },
    { kind: "orphan-consultation", id: "c-2" },
  ];
  const h = harness(candidates, async () => ok());
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.deepEqual(h.calls, [
    `order:o-1:${NOW}`,
    `orphan-consultation:c-1:${NOW}`,
    `order:o-2:${NOW}`,
    `orphan-consultation:c-2:${NOW}`,
  ]);
  assert.deepEqual(
    summary.results.map((item) => `${item.kind}:${item.id}`),
    ["order:o-1", "orphan-consultation:c-1", "order:o-2", "orphan-consultation:c-2"],
  );
  assert.equal(summary.succeeded, 4);
});

test("한 번에 하나씩만 실행한다", async () => {
  // 동시에 보내면 같은 app_store 행을 두고 서로 밀어낸다.
  const candidates: RetentionCandidate[] = Array.from({ length: 5 }, (_, i) => ({
    kind: "order",
    id: `o-${i + 1}`,
  }));
  const h = harness(candidates, async () => ok());
  await runRetentionCleanup(h.deps, NOW, ALL);
  assert.equal(h.overlapped, false, "두 건이 동시에 실행되었다");
});

/* ── blocked ───────────────────────────────────────── */

test("최신 상태에서 멈춘 건은 실패도 성공도 아니다", async () => {
  const reasons = [
    "not-yet",
    "missing-evidence",
    "invalid-evidence",
    "invalid-now",
    "consultation-not-found",
    "paired-order-exists",
    "order-not-found",
  ];
  const candidates: RetentionCandidate[] = reasons.map((_, i) => ({
    kind: "order",
    id: `o-${i + 1}`,
  }));
  const h = harness(candidates, async (_c, call) => blocked(reasons[call - 1]));
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.equal(summary.blocked, reasons.length);
  assert.equal(summary.succeeded, 0);
  assert.equal(summary.errors, 0);
  assert.equal(summary.conflicts, 0);
  assert.deepEqual(
    summary.results.map((item) => item.reason),
    reasons,
  );
  for (const item of summary.results) assert.equal(item.outcome, "blocked");
});

/* ── CAS 충돌 ──────────────────────────────────────── */

test("세 번 모두 겹친 건은 충돌로 센다", async () => {
  const h = harness([{ kind: "order", id: "o-1" }], async () => conflict());
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.equal(summary.conflicts, 1);
  assert.equal(summary.succeeded, 0);
  assert.equal(summary.errors, 0);
  assert.deepEqual(summary.results, [
    { kind: "order", id: "o-1", outcome: "cas-conflict", reason: "cas-conflict", attempts: 3 },
  ]);
});

/* ── 오류 ───────────────────────────────────────────── */

test("오류가 나도 다음 후보를 계속 처리한다", async () => {
  const candidates: RetentionCandidate[] = [
    { kind: "order", id: "o-1" },
    { kind: "order", id: "o-2" },
    { kind: "orphan-consultation", id: "c-1" },
  ];
  const h = harness(candidates, async (_c, call) => {
    if (call === 1) throw new Error("connection reset");
    return ok();
  });
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.equal(h.calls.length, 3, "첫 건의 오류로 나머지가 멈췄다");
  assert.equal(summary.errors, 1);
  assert.equal(summary.succeeded, 2);
  assert.equal(summary.results[0].outcome, "error");
  assert.equal(summary.results[1].outcome, "succeeded");
});

test("오류 내용을 결과에 담지 않는다", async () => {
  const secret = "홍길동 010-1234-5678 사연";
  const h = harness([{ kind: "order", id: "o-1" }], async () => {
    throw new Error(`failed for ${secret}`);
  });
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.deepEqual(summary.results, [
    { kind: "order", id: "o-1", outcome: "error", reason: RETENTION_CLEANUP_ERROR_REASON },
  ]);
  assert.equal(JSON.stringify(summary).includes(secret), false);
  assert.equal(JSON.stringify(summary).includes("connection"), false);
});

test("모든 건이 실패해도 끝까지 돈다", async () => {
  const candidates: RetentionCandidate[] = Array.from({ length: 4 }, (_, i) => ({
    kind: "order",
    id: `o-${i + 1}`,
  }));
  const h = harness(candidates, async () => {
    throw new Error("boom");
  });
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.equal(h.calls.length, 4);
  assert.equal(summary.errors, 4);
  assert.equal(summary.discovered, 4);
});

/* ── 후보를 찾지 못했을 때 ─────────────────────────── */

test("후보를 읽지 못하면 아무것도 실행하지 않는다", async () => {
  let ran = 0;
  const deps: RetentionCleanupDeps = {
    findCandidates: async () => {
      throw new Error("db down");
    },
    scrubOrder: async () => {
      ran += 1;
      return ok();
    },
    scrubOrphanConsultation: async () => {
      ran += 1;
      return ok();
    },
  };
  const summary = await runRetentionCleanup(deps, NOW, ALL);

  assert.equal(ran, 0, "후보를 읽지 못했는데 정리를 실행했다");
  assert.deepEqual(summary, {
    discovered: 0,
    processed: 0,
    remaining: 0,
    succeeded: 0,
    blocked: 0,
    conflicts: 0,
    errors: 0,
    discoveryFailed: true,
    results: [],
  });
});

test("후보를 읽지 못한 것과 후보가 없는 것은 구분된다", async () => {
  const none = await runRetentionCleanup(harness([], async () => ok()).deps, NOW, ALL);
  assert.equal(none.discoveryFailed, false);
});

test("후보를 읽지 못해도 오류 내용이 결과에도 기록에도 새지 않는다", async () => {
  /*
   * 실제 조회 실패는 문장·인자·접속 정보를 문구에 담고 올라온다.
   * 그 값이 응답이나 기록에 실리면 개인정보가 그대로 나간다.
   */
  const secret = "SELECT phone FROM orders WHERE phone = '010-0000-0000'";
  let ran = 0;
  const deps: RetentionCleanupDeps = {
    findCandidates: async () => {
      throw new Error(secret);
    },
    scrubOrder: async () => {
      ran += 1;
      return ok();
    },
    scrubOrphanConsultation: async () => {
      ran += 1;
      return ok();
    },
  };

  // captureWarnings 안에서 채워진다(닫힘 안의 대입이라 선언 시점에 값이 없다).
  let summary!: RetentionCleanupSummary;
  const lines = await captureWarnings(async () => {
    summary = await runRetentionCleanup(deps, NOW, ALL);
  });

  assert.equal(ran, 0, "후보를 읽지 못했는데 정리를 실행했다");
  assert.equal(summary.discoveryFailed, true);
  assert.equal(summary.discovered, 0);
  assert.equal(summary.processed, 0);
  assert.equal(summary.remaining, 0);
  assert.deepEqual(summary.results, []);
  assert.equal(JSON.stringify(summary).includes(secret), false);
  assert.deepEqual(lines, ["[retention] cleanup skipped: candidate lookup failed"]);
  for (const line of lines) assert.equal(line.includes(secret), false);
});

/* ── 한도 (Privacy-Cleanup-Execution-Core-1) ────────── */

/** 주문 후보 n개. 순서를 확인할 수 있게 번호를 붙인다. */
const orders = (n: number): RetentionCandidate[] =>
  Array.from({ length: n }, (_, i) => ({ kind: "order", id: `o-${i + 1}` }));

test("discovered는 한도를 적용하기 전 전체 후보 수다", async () => {
  const h = harness(orders(5), async () => ok());
  const summary = await runRetentionCleanup(h.deps, NOW, 2);

  assert.equal(summary.discovered, 5, "한도가 전체 수를 가리면 얼마나 남았는지 알 수 없다");
  assert.equal(summary.processed, 2);
  assert.equal(summary.remaining, 3);
  assert.equal(h.calls.length, 2);
});

test("한도가 1이면 한 건만 시도한다", async () => {
  const h = harness(orders(3), async () => ok());
  const summary = await runRetentionCleanup(h.deps, NOW, 1);

  assert.equal(summary.discovered, 3);
  assert.equal(summary.processed, 1);
  assert.equal(summary.remaining, 2);
  assert.equal(summary.succeeded, 1);
  assert.deepEqual(h.calls, [`order:o-1:${NOW}`]);
});

test("한도가 후보보다 크면 전부 처리하고 남는 것이 없다", async () => {
  const h = harness(orders(2), async () => ok());
  const summary = await runRetentionCleanup(h.deps, NOW, 10);

  assert.equal(summary.discovered, 2);
  assert.equal(summary.processed, 2);
  assert.equal(summary.remaining, 0);
  assert.equal(h.calls.length, 2);
});

test("후보가 없으면 시도한 것도 남은 것도 없다", async () => {
  const summary = await runRetentionCleanup(harness([], async () => ok()).deps, NOW, 5);

  assert.equal(summary.discovered, 0);
  assert.equal(summary.processed, 0);
  assert.equal(summary.remaining, 0);
  assert.equal(summary.discoveryFailed, false);
});

test("앞에서부터 순서대로 가져간다", async () => {
  // 어느 건을 남길지가 실행마다 달라지면 이어서 하는 실행을 믿을 수 없다.
  const h = harness(orders(4), async () => ok());
  await runRetentionCleanup(h.deps, NOW, 2);

  assert.deepEqual(h.calls, [`order:o-1:${NOW}`, `order:o-2:${NOW}`]);
});

test("한도 밖의 건은 결과 목록에도 담기지 않는다", async () => {
  const h = harness(orders(4), async () => ok());
  const summary = await runRetentionCleanup(h.deps, NOW, 2);

  assert.equal(summary.results.length, summary.processed);
  assert.deepEqual(
    summary.results.map((item) => item.id),
    ["o-1", "o-2"],
  );
});

test("넘겨받은 후보 목록을 잘라 내지 않는다", async () => {
  // slice는 새 배열이다. 원본을 줄이면 부른 쪽이 전체 수를 잃는다.
  const candidates = orders(3);
  const h = harness(candidates, async () => ok());
  await runRetentionCleanup(h.deps, NOW, 1);

  assert.equal(candidates.length, 3);
});

test("한도가 올바르지 않으면 후보조차 읽지 않는다", async () => {
  for (const limit of [0, -1, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    let looked = 0;
    let ran = 0;
    const deps: RetentionCleanupDeps = {
      findCandidates: async () => {
        looked += 1;
        return orders(3);
      },
      scrubOrder: async () => {
        ran += 1;
        return ok();
      },
      scrubOrphanConsultation: async () => {
        ran += 1;
        return ok();
      },
    };

    await assert.rejects(
      () => runRetentionCleanup(deps, NOW, limit),
      (error: unknown) =>
        error instanceof RangeError && error.message === "RETENTION_CLEANUP_LIMIT_INVALID",
      `limit=${limit}`,
    );
    assert.equal(looked, 0, `limit=${limit}: 후보를 읽었다`);
    assert.equal(ran, 0, `limit=${limit}: 정리를 실행했다`);
  }
});

/* ── 집계 ───────────────────────────────────────────── */

test("네 갈래가 정확히 집계된다", async () => {
  const candidates: RetentionCandidate[] = [
    { kind: "order", id: "o-1" },
    { kind: "order", id: "o-2" },
    { kind: "orphan-consultation", id: "c-1" },
    { kind: "order", id: "o-3" },
    { kind: "orphan-consultation", id: "c-2" },
    { kind: "order", id: "o-4" },
  ];
  const h = harness(candidates, async (_c, call) => {
    if (call === 1 || call === 4) return ok();
    if (call === 2) return blocked("not-yet");
    if (call === 3) return conflict();
    if (call === 5) throw new Error("boom");
    return blocked("paired-order-exists");
  });
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.equal(summary.discovered, 6);
  assert.equal(summary.succeeded, 2);
  assert.equal(summary.blocked, 2);
  assert.equal(summary.conflicts, 1);
  assert.equal(summary.errors, 1);
  assert.equal(summary.results.length, 6);
  // 네 갈래의 합이 발견 수와 같다. 어느 건도 빠지거나 두 번 세지 않는다.
  assert.equal(
    summary.succeeded + summary.blocked + summary.conflicts + summary.errors,
    summary.discovered,
  );
});

/* ── 담기는 값 ─────────────────────────────────────── */

test("결과에는 kind·id·outcome과 정해진 사유만 담긴다", async () => {
  const candidates: RetentionCandidate[] = [
    { kind: "order", id: "o-1" },
    { kind: "order", id: "o-2" },
    { kind: "order", id: "o-3" },
    { kind: "order", id: "o-4" },
  ];
  const h = harness(candidates, async (_c, call) => {
    if (call === 1) return ok();
    if (call === 2) return blocked("not-yet");
    if (call === 3) return conflict();
    throw new Error("boom");
  });
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  const allowed = new Set(["kind", "id", "outcome", "reason", "attempts"]);
  for (const item of summary.results) {
    for (const key of Object.keys(item)) {
      assert.equal(allowed.has(key), true, `${key}는 결과에 담기면 안 된다`);
    }
  }
});

test("요약에 개인정보나 userId가 새어 나오지 않는다", async () => {
  const h = harness([{ kind: "order", id: "o-1" }], async () => blocked("not-yet"));
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);
  const dumped = JSON.stringify(summary);
  for (const secret of ["홍길동", "010-1234-5678", "u-1", "유비 선생", "사연", "details"]) {
    assert.equal(dumped.includes(secret), false, secret);
  }
});

test("기록에 개인정보를 남기지 않는다", async () => {
  const secret = "홍길동";
  const h = harness([{ kind: "order", id: "o-비밀" }], async () => {
    throw new Error(`failed for ${secret}`);
  });
  const lines = await captureWarnings(async () => {
    await runRetentionCleanup(h.deps, NOW, ALL);
  });

  assert.deepEqual(lines, ["[retention] cleanup item failed (order)"]);
  for (const line of lines) {
    assert.equal(line.includes(secret), false);
    assert.equal(line.includes("o-비밀"), false);
    assert.equal(line.includes("failed for"), false);
  }
});

test("성공만 있으면 아무 기록도 남기지 않는다", async () => {
  const h = harness([{ kind: "order", id: "o-1" }], async () => ok());
  const lines = await captureWarnings(async () => {
    await runRetentionCleanup(h.deps, NOW, ALL);
  });
  assert.deepEqual(lines, []);
});

/* ── 넘긴 값을 바꾸지 않는다 ───────────────────────── */

test("후보 목록과 그 안의 값을 바꾸지 않는다", async () => {
  const candidates: RetentionCandidate[] = [
    { kind: "order", id: "o-1" },
    { kind: "orphan-consultation", id: "c-1" },
  ];
  const snapshot = JSON.stringify(candidates);
  const h = harness(candidates, async () => ok());
  const summary = await runRetentionCleanup(h.deps, NOW, ALL);

  assert.equal(JSON.stringify(candidates), snapshot);
  // 결과가 후보 객체를 그대로 들고 있지도 않다.
  assert.notEqual(summary.results[0], candidates[0]);
});

test("실행 함수에 넘기는 시각은 언제나 받은 그 시각이다", async () => {
  // runner가 시각을 새로 만들지 않는다. 판정 경계가 도중에 흐르면 안 된다.
  const candidates: RetentionCandidate[] = [
    { kind: "order", id: "o-1" },
    { kind: "orphan-consultation", id: "c-1" },
  ];
  const h = harness(candidates, async () => ok());
  await runRetentionCleanup(h.deps, NOW, ALL);
  for (const call of h.calls) assert.equal(call.endsWith(NOW), true, call);
});
