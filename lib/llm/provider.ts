// One provider interface for all LLM calls (section 9).
import { anthropicProvider } from "./anthropic";
import { azureOpenAIProvider } from "./azureOpenAI";

export interface LlmProvider {
  name: string;
  complete(system: string, user: string): Promise<string>;
}

/** Returns null when the "mock" provider is active: tasks then use their rule-based drafts. */
export function getProvider(): LlmProvider | null {
  const p = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (p === "anthropic" || (!p && process.env.ANTHROPIC_API_KEY)) return process.env.ANTHROPIC_API_KEY ? anthropicProvider : null;
  if (p === "azure") return process.env.AZURE_OPENAI_API_KEY ? azureOpenAIProvider : null;
  return null;
}

export function providerLabel(): string {
  return getProvider()?.name ?? "Rule-based (mock)";
}
