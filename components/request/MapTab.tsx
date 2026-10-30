import Link from "next/link";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { hasRole, type CurrentUser } from "@/lib/session";
import { dateTime } from "@/lib/format";
import { addStep, alignMap, rerunReuse, runMapping, toggleReuse } from "@/app/actions/request";
import { SubmitButton } from "../SubmitButton";
import { Badge, Card, Empty, Notice } from "../ui";
import { ProcessMapEditor } from "./ProcessMapEditor";

export async function MapTab({ id, user }: { id: string; user: CurrentUser }) {
  const r = await db.request.findUniqueOrThrow({ where: { id }, include: { steps: { orderBy: { order: "asc" } }, reuse: { include: { asset: true }, orderBy: { fitScore: "desc" } } } });
  const pod = hasRole(user, "POD_ANALYST");
  const canEdit = pod || r.requesterId === user.id || hasRole(user, "ARCHITECT");
  const sources = parse<{ id: string; title: string }[]>(r.mapSources, []);
  const gaps = parse<string[]>(r.mapGaps, []);
  const docs = await db.processDocument.findMany({ select: { id: true, title: true } });
  const aligner = r.mapAlignedBy ? await db.user.findUnique({ where: { id: r.mapAlignedBy } }) : null;
  const steps = r.steps.map((s) => ({ ...s, painPoints: parse<string[]>(s.painPoints, []), docTitle: docs.find((d) => s.citation.startsWith(d.id))?.title }));
  const sig = steps.map((s) => `${s.id}${s.order}${s.name}${s.aiOpportunity}${s.minutesPerOccurrence}${s.aiMinutes}`).join("|");
  if (r.route && r.route !== "R5_CUSTOM_AI" && !steps.length) return <Empty>This request is on route {r.route.slice(0, 2)}. The full process mapping is only for custom AI (R5) requests.</Empty>;
  return (
    <div className="space-y-4">
      <Card title="Process map" actions={canEdit ? <form action={runMapping}><input type="hidden" name="id" value={id} /><SubmitButton className={steps.length ? "btn-secondary btn-sm" : "btn"} pending="Reading process documents…" confirm={steps.length ? "This replaces the current map and your edits. Continue?" : undefined}>{steps.length ? "Build map again" : "Build process map"}</SubmitButton></form> : null}>
        {steps.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {sources.length ? <>Built from: {sources.map((s) => <Link key={s.id} href={`/docs/${s.id}`} className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{s.id} · {s.title}</Link>)}</> : <Badge tone="amber">No process document – built from the interview</Badge>}
              {r.mapGeneratedBy && <span className="text-xs text-slate-500">Drafted by: {r.mapGeneratedBy}</span>}
            </div>
            {gaps.length > 0 && <Notice tone="amber"><strong>Gaps:</strong><ul className="list-disc pl-5">{gaps.map((g, i) => <li key={i}>{g}</li>)}</ul></Notice>}
            <ProcessMapEditor key={sig} requestId={id} steps={steps} canEdit={canEdit} />
            {canEdit && <form action={addStep} className="flex gap-2"><input type="hidden" name="id" value={id} /><input name="name" className="input max-w-sm" placeholder="New step name" aria-label="New step name" /><SubmitButton className="btn-secondary">Add step</SubmitButton></form>}
          </div>
        ) : <Empty>No process map yet. Click “Build process map”. The system reads the process documents (SOPs and process descriptions). If none fits, it uses your intake answers.</Empty>}
      </Card>

      <Card title="Reuse options from the asset catalogue" actions={steps.length && (pod || hasRole(user, "ARCHITECT")) ? <form action={rerunReuse}><input type="hidden" name="id" value={id} /><SubmitButton className="btn-secondary btn-sm">Match again</SubmitButton></form> : null}>
        {r.reuse.length ? (
          <table className="table">
            <thead><tr><th>Use</th><th>Asset</th><th>Mode</th><th>Fit</th><th>Reason</th></tr></thead>
            <tbody>{r.reuse.map((o) => (
              <tr key={o.id}>
                <td>{pod || hasRole(user, "ARCHITECT") ? <form action={toggleReuse}><input type="hidden" name="reuseId" value={o.id} /><SubmitButton className={o.selected ? "btn btn-sm" : "btn-secondary btn-sm"} pending="…">{o.selected ? "✓ Selected" : "Select"}</SubmitButton></form> : o.selected ? "✓" : ""}</td>
                <td><div className="font-medium">{o.asset.name}</div><div className="text-xs text-slate-500">{o.asset.type} · {o.asset.maturity}</div></td>
                <td>{pod || hasRole(user, "ARCHITECT") ? (
                  <form action={toggleReuse} className="flex gap-1"><input type="hidden" name="reuseId" value={o.id} />
                    <select name="mode" defaultValue={o.mode} className="input py-0.5 text-xs" aria-label="Mode"><option value="AS_IS">Use as-is</option><option value="AS_SKILL">Reuse as skill/component</option><option value="BUILD_NEW">Build new</option></select>
                    <SubmitButton className="btn-secondary btn-sm" pending="…">Set</SubmitButton></form>
                ) : o.mode}</td>
                <td>{Math.round(o.fitScore * 100)}%</td>
                <td className="text-xs">{o.reason}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty>Reuse options appear after the process map is built.</Empty>}
      </Card>

      {steps.length > 0 && (
        <Card title="Checkpoint: process map aligned">
          {r.mapAlignedAt ? <Notice tone="green">Aligned by {aligner?.name} on {dateTime(r.mapAlignedAt)}. Next: <Link href={`/requests/${id}?tab=value`}>Simulation & value</Link>.</Notice> : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="muted">The requester confirms the steps. Then the pod analyst marks the map as aligned. This is a mandatory human checkpoint.</p>
              {pod ? <form action={alignMap}><input type="hidden" name="id" value={id} /><SubmitButton>Mark as aligned</SubmitButton></form> : <Badge tone="amber">Waiting for the pod analyst</Badge>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
