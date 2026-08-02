import type { AssistantContextPayload } from "@/services/assistant/context-builder";

export interface AssistantChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AssistantStreamParams {
  messages: AssistantChatMessage[];
  context: AssistantContextPayload;
  userId: string;
}

/**
 * Pluggable assistant backend. Future models (forecast, loan eligibility,
 * fraud prediction) register here without changing the chat UI.
 */
export interface AssistantProvider {
  id: string;
  streamChat(params: AssistantStreamParams): Promise<Response>;
}
