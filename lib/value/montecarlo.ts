import { computeValue } from "./calc";
import type { BenchmarkRange, Confidence, ValueModel } from "./types";

/** Small seeded PRNG (mulberry32) so results are repeatable. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function triangular(u: number, low: number, mode: number, high: number): number {
  if (high <= low) return mode;
  const c = (mode - low) / (high - low);
  return u < c ? low + Math.sqrt(u * (high - low) * (mode - low)) : high - Math.sqrt((1 - u) * (high - low) * (high - mode));
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

const SPREAD: Record<Confidence, number> = { HIGH: 0.1, MEDIUM: 0.2, LOW: 0.35 };

export interface MonteCarloResult {
  runs: number;
  annual: { p10: number; p50: number; p90: number };
  total: { p10: number; p50: number; p90: number };
  net: { p10: number; p50: number; p90: number };
}

export function monteCarlo(model: ValueModel, benchmarks: BenchmarkRange[], runs = 1000, seed = 42): MonteCarloResult {
  const rand = rng(seed);
  const bench = new Map(benchmarks.map((b) => [b.pattern, b]));
  const annual: number[] = [];
  const total: number[] = [];
  const net: number[] = [];
  for (let i = 0; i < runs; i++) {
    const steps = model.steps.map((s) => {
      const sp = SPREAD[s.confidence];
      const base = triangular(rand(), s.minutesPerOccurrence * (1 - sp), s.minutesPerOccurrence, s.minutesPerOccurrence * (1 + sp));
      let ai = s.aiMinutes;
      if (s.aiOpportunity !== "NONE") {
        const b = s.aiPattern ? bench.get(s.aiPattern) : undefined;
        const mode = s.minutesPerOccurrence > 0 ? 1 - s.aiMinutes / s.minutesPerOccurrence : 0;
        const lo = b ? Math.min(b.lowPct / 100, mode) : mode * (1 - sp);
        const hi = b ? Math.max(b.highPct / 100, mode) : Math.min(1, mode * (1 + sp));
        ai = base * (1 - triangular(rand(), lo, mode, hi));
      } else {
        ai = base;
      }
      return { ...s, minutesPerOccurrence: base, aiMinutes: ai };
    });
    const levers = model.levers.map((l) => {
      const low = l.low ?? l.value * (1 - SPREAD[l.confidence]);
      const high = l.high ?? l.value * (1 + SPREAD[l.confidence]);
      return l.leverKey === "GENERAL" ? l : { ...l, value: triangular(rand(), Math.min(low, l.value), l.value, Math.max(high, l.value)) };
    });
    const r = computeValue({ ...model, steps, levers });
    annual.push(r.annualSteadyState);
    total.push(r.totalBenefit);
    net.push(r.netValue);
  }
  const s = (a: number[]) => {
    const sorted = [...a].sort((x, y) => x - y);
    return { p10: percentile(sorted, 10), p50: percentile(sorted, 50), p90: percentile(sorted, 90) };
  };
  return { runs, annual: s(annual), total: s(total), net: s(net) };
}
