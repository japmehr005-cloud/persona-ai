import { groundedProvider } from "@/services/assistant/providers/grounded-provider";
import { openaiProvider } from "@/services/assistant/providers/openai-provider";
import type { AssistantProvider } from "@/services/assistant/providers/types";

/**
 * Selects the active assistant provider.
 * - ASSISTANT_PROVIDER=grounded|openai|auto (default auto)
 * - auto uses OpenAI when OPENAI_API_KEY is present, otherwise grounded
 */
export function getAssistantProvider(): AssistantProvider {
  const mode = (process.env.ASSISTANT_PROVIDER ?? "auto").toLowerCase();
  if (mode === "grounded") return groundedProvider;
  if (mode === "openai") return openaiProvider;
  if (process.env.OPENAI_API_KEY) return openaiProvider;
  return groundedProvider;
}
