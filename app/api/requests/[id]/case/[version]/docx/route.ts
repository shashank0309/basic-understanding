import { db } from "@/lib/db";
import { markdownToDocx } from "@/lib/export/docx";
import { canSeeRequest, currentUser } from "@/lib/session";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version } = await params;
  const user = await currentUser();
  const r = await db.request.findUniqueOrThrow({ where: { id } });
  if (!canSeeRequest(user, r)) return new Response("Forbidden", { status: 403 });
  const c = await db.businessCase.findFirstOrThrow({ where: { requestId: id, version: Number(version) } });
  const buf = await markdownToDocx(c.content);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${r.code}-business-case-v${version}.docx"` } });
}
