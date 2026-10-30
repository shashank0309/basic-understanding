// Prototype auth: a role switcher stores the current user id in a cookie.
// Production: Microsoft Entra ID SSO with role mapping from Entra groups.
import { cookies } from "next/headers";
import { db } from "./db";
import type { Role } from "./constants";

export type CurrentUser = { id: string; name: string; email: string; roles: Role[]; functionId: string | null };

export async function currentUser(): Promise<CurrentUser> {
  const c = await cookies();
  const id = c.get("uid")?.value;
  let u = id ? await db.user.findUnique({ where: { id } }) : null;
  if (!u) u = await db.user.findFirst({ where: { roles: { contains: "POD_ANALYST" } } });
  if (!u) throw new Error("No users found. Run `npm run setup` to seed the database.");
  return { id: u.id, name: u.name, email: u.email, roles: u.roles.split(",") as Role[], functionId: u.functionId };
}

export function hasRole(u: CurrentUser, ...roles: Role[]): boolean {
  return u.roles.some((r) => roles.includes(r)) || u.roles.includes("ADMIN");
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const u = await currentUser();
  if (!hasRole(u, ...roles)) throw new Error(`This action needs one of these roles: ${roles.join(", ")}.`);
  return u;
}

/** Requesters see only their function's requests (section 14). */
export function canSeeRequest(u: CurrentUser, r: { functionId: string; requesterId: string }): boolean {
  if (u.roles.some((x) => x !== "REQUESTER")) return true;
  return r.functionId === u.functionId || r.requesterId === u.id;
}

/** Finance data: visible to FINANCE / COUNCIL / ADMIN and the pod that builds the case. */
export function canSeeFinance(u: CurrentUser): boolean {
  return hasRole(u, "FINANCE", "COUNCIL_MEMBER", "COUNCIL_CHAIR", "DIGITAL_HEAD", "POD_ANALYST", "ARCHITECT");
}
