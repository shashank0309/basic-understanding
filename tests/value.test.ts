import { describe, expect, it } from "vitest";
import { computeValue, paybackMonth, tco, adoptionForYear, minConfidence } from "@/lib/value/calc";
import { computeFlags } from "@/lib/value/flags";
import { monteCarlo, triangular, percentile } from "@/lib/value/montecarlo";
import type { StepInput, ValueModel } from "@/lib/value/types";

const step = (o: Partial<StepInput> = {}): StepInput => ({
  name: "Review draft",
  minutesPerOccurrence: 60,
  occurrencesPerMonth: 10,
  peopleCount: 2,
  costPerHour: 1000,
  errorRatePct: 5,
  costPerError: 2000,
  aiOpportunity: "ASSIST",
  aiPattern: "DRAFTING",
  aiMinutes: 30,
  aiErrorRatePct: 2,
  confidence: "MEDIUM",
  missingSource: [],
  ...o,
});

const model = (o: Partial<ValueModel> = {}): ValueModel => ({
  steps: [step()],
  levers: [],
  factors: { adoption: [0.4, 0.7, 0.85], realizationFactor: 0.5, horizonYears: 5, discountRate: 0.1, hoursPerFte: 1800 },
  costs: { buildCost: 100_000, annualRunCost: 20_000 },
  ...o,
});

describe("value engine", () => {
  it("computes TIME_SAVED per the lever formula", () => {
    const r = computeValue(model());
    // (60-30)/60 × 10 × 12 × 2 × 1000 × 0.5 = 60,000
    const t = r.levers.find((l) => l.key === "TIME_SAVED")!;
    expect(t.annualFull).toBeCloseTo(60_000);
    expect(t.byYear[0]).toBeCloseTo(24_000);
    expect(t.byYear[1]).toBeCloseTo(42_000);
    expect(t.byYear[4]).toBeCloseTo(51_000);
  });

  it("computes ERRORS_AVOIDED", () => {
    const r = computeValue(model());
    // 240 occurrences × 3% × 2000 = 14,400
    expect(r.levers.find((l) => l.key === "ERRORS_AVOIDED")!.annualFull).toBeCloseTo(14_400);
  });

  it("computes other levers without adoption ramp", () => {
    const r = computeValue(
      model({
        steps: [],
        levers: [
          { leverKey: "COMPLIANCE_RISK", key: "auditObservationsAvoidedPerYear", value: 2, confidence: "MEDIUM", sourceNote: "x" },
          { leverKey: "COMPLIANCE_RISK", key: "costPerObservation", value: 500_000, confidence: "LOW", sourceNote: "x" },
          { leverKey: "COMPLIANCE_RISK", key: "probabilityFactor", value: 0.5, confidence: "MEDIUM", sourceNote: "x" },
          { leverKey: "REVENUE_UPLIFT", key: "additionalSales", value: 1_000_000, confidence: "MEDIUM", sourceNote: "x" },
          { leverKey: "REVENUE_UPLIFT", key: "marginPct", value: 40, confidence: "HIGH", sourceNote: "x" },
          { leverKey: "REVENUE_UPLIFT", key: "attributionFactor", value: 0.5, confidence: "MEDIUM", sourceNote: "x" },
          { leverKey: "COST_AVOIDED", key: "annualCostAvoided", value: 300_000, confidence: "HIGH", sourceNote: "x" },
          { leverKey: "CYCLE_TIME", key: "daysReduced", value: 10, confidence: "MEDIUM", sourceNote: "x" },
          { leverKey: "CYCLE_TIME", key: "valuePerDay", value: 5_000, confidence: "MEDIUM", sourceNote: "x" },
        ],
      }),
    );
    const v = Object.fromEntries(r.levers.map((l) => [l.key, l]));
    expect(v.COMPLIANCE_RISK.annualFull).toBe(500_000);
    expect(v.COMPLIANCE_RISK.confidence).toBe("LOW");
    expect(v.REVENUE_UPLIFT.annualFull).toBeCloseTo(200_000);
    expect(v.COST_AVOIDED.byYear[0]).toBe(300_000);
    expect(v.CYCLE_TIME.annualFull).toBe(50_000);
  });

  it("computes TCO, net value, ROI and payback", () => {
    const r = computeValue(model());
    expect(r.tco).toBe(200_000);
    expect(r.totalBenefit).toBeCloseTo(r.byYear.reduce((a, b) => a + b, 0));
    expect(r.netValue).toBeCloseTo(r.totalBenefit - 200_000);
    expect(r.roi).toBeCloseTo(r.totalBenefit / 200_000);
    expect(r.paybackMonth).not.toBeNull();
  });

  it("payback month helper", () => {
    expect(paybackMonth([120_000], 60_000, 0)).toBe(6);
    expect(paybackMonth([12_000], 60_000, 0)).toBeNull();
    expect(paybackMonth([12_000], 0, 0)).toBe(0);
  });

  it("helpers", () => {
    expect(tco({ buildCost: 10, annualRunCost: 5 }, 3)).toBe(25);
    expect(adoptionForYear([0.4, 0.7, 0.85], 7)).toBe(0.85);
    expect(minConfidence(["HIGH", "LOW", "MEDIUM"])).toBe("LOW");
  });
});

describe("flags", () => {
  const bench = [{ pattern: "DRAFTING", lowPct: 30, highPct: 60 }];

  it("no flags for a reasonable case", () => {
    const m = model();
    expect(computeFlags(m, computeValue(m), bench)).toEqual([]);
  });

  it("OUT_OF_RANGE when reduction is outside the benchmark", () => {
    const m = model({ steps: [step({ aiMinutes: 5 })] });
    expect(computeFlags(m, computeValue(m), bench).map((f) => f.code)).toContain("OUT_OF_RANGE");
  });

  it("ROI_TOO_HIGH, EXCEEDS_SPEND, HEADCOUNT_IMPLIED for an inflated case", () => {
    const m = model({
      steps: [step({ peopleCount: 250, occurrencesPerMonth: 30, minutesPerOccurrence: 30, aiMinutes: 15, aiPattern: "DRAFTING", costPerHour: 2000 })],
      levers: [{ leverKey: "GENERAL", key: "processTeamFte", value: 4, confidence: "HIGH", sourceNote: "HR" }],
      factors: { adoption: [0.4, 0.7, 0.85], realizationFactor: 1, horizonYears: 5, discountRate: 0.1, hoursPerFte: 1800 },
      costs: { buildCost: 1_200_000, annualRunCost: 200_000 },
    });
    const codes = computeFlags(m, computeValue(m), bench).map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["ROI_TOO_HIGH", "EXCEEDS_SPEND", "HEADCOUNT_IMPLIED"]));
  });

  it("LOW_CONFIDENCE_MAJORITY and NO_SOURCE", () => {
    const m = model({ steps: [step({ confidence: "LOW", missingSource: ["minutesPerOccurrence"] })] });
    const codes = computeFlags(m, computeValue(m), bench).map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["LOW_CONFIDENCE_MAJORITY", "NO_SOURCE"]));
  });
});

describe("monte carlo", () => {
  it("triangular stays in range and percentile works", () => {
    for (const u of [0, 0.1, 0.5, 0.9, 0.999]) {
      const x = triangular(u, 1, 2, 5);
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(5);
    }
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it("is repeatable and ordered", () => {
    const m = model();
    const a = monteCarlo(m, [{ pattern: "DRAFTING", lowPct: 30, highPct: 60 }], 500, 7);
    const b = monteCarlo(m, [{ pattern: "DRAFTING", lowPct: 30, highPct: 60 }], 500, 7);
    expect(a).toEqual(b);
    expect(a.total.p10).toBeLessThanOrEqual(a.total.p50);
    expect(a.total.p50).toBeLessThanOrEqual(a.total.p90);
  });
});
