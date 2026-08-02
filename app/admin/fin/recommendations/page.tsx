import type { Metadata } from "next";

import { getAiRecommendationsAction } from "@/features/admin/recommendation-actions";
import { AiRecommendationCenter } from "@/features/admin/ai-recommendation-center";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "AI Recommendation Center" };

export default async function AiRecommendationsPage() {
  const recommendations = await getAiRecommendationsAction();

  return (
    <PageContainer className="max-w-[1400px]">
      <PageHeader
        title="AI Recommendation Center"
        description="Continuously evaluates every customer using Risk Engine, FIN clusters, device intelligence, fraud reports, and government FRI/MNRL signals."
      />
      <AiRecommendationCenter initial={recommendations} />
    </PageContainer>
  );
}
