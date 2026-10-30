import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { dateTime } from "@/lib/format";
import { markRead } from "@/app/actions/session";
import { Badge, Card, Empty } from "@/components/ui";

export default async function Outbox({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const user = await currentUser();
  const mails = await db.notification.findMany({ where: all ? {} : { userId: user.id }, orderBy: { sentAt: "desc" }, take: 200 });
  const users = await db.user.findMany();
  const u = (id: string) => users.find((x) => x.id === id);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1>Outbox (mock email)</h1><p className="muted">The prototype writes emails here instead of sending them. Production uses Microsoft Graph and Teams.</p></div>
        <Link href={all ? "/outbox" : "/outbox?all=1"} className="btn-secondary">{all ? "Only my emails" : "Show all emails"}</Link>
      </div>
      {mails.length ? (
        <Card>
          <ul className="divide-y divide-slate-100">{mails.map((m) => (
            <li key={m.id} className={`py-3 ${m.read ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm"><span className="text-slate-500">To:</span> {u(m.userId)?.name} &lt;{u(m.userId)?.email}&gt; <Badge>{m.type.toLowerCase()}</Badge> {!m.read && <Badge tone="blue">new</Badge>}</div>
                <span className="text-xs text-slate-500">{dateTime(m.sentAt)}</span>
              </div>
              <div className="font-medium">{m.subject}</div>
              <p className="text-sm text-slate-700">{m.body}</p>
              <div className="mt-1 flex gap-3 text-sm">{m.link && <Link href={m.link}>Open the case</Link>}{!m.read && m.userId === user.id && <form action={markRead}><input type="hidden" name="id" value={m.id} /><button className="text-xs text-slate-500 underline">Mark as read</button></form>}</div>
            </li>
          ))}</ul>
        </Card>
      ) : <Empty>No emails for you. <Link href="/outbox?all=1">Show all emails</Link>.</Empty>}
    </div>
  );
}
