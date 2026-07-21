"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";

import { verifyTwoFactorLoginAction, type VerifyTwoFactorActionState } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const initialState: VerifyTwoFactorActionState = {};

export function TwoFactorVerifyForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(verifyTwoFactorLoginAction, initialState);
  const [code, setCode] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="code" value={code} />

      <div className="flex flex-col items-center gap-2">
        <InputOTP maxLength={6} value={code} onChange={setCode} disabled={isPending} aria-label="6-digit authenticator code">
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {state.error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={code.length !== 6 || isPending}>
        {isPending && <Loader2 className="animate-spin" />}
        Verify and sign in
      </Button>
    </form>
  );
}
