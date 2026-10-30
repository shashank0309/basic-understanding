import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { canSeeRequest, currentUser } from "@/lib/session";
import { date } from "@/lib/format";
import { Badge, Notice, RouteBadge, StatusBadge, Tabs } from "@/components/ui";
import { OverviewTab } from "@/components/request/OverviewTab";
import { RouteTab } from "@/components/request/RouteTab";
import { MapTab } from "@/components/request/MapTab";
import { ValueTab } from "@/components/request/ValueTab";
import { DesignTab } from "@/components/request/DesignTab";
import { CaseTab } from "@/components/request/CaseTab";
import { ApprovalsTab } from "@/components/request/ApprovalsTab";
import { TrackingTab } from "@/components/request/TrackingTab";
import { AuditTab } from "@/components/request/AuditTab";

const STEPS = [
  { n: 1, label: "Submit", done: (s: string) => s !== "DRAFT" },
  { n: 2, label: "Sort & route", done: (s: string, r: string | null) => !!r },
  { n: 3, label: "Map & reuse", done: (s: string) => ["ALIGNED", "VALUED", "DESIGNED", "IN_APPROVAL", "APPROVED", "APPROVED_POC", "REJECTED", "MORE_DATA", "IN_DELIVERY", "LIVE", "VALUE_TRACKED"].includes(s) },
  { n: 4, label: "Simulate & value", done: (s: string) => ["VALUED", "DESIGNED", "IN_APPROVAL", "APPROVED", "APPROVED_POC", "REJECTED", "MORE_DATA", "IN_DELIVERY", "LIVE", "VALUE_TRACKED"].includes(s) },
  { n: 5, label: "Design & cost", done: (s: string) => ["DESIGNED", "IN_APPROVAL", "APPROVED", "APPROVED_POC", "REJECTED", "MORE_DATA", "IN_DELIVERY", "LIVE", "VALUE_TRACKED"].includes(s) },
  { n: 6, label: "Case & approval", done: (s: string) => ["APPROVED", "APPROVED_POC", "REJECTED", "IN_DELIVERY", "LIVE", "VALUE_TRACKED"].includes(s) },
  { n: 7, label: "Track value", done: (s: string) => s === "VALUE_TRACKED" },
];

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  const r = await db.request.findUnique({ where: { id }, include: { function: true, cluster: true } });
  if (!r) notFound();
  if (!canSeeRequest(user, r)) return <Notice tone="red">You can see only requests from your own function.</Notice>;
  const users = await db.user.findMany();
  const name = (uid: string | null) => users.find((u) => u.id === uid)?.name ?? "–";
  const merged = r.mergedIntoId ? await db.request.findUnique({ where: { id: r.mergedIntoId } }) : null;
  const tab = sp.tab ?? "overview";
  const fullFlow = r.route === "R5_CUSTOM_AI" || (!r.route && r.proposedRoute === "R5_CUSTOM_AI");
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "route", label: "Similar & route" },
    { key: "map", label: "Process map & reuse" },
    { key: "value", label: "Simulation & value" },
    { key: "design", label: "Design & cost" },
    { key: "case", label: "Business case" },
    { key: "approvals", label: "Approvals" },
    { key: "tracking", label: "Value tracking" },
    { key: "audit", label: "Audit trail" },
  ];
  const sites = parse<string[]>(r.sites, []);
  return (
    <div className="space-y-4">
      <div className="text-sm"><Link href="/register">← Register</Link></div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{r.code} · {r.function.name}{sites.length ? ` · ${sites.join(", ")}` : ""}</div>
          <h1>{r.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={r.status} /> <RouteBadge route={r.route ?? r.proposedRoute} />{!r.route && r.proposedRoute && <span className="text-xs text-slate-500">(proposed)</span>}
            {r.approvalLevel && <Badge tone="amber">Level {r.approvalLevel}</Badge>}
            {r.gxp && <Badge tone="red">GxP</Badge>}
            {r.cluster && <Badge tone="blue">Cluster: {r.cluster.name}</Badge>}
            <span className="text-slate-500">Requester: {name(r.requesterId)} · Owner: {name(r.ownerId)} · Created {date(r.createdAt)}</span>
          </div>
        </div>
      </div>
      {merged && <Notice tone="amber">This request is merged into <Link href={`/requests/${merged.id}`}>{merged.code} {merged.title}</Link>.</Notice>}
      {r.route && r.route !== "R5_CUSTOM_AI" && <Notice>Route {r.route.slice(0, 2)}: this request exits the full assessment and goes to <strong>{r.exitTeam || "the right team"}</strong>. It stays in the register.{r.route === "R2_EXTEND" ? " Fast route: it can go straight to Level 1 approval." : ""}</Notice>}
      <ol className="no-print grid grid-cols-7 gap-1 text-center text-[11px]" aria-label="Status timeline">
        {STEPS.map((s) => {
          const ok = s.done(r.status, r.route);
          const skipped = !fullFlow && s.n >= 3 && s.n <= 5 && !ok;
          return <li key={s.n} className={`rounded px-1 py-1.5 ${ok ? "bg-brand text-white" : skipped ? "bg-slate-100 text-slate-400 line-through" : "bg-slate-200 text-slate-600"}`}>{s.n}. {s.label}</li>;
        })}
      </ol>
      {sp.error && <Notice tone="red">{sp.error}</Notice>}
      <div>
        <Tabs tabs={tabs} active={tab} base={`/requests/${id}`} />
        <div className="rounded-b-lg rounded-tr-lg border border-t-0 border-slate-200 bg-white p-4">
          {tab === "overview" && <OverviewTab id={id} user={user} />}
          {tab === "route" && <RouteTab id={id} user={user} isNew={!!sp.new} />}
          {tab === "map" && <MapTab id={id} user={user} />}
          {tab === "value" && <ValueTab id={id} user={user} />}
          {tab === "design" && <DesignTab id={id} user={user} />}
          {tab === "case" && <CaseTab id={id} user={user} />}
          {tab === "approvals" && <ApprovalsTab id={id} user={user} />}
          {tab === "tracking" && <TrackingTab id={id} user={user} />}
          {tab === "audit" && <AuditTab id={id} />}
        </div>
      </div>
    </div>
  );
}
