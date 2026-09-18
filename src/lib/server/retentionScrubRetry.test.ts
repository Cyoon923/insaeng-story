/**
 * 보관 만료 정리 재시도 테스트 (Privacy-Retention-Retry-1).
 *
 * 실행: node --test src/lib/server/retentionScrubRetry.test.ts
 *
 * 저장소를 넘겨받는 구조라 DB가 필요 없다. 여기서 보는 것은 재시도 규칙뿐이다.
 * 실제 정리 규칙은 retentionScrubPlan / retentionOrphanScrubPlan 테스트가 본다.
 *
 * store.ts가 이 규칙을 어떻게 이어 붙였는지는
 * retentionScrubRetrySource.test.ts가 원문으로 따로 본다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  RETENTION_SCRUB_MAX_ATTEMPTS,
  runRetentionScrubWithRetry,
} from "./retentionScrubRetry.ts";
import type { AppData } from "@/lib/types/app";

/** 겹쳐서 밀렸다는 신호. store.ts의 AppStoreConflictError와 같은 자리다. */
class Conflict extends Error {
  constructor() {
    super("APP_STORE_CONFLICT");
    this.name = "AppStoreConflictError";
  }
}
const isConflict = (error: unknown) => error instanceof Conflict;

function appData(tag: string): AppData {
  return {
    users: [],
    orders: [],
    consultations: [],
    inquiries: [],
    reviews: [],
    wishlists: {},
    coupons: {},
    notifications: {},
    notificationSettings: {},
    codes: {},
    blockedSlots: [],
    // 회차마다 다른 자료가 왔는지 알아보기 위한 표시. 실제 필드를 흉내 낸 것이다.
    adminPromo: { code: tag, percent: 0, createdAt: "2026-01-01T00:00:00.000Z" },
  };
}

/** 호출을 기록하는 저장소 흉내. 회차마다 다른 객체를 돌려준다. */
function recorder() {
  const reads: string[] = [];
  const seen: AppData[] = [];
  return {
    reads,
    seen,
    readData: async () => {
      const tag = `read-${reads.length + 1}`;
      reads.push(tag);
      return appData(tag);
    },
    remember: (data: AppData) => {
      seen.push(data);
      return data.adminPromo?.code ?? "";
    },
  };
}

/** console.warn을 가로채 무엇이 남았는지 본다. */
async function captureWarnings(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    lines.push(args.map((item) => String(item)).join(" "));
  };
  try {
    await run();
  } finally {
    console.warn = original;
  }
  return lines;
}

/* ── 성공 경로 ──────────────────────────────────────── */

test("첫 시도에 성공하면 한 번만 읽는다", async () => {
  const store = recorder();
  const outcome = await runRetentionScrubWithRetry({
    readData: store.readData,
    attempt: async (data) => store.remember(data),
    isConflict,
  });

  assert.deepEqual(outcome, { ok: true, result: "read-1", attempts: 1 });
  assert.deepEqual(store.reads, ["read-1"]);
});

test("1회 겹친 뒤 최신 자료로 성공한다", async () => {
  const store = recorder();
  let calls = 0;
  const outcome = await runRetentionScrubWithRetry({
    readData: store.readData,
    attempt: async (data) => {
      calls += 1;
      if (calls === 1) throw new Conflict();
      return store.remember(data);
    },
    isConflict,
  });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  // 두 번째 회차가 본 것은 두 번째로 읽은 자료다. 지난 회차 것이 아니다.
  assert.equal(outcome.result, "read-2");
  assert.equal(outcome.attempts, 2);
  assert.deepEqual(store.reads, ["read-1", "read-2"]);
});

test("2회 겹친 뒤에도 마지막 회차에서 성공한다", async () => {
  const store = recorder();
  let calls = 0;
  const outcome = await runRetentionScrubWithRetry({
    readData: store.readData,
    attempt: async (data) => {
      calls += 1;
      if (calls <= 2) throw new Conflict();
      return store.remember(data);
    },
    isConflict,
  });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.result, "read-3");
  assert.equal(outcome.attempts, 3);
  assert.deepEqual(store.reads, ["read-1", "read-2", "read-3"]);
});

test("성공한 뒤에는 더 시도하지 않는다", async () => {
  const store = recorder();
  let attempts = 0;
  await runRetentionScrubWithRetry({
    readData: store.readData,
    attempt: async (data) => {
      attempts += 1;
      return store.remember(data);
    },
    isConflict,
  });
  assert.equal(attempts, 1);
  assert.equal(store.reads.length, 1);
});

/* ── 매번 처음부터 다시 한다 ───────────────────────── */

test("회차마다 자료를 새로 읽는다", async () => {
  const store = recorder();
  await runRetentionScrubWithRetry({
    readData: store.readData,
    attempt: async (data) => {
      store.remember(data);
      throw new Conflict();
    },
    isConflict,
  });
  // 시도 횟수만큼 읽었다. 한 번 읽어 돌려쓰지 않는다.
  assert.deepEqual(store.reads, ["read-1", "read-2", "read-3"]);
});

test("지난 회차의 자료를 다시 넘기지 않는다", async () => {
  const store = recorder();
  await runRetentionScrubWithRetry({
    readData: store.readData,
    attempt: async (data) => {
      store.remember(data);
      throw new Conflict();
    },
    isConflict,
  });

  // 회차마다 다른 객체였는지. 같은 객체를 다시 쓰면 CAS 기준 version도 낡는다.
  assert.equal(store.seen.length, 3);
  assert.equal(new Set(store.seen).size, 3);
  assert.deepEqual(
    store.seen.map((item) => item.adminPromo?.code),
    ["read-1", "read-2", "read-3"],
  );
});

/* ── 다시 하지 않는 경우 ───────────────────────────── */

test("겹침이 아닌 오류는 그대로 올린다", async () => {
  const store = recorder();
  let attempts = 0;
  const boom = new Error("connection reset");

  await assert.rejects(
    runRetentionScrubWithRetry({
      readData: store.readData,
      attempt: async () => {
        attempts += 1;
        throw boom;
      },
      isConflict,
    }),
    (error: unknown) => error === boom,
  );

  // 왜 실패했는지 모르는 채로 다시 지우려 하지 않는다.
  assert.equal(attempts, 1);
  assert.deepEqual(store.reads, ["read-1"]);
});

test("대상이 아니라는 답은 다시 시도하지 않는다", async () => {
  /*
   * 아직 보관 기간이 남았거나 증빙이 없다는 답은 실패가 아니다.
   * 다시 해도 같은 답이므로 그 자리에서 끝난다.
   */
  for (const reason of ["not-yet", "missing-evidence", "invalid-evidence", "invalid-now"]) {
    const store = recorder();
    const outcome = await runRetentionScrubWithRetry({
      readData: store.readData,
      attempt: async () => ({ applied: false as const, reason }),
      isConflict,
    });
    assert.deepEqual(outcome, {
      ok: true,
      result: { applied: false, reason },
      attempts: 1,
    });
    assert.deepEqual(store.reads, ["read-1"], reason);
  }
});

test("겹친 뒤 대상이 아니게 되면 그 자리에서 멈춘다", async () => {
  // 밀린 사이에 상태가 달라진 경우. 달라진 대로 판단하고 저장하지 않는다.
  const store = recorder();
  let calls = 0;
  const outcome = await runRetentionScrubWithRetry({
    readData: store.readData,
    attempt: async () => {
      calls += 1;
      if (calls === 1) throw new Conflict();
      return { applied: false as const, reason: "not-yet" };
    },
    isConflict,
  });

  assert.deepEqual(outcome, {
    ok: true,
    result: { applied: false, reason: "not-yet" },
    attempts: 2,
  });
  assert.equal(calls, 2);
});

test("겹친 뒤 짝 주문이 생기면 그 자리에서 멈춘다", async () => {
  // 짝 주문 확인도 회차마다 다시 이뤄진다. 생겼으면 orphan 경로를 진행하지 않는다.
  const store = recorder();
  let calls = 0;
  const outcome = await runRetentionScrubWithRetry({
    readData: store.readData,
    attempt: async () => {
      calls += 1;
      if (calls === 1) throw new Conflict();
      return { applied: false as const, reason: "paired-order-exists" };
    },
    isConflict,
  });

  assert.deepEqual(outcome, {
    ok: true,
    result: { applied: false, reason: "paired-order-exists" },
    attempts: 2,
  });
  assert.deepEqual(store.reads, ["read-1", "read-2"]);
});

/* ── 모두 겹친 경우 ────────────────────────────────── */

test("정해진 횟수를 모두 겹치면 충돌로 끝난다", async () => {
  const store = recorder();
  let attempts = 0;
  const outcome = await runRetentionScrubWithRetry({
    readData: store.readData,
    attempt: async () => {
      attempts += 1;
      throw new Conflict();
    },
    isConflict,
  });

  assert.deepEqual(outcome, { ok: false, reason: "cas-conflict", attempts: 3 });
  assert.equal(attempts, 3);
  // 네 번째는 없다. 읽기도 세 번뿐이다.
  assert.deepEqual(store.reads, ["read-1", "read-2", "read-3"]);
});

test("최초 시도를 포함해 세 번이다", () => {
  assert.equal(RETENTION_SCRUB_MAX_ATTEMPTS, 3);
});

/* ── 기록에 개인정보를 남기지 않는다 ───────────────── */

test("남기는 기록은 몇 번째 시도였는지뿐이다", async () => {
  const store = recorder();
  const lines = await captureWarnings(async () => {
    await runRetentionScrubWithRetry({
      readData: store.readData,
      attempt: async () => {
        throw new Conflict();
      },
      isConflict,
    });
  });

  assert.deepEqual(lines, [
    "[retention] store conflict on attempt 1",
    "[retention] store conflict on attempt 2",
    "[retention] store conflict on attempt 3",
    "[retention] store conflict exhausted",
  ]);
});

test("기록에 주문·상담 id나 사람의 값이 섞이지 않는다", async () => {
  /*
   * 어느 회원의 무엇을 지우는 중인지가 기록에 드러나면 안 된다.
   * id도 남기지 않는다(그 자체로 사람을 가리키는 값이다).
   */
  const store = recorder();
  const secrets = ["o-1", "c-1", "u-1", "홍길동", "010-1234-5678", "사연"];
  const lines = await captureWarnings(async () => {
    await runRetentionScrubWithRetry({
      readData: store.readData,
      attempt: async () => {
        throw new Conflict();
      },
      isConflict,
    });
  });

  for (const line of lines) {
    for (const secret of secrets) {
      assert.equal(line.includes(secret), false, `${line} 에 ${secret} 이 들어 있다`);
    }
  }
});

test("성공한 회차에는 아무 기록도 남기지 않는다", async () => {
  const store = recorder();
  const lines = await captureWarnings(async () => {
    await runRetentionScrubWithRetry({
      readData: store.readData,
      attempt: async (data) => store.remember(data),
      isConflict,
    });
  });
  assert.deepEqual(lines, []);
});
