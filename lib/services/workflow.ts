// Step 6: approval workflow (levels, Finance step, Council, deadlines, decision log).
import { db } from "../db";
import { addWorkingDays, determineLevel, financeRequired, type Level } from "../approval/levels";
import { audit } from "../audit/audit";
import { inr } from "../format";
import { notifyRole, sendEmail } from "../notify/email";
import { getSettings, getThresholds } from "../settings";
import type { CurrentUser } from "../session";
import { loadValue } from "./value";

const OUTCOME_STATUS: Record<string, string> = { APPROVED: "APPROVED", POC: "APPROVED_POC", REJECTED: "REJECTED", MORE_DATA: "MORE_DATA" };
const link = (id: string) => `/requests/${id}?tab=approvals`;

export async function nextCouncilMeeting() {
  const upcoming = await db.councilMeeting.findFirst({ where: { date: { gte: new Date() } }, orderBy: { date: "asc" } });
  if (upcoming) return upcoming;
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  while (d.getDay() !== 4) d.setDate(d.getDate() + 1); // first Thursday
  d.setHours(15, 0, 0, 0);
  return db.councilMeeting.create({ data: { date: d } });
}

export async function startApproval(requestId: string, user: CurrentUser) {
  const r = await db.request.findUniqueOrThrow({ where: { id: requestId } });
  const v = await loadValue(requestId);
  if (v.flags.length && !r.flagJustification.trim()) throw new Error("This case has flags. Write a justification before you send it for approval.");
  const t = await getThresholds();
  const highRisk = v.flags.filter((f) => f.highRisk).map((f) => f.code);
  const { level } = determineLevel({ route: r.route, tco: v.result.tco, gxp: r.gxp, personalData: r.personalData, externalUsers: r.externalUsers, highRiskFlags: highRisk }, t);
  await db.approval.deleteMany({ where: { requestId, status: "PENDING" } });
  await db.request.update({ where: { id: requestId }, data: { approvalLevel: level, status: "IN_APPROVAL", financeApprovedAt: null } });
  await audit(user.id, "SUBMIT_FOR_APPROVAL", "Request", requestId, `Level ${level}; benefit ${inr(v.result.totalBenefit)}; TCO ${inr(v.result.tco)}`);

  if (financeRequired(v.result.totalBenefit, t)) {
    const fin = await db.user.findFirst({ where: { roles: { contains: "FINANCE" } } });
    if (fin) {
      await db.approval.create({ data: { requestId, stage: "FINANCE", level: "FIN", approverId: fin.id, dueAt: addWorkingDays(new Date(), 3) } });
      await sendEmail({ userId: fin.id, type: "APPROVAL_REQUEST", subject: `[Finance review] ${r.code} ${r.title}`, body: `Please review the value inputs. 5-year benefit: ${inr(v.result.totalBenefit)}. This is above the Finance threshold. After your approval the case goes to level ${level}.`, link: link(requestId) });
      return { level, finance: true };
    }
  }
  await createLevelApprovals(requestId, level as Level);
  return { level, finance: false };
}

export async function createLevelApprovals(requestId: string, level: Level) {
  const r = await db.request.findUniqueOrThrow({ where: { id: requestId } });
  const subject = `[${level} approval] ${r.code} ${r.title}`;
  if (level === "L1") {
    const heads = await db.user.findMany({ where: { roles: { contains: "DIGITAL_HEAD" } } });
    for (const h of heads) {
      await db.approval.create({ data: { requestId, stage: "LEVEL", level, approverId: h.id, dueAt: addWorkingDays(new Date(), 3) } });
      await sendEmail({ userId: h.id, type: "APPROVAL_REQUEST", subject, body: "A Level 1 case waits for your decision. Due in 3 working days.", link: link(requestId) });
    }
  } else if (level === "L2") {
    const members = await db.user.findMany({ where: { roles: { contains: "COUNCIL_MEMBER" } } });
    for (const m of members) {
      await db.approval.create({ data: { requestId, stage: "LEVEL", level, approverId: m.id, dueAt: addWorkingDays(new Date(), 5) } });
      await sendEmail({ userId: m.id, type: "APPROVAL_REQUEST", subject, body: "A Level 2 case waits for your online review. Due in 5 working days. No reply by the deadline counts as approval.", link: link(requestId) });
    }
  } else {
    const meeting = await nextCouncilMeeting();
    await db.request.update({ where: { id: requestId }, data: { councilMeetingId: meeting.id } });
    const members = await db.user.findMany({ where: { OR: [{ roles: { contains: "COUNCIL_MEMBER" } }, { roles: { contains: "COUNCIL_CHAIR" } }] } });
    for (const m of members) {
      await db.approval.create({ data: { requestId, stage: "LEVEL", level, approverId: m.id, dueAt: meeting.date } });
      await sendEmail({ userId: m.id, type: "COUNCIL_AGENDA", subject: `[AI Council agenda] ${r.code} ${r.title}`, body: `This Level 3 case is on the agenda of the Council meeting on ${meeting.date.toDateString()}. Please read the case and slides before the meeting.${m.roles.includes("COUNCIL_CHAIR") ? " As chair, you make the final decision." : ""}`, link: link(requestId) });
    }
  }
}

export async function decide(approvalId: string, user: CurrentUser, status: "APPROVED" | "REJECTED" | "POC" | "MORE_DATA", comment: string) {
  if (!["APPROVED", "REJECTED", "POC", "MORE_DATA"].includes(status)) throw new Error("Unknown decision.");
  const a = await db.approval.findUniqueOrThrow({ where: { id: approvalId }, include: { request: true } });
  if (a.approverId !== user.id && !user.roles.includes("ADMIN")) throw new Error("Only the named approver can decide.");
  if (a.status !== "PENDING") throw new Error("This approval is already decided.");
  await db.approval.update({ where: { id: approvalId }, data: { status, comment, decidedAt: new Date() } });
  await audit(user.id, `APPROVAL_${status}`, "Request", a.requestId, `${a.level}: ${comment}`);
  const r = a.request;

  if (a.stage === "FINANCE") {
    if (status === "APPROVED" || status === "POC") {
      await db.request.update({ where: { id: r.id }, data: { financeApprovedAt: new Date() } });
      await createLevelApprovals(r.id, (r.approvalLevel ?? "L2") as Level);
    } else {
      await applyOutcome(r.id, status, user.id, `Finance: ${comment}`);
    }
    return;
  }

  if (a.level === "L1") return applyOutcome(r.id, status, user.id, comment);

  if (a.level === "L3") {
    if (user.roles.includes("COUNCIL_CHAIR") || user.roles.includes("ADMIN")) {
      await db.approval.updateMany({ where: { requestId: r.id, level: "L3", status: "PENDING" }, data: { status: "SKIPPED", decidedAt: new Date() } });
      return applyOutcome(r.id, status, user.id, comment);
    }
    return; // member votes are advisory; the chair decides
  }
  await evaluateL2(r.id, user.id);
}

async function evaluateL2(requestId: string, userId: string) {
  const all = await db.approval.findMany({ where: { requestId, level: "L2" } });
  if (all.some((x) => x.status === "PENDING")) return;
  const s = (st: string) => all.filter((x) => x.status === st).length;
  const outcome = s("REJECTED") > all.length / 2 ? "REJECTED" : s("MORE_DATA") > 0 ? "MORE_DATA" : s("POC") > 0 ? "POC" : "APPROVED";
  const comments = all.filter((x) => x.comment).map((x) => x.comment).join(" | ");
  await applyOutcome(requestId, outcome as keyof typeof OUTCOME_STATUS, userId, comments || "Online review complete.");
}

export async function applyOutcome(requestId: string, outcome: string, userId: string, comment: string) {
  const r = await db.request.update({ where: { id: requestId }, data: { status: OUTCOME_STATUS[outcome] ?? outcome } });
  await db.decision.create({ data: { requestId, outcome: OUTCOME_STATUS[outcome] ?? outcome, decidedById: userId, conditions: comment } });
  const body = `Decision: ${OUTCOME_STATUS[outcome] ?? outcome}. ${comment}`;
  await sendEmail({ userId: r.requesterId, type: "DECISION", subject: `[Decision] ${r.code} ${r.title}`, body, link: `/requests/${r.id}?tab=approvals` });
  if (r.ownerId) await sendEmail({ userId: r.ownerId, type: "DECISION", subject: `[Decision] ${r.code} ${r.title}`, body, link: `/requests/${r.id}?tab=approvals` });
  await audit(userId, "DECISION", "Request", requestId, body);
}

/** L2 deadlines: no reply by the due date counts as approved (configurable). */
export async function processDeadlines(userId = "system") {
  const s = await getSettings();
  if (s.l2AutoApprove !== "true") return 0;
  const due = await db.approval.findMany({ where: { level: "L2", status: "PENDING", dueAt: { lt: new Date() } } });
  for (const a of due) {
    await db.approval.update({ where: { id: a.id }, data: { status: "AUTO_APPROVED", comment: "No reply by the deadline.", decidedAt: new Date() } });
  }
  const ids = [...new Set(due.map((a) => a.requestId))];
  for (const id of ids) await evaluateL2(id, userId);
  return due.length;
}

export async function notifyPod(subject: string, body: string, link: string) {
  await notifyRole("POD_ANALYST", { type: "TASK", subject, body, link });
}
