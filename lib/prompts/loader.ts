import fs from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();

/** Loads prompts/<task>.<version>.md. The file has "## System" and "## User" sections with {{var}} slots. */
export function loadPrompt(task: string, version = "v1"): { system: string; user: string; id: string } {
  const id = `${task}.${version}`;
  let raw = cache.get(id);
  if (!raw) {
    raw = fs.readFileSync(path.join(process.cwd(), "prompts", `${id}.md`), "utf8");
    cache.set(id, raw);
  }
  const sys = raw.split(/^## User\s*$/m)[0].replace(/^[\s\S]*?^## System\s*$/m, "").trim();
  const user = (raw.split(/^## User\s*$/m)[1] ?? "").trim();
  return { system: sys, user, id };
}

export function fill(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vars[k];
    return typeof v === "string" ? v : JSON.stringify(v, null, 1);
  });
}
