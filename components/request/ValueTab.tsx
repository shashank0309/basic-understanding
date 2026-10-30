import Link from "next/link";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { canSeeFinance, hasRole, type CurrentUser } from "@/lib/session";
import { inr, num } from "@/lib/format";
import { loadValue, STEP_VALUE_FIELDS, type FieldMeta } from "@/lib/services/value";
import { FLAG_LABELS } from "@/lib/value/flags";
import { GENERAL_INPUTS, LEVERS, LEVER_NAMES } from "@/lib/value/levers";
import { getThresholds } from "@/lib/settings";
import { PATTERN_LABELS } from "@/lib/constants";
import { markValued, removeValueInput, saveJustification, updateStep, updateValueInput } from "@/app/actions/request";
import { SubmitButton } from "../SubmitButton";
import { StepChart, YearChart } from "../charts";
import { Badge, Card, ConfidenceBadge, Empty, Notice, SourceTag, Stat } from "../ui";

const FIELD_LABELS: Record<string, string> = {
  minutesPerOccurrence: "Minutes", occurrencesPerMonth: "Per month", peopleCount: "People", costPerHour: "₹ / hour",
  errorRatePct: "Error %", costPerError: "₹ / error", aiMinutes: "With-AI minutes", aiErrorRatePct: "With-AI error %",
};

function ConfSelect({ name, value }: { name: string; value?: string }) {
  return <select name={name} defaultValue={value ?? "MEDIUM"} className="input py-0.5 text-xs" aria-label="Confidence"><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select>;
}
function SourceSelect({ name, value }: { name: string; value?: string }) {
  return <select name={name} defaultValue={value ?? "USER"} className="input py-0.5 text-xs" aria-label="Source"><option value="USER">User</option><option value="BENCHMARK">Benchmark</option><option value="SYSTEM_DATA">System data</option><option value="FINANCE">Finance</option></select>;
}

export async function ValueTab({ id, user }: { id: string; user: CurrentUser }) {
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  const v = await loadValue(id, { monteCarlo: true });
  const t = await getThresholds();
  const pod = hasRole(user, "POD_ANALYST");
  const canEdit = pod || r.requesterId === user.id || hasRole(user, "FINANCE");
  const sym = v.settings.currencySymbol;
  if (!v.steps.length && !v.inputs.some((i) => i.leverKey !== "GENERAL")) {
    return <Empty>No value inputs yet. First build and align the <Link href={`/requests/${id}?tab=map`}>process map</Link>. For fast-route (R2) requests, add a cost-avoided value below.<AddLeverInput id={id} /></Empty>;
  }
  const res = v.result;
  const years = v.model.factors.horizonYears;
  let cum = -v.costs.buildCost;
  const yearData = res.byYear.map((b, i) => {
    cum += b - v.costs.annualRunCost;
    return { year: `Y${i + 1}`, benefit: Math.round(b), cost: Math.round(v.costs.annualRunCost + (i === 0 ? v.costs.buildCost : 0)), cumulative: Math.round(cum) };
  });
  const finNeeded = res.totalBenefit > t.financeMinBenefit;
  const general = v.inputs.filter((i) => i.leverKey === "GENERAL");
  const leverInputs = v.inputs.filter((i) => i.leverKey !== "GENERAL");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label={`Total benefit (${years} years)`} value={inr(res.totalBenefit, sym)} hint="With adoption ramp" />
        <Stat label="Range P10 – P90" value={v.mc ? `${inr(v.mc.total.p10, sym)} – ${inr(v.mc.total.p90, sym)}` : "–"} hint={`Monte Carlo, ${v.mc?.runs ?? 0} runs · P50 ${inr(v.mc?.total.p50, sym)}`} />
        <Stat label="Annual value (steady state)" value={inr(res.annualSteadyState, sym)} />
        <Stat label="Hours saved per year" value={num(res.hoursSavedPerYear)} hint={`${res.fteSaved.toFixed(1)} FTE equivalent`} />
        <Stat label="Cycle time per occurrence" value={`${num(res.baselineCycleMinutes)} → ${num(res.aiCycleMinutes)} min`} hint={res.baselineCycleMinutes ? `${Math.round((1 - res.aiCycleMinutes / res.baselineCycleMinutes) * 100)}% less effort` : ""} />
        {canSeeFinance(user) ? <Stat label="Net value / ROI" value={res.tco ? inr(res.netValue, sym) : "Add costs"} hint={res.tco ? `ROI ${res.roi.toFixed(1)}× · payback ${res.paybackMonth ?? "–"} months` : <Link href={`/requests/${id}?tab=design`}>Design & cost tab</Link>} /> : <Stat label="Net value" value="Finance only" />}
      </div>

      {r.claimedBenefit ? <Notice tone="amber">The requester claimed <strong>{inr(r.claimedBenefit, sym)}</strong> per year. The value engine calculates <strong>{inr(res.annualSteadyState, sym)}</strong> per year at steady state from the inputs below. Check the flags.</Notice> : null}

      <Card title={`Quality checks (${v.flags.length})`}>
        {v.flags.length ? (
          <div className="space-y-2">
            <ul className="space-y-1">{v.flags.map((fl, i) => <li key={i} className="flex items-start gap-2 text-sm"><Badge tone={fl.highRisk ? "red" : "amber"}>{FLAG_LABELS[fl.code]}</Badge><span>{fl.message}</span></li>)}</ul>
            <p className="text-xs text-slate-500">Flags do not block the case, but a flagged case needs a written justification before approval. High-risk flags (red) also block Level 1.</p>
            {canEdit ? (
              <form action={saveJustification} className="flex gap-2"><input type="hidden" name="id" value={id} />
                <textarea name="text" defaultValue={r.flagJustification} className="input" placeholder="Explain why the numbers are realistic, or what you changed." aria-label="Justification" />
                <SubmitButton className="btn-secondary self-end">Save justification</SubmitButton></form>
            ) : r.flagJustification && <p className="text-sm">Justification: {r.flagJustification}</p>}
          </div>
        ) : <Notice tone="green">No flags. The inputs are inside the benchmark ranges.</Notice>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Simulation: effort per step (hours per year)">
          <StepChart data={res.steps.map((s) => ({ name: s.name.length > 28 ? `${s.name.slice(0, 26)}…` : s.name, baseline: Math.round(s.baselineHoursPerYear), withAi: Math.round(s.aiHoursPerYear) }))} />
        </Card>
        <Card title="Benefit and cost by year">
          <YearChart data={yearData} />
          <p className="text-xs text-slate-500">Adoption ramp: Y1 {Math.round(v.model.factors.adoption[0] * 100)}%, Y2 {Math.round(v.model.factors.adoption[1] * 100)}%, Y3+ {Math.round(v.model.factors.adoption[2] * 100)}% (time saved and errors only).</p>
        </Card>
      </div>

      <Card title="Baseline vs. with AI">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>#</th><th>Step</th><th>AI</th><th className="text-right">Minutes</th><th className="text-right">Reduction</th><th className="text-right">Hours / year</th><th className="text-right">Errors / year</th><th className="text-right">Value / year (full adoption)</th></tr></thead>
            <tbody>
              {res.steps.map((s, i) => (
                <tr key={i}>
                  <td>{i + 1}</td><td>{s.name}</td>
                  <td className="text-xs">{v.steps[i].aiOpportunity === "NONE" ? "–" : `${v.steps[i].aiOpportunity.toLowerCase()} · ${PATTERN_LABELS[v.steps[i].aiPattern ?? ""] ?? ""}`}</td>
                  <td className="whitespace-nowrap text-right">{num(s.baselineMinutes, 1)} → {num(s.aiMinutes, 1)}</td>
                  <td className="text-right">{s.reductionPct ? `${Math.round(s.reductionPct)}%` : "–"}</td>
                  <td className="whitespace-nowrap text-right">{num(s.baselineHoursPerYear)} → {num(s.aiHoursPerYear)}</td>
                  <td className="whitespace-nowrap text-right">{num(s.baselineErrorsPerYear)} → {num(s.aiErrorsPerYear)}</td>
                  <td className="text-right">{inr(s.timeValueFull + s.errorValueFull, sym)}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td /><td>Total</td><td /><td className="text-right">{num(res.baselineCycleMinutes)} → {num(res.aiCycleMinutes)}</td><td /><td className="text-right">{num(res.steps.reduce((a, s) => a + s.baselineHoursPerYear, 0))} → {num(res.steps.reduce((a, s) => a + s.aiHoursPerYear, 0))}</td><td /><td className="text-right">{inr(res.steps.reduce((a, s) => a + s.timeValueFull + s.errorValueFull, 0), sym)}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Value by lever">
        <table className="table">
          <thead><tr><th>Lever</th><th className="text-right">Annual (full adoption)</th>{res.byYear.map((_, i) => <th key={i} className="text-right">Y{i + 1}</th>)}<th className="text-right">Total</th><th>Confidence</th></tr></thead>
          <tbody>{res.levers.map((l) => (
            <tr key={l.key}><td>{LEVER_NAMES[l.key]}{l.adoptionApplies && <span className="ml-1 text-[10px] text-slate-500">× adoption</span>}</td><td className="text-right">{inr(l.annualFull, sym)}</td>{l.byYear.map((y, i) => <td key={i} className="text-right">{inr(y, sym)}</td>)}<td className="text-right font-semibold">{inr(l.total, sym)}</td><td><ConfidenceBadge c={l.confidence} /></td></tr>
          ))}</tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">The LLM never calculates these numbers. Deterministic code computes them from the inputs below. Every input shows its source and confidence.</p>
      </Card>

      <Card title="Step inputs (source and confidence per number)">
        <div className="space-y-2">
          {v.steps.map((s) => {
            const meta = parse<Record<string, FieldMeta>>(s.meta, {});
            return (
              <details key={s.id} className="rounded border border-slate-200">
                <summary className="cursor-pointer list-none p-2 text-sm">
                  <span className="font-medium">{s.order}. {s.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{s.minutesPerOccurrence} min × {s.occurrencesPerMonth}/mo × {s.peopleCount} people · ₹{num(s.costPerHour)}/h · with AI {s.aiOpportunity === "NONE" ? "no change" : `${s.aiMinutes} min`}</span>
                  {STEP_VALUE_FIELDS.some((k) => !meta[k]?.note) && <Badge tone="red">missing source</Badge>}
                </summary>
                <form action={updateStep} className="border-t border-slate-100 p-2">
                  <input type="hidden" name="stepId" value={s.id} />
                  <table className="table">
                    <thead><tr><th>Input</th><th>Value</th><th>Source</th><th>Confidence</th><th>Source note</th></tr></thead>
                    <tbody>{STEP_VALUE_FIELDS.map((k) => (
                      <tr key={k}>
                        <td className="whitespace-nowrap">{FIELD_LABELS[k]}</td>
                        <td><input name={k} type="number" step="any" defaultValue={(s as unknown as Record<string, number>)[k]} className="input w-28" disabled={!canEdit} aria-label={FIELD_LABELS[k]} /></td>
                        <td><SourceSelect name={`${k}_source`} value={meta[k]?.source} /></td>
                        <td><ConfSelect name={`${k}_conf`} value={meta[k]?.confidence} /></td>
                        <td><input name={`${k}_note`} defaultValue={meta[k]?.note} className="input text-xs" placeholder="Where does this number come from?" aria-label="Source note" /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {canEdit && <div className="mt-2 flex gap-2"><input name="reason" className="input" placeholder="Reason for the change (audit trail)" aria-label="Reason" /><SubmitButton pending="Saving…">Save</SubmitButton></div>}
                </form>
              </details>
            );
          })}
        </div>
      </Card>

      <Card title="Factors and lever inputs">
        <Notice><strong>Realization factor:</strong> time saved is money only when capacity or cost really changes (for example, less overtime, fewer temps, or people do other valued work). We count only this share of the saved time as value. Default: {v.settings.defaultRealization}.</Notice>
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Input</th><th>Value</th><th>Low</th><th>High</th><th>Source</th><th>Confidence</th><th>Source note</th><th>Reason</th><th /></tr></thead>
            <tbody>
              {[...general, ...leverInputs].map((i) => (
                <tr key={i.id}>
                  <td colSpan={9} className="p-0">
                    <form action={updateValueInput} className="grid grid-cols-[minmax(10rem,1.5fr)_repeat(3,6rem)_7rem_6rem_minmax(8rem,2fr)_minmax(6rem,1fr)_auto] items-center gap-1 px-2 py-1">
                      <input type="hidden" name="id" value={id} /><input type="hidden" name="leverKey" value={i.leverKey} /><input type="hidden" name="key" value={i.key} />
                      <div className="text-sm">{i.label || i.key}<div className="text-[10px] text-slate-500">{i.leverKey === "GENERAL" ? "General factor" : LEVER_NAMES[i.leverKey]} · {i.unit}</div><SourceTag source={i.source} note={i.sourceNote} confidence={i.confidence} /></div>
                      <input name="value" type="number" step="any" defaultValue={i.value} className="input" aria-label="Value" disabled={!canEdit} />
                      <input name="low" type="number" step="any" defaultValue={i.low ?? ""} className="input" aria-label="Low" disabled={!canEdit} />
                      <input name="high" type="number" step="any" defaultValue={i.high ?? ""} className="input" aria-label="High" disabled={!canEdit} />
                      <SourceSelect name="source" value={i.source} />
                      <ConfSelect name="confidence" value={i.confidence} />
                      <input name="sourceNote" defaultValue={i.sourceNote} className="input text-xs" aria-label="Source note" />
                      <input name="reason" className="input text-xs" placeholder="Why?" aria-label="Reason" />
                      {canEdit && <span className="flex gap-1"><SubmitButton className="btn-secondary btn-sm" pending="…">Save</SubmitButton></span>}
                    </form>
                    {canEdit && i.leverKey !== "GENERAL" && <form action={removeValueInput} className="px-2 pb-1"><input type="hidden" name="inputId" value={i.id} /><SubmitButton className="text-xs text-red-600 underline" pending="…">remove</SubmitButton></form>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && <AddLeverInput id={id} />}
      </Card>

      <Card title="Checkpoints">
        <div className="space-y-2 text-sm">
          {finNeeded ? <Notice tone="amber">The {years}-year benefit ({inr(res.totalBenefit, sym)}) is above the Finance threshold ({inr(t.financeMinBenefit, sym)}). Finance must approve the value inputs. This happens as the first approval step.{r.financeApprovedAt ? " ✓ Finance approved." : ""}</Notice> : <Notice>Benefit is below the Finance threshold. No Finance review needed.</Notice>}
          {r.status === "ALIGNED" && (pod ? <form action={markValued}><input type="hidden" name="id" value={id} /><SubmitButton>Value estimate done → send to architect</SubmitButton></form> : <p className="muted">The pod analyst closes this step.</p>)}
        </div>
      </Card>
    </div>
  );
}

function AddLeverInput({ id }: { id: string }) {
  const options = [
    ...GENERAL_INPUTS.map((g) => ({ v: `GENERAL|${g.key}|${g.label}|${g.unit}`, l: `General – ${g.label}` })),
    ...LEVERS.flatMap((l) => l.inputs.map((i) => ({ v: `${l.key}|${i.key}|${i.label}|${i.unit}`, l: `${l.name} – ${i.label}` }))),
  ];
  return (
    <form action={addLeverAction} className="mt-3 grid gap-2 rounded bg-slate-50 p-2 text-left md:grid-cols-6">
      <input type="hidden" name="id" value={id} />
      <div className="md:col-span-2"><label className="label">Add an input</label><select name="pick" className="input">{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
      <div><label className="label">Value</label><input name="value" type="number" step="any" className="input" required /></div>
      <div><label className="label">Confidence</label><ConfSelect name="confidence" /></div>
      <div><label className="label">Source note</label><input name="sourceNote" className="input" /></div>
      <div className="flex items-end"><SubmitButton className="btn-secondary">Add</SubmitButton></div>
    </form>
  );
}

async function addLeverAction(fd: FormData) {
  "use server";
  const [leverKey, key, label, unit] = String(fd.get("pick")).split("|");
  fd.set("leverKey", leverKey);
  fd.set("key", key);
  fd.set("label", label);
  fd.set("unit", unit);
  fd.set("source", "USER");
  await updateValueInput(fd);
}
