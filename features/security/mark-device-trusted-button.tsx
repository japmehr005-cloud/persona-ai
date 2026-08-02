"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { markDeviceTrustedAction } from "@/features/security/device-actions";
import { Button } from "@/components/ui/button";

export function MarkDeviceTrustedButton({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        await markDeviceTrustedAction(deviceId);
        setIsPending(false);
        toast.success("Device marked as trusted.");
        router.refresh();
      }}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
      Mark as trusted
    </Button>
  );
}
