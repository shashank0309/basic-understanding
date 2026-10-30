import { db } from "@/lib/db";
import { canSeeFinance, hasRole, type CurrentUser } from "@/lib/session";
import { inr, num } from "@/lib/format";
import { governanceCheck } from "@/lib/services/design";
import { loadValue } from "@/lib/services/value";
import { determineLevel, LEVEL_INFO } from "@/lib/approval/levels";
import { getThresholds } from "@/lib/settings";
import { addCostItem, markDesigned, removeCostItem, runArchitecture, saveArchitecture, updateRisk } from "@/app/actions/request";
import { SubmitButton } from "../SubmitButton";
import { Mermaid } from "../Mermaid";
import { Badge, Card, Empty, Notice, Stat } from "../ui";

export async function DesignTab({ id, user }: { id: string; user: CurrentUser }) {
  const r = await db.request.findUniqueOrThrow({ where: { id }, include: { reuse: { where: { selected: true }, include: { asset: true } } } });
  const [cards, v, t] = await Promise.all([db.componentCostCard.findMany({ orderBy: { category: "asc" } }), loadValue(id), getThresholds()]);
  const arch = hasRole(user, "ARCHITECT", "POD_ANALYST");
  const reviews = governanceCheck(r);
  const level = determineLevel({ route: r.route, tco: v.result.tco, gxp: r.gxp, personalData: r.personalData, externalUsers: r.externalUsers, highRiskFlags: v.flags.filter((f) => f.highRisk).map((f) => f.code) }, t);
  const sym = v.settings.currencySymbol;
  const fin = canSeeFinance(user);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Governance pre-check">
          <form action={updateRisk} className="mb-3 flex flex-wrap items-center gap-4 text-sm">
            <input type="hidden" name="id" value={id} />
            <label><input type="checkbox" name="gxp" defaultChecked={r.gxp} disabled={!arch} /> GxP process</label>
            <label><input type="checkbox" name="personalData" defaultChecked={r.personalData} disabled={!arch} /> Patient / personal data</label>
            <label><input type="checkbox" name="externalUsers" defaultChecked={r.externalUsers} disabled={!arch} /> External users</label>
            <label className="flex items-center gap-1">Data residency <input name="dataResidency" defaultValue={r.dataResidency} className="input w-24 py-0.5" disabled={!arch} /></label>
            {arch && <SubmitButton className="btn-secondary btn-sm">Save</SubmitButton>}
          </form>
          <ul className="space-y-1 text-sm">{reviews.map((x) => <li key={x.name} className="flex items-start gap-2"><Badge tone={x.required ? "amber" : "gray"}>{x.required ? "Required" : "Not needed"}</Badge><span><strong>{x.name}</strong> – {x.reason}</span></li>)}</ul>
          {r.gxp && <Notice tone="amber">GxP process: computer system validation (CSV/CSA) is required. Add validation effort to the cost.</Notice>}
        </Card>
        <Card title="Reused assets">
          {r.reuse.length ? <ul className="space-y-1 text-sm">{r.reuse.map((o) => <li key={o.id}><strong>{o.asset.name}</strong> <Badge tone="brand">{o.mode === "AS_IS" ? "use as-is" : o.mode === "AS_SKILL" ? "reuse as skill" : "build new"}</Badge><div className="text-xs text-slate-500">{o.reason}</div></li>)}</ul> : <Empty>No asset selected. Select reuse options on the Process map tab.</Empty>}
          <p className="mt-2 text-xs text-slate-500">Reuse lowers build cost and time. The architect confirms the choice.</p>
        </Card>
      </div>

      <Card title="Cost estimate (component cost cards – demo values)">
        {fin ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Build cost (one time)" value={inr(v.costs.buildCost, sym)} />
              <Stat label="Run cost per year" value={inr(v.costs.annualRunCost, sym)} />
              <Stat label={`${v.model.factors.horizonYears}-year TCO`} value={inr(v.result.tco, sym)} hint="Build + years × run" />
              <Stat label="Net value" value={inr(v.result.netValue, sym)} hint={`ROI ${v.result.roi.toFixed(1)}×`} />
              <Stat label="Payback" value={v.result.paybackMonth === null ? "Not in horizon" : `${v.result.paybackMonth} months`} />
            </div>
            <table className="table">
              <thead><tr><th>Component</th><th>Type</th><th className="text-right">Quantity</th><th className="text-right">Unit cost</th><th className="text-right">Total</th><th>Note</th><th /></tr></thead>
              <tbody>
                {v.costs.items.map((c) => (
                  <tr key={c.id}><td>{c.component.name}</td><td>{c.oneTime ? "One time" : "Per year"}</td><td className="text-right">{num(c.quantity, 2)} {c.component.unit}</td><td className="text-right">{inr(c.unitCost, sym)}</td><td className="text-right">{inr(c.quantity * c.unitCost, sym)}</td><td className="text-xs">{c.note}</td>
                    <td>{arch && <form action={removeCostItem}><input type="hidden" name="itemId" value={c.id} /><SubmitButton className="text-xs text-red-600 underline" pending="…">remove</SubmitButton></form>}</td></tr>
                ))}
              </tbody>
            </table>
            {arch && (
              <form action={addCostItem} className="mt-3 grid gap-2 rounded bg-slate-50 p-2 md:grid-cols-6">
                <input type="hidden" name="id" value={id} />
                <div className="md:col-span-2"><label className="label">Component</label><select name="componentId" className="input">{cards.map((c) => <option key={c.id} value={c.id}>{c.name} – {inr(c.unitCostINR, sym)} / {c.unit} ({c.kind === "ONE_TIME" ? "one time" : "per year"})</option>)}</select></div>
                <div><label className="label">Quantity</label><input name="quantity" type="number" step="any" className="input" required /></div>
                <div><label className="label">Unit cost (optional)</label><input name="unitCost" type="number" step="any" className="input" placeholder="card value" /></div>
                <div><label className="label">Note</label><input name="note" className="input" /></div>
                <div className="flex items-end"><SubmitButton className="btn-secondary">Add cost</SubmitButton></div>
              </form>
            )}
            <p className="mt-2 text-sm">Approval level with these numbers: <Badge tone="amber">{level.level}</Badge> {LEVEL_INFO[level.level].approvers}. <span className="text-slate-500">{level.reasons.join(" ")}</span></p>
          </>
        ) : <Notice>Cost and value data are visible to Finance, the pod, architects and the Council.</Notice>}
      </Card>

      <Card title="Draft architecture" actions={arch ? <form action={runArchitecture}><input type="hidden" name="id" value={id} /><SubmitButton className="btn-secondary btn-sm" pending="Drafting…">{r.architecture ? "Draft again" : "Draft architecture"}</SubmitButton></form> : null}>
        {r.mermaid ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2"><p className="text-sm">{r.architecture}</p>
              {arch && (
                <details><summary className="cursor-pointer text-sm text-brand">Edit text and diagram</summary>
                  <form action={saveArchitecture} className="mt-2 space-y-2"><input type="hidden" name="id" value={id} />
                    <textarea name="architecture" defaultValue={r.architecture} className="input min-h-[100px]" aria-label="Architecture text" />
                    <textarea name="mermaid" defaultValue={r.mermaid} className="input min-h-[160px] font-mono text-xs" aria-label="Mermaid diagram" />
                    <SubmitButton>Save</SubmitButton></form></details>
              )}
            </div>
            <Mermaid code={r.mermaid} />
          </div>
        ) : <Empty>No architecture yet. The system drafts it from the process map, reuse choices and cost components.</Empty>}
      </Card>

      {arch && ["VALUED", "ALIGNED", "MORE_DATA"].includes(r.status) && (
        <form action={markDesigned} className="flex justify-end"><input type="hidden" name="id" value={id} /><SubmitButton>Design and cost done</SubmitButton></form>
      )}
    </div>
  );
}
