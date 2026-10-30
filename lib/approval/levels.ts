// Approval level rules (section 7). Pure functions, unit-tested.
export interface ApprovalThresholds {
  l1MaxTco: number; // below this TCO → L1 (₹25 lakh)
  l3MinTco: number; // above this TCO → L3 (₹1 crore)
  financeMinBenefit: number; // total benefit above this → Finance step (₹50 lakh)
}

export const DEFAULT_THRESHOLDS: ApprovalThresholds = { l1MaxTco: 25_00_000, l3MinTco: 1_00_00_000, financeMinBenefit: 50_00_000 };

export interface LevelInput {
  route: string | null;
  tco: number;
  gxp: boolean;
  personalData: boolean;
  externalUsers: boolean;
  highRiskFlags: string[];
}

export type Level = "L1" | "L2" | "L3";

export function determineLevel(input: LevelInput, t: ApprovalThresholds = DEFAULT_THRESHOLDS): { level: Level; reasons: string[] } {
  const reasons: string[] = [];
  if (input.gxp) reasons.push("The process is GxP-regulated.");
  if (input.personalData) reasons.push("The solution uses patient or personal data.");
  if (input.externalUsers) reasons.push("External users will use the solution.");
  if (input.tco > t.l3MinTco) reasons.push(`TCO is more than the L3 threshold.`);
  if (reasons.length) return { level: "L3", reasons };

  const smallOrReuse = input.route === "R2_EXTEND" || input.tco < t.l1MaxTco;
  if (smallOrReuse && input.highRiskFlags.length === 0) {
    return { level: "L1", reasons: [input.route === "R2_EXTEND" ? "The request reuses a current platform (fast route)." : "TCO is below the L1 threshold."] };
  }
  if (smallOrReuse) return { level: "L2", reasons: [`High-risk flags present: ${input.highRiskFlags.join(", ")}.`] };
  return { level: "L2", reasons: ["TCO is between the L1 and L3 thresholds."] };
}

export function financeRequired(totalBenefit: number, t: ApprovalThresholds = DEFAULT_THRESHOLDS): boolean {
  return totalBenefit > t.financeMinBenefit;
}

/** Adds working days (Mon–Fri). */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export const LEVEL_INFO: Record<Level, { approvers: string; mode: string; dueDays: number | null }> = {
  L1: { approvers: "Head of Digital and AI", mode: "Online, due in 3 working days", dueDays: 3 },
  L2: { approvers: "AI Council members (online)", mode: "Due in 5 working days; no reply = approved", dueDays: 5 },
  L3: { approvers: "Full AI Council; chair decides", mode: "Next monthly Council meeting", dueDays: null },
};
