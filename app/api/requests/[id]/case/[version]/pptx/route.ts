import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { buildPptx } from "@/lib/export/pptx";
import type { Slides } from "@/lib/ai/schemas";
import { canSeeRequest, currentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version } = await params;
  const user = await currentUser();
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  if (!canSeeRequest(user, r)) return new Response("Forbidden", { status: 403 });
  const c = await db.businessCase.findFirstOrThrow({ where: { requestId: id, version: Number(version) } });
  const s = await getSettings();
  const buf = await buildPptx({ title: r.title, slides: parse<Slides>(c.slides, []), clientName: s.clientName, color: s.brandColor });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="${r.code}-council-slides.pptx"` } });
}
