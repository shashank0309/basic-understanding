// Step 3: process mapping (RAG over process documents), AI opportunity and reuse options.
import { db } from "../db";
import { parse, str } from "../json";
import { runTask } from "../llm/task";
import { MapSchema, OpportunitySchema, ReuseSchema, type MapOut, type OpportunityOut, type ReuseOut, type Summary } from "../ai/schemas";
import { cosine, topK } from "../similarity/cosine";
import { embed } from "../similarity/embeddings";
import { requestText, sharedTerms } from "./triage";

export const DOC_MATCH_MIN = 0.28;

export async function retrieveChunks(text: string, k = 6) {
  const chunks = await db.docChunk.findMany({ include: { doc: true } });
  const q = embed(text);
  return topK(q, chunks.map((c) => ({ item: c, embedding: parse<number[]>(c.embedding, []) })), k);
}

const num = (s: string | undefined) => (s ? Number(s.replace(/,/g, "")) : 0);

/** Parses lines like "3. Reviewer checks format. (Actor: QA reviewer; System: Word; Time: 45 min; Frequency: 40 per month; People: 6; Pain: ...)" */
export function parseDocSteps(content: string): MapOut["steps"] {
  const out: MapOut["steps"] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (!m) continue;
    const body = m[2];
    const name = body.replace(/\(.*\)\s*$/, "").trim().replace(/\.$/, "");
    const meta = body.match(/\(([^)]*)\)\s*$/)?.[1] ?? "";
    const field = (k: string) => meta.match(new RegExp(`${k}:\\s*([^;]+)`, "i"))?.[1]?.trim();
    const time = field("Time");
    let minutes = num(time?.match(/[\d.]+/)?.[0]);
    if (time && /hour|hr/i.test(time)) minutes *= 60;
    if (time && /day/i.test(time)) minutes *= 480;
    out.push({
      name,
      actor: field("Actor") ?? "",
      system: field("System") ?? "",
      minutesPerOccurrence: minutes,
      occurrencesPerMonth: num(field("Frequency")?.match(/[\d.]+/)?.[0]),
      peopleCount: num(field("People")?.match(/[\d.]+/)?.[0]) || 1,
      painPoints: field("Pain") ? [field("Pain")!] : [],
      citation: "",
    });
  }
  return out;
}

function parseQty(s: string): number {
  return num(s.match(/[\d.]+/)?.[0]);
}

export async function heuristicMap(summary: Partial<Summary>, text: string): Promise<MapOut> {
  const hits = await retrieveChunks(text);
  const best = hits[0];
  if (best && best.score >= DOC_MATCH_MIN) {
    const doc = best.item.doc;
    const steps = parseDocSteps(doc.content);
    if (steps.length) {
      const chunks = await db.docChunk.findMany({ where: { docId: doc.id } });
      steps.forEach((s) => {
        const c = chunks.find((ch) => ch.text.includes(s.name.slice(0, 30)));
        s.citation = `${doc.id}#${c?.idx ?? 0}`;
      });
      const gaps = steps.filter((s) => !s.minutesPerOccurrence).map((s) => `No time given for "${s.name}". Please add it.`);
      return { steps, sourceDocs: [doc.id], gaps };
    }
  }
  // No document: build from the interview answers.
  const minutes = parseQty(summary.timePerOccurrence ?? "") * (/(hour|hr)/i.test(summary.timePerOccurrence ?? "") ? 60 : 1);
  const freq = parseQty(summary.frequency ?? "");
  const people = parseQty(summary.peopleInvolved ?? "") || 1;
  const names = summary.currentProcess?.length ? summary.currentProcess : ["Collect input", "Do the work", "Review", "Share result"];
  const per = names.length ? Math.round(minutes / names.length) : 0;
  return {
    steps: names.map((n) => ({ name: n, actor: summary.actors ?? "", system: (summary.tools ?? []).join(", "), minutesPerOccurrence: per, occurrencesPerMonth: freq, peopleCount: people, painPoints: [], citation: "" })),
    sourceDocs: [],
    gaps: ["No process document matched this request. The map comes from your answers. Please check each step and add times."],
  };
}

const PATTERN_RULES: [RegExp, string, "ASSIST" | "AUTOMATE"][] = [
  [/\b(approv\w*|sign\w*|decid\w*|meeting|train\w*|visit\w*|discuss\w*|call\w*|meet)\b/i, "NONE", "ASSIST"],
  [/\b(predict\w*|forecast\w*|estimat\w*|plan\w*)\b/i, "PREDICTION", "ASSIST"],
  [/\b(draft\w*|writ\w*|prepar\w*|compos\w*|rewrit\w*|simplif\w*)\b/i, "DRAFTING", "ASSIST"],
  [/\b(summar\w*|consolidat\w*|compil\w*)\b/i, "SUMMARIZATION", "ASSIST"],
  [/\b(search\w*|find\w*|look\w* up|locat\w*|answer\w*|query|queries|respond\w*)\b/i, "QA", "ASSIST"],
  [/\b(check\w*|review\w*|verif\w*|compar\w*|assess\w*|classif\w*|categori[sz]\w*)\b/i, "CLASSIFICATION", "ASSIST"],
  [/\b(enter\w*|copy\w*|extract\w*|transcrib\w*|collect\w*|download\w*|updat\w*|log\w*|record\w*|merg\w*)\b/i, "EXTRACTION", "AUTOMATE"],
  [/\b(route\w*|notif\w*|follow\w* up|chas\w*|remind\w*|track\w*|alert\w*|send\w*|monitor\w*)\b/i, "AGENTIC", "AUTOMATE"],
];

export function heuristicOpportunity(steps: { name: string; minutesPerOccurrence: number; errorRatePct: number }[], bench: { pattern: string; lowPct: number; highPct: number }[]): OpportunityOut {
  const b = new Map(bench.map((x) => [x.pattern, x]));
  return {
    steps: steps.map((s, index) => {
      const rule = PATTERN_RULES.find(([re]) => re.test(s.name));
      if (!rule || rule[1] === "NONE") {
        return { index, aiOpportunity: "NONE" as const, aiPattern: null, withAi: { minutesPerOccurrence: s.minutesPerOccurrence, errorRatePct: s.errorRatePct }, reason: rule ? "A person must decide or act here. Keep it human." : "No clear AI pattern for this step.", confidence: "MEDIUM" as const };
      }
      const pattern = rule[1] as OpportunityOut["steps"][number]["aiPattern"];
      const range = b.get(pattern!) ?? { lowPct: 30, highPct: 50 };
      const mid = (range.lowPct + range.highPct) / 2 / 100;
      return {
        index,
        aiOpportunity: rule[2],
        aiPattern: pattern,
        withAi: { minutesPerOccurrence: Math.round(s.minutesPerOccurrence * (1 - mid) * 10) / 10, errorRatePct: Math.round(s.errorRatePct * (pattern === "CLASSIFICATION" || pattern === "EXTRACTION" ? 0.4 : 0.7) * 10) / 10 },
        reason: `${pattern![0] + pattern!.slice(1).toLowerCase()} pattern. Benchmark: ${range.lowPct}–${range.highPct}% less time; we use the middle (${Math.round(mid * 100)}%).`,
        confidence: "MEDIUM" as const,
      };
    }),
  };
}

export function bandFor(actor: string): string {
  if (/head|director|vp|chair/i.test(actor)) return "Senior leader";
  if (/manager|lead/i.test(actor)) return "Manager";
  if (/rep|representative|field/i.test(actor)) return "Field representative";
  if (/scientist|medical|msl|physician|regulatory/i.test(actor)) return "Specialist";
  if (/operator|technician|shop/i.test(actor)) return "Operator";
  return "Executive / analyst";
}

export async function generateMap(requestId: string, userId: string) {
  const r = await db.request.findUniqueOrThrow({ where: { id: requestId } });
  const summary = parse<Partial<Summary>>(r.summary, {});
  const text = requestText(r);
  const hits = await retrieveChunks(text);
  const chunkText = hits.filter((h) => h.score > 0.08).map((h) => `${h.item.docId}#${h.item.idx} (${h.item.doc.title}): ${h.item.text}`).join("\n\n");
  const mapRes = await runTask("process_mapper", { summary: r.summary !== "{}" ? r.summary : text, chunks: chunkText || "(no matching document)" }, MapSchema, () => heuristicMap(summary, text));
  const rates = await db.roleCostRate.findMany();
  const bench = await db.benchmark.findMany();

  const baseSteps = mapRes.data.steps.map((s) => ({ ...s, errorRatePct: 3, costPerError: 5000, band: bandFor(s.actor) }));
  const oppRes = await runTask(
    "ai_opportunity",
    { steps: baseSteps.map((s, i) => ({ index: i, name: s.name, actor: s.actor, system: s.system, minutes: s.minutesPerOccurrence, errorRatePct: s.errorRatePct })), benchmarks: bench.map((b) => `${b.pattern}: ${b.lowPct}-${b.highPct}%`).join("\n") },
    OpportunitySchema,
    () => heuristicOpportunity(baseSteps, bench),
  );

  await db.processStep.deleteMany({ where: { requestId } });
  for (const [i, s] of baseSteps.entries()) {
    const o = oppRes.data.steps.find((x) => x.index === i);
    const rate = rates.find((x) => x.band === s.band)?.ratePerHour ?? 1000;
    const docSrc = s.citation ? { source: "SYSTEM_DATA", note: `From ${s.citation}` } : { source: "USER", note: "From intake answers" };
    const conf = s.citation ? "MEDIUM" : "LOW";
    await db.processStep.create({
      data: {
        requestId, order: i + 1, name: s.name, actor: s.actor, system: s.system,
        minutesPerOccurrence: s.minutesPerOccurrence, occurrencesPerMonth: s.occurrencesPerMonth, peopleCount: s.peopleCount,
        costPerHour: rate, errorRatePct: s.errorRatePct, costPerError: s.costPerError, painPoints: str(s.painPoints),
        aiOpportunity: o?.aiOpportunity ?? "NONE", aiPattern: o?.aiPattern ?? null, aiReason: o?.reason ?? "",
        aiMinutes: o?.withAi.minutesPerOccurrence ?? s.minutesPerOccurrence, aiErrorRatePct: o?.withAi.errorRatePct ?? s.errorRatePct,
        aiConfidence: o?.confidence ?? "MEDIUM", citation: s.citation,
        meta: str({
          minutesPerOccurrence: { ...docSrc, confidence: conf },
          occurrencesPerMonth: { ...docSrc, confidence: conf },
          peopleCount: { ...docSrc, confidence: conf },
          costPerHour: { source: "BENCHMARK", note: `Role cost rate: ${s.band} (demo value)`, confidence: "HIGH" },
          errorRatePct: { source: "BENCHMARK", note: "Default error rate – please confirm", confidence: "LOW" },
          costPerError: { source: "BENCHMARK", note: "Default rework cost – please confirm", confidence: "LOW" },
          aiMinutes: { source: "BENCHMARK", note: o?.reason ?? "", confidence: o?.confidence ?? "MEDIUM" },
          aiErrorRatePct: { source: "BENCHMARK", note: "Proposed by AI opportunity step", confidence: o?.confidence ?? "MEDIUM" },
        }),
      },
    });
  }
  const docs = await db.processDocument.findMany({ where: { id: { in: mapRes.data.sourceDocs } } });
  await db.request.update({
    where: { id: requestId },
    data: {
      mapSources: str(docs.map((d) => ({ id: d.id, title: d.title }))),
      mapGaps: str(mapRes.data.gaps),
      mapGeneratedBy: `${mapRes.by}${oppRes.by !== mapRes.by ? ` / ${oppRes.by}` : ""}`,
      mapAlignedAt: null,
      mapAlignedBy: null,
      status: ["SUBMITTED", "ROUTED"].includes(r.status) ? "IN_ASSESSMENT" : r.status,
    },
  });
  await generateReuse(requestId);
  return { map: mapRes, opp: oppRes };
}

export async function generateReuse(requestId: string) {
  const r = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { steps: true, function: true } });
  // Embedded features belong to route R1; reuse options come from platforms, agents, skills and data products.
  const assets = (await db.asset.findMany()).filter((a) => a.type !== "EMBEDDED_FEATURE");
  const fnWord = r.function.name.split(/[\s–-]+/)[0].toLowerCase();
  const text = `${requestText(r)}. ${r.steps.map((s) => `${s.name} ${s.aiPattern ?? ""}`).join(". ")}`;
  const vec = embed(text);
  const heuristic = (): ReuseOut => ({
    options: assets
      .map((a) => {
        const sameFunction = parse<string[]>(a.functionsUsing, []).some((f) => f.toLowerCase().includes(fnWord));
        return { a, score: cosine(vec, parse<number[]>(a.embedding, [])) * (sameFunction ? 1.25 : 1) };
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, 4)
      .map(({ a, score }) => {
        const fit = Math.min(1, Math.round(score * 2.2 * 100) / 100);
        const mode = fit >= 0.6 && a.maturity !== "PILOT" ? "AS_IS" : fit >= 0.35 ? "AS_SKILL" : "BUILD_NEW";
        const terms = sharedTerms(text, `${a.name} ${a.description} ${parse<string[]>(a.capabilities, []).join(" ")}`, 3);
        const reason =
          mode === "AS_IS" ? `Covers the need today (${terms.join(", ") || "same domain"}). Configure and use.`
          : mode === "AS_SKILL" ? `Reuse as a component for ${terms.join(", ") || "part of the flow"}. Build the rest.`
          : "Weak fit. Build new for this part.";
        return { assetId: a.id, mode, fitScore: fit, reason };
      }),
  });
  const res = await runTask(
    "reuse_matcher",
    { summary: requestText(r), steps: r.steps.map((s) => `${s.order}. ${s.name} [${s.aiPattern ?? "no AI"}]`).join("\n"), assets: assets.map((a) => `${a.id}: ${a.name} [${a.type}, ${a.maturity}] ${a.description}`).join("\n") },
    ReuseSchema,
    heuristic,
  );
  const valid = res.data.options.filter((o) => assets.some((a) => a.id === o.assetId));
  await db.reuseOption.deleteMany({ where: { requestId } });
  for (const [i, o] of valid.entries()) {
    const selected = o.mode !== "BUILD_NEW" && (i === 0 || o.fitScore >= 0.45);
    await db.reuseOption.create({ data: { requestId, assetId: o.assetId, mode: o.mode, fitScore: o.fitScore, reason: o.reason, selected } });
  }
  return res;
}
