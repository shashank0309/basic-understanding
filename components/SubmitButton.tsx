"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, pending = "Working…", className = "btn", name, value, confirm, formAction }: { children: ReactNode; pending?: string; className?: string; name?: string; value?: string; confirm?: string; formAction?: (fd: FormData) => void | Promise<void> }) {
  const { pending: p } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={p} name={name} value={value} aria-busy={p} formAction={formAction}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {p ? (<><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />{pending}</>) : children}
    </button>
  );
}
