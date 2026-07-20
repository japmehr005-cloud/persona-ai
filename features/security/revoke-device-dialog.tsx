"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { revokeDeviceAction } from "@/features/security/device-actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function RevokeDeviceDialog({ deviceId, label }: { deviceId: string; label: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 />
          Revoke
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke &quot;{label}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This device will no longer be recognized as trusted. Future transactions from it may
            require additional verification.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={async (event) => {
              event.preventDefault();
              setIsPending(true);
              await revokeDeviceAction(deviceId);
              setIsPending(false);
              toast.success("Device revoked.");
              router.refresh();
            }}
          >
            {isPending && <Loader2 className="animate-spin" />}
            Revoke device
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
