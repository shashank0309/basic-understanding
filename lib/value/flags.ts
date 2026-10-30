import type { BenchmarkRange, Flag, ValueModel, ValueResult } from "./types";

export interface FlagSettings {
  roiMax: number; // ROI multiple above which ROI_TOO_HIGH fires
  lowConfidenceShare: number; // 0.5
}

export const DEFAULT_FLAG_SETTINGS: FlagSettings = { roiMax: 10, lowConfidenceShare: 0.5 };

export function computeFlags(model: ValueModel, result: ValueResult, benchmarks: BenchmarkRange[], settings: FlagSettings = DEFAULT_FLAG_SETTINGS): Flag[] {
  const flags: Flag[] = [];
  const bench = new Map(benchmarks.map((b) => [b.pattern, b]));

  model.steps.forEach((s, i) => {
    if (s.aiOpportunity === "NONE" || !s.aiPattern) return;
    const b = bench.get(s.aiPattern);
    const r = result.steps[i].reductionPct;
    if (b && (r < b.lowPct - 0.001 || r > b.highPct + 0.001)) {
      flags.push({
        code: "OUT_OF_RANGE",
        target: s.name,
        message: `"${s.name}": time reduction is ${r.toFixed(0)}%. The benchmark for ${s.aiPattern.toLowerCase()} is ${b.lowPct}–${b.highPct}%.`,
        highRisk: false,
      });
    }
  });

  if (result.roi > settings.roiMax) {
    flags.push({ code: "ROI_TOO_HIGH", message: `ROI is ${result.roi.toFixed(1)}×. This is more than ${settings.roiMax}×. Check the inputs.`, highRisk: true });
  }

  const time = result.levers.find((l) => l.key === "TIME_SAVED");
  if (time && result.peopleSpendAnnual !== null && time.annualFull > result.peopleSpendAnnual) {
    flags.push({
      code: "EXCEEDS_SPEND",
      message: "Time-saved value is more than the total annual cost of the people who do this process today.",
      highRisk: true,
    });
  }

  const totalFull = result.levers.reduce((a, l) => a + Math.max(0, l.annualFull), 0);
  const lowFull = result.levers.filter((l) => l.confidence === "LOW").reduce((a, l) => a + Math.max(0, l.annualFull), 0);
  if (totalFull > 0 && lowFull / totalFull > settings.lowConfidenceShare) {
    flags.push({ code: "LOW_CONFIDENCE_MAJORITY", message: `${((lowFull / totalFull) * 100).toFixed(0)}% of the value comes from inputs with LOW confidence.`, highRisk: false });
  }

  const missing = [
    ...model.levers.filter((l) => !l.sourceNote.trim()).map((l) => l.label || l.key),
    ...model.steps.flatMap((s) => s.missingSource.map((f) => `${s.name} – ${f}`)),
  ];
  if (missing.length) {
    flags.push({ code: "NO_SOURCE", message: `${missing.length} input(s) have no source note: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}`, highRisk: false });
  }

  if (result.fteSaved > 1 && model.factors.realizationFactor >= 1) {
    flags.push({
      code: "HEADCOUNT_IMPLIED",
      message: `Time saved equals ${result.fteSaved.toFixed(1)} FTE, but the realization factor is 1.0. This implies a headcount change.`,
      highRisk: true,
    });
  }
  return flags;
}

export const FLAG_LABELS: Record<Flag["code"], string> = {
  OUT_OF_RANGE: "Out of benchmark range",
  ROI_TOO_HIGH: "ROI too high",
  EXCEEDS_SPEND: "Exceeds current spend",
  LOW_CONFIDENCE_MAJORITY: "Mostly low confidence",
  NO_SOURCE: "No source",
  HEADCOUNT_IMPLIED: "Headcount implied",
};
