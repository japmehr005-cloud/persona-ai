"use client";

import { useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MessageRenderer } from "@/features/assistant/message-renderer";
import { useChatScroll } from "@/features/assistant/use-chat-scroll";
import { ASSISTANT_QUICK_ACTIONS } from "@/features/assistant/suggested-prompts";

export interface ChatListMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

const VIRTUALIZE_THRESHOLD = 60;

export function ChatMessageList({
  messages,
  streaming,
  thinking,
  busy,
  onPrompt,
  scrollApiRef,
}: {
  messages: ChatListMessage[];
  streaming: boolean;
  thinking: boolean;
  busy: boolean;
  onPrompt: (prompt: string) => void;
  scrollApiRef: React.MutableRefObject<{ onUserSend: () => void } | null>;
}) {
  const useVirtual = messages.length >= VIRTUALIZE_THRESHOLD;
  const {
    viewportRef,
    bottomSentinelRef,
    showJumpToLatest,
    onScroll,
    jumpToLatest,
    onUserSend,
  } = useChatScroll({
    itemCount: messages.length + (thinking ? 1 : 0),
    streaming,
  });

  useEffect(() => {
    scrollApiRef.current = { onUserSend };
  }, [onUserSend, scrollApiRef]);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 220,
    overscan: 5,
    enabled: useVirtual,
  });

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={viewportRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation messages"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col px-1 sm:px-2 lg:max-w-6xl">
          {messages.length <= 1 && !useVirtual ? (
            <div className="mb-4 rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5">
              <p className="text-base text-muted-foreground">
                Ask about risk, logins, spending, or savings. Answers use your Risk Engine, FIN,
                devices, and Transaction Intelligence.
              </p>
              <div className="mt-3 hidden flex-wrap gap-2 md:flex">
                {ASSISTANT_QUICK_ACTIONS.slice(0, 6).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={busy}
                    onClick={() => onPrompt(prompt)}
                    className="min-h-11 rounded-full border bg-background px-3.5 text-sm shadow-sm transition hover:bg-muted"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {useVirtual ? (
            <div
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                const message = messages[item.index];
                if (!message) return null;
                return (
                  <div
                    key={message.id}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    <div className="pb-4">
                      <MessageRenderer
                        content={message.content}
                        role={message.role}
                        streaming={
                          streaming &&
                          item.index === messages.length - 1 &&
                          message.role === "assistant"
                        }
                        onPrompt={onPrompt}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((message, index) => (
                <MessageRenderer
                  key={message.id}
                  content={message.content}
                  role={message.role}
                  streaming={
                    streaming && index === messages.length - 1 && message.role === "assistant"
                  }
                  onPrompt={onPrompt}
                />
              ))}
            </div>
          )}

          {thinking ? (
            <div className="mt-4 mr-auto flex items-center gap-2 rounded-2xl border bg-muted/50 px-4 py-3 text-base text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Reviewing Risk Engine, FIN, and spending signals…
            </div>
          ) : null}

          <div ref={bottomSentinelRef} className="h-2 w-full shrink-0" aria-hidden />
        </div>
      </div>

      {showJumpToLatest ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
          <Button
            type="button"
            size="sm"
            className="pointer-events-auto min-h-11 gap-1.5 rounded-full px-4 shadow-lg"
            onClick={jumpToLatest}
            aria-label="Jump to latest message"
          >
            Jump to latest
            <ArrowDown className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
