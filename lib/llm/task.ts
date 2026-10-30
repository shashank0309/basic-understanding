// Runs one LLM task: versioned prompt → provider → JSON → Zod validation.
// Retries once on invalid output, then falls back to the rule-based draft (users can always edit).
import type { ZodType, ZodTypeDef } from "zod";
import { db } from "../db";
import { fill, loadPrompt } from "../prompts/loader";
import { getProvider } from "./provider";

export interface TaskResult<T> {
  data: T;
  by: string; // provider name or "Rule-based"
  note?: string;
}

export function extractJson(s: string): unknown {
  const cleaned = s.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) throw new Error("No JSON found");
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(close);
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function runTask<T>(task: string, vars: Record<string, unknown>, schema: ZodType<T, ZodTypeDef, unknown>, fallback: () => T | Promise<T>): Promise<TaskResult<T>> {
  const provider = getProvider();
  if (!provider) return { data: await fallback(), by: "Rule-based" };
  const prompt = loadPrompt(task);
  const user = fill(prompt.user, vars);
  const started = Date.now();
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await provider.complete(prompt.system, attempt === 0 ? user : `${user}\n\nYour last answer was not valid: ${lastError}. Return only valid JSON that matches the schema.`);
      const parsed = schema.safeParse(extractJson(out));
      if (parsed.success) {
        await log(task, prompt.id, provider.name, Date.now() - started, "ok", user.length, out.length);
        return { data: parsed.data, by: provider.name };
      }
      lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  await log(task, prompt.id, provider.name, Date.now() - started, `fallback: ${lastError}`, user.length, 0);
  return { data: await fallback(), by: "Rule-based", note: `The AI draft failed (${lastError.slice(0, 120)}). We used the rule-based draft.` };
}

// Logs metadata only (not full content), as required for production.
async function log(task: string, promptId: string, provider: string, ms: number, outcome: string, inChars: number, outChars: number) {
  try {
    await db.auditEvent.create({
      data: { userId: "system", action: "LLM_CALL", entity: "LlmTask", entityId: task, details: JSON.stringify({ promptId, provider, ms, outcome, inChars, outChars }) },
    });
  } catch {
    /* logging must never break the flow */
  }
}
