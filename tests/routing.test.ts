import { describe, expect, it } from "vitest";
import { routeByRules } from "@/lib/routing/rules";

const none = { capabilityMatches: [], assetMatches: [] };

describe("routing rules", () => {
  it("R1 when an embedded capability matches", () => {
    const r = routeByRules({ text: "Help managers write better review comments", capabilityMatches: [{ name: "SuccessFactors – AI writing assist", score: 0.4, detail: "NOW" }], assetMatches: [] });
    expect(r.route).toBe("R1_EMBEDDED");
  });
  it("R2 when an asset matches and little new AI is needed", () => {
    const r = routeByRules({ text: "Search our market research articles", capabilityMatches: [], assetMatches: [{ name: "Knowledge Assistant", score: 0.3, detail: "PLATFORM · LIVE" }] });
    expect(r.route).toBe("R2_EXTEND");
  });
  it("R3 when the process lives in Excel and needs a records app", () => {
    expect(routeByRules({ text: "Quality deviation log maintained in Excel across sites", ...none }).route).toBe("R3_APP");
  });
  it("R4 when the user only needs data together", () => {
    expect(routeByRules({ text: "See CRM effort and sales data together", ...none }).route).toBe("R4_DATA");
  });
  it("R5 otherwise", () => {
    const r = routeByRules({ text: "Alert sales managers when field effort falls and predict distributor order drops", ...none });
    expect(r.route).toBe("R5_CUSTOM_AI");
    expect(r.confidence).toBe("HIGH");
  });
  it("R5 when asset is related but strong AI need and weak match", () => {
    const r = routeByRules({ text: "Check SOP drafts and find gaps against the global SOP and summarize impact", capabilityMatches: [], assetMatches: [{ name: "Knowledge Assistant", score: 0.26, detail: "PLATFORM" }] });
    expect(r.route).toBe("R5_CUSTOM_AI");
  });
});
