import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { registerRows } from "@/lib/services/register";
import { STATUSES, STATUS_LABELS } from "@/lib/constants";
import { ROUTE_LABELS } from "@/lib/routing/rules";
import { inr } from "@/lib/format";
import { Badge, Card, Empty, RouteBadge, StatusBadge } from "@/components/ui";

type SP = Promise<Record<string, string | undefined>>;

export default async function Register({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await currentUser();
  const [rows, fns, clusters] = await Promise.all([registerRows(user, sp), db.function.findMany({ orderBy: { name: "asc" } }), db.cluster.findMany({ include: { requests: { include: { function: true } } } })]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const view = sp.view === "clusters" ? "clusters" : "table";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1>Register</h1><p className="muted">All requests in one place: open, in progress, exited and delivered.</p></div>
        <div className="flex gap-2">
          <Link href={`/register?${new URLSearchParams({ ...sp, view: view === "table" ? "clusters" : "table" } as Record<string, string>)}`} className="btn-secondary">{view === "table" ? "Cluster view" : "Table view"}</Link>
          <a href={`/register/export?${qs}`} className="btn-secondary">Export to Excel</a>
        </div>
      </div>
      <form className="card grid grid-cols-2 gap-2 md:grid-cols-7" method="get">
        <input type="hidden" name="view" value={view} />
        <div className="col-span-2"><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Code, title, site, requester" /></div>
        <div><label className="label" htmlFor="fn">Function</label><select id="fn" name="fn" defaultValue={sp.fn ?? ""} className="input"><option value="">All</option>{fns.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div><label className="label" htmlFor="route">Route</label><select id="route" name="route" defaultValue={sp.route ?? ""} className="input"><option value="">All</option>{Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></div>
        <div><label className="label" htmlFor="level">Level</label><select id="level" name="level" defaultValue={sp.level ?? ""} className="input"><option value="">All</option><option>L1</option><option>L2</option><option>L3</option></select></div>
        <div><label className="label" htmlFor="age">Age</label><select id="age" name="age" defaultValue={sp.age ?? ""} className="input"><option value="">All</option><option value="30">≤ 30 days</option><option value="90">31–90 days</option><option value="91">&gt; 90 days</option></select></div>
        <div><label className="label" htmlFor="minValue">Min. benefit (INR)</label><input id="minValue" name="minValue" defaultValue={sp.minValue} className="input" placeholder="e.g. 5000000" /></div>
        <div className="col-span-2 flex items-end gap-2 md:col-span-6"><button className="btn">Filter</button><Link href="/register" className="btn-secondary">Clear</Link><span className="muted self-center">{rows.length} requests</span></div>
      </form>

      {view === "clusters" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {clusters.length ? clusters.map((c) => (
            <Card key={c.id} title={c.name}>
              <p className="muted mb-2">{c.description}</p>
              <ul className="space-y-1 text-sm">{c.requests.map((r) => <li key={r.id} className="flex justify-between gap-2"><Link href={`/requests/${r.id}`}>{r.code} {r.title}</Link><StatusBadge status={r.status} /></li>)}</ul>
            </Card>
          )) : <Empty>No clusters yet. Pod analysts create clusters from the triage screen of a request.</Empty>}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>Code</th><th>Title</th><th>Function</th><th>Route</th><th>Status</th><th>Level</th><th className="text-right">5-yr benefit</th><th className="text-right">TCO</th><th>Age</th><th>Owner</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.mergedInto ? "opacity-60" : ""}>
                  <td className="whitespace-nowrap">{r.code}</td>
                  <td><Link href={`/requests/${r.id}`}>{r.title}</Link>
                    <div className="mt-0.5 flex flex-wrap gap-1">{r.cluster && <Badge tone="blue">Cluster: {r.cluster}</Badge>}{r.mergedInto && <Badge>Merged</Badge>}{r.flags > 0 && <Badge tone="red">{r.flags} flag(s)</Badge>}{r.exitTeam && <Badge>→ {r.exitTeam}</Badge>}</div></td>
                  <td>{r.function}</td>
                  <td>{r.route ? <span className={r.routeConfirmed ? "" : "opacity-70"} title={r.routeConfirmed ? "Confirmed" : "Proposed"}><RouteBadge route={r.route} />{!r.routeConfirmed && <span className="ml-1 text-[10px] text-slate-500">proposed</span>}</span> : "–"}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.level ?? "–"}</td>
                  <td className="whitespace-nowrap text-right">{r.benefit ? inr(r.benefit) : "–"}</td>
                  <td className="whitespace-nowrap text-right">{r.tco ? inr(r.tco) : "–"}</td>
                  <td className="whitespace-nowrap">{r.age} d</td>
                  <td className="whitespace-nowrap">{r.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
