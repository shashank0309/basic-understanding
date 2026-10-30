"use client";
import { useEffect, useId, useState } from "react";

export function Mermaid({ code }: { code: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    import("mermaid").then(async (m) => {
      m.default.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
      try {
        const r = await m.default.render(`m${id}`, code);
        if (alive) { setSvg(r.svg); setErr(""); }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Diagram error");
      }
    });
    return () => { alive = false; };
  }, [code, id]);
  if (err) return <pre className="overflow-auto rounded bg-red-50 p-2 text-xs text-red-700">Diagram error: {err}{"\n\n"}{code}</pre>;
  return <div className="overflow-auto rounded border border-slate-200 bg-white p-2" dangerouslySetInnerHTML={{ __html: svg || "<p class='text-sm text-slate-500'>Drawing diagram…</p>" }} />;
}
