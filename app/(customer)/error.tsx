"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/layout/page-container";

export default function CustomerSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Persona AI] Customer route error:", error);
  }, [error]);

  return (
    <PageContainer>
      <EmptyState
        icon={AlertTriangle}
        title="We couldn't load this page"
        description="Something went wrong while fetching your data. Please try again."
        action={
          <Button variant="outline" onClick={() => reset()}>
            <RotateCw />
            Try again
          </Button>
        }
      />
    </PageContainer>
  );
}
