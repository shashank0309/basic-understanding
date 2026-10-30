import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import type { Summary } from "@/lib/ai/schemas";
import { hasRole, type CurrentUser } from "@/lib/session";
import { dateTime } from "@/lib/format";
import { editSummary, submitDraft } from "@/app/actions/request";
import { SubmitButton } from "../SubmitButton";
import { Card } from "../ui";

export async function OverviewTab({ id, user }: { id: string; user: CurrentUser }) {
  const r = await db.request.findUniqueOrThrow({ where: { id }, include: { intake: { orderBy: { at: "asc" } } } });
  const s = parse<Partial<Summary>>(r.summary, {});
  const events = await db.auditEvent.findMany({ where: { requestId: id }, orderBy: { at: "asc" } });
  const users = await db.user.findMany();
  const name = (uid: string) => users.find((u) => u.id === uid)?.name ?? uid;
  const canEdit = r.requesterId === user.id || hasRole(user, "POD_ANALYST");
  const row = (label: string, v: React.ReactNode) => (v && (!Array.isArray(v) || v.length) ? <div className="grid grid-cols-3 gap-2 border-b border-slate-100 py-1.5 text-sm"><dt className="text-slate-500">{label}</dt><dd className="col-span-2">{Array.isArray(v) ? <ul className="list-disc pl-4">{v.map((x, i) => <li key={i}>{x}</li>)}</ul> : v}</dd></div> : null);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Structured problem summary">
          <dl>
            {row("Problem", r.problemStatement)}
            {row("Function", [s.function, s.subFunction].filter(Boolean).join(" – "))}
            {row("Current process", s.currentProcess)}
            {row("Tools", s.tools?.join(", "))}
            {row("Who / how often / how long", [s.actors, s.peopleInvolved, s.frequency, s.timePerOccurrence].filter(Boolean).join(" · "))}
            {row("Pain points", s.painPoints)}
            {row("Expected result", s.expectedResult)}
            {row("Data sources", s.dataSources?.join(", "))}
            {row("Urgency", r.urgency)}
            {row("Sponsor", r.sponsor || s.sponsor)}
            {row("Risk flags", [r.gxp && "GxP process", r.personalData && "Personal data", r.externalUsers && "External users"].filter(Boolean).join(", ") || "None")}
          </dl>
        </Card>
        {canEdit && (
          <Card title="Edit title and problem">
            <form action={editSummary} className="space-y-2">
              <input type="hidden" name="id" value={id} />
              <input name="title" defaultValue={r.title} className="input" aria-label="Title" />
              <textarea name="problem" defaultValue={r.problemStatement} className="input min-h-[80px]" aria-label="Problem" />
              <SubmitButton pending="Saving…">Save</SubmitButton>
            </form>
            {r.status === "DRAFT" && <form action={submitDraft} className="mt-3"><input type="hidden" name="id" value={id} /><SubmitButton pending="Submitting…">Submit this draft</SubmitButton></form>}
          </Card>
        )}
        {r.intake.length > 0 && (
          <details className="card">
            <summary className="cursor-pointer font-semibold">Intake conversation ({r.intake.length} messages)</summary>
            <div className="mt-2 space-y-1 text-sm">{r.intake.map((m) => <p key={m.id}><strong>{m.role === "agent" ? "Agent" : "User"}:</strong> {m.text}</p>)}</div>
          </details>
        )}
      </div>
      <Card title="Status history">
        <ol className="space-y-2 border-l-2 border-slate-200 pl-3 text-sm">
          <li><div className="font-medium">Created</div><div className="text-xs text-slate-500">{dateTime(r.createdAt)}</div></li>
          {events.filter((e) => e.action !== "LLM_CALL").map((e) => (
            <li key={e.id}><div className="font-medium">{e.action.replace(/_/g, " ").toLowerCase()}</div><div className="text-xs text-slate-500">{dateTime(e.at)} · {name(e.userId)}</div>{e.details && <div className="text-xs text-slate-600">{e.details}</div>}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
