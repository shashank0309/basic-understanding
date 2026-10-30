import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { canSeeFinance, hasRole, type CurrentUser } from "@/lib/session";
import { dateTime, inr } from "@/lib/format";
import type { Slides } from "@/lib/ai/schemas";
import { runBusinessCase } from "@/app/actions/request";
import { SubmitButton } from "../SubmitButton";
import { Markdown } from "../Markdown";
import { Card, Empty, Notice } from "../ui";

export async function CaseTab({ id, user }: { id: string; user: CurrentUser }) {
  const cases = await db.businessCase.findMany({ where: { requestId: id }, orderBy: { version: "desc" } });
  const pod = hasRole(user, "POD_ANALYST", "ARCHITECT");
  if (!canSeeFinance(user) && !(await db.request.count({ where: { id, requesterId: user.id } }))) return <Notice>The business case is visible to the requester, the pod, Finance and the Council.</Notice>;
  const c = cases[0];
  const slides = c ? parse<Slides>(c.slides, []) : [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-600">{c ? <>Version {c.version} · {dateTime(c.generatedAt)} · written by {c.generatedBy} · net value {inr(c.netValue)} · ROI {c.roi.toFixed(1)}×</> : "No business case yet."}</div>
        <div className="flex flex-wrap gap-2">
          {pod && <form action={runBusinessCase}><input type="hidden" name="id" value={id} /><SubmitButton pending="Writing the business case…">{c ? "Generate new version" : "Generate business case"}</SubmitButton></form>}
          {c && <>
            <a className="btn-secondary" href={`/api/requests/${id}/case/${c.version}/docx`}>Download .docx</a>
            <a className="btn-secondary" href={`/api/requests/${id}/case/${c.version}/pptx`}>Council slides .pptx</a>
            <a className="btn-secondary" href={`/requests/${id}/print?v=${c.version}`} target="_blank">Print / PDF</a>
          </>}
        </div>
      </div>
      {c ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2"><Markdown text={c.content} /></Card>
          <div className="space-y-3">
            <h3>AI Council slides (preview)</h3>
            {slides.map((s, i) => (
              <div key={i} className="aspect-video overflow-hidden rounded-md border border-slate-300 bg-white p-3 shadow-sm">
                <div className="mb-1 h-1 w-full bg-brand" />
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="mt-1 flex gap-2">
                  <ul className="flex-1 list-disc pl-4 text-[11px] leading-snug">{s.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                  {s.keyNumbers.length > 0 && <div className="w-24 space-y-1">{s.keyNumbers.slice(0, 3).map((k, j) => <div key={j} className="rounded bg-slate-100 p-1"><div className="text-[9px] text-slate-500">{k.label}</div><div className="text-[11px] font-semibold text-brand">{k.value}</div></div>)}</div>}
                </div>
              </div>
            ))}
            {cases.length > 1 && <div className="text-xs text-slate-500">Earlier versions: {cases.slice(1).map((x) => `v${x.version}`).join(", ")}</div>}
          </div>
        </div>
      ) : <Empty>Generate the business case after design and cost. It uses only numbers from the value engine.</Empty>}
    </div>
  );
}
