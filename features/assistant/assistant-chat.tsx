"use client";

import { useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Menu,
  Mic,
  SendHorizontal,
  Volume2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  createAssistantThreadAction,
  loadAssistantThreadAction,
} from "@/features/assistant/assistant-actions";
import { ChatMessageList } from "@/features/assistant/chat-message-list";
import { ConversationSidebar } from "@/features/assistant/conversation-sidebar";
import {
  ASSISTANT_QUICK_ACTIONS,
  MOBILE_QUICK_CHIPS,
} from "@/features/assistant/suggested-prompts";
import { useVisualViewportHeight } from "@/features/assistant/use-visual-viewport";
import { useVoiceAssistant } from "@/features/assistant/use-voice-assistant";
import { VoicePanel } from "@/features/assistant/voice-panel";
import { stripMetaForSpeech } from "@/services/assistant/blocks";
import type { FinancialInsight } from "@/services/assistant/financial-insights";
import type {
  AssistantThreadSummary,
  AssistantThreadView,
} from "@/services/assistant/thread-service";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export function AssistantChat({
  initialThread,
  initialThreads,
  insights,
}: {
  initialThread: AssistantThreadView;
  initialThreads: AssistantThreadSummary[];
  insights: FinancialInsight[];
}) {
  const [thread, setThread] = useState(initialThread);
  const [threads, setThreads] = useState(initialThreads);
  const [messages, setMessages] = useState<ChatMessage[]>(initialThread.messages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const voiceReplyRef = useRef(false);
  const scrollApiRef = useRef<{ onUserSend: () => void } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { height: shellHeight, keyboardOpen } = useVisualViewportHeight(64);

  const voice = useVoiceAssistant({
    onFinalTranscript: (text) => {
      setInput(text);
      voiceReplyRef.current = true;
      void sendMessage(text);
    },
  });

  async function sendMessage(raw?: string) {
    const content = (raw ?? input).trim();
    if (!content || streaming) return;

    scrollApiRef.current?.onUserSend();
    setError(null);
    setInput("");
    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setThinking(true);
    setStreaming(true);

    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          messages: nextMessages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Assistant request failed");
      }

      setThinking(false);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: buffer } : m))
        );
      }

      const finalText = buffer.trim();
      if (voiceReplyRef.current && finalText) {
        voice.speak(stripMetaForSpeech(finalText));
      }

      setThreads((prev) =>
        prev.map((item) =>
          item.id === thread.id
            ? {
                ...item,
                title: content.slice(0, 72) + (content.length > 72 ? "…" : ""),
                preview: content,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (err) {
      console.error(err);
      setError("Persona AI could not respond. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMessage.id));
    } finally {
      voiceReplyRef.current = false;
      setThinking(false);
      setStreaming(false);
    }
  }

  function handleNewConversation() {
    startTransition(async () => {
      const result = await createAssistantThreadAction();
      setThread(result.thread);
      setThreads(result.threads);
      setMessages(result.thread.messages);
      setError(null);
      setHistoryOpen(false);
      scrollApiRef.current?.onUserSend();
    });
  }

  function handleSelectThread(id: string) {
    if (id === thread.id || streaming) return;
    startTransition(async () => {
      const next = await loadAssistantThreadAction(id);
      setThread(next);
      setMessages(next.messages);
      setError(null);
      setHistoryOpen(false);
      scrollApiRef.current?.onUserSend();
    });
  }

  const busy = streaming || pending || thinking;

  return (
    <div
      className="relative flex w-full overflow-hidden bg-background md:rounded-2xl md:border md:shadow-sm"
      style={{
        height: shellHeight ? `${shellHeight}px` : "calc(100dvh - 4rem)",
        maxHeight: shellHeight ? `${shellHeight}px` : "calc(100dvh - 4rem)",
      }}
    >
      {/* Desktop / tablet sticky conversation column */}
      <div className="hidden h-full w-[320px] shrink-0 lg:block xl:w-[340px]">
        <ConversationSidebar
          threads={threads}
          activeThreadId={thread.id}
          pinnedInsights={insights.slice(0, 4)}
          onSelectThread={handleSelectThread}
          onNewConversation={handleNewConversation}
          onPrompt={(prompt) => void sendMessage(prompt)}
        />
      </div>

      {/* Mobile / tablet collapsible history drawer */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-[min(100%,340px)] p-0 lg:hidden">
          <VisuallyHidden>
            <SheetTitle>Conversations</SheetTitle>
          </VisuallyHidden>
          <ConversationSidebar
            threads={threads}
            activeThreadId={thread.id}
            pinnedInsights={insights.slice(0, 4)}
            onSelectThread={handleSelectThread}
            onNewConversation={handleNewConversation}
            onPrompt={(prompt) => {
              setHistoryOpen(false);
              void sendMessage(prompt);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Primary chat workspace — fills all remaining width */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/40 via-background to-background">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 lg:hidden"
              aria-label="Open conversations"
              onClick={() => setHistoryOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <motion.div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-11 sm:rounded-2xl"
              animate={streaming ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ repeat: streaming ? Infinity : 0, duration: 1.4 }}
            >
              <Bot className="size-5" aria-hidden />
            </motion.div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  Persona AI
                </h1>
                <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
                  Copilot
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {thread.title || "Financial intelligence"}
              </p>
            </div>
          </div>
          {voice.speaking ? (
            <Badge variant="outline" className="gap-1.5">
              <Volume2 className="size-3.5" aria-hidden />
              Speaking
            </Badge>
          ) : null}
        </header>

        <ChatMessageList
          messages={messages}
          streaming={streaming}
          thinking={thinking}
          busy={busy}
          onPrompt={(prompt) => void sendMessage(prompt)}
          scrollApiRef={scrollApiRef}
        />

        {error ? (
          <div
            role="alert"
            className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:mx-5 sm:text-base"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        <div
          className={cn(
            "shrink-0 border-t bg-background/95 px-3 pt-2 backdrop-blur-md sm:px-5",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          )}
        >
          <div
            className={cn(
              "mb-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              keyboardOpen && "hidden sm:flex"
            )}
          >
            <div className="flex gap-2 md:hidden">
              {MOBILE_QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  disabled={busy}
                  onClick={() => void sendMessage(chip.prompt)}
                  className="min-h-11 shrink-0 rounded-full border bg-muted/50 px-3.5 text-sm font-medium transition hover:bg-muted"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="hidden gap-2 md:flex">
              {ASSISTANT_QUICK_ACTIONS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={busy}
                  onClick={() => void sendMessage(prompt)}
                  className="min-h-11 shrink-0 rounded-full border bg-muted/40 px-3 text-sm transition hover:bg-muted"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Persona AI…"
              rows={keyboardOpen ? 1 : 2}
              className="max-h-36 min-h-11 flex-1 resize-none text-base shadow-sm"
              disabled={busy}
              aria-label="Message Persona AI"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  voiceReplyRef.current = false;
                  void sendMessage();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="size-11 shrink-0"
              disabled={busy || !input.trim()}
              aria-label="Send message"
              onClick={() => {
                voiceReplyRef.current = false;
                void sendMessage();
              }}
            >
              <SendHorizontal className="size-5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={voiceOpen ? "secondary" : "outline"}
              className={cn("size-11 shrink-0", voice.listening && "ring-2 ring-primary")}
              aria-label="Open voice assistant"
              onClick={() => setVoiceOpen(true)}
            >
              <Mic className="size-5" />
            </Button>
          </div>
        </div>
      </section>

      <VoicePanel
        open={voiceOpen}
        listening={voice.listening}
        speaking={voice.speaking}
        muted={voice.muted}
        level={voice.level}
        interimTranscript={voice.interimTranscript}
        finalTranscript={voice.finalTranscript}
        error={voice.error}
        recognitionSupported={voice.recognitionSupported}
        permission={voice.permission}
        onStart={() => void voice.startListening()}
        onFinish={() => voice.finishListening()}
        onCancel={() => voice.cancelListening()}
        onStopSpeaking={() => voice.stopSpeaking()}
        onReplay={() => voice.replayLast()}
        onToggleMute={() => voice.toggleMute()}
        onClose={() => {
          voice.cancelListening();
          setVoiceOpen(false);
        }}
      />
    </div>
  );
}
