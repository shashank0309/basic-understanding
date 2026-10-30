import Link from "next/link";
import { db } from "@/lib/db";
import { hasRole, type CurrentUser } from "@/lib/session";
import { date, daysSince, inr } from "@/lib/format";
import { loadValue } from "@/lib/services/value";
import { LEVER_NAMES } from "@/lib/value/levers";
import { enterActual, publishItem, setDelivery } from "@/app/actions/request";
import { SubmitButton } from "../SubmitButton";
import { Badge, Card, Empty, Notice } from "../ui";

export async function TrackingTab({ id, user }: { id: string; user: CurrentUser }) {
  const r = await db.request.findUniqueOrThrow({ where: { id }, include: { actuals: true, reuse: { where: { selected: true }, include: { asset: true } } } });
  const items = await db.marketplaceItem.findMany({ where: { linkedRequestId: id } });
  const v = await loadValue(id);
  const team = hasRole(user, "POD_ANALYST", "ARCHITECT", "DIGITAL_HEAD");
  const canEnter = hasRole(user, "POD_ANALYST", "FINANCE") || r.requesterId === user.id;
  const approved = ["APPROVED", "APPROVED_POC", "IN_DELIVERY", "LIVE", "VALUE_TRACKED"].includes(r.status);
  const live = ["LIVE", "VALUE_TRACKED"].includes(r.status);
  const age = r.goLiveAt ? daysSince(r.goLiveAt) : 0;
  return (
    <div className="space-y-4">
      <Card title="Delivery">
        {!approved ? <p className="muted">Delivery starts after approval. The factory stops at the decision; the delivery team builds.</p> : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Status set by the delivery team:</span>
            {r.status === "APPROVED" || r.status === "APPROVED_POC" ? team && <form action={setDelivery}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="IN_DELIVERY" /><SubmitButton className="btn-secondary">Mark in delivery</SubmitButton></form> : null}
            {r.status === "IN_DELIVERY" && team && <form action={setDelivery}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="LIVE" /><SubmitButton>Mark live (go-live today)</SubmitButton></form>}
            {r.goLiveAt && <span>Live since {date(r.goLiveAt)} ({age} days). Value check-ins at 3 and 6 months.</span>}
          </div>
        )}
      </Card>

      <Card title="Actual vs. expected value">
        {live ? (
          <>
            {age >= 75 && !r.actuals.some((a) => a.period === "M3") && <Notice tone="amber">The 3-month check-in is due. Please enter the actual values.</Notice>}
            {r.actuals.length ? (
              <table className="table">
                <thead><tr><th>Lever</th><th>Period</th><th className="text-right">Expected (year-1, annualized)</th><th className="text-right">Actual (annualized)</th><th className="text-right">Accuracy</th><th>Note</th></tr></thead>
                <tbody>{r.actuals.sort((a, b) => a.period.localeCompare(b.period)).map((a) => {
                  const acc = a.expected ? a.actualValue / a.expected : 0;
                  return <tr key={a.id}><td>{LEVER_NAMES[a.leverKey]}</td><td>{a.period}</td><td className="text-right">{inr(a.expected)}</td><td className="text-right">{inr(a.actualValue)}</td><td className="text-right"><Badge tone={acc >= 0.9 ? "green" : acc >= 0.7 ? "amber" : "red"}>{Math.round(acc * 100)}%</Badge></td><td className="text-xs">{a.note}</td></tr>;
                })}</tbody>
              </table>
            ) : <Empty>No actual values yet.</Empty>}
            {canEnter && (
              <form action={enterActual} className="mt-3 grid gap-2 rounded bg-slate-50 p-2 md:grid-cols-6">
                <input type="hidden" name="id" value={id} />
                <div><label className="label">Lever</label><select name="leverKey" className="input">{v.result.levers.map((l) => <option key={l.key} value={l.key}>{LEVER_NAMES[l.key]} (exp. {inr(l.byYear[0])})</option>)}</select></div>
                <div><label className="label">Period</label><select name="period" className="input"><option>M3</option><option>M6</option><option>M12</option></select></div>
                <div><label className="label">Actual value (annualized INR)</label><input name="actual" type="number" step="any" className="input" required /></div>
                <div className="md:col-span-2"><label className="label">Note / source</label><input name="note" className="input" placeholder="e.g. usage logs, ticket data" /></div>
                <div className="flex items-end"><SubmitButton className="btn-secondary">Save actual</SubmitButton></div>
              </form>
            )}
            <p className="mt-2 text-xs text-slate-500">Production: usage data comes from Databricks SQL (usage logs, SuccessFactors, AD joins). Results feed the benchmark accuracy on the Value dashboard.</p>
          </>
        ) : <p className="muted">Value tracking starts at go-live.</p>}
      </Card>

      <Card title="Marketplace">
        {items.length > 0 && <ul className="mb-3 space-y-1 text-sm">{items.map((i) => <li key={i.id}><Link href={`/marketplace/${i.id}`}>{i.name}</Link> <Badge tone={i.tier === "CERTIFIED" ? "green" : i.tier === "TEAM" ? "blue" : "gray"}>{i.tier.toLowerCase()}</Badge> · used {i.usageCount}×</li>)}</ul>}
        {approved && team ? (
          <form action={publishItem} className="grid gap-2 md:grid-cols-4">
            <input type="hidden" name="id" value={id} />
            <div className="md:col-span-2"><label className="label">Name</label><input name="name" className="input" defaultValue={r.title} required /></div>
            <div><label className="label">Type</label><select name="type" className="input"><option value="AGENT">Agent</option><option value="SKILL">Skill / prompt pack</option><option value="TEMPLATE">Template</option><option value="PLATFORM_EXTENSION">Platform extension</option><option value="DATA_PRODUCT">Data product</option><option value="APPLICATION">Application</option></select></div>
            <div><label className="label">Tier</label><select name="tier" className="input"><option value="TEAM">Team</option><option value="PERSONAL">Personal</option><option value="CERTIFIED">Certified</option></select></div>
            <div className="md:col-span-2"><label className="label">Description</label><input name="description" className="input" defaultValue={r.problemStatement} /></div>
            <div><label className="label">Target tool</label><select name="targetTool" className="input"><option>Copilot</option><option>ChatGPT</option><option>Claude</option><option>Custom app</option><option>Databricks</option><option>Power BI</option></select></div>
            <div><label className="label">Based on asset</label><select name="assetId" className="input"><option value="">–</option>{r.reuse.map((o) => <option key={o.assetId} value={o.assetId}>{o.asset.name}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">How to use</label><input name="howToUse" className="input" /></div>
            <div><label className="label">Version</label><input name="version" className="input" defaultValue="1.0" /></div>
            <div><label className="label">Review date</label><input name="reviewDate" type="date" className="input" defaultValue={new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10)} /></div>
            <div className="md:col-span-2"><label className="label">Support model (Certified)</label><input name="supportModel" className="input" /></div>
            <label className="flex items-end gap-2 text-sm"><input type="checkbox" name="securityChecked" /> Security check done</label>
            <div className="flex items-end"><SubmitButton>Publish to marketplace</SubmitButton></div>
          </form>
        ) : !items.length && <p className="muted">After approval and delivery, the team publishes reusable agents, skills and templates here.</p>}
      </Card>
    </div>
  );
}
