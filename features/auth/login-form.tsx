"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  completeDemoBiometricLoginAction,
  loginAction,
  type LoginActionState,
} from "@/lib/auth-actions";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { cn } from "@/lib/utils";
import { LoginSeniorToggle } from "@/features/auth/login-senior-toggle";
import { LoginVoiceHelper } from "@/features/auth/login-voice-helper";
import { Badge } from "@/components/ui/badge";
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

type AuthMethod = "PASSWORD_OTP" | "PASSWORD_BIOMETRIC" | "AUTHENTICATOR";
type Step = "method" | "credentials" | "biometric" | "success";

const initialState: LoginActionState = {};

const DEMO_ACCOUNTS = [
  {
    role: "Customer",
    email: "demo@securebank.ai",
    password: "demo-password",
  },
  {
    role: "Admin",
    email: "analyst@securebank.ai",
    password: "admin-password",
  },
] as const;

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [fingerprintHash, setFingerprintHash] = useState("");
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<AuthMethod | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [biometricToken, setBiometricToken] = useState<string | null>(null);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [isBiometricPending, startBiometricTransition] = useTransition();
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    getDeviceFingerprint()
      .then((fingerprint) => setFingerprintHash(fingerprint.fingerprintHash))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (state.demoBiometricToken) {
      setBiometricToken(state.demoBiometricToken);
      setStep("biometric");
    }
  }, [state.demoBiometricToken]);

  const methods: {
    id: AuthMethod;
    title: string;
    security: string;
    convenience: string;
    recommended?: boolean;
    icon: typeof KeyRound;
  }[] = [
    {
      id: "PASSWORD_OTP",
      title: t("methodOtpTitle"),
      security: t("methodOtpSecurity"),
      convenience: t("methodOtpConvenience"),
      recommended: true,
      icon: Smartphone,
    },
    {
      id: "PASSWORD_BIOMETRIC",
      title: t("methodBiometricTitle"),
      security: t("methodBiometricSecurity"),
      convenience: t("methodBiometricConvenience"),
      icon: Fingerprint,
    },
    {
      id: "AUTHENTICATOR",
      title: t("methodAuthenticatorTitle"),
      security: t("methodAuthenticatorSecurity"),
      convenience: t("methodAuthenticatorConvenience"),
      icon: ShieldCheck,
    },
  ];

  const selectMethod = (next: AuthMethod) => {
    setMethod(next);
    setStep("credentials");
  };

  const autofill = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    if (step === "method") setStep("credentials");
  };

  const runBiometricSimulation = () => {
    if (!biometricToken || !method) return;
    setBiometricError(null);
    setScanning(true);

    window.setTimeout(() => {
      startBiometricTransition(async () => {
        const result = await completeDemoBiometricLoginAction({
          token: biometricToken,
          email,
          password,
        });
        setScanning(false);
        if (result.error) {
          setBiometricError(result.error);
          return;
        }
        setStep("success");
      });
    }, 1400);
  };

  return (
    <Card className="w-full max-w-md border-border/80 shadow-sm">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Persona AI
            </p>
            <CardTitle className="mt-1 text-2xl tracking-tight">{t("loginTitle")}</CardTitle>
            <CardDescription className="mt-1.5 text-base leading-relaxed">
              {step === "method" ? t("chooseMethodDescription") : t("loginDescription")}
            </CardDescription>
          </div>
          {step !== "method" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              onClick={() => {
                setStep("method");
                setBiometricToken(null);
                setBiometricError(null);
              }}
              aria-label={t("back")}
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2" aria-hidden={step === "method"}>
          {(["method", "credentials", "factor"] as const).map((key, index) => {
            const active =
              (key === "method" && step === "method") ||
              (key === "credentials" && step === "credentials") ||
              (key === "factor" && (step === "biometric" || step === "success"));
            const done =
              (key === "method" && step !== "method") ||
              (key === "credentials" && (step === "biometric" || step === "success"));
            return (
              <div key={key} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    active || done ? "bg-primary" : "bg-muted"
                  )}
                />
                {index < 2 ? null : null}
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <AnimatePresence mode="wait">
          {step === "method" ? (
            <motion.div
              key="method"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <p className="text-sm font-medium text-foreground">{t("chooseSignInMethod")}</p>
              {methods.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectMethod(item.id)}
                    className={cn(
                      "flex w-full min-h-11 items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors",
                      "hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Icon className="size-5 text-foreground" />
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-foreground">{item.title}</span>
                        {item.recommended && (
                          <Badge variant="secondary" className="text-xs">
                            {t("recommended")}
                          </Badge>
                        )}
                      </span>
                      <span className="block text-sm text-muted-foreground">{item.security}</span>
                      <span className="block text-xs text-muted-foreground">{item.convenience}</span>
                    </span>
                  </button>
                );
              })}
            </motion.div>
          ) : step === "biometric" ? (
            <motion.div
              key="biometric"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 text-center"
            >
              <div
                className={cn(
                  "mx-auto flex size-24 items-center justify-center rounded-full border-2 transition-colors",
                  scanning
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground"
                )}
              >
                {scanning ? (
                  <Loader2 className="size-10 animate-spin" />
                ) : (
                  <Fingerprint className="size-10" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">{t("biometricPromptTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("biometricPromptDescription")}</p>
              </div>
              {(biometricError || state.error) && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {biometricError || state.error}
                </p>
              )}
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={scanning || isBiometricPending}
                onClick={runBiometricSimulation}
              >
                {(scanning || isBiometricPending) && <Loader2 className="animate-spin" />}
                {scanning || isBiometricPending ? t("biometricScanning") : t("biometricContinue")}
              </Button>
            </motion.div>
          ) : step === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-8"
            >
              <CheckCircle2 className="size-12 text-emerald-600" />
              <p className="text-base font-medium">{t("signInSuccess")}</p>
            </motion.div>
          ) : (
            <motion.div
              key="credentials"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {method && (
                <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <KeyRound className="size-4" />
                  {methods.find((item) => item.id === method)?.title}
                </p>
              )}
              <form action={formAction} className="space-y-4" noValidate>
                <input type="hidden" name="fingerprintHash" value={fingerprintHash} />
                <input type="hidden" name="requestedAuthMethod" value={method ?? ""} />
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-h-11"
                  />
                </div>
                {state.error && !state.demoBiometricToken && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {state.error}
                  </p>
                )}
                <Button type="submit" className="min-h-11 w-full" disabled={isPending || !method}>
                  {isPending && <Loader2 className="animate-spin" />}
                  {isPending ? t("signingIn") : t("continue")}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("demoAccounts")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => autofill(account)}
                className="min-h-11 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-sm font-medium text-foreground">{account.role}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{account.email}</p>
              </button>
            ))}
          </div>
        </div>

        <LoginSeniorToggle />
        <div className="flex justify-center">
          <LoginVoiceHelper />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("createAccount")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
