// Deterministic value engine. The LLM never calculates numbers: all values come from here.
import { ADOPTION_LEVERS } from "./levers";
import type { Confidence, LeverInputValue, LeverResult, StepResult, ValueModel, ValueResult } from "./types";

const CONF_RANK: Record<Confidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export function minConfidence(list: Confidence[]): Confidence {
  if (list.length === 0) return "MEDIUM";
  return list.reduce((a, b) => (CONF_RANK[b] < CONF_RANK[a] ? b : a));
}

export function adoptionForYear(adoption: number[], yearIndex: number): number {
  if (adoption.length === 0) return 1;
  return adoption[Math.min(yearIndex, adoption.length - 1)];
}

function leverValue(levers: LeverInputValue[], leverKey: string, key: string): LeverInputValue | undefined {
  return levers.find((l) => l.leverKey === leverKey && l.key === key);
}

export function computeSteps(model: ValueModel): StepResult[] {
  return model.steps.map((s) => {
    const occPerYear = s.occurrencesPerMonth * 12 * s.peopleCount;
    const baselineHours = (s.minutesPerOccurrence / 60) * occPerYear;
    const aiHours = (s.aiMinutes / 60) * occPerYear;
    const baselineErrors = occPerYear * (s.errorRatePct / 100);
    const aiErrors = occPerYear * (s.aiErrorRatePct / 100);
    const timeValueFull = (baselineHours - aiHours) * s.costPerHour * model.factors.realizationFactor;
    const errorValueFull = (baselineErrors - aiErrors) * s.costPerError;
    return {
      name: s.name,
      baselineHoursPerYear: baselineHours,
      aiHoursPerYear: aiHours,
      baselineErrorsPerYear: baselineErrors,
      aiErrorsPerYear: aiErrors,
      baselineMinutes: s.minutesPerOccurrence,
      aiMinutes: s.aiMinutes,
      reductionPct: s.minutesPerOccurrence > 0 ? ((s.minutesPerOccurrence - s.aiMinutes) / s.minutesPerOccurrence) * 100 : 0,
      timeValueFull,
      errorValueFull,
    };
  });
}

/** Annual value per lever at full adoption (before the adoption ramp). */
export function leverAnnualFull(model: ValueModel, steps: StepResult[]): { key: string; value: number; confidence: Confidence }[] {
  const L = model.levers;
  const get = (lever: string, key: string) => leverValue(L, lever, key);
  const prod = (lever: string, keys: string[], scale: number[] = []) => {
    const items = keys.map((k) => get(lever, k));
    if (items.some((i) => !i)) return null;
    const value = items.reduce((acc, i, idx) => acc * i!.value * (scale[idx] ?? 1), 1);
    return { value, confidence: minConfidence(items.map((i) => i!.confidence)) };
  };
  const stepConf = minConfidence(model.steps.filter((s) => s.aiOpportunity !== "NONE").map((s) => s.confidence));
  const out: { key: string; value: number; confidence: Confidence }[] = [];
  const time = steps.reduce((a, s) => a + s.timeValueFull, 0);
  if (model.steps.length) out.push({ key: "TIME_SAVED", value: time, confidence: stepConf });
  const errors = steps.reduce((a, s) => a + s.errorValueFull, 0);
  if (errors !== 0) out.push({ key: "ERRORS_AVOIDED", value: errors, confidence: stepConf });
  const comp = prod("COMPLIANCE_RISK", ["auditObservationsAvoidedPerYear", "costPerObservation", "probabilityFactor"]);
  if (comp) out.push({ key: "COMPLIANCE_RISK", ...comp });
  const rev = prod("REVENUE_UPLIFT", ["additionalSales", "marginPct", "attributionFactor"], [1, 0.01, 1]);
  if (rev) out.push({ key: "REVENUE_UPLIFT", ...rev });
  const cost = prod("COST_AVOIDED", ["annualCostAvoided"]);
  if (cost) out.push({ key: "COST_AVOIDED", ...cost });
  const cyc = prod("CYCLE_TIME", ["daysReduced", "valuePerDay"]);
  if (cyc) out.push({ key: "CYCLE_TIME", ...cyc });
  return out;
}

export function tco(costs: { buildCost: number; annualRunCost: number }, horizonYears: number): number {
  return costs.buildCost + horizonYears * costs.annualRunCost;
}

/** First month in which cumulative net benefit covers the build cost; null if not within horizon. */
export function paybackMonth(byYear: number[], buildCost: number, annualRunCost: number): number | null {
  let cum = -buildCost;
  if (cum >= 0) return 0;
  for (let m = 1; m <= byYear.length * 12; m++) {
    cum += byYear[Math.floor((m - 1) / 12)] / 12 - annualRunCost / 12;
    if (cum >= 0) return m;
  }
  return null;
}

export function npv(byYear: number[], buildCost: number, annualRunCost: number, rate: number): number {
  return byYear.reduce((acc, b, y) => acc + (b - annualRunCost) / Math.pow(1 + rate, y + 1), -buildCost);
}

export function computeValue(model: ValueModel): ValueResult {
  const f = model.factors;
  const steps = computeSteps(model);
  const annual = leverAnnualFull(model, steps);
  const years = Math.max(1, Math.round(f.horizonYears));
  const levers: LeverResult[] = annual.map((a) => {
    const adoptionApplies = ADOPTION_LEVERS.has(a.key);
    const byYear = Array.from({ length: years }, (_, y) => a.value * (adoptionApplies ? adoptionForYear(f.adoption, y) : 1));
    return { key: a.key, annualFull: a.value, byYear, total: byYear.reduce((x, y) => x + y, 0), confidence: a.confidence, adoptionApplies };
  });
  const byYear = Array.from({ length: years }, (_, y) => levers.reduce((acc, l) => acc + l.byYear[y], 0));
  const totalBenefit = byYear.reduce((a, b) => a + b, 0);
  const totalTco = tco(model.costs, years);
  const hoursSaved = steps.reduce((a, s) => a + (s.baselineHoursPerYear - s.aiHoursPerYear), 0);
  const team = model.levers.find((l) => l.leverKey === "GENERAL" && l.key === "processTeamFte")?.value ?? 0;
  const avgRate = model.steps.length ? model.steps.reduce((a, s) => a + s.costPerHour, 0) / model.steps.length : 0;
  return {
    levers,
    steps,
    byYear,
    totalBenefit,
    annualSteadyState: byYear[byYear.length - 1] ?? 0,
    tco: totalTco,
    netValue: totalBenefit - totalTco,
    roi: totalTco > 0 ? totalBenefit / totalTco : 0,
    paybackMonth: paybackMonth(byYear, model.costs.buildCost, model.costs.annualRunCost),
    npv: npv(byYear, model.costs.buildCost, model.costs.annualRunCost, f.discountRate),
    hoursSavedPerYear: hoursSaved,
    fteSaved: f.hoursPerFte > 0 ? hoursSaved / f.hoursPerFte : 0,
    baselineCycleMinutes: model.steps.reduce((a, s) => a + s.minutesPerOccurrence, 0),
    aiCycleMinutes: model.steps.reduce((a, s) => a + s.aiMinutes, 0),
    peopleSpendAnnual: team > 0 ? team * f.hoursPerFte * avgRate : null,
  };
}
