import { db } from "../db";

export async function audit(userId: string, action: string, entity: string, entityId: string, details = "", requestId?: string) {
  await db.auditEvent.create({ data: { userId, action, entity, entityId, details, requestId: requestId ?? (entity === "Request" ? entityId : null) } });
}

export async function logEdit(p: { entity: string; entityId: string; requestId?: string; field: string; oldValue: unknown; newValue: unknown; userId: string; reason?: string }) {
  if (String(p.oldValue) === String(p.newValue)) return;
  await db.editLog.create({
    data: { entity: p.entity, entityId: p.entityId, requestId: p.requestId, field: p.field, oldValue: String(p.oldValue ?? ""), newValue: String(p.newValue ?? ""), userId: p.userId, reason: p.reason ?? "" },
  });
}
