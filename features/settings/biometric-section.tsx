"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Fingerprint, Loader2, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";

import {
  finishWebAuthnRegistrationAction,
  removeWebAuthnCredentialAction,
  startWebAuthnRegistrationAction,
} from "@/features/settings/settings-actions";
import type { WebAuthnCredentialView } from "@/services/auth/webauthn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function defaultDeviceLabel() {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone/iPad";
  if (/Android/.test(ua)) return "Android device";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "This device";
}

export function BiometricSection({ credentials }: { credentials: WebAuthnCredentialView[] }) {
  const enabled = credentials.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={
              enabled
                ? "flex size-9 items-center justify-center rounded-full bg-success/10 text-success"
                : "flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
            }
          >
            {enabled ? <Fingerprint className="size-4.5" /> : <ShieldOff className="size-4.5" />}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Platform authenticator</p>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? `${credentials.length} registered credential${credentials.length === 1 ? "" : "s"}.`
                : "Not yet registered."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={enabled ? "success" : "outline"}>{enabled ? "Enabled" : "Disabled"}</Badge>
          <RegisterCredentialDialog />
        </div>
      </div>

      {credentials.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {credentials.map((credential) => (
            <CredentialRow key={credential.id} credential={credential} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CredentialRow({ credential }: { credential: WebAuthnCredentialView }) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    setIsRemoving(true);
    const response = await removeWebAuthnCredentialAction(credential.id);
    setIsRemoving(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success("Credential removed.");
  };

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{credential.deviceLabel}</p>
        <p className="text-xs text-muted-foreground">
          Added {format(credential.createdAt, "MMM d, yyyy")}
          {credential.lastUsedAt ? ` · Last used ${format(credential.lastUsedAt, "MMM d, yyyy")}` : ""}
        </p>
      </div>
      <Button variant="ghost" size="icon" disabled={isRemoving} onClick={handleRemove} aria-label="Remove credential">
        {isRemoving ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </li>
  );
}

function RegisterCredentialDialog() {
  const [open, setOpen] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState(defaultDeviceLabel());
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setIsRegistering(true);
    setError(null);

    try {
      const optionsResponse = await startWebAuthnRegistrationAction();
      if (!optionsResponse.ok) {
        setError(optionsResponse.error);
        return;
      }

      const attestation = await startRegistration(optionsResponse.data);

      const finishResponse = await finishWebAuthnRegistrationAction(attestation, { deviceLabel });
      if (!finishResponse.ok) {
        setError(finishResponse.error);
        return;
      }

      toast.success("Device registered for biometric verification.");
      setOpen(false);
    } catch {
      setError("Registration was cancelled or is not supported on this device.");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setDeviceLabel(defaultDeviceLabel());
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Add device
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register this device</DialogTitle>
          <DialogDescription>
            Your browser will prompt for your device&apos;s fingerprint, face, or security key. Give this
            device a name so you can recognize it later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="device-label">Device name</Label>
          <Input
            id="device-label"
            value={deviceLabel}
            onChange={(event) => setDeviceLabel(event.target.value)}
            disabled={isRegistering}
            maxLength={60}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button className="w-full" disabled={!deviceLabel.trim() || isRegistering} onClick={handleRegister}>
            {isRegistering && <Loader2 className="animate-spin" />}
            Continue with biometric prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
