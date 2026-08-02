"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { MessageSquarePlus, Pin, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FinancialInsight } from "@/services/assistant/financial-insights";
import type { AssistantThreadSummary } from "@/services/assistant/thread-service";
import { cn } from "@/lib/utils";

export function ConversationSidebar({
  threads,
  activeThreadId,
  pinnedInsights,
  onSelectThread,
  onNewConversation,
  onPrompt,
}: {
  threads: AssistantThreadSummary[];
  activeThreadId: string;
  pinnedInsights: FinancialInsight[];
  onSelectThread: (id: string) => void;
  onNewConversation: () => void;
  onPrompt: (prompt: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => {
      const title = (thread.title ?? "").toLowerCase();
      const preview = (thread.preview ?? "").toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [threads, query]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r bg-gradient-to-b from-muted/40 to-background">
      <div className="shrink-0 border-b p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Persona AI</p>
            <p className="text-base font-semibold tracking-tight">Conversations</p>
          </div>
        </div>
        <Button
          type="button"
          className="min-h-11 w-full justify-start gap-2"
          onClick={onNewConversation}
        >
          <MessageSquarePlus className="size-4" aria-hidden />
          New conversation
        </Button>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="h-11 pl-9 text-base"
            aria-label="Search conversations"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-3">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent chats
          </p>
          {filteredThreads.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {query.trim() ? "No conversations match your search." : "No conversations yet."}
            </p>
          ) : (
            filteredThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-left transition hover:bg-muted/80",
                  activeThreadId === thread.id && "bg-muted shadow-sm ring-1 ring-border"
                )}
              >
                <p className="line-clamp-1 text-base font-medium">
                  {thread.title || "Untitled conversation"}
                </p>
                {thread.preview ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {thread.preview}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(parseISO(thread.updatedAt), { addSuffix: true })}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="border-t p-3">
          <p className="mb-2 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Pin className="size-3.5" aria-hidden />
            Pinned insights
          </p>
          <div className="space-y-2">
            {pinnedInsights.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">
                Insights appear as your spending builds.
              </p>
            ) : (
              pinnedInsights.map((insight) => (
                <button
                  key={insight.id}
                  type="button"
                  onClick={() => onPrompt(insight.title)}
                  className="w-full rounded-xl border bg-card/80 px-3 py-2.5 text-left shadow-sm transition hover:border-primary/30"
                >
                  <p className="text-sm font-medium leading-snug">{insight.title}</p>
                  {insight.metricValue ? (
                    <p className="mt-1 text-sm text-muted-foreground">{insight.metricValue}</p>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
