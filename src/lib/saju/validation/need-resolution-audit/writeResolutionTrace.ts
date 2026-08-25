import { writeFileSync } from "node:fs";
import path from "node:path";
import { collectResolutionCaseTraces } from "./buildResolutionCaseTrace";

const cases = collectResolutionCaseTraces();
const payload = {
  description:
    "Current-engine NeedResolution traces. Results were not rewritten. Audit documents do not change Resolution judgment. Freeze Boundary is not this stage.",
  generatedBy: "buildResolutionCaseTrace.collectResolutionCaseTraces + buildNeedResolution / resolveNeedCandidates",
  engineUnchanged: true,
  freezeBoundaryNotThisStage: true,
  counts: {
    total: cases.length,
    existingChart: cases.filter((item) => item.source === "existing-chart").length,
    injectedNeedSet: cases.filter((item) => item.source === "injected-needSet").length,
    noCandidates: cases.filter((item) => item.relationPattern === "no-candidates").length,
    strengthOnly: cases.filter((item) => item.relationPattern === "strength-only").length,
    climateOnly: cases.filter((item) => item.relationPattern === "climate-only").length,
    partialOverlap: cases.filter((item) => item.relationPattern === "partial-overlap").length,
    exactOverlap: cases.filter((item) => item.relationPattern === "exact-overlap").length,
    disjoint: cases.filter((item) => item.relationPattern === "disjoint").length,
    policyGapsAlwaysEmpty: cases.every((item) => item.policyGaps.length === 0),
    noWinnerFields: true,
  },
  cases,
};

writeFileSync(path.join(__dirname, "resolution-case-trace.json"), `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(payload.counts, null, 2)}\n`);
