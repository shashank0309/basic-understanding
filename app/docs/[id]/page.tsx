import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Card } from "@/components/ui";

export default async function DocPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ chunk?: string }> }) {
  const { id } = await params;
  const { chunk } = await searchParams;
  const d = await db.processDocument.findUnique({ where: { id }, include: { chunks: { orderBy: { idx: "asc" } }, function: true } });
  if (!d) notFound();
  return (
    <div className="space-y-4">
      <div className="text-sm"><Link href="/admin?tab=docs">← Process document library</Link></div>
      <h1>{d.title}</h1>
      <div className="flex gap-2 text-sm"><Badge>{d.type}</Badge><Badge>{d.function?.name ?? "All"}</Badge><Badge>v{d.version}</Badge><span className="muted">{d.chunks.length} chunks indexed for retrieval</span></div>
      <Card>
        <div className="space-y-3">
          {d.chunks.map((c) => (
            <div key={c.id} id={`chunk-${c.idx}`} className={`rounded border p-3 text-sm ${String(c.idx) === chunk ? "border-emerald-400 bg-emerald-50" : "border-slate-100"}`}>
              <div className="mb-1 text-xs text-slate-400">{d.id}#{c.idx}</div>
              <p className="whitespace-pre-wrap">{c.text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
