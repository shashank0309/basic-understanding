// Step 5: governance pre-check and architecture draft.
import { db } from "../db";
import { parse } from "../json";
import { runTask } from "../llm/task";
import { ArchSchema } from "../ai/schemas";
import { PATTERN_LABELS } from "../constants";

export interface Review {
  name: string;
  required: boolean;
  reason: string;
}

export function governanceCheck(r: { gxp: boolean; personalData: boolean; externalUsers: boolean; dataResidency: string }): Review[] {
  return [
    { name: `Security checklist – ${r.personalData || r.externalUsers ? "enhanced" : "standard"}`, required: true, reason: r.personalData || r.externalUsers ? "Personal data or external users are in scope." : "Internal users and internal data only." },
    { name: "Computer system validation (CSV/CSA)", required: r.gxp, reason: r.gxp ? "The process is GxP-regulated." : "Not a GxP process." },
    { name: "Privacy impact assessment", required: r.personalData, reason: r.personalData ? "Patient or personal data is used." : "No personal data." },
    { name: "External access review", required: r.externalUsers, reason: r.externalUsers ? "External users will log in." : "Internal users only." },
    { name: `Data residency – ${r.dataResidency || "India"} region`, required: true, reason: "Data and model hosting must stay in the approved region. No training on client data." },
    { name: "Responsible AI review (human in the loop)", required: true, reason: "AI drafts; a person confirms every output." },
  ];
}

const safe = (s: string) => s.replace(/[[\]{}()"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

export function heuristicArchitecture(p: { title: string; actors: string[]; systems: string[]; reuse: { name: string; mode: string }[]; patterns: string[] }) {
  const lines = ["flowchart LR", `  U["${safe(p.actors.join(", ") || "Business users")}"] --> CH["Teams / Copilot chat"]`, `  CH --> OR["Orchestrator agent"]`];
  p.reuse.forEach((r, i) => lines.push(`  OR --> R${i}["${safe(r.name)} - ${r.mode === "AS_IS" ? "reuse" : "skill"}"]`));
  lines.push(`  OR --> LLM["LLM service - ${safe(p.patterns.map((x) => PATTERN_LABELS[x] ?? x).join(", ") || "AI")}"]`);
  p.systems.slice(0, 3).forEach((s, i) => lines.push(`  OR --> S${i}[("${safe(s)}")]`));
  lines.push(`  OR --> AU[("Audit log")]`, `  OR --> HR["Human review and sign-off"]`);
  const text = [
    `Users work in Teams or Copilot chat. An orchestrator agent runs the flow for "${p.title}".`,
    p.reuse.length ? `It reuses ${p.reuse.map((r) => r.name).join(" and ")}, so we build less.` : "No current asset fits, so we build the components new.",
    `The LLM service handles ${p.patterns.map((x) => (PATTERN_LABELS[x] ?? x).toLowerCase()).join(", ") || "the AI steps"}.`,
    p.systems.length ? `It reads data from ${p.systems.slice(0, 3).join(", ")}.` : "",
    "A person reviews and signs off every output. All actions go to the audit log.",
  ].filter(Boolean).join(" ");
  return { text, mermaid: lines.join("\n") };
}

export async function draftArchitecture(requestId: string) {
  const r = await db.request.findUniqueOrThrow({ where: { id: requestId }, include: { steps: { orderBy: { order: "asc" } }, reuse: { include: { asset: true } }, costItems: { include: { component: true } } } });
  const sel = r.reuse.filter((x) => x.selected);
  const systems = [...new Set(r.steps.flatMap((s) => s.system.split(/[,/]/).map((x) => x.trim())).filter((x) => x && !/email|paper|word|excel|teams/i.test(x)))];
  const actors = [...new Set(r.steps.map((s) => s.actor).filter(Boolean))].slice(0, 3);
  const patterns = [...new Set(r.steps.map((s) => s.aiPattern).filter(Boolean) as string[])];
  const fb = () => heuristicArchitecture({ title: r.title, actors, systems, reuse: sel.map((x) => ({ name: x.asset.name, mode: x.mode })), patterns });
  const res = await runTask(
    "architecture_draft",
    {
      summary: `${r.title}: ${r.problemStatement}`,
      steps: r.steps.filter((s) => s.aiOpportunity !== "NONE").map((s) => `${s.name} [${s.aiPattern}] system: ${s.system}`).join("\n"),
      reuse: sel.map((x) => `${x.asset.name} (${x.mode})`).join(", ") || "none",
      components: r.costItems.map((c) => c.component.name).join(", "),
    },
    ArchSchema,
    fb,
  );
  const mermaid = res.data.mermaid.trim().startsWith("flowchart") || res.data.mermaid.trim().startsWith("graph") ? res.data.mermaid : fb().mermaid;
  await db.request.update({ where: { id: requestId }, data: { architecture: res.data.text, mermaid } });
  return res;
}

export function summaryOf(r: { summary: string }) {
  return parse<Record<string, unknown>>(r.summary, {});
}
