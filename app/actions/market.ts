"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { audit } from "@/lib/audit/audit";
import { sendEmail } from "@/lib/notify/email";
import { f, n } from "./util";

export async function requestAccess(fd: FormData) {
  const u = await currentUser();
  const item = await db.marketplaceItem.update({ where: { id: f(fd, "itemId") }, data: { usageCount: { increment: 1 } } });
  await db.accessRequest.create({ data: { itemId: item.id, userId: u.id } });
  await sendEmail({ userId: item.ownerId, type: "ACCESS_REQUEST", subject: `[Marketplace] ${u.name} wants to use "${item.name}"`, body: "Please grant access or share the setup steps.", link: `/marketplace/${item.id}` });
  await audit(u.id, "REQUEST_ACCESS", "MarketplaceItem", item.id, item.name);
  revalidatePath(`/marketplace/${item.id}`);
}

export async function rateItem(fd: FormData) {
  const u = await currentUser();
  const i = await db.marketplaceItem.findUniqueOrThrow({ where: { id: f(fd, "itemId") } });
  const r = Math.max(1, Math.min(5, n(fd, "rating")));
  await db.marketplaceItem.update({ where: { id: i.id }, data: { rating: (i.rating * i.ratingCount + r) / (i.ratingCount + 1), ratingCount: i.ratingCount + 1 } });
  await audit(u.id, "RATE", "MarketplaceItem", i.id, String(r));
  revalidatePath(`/marketplace/${i.id}`);
}

export async function updateTier(fd: FormData) {
  const u = await currentUser();
  const i = await db.marketplaceItem.findUniqueOrThrow({ where: { id: f(fd, "itemId") } });
  if (i.ownerId !== u.id && !u.roles.some((r) => ["ADMIN", "ARCHITECT", "DIGITAL_HEAD"].includes(r))) throw new Error("Only the owner, an architect or an admin can change the tier.");
  const tier = f(fd, "tier");
  const securityChecked = fd.get("securityChecked") === "on";
  const supportModel = f(fd, "supportModel");
  if (tier === "CERTIFIED" && (!securityChecked || !supportModel || !i.version)) throw new Error("Certified items need a version, a security check and a support model.");
  await db.marketplaceItem.update({ where: { id: i.id }, data: { tier, securityChecked, supportModel, reviewDate: new Date(f(fd, "reviewDate") || i.reviewDate), version: f(fd, "version") || i.version } });
  await audit(u.id, "CHANGE_TIER", "MarketplaceItem", i.id, `${i.tier} → ${tier}`);
  revalidatePath(`/marketplace/${i.id}`);
  revalidatePath("/marketplace");
}
