"use client";
import { useState, useTransition } from "react";
import { deleteStep, reorderSteps, updateStep } from "@/app/actions/request";
import { PATTERN_LABELS } from "@/lib/constants";
import { SubmitButton } from "../SubmitButton";

export type EditorStep = {
  id: string; order: number; name: string; actor: string; system: string; minutesPerOccurrence: number; occurrencesPerMonth: number; peopleCount: number;
  painPoints: string[]; aiOpportunity: string; aiPattern: string | null; aiReason: string; aiMinutes: number; citation: string; docTitle?: string;
};

const OPP_TONE: Record<string, string> = { NONE: "bg-slate-100 text-slate-600", ASSIST: "bg-sky-100 text-sky-800", AUTOMATE: "bg-violet-100 text-violet-800" };

export function ProcessMapEditor({ requestId, steps, canEdit }: { requestId: string; steps: EditorStep[]; canEdit: boolean }) {
  const [list, setList] = useState(steps);
  const [drag, setDrag] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setList(next);
    start(() => reorderSteps(requestId, next.map((s) => s.id)));
  };
  return (
    <ol className="space-y-2">
      {list.map((s, i) => (
        <li key={s.id} draggable={canEdit} onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }} onDragEnd={() => setDrag(null)}
          className={`rounded-md border bg-white ${drag === i ? "border-brand opacity-60" : "border-slate-200"}`}>
          <div className="flex flex-wrap items-center gap-2 p-2">
            {canEdit && <span className="cursor-grab select-none text-slate-400" title="Drag to reorder" aria-hidden>⠿</span>}
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">{i + 1}</span>
            <div className="min-w-[12rem] flex-1">
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs text-slate-500">{s.actor || "–"} · {s.system || "–"} · {s.minutesPerOccurrence} min × {s.occurrencesPerMonth}/month × {s.peopleCount} people</div>
              {s.painPoints.length > 0 && <div className="text-xs text-amber-700">Pain: {s.painPoints.join("; ")}</div>}
            </div>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${OPP_TONE[s.aiOpportunity]}`}>{s.aiOpportunity === "NONE" ? "No AI" : `${s.aiOpportunity.toLowerCase()} · ${PATTERN_LABELS[s.aiPattern ?? ""] ?? s.aiPattern}`}</span>
            {s.citation && <a href={`/docs/${s.citation.split("#")[0]}?chunk=${s.citation.split("#")[1]}`} className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800" title={s.docTitle}>Source: {s.citation}</a>}
            {canEdit && (
              <span className="flex gap-1">
                <button type="button" className="btn-secondary btn-sm" onClick={() => move(i, i - 1)} aria-label="Move up" disabled={i === 0}>↑</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => move(i, i + 1)} aria-label="Move down" disabled={i === list.length - 1}>↓</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Close" : "Edit"}</button>
              </span>
            )}
          </div>
          {s.aiReason && <div className="border-t border-slate-100 px-3 py-1 text-xs text-slate-600">Why: {s.aiReason}</div>}
          {open === s.id && (
            <div className="border-t border-slate-200 bg-slate-50 p-3">
              <form action={updateStep} className="grid gap-2 md:grid-cols-4">
                <input type="hidden" name="stepId" value={s.id} />
                <div className="md:col-span-2"><label className="label">Step name</label><input name="name" defaultValue={s.name} className="input" /></div>
                <div><label className="label">Actor</label><input name="actor" defaultValue={s.actor} className="input" /></div>
                <div><label className="label">System</label><input name="system" defaultValue={s.system} className="input" /></div>
                <div><label className="label">Minutes per occurrence</label><input name="minutesPerOccurrence" type="number" step="any" defaultValue={s.minutesPerOccurrence} className="input" /></div>
                <div><label className="label">Occurrences per month (per person)</label><input name="occurrencesPerMonth" type="number" step="any" defaultValue={s.occurrencesPerMonth} className="input" /></div>
                <div><label className="label">People</label><input name="peopleCount" type="number" step="any" defaultValue={s.peopleCount} className="input" /></div>
                <div><label className="label">AI opportunity</label><select name="aiOpportunity" defaultValue={s.aiOpportunity} className="input"><option>NONE</option><option>ASSIST</option><option>AUTOMATE</option></select></div>
                <div><label className="label">AI pattern</label><select name="aiPattern" defaultValue={s.aiPattern ?? ""} className="input"><option value="">–</option>{Object.entries(PATTERN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">With-AI minutes</label><input name="aiMinutes" type="number" step="any" defaultValue={s.aiMinutes} className="input" /></div>
                <div className="md:col-span-2"><label className="label">Reason for AI choice</label><input name="aiReason" defaultValue={s.aiReason} className="input" /></div>
                <div className="md:col-span-2"><label className="label">Pain points (one per line)</label><textarea name="painPoints" defaultValue={s.painPoints.join("\n")} className="input" /></div>
                <div className="md:col-span-2"><label className="label">Reason for this edit (goes to the audit trail)</label><input name="reason" className="input" placeholder="e.g. Confirmed with the team lead" /></div>
                <div className="flex items-end gap-2 md:col-span-2"><SubmitButton pending="Saving…">Save step</SubmitButton></div>
              </form>
              <form action={deleteStep} className="mt-2"><input type="hidden" name="stepId" value={s.id} /><SubmitButton className="btn-danger btn-sm" confirm="Remove this step?">Remove step</SubmitButton></form>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
