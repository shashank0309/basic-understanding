// Step 6: business case + Council slides. Numbers come only from the value engine.
import { db } from "../db";
import { parse, str } from "../json";
import { runTask } from "../llm/task";
import { CaseSchema, SlidesSchema, type CaseOut, type Slides, type Summary } from "../ai/schemas";
import { inr, num } from "../format";
import { LEVER_NAMES } from "../value/levers";
import { FLAG_LABELS } from "../value/flags";
import { determineLevel, LEVEL_INFO } from "../approval/levels";
import { getThresholds } from "../settings";
import { ROUTE_LABELS, type Route } from "../routing/rules";
import { governanceCheck } from "./design";
import { loadValue } from "./value";

export function recommend(net: number, highRisk: number, lowConfidence: boolean): string {
  if (net <= 0) return "Do not approve now. The value does not cover the cost. Rework the scope or reuse more.";
  if (highRisk > 0) return "Approve as POC. Prove the value in a small pilot first, because some numbers are flagged.";
  if (lowConfidence) return "Approve as POC. Most value inputs have low confidence; a pilot will confirm them.";
  return "Approve. The value is clear and the risks are under control.";
}

export async function buildCaseData(requestId: string) {
  const r = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { function: true, reuse: { include: { asset: true } }, steps: { orderBy: { order: "asc" } } } });
  const v = await loadValue(requestId, { monteCarlo: true });
  const t = await getThresholds();
  const highRisk = v.flags.filter((f) => f.highRisk).map((f) => f.code);
  const level = determineLevel({ route: r.route, tco: v.result.tco, gxp: r.gxp, personalData: r.personalData, externalUsers: r.externalUsers, highRiskFlags: highRisk }, t);
  const reviews = governanceCheck(r).filter((x) => x.required);
  const sym = v.settings.currencySymbol;
  const calculated = {
    horizonYears: v.model.factors.horizonYears,
    totalBenefit: inr(v.result.totalBenefit, sym),
    benefitRangeP10P90: v.mc ? `${inr(v.mc.total.p10, sym)} – ${inr(v.mc.total.p90, sym)}` : "n/a",
    annualSteadyState: inr(v.result.annualSteadyState, sym),
    tco: inr(v.result.tco, sym),
    buildCost: inr(v.costs.buildCost, sym),
    annualRunCost: inr(v.costs.annualRunCost, sym),
    netValue: inr(v.result.netValue, sym),
    roi: `${v.result.roi.toFixed(1)}×`,
    paybackMonths: v.result.paybackMonth === null ? "not within horizon" : `${v.result.paybackMonth} months`,
    hoursSavedPerYear: num(v.result.hoursSavedPerYear),
    fteEquivalent: v.result.fteSaved.toFixed(1),
    levers: v.result.levers.map((l) => ({ lever: LEVER_NAMES[l.key], annualAtFullAdoption: inr(l.annualFull, sym), total: inr(l.total, sym), confidence: l.confidence })),
    approvalLevel: level.level,
  };
  const lowConf = v.flags.some((f) => f.code === "LOW_CONFIDENCE_MAJORITY");
  return { r, v, level, reviews, calculated, recommendation: recommend(v.result.netValue, highRisk.length, lowConf), sym };
}

function heuristicSections(d: Awaited<ReturnType<typeof buildCaseData>>): CaseOut {
  const { r, v, calculated: c, reviews } = d;
  const s = parse<Partial<Summary>>(r.summary, {});
  const aiSteps = r.steps.filter((x) => x.aiOpportunity !== "NONE");
  const sel = r.reuse.filter((x) => x.selected);
  return {
    sections: {
      problem: `${r.problemStatement}${s.painPoints?.length ? `\n\nMain pain points: ${s.painPoints.join("; ")}.` : ""}${s.expectedResult ? `\n\nExpected result: ${s.expectedResult}` : ""}`,
      currentProcess: `The process has ${r.steps.length} steps. One cycle takes about ${num(v.result.baselineCycleMinutes)} minutes of work.`,
      proposedSolution: `AI helps in ${aiSteps.length} of ${r.steps.length} steps: ${aiSteps.map((x) => `${x.name.toLowerCase()} (${(x.aiPattern ?? "").toLowerCase()})`).join("; ")}. People keep all decisions. ${r.architecture}`,
      reuse: sel.length ? `We reuse ${sel.map((x) => `${x.asset.name} (${x.mode === "AS_IS" ? "as-is" : "as a skill"})`).join(" and ")}. This lowers build cost and time.` : "No current asset fits. We build new components.",
      value: `Total benefit over ${c.horizonYears} years: ${c.totalBenefit} (P10–P90 range: ${c.benefitRangeP10P90}). People get back ${c.hoursSavedPerYear} hours per year (${c.fteEquivalent} FTE). We apply an adoption ramp and a realization factor, so the value is realistic.`,
      costs: `Build cost ${c.buildCost}. Run cost ${c.annualRunCost} per year. ${c.horizonYears}-year TCO: ${c.tco}. Net value: ${c.netValue}. ROI: ${c.roi}. Payback: ${c.paybackMonths}.`,
      risks: v.flags.length ? v.flags.map((f) => `- **${FLAG_LABELS[f.code]}**: ${f.message}`).join("\n") + (r.flagJustification ? `\n\nJustification from the pod: ${r.flagJustification}` : "") : "No value quality flags. Main risk: user adoption. We track value at 3 and 6 months after go-live.",
      governance: reviews.map((x) => `- ${x.name}: ${x.reason}`).join("\n"),
      recommendation: d.recommendation,
    },
  };
}

export function toMarkdown(d: Awaited<ReturnType<typeof buildCaseData>>, sec: CaseOut["sections"], version: number): string {
  const { r, v, calculated: c, level, sym } = d;
  const rows = r.steps
    .map((s, i) => `| ${s.order} | ${s.name} | ${s.actor} | ${num(s.minutesPerOccurrence)} → ${num(v.result.steps[i]?.aiMinutes ?? s.minutesPerOccurrence, 1)} min | ${s.aiOpportunity === "NONE" ? "–" : `${s.aiOpportunity} · ${s.aiPattern}`} |`)
    .join("\n");
  const levers = v.result.levers.map((l) => `| ${LEVER_NAMES[l.key]} | ${inr(l.annualFull, sym)} | ${inr(l.total, sym)} | ${l.confidence} |`).join("\n");
  return `# Business case – ${r.code} ${r.title}

Version ${version} · ${r.function.name} · Route: ${r.route ? ROUTE_LABELS[r.route as Route] : "–"} · Approval level: **${level.level}**

> AI draft. The pod analyst reviews it. All numbers come from the value engine.

## Recommendation
${sec.recommendation}

## Key numbers
| Measure | Value |
|---|---|
| Total benefit (${c.horizonYears} years) | ${c.totalBenefit} |
| Benefit range (P10 – P90) | ${c.benefitRangeP10P90} |
| ${c.horizonYears}-year TCO | ${c.tco} |
| Net value | ${c.netValue} |
| ROI | ${c.roi} |
| Payback | ${c.paybackMonths} |
| Hours saved per year | ${c.hoursSavedPerYear} (${c.fteEquivalent} FTE) |

## 1. Problem
${sec.problem}

## 2. Current process
${sec.currentProcess}

| # | Step | Actor | Time (now → with AI) | AI |
|---|---|---|---|---|
${rows}

## 3. Proposed solution
${sec.proposedSolution}

## 4. Reuse
${sec.reuse}

## 5. Value
${sec.value}

| Lever | Annual (full adoption) | Total | Confidence |
|---|---|---|---|
${levers}

## 6. Costs
${sec.costs}

## 7. Risks and flags
${sec.risks}

## 8. Governance reviews required
${sec.governance}

## 9. Approval
Level ${level.level}: ${LEVEL_INFO[level.level].approvers}. ${LEVEL_INFO[level.level].mode}.
Reasons: ${level.reasons.join(" ")}
`;
}

function heuristicSlides(d: Awaited<ReturnType<typeof buildCaseData>>, sec: CaseOut["sections"]): Slides {
  const c = d.calculated;
  const first = (s: string, n = 110) => (s.split(/(?<=\.)\s/)[0] ?? s).slice(0, n);
  return [
    { title: `${d.r.code}: ${d.r.title}`, bullets: [first(sec.problem), first(sec.currentProcess), first(sec.proposedSolution), first(sec.reuse)], keyNumbers: [{ label: "Function", value: d.r.function.name }, { label: "Route", value: d.r.route ? ROUTE_LABELS[d.r.route as Route] : "–" }] },
    { title: "Value and cost", bullets: [`Total benefit over ${c.horizonYears} years: ${c.totalBenefit}`, `Range P10–P90: ${c.benefitRangeP10P90}`, `TCO: ${c.tco} (build ${c.buildCost}, run ${c.annualRunCost}/yr)`, `Payback: ${c.paybackMonths}`], keyNumbers: [{ label: "Net value", value: c.netValue }, { label: "ROI", value: c.roi }, { label: "Hours saved / yr", value: c.hoursSavedPerYear }] },
    { title: "Risks and decision", bullets: [...d.v.flags.slice(0, 3).map((f) => `${FLAG_LABELS[f.code]}: ${f.message.slice(0, 80)}`), ...d.reviews.slice(0, 2).map((x) => `Review: ${x.name}`), `Ask: ${first(sec.recommendation, 90)}`].slice(0, 5), keyNumbers: [{ label: "Level", value: d.level.level }] },
  ];
}

export async function generateBusinessCase(requestId: string) {
  const d = await buildCaseData(requestId);
  const res = await runTask(
    "business_case_writer",
    {
      request: { code: d.r.code, title: d.r.title, problem: d.r.problemStatement, summary: parse(d.r.summary, {}), steps: d.r.steps.map((s) => ({ name: s.name, ai: s.aiOpportunity, pattern: s.aiPattern })), reuse: d.r.reuse.filter((x) => x.selected).map((x) => x.asset.name), architecture: d.r.architecture, flagJustification: d.r.flagJustification },
      calculated: d.calculated,
      flags: d.v.flags.map((f) => `${f.code}: ${f.message}`),
      governance: d.reviews.map((x) => x.name),
    },
    CaseSchema,
    () => heuristicSections(d),
  );
  // The recommendation is rule-based so it always matches the numbers.
  const sections = { ...res.data.sections, recommendation: d.recommendation };
  const last = await db.businessCase.findFirst({ where: { requestId }, orderBy: { version: "desc" } });
  const version = (last?.version ?? 0) + 1;
  const content = toMarkdown(d, sections, version);
  const slidesRes = await runTask("slide_writer", { case: content }, SlidesSchema, () => ({ slides: heuristicSlides(d, sections) }));
  const slides: Slides = slidesRes.data.slides;
  return db.businessCase.create({
    data: {
      requestId, version, content, slides: str(slides), snapshot: str(d.calculated),
      netValue: d.v.result.netValue, paybackMonths: d.v.result.paybackMonth, roi: d.v.result.roi,
      recommendation: d.recommendation, generatedBy: res.by,
    },
  });
}
