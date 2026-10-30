// Builds the ValueModel from the database and runs the deterministic engine.
import { db } from "../db";
import { parse } from "../json";
import { getSettings } from "../settings";
import { computeValue } from "../value/calc";
import { computeFlags } from "../value/flags";
import { GENERAL_INPUTS } from "../value/levers";
import { monteCarlo } from "../value/montecarlo";
import type { Confidence, StepInput, ValueModel } from "../value/types";
import { minConfidence } from "../value/calc";

export type FieldMeta = { source: string; note: string; confidence: Confidence };
export const FIELD_LABELS: Record<string, string> = {
  minutesPerOccurrence: "minutes", occurrencesPerMonth: "frequency", peopleCount: "people", costPerHour: "cost per hour",
  errorRatePct: "error rate", costPerError: "cost per error", aiMinutes: "with-AI minutes", aiErrorRatePct: "with-AI error rate",
};
export const STEP_VALUE_FIELDS = ["minutesPerOccurrence", "occurrencesPerMonth", "peopleCount", "costPerHour", "errorRatePct", "costPerError", "aiMinutes", "aiErrorRatePct"] as const;

export async function ensureGeneralInputs(requestId: string) {
  const s = await getSettings();
  const defaults: Record<string, number> = {
    adoptionY1: Number(s.defaultAdoptionY1), adoptionY2: Number(s.defaultAdoptionY2), adoptionY3: Number(s.defaultAdoptionY3),
    realizationFactor: Number(s.defaultRealization), processTeamFte: 0,
  };
  for (const g of GENERAL_INPUTS) {
    const exists = await db.valueInput.findUnique({ where: { requestId_leverKey_key: { requestId, leverKey: "GENERAL", key: g.key } } });
    if (!exists && (g.key !== "processTeamFte")) {
      await db.valueInput.create({
        data: { requestId, leverKey: "GENERAL", key: g.key, label: g.label, value: defaults[g.key], unit: g.unit, source: "BENCHMARK", sourceNote: "Factory default (demo value)", confidence: "MEDIUM" },
      });
    }
  }
}

export async function costTotals(requestId: string) {
  const items = await db.costItem.findMany({ where: { requestId }, include: { component: true } });
  const buildCost = items.filter((i) => i.oneTime).reduce((a, i) => a + i.quantity * i.unitCost, 0);
  const annualRunCost = items.filter((i) => !i.oneTime).reduce((a, i) => a + i.quantity * i.unitCost, 0);
  return { items, buildCost, annualRunCost };
}

export async function loadValue(requestId: string, opts: { monteCarlo?: boolean } = {}) {
  const s = await getSettings();
  const [steps, inputs, bench, costs] = await Promise.all([
    db.processStep.findMany({ where: { requestId }, orderBy: { order: "asc" } }),
    db.valueInput.findMany({ where: { requestId } }),
    db.benchmark.findMany(),
    costTotals(requestId),
  ]);
  const g = (k: string, d: number) => inputs.find((i) => i.leverKey === "GENERAL" && i.key === k)?.value ?? d;
  const stepInputs: StepInput[] = steps.map((st) => {
    const meta = parse<Record<string, FieldMeta>>(st.meta, {});
    const relevant = STEP_VALUE_FIELDS.map((f) => meta[f]).filter(Boolean);
    return {
      id: st.id, name: st.name, minutesPerOccurrence: st.minutesPerOccurrence, occurrencesPerMonth: st.occurrencesPerMonth, peopleCount: st.peopleCount,
      costPerHour: st.costPerHour, errorRatePct: st.errorRatePct, costPerError: st.costPerError, aiOpportunity: st.aiOpportunity, aiPattern: st.aiPattern,
      aiMinutes: st.aiOpportunity === "NONE" ? st.minutesPerOccurrence : st.aiMinutes,
      aiErrorRatePct: st.aiOpportunity === "NONE" ? st.errorRatePct : st.aiErrorRatePct,
      confidence: minConfidence(["minutesPerOccurrence", "occurrencesPerMonth", "aiMinutes"].map((f) => meta[f]?.confidence ?? "MEDIUM")),
      missingSource: STEP_VALUE_FIELDS.filter((f) => !meta[f]?.note?.trim()).map((f) => FIELD_LABELS[f]),
    };
  });
  const horizon = Number(s.horizonYears) || 5;
  const model: ValueModel = {
    steps: stepInputs,
    levers: inputs.map((i) => ({ leverKey: i.leverKey, key: i.key, label: i.label, value: i.value, low: i.low, high: i.high, confidence: i.confidence as Confidence, sourceNote: i.sourceNote })),
    factors: {
      adoption: [g("adoptionY1", 0.4), g("adoptionY2", 0.7), g("adoptionY3", 0.85)],
      realizationFactor: g("realizationFactor", 0.5),
      horizonYears: horizon,
      discountRate: Number(s.discountRate) || 0.1,
      hoursPerFte: Number(s.hoursPerFte) || 1800,
    },
    costs: { buildCost: costs.buildCost, annualRunCost: costs.annualRunCost },
  };
  const result = computeValue(model);
  const benchRanges = bench.map((b) => ({ pattern: b.pattern, lowPct: b.lowPct, highPct: b.highPct }));
  const flags = computeFlags(model, result, benchRanges, { roiMax: Number(s.roiMax) || 10, lowConfidenceShare: 0.5 });
  const mc = opts.monteCarlo ? monteCarlo(model, benchRanges, Number(s.monteCarloRuns) || 1000) : null;
  return { model, result, flags, mc, steps, inputs, bench, costs, settings: s };
}
