"use client";

import { useState } from "react";
import { Fingerprint, KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { updatePreferredAuthMethodAction } from "@/features/settings/settings-actions";
import { cn } from "@/lib/utils";
import type { PreferredAuthMethod } from "@prisma/client";

interface AuthMethodOption {
  value: PreferredAuthMethod | null;
  label: string;
  description: string;
  icon: typeof KeyRound;
  requires?: "biometric" | "authenticator";
}

const AUTH_METHOD_OPTIONS: AuthMethodOption[] = [
  {
    value: null,
    label: "Standard (password only)",
    description: "Fastest sign-in. Persona AI may still ask for a one-time code if a sign-in looks unusual.",
    icon: KeyRound,
  },
  {
    value: "PASSWORD_OTP",
    label: "Password + one-time code",
    description: "A 6-digit code is sent to your email every time you sign in, bound to this device and session.",
    icon: Smartphone,
  },
  {
    value: "PASSWORD_BIOMETRIC",
    label: "Password + biometric",
    description: "Sign in with your device's fingerprint, face, or security key (WebAuthn).",
    icon: Fingerprint,
    requires: "biometric",
  },
  {
    value: "AUTHENTICATOR",
    label: "Authenticator app",
    description: "Use a time-based code from Google Authenticator, Microsoft Authenticator, or similar.",
    icon: ShieldCheck,
    requires: "authenticator",
  },
];

export function SignInMethodSection({
  currentMethod,
  hasBiometricCredential,
  hasAuthenticatorEnabled,
}: {
  currentMethod: PreferredAuthMethod | null;
  hasBiometricCredential: boolean;
  hasAuthenticatorEnabled: boolean;
}) {
  const [selected, setSelected] = useState<PreferredAuthMethod | null>(currentMethod);
  const [isSaving, setIsSaving] = useState(false);

  const isDisabled = (option: AuthMethodOption) => {
    if (option.requires === "biometric") return !hasBiometricCredential;
    if (option.requires === "authenticator") return !hasAuthenticatorEnabled;
    return false;
  };

  const handleSelect = async (option: AuthMethodOption) => {
    if (isDisabled(option) || isSaving || option.value === selected) return;

    setIsSaving(true);
    const response = await updatePreferredAuthMethodAction({ method: option.value });
    setIsSaving(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    setSelected(option.value);
    toast.success(`Sign-in method updated to ${option.label}.`);
  };

  return (
    <div role="radiogroup" aria-label="Sign-in method" className="grid gap-3 sm:grid-cols-2">
      {AUTH_METHOD_OPTIONS.map((option) => {
        const disabled = isDisabled(option);
        const active = selected === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || isSaving}
            onClick={() => handleSelect(option)}
            className={cn(
              "flex min-h-[44px] flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
              active ? "border-primary bg-accent" : "border-border hover:bg-muted/40",
              (disabled || isSaving) && "cursor-not-allowed opacity-60"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {isSaving && active ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
              </span>
              <p className="text-sm font-medium text-foreground">{option.label}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {disabled
                ? option.requires === "biometric"
                  ? "Register a biometric device below to unlock this option."
                  : "Set up your authenticator app below to unlock this option."
                : option.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
