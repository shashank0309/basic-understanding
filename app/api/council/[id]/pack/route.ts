import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { buildPptx } from "@/lib/export/pptx";
import type { Slides } from "@/lib/ai/schemas";
import { getSettings } from "@/lib/settings";
import { date } from "@/lib/format";

/** One-click slide pack: agenda slide + the slides of every case on the agenda. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await db.councilMeeting.findUniqueOrThrow({ where: { id }, include: { requests: { include: { cases: { orderBy: { version: "desc" }, take: 1 } } } } });
  const s = await getSettings();
  const slides: Slides = [{ title: `AI Council – ${date(m.date)}`, bullets: m.requests.map((r) => `${r.code} ${r.title}`), keyNumbers: [{ label: "Cases", value: String(m.requests.length) }] }];
  for (const r of m.requests) slides.push(...parse<Slides>(r.cases[0]?.slides, []));
  const buf = await buildPptx({ title: "AI Council pack", slides, clientName: s.clientName, color: s.brandColor });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="ai-council-pack-${m.date.toISOString().slice(0, 10)}.pptx"` } });
}
