import Link from "next/link";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { currentUser, hasRole } from "@/lib/session";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { inr } from "@/lib/format";
import { providerLabel } from "@/lib/llm/provider";
import { resetDemo, saveAsset, saveBenchmark, saveCapability, saveCard, saveDocument, saveLever, saveRate, saveSettings, saveUserRoles } from "@/app/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, Notice, Tabs } from "@/components/ui";

const TABS = [
  { key: "settings", label: "Settings & thresholds" }, { key: "levers", label: "Value levers" }, { key: "benchmarks", label: "Benchmarks" },
  { key: "rates", label: "Role cost rates" }, { key: "costs", label: "Cost cards" }, { key: "assets", label: "Asset catalogue" },
  { key: "capabilities", label: "Software capabilities" }, { key: "docs", label: "Process documents" }, { key: "users", label: "Users & roles" },
  { key: "emails", label: "Email templates" }, { key: "demo", label: "Demo data" },
];

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!hasRole(user, "ADMIN")) return <Notice tone="red">Admin only. Switch to “Admin – Platform Admin” in the top bar.</Notice>;
  const tab = sp.tab ?? "settings";
  return (
    <div className="space-y-4">
      <div><h1>Admin</h1><p className="muted">Configure the factory. All values here are demo values. AI provider: {providerLabel()} (set LLM_PROVIDER and ANTHROPIC_API_KEY in .env).</p></div>
      {sp.saved && <Notice tone="green">Saved.</Notice>}
      {sp.error && <Notice tone="red">{sp.error}</Notice>}
      <Tabs tabs={TABS} active={tab} base="/admin" />
      <div className="rounded-b-lg border border-t-0 border-slate-200 bg-white p-4">
        {tab === "settings" && <SettingsTab />}
        {tab === "levers" && <LeversTab />}
        {tab === "benchmarks" && <BenchTab />}
        {tab === "rates" && <RatesTab />}
        {tab === "costs" && <CostsTab />}
        {tab === "assets" && <AssetsTab />}
        {tab === "capabilities" && <CapTab />}
        {tab === "docs" && <DocsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "emails" && <EmailsTab />}
        {tab === "demo" && (
          <form action={resetDemo} className="space-y-2">
            <p className="text-sm">Delete all data and load the synthetic demo data again. Use this before each client showcase.</p>
            <SubmitButton className="btn-danger" pending="Resetting…" confirm="Delete all data and reload the demo data?">Reset demo data</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}

async function SettingsTab() {
  const s = await getSettings();
  const groups = ["branding", "approval", "value"];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <form key={g} action={saveSettings} className="space-y-2">
          <input type="hidden" name="tab" value="settings" />
          <h3 className="capitalize">{g}</h3>
          <div className="grid gap-2 md:grid-cols-3">
            {Object.entries(DEFAULT_SETTINGS).filter(([, v]) => v.group === g).map(([k, v]) => (
              <div key={k}><label className="label" htmlFor={k}>{v.label}</label>{k === "l2AutoApprove" ? <select id={k} name={k} defaultValue={s[k]} className="input"><option value="true">Yes</option><option value="false">No</option></select> : <input id={k} name={k} defaultValue={s[k]} className="input" />}{/Tco|Benefit/.test(k) && <span className="text-xs text-slate-500">{inr(Number(s[k]))}</span>}</div>
            ))}
          </div>
          <SubmitButton className="btn-secondary">Save {g}</SubmitButton>
        </form>
      ))}
    </div>
  );
}

async function LeversTab() {
  const levers = await db.valueLever.findMany();
  return (
    <div className="space-y-3">{levers.map((l) => (
      <form key={l.key} action={saveLever} className="grid gap-2 rounded border border-slate-200 p-2 md:grid-cols-6">
        <input type="hidden" name="key" value={l.key} />
        <div><label className="label">Key</label><code className="text-xs">{l.key}</code></div>
        <div><label className="label">Name</label><input name="name" defaultValue={l.name} className="input" /></div>
        <div className="md:col-span-2"><label className="label">Description</label><input name="description" defaultValue={l.description} className="input" /></div>
        <label className="flex items-end gap-1 text-sm"><input type="checkbox" name="enabled" defaultChecked={l.enabled} /> Enabled</label>
        <div className="flex items-end"><SubmitButton className="btn-secondary btn-sm">Save</SubmitButton></div>
        <div className="text-xs text-slate-500 md:col-span-6">Formula (code): {l.formula}</div>
      </form>
    ))}</div>
  );
}

async function BenchTab() {
  const rows = await db.benchmark.findMany();
  return (
    <div className="space-y-2">
      <p className="muted">Time reduction ranges per AI pattern. With-AI estimates outside the range get an OUT_OF_RANGE flag. See estimate accuracy on the <Link href="/value">Value dashboard</Link>.</p>
      {[...rows, null].map((r, i) => (
        <form key={r?.id ?? `new${i}`} action={saveBenchmark} className="grid gap-2 md:grid-cols-6">
          <input type="hidden" name="id" value={r?.id ?? ""} />
          <input name="pattern" defaultValue={r?.pattern} placeholder="PATTERN" className="input" aria-label="Pattern" />
          <input name="label" defaultValue={r?.label} placeholder="Label" className="input" aria-label="Label" />
          <input name="lowPct" type="number" defaultValue={r?.lowPct} placeholder="Low %" className="input" aria-label="Low %" />
          <input name="highPct" type="number" defaultValue={r?.highPct} placeholder="High %" className="input" aria-label="High %" />
          <input name="note" defaultValue={r?.note} placeholder="Note" className="input" aria-label="Note" />
          <SubmitButton className="btn-secondary btn-sm">{r ? "Save" : "Add"}</SubmitButton>
        </form>
      ))}
    </div>
  );
}

async function RatesTab() {
  const rows = await db.roleCostRate.findMany();
  return (
    <div className="space-y-2">{[...rows, null].map((r, i) => (
      <form key={r?.id ?? `n${i}`} action={saveRate} className="grid gap-2 md:grid-cols-4">
        <input type="hidden" name="id" value={r?.id ?? ""} />
        <input name="band" defaultValue={r?.band} placeholder="Role band" className="input" aria-label="Band" />
        <input name="ratePerHour" type="number" defaultValue={r?.ratePerHour} placeholder="₹ per hour" className="input" aria-label="Rate" />
        <SubmitButton className="btn-secondary btn-sm">{r ? "Save" : "Add"}</SubmitButton>
      </form>
    ))}</div>
  );
}

async function CostsTab() {
  const rows = await db.componentCostCard.findMany();
  return (
    <div className="space-y-2">{[...rows, null].map((r, i) => (
      <form key={r?.id ?? `n${i}`} action={saveCard} className="grid gap-2 md:grid-cols-7">
        <input type="hidden" name="id" value={r?.id ?? ""} />
        <input name="name" defaultValue={r?.name} placeholder="Name" className="input" aria-label="Name" />
        <input name="unit" defaultValue={r?.unit} placeholder="Unit" className="input" aria-label="Unit" />
        <input name="unitCostINR" type="number" defaultValue={r?.unitCostINR} placeholder="₹ per unit" className="input" aria-label="Unit cost" />
        <input name="category" defaultValue={r?.category} placeholder="Category" className="input" aria-label="Category" />
        <select name="kind" defaultValue={r?.kind ?? "ANNUAL"} className="input" aria-label="Kind"><option value="ANNUAL">Per year</option><option value="ONE_TIME">One time</option></select>
        <input name="notes" defaultValue={r?.notes} placeholder="Notes" className="input" aria-label="Notes" />
        <SubmitButton className="btn-secondary btn-sm">{r ? "Save" : "Add"}</SubmitButton>
      </form>
    ))}</div>
  );
}

async function AssetsTab() {
  const rows = await db.asset.findMany();
  return (
    <div className="space-y-3">{[...rows, null].map((a, i) => (
      <form key={a?.id ?? `n${i}`} action={saveAsset} className="grid gap-2 rounded border border-slate-200 p-2 md:grid-cols-6">
        <input type="hidden" name="id" value={a?.id ?? ""} />
        <div className="md:col-span-2"><label className="label">Name</label><input name="name" defaultValue={a?.name} className="input" required /></div>
        <div><label className="label">Type</label><select name="type" defaultValue={a?.type ?? "AGENT"} className="input">{["PLATFORM", "AGENT", "SKILL", "TEMPLATE", "DATA_PRODUCT", "APPLICATION", "EMBEDDED_FEATURE"].map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label">Maturity</label><select name="maturity" defaultValue={a?.maturity ?? "PILOT"} className="input"><option>PILOT</option><option>LIVE</option><option>CERTIFIED</option></select></div>
        <div><label className="label">Target tool</label><input name="targetTool" defaultValue={a?.targetTool} className="input" /></div>
        <div className="flex items-end"><SubmitButton className="btn-secondary btn-sm">{a ? "Save" : "Add asset"}</SubmitButton></div>
        <div className="md:col-span-3"><label className="label">Description</label><input name="description" defaultValue={a?.description} className="input" /></div>
        <div className="md:col-span-3"><label className="label">Capabilities (comma separated)</label><input name="capabilities" defaultValue={parse<string[]>(a?.capabilities, []).join(", ")} className="input" /></div>
        <div className="md:col-span-3"><label className="label">Functions using</label><input name="functionsUsing" defaultValue={parse<string[]>(a?.functionsUsing, []).join(", ")} className="input" /></div>
        <div className="md:col-span-3"><label className="label">Data sources</label><input name="dataSources" defaultValue={parse<string[]>(a?.dataSources, []).join(", ")} className="input" /></div>
      </form>
    ))}</div>
  );
}

async function CapTab() {
  const rows = await db.softwareCapability.findMany();
  return (
    <div className="space-y-2">
      <p className="muted">The ITBP keeps this list current. Routing question Q1 uses it.</p>
      {[...rows, null].map((c, i) => (
        <form key={c?.id ?? `n${i}`} action={saveCapability} className="grid gap-2 md:grid-cols-6">
          <input type="hidden" name="id" value={c?.id ?? ""} />
          <input name="software" defaultValue={c?.software} placeholder="Software" className="input" aria-label="Software" />
          <input name="feature" defaultValue={c?.feature} placeholder="AI feature" className="input md:col-span-2" aria-label="Feature" />
          <select name="available" defaultValue={c?.available ?? "NOW"} className="input" aria-label="Available"><option>NOW</option><option>ROADMAP</option></select>
          <input name="roadmapDate" defaultValue={c?.roadmapDate ?? ""} placeholder="Roadmap date" className="input" aria-label="Roadmap date" />
          <SubmitButton className="btn-secondary btn-sm">{c ? "Save" : "Add"}</SubmitButton>
        </form>
      ))}
    </div>
  );
}

async function DocsTab() {
  const [docs, fns] = await Promise.all([db.processDocument.findMany({ include: { _count: { select: { chunks: true } }, function: true } }), db.function.findMany()]);
  return (
    <div className="space-y-4">
      <table className="table"><thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Function</th><th>Chunks</th></tr></thead>
        <tbody>{docs.map((d) => <tr key={d.id}><td>{d.id}</td><td><Link href={`/docs/${d.id}`}>{d.title}</Link></td><td>{d.type}</td><td>{d.function?.name ?? "–"}</td><td>{d._count.chunks}</td></tr>)}</tbody></table>
      <form action={saveDocument} className="grid gap-2 rounded bg-slate-50 p-3 md:grid-cols-4">
        <h3 className="md:col-span-4">Add a process document (synthetic text only)</h3>
        <div className="md:col-span-2"><label className="label">Title</label><input name="title" className="input" /></div>
        <div><label className="label">Type</label><select name="type" className="input"><option>SOP</option><option>PROCESS_DESC</option><option>UPLOAD</option></select></div>
        <div><label className="label">Function</label><select name="functionId" className="input"><option value="">–</option>{fns.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div className="md:col-span-4"><label className="label">Upload a .txt or .md file</label><input type="file" name="file" accept=".txt,.md" className="text-sm" /></div>
        <div className="md:col-span-4"><label className="label">…or paste the text. Tip: write steps as “1. Step. (Actor: …; System: …; Time: 30 min; Frequency: 4 per month; People: 5)”.</label><textarea name="content" className="input min-h-[120px]" /></div>
        <div><SubmitButton pending="Indexing…">Add and index</SubmitButton></div>
      </form>
    </div>
  );
}

async function UsersTab() {
  const [users, fns] = await Promise.all([db.user.findMany({ where: { NOT: { id: "system" } }, orderBy: { name: "asc" } }), db.function.findMany()]);
  return (
    <div className="space-y-2">
      <p className="muted">Prototype: no real login. Production: Microsoft Entra ID SSO; roles come from Entra groups.</p>
      {users.map((u) => (
        <form key={u.id} action={saveUserRoles} className="grid items-center gap-2 border-b border-slate-100 py-2 md:grid-cols-[12rem_1fr_10rem_auto]">
          <input type="hidden" name="id" value={u.id} />
          <div className="text-sm"><div className="font-medium">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></div>
          <div className="flex flex-wrap gap-2 text-xs">{ROLES.map((r) => <label key={r} className="flex items-center gap-1"><input type="checkbox" name="roles" value={r} defaultChecked={u.roles.split(",").includes(r)} />{ROLE_LABELS[r]}</label>)}</div>
          <select name="functionId" defaultValue={u.functionId ?? ""} className="input" aria-label="Function"><option value="">–</option>{fns.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <SubmitButton className="btn-secondary btn-sm">Save</SubmitButton>
        </form>
      ))}
    </div>
  );
}

function EmailsTab() {
  const t = [
    ["TRIAGE", "[New request] {code} {title}", "A new business problem waits for triage. The system proposed a route and found similar items."],
    ["ROUTED", "[Routed] {code} {title}", "Your request goes to: {team}. {reason}"],
    ["APPROVAL_REQUEST", "[{level} approval] {code} {title}", "A Level {n} case waits for your decision. Due in {days} working days."],
    ["COUNCIL_AGENDA", "[AI Council agenda] {code} {title}", "This Level 3 case is on the agenda of the Council meeting on {date}."],
    ["DECISION", "[Decision] {code} {title}", "Decision: {outcome}. {comment}"],
    ["LIVE", "[Live] {code} {title}", "The solution is live. We will ask you for actual values at 3 and 6 months."],
  ];
  return (
    <div className="space-y-2">
      <p className="muted">Templates used by the mock email service (lib/notify). Production sends them through Microsoft Graph and Teams.</p>
      <table className="table"><thead><tr><th>Type</th><th>Subject</th><th>Body</th></tr></thead><tbody>{t.map(([k, s, b2]) => <tr key={k}><td><Badge>{k}</Badge></td><td className="text-sm">{s}</td><td className="text-sm">{b2}</td></tr>)}</tbody></table>
    </div>
  );
}
