import { composeAssistantResponse } from "@/services/assistant/response-composer";
import type { AssistantProvider, AssistantStreamParams } from "@/services/assistant/providers/types";

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Streams a rich grounded reply token-by-token so the UI can render
 * progressive markdown, then interactive blocks when meta arrives.
 */
export const groundedProvider: AssistantProvider = {
  id: "grounded",
  async streamChat(params: AssistantStreamParams): Promise<Response> {
    const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
    const full = composeAssistantResponse(lastUser?.content ?? "", params.context);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Small thinking pause for UX polish
        await new Promise((r) => setTimeout(r, 180));
        const chunkSize = 24;
        for (let i = 0; i < full.length; i += chunkSize) {
          controller.enqueue(encode(full.slice(i, i + chunkSize)));
          // Yield to event loop for smoother streaming
          await new Promise((r) => setTimeout(r, 8));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Assistant-Provider": "grounded",
      },
    });
  },
};
