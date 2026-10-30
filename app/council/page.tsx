import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser, hasRole } from "@/lib/session";
import { date, inr } from "@/lib/format";
import { loadValue } from "@/lib/services/value";
import { nextCouncilMeeting } from "@/lib/services/workflow";
import { STATUS_LABELS } from "@/lib/constants";
import { DecisionForm } from "@/components/request/ApprovalsTab";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, Empty, StatusBadge } from "@/components/ui";

async function saveMinutes(fd: FormData) {
  "use server";
  const u = await currentUser();
  if (!hasRole(u, "COUNCIL_CHAIR", "COUNCIL_MEMBER", "DIGITAL_HEAD")) throw new Error("Only Council members can write minutes.");
  await db.councilMeeting.update({ where: { id: String(fd.get("id")) }, data: { minutes: String(fd.get("minutes") ?? "") } });
  revalidatePath("/council");
}

export default async function Council() {
  const user = await currentUser();
  await nextCouncilMeeting();
  const meetings = await db.councilMeeting.findMany({ include: { requests: { include: { function: true, approvals: true, decisions: true } } }, orderBy: { date: "desc" } });
  const upcoming = meetings.filter((m) => m.date >= new Date()).sort((a, b) => +a.date - +b.date);
  const past = meetings.filter((m) => m.date < new Date());
  const users = await db.user.findMany();
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const council = hasRole(user, "COUNCIL_CHAIR", "COUNCIL_MEMBER", "DIGITAL_HEAD");
  return (
    <div className="space-y-4">
      <div><h1>AI Council</h1><p className="muted">Monthly meeting for Level 3 cases (TCO above ₹1 crore or high risk). The chair makes the final decision.</p></div>
      {upcoming.map((m) => (
        <Card key={m.id} title={`Next meeting: ${date(m.date)}`} actions={<a className="btn" href={`/api/council/${m.id}/pack`}>Download slide pack (.pptx)</a>}>
          {m.requests.length ? (
            <div className="space-y-3">
              {m.requests.map((r, i) => <AgendaItem key={r.id} r={r} i={i} userId={user.id} isChair={user.roles.includes("COUNCIL_CHAIR")} name={name} />)}
            </div>
          ) : <Empty>No Level 3 cases on the agenda yet.</Empty>}
          <form action={saveMinutes} className="mt-4 space-y-2"><input type="hidden" name="id" value={m.id} />
            <label className="label" htmlFor={`min-${m.id}`}>Minutes</label>
            <textarea id={`min-${m.id}`} name="minutes" defaultValue={m.minutes} className="input min-h-[80px]" disabled={!council} />
            {council && <SubmitButton className="btn-secondary">Save minutes</SubmitButton>}</form>
        </Card>
      ))}
      <Card title="Past meetings">
        {past.length ? past.map((m) => (
          <div key={m.id} className="border-b border-slate-100 py-2 text-sm">
            <div className="font-medium">{date(m.date)}</div>
            {m.requests.map((r) => <div key={r.id}><Link href={`/requests/${r.id}`}>{r.code} {r.title}</Link> – {STATUS_LABELS[r.status]}</div>)}
            {m.minutes && <pre className="mt-1 whitespace-pre-wrap font-sans text-slate-600">{m.minutes}</pre>}
          </div>
        )) : <Empty>No past meetings.</Empty>}
      </Card>
    </div>
  );
}

type AgendaReq = { id: string; code: string; title: string; status: string; gxp: boolean; function: { name: string }; approvals: { id: string; approverId: string; status: string; level: string; comment: string }[] };

async function AgendaItem({ r, i, userId, isChair, name }: { r: AgendaReq; i: number; userId: string; isChair: boolean; name: (id: string) => string }) {
  const v = await loadValue(r.id);
  const mine = r.approvals.find((a) => a.approverId === userId && a.status === "PENDING" && a.level === "L3");
  return (
    <div className="rounded border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><span className="text-slate-500">{i + 1}.</span> <Link href={`/requests/${r.id}?tab=case`} className="font-medium">{r.code} {r.title}</Link> <span className="text-xs text-slate-500">{r.function.name}</span></div>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-600"><span>Benefit {inr(v.result.totalBenefit)}</span><span>TCO {inr(v.result.tco)}</span><span>Net {inr(v.result.netValue)}</span><span>ROI {v.result.roi.toFixed(1)}×</span>{r.gxp && <Badge tone="red">GxP</Badge>}{v.flags.length > 0 && <Badge tone="amber">{v.flags.length} flag(s)</Badge>}</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">{r.approvals.filter((a) => a.level === "L3").map((a) => <span key={a.id} className="rounded bg-slate-100 px-2 py-0.5">{name(a.approverId)}: {a.status.toLowerCase()}{a.comment ? ` – “${a.comment}”` : ""}</span>)}</div>
      {mine && <div className="mt-2"><DecisionForm requestId={r.id} approvalId={mine.id} isChair={isChair} /></div>}
    </div>
  );
}
