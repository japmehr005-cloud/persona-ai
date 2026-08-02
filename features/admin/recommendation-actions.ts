"use server";

import { requireAnalyst } from "@/lib/session";
import { getAiRecommendations, type AiRecommendation } from "@/services/admin/get-ai-recommendations";

export type { AiRecommendation };

export async function getAiRecommendationsAction(): Promise<AiRecommendation[]> {
  await requireAnalyst();
  return getAiRecommendations();
}
