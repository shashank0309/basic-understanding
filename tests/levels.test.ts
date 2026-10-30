import { describe, expect, it } from "vitest";
import { addWorkingDays, determineLevel, financeRequired } from "@/lib/approval/levels";

const base = { route: "R5_CUSTOM_AI", tco: 40_00_000, gxp: false, personalData: false, externalUsers: false, highRiskFlags: [] as string[] };

describe("approval levels", () => {
  it("L1 for reuse route or small TCO", () => {
    expect(determineLevel({ ...base, route: "R2_EXTEND" }).level).toBe("L1");
    expect(determineLevel({ ...base, tco: 10_00_000 }).level).toBe("L1");
  });
  it("L2 between thresholds", () => {
    expect(determineLevel(base).level).toBe("L2");
  });
  it("small case with high-risk flags goes to L2", () => {
    expect(determineLevel({ ...base, tco: 10_00_000, highRiskFlags: ["ROI_TOO_HIGH"] }).level).toBe("L2");
  });
  it("L3 for large TCO or high risk", () => {
    expect(determineLevel({ ...base, tco: 2_00_00_000 }).level).toBe("L3");
    expect(determineLevel({ ...base, tco: 5_00_000, gxp: true }).level).toBe("L3");
    expect(determineLevel({ ...base, personalData: true }).level).toBe("L3");
    expect(determineLevel({ ...base, externalUsers: true }).level).toBe("L3");
  });
  it("finance step above benefit threshold", () => {
    expect(financeRequired(60_00_000)).toBe(true);
    expect(financeRequired(40_00_000)).toBe(false);
  });
  it("adds working days", () => {
    const fri = new Date("2026-10-30T10:00:00");
    expect(addWorkingDays(fri, 1).getDay()).toBe(1);
    expect(addWorkingDays(fri, 3).getDate()).toBe(4);
  });
});
