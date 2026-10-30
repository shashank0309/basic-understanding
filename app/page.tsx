import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser, hasRole, canSeeRequest } from "@/lib/session";
import { FUNNEL, ROLE_LABELS } from "@/lib/constants";
import { daysSince, date } from "@/lib/format";
import { Card, Empty, RouteBadge, Stat, StatusBadge } from "@/components/ui";
import { ROUTE_LABELS, type Route } from "@/lib/routing/rules";

const OPEN = ["SUBMITTED", "ROUTED", "IN_ASSESSMENT", "ALIGNED", "VALUED", "DESIGNED", "IN_APPROVAL", "MORE_DATA"];

export default async function Home() {
  const user = await currentUser();
  const all = (await db.request.findMany({ include: { function: true }, orderBy: { updatedAt: "desc" } })).filter((r) => canSeeRequest(user, r));
  const mine = all.filter((r) => r.requesterId === user.id);
  const approvals = await db.approval.findMany({ where: { approverId: user.id, status: "PENDING" }, include: { request: true } });
  const tasks: { href: string; text: string; tag: string }[] = approvals.map((a) => ({ href: `/requests/${a.requestId}?tab=approvals`, text: `${a.request.code} ${a.request.title}`, tag: a.stage === "FINANCE" ? "Finance review" : `${a.level} decision` }));
  if (hasRole(user, "POD_ANALYST")) {
    all.filter((r) => r.status === "SUBMITTED").forEach((r) => tasks.push({ href: `/requests/${r.id}?tab=route`, text: `${r.code} ${r.title}`, tag: "Triage" }));
    all.filter((r) => r.status === "IN_ASSESSMENT" && r.ownerId === user.id).forEach((r) => tasks.push({ href: `/requests/${r.id}?tab=map`, text: `${r.code} ${r.title}`, tag: "Align map" }));
    all.filter((r) => r.status === "DESIGNED" && r.ownerId === user.id).forEach((r) => tasks.push({ href: `/requests/${r.id}?tab=case`, text: `${r.code} ${r.title}`, tag: "Business case" }));
  }
  if (hasRole(user, "ARCHITECT")) all.filter((r) => r.status === "VALUED").forEach((r) => tasks.push({ href: `/requests/${r.id}?tab=design`, text: `${r.code} ${r.title}`, tag: "Design & cost" }));
  if (hasRole(user, "REQUESTER")) mine.filter((r) => r.status === "IN_ASSESSMENT").forEach((r) => tasks.push({ href: `/requests/${r.id}?tab=map`, text: `${r.code} ${r.title}`, tag: "Confirm map" }));
  const live = all.filter((r) => r.status === "LIVE" && r.goLiveAt && daysSince(r.goLiveAt) >= 75);
  if (hasRole(user, "POD_ANALYST", "REQUESTER")) live.forEach((r) => tasks.push({ href: `/requests/${r.id}?tab=tracking`, text: `${r.code} ${r.title}`, tag: "Enter M3 actuals" }));

  const funnel = FUNNEL.map((s) => ({ ...s, n: all.filter((r) => s.statuses.includes(r.status)).length }));
  const max = Math.max(1, ...funnel.map((f) => f.n));
  const open = all.filter((r) => OPEN.includes(r.status));
  const buckets = [
    { label: "< 2 weeks", n: open.filter((r) => daysSince(r.createdAt) < 14).length },
    { label: "2–4 weeks", n: open.filter((r) => daysSince(r.createdAt) >= 14 && daysSince(r.createdAt) < 28).length },
    { label: "1–2 months", n: open.filter((r) => daysSince(r.createdAt) >= 28 && daysSince(r.createdAt) < 60).length },
    { label: "> 2 months", n: open.filter((r) => daysSince(r.createdAt) >= 60).length },
  ];
  const routes = Object.keys(ROUTE_LABELS).map((k) => ({ k, n: all.filter((r) => r.route === k).length }));
  const avgAge = open.length ? Math.round(open.reduce((a, r) => a + daysSince(r.createdAt), 0) / open.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Welcome, {user.name.split(" ")[0]}</h1>
          <p className="muted">You act as {user.roles.map((r) => ROLE_LABELS[r]).join(", ")}. One register for every business problem – from intake to value.</p>
        </div>
        <Link href="/submit" className="btn">Submit a business problem</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Requests in register" value={all.length} hint="Single source of truth" />
        <Stat label="Open backlog" value={open.length} hint={`Average age ${avgAge} days`} />
        <Stat label="Waiting for a decision" value={all.filter((r) => r.status === "IN_APPROVAL").length} />
        <Stat label="Live / value tracked" value={all.filter((r) => ["LIVE", "VALUE_TRACKED"].includes(r.status)).length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`My tasks (${tasks.length})`} className="lg:col-span-2">
          {tasks.length ? (
            <ul className="divide-y divide-slate-100">
              {tasks.slice(0, 12).map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link href={t.href}>{t.text}</Link>
                  <span className="whitespace-nowrap rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{t.tag}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>No open tasks. Good work.</Empty>}
        </Card>
        <Card title="Pipeline funnel">
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.key}>
                <div className="flex justify-between text-xs"><span>{f.label}</span><span className="font-semibold">{f.n}</span></div>
                <div className="h-3 rounded bg-slate-100"><div className="h-3 rounded bg-brand" style={{ width: `${(f.n / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="My requests" className="lg:col-span-2">
          {mine.length ? (
            <table className="table">
              <thead><tr><th>Code</th><th>Title</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>{mine.slice(0, 8).map((r) => (
                <tr key={r.id}><td className="whitespace-nowrap">{r.code}</td><td><Link href={`/requests/${r.id}`}>{r.title}</Link></td><td><StatusBadge status={r.status} /></td><td className="whitespace-nowrap">{date(r.updatedAt)}</td></tr>
              ))}</tbody>
            </table>
          ) : <Empty>You have not submitted a request yet. <Link href="/submit">Submit one</Link>.</Empty>}
        </Card>
        <div className="space-y-6">
          <Card title="Backlog age (open requests)">
            <div className="grid grid-cols-4 gap-2 text-center">
              {buckets.map((b) => <div key={b.label} className="rounded bg-slate-50 p-2"><div className="text-lg font-semibold">{b.n}</div><div className="text-[11px] text-slate-500">{b.label}</div></div>)}
            </div>
          </Card>
          <Card title="Requests by route">
            <ul className="space-y-1 text-sm">{routes.map((r) => <li key={r.k} className="flex justify-between"><RouteBadge route={r.k as Route} /><span className="font-semibold">{r.n}</span></li>)}</ul>
            <p className="mt-2 text-xs text-slate-500">Only R5 requests get the full business case. Other routes exit to the right team and stay in the register.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
