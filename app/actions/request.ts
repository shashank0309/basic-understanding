"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parse, str } from "@/lib/json";
import { currentUser, requireRole } from "@/lib/session";
import { audit, logEdit } from "@/lib/audit/audit";
import { sendEmail } from "@/lib/notify/email";
import { getProvider } from "@/lib/llm/provider";
import { ROUTE_LABELS, ROUTE_TEAMS, type Route } from "@/lib/routing/rules";
import { proposeRoute, refreshSimilarity } from "@/lib/services/triage";
import { generateMap, generateReuse } from "@/lib/services/mapping";
import { ensureGeneralInputs, loadValue, STEP_VALUE_FIELDS, type FieldMeta } from "@/lib/services/value";
import { draftArchitecture } from "@/lib/services/design";
import { generateBusinessCase } from "@/lib/services/businessCase";
import { decide, processDeadlines, startApproval } from "@/lib/services/workflow";
import { b, f, n } from "./util";

function done(id: string) {
  revalidatePath(`/requests/${id}`);
  revalidatePath("/", "layout");
}

// ── Step 2: sort and route
export async function rerunTriage(fd: FormData) {
  await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  await refreshSimilarity(id, !!getProvider());
  await proposeRoute(id);
  done(id);
}

export async function confirmRoute(fd: FormData) {
  const u = await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  const route = f(fd, "route") as Route;
  const reason = f(fd, "reason");
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  const exits = ["R1_EMBEDDED", "R3_APP", "R4_DATA"].includes(route);
  await db.request.update({
    where: { id },
    data: {
      route, routeReason: reason || r.routeReason, exitTeam: route === "R5_CUSTOM_AI" ? "" : ROUTE_TEAMS[route],
      status: exits ? "CLOSED_EXITED" : "ROUTED", ownerId: r.ownerId ?? u.id,
      ...(route === "R1_EMBEDDED" ? { ownerId: (await db.user.findFirst({ where: { roles: { contains: "ITBP" } } }))?.id ?? r.ownerId } : {}),
    },
  });
  await logEdit({ entity: "Request", entityId: id, requestId: id, field: "route", oldValue: r.route ?? r.proposedRoute ?? "", newValue: route, userId: u.id, reason });
  await audit(u.id, "CONFIRM_ROUTE", "Request", id, `${ROUTE_LABELS[route]}${r.proposedRoute && r.proposedRoute !== route ? ` (proposed ${r.proposedRoute})` : ""}`);
  await sendEmail({ userId: r.requesterId, type: "ROUTED", subject: `[Routed] ${r.code} ${r.title}`, body: `Your request goes to: ${ROUTE_TEAMS[route]}. ${reason || r.routeReason}`, link: `/requests/${id}` });
  if (route === "R1_EMBEDDED") {
    const itbp = await db.user.findFirst({ where: { roles: { contains: "ITBP" } } });
    if (itbp) await sendEmail({ userId: itbp.id, type: "ROUTED", subject: `[R1 Embedded AI] ${r.code} ${r.title}`, body: "Please confirm if current software or its roadmap covers this request.", link: `/requests/${id}` });
  }
  if (route === "R2_EXTEND" && r.fastRoute === "{}") {
    const d = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await db.request.update({ where: { id }, data: { fastRoute: str({ pilotPlan: "Configure the asset for this team and run a 1–2 week pilot.", owner: u.name, date: d }) } });
  }
  done(id);
}

export async function saveFastRoute(fd: FormData) {
  const u = await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  await db.request.update({ where: { id }, data: { fastRoute: str({ pilotPlan: f(fd, "pilotPlan"), owner: f(fd, "owner"), date: f(fd, "date") }) } });
  await audit(u.id, "UPDATE_FAST_ROUTE", "Request", id);
  done(id);
}

export async function mergeInto(fd: FormData) {
  const u = await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  const target = f(fd, "target");
  const t = await db.request.findUniqueOrThrow({ where: { id: target } });
  const r = await db.request.update({ where: { id }, data: { mergedIntoId: target, status: "CLOSED_EXITED", exitTeam: `Merged into ${t.code}`, clusterId: t.clusterId } });
  await audit(u.id, "MERGE", "Request", id, `Merged into ${t.code}`);
  await sendEmail({ userId: r.requesterId, type: "MERGED", subject: `[Merged] ${r.code} → ${t.code}`, body: `Your request is merged into ${t.code} "${t.title}". You can follow progress there.`, link: `/requests/${target}` });
  done(id);
}

export async function linkRelated(fd: FormData) {
  const u = await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  const target = f(fd, "target");
  for (const [a, c] of [[id, target], [target, id]]) {
    const r = await db.request.findUniqueOrThrow({ where: { id: a } });
    const rel = new Set(parse<string[]>(r.relatedIds, []));
    rel.add(c);
    await db.request.update({ where: { id: a }, data: { relatedIds: str([...rel]) } });
  }
  await audit(u.id, "LINK_RELATED", "Request", id, target);
  done(id);
}

export async function createCluster(fd: FormData) {
  const u = await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  const ids = [id, ...fd.getAll("members").map(String)];
  const c = await db.cluster.create({ data: { name: f(fd, "name") || "New cluster", description: f(fd, "description") } });
  await db.request.updateMany({ where: { id: { in: ids } }, data: { clusterId: c.id } });
  const reqs = await db.request.findMany({ where: { id: { in: ids } } });
  for (const r of reqs) {
    await audit(u.id, "ADD_TO_CLUSTER", "Request", r.id, c.name);
    if (r.id !== id) await sendEmail({ userId: r.requesterId, type: "CLUSTER", subject: `[Cluster] ${r.code} joins "${c.name}"`, body: "Your request is grouped with similar requests. One solution will address all of them.", link: `/requests/${r.id}` });
  }
  done(id);
}

export async function joinCluster(fd: FormData) {
  const u = await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  await db.request.update({ where: { id }, data: { clusterId: f(fd, "clusterId") || null } });
  await audit(u.id, "JOIN_CLUSTER", "Request", id, f(fd, "clusterId"));
  done(id);
}

// ── Step 3: map and reuse
export async function runMapping(fd: FormData) {
  const u = await requireRole("POD_ANALYST", "REQUESTER");
  const id = f(fd, "id");
  await generateMap(id, u.id);
  await ensureGeneralInputs(id);
  await audit(u.id, "GENERATE_MAP", "Request", id);
  done(id);
}

const STEP_TEXT = ["name", "actor", "system", "aiOpportunity", "aiPattern", "aiReason"] as const;

export async function updateStep(fd: FormData) {
  const u = await currentUser();
  const stepId = f(fd, "stepId");
  const s = await db.processStep.findUniqueOrThrow({ where: { id: stepId } });
  const reason = f(fd, "reason");
  const data: Record<string, unknown> = {};
  const meta = parse<Record<string, FieldMeta>>(s.meta, {});
  for (const k of STEP_TEXT) if (fd.has(k)) data[k] = k === "aiPattern" ? f(fd, k) || null : f(fd, k);
  for (const k of STEP_VALUE_FIELDS) {
    if (!fd.has(k)) continue;
    const v = n(fd, k);
    if (v !== (s as unknown as Record<string, number>)[k]) {
      data[k] = v;
      meta[k] = { source: f(fd, `${k}_source`) || "USER", note: f(fd, `${k}_note`) || reason || `Edited by ${u.name}`, confidence: (f(fd, `${k}_conf`) || meta[k]?.confidence || "MEDIUM") as FieldMeta["confidence"] };
    } else if (fd.has(`${k}_note`) || fd.has(`${k}_conf`) || fd.has(`${k}_source`)) {
      meta[k] = { source: f(fd, `${k}_source`) || meta[k]?.source || "USER", note: fd.has(`${k}_note`) ? f(fd, `${k}_note`) : meta[k]?.note ?? "", confidence: (f(fd, `${k}_conf`) || meta[k]?.confidence || "MEDIUM") as FieldMeta["confidence"] };
    }
  }
  if (fd.has("painPoints")) data.painPoints = str(f(fd, "painPoints").split("\n").map((x) => x.trim()).filter(Boolean));
  data.meta = str(meta);
  for (const [k, v] of Object.entries(data)) if (k !== "meta" && k !== "painPoints") await logEdit({ entity: "ProcessStep", entityId: stepId, requestId: s.requestId, field: `${s.name} · ${k}`, oldValue: (s as unknown as Record<string, unknown>)[k], newValue: v, userId: u.id, reason });
  await db.processStep.update({ where: { id: stepId }, data });
  done(s.requestId);
}

export async function addStep(fd: FormData) {
  const u = await currentUser();
  const id = f(fd, "id");
  const count = await db.processStep.count({ where: { requestId: id } });
  const rate = await db.roleCostRate.findFirst({ where: { band: "Executive / analyst" } });
  const st = await db.processStep.create({ data: { requestId: id, order: count + 1, name: f(fd, "name") || "New step", costPerHour: rate?.ratePerHour ?? 900, meta: str({ costPerHour: { source: "BENCHMARK", note: "Role cost rate (demo value)", confidence: "HIGH" } }) } });
  await logEdit({ entity: "ProcessStep", entityId: st.id, requestId: id, field: "step added", oldValue: "", newValue: st.name, userId: u.id });
  done(id);
}

export async function deleteStep(fd: FormData) {
  const u = await currentUser();
  const s = await db.processStep.delete({ where: { id: f(fd, "stepId") } });
  const rest = await db.processStep.findMany({ where: { requestId: s.requestId }, orderBy: { order: "asc" } });
  for (const [i, r] of rest.entries()) await db.processStep.update({ where: { id: r.id }, data: { order: i + 1 } });
  await logEdit({ entity: "ProcessStep", entityId: s.id, requestId: s.requestId, field: "step removed", oldValue: s.name, newValue: "", userId: u.id });
  done(s.requestId);
}

export async function reorderSteps(requestId: string, ids: string[]) {
  const u = await currentUser();
  for (const [i, id] of ids.entries()) await db.processStep.update({ where: { id }, data: { order: i + 1 } });
  await logEdit({ entity: "ProcessMap", entityId: requestId, requestId, field: "step order", oldValue: "", newValue: "reordered", userId: u.id });
  done(requestId);
}

export async function alignMap(fd: FormData) {
  const u = await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  const r = await db.request.update({ where: { id }, data: { mapAlignedAt: new Date(), mapAlignedBy: u.id, status: "ALIGNED" } });
  await ensureGeneralInputs(id);
  await audit(u.id, "CHECKPOINT_ALIGNED", "Request", id, "Process map aligned with requester");
  await sendEmail({ userId: r.requesterId, type: "ALIGNED", subject: `[Aligned] ${r.code} process map`, body: "The pod analyst marked the process map as aligned. Next: simulation and value.", link: `/requests/${id}?tab=value` });
  done(id);
}

export async function toggleReuse(fd: FormData) {
  const u = await requireRole("POD_ANALYST", "ARCHITECT");
  const o = await db.reuseOption.findUniqueOrThrow({ where: { id: f(fd, "reuseId") } });
  const mode = f(fd, "mode") || o.mode;
  await db.reuseOption.update({ where: { id: o.id }, data: { selected: fd.has("mode") ? o.selected : !o.selected, mode } });
  await logEdit({ entity: "ReuseOption", entityId: o.id, requestId: o.requestId, field: fd.has("mode") ? "mode" : "selected", oldValue: fd.has("mode") ? o.mode : o.selected, newValue: fd.has("mode") ? mode : !o.selected, userId: u.id });
  done(o.requestId);
}

export async function rerunReuse(fd: FormData) {
  await requireRole("POD_ANALYST", "ARCHITECT");
  const id = f(fd, "id");
  await generateReuse(id);
  done(id);
}

// ── Step 4: value
export async function updateValueInput(fd: FormData) {
  const u = await currentUser();
  const id = f(fd, "id");
  const leverKey = f(fd, "leverKey");
  const key = f(fd, "key");
  const ex = await db.valueInput.findUnique({ where: { requestId_leverKey_key: { requestId: id, leverKey, key } } });
  const data = {
    value: n(fd, "value"), low: f(fd, "low") ? n(fd, "low") : null, high: f(fd, "high") ? n(fd, "high") : null,
    source: f(fd, "source") || "USER", sourceNote: f(fd, "sourceNote"), confidence: f(fd, "confidence") || "MEDIUM", label: f(fd, "label") || ex?.label || key, unit: f(fd, "unit") || ex?.unit || "",
  };
  if (ex) await db.valueInput.update({ where: { id: ex.id }, data });
  else await db.valueInput.create({ data: { requestId: id, leverKey, key, ...data } });
  await logEdit({ entity: "ValueInput", entityId: ex?.id ?? key, requestId: id, field: `${leverKey}.${key}`, oldValue: ex?.value ?? "", newValue: data.value, userId: u.id, reason: f(fd, "reason") });
  done(id);
}

export async function removeValueInput(fd: FormData) {
  const u = await currentUser();
  const v = await db.valueInput.delete({ where: { id: f(fd, "inputId") } });
  await logEdit({ entity: "ValueInput", entityId: v.id, requestId: v.requestId, field: `${v.leverKey}.${v.key}`, oldValue: v.value, newValue: "removed", userId: u.id });
  done(v.requestId);
}

export async function saveJustification(fd: FormData) {
  const u = await currentUser();
  const id = f(fd, "id");
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  await db.request.update({ where: { id }, data: { flagJustification: f(fd, "text") } });
  await logEdit({ entity: "Request", entityId: id, requestId: id, field: "flag justification", oldValue: r.flagJustification, newValue: f(fd, "text"), userId: u.id });
  done(id);
}

export async function markValued(fd: FormData) {
  const u = await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  await db.request.update({ where: { id }, data: { status: "VALUED" } });
  await audit(u.id, "VALUED", "Request", id);
  const arch = await db.user.findFirst({ where: { roles: { contains: "ARCHITECT" } } });
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  if (arch) await sendEmail({ userId: arch.id, type: "TASK", subject: `[Design & cost] ${r.code} ${r.title}`, body: "The value estimate is ready. Please add the architecture and the cost estimate.", link: `/requests/${id}?tab=design` });
  done(id);
}

// ── Step 5: design and cost
export async function updateRisk(fd: FormData) {
  const u = await currentUser();
  const id = f(fd, "id");
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  const data = { gxp: b(fd, "gxp"), personalData: b(fd, "personalData"), externalUsers: b(fd, "externalUsers"), dataResidency: f(fd, "dataResidency") || "India" };
  for (const k of ["gxp", "personalData", "externalUsers", "dataResidency"] as const) await logEdit({ entity: "Request", entityId: id, requestId: id, field: k, oldValue: r[k], newValue: data[k], userId: u.id });
  await db.request.update({ where: { id }, data });
  done(id);
}

export async function addCostItem(fd: FormData) {
  const u = await requireRole("ARCHITECT", "POD_ANALYST");
  const id = f(fd, "id");
  const c = await db.componentCostCard.findUniqueOrThrow({ where: { id: f(fd, "componentId") } });
  const item = await db.costItem.create({ data: { requestId: id, componentId: c.id, quantity: n(fd, "quantity"), unitCost: f(fd, "unitCost") ? n(fd, "unitCost") : c.unitCostINR, oneTime: c.kind === "ONE_TIME", note: f(fd, "note") } });
  await logEdit({ entity: "CostItem", entityId: item.id, requestId: id, field: `cost: ${c.name}`, oldValue: "", newValue: `${item.quantity} × ${item.unitCost}`, userId: u.id });
  done(id);
}

export async function removeCostItem(fd: FormData) {
  const u = await requireRole("ARCHITECT", "POD_ANALYST");
  const c = await db.costItem.delete({ where: { id: f(fd, "itemId") }, include: { component: true } });
  await logEdit({ entity: "CostItem", entityId: c.id, requestId: c.requestId, field: `cost: ${c.component.name}`, oldValue: `${c.quantity} × ${c.unitCost}`, newValue: "removed", userId: u.id });
  done(c.requestId);
}

export async function runArchitecture(fd: FormData) {
  await requireRole("ARCHITECT", "POD_ANALYST");
  const id = f(fd, "id");
  await draftArchitecture(id);
  done(id);
}

export async function saveArchitecture(fd: FormData) {
  const u = await requireRole("ARCHITECT", "POD_ANALYST");
  const id = f(fd, "id");
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  await db.request.update({ where: { id }, data: { architecture: f(fd, "architecture"), mermaid: f(fd, "mermaid") } });
  await logEdit({ entity: "Request", entityId: id, requestId: id, field: "architecture", oldValue: r.architecture.slice(0, 80), newValue: f(fd, "architecture").slice(0, 80), userId: u.id });
  done(id);
}

export async function markDesigned(fd: FormData) {
  const u = await requireRole("ARCHITECT", "POD_ANALYST");
  const id = f(fd, "id");
  await db.request.update({ where: { id }, data: { status: "DESIGNED" } });
  await audit(u.id, "DESIGNED", "Request", id);
  done(id);
}

// ── Step 6: business case and approval
export async function runBusinessCase(fd: FormData) {
  const u = await requireRole("POD_ANALYST", "ARCHITECT");
  const id = f(fd, "id");
  const c = await generateBusinessCase(id);
  await audit(u.id, "GENERATE_CASE", "Request", id, `Version ${c.version}`);
  done(id);
}

export async function submitApproval(fd: FormData) {
  const u = await requireRole("POD_ANALYST");
  const id = f(fd, "id");
  try {
    if (!(await db.businessCase.count({ where: { requestId: id } }))) await generateBusinessCase(id);
    await startApproval(id, u);
  } catch (e) {
    redirect(`/requests/${id}?tab=approvals&error=${encodeURIComponent(e instanceof Error ? e.message : "Error")}`);
  }
  done(id);
  redirect(`/requests/${id}?tab=approvals`);
}

type Outcome = "APPROVED" | "REJECTED" | "POC" | "MORE_DATA";
export async function decideApprove(fd: FormData) { await decideApproval(fd, "APPROVED"); }
export async function decidePoc(fd: FormData) { await decideApproval(fd, "POC"); }
export async function decideMoreData(fd: FormData) { await decideApproval(fd, "MORE_DATA"); }
export async function decideReject(fd: FormData) { await decideApproval(fd, "REJECTED"); }

async function decideApproval(fd: FormData, outcome: Outcome) {
  const u = await currentUser();
  const id = f(fd, "id");
  try {
    await decide(f(fd, "approvalId"), u, outcome, f(fd, "comment"));
  } catch (e) {
    redirect(`/requests/${id}?tab=approvals&error=${encodeURIComponent(e instanceof Error ? e.message : "Error")}`);
  }
  done(id);
  revalidatePath("/approvals");
  revalidatePath("/council");
}

export async function runDeadlines() {
  const u = await currentUser();
  const nDone = await processDeadlines(u.id);
  await audit(u.id, "PROCESS_DEADLINES", "Approval", "-", `${nDone} auto-approved`);
  revalidatePath("/", "layout");
}

// ── Step 6b / 7: delivery, marketplace, value tracking
export async function setDelivery(fd: FormData) {
  const u = await requireRole("POD_ANALYST", "ARCHITECT", "DIGITAL_HEAD");
  const id = f(fd, "id");
  const status = f(fd, "status");
  const r = await db.request.update({ where: { id }, data: { status, ...(status === "LIVE" ? { goLiveAt: new Date() } : {}) } });
  await audit(u.id, `SET_${status}`, "Request", id);
  if (status === "LIVE") await sendEmail({ userId: r.requesterId, type: "LIVE", subject: `[Live] ${r.code} ${r.title}`, body: "The solution is live. We will ask you for actual values at 3 and 6 months.", link: `/requests/${id}?tab=tracking` });
  done(id);
}

export async function publishItem(fd: FormData) {
  const u = await requireRole("POD_ANALYST", "ARCHITECT", "ADMIN");
  const id = f(fd, "id");
  const r = await db.request.findUniqueOrThrow({ where: { id }, include: { function: true } });
  const tier = f(fd, "tier");
  const securityChecked = b(fd, "securityChecked");
  if (tier === "CERTIFIED" && (!securityChecked || !f(fd, "supportModel"))) {
    redirect(`/requests/${id}?tab=tracking&error=${encodeURIComponent("Certified items need a security check and a support model.")}`);
  }
  const item = await db.marketplaceItem.create({
    data: {
      name: f(fd, "name"), type: f(fd, "type"), description: f(fd, "description"), functions: str([r.function.name]), tier, ownerId: u.id, version: f(fd, "version") || "1.0",
      reviewDate: new Date(f(fd, "reviewDate") || Date.now() + 180 * 86_400_000), howToUse: f(fd, "howToUse"), targetTool: f(fd, "targetTool"), linkedRequestId: id,
      assetId: f(fd, "assetId") || null, securityChecked, supportModel: f(fd, "supportModel"),
    },
  });
  await audit(u.id, "PUBLISH", "MarketplaceItem", item.id, `${item.name} (${tier})`, id);
  redirect(`/marketplace/${item.id}`);
}

export async function enterActual(fd: FormData) {
  const u = await requireRole("POD_ANALYST", "REQUESTER", "FINANCE");
  const id = f(fd, "id");
  const v = await loadValue(id);
  const leverKey = f(fd, "leverKey");
  const period = f(fd, "period");
  const expected = v.result.levers.find((l) => l.key === leverKey)?.byYear[0] ?? 0;
  await db.valueActual.upsert({
    where: { requestId_leverKey_period: { requestId: id, leverKey, period } },
    update: { actualValue: n(fd, "actual"), note: f(fd, "note"), expected, enteredById: u.id },
    create: { requestId: id, leverKey, period, actualValue: n(fd, "actual"), note: f(fd, "note"), expected, enteredById: u.id },
  });
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  if (r.status === "LIVE") await db.request.update({ where: { id }, data: { status: "VALUE_TRACKED" } });
  await audit(u.id, "ENTER_ACTUAL", "Request", id, `${leverKey} ${period}: ${n(fd, "actual")}`);
  done(id);
  revalidatePath("/value");
}

export async function editSummary(fd: FormData) {
  const u = await currentUser();
  const id = f(fd, "id");
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  const title = f(fd, "title");
  const problem = f(fd, "problem");
  await db.request.update({ where: { id }, data: { title, problemStatement: problem, summary: str({ ...parse<Record<string, unknown>>(r.summary, {}), title, problem }) } });
  await logEdit({ entity: "Request", entityId: id, requestId: id, field: "title", oldValue: r.title, newValue: title, userId: u.id });
  await logEdit({ entity: "Request", entityId: id, requestId: id, field: "problem", oldValue: r.problemStatement, newValue: problem, userId: u.id });
  done(id);
}

export async function submitDraft(fd: FormData) {
  const u = await currentUser();
  const id = f(fd, "id");
  await db.request.update({ where: { id }, data: { status: "SUBMITTED" } });
  await refreshSimilarity(id, !!getProvider());
  await proposeRoute(id);
  await audit(u.id, "SUBMIT", "Request", id);
  redirect(`/requests/${id}?tab=route`);
}
