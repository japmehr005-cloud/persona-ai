export type AssistantBlock =
  | {
      type: "risk-summary";
      title: string;
      score: number | null;
      tier: string | null;
      reasons: string[];
      recommendation: string;
      explanation?: string | null;
    }
  | {
      type: "stat-grid";
      title: string;
      stats: Array<{ label: string; value: string; hint?: string; tone?: "neutral" | "positive" | "warning" | "critical" }>;
    }
  | {
      type: "transaction-table";
      title: string;
      rows: Array<{
        merchant: string;
        amount: string;
        category: string;
        date: string;
        riskTier?: string | null;
        id?: string;
      }>;
    }
  | {
      type: "category-chart";
      title: string;
      data: Array<{ category: string; amount: number }>;
    }
  | {
      type: "trend-chart";
      title: string;
      data: Array<{ month: string; amount: number }>;
    }
  | {
      type: "merchant-list";
      title: string;
      merchants: Array<{ merchant: string; amount: string; count?: number }>;
    }
  | {
      type: "timeline";
      title: string;
      events: Array<{
        label: string;
        detail: string;
        tone?: "neutral" | "warning" | "critical" | "positive";
      }>;
    }
  | {
      type: "action-row";
      actions: Array<{
        label: string;
        href?: string;
        prompt?: string;
        variant?: "default" | "outline" | "secondary";
      }>;
    }
  | {
      type: "alert-callout";
      severity: "info" | "warning" | "critical";
      title: string;
      body: string;
    }
  | {
      type: "savings-card";
      title: string;
      amount: string;
      detail: string;
      tips: string[];
    };

export interface AssistantMeta {
  blocks: AssistantBlock[];
  followUps: string[];
}

export const PERSONA_META_MARKER = "%%PERSONA_META%%";

export function serializeAssistantPayload(markdown: string, meta: AssistantMeta): string {
  return `${markdown.trim()}\n\n${PERSONA_META_MARKER}\n${JSON.stringify(meta)}`;
}

export function parseAssistantPayload(raw: string): {
  markdown: string;
  meta: AssistantMeta | null;
  complete: boolean;
} {
  const idx = raw.indexOf(PERSONA_META_MARKER);
  if (idx === -1) {
    return { markdown: raw, meta: null, complete: false };
  }
  const markdown = raw.slice(0, idx).trim();
  const jsonPart = raw.slice(idx + PERSONA_META_MARKER.length).trim();
  try {
    const meta = JSON.parse(jsonPart) as AssistantMeta;
    return { markdown, meta, complete: true };
  } catch {
    return { markdown, meta: null, complete: false };
  }
}

export function stripMetaForSpeech(raw: string): string {
  const { markdown } = parseAssistantPayload(raw);
  return markdown
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
