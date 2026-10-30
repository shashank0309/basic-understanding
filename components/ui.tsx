import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABELS } from "@/lib/constants";
import { ROUTE_LABELS, type Route } from "@/lib/routing/rules";

export function Card({ title, children, actions, className = "" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2>{title}</h2>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES: Record<string, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  brand: "bg-brand-light text-brand-dark ring-teal-200",
};

export function Badge({ children, tone = "gray", title }: { children: ReactNode; tone?: keyof typeof TONES; title?: string }) {
  return <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  DRAFT: "gray", SUBMITTED: "blue", ROUTED: "blue", IN_ASSESSMENT: "violet", ALIGNED: "violet", VALUED: "violet", DESIGNED: "violet",
  IN_APPROVAL: "amber", APPROVED: "green", APPROVED_POC: "green", REJECTED: "red", MORE_DATA: "amber", IN_DELIVERY: "brand",
  LIVE: "green", VALUE_TRACKED: "green", CLOSED_EXITED: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function RouteBadge({ route }: { route: string | null | undefined }) {
  if (!route) return <span className="muted">–</span>;
  const tone = route === "R5_CUSTOM_AI" ? "violet" : route === "R2_EXTEND" ? "brand" : "gray";
  return <Badge tone={tone}>{ROUTE_LABELS[route as Route] ?? route}</Badge>;
}

export function ConfidenceBadge({ c }: { c: string | undefined }) {
  const v = c ?? "MEDIUM";
  return <Badge tone={v === "HIGH" ? "green" : v === "LOW" ? "red" : "amber"} title="Confidence">{v.toLowerCase()}</Badge>;
}

const SOURCE_LABEL: Record<string, string> = { USER: "User", BENCHMARK: "Benchmark", SYSTEM_DATA: "System data", FINANCE: "Finance" };
export function SourceTag({ source, note, confidence }: { source?: string; note?: string; confidence?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
      <span className="rounded bg-slate-100 px-1 py-0.5 font-medium text-slate-600">{SOURCE_LABEL[source ?? ""] ?? source ?? "?"}</span>
      {confidence && <ConfidenceBadge c={confidence} />}
      {note ? <span title={note} className="max-w-[16rem] truncate">{note}</span> : <span className="text-red-600">no source note</span>}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function Tabs({ tabs, active, base }: { tabs: { key: string; label: string; badge?: ReactNode }[]; active: string; base: string }) {
  return (
    <nav className="no-print -mb-px flex flex-wrap gap-1 border-b border-slate-200" aria-label="Tabs">
      {tabs.map((t) => (
        <Link key={t.key} href={`${base}?tab=${t.key}`} aria-current={t.key === active ? "page" : undefined}
          className={`rounded-t-md border px-3 py-2 text-sm no-underline hover:no-underline ${t.key === active ? "border-slate-200 border-b-white bg-white font-semibold text-slate-900" : "border-transparent text-slate-600 hover:bg-slate-100"}`}>
          {t.label} {t.badge}
        </Link>
      ))}
    </nav>
  );
}

export function Notice({ tone = "blue", children }: { tone?: "blue" | "amber" | "red" | "green"; children: ReactNode }) {
  const c = { blue: "border-sky-200 bg-sky-50 text-sky-900", amber: "border-amber-200 bg-amber-50 text-amber-900", red: "border-red-200 bg-red-50 text-red-900", green: "border-emerald-200 bg-emerald-50 text-emerald-900" }[tone];
  return <div className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>;
}
