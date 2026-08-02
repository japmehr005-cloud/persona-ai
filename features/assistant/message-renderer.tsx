"use client";

import ReactMarkdown from "react-markdown";

import { ResponseBlocks } from "@/features/assistant/response-blocks";
import {
  parseAssistantPayload,
  type AssistantMeta,
} from "@/services/assistant/blocks";
import { cn } from "@/lib/utils";

export function MessageRenderer({
  content,
  role,
  streaming,
  onPrompt,
}: {
  content: string;
  role: "user" | "assistant" | "system";
  streaming?: boolean;
  onPrompt: (prompt: string) => void;
}) {
  if (role === "user") {
    return (
      <div className="ml-auto w-[min(100%,42rem)] max-w-[94%] rounded-2xl bg-primary px-4 py-3 text-base leading-relaxed text-primary-foreground shadow-sm sm:max-w-[85%]">
        {content}
      </div>
    );
  }

  const { markdown, meta } = parseAssistantPayload(content);
  const followUps = meta?.followUps ?? [];

  return (
    <div className="mr-auto w-full max-w-[940px] space-y-3">
      <div
        className={cn(
          "rounded-2xl border border-border/70 bg-card/90 px-3 py-3.5 text-base leading-relaxed shadow-sm backdrop-blur-sm sm:px-5 sm:py-4",
          streaming && "ring-1 ring-primary/20"
        )}
      >
        <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-4 prose-headings:font-semibold prose-p:my-2 prose-pre:overflow-x-auto prose-table:block prose-table:overflow-x-auto prose-th:text-left prose-td:align-top prose-ul:my-2">
          <ReactMarkdown>{markdown || (streaming ? "_Persona AI is composing…_" : "")}</ReactMarkdown>
        </div>
        {meta ? <ResponseBlocks blocks={meta.blocks} onPrompt={onPrompt} /> : null}
        {streaming && !meta ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex gap-1" aria-hidden>
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary" />
            </span>
            Gathering sources and charts…
          </div>
        ) : null}
      </div>

      {followUps.length > 0 && !streaming ? (
        <div className="flex gap-2 overflow-x-auto pb-1 pl-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {followUps.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onPrompt(item)}
              className="min-h-11 shrink-0 rounded-full border bg-background/80 px-3.5 text-sm text-foreground shadow-sm transition hover:border-primary/40 hover:bg-muted"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function getAssistantMeta(content: string): AssistantMeta | null {
  return parseAssistantPayload(content).meta;
}
