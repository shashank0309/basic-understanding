import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { currentUser, hasRole } from "@/lib/session";
import { date } from "@/lib/format";
import { rateItem, requestAccess, updateTier } from "@/app/actions/market";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, Notice } from "@/components/ui";

const REQS: Record<string, string[]> = {
  PERSONAL: ["Basic usage rules accepted"],
  TEAM: ["Owner", "Description", "Data check"],
  CERTIFIED: ["Owner", "Version", "Security check", "Support model", "Value data", "Review date"],
};

export default async function Item({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const i = await db.marketplaceItem.findUnique({ where: { id }, include: { asset: true } });
  if (!i) notFound();
  const owner = await db.user.findUnique({ where: { id: i.ownerId } });
  const linked = i.linkedRequestId ? await db.request.findUnique({ where: { id: i.linkedRequestId }, include: { actuals: true } }) : null;
  const requested = await db.accessRequest.count({ where: { itemId: id, userId: user.id } });
  const expired = i.reviewDate < new Date();
  const canManage = i.ownerId === user.id || hasRole(user, "ARCHITECT", "DIGITAL_HEAD");
  return (
    <div className="space-y-4">
      <div className="text-sm"><Link href="/marketplace">← Marketplace</Link></div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1>{i.name}</h1><div className="mt-1 flex flex-wrap gap-1"><Badge tone={i.tier === "CERTIFIED" ? "green" : i.tier === "TEAM" ? "blue" : "gray"}>{i.tier.toLowerCase()}</Badge><Badge>{i.type.toLowerCase().replace("_", " ")}</Badge><Badge>{i.targetTool}</Badge><Badge>v{i.version}</Badge></div></div>
        <form action={requestAccess}><input type="hidden" name="itemId" value={i.id} /><SubmitButton>{requested ? "Requested – ask again" : i.tier === "PERSONAL" ? "Ask the builder" : "Request access / use"}</SubmitButton></form>
      </div>
      {expired && <Notice tone="red">The review date ({date(i.reviewDate)}) has passed. The owner must review this item. It drops in search ranking.</Notice>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="About" className="lg:col-span-2">
          <p className="text-sm">{i.description}</p>
          <h3 className="mt-3">How to use</h3><p className="text-sm">{i.howToUse || "–"}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Owner</dt><dd>{owner?.name}</dd>
            <dt className="text-slate-500">Functions</dt><dd>{parse<string[]>(i.functions, []).join(", ")}</dd>
            <dt className="text-slate-500">Based on asset</dt><dd>{i.asset?.name ?? "–"}</dd>
            <dt className="text-slate-500">Review date</dt><dd>{date(i.reviewDate)}</dd>
            <dt className="text-slate-500">Usage</dt><dd>{i.usageCount} uses · ★ {i.rating.toFixed(1)} ({i.ratingCount} ratings)</dd>
            <dt className="text-slate-500">Security check</dt><dd>{i.securityChecked ? "Done" : "Not done"}</dd>
            <dt className="text-slate-500">Support model</dt><dd>{i.supportModel || "–"}</dd>
            <dt className="text-slate-500">Linked request</dt><dd>{linked ? <Link href={`/requests/${linked.id}?tab=tracking`}>{linked.code} {linked.title}</Link> : "–"}</dd>
            {linked?.actuals.length ? <><dt className="text-slate-500">Value data</dt><dd>{linked.actuals.length} actual value check-ins</dd></> : null}
          </dl>
          <form action={rateItem} className="mt-3 flex items-center gap-2 text-sm"><input type="hidden" name="itemId" value={i.id} /><label htmlFor="rating">Rate it</label><select id="rating" name="rating" className="input w-20" defaultValue="5">{[5, 4, 3, 2, 1].map((x) => <option key={x}>{x}</option>)}</select><SubmitButton className="btn-secondary btn-sm">Rate</SubmitButton></form>
        </Card>
        <Card title="Tier requirements">
          <ul className="space-y-1 text-sm">{REQS[i.tier].map((x) => <li key={x}>✓ {x}</li>)}</ul>
          <p className="mt-2 text-xs text-slate-500">Personal: builder only. Team: one team or function. Certified: all employees.</p>
          {canManage && (
            <form action={updateTier} className="mt-3 space-y-2 border-t border-slate-100 pt-3"><input type="hidden" name="itemId" value={i.id} />
              <div><label className="label">Tier</label><select name="tier" defaultValue={i.tier} className="input"><option>PERSONAL</option><option>TEAM</option><option>CERTIFIED</option></select></div>
              <div><label className="label">Version</label><input name="version" defaultValue={i.version} className="input" /></div>
              <div><label className="label">Review date</label><input type="date" name="reviewDate" defaultValue={i.reviewDate.toISOString().slice(0, 10)} className="input" /></div>
              <div><label className="label">Support model</label><input name="supportModel" defaultValue={i.supportModel} className="input" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="securityChecked" defaultChecked={i.securityChecked} /> Security check done</label>
              <SubmitButton className="btn-secondary">Update</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
