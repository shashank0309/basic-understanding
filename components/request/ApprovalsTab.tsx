import Link from "next/link";
import { db } from "@/lib/db";
import { hasRole, type CurrentUser } from "@/lib/session";
import { date, dateTime, inr } from "@/lib/format";
import { loadValue } from "@/lib/services/value";
import { determineLevel, financeRequired, LEVEL_INFO } from "@/lib/approval/levels";
import { getThresholds } from "@/lib/settings";
import { STATUS_LABELS } from "@/lib/constants";
import { decideApprove, decideMoreData, decidePoc, decideReject, runDeadlines, submitApproval } from "@/app/actions/request";
import { SubmitButton } from "../SubmitButton";
import { Badge, Card, Empty, Notice } from "../ui";

const A_TONE: Record<string, "green" | "red" | "amber" | "gray" | "blue"> = { APPROVED: "green", AUTO_APPROVED: "green", POC: "green", REJECTED: "red", MORE_DATA: "amber", PENDING: "blue", SKIPPED: "gray" };

export function DecisionForm({ requestId, approvalId, isChair }: { requestId: string; approvalId: string; isChair?: boolean }) {
  return (
    <form action={decideApprove} className="space-y-2 rounded-md border border-brand bg-brand-light/30 p-3">
      <input type="hidden" name="id" value={requestId} /><input type="hidden" name="approvalId" value={approvalId} />
      <label className="label" htmlFor={`c-${approvalId}`}>Your comment</label>
      <textarea id={`c-${approvalId}`} name="comment" className="input" placeholder="Conditions, questions or reasons" />
      <div className="flex flex-wrap gap-2">
        <SubmitButton formAction={decideApprove} pending="Saving…">Approve</SubmitButton>
        <SubmitButton formAction={decidePoc} className="btn-secondary" pending="Saving…">Approve as POC</SubmitButton>
        <SubmitButton formAction={decideMoreData} className="btn-secondary" pending="Saving…">Ask for more data</SubmitButton>
        <SubmitButton formAction={decideReject} className="btn-danger" pending="Saving…">Reject</SubmitButton>
      </div>
      {isChair && <p className="text-xs text-slate-600">As chair, your decision is final for Level 3.</p>}
    </form>
  );
}

export async function ApprovalsTab({ id, user }: { id: string; user: CurrentUser }) {
  const r = await db.request.findUniqueOrThrow({ where: { id }, include: { approvals: { orderBy: { createdAt: "asc" } }, decisions: { orderBy: { at: "desc" } }, councilMeeting: true } });
  const users = await db.user.findMany();
  const name = (uid: string) => users.find((u) => u.id === uid)?.name ?? uid;
  const v = await loadValue(id);
  const t = await getThresholds();
  const highRisk = v.flags.filter((f) => f.highRisk).map((f) => f.code);
  const level = determineLevel({ route: r.route, tco: v.result.tco, gxp: r.gxp, personalData: r.personalData, externalUsers: r.externalUsers, highRiskFlags: highRisk }, t);
  const fin = financeRequired(v.result.totalBenefit, t);
  const pod = hasRole(user, "POD_ANALYST");
  const canSubmit = pod && ["DESIGNED", "VALUED", "MORE_DATA", "ROUTED"].includes(r.status) && (r.route === "R5_CUSTOM_AI" || r.route === "R2_EXTEND");
  const mine = r.approvals.filter((a) => a.status === "PENDING" && (a.approverId === user.id || user.roles.includes("ADMIN")));
  const overdue = r.approvals.some((a) => a.level === "L2" && a.status === "PENDING" && a.dueAt && a.dueAt < new Date());
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Approval level">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Badge tone="amber">{r.approvalLevel ?? level.level}</Badge><span>{LEVEL_INFO[(r.approvalLevel ?? level.level) as "L1"].approvers} · {LEVEL_INFO[(r.approvalLevel ?? level.level) as "L1"].mode}</span></div>
            <ul className="list-disc pl-5 text-slate-600">{level.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
            <p>TCO {inr(v.result.tco)} · {v.model.factors.horizonYears}-year benefit {inr(v.result.totalBenefit)}</p>
            {fin && <p><Badge tone="amber">Finance step</Badge> Benefit is above {inr(t.financeMinBenefit)}, so Finance approves the inputs first.</p>}
            {r.councilMeeting && <p>On the agenda of the <Link href="/council">AI Council meeting on {date(r.councilMeeting.date)}</Link>.</p>}
          </div>
        </Card>
        <Card title="Send for approval">
          {canSubmit ? (
            <div className="space-y-2">
              {v.flags.length > 0 && !r.flagJustification && <Notice tone="amber">This case has {v.flags.length} flag(s). Write a justification on the <Link href={`/requests/${id}?tab=value`}>Simulation & value</Link> tab first.</Notice>}
              <p className="muted">The system sends emails to the approvers and adds Level 3 cases to the next Council agenda.</p>
              <form action={submitApproval}><input type="hidden" name="id" value={id} /><SubmitButton pending="Starting workflow…">Start approval workflow</SubmitButton></form>
            </div>
          ) : <p className="muted">{r.status === "IN_APPROVAL" ? "The workflow is running." : STATUS_LABELS[r.status] ? `Status: ${STATUS_LABELS[r.status]}.` : ""} {pod ? "" : "The pod analyst starts the workflow."}</p>}
          {overdue && <form action={runDeadlines} className="mt-2"><SubmitButton className="btn-secondary btn-sm">Process overdue L2 reviews (no reply = approved)</SubmitButton></form>}
        </Card>
      </div>

      {mine.map((a) => (
        <Card key={a.id} title={a.stage === "FINANCE" ? "Your Finance review" : `Your ${a.level} decision`}>
          <p className="mb-2 text-sm text-slate-600">Due {a.dueAt ? date(a.dueAt) : "at the meeting"}. Read the <Link href={`/requests/${id}?tab=case`}>business case</Link> and the <Link href={`/requests/${id}?tab=value`}>value inputs</Link>.</p>
          <DecisionForm requestId={id} approvalId={a.id} isChair={a.level === "L3" && user.roles.includes("COUNCIL_CHAIR")} />
        </Card>
      ))}

      <Card title="Approvals">
        {r.approvals.length ? (
          <table className="table">
            <thead><tr><th>Step</th><th>Approver</th><th>Status</th><th>Due</th><th>Decided</th><th>Comment</th></tr></thead>
            <tbody>{r.approvals.map((a) => (
              <tr key={a.id}><td>{a.stage === "FINANCE" ? "Finance" : a.level}</td><td>{name(a.approverId)}</td><td><Badge tone={A_TONE[a.status]}>{a.status.replace("_", " ").toLowerCase()}</Badge></td><td className="whitespace-nowrap">{a.dueAt ? date(a.dueAt) : "–"}{a.status === "PENDING" && a.dueAt && a.dueAt < new Date() && <span className="ml-1 text-xs text-red-600">overdue</span>}</td><td className="whitespace-nowrap">{a.decidedAt ? dateTime(a.decidedAt) : "–"}</td><td className="text-xs">{a.comment}</td></tr>
            ))}</tbody>
          </table>
        ) : <Empty>No approvals yet.</Empty>}
      </Card>

      <Card title="Decision log">
        {r.decisions.length ? (
          <ul className="space-y-2">{r.decisions.map((d) => <li key={d.id} className="rounded border border-slate-200 p-2 text-sm"><div className="flex items-center gap-2"><Badge tone={d.outcome === "REJECTED" ? "red" : d.outcome === "MORE_DATA" ? "amber" : "green"}>{STATUS_LABELS[d.outcome] ?? d.outcome}</Badge><span className="text-slate-500">{dateTime(d.at)} · {name(d.decidedById)}</span></div>{d.conditions && <p className="mt-1">{d.conditions}</p>}</li>)}</ul>
        ) : <Empty>No decision yet. The requester sees every decision here.</Empty>}
      </Card>
    </div>
  );
}
