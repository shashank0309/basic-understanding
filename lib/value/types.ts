export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface StepInput {
  id?: string;
  name: string;
  minutesPerOccurrence: number;
  occurrencesPerMonth: number; // per person
  peopleCount: number;
  costPerHour: number;
  errorRatePct: number;
  costPerError: number;
  aiOpportunity: string; // NONE | ASSIST | AUTOMATE
  aiPattern?: string | null;
  aiMinutes: number;
  aiErrorRatePct: number;
  confidence: Confidence; // lowest confidence of the step inputs
  missingSource: string[]; // field names without a source note
}

export interface LeverInputValue {
  leverKey: string;
  key: string;
  label?: string;
  value: number;
  low?: number | null;
  high?: number | null;
  confidence: Confidence;
  sourceNote: string;
}

export interface Factors {
  adoption: number[]; // by year: [y1, y2, y3+]
  realizationFactor: number;
  horizonYears: number;
  discountRate: number;
  hoursPerFte: number;
}

export interface Costs {
  buildCost: number;
  annualRunCost: number;
}

export interface BenchmarkRange {
  pattern: string;
  lowPct: number;
  highPct: number;
}

export interface ValueModel {
  steps: StepInput[];
  levers: LeverInputValue[];
  factors: Factors;
  costs: Costs;
}

export interface LeverResult {
  key: string;
  annualFull: number; // steady state before adoption ramp
  byYear: number[];
  total: number;
  confidence: Confidence;
  adoptionApplies: boolean;
}

export interface StepResult {
  name: string;
  baselineHoursPerYear: number;
  aiHoursPerYear: number;
  baselineErrorsPerYear: number;
  aiErrorsPerYear: number;
  baselineMinutes: number;
  aiMinutes: number;
  reductionPct: number;
  timeValueFull: number;
  errorValueFull: number;
}

export interface ValueResult {
  levers: LeverResult[];
  steps: StepResult[];
  byYear: number[];
  totalBenefit: number;
  annualSteadyState: number;
  tco: number;
  netValue: number;
  roi: number;
  paybackMonth: number | null;
  npv: number;
  hoursSavedPerYear: number;
  fteSaved: number;
  baselineCycleMinutes: number;
  aiCycleMinutes: number;
  peopleSpendAnnual: number | null;
}

export interface Flag {
  code: "OUT_OF_RANGE" | "ROI_TOO_HIGH" | "EXCEEDS_SPEND" | "LOW_CONFIDENCE_MAJORITY" | "NO_SOURCE" | "HEADCOUNT_IMPLIED";
  message: string;
  target?: string;
  highRisk: boolean;
}
