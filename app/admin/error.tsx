"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/layout/page-container";

export default function AdminSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Persona AI] Admin route error:", error);
  }, [error]);

  return (
    <PageContainer>
      <EmptyState
        icon={AlertTriangle}
        title="We couldn't load this page"
        description="Something went wrong while fetching this data. Please try again."
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
