// Ordered routing questions (section 3, step 2b). Pure function, unit-tested.
export type Route = "R1_EMBEDDED" | "R2_EXTEND" | "R3_APP" | "R4_DATA" | "R5_CUSTOM_AI";

export const ROUTE_LABELS: Record<Route, string> = {
  R1_EMBEDDED: "R1 Embedded AI",
  R2_EXTEND: "R2 Extend platform",
  R3_APP: "R3 Build application",
  R4_DATA: "R4 Data or report",
  R5_CUSTOM_AI: "R5 Custom AI",
};

export const ROUTE_TEAMS: Record<Route, string> = {
  R1_EMBEDDED: "Function IT business partner (ITBP)",
  R2_EXTEND: "Platform team – fast route pilot",
  R3_APP: "Application team",
  R4_DATA: "Data team",
  R5_CUSTOM_AI: "Factory pod – full assessment",
};

export interface Match {
  name: string;
  score: number;
  detail: string; // e.g. "NOW" / "ROADMAP Q2" / "AGENT · LIVE"
  available?: boolean;
}

export interface RoutingContext {
  text: string;
  capabilityMatches: Match[]; // software capabilities + embedded features
  assetMatches: Match[]; // reusable platforms / agents / skills
}

export interface Answer {
  answer: boolean;
  reason: string;
  evidence: string[];
}

export interface RouteProposal {
  route: Route;
  answers: { q1: Answer; q2: Answer; q3: Answer; q4: Answer };
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export const RULE_THRESHOLDS = { capability: 0.22, asset: 0.24, assetStrong: 0.34 };

const AI_NEED = /\b(check|checks|checking|draft|drafts|write|writing|summar\w*|predict\w*|forecast\w*|alert\w*|classif\w*|compar\w*|gaps?|simplif\w*|extract\w*|recommend\w*|harmoni[sz]\w*|impact|detect\w*|anomal\w*)\b/gi;
const DIGITIZE = /\b(excel|paper|e-?mail|emails|spreadsheet|manual(ly)?|whatsapp)\b/i;
const RECORD = /\b(log|logs|track\w*|maintain\w*|register|form|forms|approval|workflow|records?)\b/i;
const DATA = /\b(report|reports|dashboard|together|visibility|trend|trends|kpi|combine|view|see)\b/i;

export function aiNeedScore(text: string): number {
  return (text.match(AI_NEED) ?? []).length;
}

export function routeByRules(ctx: RoutingContext): RouteProposal {
  const t = ctx.text;
  const aiNeed = aiNeedScore(t);
  const cap = ctx.capabilityMatches.filter((m) => m.score >= RULE_THRESHOLDS.capability).sort((a, b) => b.score - a.score);
  const assets = ctx.assetMatches.filter((m) => m.score >= RULE_THRESHOLDS.asset).sort((a, b) => b.score - a.score);
  const strongAsset = assets.find((a) => a.score >= RULE_THRESHOLDS.assetStrong);

  const q1: Answer = cap.length
    ? { answer: true, reason: `Current enterprise software has a matching AI feature: ${cap[0].name} (${cap[0].detail}).`, evidence: cap.slice(0, 2).map((c) => `${c.name} – ${c.detail} – match ${(c.score * 100).toFixed(0)}%`) }
    : { answer: false, reason: "No AI feature in current software or its roadmap matches the problem.", evidence: [] };

  const q2Yes = !!assets.length && (aiNeed <= 1 || !!strongAsset);
  const q2: Answer = q2Yes
    ? { answer: true, reason: `A current asset can solve it with configuration or a small extension: ${(strongAsset ?? assets[0]).name}.`, evidence: assets.slice(0, 2).map((a) => `${a.name} – ${a.detail} – match ${(a.score * 100).toFixed(0)}%`) }
    : { answer: false, reason: assets.length ? `${assets[0].name} is related, but the problem needs new AI capability (${aiNeed} signals).` : "No current platform, agent or solution matches well.", evidence: assets.slice(0, 1).map((a) => `${a.name} – match ${(a.score * 100).toFixed(0)}%`) };

  const q3Yes = DIGITIZE.test(t) && RECORD.test(t) && aiNeed <= 1;
  const q3: Answer = q3Yes
    ? { answer: true, reason: "The process runs on paper, Excel or email. It must become digital first.", evidence: [t.match(DIGITIZE)?.[0] ?? "", t.match(RECORD)?.[0] ?? ""].filter(Boolean) }
    : { answer: false, reason: DIGITIZE.test(t) ? "Some manual tools are used, but the core need is not a records application." : "The process already uses digital systems.", evidence: [] };

  const q4Yes = DATA.test(t) && aiNeed === 0;
  const q4: Answer = q4Yes
    ? { answer: true, reason: "The user mainly needs data from systems or a report.", evidence: [t.match(DATA)?.[0] ?? ""] }
    : { answer: false, reason: "The user needs more than a report.", evidence: [] };

  let route: Route = "R5_CUSTOM_AI";
  if (q1.answer) route = "R1_EMBEDDED";
  else if (q2.answer) route = "R2_EXTEND";
  else if (q3.answer) route = "R3_APP";
  else if (q4.answer) route = "R4_DATA";

  const yesCount = [q1, q2, q3, q4].filter((q) => q.answer).length;
  const confidence = yesCount > 1 ? "MEDIUM" : route === "R5_CUSTOM_AI" && aiNeed >= 2 ? "HIGH" : yesCount === 1 ? "HIGH" : "MEDIUM";
  return { route, answers: { q1, q2, q3, q4 }, confidence };
}
