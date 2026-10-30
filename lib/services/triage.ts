// Step 2: similarity check + route proposal.
import { db } from "../db";
import { parse, str } from "../json";
import { runTask } from "../llm/task";
import { ReasonSchema, RouteSchema, type Summary } from "../ai/schemas";
import { cosine } from "../similarity/cosine";
import { embed, tokenize } from "../similarity/embeddings";
import { routeByRules, ROUTE_LABELS, type Match, type Route } from "../routing/rules";

export function requestText(r: { title: string; problemStatement: string; summary: string }): string {
  const s = parse<Partial<Summary>>(r.summary, {});
  return [r.title, r.problemStatement, s.problem, (s.currentProcess ?? []).join(". "), (s.painPoints ?? []).join(". "), s.expectedResult].filter(Boolean).join(". ");
}

export function sharedTerms(a: string, b: string, n = 4): string[] {
  const tb = new Set(tokenize(b));
  const seen = new Set<string>();
  return tokenize(a).filter((t) => tb.has(t) && t.length > 2 && !seen.has(t) && seen.add(t)).slice(0, n);
}

function ruleReason(a: string, b: string): string {
  const terms = sharedTerms(a, b);
  return terms.length ? `Both are about ${terms.join(", ")}.` : "Similar wording and goal.";
}

export async function refreshSimilarity(requestId: string, useLlmReasons = true) {
  const r = await db.request.findUniqueOrThrow({ where: { id: requestId } });
  const text = requestText(r);
  const emb = parse<number[]>(r.embedding, []);
  const vec = emb.length ? emb : embed(text);
  if (!emb.length) await db.request.update({ where: { id: r.id }, data: { embedding: str(vec) } });

  const others = await db.request.findMany({ where: { id: { not: r.id }, mergedIntoId: null }, select: { id: true, code: true, title: true, problemStatement: true, summary: true, embedding: true } });
  const assets = await db.asset.findMany();
  const cands = [
    ...others.map((o) => ({ type: "REQUEST" as const, id: o.id, label: `${o.code} ${o.title}`, text: requestText(o), score: cosine(vec, parse<number[]>(o.embedding, [])) })),
    ...assets.map((a) => ({ type: "ASSET" as const, id: a.id, label: a.name, text: `${a.name}. ${a.description}. ${parse<string[]>(a.capabilities, []).join(", ")}`, score: cosine(vec, parse<number[]>(a.embedding, [])) })),
  ]
    .filter((c) => c.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  await db.similarityLink.deleteMany({ where: { requestId } });
  for (const c of cands) {
    const reason = useLlmReasons
      ? (await runTask("similarity_reason", { a: text.slice(0, 600), b: c.text.slice(0, 600) }, ReasonSchema, () => ({ reason: ruleReason(text, c.text) }))).data.reason
      : ruleReason(text, c.text);
    await db.similarityLink.create({ data: { requestId, targetType: c.type, targetId: c.id, score: c.score, reason } });
  }
  return cands;
}

export async function routingContext(requestId: string) {
  const r = await db.request.findUniqueOrThrow({ where: { id: requestId } });
  const vec = parse<number[]>(r.embedding, []).length ? parse<number[]>(r.embedding, []) : embed(requestText(r));
  const caps = await db.softwareCapability.findMany();
  const assets = await db.asset.findMany();
  const capabilityMatches: Match[] = [
    ...caps.map((c) => ({ name: `${c.software} – ${c.feature}`, score: cosine(vec, parse<number[]>(c.embedding, [])), detail: c.available === "NOW" ? "available now" : `roadmap ${c.roadmapDate ?? ""}`.trim() })),
    ...assets.filter((a) => a.type === "EMBEDDED_FEATURE").map((a) => ({ name: a.name, score: cosine(vec, parse<number[]>(a.embedding, [])), detail: `embedded · ${a.maturity}` })),
  ].sort((a, b) => b.score - a.score);
  const assetMatches: Match[] = assets
    .filter((a) => a.type !== "EMBEDDED_FEATURE")
    .map((a) => ({ name: a.name, score: cosine(vec, parse<number[]>(a.embedding, [])), detail: `${a.type} · ${a.maturity}` }))
    .sort((a, b) => b.score - a.score);
  return { r, text: requestText(r), capabilityMatches, assetMatches, caps, assets };
}

export async function proposeRoute(requestId: string) {
  const ctx = await routingContext(requestId);
  const rules = routeByRules({ text: ctx.text, capabilityMatches: ctx.capabilityMatches, assetMatches: ctx.assetMatches });
  const similar = await db.similarityLink.findMany({ where: { requestId } });
  const res = await runTask(
    "route_proposal",
    {
      summary: ctx.r.summary !== "{}" ? ctx.r.summary : ctx.text,
      similar: similar.map((s) => `${s.targetType} ${s.targetId} (${(s.score * 100).toFixed(0)}%): ${s.reason}`).join("\n"),
      capabilities: ctx.caps.map((c) => `${c.software}: ${c.feature} (${c.available}${c.roadmapDate ? " " + c.roadmapDate : ""})`).join("\n"),
      assets: ctx.assets.map((a) => `${a.name} [${a.type}, ${a.maturity}]: ${a.description}`).join("\n"),
      rules: `${rules.route} (${rules.confidence})`,
    },
    RouteSchema,
    () => rules,
  );
  const p = res.data;
  const first = (["q1", "q2", "q3", "q4"] as const).find((q) => p.answers[q].answer);
  const reason = first ? p.answers[first].reason : "None of Q1–Q4 is yes. The problem needs a custom AI solution and a full assessment.";
  await db.request.update({
    where: { id: requestId },
    data: { proposedRoute: p.route, routeAnswers: str({ ...p.answers, rules }), routeReason: reason, routeConfidence: p.confidence, routeSource: res.by },
  });
  return { proposal: p, rules, by: res.by, label: ROUTE_LABELS[p.route as Route] };
}
