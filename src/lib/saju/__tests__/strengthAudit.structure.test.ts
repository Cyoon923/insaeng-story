import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.join(__dirname, "../validation/strength-audit");

const inventory = JSON.parse(readFileSync(path.join(dir, "strength-rule-inventory.json"), "utf8")) as {
  notFullyValidated: boolean;
  engineUnchanged: boolean;
  freezeStates: string[];
  forbiddenInStrengthJudgment: string[];
  rules: Array<{
    ruleId: string;
    freezeStatus: string;
    validationClass: string;
    condition: string;
    output: string;
  }>;
};

const freezeBoundary = readFileSync(path.join(dir, "strength-freeze-boundary.md"), "utf8");
const indexTs = readFileSync(path.join(__dirname, "../validation/index.ts"), "utf8");

describe("Strength freeze-boundary artifacts", () => {
  it("classifies every inventory rule into one freeze state", () => {
    expect(inventory.notFullyValidated).toBe(true);
    expect(inventory.engineUnchanged).toBe(true);
    expect(inventory.freezeStates).toEqual([
      "VERIFIED-FACT",
      "FROZEN-POLICY",
      "REQUIRES-INTERPRETIVE-VALIDATION",
      "OPEN",
    ]);
    expect(inventory.rules).toHaveLength(60);
    const counts: Record<string, number> = {};
    for (const rule of inventory.rules) {
      expect(inventory.freezeStates).toContain(rule.freezeStatus);
      expect(rule.ruleId).toMatch(/^STR-/);
      expect(rule.condition.length).toBeGreaterThan(0);
      expect(rule.output.length).toBeGreaterThan(0);
      counts[rule.freezeStatus] = (counts[rule.freezeStatus] ?? 0) + 1;
    }
    expect(counts["VERIFIED-FACT"]).toBe(6);
    expect(counts["FROZEN-POLICY"]).toBe(32);
    expect(counts["REQUIRES-INTERPRETIVE-VALIDATION"]).toBe(21);
    expect(counts.OPEN).toBe(1);
    expect(inventory.rules.filter((item) => item.validationClass === "FACT").every((item) => item.freezeStatus === "VERIFIED-FACT")).toBe(
      true,
    );
  });

  it("keeps fact lookup separate from direction validation in the freeze document", () => {
    expect(freezeBoundary).toContain("사실층 검증 완료 + 보수 정책 경계 확정 + 해석층 검증 대기");
    expect(freezeBoundary).toContain("완전 검증 완료가 아니다");
    expect(freezeBoundary).toContain("FROZEN-POLICY = 명리학적 검증 완료가 아니다");
    expect(freezeBoundary).toContain("directionCandidate 전체를 검증 완료로 표시하지 않는다");
    expect(freezeBoundary).toContain("mixed는 최종 신강/신약이 아니다");
    expect(freezeBoundary).toContain("엔진 오류가 아님");
    expect(indexTs).not.toContain("strength-audit");
    expect(inventory.forbiddenInStrengthJudgment).toEqual(
      expect.arrayContaining(["score", "weight", "neededElement", "yongsin", "heesin"]),
    );
  });
});
