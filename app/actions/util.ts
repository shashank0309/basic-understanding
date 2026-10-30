export const f = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const n = (fd: FormData, k: string) => {
  const v = Number(String(fd.get(k) ?? "").replace(/,/g, ""));
  return Number.isFinite(v) ? v : 0;
};
export const b = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
