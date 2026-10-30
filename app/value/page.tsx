import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser, canSeeFinance } from "@/lib/session";
import { inr } from "@/lib/format";
import { loadValue } from "@/lib/services/value";
import { LEVER_NAMES } from "@/lib/value/levers";
import { PATTERN_LABELS, STATUS_LABELS } from "@/lib/constants";
import { ExpectedActualChart } from "@/components/charts";
import { Badge, Card, Empty, Notice, Stat } from "@/components/ui";

const PORTFOLIO = ["APPROVED", "APPROVED_POC", "IN_DELIVERY", "LIVE", "VALUE_TRACKED"];

export default async function ValueDashboard() {
  const user = await currentUser();
  if (!canSeeFinance(user)) return <Notice>The value dashboard is for Finance, the Council, the Digital head and the factory pod.</Notice>;
  const reqs = await db.request.findMany({ where: { status: { in: PORTFOLIO } }, include: { function: true, actuals: true, steps: true } });
  const rows = await Promise.all(reqs.map(async (r) => ({ r, v: await loadValue(r.id) })));
  const tracked = rows.filter((x) => x.r.actuals.length);
  const latest = (r: (typeof reqs)[number]) => {
    const per = new Map<string, { expected: number; actual: number; period: string }>();
    for (const a of r.actuals.sort((x, y) => x.period.localeCompare(y.period))) per.set(a.leverKey, { expected: a.expected, actual: a.actualValue, period: a.period });
    return [...per.entries()];
  };
  const expectedAnnual = tracked.reduce((a, x) => a + latest(x.r).reduce((s, [, v]) => s + v.expected, 0), 0);
  const realizedAnnual = tracked.reduce((a, x) => a + latest(x.r).reduce((s, [, v]) => s + v.actual, 0), 0);
  const byFunction = new Map<string, { expected: number; actual: number }>();
  const byLever = new Map<string, { expected: number; actual: number }>();
  for (const x of tracked) for (const [lever, v] of latest(x.r)) {
    const f = byFunction.get(x.r.function.name) ?? { expected: 0, actual: 0 };
    f.expected += v.expected; f.actual += v.actual; byFunction.set(x.r.function.name, f);
    const l = byLever.get(lever) ?? { expected: 0, actual: 0 };
    l.expected += v.expected; l.actual += v.actual; byLever.set(lever, l);
  }
  // Estimate accuracy per AI pattern and period (feeds benchmark learning).
  const acc = new Map<string, { M3: number[]; M6: number[]; M12: number[] }>();
  for (const x of tracked) {
    const patterns = [...new Set(x.r.steps.map((s) => s.aiPattern).filter(Boolean) as string[])];
    for (const a of x.r.actuals) for (const p of patterns.length ? patterns : ["OTHER"]) {
      const e = acc.get(p) ?? { M3: [], M6: [], M12: [] };
      if (a.expected) e[a.period as "M3"].push(a.actualValue / a.expected);
      acc.set(p, e);
    }
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
  const portfolioBenefit = rows.reduce((a, x) => a + x.v.result.totalBenefit, 0);
  const portfolioTco = rows.reduce((a, x) => a + x.v.result.tco, 0);
  return (
    <div className="space-y-4">
      <div><h1>Value dashboard</h1><p className="muted">Expected vs. realized value for approved use cases. Actuals improve future estimates.</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Approved use cases" value={rows.length} hint={`${tracked.length} with actuals`} />
        <Stat label="Expected 5-yr benefit (portfolio)" value={inr(portfolioBenefit)} />
        <Stat label="Portfolio TCO" value={inr(portfolioTco)} />
        <Stat label="Expected annual (tracked)" value={inr(expectedAnnual)} />
        <Stat label="Realized annual (tracked)" value={inr(realizedAnnual)} hint={expectedAnnual ? `${Math.round((realizedAnnual / expectedAnnual) * 100)}% of expected` : ""} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Expected vs. realized by use case (latest check-in, annualized)">
          {tracked.length ? <ExpectedActualChart data={tracked.map((x) => ({ name: x.r.code, expected: Math.round(latest(x.r).reduce((s, [, v]) => s + v.expected, 0)), actual: Math.round(latest(x.r).reduce((s, [, v]) => s + v.actual, 0)) }))} /> : <Empty>No actuals yet.</Empty>}
        </Card>
        <Card title="Estimate accuracy by AI pattern">
          <table className="table">
            <thead><tr><th>Pattern</th><th className="text-right">M3</th><th className="text-right">M6</th><th className="text-right">M12</th></tr></thead>
            <tbody>{[...acc.entries()].map(([p, e]) => <tr key={p}><td>{PATTERN_LABELS[p] ?? p}</td><td className="text-right">{pct(avg(e.M3))}</td><td className="text-right">{pct(avg(e.M6))}</td><td className="text-right">{pct(avg(e.M12))}</td></tr>)}</tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">100% = actual equals the estimate. Admins use these results to adjust the <Link href="/admin?tab=benchmarks">benchmarks</Link>.</p>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By function">
          <table className="table"><thead><tr><th>Function</th><th className="text-right">Expected</th><th className="text-right">Realized</th><th className="text-right">%</th></tr></thead>
            <tbody>{[...byFunction.entries()].map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right">{inr(v.expected)}</td><td className="text-right">{inr(v.actual)}</td><td className="text-right">{pct(v.expected ? v.actual / v.expected : null)}</td></tr>)}</tbody></table>
        </Card>
        <Card title="By lever">
          <table className="table"><thead><tr><th>Lever</th><th className="text-right">Expected</th><th className="text-right">Realized</th><th className="text-right">%</th></tr></thead>
            <tbody>{[...byLever.entries()].map(([k, v]) => <tr key={k}><td>{LEVER_NAMES[k]}</td><td className="text-right">{inr(v.expected)}</td><td className="text-right">{inr(v.actual)}</td><td className="text-right">{pct(v.expected ? v.actual / v.expected : null)}</td></tr>)}</tbody></table>
        </Card>
      </div>
      <Card title="Portfolio">
        <table className="table">
          <thead><tr><th>Use case</th><th>Function</th><th>Status</th><th className="text-right">Expected 5-yr benefit</th><th className="text-right">TCO</th><th className="text-right">Net</th><th>Tracking</th></tr></thead>
          <tbody>{rows.map(({ r, v }) => {
            const l = latest(r);
            const ratio = l.length ? l.reduce((s, [, x]) => s + x.actual, 0) / Math.max(1, l.reduce((s, [, x]) => s + x.expected, 0)) : null;
            return <tr key={r.id}><td><Link href={`/requests/${r.id}?tab=tracking`}>{r.code} {r.title}</Link></td><td>{r.function.name}</td><td>{STATUS_LABELS[r.status]}</td><td className="text-right">{inr(v.result.totalBenefit)}</td><td className="text-right">{inr(v.result.tco)}</td><td className="text-right">{inr(v.result.netValue)}</td><td>{ratio === null ? <span className="muted">–</span> : <Badge tone={ratio >= 0.9 ? "green" : ratio >= 0.7 ? "amber" : "red"}>{Math.round(ratio * 100)}% of plan</Badge>}</td></tr>;
          })}</tbody>
        </table>
      </Card>
    </div>
  );
}
