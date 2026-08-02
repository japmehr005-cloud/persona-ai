"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { markLocationTrustedAction } from "@/features/fin/fraud-report-actions";
import { Button } from "@/components/ui/button";

export function MarkLocationTrustedButton({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        const result = await markLocationTrustedAction(locationId);
        setIsPending(false);
        if (!result.ok) {
          toast.error(result.error ?? "Something went wrong.");
          return;
        }
        toast.success("Location marked as trusted.");
        router.refresh();
      }}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <MapPin />}
      Mark as trusted
    </Button>
  );
}
