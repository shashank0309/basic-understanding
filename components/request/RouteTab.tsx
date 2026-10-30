import Link from "next/link";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { hasRole, type CurrentUser } from "@/lib/session";
import { ROUTE_LABELS, ROUTE_TEAMS, type Answer, type Route, type RouteProposal } from "@/lib/routing/rules";
import { confirmRoute, createCluster, joinCluster, linkRelated, mergeInto, rerunTriage, saveFastRoute } from "@/app/actions/request";
import { SubmitButton } from "../SubmitButton";
import { Badge, Card, ConfidenceBadge, Empty, Notice, RouteBadge, StatusBadge } from "../ui";

const QUESTIONS = [
  ["q1", "Q1 · Can an AI function in current enterprise software solve it?", "R1_EMBEDDED"],
  ["q2", "Q2 · Can a current platform, agent or solution solve it (configuration or small extension)?", "R2_EXTEND"],
  ["q3", "Q3 · Is the process on paper / Excel / email, so it must be digital first?", "R3_APP"],
  ["q4", "Q4 · Does the user only need data or a report?", "R4_DATA"],
] as const;

export async function RouteTab({ id, user, isNew }: { id: string; user: CurrentUser; isNew: boolean }) {
  const r = await db.request.findUniqueOrThrow({ where: { id }, include: { similar: { orderBy: { score: "desc" } } } });
  const pod = hasRole(user, "POD_ANALYST");
  const reqIds = r.similar.filter((s) => s.targetType === "REQUEST").map((s) => s.targetId);
  const [reqs, assets, clusters] = await Promise.all([
    db.request.findMany({ where: { id: { in: reqIds } }, include: { cluster: true, function: true } }),
    db.asset.findMany({ where: { id: { in: r.similar.filter((s) => s.targetType === "ASSET").map((s) => s.targetId) } } }),
    db.cluster.findMany({ include: { _count: { select: { requests: true } } } }),
  ]);
  // Wider SOP-style duplicate list for cluster creation (all requests ≥ 35% similar).
  const answers = parse<RouteProposal["answers"] & { rules?: RouteProposal }>(r.routeAnswers, {} as RouteProposal["answers"]);
  const fast = parse<{ pilotPlan?: string; owner?: string; date?: string }>(r.fastRoute, {});
  const proposed = (r.proposedRoute ?? "R5_CUSTOM_AI") as Route;
  const clusterCandidates = reqs.filter((x) => !x.clusterId && r.similar.find((s) => s.targetId === x.id)!.score >= 0.35);
  const allSimilar = await similarRequestsWide(id);
  return (
    <div className="space-y-4">
      {isNew && <Notice tone="green">Thank you. Your request is in the register. We checked it for similar items and proposed a route. A pod analyst will confirm it.</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="2a · Similar requests and assets" actions={pod ? <form action={rerunTriage}><input type="hidden" name="id" value={id} /><SubmitButton className="btn-secondary btn-sm" pending="Checking…">Run check again</SubmitButton></form> : null}>
          {r.similar.length ? (
            <ul className="divide-y divide-slate-100">
              {r.similar.map((s) => {
                const t = s.targetType === "REQUEST" ? reqs.find((x) => x.id === s.targetId) : null;
                const a = s.targetType === "ASSET" ? assets.find((x) => x.id === s.targetId) : null;
                return (
                  <li key={s.id} className="py-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge tone={s.targetType === "ASSET" ? "brand" : "gray"}>{s.targetType === "ASSET" ? "Asset" : "Request"}</Badge>{" "}
                        {t ? <Link href={`/requests/${t.id}`}>{t.code} {t.title}</Link> : <Link href="/admin?tab=assets">{a?.name}</Link>}
                        <div className="text-xs text-slate-500">{s.reason}</div>
                        {t && <div className="mt-1 flex gap-1"><StatusBadge status={t.status} />{t.cluster && <Badge tone="blue">{t.cluster.name}</Badge>}<span className="text-xs text-slate-500">{t.function.name}</span></div>}
                        {a && <div className="mt-1 text-xs text-slate-500">{a.type} · {a.maturity}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{Math.round(s.score * 100)}%</div>
                        <div className="h-1.5 w-16 rounded bg-slate-100"><div className="h-1.5 rounded bg-brand" style={{ width: `${Math.min(100, s.score * 100)}%` }} /></div>
                      </div>
                    </div>
                    {pod && t && !r.mergedIntoId && (
                      <div className="mt-1 flex gap-2">
                        <form action={mergeInto}><input type="hidden" name="id" value={id} /><input type="hidden" name="target" value={t.id} /><SubmitButton className="btn-secondary btn-sm" confirm={`Merge this request into ${t.code}?`}>Merge into</SubmitButton></form>
                        <form action={linkRelated}><input type="hidden" name="id" value={id} /><input type="hidden" name="target" value={t.id} /><SubmitButton className="btn-secondary btn-sm">Link as related</SubmitButton></form>
                        {t.clusterId && t.clusterId !== r.clusterId && <form action={joinCluster}><input type="hidden" name="id" value={id} /><input type="hidden" name="clusterId" value={t.clusterId} /><SubmitButton className="btn-secondary btn-sm">Join its cluster</SubmitButton></form>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <Empty>No similarity check yet.</Empty>}
        </Card>

        <Card title="Cluster">
          {r.clusterId ? (
            <div className="space-y-2 text-sm">
              <p>This request is in cluster <strong>{clusters.find((c) => c.id === r.clusterId)?.name}</strong> ({clusters.find((c) => c.id === r.clusterId)?._count.requests} requests). One solution addresses the whole cluster.</p>
              <Link href="/register?view=clusters">Open cluster view</Link>
              {pod && <form action={joinCluster}><input type="hidden" name="id" value={id} /><input type="hidden" name="clusterId" value="" /><SubmitButton className="btn-secondary btn-sm">Remove from cluster</SubmitButton></form>}
            </div>
          ) : pod ? (
            <form action={createCluster} className="space-y-2">
              <input type="hidden" name="id" value={id} />
              <p className="muted">Group related requests that one solution can solve. We pre-selected requests with ≥ 35% similarity.</p>
              <div><label className="label" htmlFor="cname">Cluster name</label><input id="cname" name="name" className="input" defaultValue={suggestName(r.title, allSimilar.map((x) => x.title))} /></div>
              <div><label className="label" htmlFor="cdesc">Description</label><input id="cdesc" name="description" className="input" defaultValue={`Requests from ${allSimilar.filter((x) => x.score >= 0.35).length + 1} sites/teams about the same problem.`} /></div>
              <fieldset className="max-h-56 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 text-sm">
                <legend className="label px-1">Members</legend>
                {allSimilar.length ? allSimilar.map((x) => (
                  <label key={x.id} className="flex items-center gap-2"><input type="checkbox" name="members" value={x.id} defaultChecked={x.score >= 0.35} /> {x.code} {x.title} <span className="text-xs text-slate-500">({Math.round(x.score * 100)}%)</span></label>
                )) : <span className="muted">No unclustered similar requests.</span>}
              </fieldset>
              <SubmitButton pending="Creating…">Create cluster</SubmitButton>
              {clusters.length > 0 && <p className="text-xs text-slate-500">Or join an existing cluster:</p>}
            </form>
          ) : <p className="muted">Not in a cluster.</p>}
          {pod && !r.clusterId && clusters.length > 0 && (
            <form action={joinCluster} className="mt-2 flex gap-2"><input type="hidden" name="id" value={id} />
              <select name="clusterId" className="input" aria-label="Existing cluster">{clusters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c._count.requests})</option>)}</select>
              <SubmitButton className="btn-secondary">Join</SubmitButton>
            </form>
          )}
          {clusterCandidates.length === 0 && null}
        </Card>
      </div>

      <Card title="2b · Routing" actions={r.routeSource ? <span className="text-xs text-slate-500">Proposed by: {r.routeSource}</span> : null}>
        {r.proposedRoute ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">Proposed route: <RouteBadge route={r.proposedRoute} /> <ConfidenceBadge c={r.routeConfidence} /> {r.route && <>· Confirmed: <RouteBadge route={r.route} /></>}</div>
            <p className="text-sm">{r.routeReason}</p>
            <ol className="space-y-2">
              {QUESTIONS.map(([k, q, route]) => {
                const a = (answers as unknown as Record<string, Answer>)[k];
                return (
                  <li key={k} className={`rounded border p-2 text-sm ${a?.answer ? "border-brand bg-brand-light/40" : "border-slate-200"}`}>
                    <div className="flex justify-between gap-2"><span className="font-medium">{q}</span><Badge tone={a?.answer ? "green" : "gray"}>{a?.answer ? `Yes → ${ROUTE_LABELS[route]}` : "No"}</Badge></div>
                    {a && <div className="text-xs text-slate-600">{a.reason}</div>}
                    {a?.evidence?.length ? <ul className="mt-1 list-disc pl-5 text-xs text-slate-500">{a.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
                  </li>
                );
              })}
            </ol>
            {answers.rules && answers.rules.route !== r.proposedRoute && <p className="text-xs text-slate-500">Rule-based check says {ROUTE_LABELS[answers.rules.route]}. The AI proposal differs; please decide.</p>}
          </div>
        ) : <Empty>No route proposal yet.</Empty>}
        {pod && !r.mergedIntoId && (
          <form action={confirmRoute} className="mt-4 grid gap-2 rounded-md bg-slate-50 p-3 md:grid-cols-4">
            <input type="hidden" name="id" value={id} />
            <div><label className="label" htmlFor="route">Confirm route</label><select id="route" name="route" defaultValue={r.route ?? proposed} className="input">{Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v} – {ROUTE_TEAMS[k as Route]}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label" htmlFor="reason">Reason (required if you change the route)</label><input id="reason" name="reason" className="input" placeholder={r.routeReason} /></div>
            <div className="flex items-end"><SubmitButton pending="Saving…">{r.route ? "Update route" : "Confirm route"}</SubmitButton></div>
          </form>
        )}
      </Card>

      {(r.route === "R2_EXTEND" || (!r.route && r.proposedRoute === "R2_EXTEND")) && (
        <Card title="Fast route (R2): pilot in 1–2 weeks">
          <form action={saveFastRoute} className="grid gap-2 md:grid-cols-4">
            <input type="hidden" name="id" value={id} />
            <div className="md:col-span-2"><label className="label">Pilot plan</label><input name="pilotPlan" defaultValue={fast.pilotPlan} className="input" disabled={!pod} /></div>
            <div><label className="label">Owner</label><input name="owner" defaultValue={fast.owner} className="input" disabled={!pod} /></div>
            <div><label className="label">Pilot start</label><input type="date" name="date" defaultValue={fast.date} className="input" disabled={!pod} /></div>
            {pod && <div><SubmitButton className="btn-secondary">Save fast route</SubmitButton></div>}
          </form>
          <p className="mt-2 text-xs text-slate-500">R2 requests can go straight to Level 1 approval. Add the small cost on the Design & cost tab, then submit on the Approvals tab.</p>
        </Card>
      )}
    </div>
  );
}

async function similarRequestsWide(id: string) {
  const { cosine } = await import("@/lib/similarity/cosine");
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  const v = parse<number[]>(r.embedding, []);
  const others = await db.request.findMany({ where: { id: { not: id }, clusterId: null, mergedIntoId: null, status: { notIn: ["CLOSED_EXITED", "REJECTED"] } } });
  return others.map((o) => ({ id: o.id, code: o.code, title: o.title, score: cosine(v, parse<number[]>(o.embedding, [])) })).filter((o) => o.score >= 0.2).sort((a, b) => b.score - a.score).slice(0, 15);
}

function suggestName(title: string, others: string[]) {
  const words = [title, ...others].join(" ").toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
  const stop = new Set(["the", "and", "for", "with", "our", "from", "against", "across", "reduce", "speed"]);
  const freq = new Map<string, number>();
  words.filter((w) => !stop.has(w)).forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => (w === "sop" || w === "sops" ? "SOP" : w));
  return top.length ? `${top.join(" ")} – shared solution`.replace(/^./, (c) => c.toUpperCase()) : "New cluster";
}
