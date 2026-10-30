"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { f } from "./util";

export async function switchUser(fd: FormData) {
  const id = f(fd, "uid");
  const u = await db.user.findUnique({ where: { id } });
  if (!u) return;
  (await cookies()).set("uid", id, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect(f(fd, "back") || "/");
}

export async function markRead(fd: FormData) {
  await db.notification.update({ where: { id: f(fd, "id") }, data: { read: true } });
  revalidatePath("/outbox");
}
