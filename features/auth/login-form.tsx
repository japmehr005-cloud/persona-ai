"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { loginAction, type LoginActionState } from "@/lib/auth-actions";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [fingerprintHash, setFingerprintHash] = useState("");

  useEffect(() => {
    // Adaptive Authentication's login-risk score (services/risk-engine/score-login.ts)
    // uses this to recognize a returning device — a missing hash just means
    // the login is scored as "device could not be verified", never a hard block.
    getDeviceFingerprint()
      .then((fingerprint) => setFingerprintHash(fingerprint.fingerprintHash))
      .catch(() => {});
  }, []);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Access your Persona AI dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="fingerprintHash" value={fingerprintHash} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state.error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
        </form>
        <div className="mt-6 space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Demo accounts</p>
          <p>
            Customer: <span className="font-mono text-foreground">demo@securebank.ai</span> /{" "}
            <span className="font-mono text-foreground">demo-password</span>
          </p>
          <p>
            Admin SOC: <span className="font-mono text-foreground">analyst@securebank.ai</span> /{" "}
            <span className="font-mono text-foreground">admin-password</span>
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
