import { writeFileSync } from "node:fs";
import path from "node:path";
import { collectStrengthCaseTraces } from "@/lib/saju/validation/strength-audit/buildCaseTrace";

const cases = collectStrengthCaseTraces();
const payload = {
  description:
    "Current-engine Strength traces. Results were not rewritten. mixedPattern does not change direction.",
  generatedBy: "buildCaseTrace.collectStrengthCaseTraces + buildStrengthSummary",
  counts: {
    total: cases.length,
    mixed: cases.filter((item) => item.directionCandidate === "mixed").length,
    unresolved: cases.filter((item) => item.directionCandidate === null).length,
    leaningStrong: cases.filter((item) => item.directionCandidate === "leaning-strong").length,
    leaningWeak: cases.filter((item) => item.directionCandidate === "leaning-weak").length,
  },
  cases,
};

writeFileSync(path.join(__dirname, "strength-case-trace.json"), `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(payload.counts, null, 2)}\n`);
