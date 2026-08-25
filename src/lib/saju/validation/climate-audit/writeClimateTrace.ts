import { writeFileSync } from "node:fs";
import path from "node:path";
import { collectClimateCaseTraces } from "./buildClimateCaseTrace";

const cases = collectClimateCaseTraces();
const payload = {
  description:
    "Current-engine Climate traces. Results were not rewritten. Audit documents do not change Climate judgment.",
  generatedBy: "buildClimateCaseTrace.collectClimateCaseTraces + collectClimateEvidence + buildAdjustedClimateSummary + buildNeedCandidateSet",
  engineUnchanged: true,
  counts: {
    total: cases.length,
    temperatureUnresolved: cases.filter((item) => item.temperature.status === "unresolved").length,
    moistureUnresolved: cases.filter((item) => item.moisture.status === "unresolved").length,
    climateNeedEmpty: cases.filter((item) => item.climateNeedCandidates.length === 0).length,
    counterSignalsAlwaysEmpty: cases.every((item) => item.counterSignals.length === 0),
  },
  cases,
};

writeFileSync(path.join(__dirname, "climate-case-trace.json"), `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(payload.counts, null, 2)}\n`);
