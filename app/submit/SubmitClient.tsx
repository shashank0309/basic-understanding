"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRequest, intakeStep, matchFunction } from "@/app/actions/intake";
import type { Summary } from "@/lib/ai/schemas";
import { SLOTS, type Turn } from "@/lib/ai/slots";

type Fn = { id: string; name: string };
const empty: Summary = { title: "", function: "", subFunction: "", sites: [], problem: "", currentProcess: [], tools: [], actors: "", frequency: "", timePerOccurrence: "", peopleInvolved: "", painPoints: [], expectedResult: "", dataSources: [], urgency: "MEDIUM", sponsor: "", gxp: false, personalData: false, externalUsers: false };

export function SubmitClient({ functions, defaultFunctionId }: { functions: Fn[]; defaultFunctionId: string }) {
  const [mode, setMode] = useState<"chat" | "form">("chat");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [fnId, setFnId] = useState(defaultFunctionId);
  const [by, setBy] = useState("");
  return (
    <div className="space-y-4">
      {!summary && (
        <div className="flex gap-2" role="tablist">
          <button role="tab" aria-selected={mode === "chat"} className={mode === "chat" ? "btn" : "btn-secondary"} onClick={() => setMode("chat")}>Chat with the intake agent</button>
          <button role="tab" aria-selected={mode === "form"} className={mode === "form" ? "btn" : "btn-secondary"} onClick={() => setMode("form")}>Use a classic form</button>
        </div>
      )}
      {!summary && mode === "chat" && <Chat onDone={async (s, t, b) => { setTurns(t); setBy(b); const m = await matchFunction(s.function); if (m) setFnId(m); setSummary(s); }} />}
      {!summary && mode === "form" && <ClassicForm onDone={(s) => { setBy("Form"); setSummary(s); }} />}
      {summary && <Confirm summary={summary} turns={turns} functions={functions} fnId={fnId} setFnId={setFnId} by={by} onBack={() => setSummary(null)} />}
    </div>
  );
}

function Chat({ onDone }: { onDone: (s: Summary, t: Turn[], by: string) => void }) {
  const [turns, setTurns] = useState<Turn[]>([{ role: "agent", text: SLOTS[0].q }]);
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);
  const answered = turns.filter((t) => t.role === "user").length;
  const send = () => {
    if (!text.trim()) return;
    const next = [...turns, { role: "user" as const, text: text.trim() }];
    setTurns(next);
    setText("");
    start(async () => {
      const r = await intakeStep(next);
      if (r.done && r.summary) {
        setTurns([...next, { role: "agent", text: "Thank you. I wrote a summary. Please check and edit it." }]);
        onDone(r.summary, next, r.by);
      } else if (r.question) setTurns([...next, { role: "agent", text: r.question }]);
    });
  };
  const fillDemo = () => {
    const demo = ["Quality – QA documentation", "Goa site, also relevant for all India sites", "Our SOP reviews take too long. QA reviewers spend hours on format comments and comparing drafts with the global SOP. Review cycle is 34 days.", "Author drafts SOP in Word; QA reviewer checks format and content; reviewer compares with global SOP on SharePoint; author updates draft; QA head approves in DMS", "25 QA reviewers, about 8 SOPs per month each, around 3 hours of review per SOP", "Most comments are about format, not content; gaps vs. global SOP are found late by auditors. We expect review in 10 days and fewer audit observations", "SOP library in DMS, global SOPs on SharePoint, writing guideline", "High – sponsor is the Site QA head"];
    const next = demo[answered];
    if (next) setText(next);
  };
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Progress</span><span>{Math.min(answered, SLOTS.length)} of {SLOTS.length} questions</span></div>
          <div className="h-2 rounded bg-slate-100" role="progressbar" aria-valuenow={answered} aria-valuemax={SLOTS.length}><div className="h-2 rounded bg-brand transition-all" style={{ width: `${(Math.min(answered, SLOTS.length) / SLOTS.length) * 100}%` }} /></div>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={fillDemo} title="Fill the next answer with demo text">Demo answer</button>
      </div>
      <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-md bg-slate-50 p-3" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${t.role === "user" ? "bg-brand text-white" : "border border-slate-200 bg-white"}`}>{t.text}</div>
          </div>
        ))}
        {busy && <div className="text-sm text-slate-500">The agent is thinking…</div>}
        <div ref={bottom} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="answer" className="sr-only">Your answer</label>
        <textarea id="answer" className="input min-h-[60px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer…" disabled={busy}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn self-end" disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

function ClassicForm({ onDone }: { onDone: (s: Summary) => void }) {
  const split = (v: FormDataEntryValue | null) => String(v ?? "").split(/\n|;|,/).map((x) => x.trim()).filter(Boolean);
  return (
    <form className="card grid gap-3 md:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const g = (k: string) => String(fd.get(k) ?? "").trim();
      onDone({ ...empty, title: g("title"), function: g("function"), subFunction: g("subFunction"), sites: split(fd.get("sites")), problem: g("problem"), currentProcess: String(fd.get("process") ?? "").split(/\n|;/).map((x) => x.trim()).filter(Boolean), tools: split(fd.get("tools")), actors: g("actors"), frequency: g("frequency"), timePerOccurrence: g("time"), peopleInvolved: g("people"), painPoints: split(fd.get("pain")), expectedResult: g("expected"), dataSources: split(fd.get("data")), urgency: g("urgency") as Summary["urgency"], sponsor: g("sponsor"), gxp: fd.get("gxp") === "on", personalData: fd.get("personal") === "on", externalUsers: fd.get("external") === "on" });
    }}>
      {[["title", "Short title"], ["function", "Function"], ["subFunction", "Sub-function / team"], ["sites", "Sites or region (comma separated)"], ["actors", "Who does the work"], ["people", "How many people"], ["frequency", "How often (for example: 8 per month)"], ["time", "How long each time (for example: 3 hours)"], ["tools", "Tools used (Excel, email, SAP…)"], ["data", "Data sources"], ["sponsor", "Sponsor (role)"]].map(([k, l]) => (
        <div key={k}><label className="label" htmlFor={k}>{l}</label><input id={k} name={k} className="input" required={k === "title"} /></div>
      ))}
      <div><label className="label" htmlFor="urgency">Urgency</label><select id="urgency" name="urgency" className="input" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></div>
      <div className="md:col-span-2"><label className="label" htmlFor="problem">Problem in your own words</label><textarea id="problem" name="problem" className="input min-h-[70px]" required /></div>
      <div className="md:col-span-2"><label className="label" htmlFor="process">Current process steps (one per line)</label><textarea id="process" name="process" className="input min-h-[90px]" /></div>
      <div><label className="label" htmlFor="pain">Pain points (one per line)</label><textarea id="pain" name="pain" className="input" /></div>
      <div><label className="label" htmlFor="expected">Expected result</label><textarea id="expected" name="expected" className="input" /></div>
      <fieldset className="flex flex-wrap gap-4 text-sm md:col-span-2">
        <label><input type="checkbox" name="gxp" /> GxP-regulated process</label>
        <label><input type="checkbox" name="personal" /> Uses patient or personal data</label>
        <label><input type="checkbox" name="external" /> External users</label>
      </fieldset>
      <div className="md:col-span-2"><button className="btn">Next: check the summary</button></div>
    </form>
  );
}

function Confirm({ summary, turns, functions, fnId, setFnId, by, onBack }: { summary: Summary; turns: Turn[]; functions: Fn[]; fnId: string; setFnId: (v: string) => void; by: string; onBack: () => void }) {
  const [s, setS] = useState<Summary>(summary);
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");
  const router = useRouter();
  const set = <K extends keyof Summary>(k: K, v: Summary[K]) => setS({ ...s, [k]: v });
  const list = (k: "sites" | "currentProcess" | "tools" | "painPoints" | "dataSources") => (
    <textarea className="input min-h-[70px]" value={s[k].join("\n")} onChange={(e) => set(k, e.target.value.split("\n"))} aria-label={k} />
  );
  const save = (draft: boolean) => start(async () => {
    try {
      const clean = { ...s, sites: s.sites.filter(Boolean), currentProcess: s.currentProcess.filter(Boolean), tools: s.tools.filter(Boolean), painPoints: s.painPoints.filter(Boolean), dataSources: s.dataSources.filter(Boolean) };
      const r = await createRequest({ summary: clean, functionId: fnId, turns, draft });
      router.push(draft ? `/requests/${r.id}` : `/requests/${r.id}?tab=route&new=1`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
  });
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between"><h2>Check your problem summary</h2><span className="text-xs text-slate-500">Written by: {by}. Edit anything.</span></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2"><label className="label">Title</label><input className="input" value={s.title} onChange={(e) => set("title", e.target.value)} /></div>
        <div><label className="label">Function</label><select className="input" value={fnId} onChange={(e) => setFnId(e.target.value)}>{functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div><label className="label">Sub-function</label><input className="input" value={s.subFunction} onChange={(e) => set("subFunction", e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label">Problem</label><textarea className="input min-h-[70px]" value={s.problem} onChange={(e) => set("problem", e.target.value)} /></div>
        <div><label className="label">Current process (one step per line)</label>{list("currentProcess")}</div>
        <div><label className="label">Pain points (one per line)</label>{list("painPoints")}</div>
        <div><label className="label">Sites</label>{list("sites")}</div>
        <div><label className="label">Tools</label>{list("tools")}</div>
        <div><label className="label">Data sources</label>{list("dataSources")}</div>
        <div className="space-y-2">
          <div><label className="label">Who does the work</label><input className="input" value={s.actors} onChange={(e) => set("actors", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="label">People</label><input className="input" value={s.peopleInvolved} onChange={(e) => set("peopleInvolved", e.target.value)} /></div>
            <div><label className="label">How often</label><input className="input" value={s.frequency} onChange={(e) => set("frequency", e.target.value)} /></div>
            <div><label className="label">How long</label><input className="input" value={s.timePerOccurrence} onChange={(e) => set("timePerOccurrence", e.target.value)} /></div>
          </div>
        </div>
        <div className="md:col-span-2"><label className="label">Expected result</label><input className="input" value={s.expectedResult} onChange={(e) => set("expectedResult", e.target.value)} /></div>
        <div><label className="label">Urgency</label><select className="input" value={s.urgency} onChange={(e) => set("urgency", e.target.value as Summary["urgency"])}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></div>
        <div><label className="label">Sponsor</label><input className="input" value={s.sponsor} onChange={(e) => set("sponsor", e.target.value)} /></div>
        <fieldset className="flex flex-wrap gap-4 text-sm md:col-span-2">
          <label><input type="checkbox" checked={s.gxp} onChange={(e) => set("gxp", e.target.checked)} /> GxP-regulated process</label>
          <label><input type="checkbox" checked={s.personalData} onChange={(e) => set("personalData", e.target.checked)} /> Uses patient or personal data</label>
          <label><input type="checkbox" checked={s.externalUsers} onChange={(e) => set("externalUsers", e.target.checked)} /> External users</label>
        </fieldset>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={busy || !s.title || !s.problem} onClick={() => save(false)}>{busy ? "Submitting and checking for similar requests…" : "Confirm and submit"}</button>
        <button className="btn-secondary" disabled={busy} onClick={() => save(true)}>Save as draft</button>
        <button className="btn-secondary" disabled={busy} onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
