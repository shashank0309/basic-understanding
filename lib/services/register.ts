import { db } from "../db";
import { parse } from "../json";
import { daysSince } from "../format";
import type { CurrentUser } from "../session";
import { canSeeRequest } from "../session";
import { loadValue } from "./value";

export interface RegisterFilter { q?: string; fn?: string; route?: string; status?: string; level?: string; minValue?: string; age?: string }

export async function registerRows(user: CurrentUser, fl: RegisterFilter) {
  const rows = await db.request.findMany({ include: { function: true, cluster: true }, orderBy: { code: "desc" } });
  const users = await db.user.findMany();
  const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? "–";
  const out = [];
  for (const r of rows.filter((x) => canSeeRequest(user, x))) {
    const v = await loadValue(r.id);
    out.push({
      id: r.id, code: r.code, title: r.title, functionId: r.functionId, function: r.function.name, sites: parse<string[]>(r.sites, []).join(", "),
      status: r.status, route: r.route ?? r.proposedRoute, routeConfirmed: !!r.route, level: r.approvalLevel, benefit: v.result.totalBenefit, tco: v.result.tco,
      flags: v.flags.length, age: daysSince(r.createdAt), cluster: r.cluster?.name ?? "", clusterId: r.clusterId, mergedInto: r.mergedIntoId,
      requester: name(r.requesterId), owner: name(r.ownerId), createdAt: r.createdAt, exitTeam: r.exitTeam,
    });
  }
  const q = fl.q?.toLowerCase();
  return out.filter((r) =>
    (!q || `${r.code} ${r.title} ${r.sites} ${r.requester}`.toLowerCase().includes(q)) &&
    (!fl.fn || r.functionId === fl.fn) && (!fl.route || r.route === fl.route) && (!fl.status || r.status === fl.status) &&
    (!fl.level || r.level === fl.level) && (!fl.minValue || r.benefit >= Number(fl.minValue)) &&
    (!fl.age || (fl.age === "30" ? r.age <= 30 : fl.age === "90" ? r.age > 30 && r.age <= 90 : r.age > 90)),
  );
}
