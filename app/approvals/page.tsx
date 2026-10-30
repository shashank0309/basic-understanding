import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { date, inr } from "@/lib/format";
import { loadValue } from "@/lib/services/value";
import { processDeadlines } from "@/lib/services/workflow";
import { runDeadlines } from "@/app/actions/request";
import { DecisionForm } from "@/components/request/ApprovalsTab";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, Empty, Notice } from "@/components/ui";

export default async function Approvals() {
  const user = await currentUser();
  const autoDone = await processDeadlines(user.id); // L2 deadline rule runs when the inbox opens
  const mine = await db.approval.findMany({ where: { approverId: user.id, status: "PENDING" }, include: { request: { include: { function: true } } }, orderBy: { dueAt: "asc" } });
  const history = await db.approval.findMany({ where: { approverId: user.id, status: { not: "PENDING" } }, include: { request: true }, orderBy: { decidedAt: "desc" }, take: 10 });
  const values = await Promise.all(mine.map((a) => loadValue(a.requestId)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1>Approvals inbox</h1><p className="muted">Decisions waiting for you. Approve, reject, approve as POC, or ask for more data.</p></div>
        <form action={runDeadlines}><SubmitButton className="btn-secondary btn-sm">Process overdue L2 reviews</SubmitButton></form>
      </div>
      {autoDone > 0 && <Notice tone="green">{autoDone} overdue Level 2 review(s) counted as approved (no reply by the deadline).</Notice>}
      {mine.length ? mine.map((a, i) => (
        <Card key={a.id} title={<span>{a.request.code} {a.request.title}</span>} actions={<Badge tone="amber">{a.stage === "FINANCE" ? "Finance review" : `Level ${a.level.slice(1)}`}</Badge>}>
          <div className="mb-2 flex flex-wrap gap-4 text-sm text-slate-600">
            <span>{a.request.function.name}</span><span>Due {a.dueAt ? date(a.dueAt) : "at the meeting"}</span>
            <span>Benefit {inr(values[i].result.totalBenefit)}</span><span>TCO {inr(values[i].result.tco)}</span><span>ROI {values[i].result.roi.toFixed(1)}×</span>
            {values[i].flags.length > 0 && <Badge tone="red">{values[i].flags.length} flag(s)</Badge>}
          </div>
          <div className="mb-2 flex gap-3 text-sm"><Link href={`/requests/${a.requestId}?tab=case`}>Business case</Link><Link href={`/requests/${a.requestId}?tab=value`}>Value and sources</Link><Link href={`/requests/${a.requestId}?tab=approvals`}>Other approvers</Link></div>
          <DecisionForm requestId={a.requestId} approvalId={a.id} isChair={a.level === "L3" && user.roles.includes("COUNCIL_CHAIR")} />
        </Card>
      )) : <Empty>Nothing waits for you. Switch role in the top bar (for example, Head of Digital & AI, Finance or Council chair) to see other inboxes.</Empty>}
      {history.length > 0 && (
        <Card title="Your recent decisions">
          <ul className="space-y-1 text-sm">{history.map((h) => <li key={h.id}><Link href={`/requests/${h.requestId}?tab=approvals`}>{h.request.code} {h.request.title}</Link> – {h.status.toLowerCase().replace("_", " ")} {h.decidedAt ? `on ${date(h.decidedAt)}` : ""}</li>)}</ul>
        </Card>
      )}
    </div>
  );
}
