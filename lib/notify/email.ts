// Mock email service: writes to the in-app Outbox. Production adapter: Microsoft Graph sendMail.
import { db } from "../db";

export interface Mail {
  userId: string;
  type: string;
  subject: string;
  body: string;
  link?: string;
}

export async function sendEmail(m: Mail) {
  await db.notification.create({ data: { userId: m.userId, type: m.type, subject: m.subject, body: m.body, link: m.link ?? "", channel: "EMAIL" } });
  // Graph adapter (production): POST /users/{sender}/sendMail — not enabled in the prototype.
}

export async function notifyRole(role: string, m: Omit<Mail, "userId">) {
  const users = await db.user.findMany({ where: { roles: { contains: role } } });
  for (const u of users) await sendEmail({ ...m, userId: u.id });
}
