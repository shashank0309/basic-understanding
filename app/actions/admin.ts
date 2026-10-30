"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { str } from "@/lib/json";
import { requireRole } from "@/lib/session";
import { audit } from "@/lib/audit/audit";
import { embed } from "@/lib/similarity/embeddings";
import { indexDocument } from "@/lib/services/documents";
import { seedAll } from "@/lib/seed/demo";
import { b, f, n } from "./util";

const ok = (tab: string) => { revalidatePath("/", "layout"); redirect(`/admin?tab=${tab}&saved=1`); };

export async function saveSettings(fd: FormData) {
  const u = await requireRole("ADMIN");
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$") || k === "tab") continue;
    await db.setting.upsert({ where: { key: k }, update: { value: String(v) }, create: { key: k, value: String(v) } });
  }
  await audit(u.id, "UPDATE_SETTINGS", "Setting", f(fd, "tab"));
  ok(f(fd, "tab") || "settings");
}

export async function saveLever(fd: FormData) {
  await requireRole("ADMIN");
  await db.valueLever.update({ where: { key: f(fd, "key") }, data: { name: f(fd, "name"), description: f(fd, "description"), enabled: b(fd, "enabled") } });
  ok("levers");
}

export async function saveBenchmark(fd: FormData) {
  await requireRole("ADMIN");
  const data = { pattern: f(fd, "pattern"), label: f(fd, "label"), lowPct: n(fd, "lowPct"), highPct: n(fd, "highPct"), note: f(fd, "note") };
  if (f(fd, "id")) await db.benchmark.update({ where: { id: f(fd, "id") }, data });
  else await db.benchmark.create({ data });
  ok("benchmarks");
}

export async function saveRate(fd: FormData) {
  await requireRole("ADMIN");
  const data = { band: f(fd, "band"), ratePerHour: n(fd, "ratePerHour") };
  if (f(fd, "id")) await db.roleCostRate.update({ where: { id: f(fd, "id") }, data });
  else await db.roleCostRate.create({ data });
  ok("rates");
}

export async function saveCard(fd: FormData) {
  await requireRole("ADMIN");
  const data = { name: f(fd, "name"), unit: f(fd, "unit"), unitCostINR: n(fd, "unitCostINR"), category: f(fd, "category"), kind: f(fd, "kind"), notes: f(fd, "notes") };
  const id = f(fd, "id") || f(fd, "name").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await db.componentCostCard.upsert({ where: { id }, update: data, create: { id, ...data } });
  ok("costs");
}

export async function saveAsset(fd: FormData) {
  await requireRole("ADMIN", "ARCHITECT");
  const caps = f(fd, "capabilities").split(",").map((x) => x.trim()).filter(Boolean);
  const data = {
    name: f(fd, "name"), type: f(fd, "type"), description: f(fd, "description"), capabilities: str(caps), maturity: f(fd, "maturity"), targetTool: f(fd, "targetTool") || "Custom app",
    functionsUsing: str(f(fd, "functionsUsing").split(",").map((x) => x.trim()).filter(Boolean)), dataSources: str(f(fd, "dataSources").split(",").map((x) => x.trim()).filter(Boolean)),
    embedding: str(embed(`${f(fd, "name")}. ${f(fd, "description")}. ${caps.join(", ")}`)),
  };
  const id = f(fd, "id") || `A-${Date.now().toString(36).toUpperCase()}`;
  await db.asset.upsert({ where: { id }, update: data, create: { id, ...data } });
  ok("assets");
}

export async function saveCapability(fd: FormData) {
  await requireRole("ADMIN", "ITBP");
  const data = { software: f(fd, "software"), feature: f(fd, "feature"), available: f(fd, "available"), roadmapDate: f(fd, "roadmapDate") || null, notes: f(fd, "notes"), embedding: str(embed(`${f(fd, "software")} ${f(fd, "feature")}`)) };
  if (f(fd, "id")) await db.softwareCapability.update({ where: { id: f(fd, "id") }, data });
  else await db.softwareCapability.create({ data });
  ok("capabilities");
}

export async function saveDocument(fd: FormData) {
  const u = await requireRole("ADMIN", "POD_ANALYST");
  const file = fd.get("file");
  let content = f(fd, "content");
  if (file instanceof File && file.size > 0) content = await file.text();
  if (!content) redirect("/admin?tab=docs&error=No content");
  const id = f(fd, "id") || `DOC-UP-${Date.now().toString(36).toUpperCase()}`;
  const title = f(fd, "title") || (file instanceof File ? file.name : "Uploaded document");
  await db.processDocument.upsert({ where: { id }, update: { title, content, type: f(fd, "type") || "UPLOAD", functionId: f(fd, "functionId") || null }, create: { id, title, content, type: f(fd, "type") || "UPLOAD", functionId: f(fd, "functionId") || null } });
  const nChunks = await indexDocument(id, title, content);
  await audit(u.id, "INDEX_DOCUMENT", "ProcessDocument", id, `${nChunks} chunks`);
  ok("docs");
}

export async function saveUserRoles(fd: FormData) {
  const u = await requireRole("ADMIN");
  const roles = fd.getAll("roles").map(String);
  await db.user.update({ where: { id: f(fd, "id") }, data: { roles: roles.join(",") || "REQUESTER", functionId: f(fd, "functionId") || null } });
  await audit(u.id, "UPDATE_ROLES", "User", f(fd, "id"), roles.join(","));
  ok("users");
}

export async function resetDemo() {
  await seedAll();
  revalidatePath("/", "layout");
  redirect("/?reset=1");
}
