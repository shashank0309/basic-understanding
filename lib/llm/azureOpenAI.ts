// Azure OpenAI / Azure AI Foundry adapter (production option on the client's tenant).
import type { LlmProvider } from "./provider";

export const azureOpenAIProvider: LlmProvider = {
  name: "Azure OpenAI",
  async complete(system, user) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "");
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT!;
    const version = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
    const res = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${version}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_OPENAI_API_KEY! },
      body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Azure OpenAI error ${res.status}`);
    const j = (await res.json()) as { choices: { message: { content: string } }[] };
    return j.choices[0]?.message?.content ?? "";
  },
};
