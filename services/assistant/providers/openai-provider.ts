import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

import { buildAssistantSystemPrompt } from "@/services/assistant/context-builder";
import type { AssistantProvider, AssistantStreamParams } from "@/services/assistant/providers/types";

export const openaiProvider: AssistantProvider = {
  id: "openai",
  async streamChat(params: AssistantStreamParams): Promise<Response> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const openai = createOpenAI({ apiKey });
    const contextJson = JSON.stringify(params.context);
    const systemPrompt = buildAssistantSystemPrompt(params.context);

    const result = streamText({
      model: openai(process.env.OPENAI_ASSISTANT_MODEL ?? "gpt-4o-mini"),
      system: `${systemPrompt}\n\nCustomer context JSON:\n${contextJson}`,
      messages: params.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
    });

    return result.toTextStreamResponse({
      headers: {
        "X-Assistant-Provider": "openai",
      },
    });
  },
};
