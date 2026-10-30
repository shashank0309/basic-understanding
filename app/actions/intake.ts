"use server";
import { db } from "@/lib/db";
import { str } from "@/lib/json";
import { currentUser } from "@/lib/session";
import { intakeTurn } from "@/lib/ai/intake";
import type { Turn } from "@/lib/ai/slots";
import { SummarySchema, type Summary } from "@/lib/ai/schemas";
import { embed } from "@/lib/similarity/embeddings";
import { proposeRoute, refreshSimilarity, requestText } from "@/lib/services/triage";
import { audit } from "@/lib/audit/audit";
import { notifyRole } from "@/lib/notify/email";
import { getProvider } from "@/lib/llm/provider";

export async function intakeStep(turns: Turn[]) {
  return intakeTurn(turns);
}

export async function matchFunction(name: string): Promise<string | null> {
  const fns = await db.function.findMany();
  const n = name.toLowerCase();
  return fns.find((f) => n && (f.name.toLowerCase().includes(n) || n.includes(f.name.toLowerCase().split(" ")[0])))?.id ?? null;
}

async function nextCode() {
  const year = new Date().getFullYear();
  const last = await db.request.findFirst({ where: { code: { startsWith: `UC-${year}-` } }, orderBy: { code: "desc" } });
  const n = last ? Number(last.code.split("-")[2]) + 1 : 1;
  return `UC-${year}-${String(n).padStart(4, "0")}`;
}

export async function createRequest(input: { summary: Summary; functionId: string; turns?: Turn[]; draft?: boolean }): Promise<{ id: string }> {
  const user = await currentUser();
  const s = SummarySchema.parse(input.summary);
  const pod = await db.user.findFirst({ where: { roles: { contains: "POD_ANALYST" } } });
  const r = await db.request.create({
    data: {
      code: await nextCode(), title: s.title, problemStatement: s.problem, summary: str(s), functionId: input.functionId, sites: str(s.sites),
      requesterId: user.id, sponsor: s.sponsor, urgency: s.urgency, status: input.draft ? "DRAFT" : "SUBMITTED",
      gxp: s.gxp, personalData: s.personalData, externalUsers: s.externalUsers, ownerId: pod?.id ?? null,
    },
  });
  await db.request.update({ where: { id: r.id }, data: { embedding: str(embed(requestText(r))) } });
  if (input.turns?.length) {
    const sessionId = r.id;
    for (const t of input.turns) await db.intakeMessage.create({ data: { requestId: r.id, sessionId, role: t.role, text: t.text } });
  }
  await audit(user.id, input.draft ? "SAVE_DRAFT" : "SUBMIT", "Request", r.id, s.title);
  if (!input.draft) {
    // Step 2 runs automatically after submission.
    await refreshSimilarity(r.id, !!getProvider());
    await proposeRoute(r.id);
    await notifyRole("POD_ANALYST", { type: "TRIAGE", subject: `[New request] ${r.code} ${r.title}`, body: "A new business problem waits for triage. The system proposed a route and found similar items.", link: `/requests/${r.id}?tab=route` });
  }
  return { id: r.id };
}
