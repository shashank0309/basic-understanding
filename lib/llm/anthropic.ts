import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider } from "./provider";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 }));

function text(content: Anthropic.Beta.BetaContentBlock[] | Anthropic.ContentBlock[]): string {
  return content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

export const anthropicProvider: LlmProvider = {
  name: "Anthropic Claude",
  async complete(system, user) {
    const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
    const base = {
      model,
      max_tokens: 8000,
      system,
      output_config: { effort: "low" as const },
      messages: [{ role: "user" as const, content: user }],
    };
    try {
      // Server-side fallback: if the model declines, the API reruns the request on a fallback model.
      const res = await getClient().beta.messages.create({
        ...base,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
      if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
      return text(res.content);
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      const res = await getClient().messages.create(base as Anthropic.MessageCreateParamsNonStreaming);
      if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
      return text(res.content);
    }
  },
};
