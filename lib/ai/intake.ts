import { runTask } from "../llm/task";
import { IntakeTurnSchema, SummarySchema, type Summary } from "./schemas";

import { SLOTS, type Turn } from "./slots";
export { SLOTS, type Turn };

const TOOL_WORDS = ["Excel", "Email", "SAP", "Paper", "Word", "SharePoint", "CRM", "LIMS", "TrackWise", "PowerPoint", "WhatsApp", "Teams", "Veeva", "SuccessFactors"];

function answersBySlot(turns: Turn[]): Record<string, string> {
  const out: Record<string, string> = {};
  let slotIdx = -1;
  for (const t of turns) {
    if (t.role === "agent") {
      const i = SLOTS.findIndex((s) => s.q === t.text);
      if (i >= 0) slotIdx = i;
    } else if (slotIdx >= 0) {
      const k = SLOTS[slotIdx].key;
      out[k] = out[k] ? `${out[k]}\n${t.text}` : t.text;
    }
  }
  return out;
}

const firstSentence = (s: string) => (s.split(/(?<=[.!?])\s/)[0] ?? s).trim();

export function heuristicSummary(turns: Turn[]): Summary {
  const a = answersBySlot(turns);
  const fn = a.function ?? "";
  const [func, sub] = fn.split(/[–—:-]/).map((x) => x.trim());
  const all = Object.values(a).join(" \n ");
  const processSteps = (a.process ?? "")
    .split(/\n|;|→|->|\bthen\b/i)
    .map((s) => s.replace(/^\s*(\d+[.)]|-|\*)\s*/, "").trim())
    .filter((s) => s.length > 3);
  const tools = TOOL_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(all));
  const pain = (a.pain ?? "").split(/\n|;|\.\s/).map((s) => s.trim()).filter(Boolean);
  const expectIdx = pain.findIndex((p) => /expect|want|would like|goal|result|hope/i.test(p));
  const urg = /high|urgent|asap/i.test(a.urgency ?? "") ? "HIGH" : /low/i.test(a.urgency ?? "") ? "LOW" : "MEDIUM";
  const sponsor = (a.urgency ?? "").replace(/\b(low|medium|high|urgent)\b[,.;]?/gi, "").replace(/sponsor( is)?:?/i, "").trim();
  const effort = a.effort ?? "";
  const problem = (a.problem ?? "").trim();
  const title = firstSentence(problem).replace(/[.!?]$/, "").slice(0, 80) || "New business problem";
  return SummarySchema.parse({
    title,
    function: func ?? "",
    subFunction: sub ?? "",
    sites: (a.sites ?? "").split(/,|;|\band\b/).map((s) => s.trim()).filter(Boolean),
    problem,
    currentProcess: processSteps,
    tools,
    actors: effort.match(/\b[\w\s]*?(reviewers?|managers?|reps?|representatives|analysts?|officers?|executives?|team|staff|people|persons)\b/i)?.[0]?.trim() ?? "",
    frequency: effort.match(/\d+[\w\s]*?(per|a|each|\/)\s*(day|week|month|year)/i)?.[0] ?? effort.match(/\b(daily|weekly|monthly)\b/i)?.[0] ?? "",
    timePerOccurrence: effort.match(/\d+(\.\d+)?\s*(min|minutes|hours?|hrs?|days?)/i)?.[0] ?? "",
    peopleInvolved: effort.match(/\d+\s*(people|persons|reviewers?|managers?|reps?|representatives|analysts?|officers?|staff|members)/i)?.[0] ?? "",
    painPoints: expectIdx >= 0 ? pain.filter((_, i) => i !== expectIdx) : pain,
    expectedResult: expectIdx >= 0 ? pain[expectIdx] : "",
    dataSources: (a.data ?? "").split(/,|;|\band\b/).map((s) => s.trim()).filter(Boolean),
    urgency: urg,
    sponsor,
    gxp: /\b(gxp|gmp|sop|batch|deviation|capa|validation|quality|cleaning|lims|trackwise)\b/i.test(all),
    personalData: /\b(patient|personal data|employee data|hcp data|health data)\b/i.test(all),
    externalUsers: /\b(external users?|customers? portal|doctors? use|hcps? use|vendors? use|distributors? use)\b/i.test(all),
  });
}

export async function intakeTurn(turns: Turn[]): Promise<{ done: boolean; question?: string; summary?: Summary; by: string }> {
  const answered = new Set(Object.keys(answersBySlot(turns)));
  const nextSlot = SLOTS.find((s) => !answered.has(s.key));
  const fallback = () => (nextSlot ? { done: false, nextQuestion: nextSlot.q, slot: nextSlot.key } : { done: true, summary: heuristicSummary(turns) });
  // Keep the fixed questions (fast and predictable); use the LLM for the final summary.
  if (nextSlot) return { done: false, question: nextSlot.q, by: "Rule-based" };
  const transcript = turns.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join("\n");
  const r = await runTask("intake_agent", { missing: "none", asked: SLOTS.length, transcript: `${transcript}\n\nAll slots are filled. Return done=true with the summary.` }, IntakeTurnSchema, fallback);
  const summary = r.data.summary ?? heuristicSummary(turns);
  return { done: true, summary, by: r.by };
}
