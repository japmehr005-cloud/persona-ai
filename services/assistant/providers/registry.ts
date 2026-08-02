import { groundedProvider } from "@/services/assistant/providers/grounded-provider";
import { openaiProvider } from "@/services/assistant/providers/openai-provider";
import type { AssistantProvider } from "@/services/assistant/providers/types";

/**
 * Selects the active assistant provider.
 *
 * - ASSISTANT_PROVIDER=grounded|openai|auto (default: grounded)
 * - Production always uses the grounded/local responder so Persona AI never
 *   calls OpenAI (no credit dependency). Answers come from transaction
 *   history, FIN events, risk engine, ML classifier, and account data.
 * - Outside production, OpenAI is only used when explicitly selected
 *   (or auto) AND OPENAI_API_KEY is non-empty.
 */
export function getAssistantProvider(): AssistantProvider {
  // Production demos must never depend on OpenAI credits.
  if (process.env.NODE_ENV === "production") {
    return groundedProvider;
  }

  const mode = (process.env.ASSISTANT_PROVIDER ?? "grounded").toLowerCase().trim();
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  if ((mode === "openai" || mode === "auto") && hasOpenAiKey) {
    return openaiProvider;
  }

  return groundedProvider;
}
