import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareAllRuleTables, summarizeRuleTable } from "@/lib/saju/validation/rule-table/compare";
import type { RuleTableRowResult } from "@/lib/saju/validation/rule-table/compare";

const index = JSON.parse(
  readFileSync(path.join(__dirname, "../validation/rule-table/cases.json"), "utf8"),
) as { set: string; tableFiles: string[]; cases: unknown[] };

function reportDifferences(rows: RuleTableRowResult[]) {
  const summary = summarizeRuleTable(rows);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        total: summary.total,
        match: summary.match,
        difference: summary.difference,
        byTable: summary.byTable,
      },
      null,
      2,
    ),
  );

  for (const item of summary.differences) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          table: item.table,
          input: item.input,
          expected: item.expected,
          actual: item.actual,
          sourceRule: item.sourceRule,
          id: item.id,
        },
        null,
        2,
      ),
    );
  }

  return summary;
}

describe("Rule-table Validation Set", () => {
  it("keeps independent expected tables separate from engine output and design fixtures", () => {
    expect(index.set).toBe("rule-table");
    expect(index.tableFiles).toEqual(
      expect.arrayContaining([
        "heavenlyStems.json",
        "earthlyBranches.json",
        "hiddenStems.json",
        "shiShen.json",
        "seasonPhases.json",
        "roots.json",
        "presence.json",
        "exactStemVisible.json",
        "chenWeiXuChou.json",
        "hourUnknown.json",
      ]),
    );
    expect(JSON.stringify(index)).not.toMatch(/neededElement|yongsin|finalElement|strengthDirection/);
  });

  it("compares rule-table expected to implementation with match/difference only", () => {
    const rows = compareAllRuleTables();
    const summary = reportDifferences(rows);
    const byTable = summary.byTable;

    expect(byTable["heavenly-stems"]?.total).toBe(10);
    expect(byTable["earthly-branches"]?.total).toBe(12);
    expect(byTable["hidden-stems"]?.total).toBe(12);
    expect(byTable["shi-shen"]?.total).toBe(100);
    expect(byTable["season-phases"]?.total).toBe(60);
    expect(byTable["season-phases-stem-polarity"]?.total).toBe(60);
    expect(byTable["wang-month-root"]?.total).toBe(12);
    expect(byTable.roots?.total).toBe(20);
    expect(byTable.presence?.total).toBe(20);
    expect(byTable["exact-stem-visible"]?.total).toBe(5);
    expect(byTable["hour-unknown"]?.total).toBe(3);

    const exact = rows.filter((item) => item.table === "exact-stem-visible");
    expect(exact.some((item) => JSON.stringify(item.expected).includes("rooted-visible") && JSON.stringify(item.expected).includes("\"exactStemVisible\":false"))).toBe(true);
    expect(exact.some((item) => JSON.stringify(item.expected).includes("\"exactStemVisible\":true"))).toBe(true);

    expect(summary.difference).toBe(0);
    expect(summary.differences).toEqual([]);
  });
});
