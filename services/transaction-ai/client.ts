import { mapAiCategoryToApp } from "@/services/transaction-ai/category-map";

export interface AiProbability {
  label: string;
  p: number;
}

export interface TransactionAiClassification {
  category: string;
  appCategory: string;
  confidence: number;
  probabilities: AiProbability[];
  model: string | null;
}

const DEFAULT_URL = "http://127.0.0.1:8001";
const DEFAULT_TIMEOUT_MS = 800;
/** AI category replaces keyword categorizer only above this confidence. */
export const AI_CATEGORY_CONFIDENCE_THRESHOLD = 0.55;

function getBaseUrl(): string {
  return (process.env.TRANSACTION_AI_URL ?? DEFAULT_URL).replace(/\/$/, "");
}

function getTimeoutMs(): number {
  const raw = process.env.TRANSACTION_AI_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : DEFAULT_TIMEOUT_MS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * Calls the Transaction Intelligence FastAPI sidecar.
 * Returns null on timeout / network / non-2xx so callers can fall back.
 */
export async function classifyTransactionNarration(
  narration: string
): Promise<TransactionAiClassification | null> {
  const trimmed = narration.trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(`${getBaseUrl()}/api/ai/classify-transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ narration: trimmed.slice(0, 2000) }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("[transaction-ai] classify failed", response.status);
      return null;
    }

    const data = (await response.json()) as {
      category?: string;
      confidence?: number;
      probabilities?: AiProbability[];
      model?: string | null;
    };

    if (!data.category || typeof data.confidence !== "number") {
      return null;
    }

    return {
      category: data.category,
      appCategory: mapAiCategoryToApp(data.category),
      confidence: Math.max(0, Math.min(1, data.confidence)),
      probabilities: Array.isArray(data.probabilities) ? data.probabilities : [],
      model: data.model ?? null,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    if (name !== "AbortError") {
      console.warn("[transaction-ai] unavailable:", error instanceof Error ? error.message : error);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Prefer AI category when the service is up and confidence is high enough;
 * otherwise keep the keyword/hint category.
 */
export async function resolveTransactionCategory(params: {
  merchant: string;
  keywordCategory: string;
  narration?: string;
}): Promise<{ category: string; ai: TransactionAiClassification | null }> {
  const narration = params.narration?.trim() || params.merchant;
  const ai = await classifyTransactionNarration(narration);
  if (ai && ai.confidence >= AI_CATEGORY_CONFIDENCE_THRESHOLD) {
    return { category: ai.appCategory, ai };
  }
  return { category: params.keywordCategory, ai };
}
