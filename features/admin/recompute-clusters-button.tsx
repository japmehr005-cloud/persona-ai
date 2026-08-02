"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { recomputeClustersAction } from "@/features/admin/fin-actions";
import { Button } from "@/components/ui/button";

export function RecomputeClustersButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        const result = await recomputeClustersAction();
        setIsPending(false);

        if (!result.ok) {
          toast.error(result.error ?? "Something went wrong.");
          return;
        }
        toast.success(
          `Clusters recomputed — ${result.clustersCreated ?? 0} created, ${result.clustersUpdated ?? 0} updated.`
        );
        router.refresh();
      }}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Recompute clusters
    </Button>
  );
}
