import Link from "next/link";
import { db } from "@/lib/db";
import { daysSince } from "@/lib/format";
import { Badge, Card, ConfidenceBadge, Empty, RouteBadge } from "@/components/ui";

export default async function Triage() {
  const reqs = await db.request.findMany({ where: { status: "SUBMITTED", mergedIntoId: null }, include: { function: true, similar: { orderBy: { score: "desc" } }, cluster: true }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-4">
      <div><h1>Triage queue</h1><p className="muted">New requests with the proposed route and possible duplicates. Open a request to confirm the route, merge it or create a cluster.</p></div>
      {reqs.length ? (
        <Card>
          <table className="table">
            <thead><tr><th>Request</th><th>Function</th><th>Proposed route</th><th>Similar items</th><th>Waiting</th><th /></tr></thead>
            <tbody>{reqs.map((r) => {
              const dup = r.similar.filter((s) => s.targetType === "REQUEST" && s.score >= 0.35);
              return (
                <tr key={r.id}>
                  <td><div className="font-medium">{r.code} {r.title}</div><div className="text-xs text-slate-500">{r.problemStatement.slice(0, 110)}…</div></td>
                  <td>{r.function.name}</td>
                  <td><RouteBadge route={r.proposedRoute} /> <ConfidenceBadge c={r.routeConfidence} /></td>
                  <td>{dup.length ? <Badge tone="amber">{dup.length} likely duplicate(s)</Badge> : <span className="muted">none</span>}{r.cluster && <Badge tone="blue">{r.cluster.name}</Badge>}</td>
                  <td>{daysSince(r.createdAt)} days</td>
                  <td><Link className="btn btn-sm" href={`/requests/${r.id}?tab=route`}>Review</Link></td>
                </tr>
              );
            })}</tbody>
          </table>
        </Card>
      ) : <Empty>The triage queue is empty.</Empty>}
    </div>
  );
}
