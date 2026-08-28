/**
 * L4 — 경합 게이트 (TBD-02g · §1.5.10).
 *
 * 하지 않는 것: clash 합성 · Natal score 적용 · Effective 계산 · clamp ·
 * Level 재판정 · C-* 재평가(FourPillars를 받지 않는다).
 *
 * 경합 identity는 **물리적 참여 자리** `(layer × slot)`이다. 같은 slot이라도
 * layer가 다르면 공유가 아니다 — §1.5.10.2의 S6(천간합 + 지지합 = **병존**)와 정합.
 *
 * 경합 집합은 **연결 요소**로 묶는다(§1.5.10.6): A–B 공유, B–C 공유면 A·B·C가 한 집합.
 */

import type {
  TransformCandidate,
  TransformConditionState,
  TransformRawModifier,
  TransformResolvedModifier,
} from "@/lib/saju/transform/types";

/** 참여 자리 키 — 경합 판정의 유일 기준. */
function slotKeysOf(modifier: TransformRawModifier): string[] {
  return modifier.attenuations.map((row) => `${row.layer}:${row.slot}`);
}

/** relation 인스턴스 식별자 — 같은 combineId가 여러 자리 조합으로 존재할 수 있다. */
function instanceKeyOf(combineId: string, slotKeys: readonly string[]): string {
  return `${combineId}|${[...slotKeys].join(",")}`;
}

function candidateInstanceKey(candidate: TransformCandidate): string {
  return instanceKeyOf(
    candidate.relation.combineId,
    candidate.relation.participants.map((p) => `${p.layer}:${p.slot}`),
  );
}

/** 연결 요소 분해 — 자리를 하나라도 공유하면 같은 집합. */
function buildCompetitionGroups(modifiers: readonly TransformRawModifier[]): number[][] {
  const parent = modifiers.map((_, index) => index);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    let cursor = i;
    while (parent[cursor] !== root) {
      const next = parent[cursor]!;
      parent[cursor] = root;
      cursor = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const slotKeySets = modifiers.map((modifier) => new Set(slotKeysOf(modifier)));
  for (let i = 0; i < modifiers.length; i += 1) {
    for (let j = i + 1; j < modifiers.length; j += 1) {
      const shares = [...slotKeySets[i]!].some((key) => slotKeySets[j]!.has(key));
      if (shares) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < modifiers.length; i += 1) {
    const root = find(i);
    const bucket = groups.get(root);
    if (bucket === undefined) groups.set(root, [i]);
    else bucket.push(i);
  }
  return [...groups.values()];
}

/** P1 — 지지 완합(삼합·방합) ≻ 천간 五合. */
function preferBranchCompleteCombine(modifier: TransformRawModifier): boolean {
  return modifier.kind === "삼합" || modifier.kind === "방합";
}

/** P2 — 월지(지지합) / 월간(천간합)이 구성에 포함. 둘 다 `slot === "month"`로 표현된다. */
function includesMonthSlot(modifier: TransformRawModifier): boolean {
  return modifier.attenuations.some((row) => row.slot === "month");
}

/** P6 — 삼합 ≻ 방합 ≻ 五合. */
const KIND_TIEBREAK_RANK: Record<TransformRawModifier["kind"], number> = {
  삼합: 0,
  방합: 1,
  五合: 2,
};

function rootStateOf(
  modifier: TransformRawModifier,
  candidateByKey: ReadonlyMap<string, TransformCandidate>,
): TransformConditionState {
  const key = instanceKeyOf(modifier.combineId, slotKeysOf(modifier));
  const candidate = candidateByKey.get(key);
  if (candidate === undefined) {
    throw new Error(
      `resolveTransformCompetition: no candidate matches modifier instance ${key}`,
    );
  }
  return candidate.conditions.find((condition) => condition.key === "root")?.state ?? "unknown";
}

/** 술어로 좁히되, 아무도 만족하지 않거나 전원 만족이면 좁히지 않는다(동률). */
function narrow(indices: number[], predicate: (index: number) => boolean): number[] {
  const preferred = indices.filter(predicate);
  return preferred.length === 0 || preferred.length === indices.length ? indices : preferred;
}

/**
 * §1.5.10.6 P1–P6를 **점수 없이 lexicographic**으로 적용한다.
 * 확정되지 않은 세부(P5의 "더 좁은 쌍")는 구현하지 않고 동률로 둔다.
 */
function pickWinner(
  groupIndices: readonly number[],
  modifiers: readonly TransformRawModifier[],
  candidateByKey: ReadonlyMap<string, TransformCandidate>,
): number | null {
  let survivors = [...groupIndices];

  // P1 완전 구조 — 한 집합은 layer가 같으므로 실제로는 갈리지 않는다(S6, §1.5.10.6 주).
  survivors = narrow(survivors, (i) => preferBranchCompleteCombine(modifiers[i]!));
  if (survivors.length === 1) return survivors[0]!;

  // P2 월령 자리 포함
  survivors = narrow(survivors, (i) => includesMonthSlot(modifiers[i]!));
  if (survivors.length === 1) return survivors[0]!;

  // P3 C-투간 — 이미 required pass라 추가 신호 없음 → 건너뜀 (§1.5.10.6)

  // P4 C-통근 — pass만 우위. unknown은 우위 주장 불가.
  survivors = narrow(
    survivors,
    (i) => rootStateOf(modifiers[i]!, candidateByKey) === "satisfied",
  );
  if (survivors.length === 1) return survivors[0]!;

  // P5 C-거리 — 지지 완합은 N(스킵). 五合은 둘 다 R pass라 동률.
  //   "인접 충족이 더 좁은 쌍"의 세부는 문서 미확정 → 구현하지 않는다.

  // P6 종류 타이브레이크
  const bestRank = Math.min(...survivors.map((i) => KIND_TIEBREAK_RANK[modifiers[i]!.kind]));
  survivors = survivors.filter((i) => KIND_TIEBREAK_RANK[modifiers[i]!.kind] === bestRank);

  return survivors.length === 1 ? survivors[0]! : null;
}

/**
 * raw modifier에 게이트 출력을 부여한다.
 *
 * - 자리를 공유하지 않으면 `uncontested` / active
 * - 승자 확정 시 winner `won`/active, 나머지 `lost`/inactive
 * - 단수 승자를 못 정하면 집합 **전원** `competition-unresolved`/inactive (§1.5.10.7)
 * - 어떤 경우에도 modifier를 **삭제하지 않는다**
 * - 반환 순서는 입력 순서를 보존하고, 입력을 변경하지 않는다
 */
export function resolveTransformCompetition(
  rawModifiers: readonly TransformRawModifier[],
  candidates: readonly TransformCandidate[],
): TransformResolvedModifier[] {
  const candidateByKey = new Map(
    candidates.map((candidate) => [candidateInstanceKey(candidate), candidate]),
  );

  const resolved: TransformResolvedModifier[] = rawModifiers.map((modifier) => ({
    ...modifier,
    attenuations: modifier.attenuations.map((row) => ({ ...row })),
    modifierActive: false,
    contentionStatus: "competition-unresolved",
  }));

  for (const groupIndices of buildCompetitionGroups(rawModifiers)) {
    if (groupIndices.length === 1) {
      const only = groupIndices[0]!;
      resolved[only]!.contentionStatus = "uncontested";
      resolved[only]!.modifierActive = true;
      continue;
    }

    const winner = pickWinner(groupIndices, rawModifiers, candidateByKey);
    if (winner === null) {
      for (const index of groupIndices) {
        resolved[index]!.contentionStatus = "competition-unresolved";
        resolved[index]!.modifierActive = false;
      }
      continue;
    }
    for (const index of groupIndices) {
      const won = index === winner;
      resolved[index]!.contentionStatus = won ? "won" : "lost";
      resolved[index]!.modifierActive = won;
    }
  }

  return resolved;
}
