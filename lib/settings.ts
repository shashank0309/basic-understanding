import { db } from "./db";
import { DEFAULT_THRESHOLDS, type ApprovalThresholds } from "./approval/levels";

export const DEFAULT_SETTINGS: Record<string, { value: string; label: string; group: string }> = {
  clientName: { value: process.env.CLIENT_NAME || "Acme Pharma", label: "Client name", group: "branding" },
  frameworkName: { value: process.env.AI_FRAMEWORK_NAME || "QualiAI", label: "Quality AI framework name", group: "branding" },
  brandColor: { value: "#0f766e", label: "Brand colour (hex)", group: "branding" },
  currencySymbol: { value: "₹", label: "Currency symbol", group: "branding" },
  l1MaxTco: { value: String(DEFAULT_THRESHOLDS.l1MaxTco), label: "L1: TCO below (INR)", group: "approval" },
  l3MinTco: { value: String(DEFAULT_THRESHOLDS.l3MinTco), label: "L3: TCO above (INR)", group: "approval" },
  financeMinBenefit: { value: String(DEFAULT_THRESHOLDS.financeMinBenefit), label: "Finance review: 5-year benefit above (INR)", group: "approval" },
  l2AutoApprove: { value: "true", label: "L2: no reply by deadline = approved", group: "approval" },
  roiMax: { value: "10", label: "Flag ROI above (×)", group: "value" },
  horizonYears: { value: "5", label: "Business case horizon (years: 3 or 5)", group: "value" },
  discountRate: { value: "0.10", label: "Discount rate for NPV", group: "value" },
  hoursPerFte: { value: "1800", label: "Working hours per FTE per year", group: "value" },
  defaultAdoptionY1: { value: "0.4", label: "Default adoption year 1", group: "value" },
  defaultAdoptionY2: { value: "0.7", label: "Default adoption year 2", group: "value" },
  defaultAdoptionY3: { value: "0.85", label: "Default adoption year 3+", group: "value" },
  defaultRealization: { value: "0.5", label: "Default realization factor (time saved)", group: "value" },
  monteCarloRuns: { value: "1000", label: "Monte Carlo runs", group: "value" },
};

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  const out: Record<string, string> = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k, v]) => [k, v.value]));
  rows.forEach((r) => (out[r.key] = r.value));
  return out;
}

export async function getThresholds(): Promise<ApprovalThresholds> {
  const s = await getSettings();
  return { l1MaxTco: Number(s.l1MaxTco), l3MinTco: Number(s.l3MinTco), financeMinBenefit: Number(s.financeMinBenefit) };
}
