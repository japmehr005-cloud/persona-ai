"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import {
  confirmTotpEnrollmentAction,
  disableTotpAction,
  startTotpEnrollmentAction,
} from "@/features/settings/settings-actions";
import type { TotpEnrollmentView } from "@/services/auth/totp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={
            enabled
              ? "flex size-9 items-center justify-center rounded-full bg-success/10 text-success"
              : "flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
          }
        >
          {enabled ? <ShieldCheck className="size-4.5" /> : <ShieldOff className="size-4.5" />}
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Authenticator app</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Two-factor authentication is enabled." : "Not yet enabled."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={enabled ? "success" : "outline"}>{enabled ? "Enabled" : "Disabled"}</Badge>
        {enabled ? <DisableTotpDialog /> : <EnableTotpDialog />}
      </div>
    </div>
  );
}

function EnableTotpDialog() {
  const [open, setOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<TotpEnrollmentView | null>(null);
  const [code, setCode] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) {
      setEnrollment(null);
      setCode("");
      setError(null);
      return;
    }

    setIsStarting(true);
    setError(null);
    const response = await startTotpEnrollmentAction();
    setIsStarting(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }
    setEnrollment(response.data);
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setError(null);
    const response = await confirmTotpEnrollmentAction({ code });
    setIsConfirming(false);

    if (!response.ok) {
      setError(response.error);
      setCode("");
      return;
    }
    toast.success("Two-factor authentication enabled.");
    setOpen(false);
    setEnrollment(null);
    setCode("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Set up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up two-factor authentication</DialogTitle>
          <DialogDescription>
            Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password), then enter
            the 6-digit code it generates.
          </DialogDescription>
        </DialogHeader>

        {isStarting && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isStarting && enrollment && (
          <div className="space-y-4">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, not a Next-optimizable remote asset */}
              <img
                src={enrollment.qrCodeDataUrl}
                alt="Scan this QR code with your authenticator app"
                className="size-48 rounded-lg border border-border p-2"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Can&apos;t scan? Enter this key manually:</p>
              <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground break-all">
                {enrollment.secret}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                disabled={isConfirming}
                aria-label="6-digit setup code"
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            className="w-full"
            disabled={!enrollment || code.length !== 6 || isConfirming}
            onClick={handleConfirm}
          >
            {isConfirming && <Loader2 className="animate-spin" />}
            Confirm and enable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisableTotpDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDisable = async () => {
    setIsSubmitting(true);
    setError(null);
    const response = await disableTotpAction({ code });
    setIsSubmitting(false);

    if (!response.ok) {
      setError(response.error);
      setCode("");
      return;
    }
    toast.success("Two-factor authentication disabled.");
    setOpen(false);
    setCode("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setCode("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Disable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
          <DialogDescription>
            Enter a current code from your authenticator app to confirm you still control it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            disabled={isSubmitting}
            aria-label="6-digit disable code"
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="destructive"
            className="w-full"
            disabled={code.length !== 6 || isSubmitting}
            onClick={handleDisable}
          >
            {isSubmitting && <Loader2 className="animate-spin" />}
            Disable two-factor authentication
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
