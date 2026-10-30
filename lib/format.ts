// Indian currency formatting (lakh / crore). Currency symbol comes from settings.
export function inr(v: number | null | undefined, symbol = "₹"): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1e7) return `${sign}${symbol}${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}${symbol}${(a / 1e5).toFixed(2)} L`;
  return `${sign}${symbol}${Math.round(a).toLocaleString("en-IN")}`;
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  return v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function pct(v: number, digits = 0): string {
  return `${v.toFixed(digits)}%`;
}

export function date(d: Date | string | null | undefined): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(d: Date | string | null | undefined): string {
  if (!d) return "–";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function daysSince(d: Date | string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}
