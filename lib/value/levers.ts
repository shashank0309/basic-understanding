// Default value levers. Admin can rename / disable them; formulas live in calc.ts.
export const LEVERS = [
  {
    key: "TIME_SAVED",
    name: "Time saved",
    formula: "Σ steps (baselineMin − withAiMin) / 60 × occurrencesPerMonth × 12 × peopleCount × costPerHour × adoptionRate × realizationFactor",
    description: "Hours that people get back. Time is money only when capacity or cost really changes, so we apply a realization factor.",
    adoption: true,
    inputs: [] as LeverField[],
  },
  {
    key: "ERRORS_AVOIDED",
    name: "Fewer errors / deviations",
    formula: "Σ steps occurrences/yr × (baselineErr% − withAiErr%) × costPerError × adoptionRate",
    description: "Cost of errors, rework and deviations that do not happen.",
    adoption: true,
    inputs: [] as LeverField[],
  },
  {
    key: "COMPLIANCE_RISK",
    name: "Audit / compliance risk avoided",
    formula: "auditObservationsAvoidedPerYear × costPerObservation × probabilityFactor",
    description: "Expected cost of audit observations that we avoid.",
    adoption: false,
    inputs: [
      { key: "auditObservationsAvoidedPerYear", label: "Audit observations avoided per year", unit: "count" },
      { key: "costPerObservation", label: "Cost per observation", unit: "INR" },
      { key: "probabilityFactor", label: "Probability factor", unit: "0–1" },
    ],
  },
  {
    key: "REVENUE_UPLIFT",
    name: "Revenue increase",
    formula: "additionalSales × marginPct × attributionFactor",
    description: "Extra margin from extra sales that we can link to the solution.",
    adoption: false,
    inputs: [
      { key: "additionalSales", label: "Additional sales per year", unit: "INR" },
      { key: "marginPct", label: "Margin", unit: "%" },
      { key: "attributionFactor", label: "Attribution factor", unit: "0–1" },
    ],
  },
  {
    key: "COST_AVOIDED",
    name: "Cost avoided",
    formula: "licences / external services / materials not purchased per year",
    description: "Money we do not spend.",
    adoption: false,
    inputs: [{ key: "annualCostAvoided", label: "Cost avoided per year", unit: "INR" }],
  },
  {
    key: "CYCLE_TIME",
    name: "Faster cycle time",
    formula: "daysReduced × valuePerDay (Finance-defined)",
    description: "Working capital or time-to-market value of a shorter cycle.",
    adoption: false,
    inputs: [
      { key: "daysReduced", label: "Days reduced per year", unit: "days" },
      { key: "valuePerDay", label: "Value per day (Finance)", unit: "INR" },
    ],
  },
] as const;

export interface LeverField {
  key: string;
  label: string;
  unit: string;
}

export type LeverKey = (typeof LEVERS)[number]["key"];

export const LEVER_NAMES: Record<string, string> = Object.fromEntries(LEVERS.map((l) => [l.key, l.name]));

export const ADOPTION_LEVERS = new Set<string>(LEVERS.filter((l) => l.adoption).map((l) => l.key));

// Lever-independent factors are stored as ValueInput rows with leverKey = "GENERAL".
export const GENERAL_INPUTS = [
  { key: "adoptionY1", label: "Adoption year 1", unit: "0–1", default: 0.4 },
  { key: "adoptionY2", label: "Adoption year 2", unit: "0–1", default: 0.7 },
  { key: "adoptionY3", label: "Adoption year 3+", unit: "0–1", default: 0.85 },
  { key: "realizationFactor", label: "Realization factor (time saved)", unit: "0–1", default: 0.5 },
  { key: "processTeamFte", label: "FTE who do this process today", unit: "FTE", default: 0 },
];
