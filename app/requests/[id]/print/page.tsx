import { db } from "@/lib/db";
import { Markdown } from "@/components/Markdown";
import { PrintButton } from "@/components/PrintButton";

export default async function PrintCase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const { v } = await searchParams;
  const c = await db.businessCase.findFirst({ where: { requestId: id, ...(v ? { version: Number(v) } : {}) }, orderBy: { version: "desc" } });
  if (!c) return <p>No business case.</p>;
  return (
    <div className="mx-auto max-w-3xl bg-white p-8">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <Markdown text={c.content} />
      <p className="mt-6 text-xs text-slate-400">Demo – synthetic data.</p>
    </div>
  );
}
