import Link from "next/link";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { date } from "@/lib/format";
import { Badge, Empty } from "@/components/ui";

const TYPES: Record<string, string> = { AGENT: "Agent", SKILL: "Skill / prompt pack", TEMPLATE: "Template", PLATFORM_EXTENSION: "Platform extension", DATA_PRODUCT: "Data product", APPLICATION: "Application" };
const TIER_TONE = { CERTIFIED: "green", TEAM: "blue", PERSONAL: "gray" } as const;

export default async function Marketplace({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const items = await db.marketplaceItem.findMany();
  const now = Date.now();
  const q = sp.q?.toLowerCase();
  const fnList = [...new Set(items.flatMap((i) => parse<string[]>(i.functions, [])))].sort();
  const tools = [...new Set(items.map((i) => i.targetTool))].sort();
  const tierRank = { CERTIFIED: 3, TEAM: 2, PERSONAL: 1 } as Record<string, number>;
  const list = items
    .filter((i) => (!q || `${i.name} ${i.description} ${i.howToUse}`.toLowerCase().includes(q)) && (!sp.type || i.type === sp.type) && (!sp.tier || i.tier === sp.tier) && (!sp.tool || i.targetTool === sp.tool) && (!sp.fn || parse<string[]>(i.functions, []).includes(sp.fn)))
    // Expired review date drops the item down the ranking.
    .map((i) => ({ ...i, expired: +i.reviewDate < now, score: (+i.reviewDate < now ? -100 : 0) + tierRank[i.tier] * 10 + Math.log10(i.usageCount + 1) * 3 + i.rating }))
    .sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-4">
      <div><h1>Marketplace</h1><p className="muted">Reuse agents, skills, templates and data products that other teams built. Certified items are open to all employees.</p></div>
      <form className="card grid grid-cols-2 gap-2 md:grid-cols-6" method="get">
        <div className="col-span-2"><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="What do you need?" /></div>
        <div><label className="label" htmlFor="type">Type</label><select id="type" name="type" defaultValue={sp.type ?? ""} className="input"><option value="">All</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label" htmlFor="tier">Tier</label><select id="tier" name="tier" defaultValue={sp.tier ?? ""} className="input"><option value="">All</option><option value="CERTIFIED">Certified</option><option value="TEAM">Team</option><option value="PERSONAL">Personal</option></select></div>
        <div><label className="label" htmlFor="tool">Tool</label><select id="tool" name="tool" defaultValue={sp.tool ?? ""} className="input"><option value="">All</option>{tools.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label" htmlFor="fn">Function</label><select id="fn" name="fn" defaultValue={sp.fn ?? ""} className="input"><option value="">All</option>{fnList.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="col-span-2 flex gap-2 md:col-span-6"><button className="btn">Search</button><Link href="/marketplace" className="btn-secondary">Clear</Link></div>
      </form>
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((i) => (
            <Link key={i.id} href={`/marketplace/${i.id}`} className={`card block text-slate-800 no-underline hover:border-brand hover:no-underline ${i.expired ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-2"><h3>{i.name}</h3><Badge tone={TIER_TONE[i.tier as keyof typeof TIER_TONE]}>{i.tier.toLowerCase()}</Badge></div>
              <p className="mt-1 text-sm text-slate-600">{i.description}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-xs"><Badge>{TYPES[i.type] ?? i.type}</Badge><Badge>{i.targetTool}</Badge>{parse<string[]>(i.functions, []).map((f) => <Badge key={f}>{f}</Badge>)}</div>
              <div className="mt-2 flex justify-between text-xs text-slate-500"><span>★ {i.rating.toFixed(1)} ({i.ratingCount}) · used {i.usageCount}×</span><span>v{i.version}</span></div>
              {i.expired && <div className="mt-2 text-xs font-medium text-red-600">⚠ Review date passed ({date(i.reviewDate)}). Use with care.</div>}
            </Link>
          ))}
        </div>
      ) : <Empty>No items match.</Empty>}
    </div>
  );
}
