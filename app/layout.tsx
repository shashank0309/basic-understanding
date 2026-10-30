import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { currentUser, hasRole } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { providerLabel } from "@/lib/llm/provider";
import { RoleSwitcher } from "@/components/RoleSwitcher";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const s = await getSettings().catch(() => ({ clientName: "Client" }) as Record<string, string>);
  return { title: `AI Use-Case Factory · ${s.clientName}`, description: "From business problem to AI Council decision" };
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (s: number) => Math.max(0, Math.min(255, ((n >> s) & 255) + amt));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [s, user, users] = await Promise.all([getSettings(), currentUser(), db.user.findMany({ where: { NOT: { id: "system" } }, orderBy: { name: "asc" } })]);
  const pending = await db.approval.count({ where: { approverId: user.id, status: "PENDING" } });
  const unread = await db.notification.count({ where: { userId: user.id, read: false } });
  const brand = /^#[0-9a-f]{6}$/i.test(s.brandColor) ? s.brandColor : "#0f766e";
  const nav = [
    { href: "/", label: "Home" },
    { href: "/submit", label: "Submit a problem" },
    { href: "/register", label: "Register" },
    ...(hasRole(user, "POD_ANALYST", "DIGITAL_HEAD") ? [{ href: "/triage", label: "Triage" }] : []),
    { href: "/approvals", label: `Approvals${pending ? ` (${pending})` : ""}` },
    { href: "/council", label: "Council" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/value", label: "Value" },
    { href: "/outbox", label: `Outbox${unread ? ` (${unread})` : ""}` },
    ...(hasRole(user, "ADMIN") ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  const order = Object.keys(ROLE_LABELS);
  const sorted = users
    .map((u) => ({ id: u.id, name: u.name, role: u.roles.split(",")[0] as Role }))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
    .map((u) => ({ id: u.id, name: u.name, roleLabel: ROLE_LABELS[u.role] ?? u.role }));
  return (
    <html lang="en">
      <body style={{ ["--brand" as string]: brand, ["--brand-dark" as string]: shade(brand, -30), ["--brand-light" as string]: shade(brand, 170) }}>
        <div className="no-print bg-amber-400 px-4 py-1 text-center text-xs font-semibold text-amber-950">Demo – synthetic data. No real client data. AI provider: {providerLabel()}</div>
        <header className="no-print bg-brand text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2">
            <Link href="/" className="text-white no-underline hover:no-underline">
              <span className="font-semibold">AI Use-Case Factory</span> <span className="text-white/70">· {s.clientName}</span>
            </Link>
            <RoleSwitcher users={sorted} current={user.id} />
          </div>
          <nav className="mx-auto flex max-w-7xl flex-wrap gap-1 px-3 pb-2" aria-label="Main">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded px-2 py-1 text-sm text-white/90 no-underline hover:bg-white/15 hover:no-underline">{n.label}</Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
