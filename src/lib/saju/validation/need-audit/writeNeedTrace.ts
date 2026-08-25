import { writeFileSync } from "node:fs";
import path from "node:path";
import { collectNeedCaseTraces } from "./buildNeedCaseTrace";

const cases = collectNeedCaseTraces();
const payload = {
  description:
    "Current-engine NeedCandidate traces. Results were not rewritten. Audit documents do not change Need judgment. NeedResolution rules are not audited here.",
  generatedBy:
    "buildNeedCaseTrace.collectNeedCaseTraces + buildStrengthSummary + buildAdjustedClimateSummary + buildNeedCandidateSet",
  engineUnchanged: true,
  needResolutionNotAudited: true,
  counts: {
    total: cases.length,
    leaningStrong: cases.filter((item) => item.strengthState.directionCandidate === "leaning-strong").length,
    leaningWeak: cases.filter((item) => item.strengthState.directionCandidate === "leaning-weak").length,
    mixed: cases.filter((item) => item.strengthState.directionCandidate === "mixed").length,
    unresolvedNull: cases.filter((item) => item.strengthState.directionCandidate === null).length,
    climateNeedEmpty: cases.filter((item) => item.climateCandidates.length === 0).length,
    strengthNeedEmpty: cases.filter((item) => item.strengthCandidates.length === 0).length,
    bothEmpty: cases.filter((item) => item.strengthCandidates.length === 0 && item.climateCandidates.length === 0)
      .length,
    hourUnknown: cases.filter((item) => item.inputSummary.hour === "unknown").length,
    counterSignalsAlwaysEmpty: cases.every((item) => item.candidateOutput.climateCounterSignals.length === 0),
  },
  cases,
};

writeFileSync(path.join(__dirname, "need-case-trace.json"), `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(payload.counts, null, 2)}\n`);
