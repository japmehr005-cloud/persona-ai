import { z } from "zod";

import { auth } from "@/lib/auth";
import { buildAssistantContext } from "@/services/assistant/context-builder";
import { groundedProvider } from "@/services/assistant/providers/grounded-provider";
import { getAssistantProvider } from "@/services/assistant/providers/registry";
import { appendAssistantMessages } from "@/services/assistant/thread-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  threadId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = session.user.id;
  const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return new Response(JSON.stringify({ error: "Missing user message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await appendAssistantMessages({
      userId,
      threadId: parsed.data.threadId,
      messages: [{ role: "user", content: lastUser.content }],
    });

    const context = await buildAssistantContext(userId);
    const provider = getAssistantProvider();
    let response: Response;
    try {
      response = await provider.streamChat({
        userId,
        context,
        messages: parsed.data.messages,
      });
    } catch (providerError) {
      // Never fail the demo on OpenAI credit/network errors — fall back to grounded.
      if (provider.id === "grounded") throw providerError;
      console.error("[assistant/chat] provider failed; using grounded", providerError);
      response = await groundedProvider.streamChat({
        userId,
        context,
        messages: parsed.data.messages,
      });
    }

    // Tee the stream so we can persist the assistant reply after streaming.
    const [clientStream, persistStream] = response.body
      ? response.body.tee()
      : [null, null];

    if (!clientStream || !persistStream) {
      return response;
    }

    void persistAssistantReply(userId, parsed.data.threadId, persistStream);

    return new Response(clientStream, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Assistant-Provider": response.headers.get("X-Assistant-Provider") ?? provider.id,
      },
    });
  } catch (error) {
    console.error("[assistant/chat]", error);
    return new Response(JSON.stringify({ error: "Assistant unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function persistAssistantReply(
  userId: string,
  threadId: string,
  stream: ReadableStream<Uint8Array>
): Promise<void> {
  try {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
    }
    const content = extractAssistantText(raw).trim();
    if (!content) return;
    await appendAssistantMessages({
      userId,
      threadId,
      messages: [{ role: "assistant", content }],
    });
  } catch (error) {
    console.error("[assistant/chat] persist failed", error);
  }
}

function extractAssistantText(raw: string): string {
  // Persist full payload (markdown + optional %%PERSONA_META%% trailer)
  return raw;
}
