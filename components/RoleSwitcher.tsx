"use client";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { switchUser } from "@/app/actions/session";

export function RoleSwitcher({ users, current }: { users: { id: string; name: string; roleLabel: string }[]; current: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const path = usePathname();
  return (
    <form ref={ref} action={switchUser} className="flex items-center gap-2">
      <label htmlFor="uid" className="text-xs text-white/80">Acting as</label>
      <input type="hidden" name="back" value={path} />
      <select id="uid" name="uid" defaultValue={current} onChange={() => ref.current?.requestSubmit()}
        className="max-w-[16rem] rounded-md border-0 bg-white/15 px-2 py-1 text-sm text-white focus:ring-2 focus:ring-white [&>option]:text-slate-900">
        {users.map((u) => <option key={u.id} value={u.id}>{u.roleLabel} – {u.name}</option>)}
      </select>
    </form>
  );
}
