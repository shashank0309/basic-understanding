import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Empty } from "../ui";

export async function AuditTab({ id }: { id: string }) {
  const [events, edits, users] = await Promise.all([
    db.auditEvent.findMany({ where: { requestId: id } }),
    db.editLog.findMany({ where: { requestId: id } }),
    db.user.findMany(),
  ]);
  const name = (uid: string) => users.find((u) => u.id === uid)?.name ?? uid;
  const rows = [
    ...events.map((e) => ({ at: e.at, who: name(e.userId), what: e.action.replace(/_/g, " ").toLowerCase(), detail: e.details, kind: "Event" })),
    ...edits.map((e) => ({ at: e.at, who: name(e.userId), what: `Edited ${e.field}`, detail: `${e.oldValue || "∅"} → ${e.newValue || "∅"}${e.reason ? ` · Reason: ${e.reason}` : ""}`, kind: "Edit" })),
  ].sort((a, b) => +b.at - +a.at);
  if (!rows.length) return <Empty>No events yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr><th>When</th><th>Who</th><th>Type</th><th>What</th><th>Details</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td className="whitespace-nowrap">{dateTime(r.at)}</td><td className="whitespace-nowrap">{r.who}</td><td>{r.kind}</td><td>{r.what}</td><td className="max-w-xl break-words text-xs">{r.detail}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
