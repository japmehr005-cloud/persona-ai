import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck,
  Activity,
  Sparkles,
  KeyRound,
  ArrowRight,
  Fingerprint,
  MapPin,
  BellRing,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Persona AI — AI-Powered Behavioral Fraud Prevention",
};

const FEATURES = [
  {
    icon: Activity,
    title: "Behavioral baseline",
    description:
      "Every customer gets a personal baseline built from spending habits, merchants, timing and device history — no fixed rules.",
  },
  {
    icon: Sparkles,
    title: "Adaptive Risk Engine",
    description:
      "Each transaction is scored in real time against that baseline using amount, velocity, location, device and session signals.",
  },
  {
    icon: BellRing,
    title: "Explainable decisions",
    description:
      "Every flagged transaction ships with a plain-language reason, so customers and analysts understand exactly why.",
  },
  {
    icon: KeyRound,
    title: "Context-Bound OTP",
    description:
      "Step-up verification is bound to the exact transaction context and only triggers once risk crosses a defined threshold.",
  },
];

const SIGNALS = [
  { icon: Fingerprint, label: "Device & session history" },
  { icon: MapPin, label: "Location & merchant history" },
  { icon: Activity, label: "Spending & frequency patterns" },
  { icon: ShieldCheck, label: "Beneficiary & channel history" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </span>
            Persona AI
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#platform" className="transition-colors hover:text-foreground">
              Platform
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/demo">Try the demo</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mx-auto">
              AI-Powered Behavioral Fraud Prevention
            </Badge>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Fraud prevention that understands how your customers actually bank.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Persona AI learns each customer&apos;s financial behavior and scores every
              transaction against their own baseline. Step-up verification only appears when
              something genuinely looks out of character.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/demo">
                  Try the demo workspace
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in to your account</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/40 py-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 text-sm text-muted-foreground sm:px-6 lg:px-8">
            {SIGNALS.map((signal) => (
              <span key={signal.label} className="flex items-center gap-2">
                <signal.icon className="size-4 text-primary" />
                {signal.label}
              </span>
            ))}
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              A layered security model, not a single rule engine
            </h2>
            <p className="mt-3 text-muted-foreground">
              Context-Bound OTP is the last line of defense — not the product. Everything above it
              is designed to reduce unnecessary friction for legitimate customers.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="space-y-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <feature.icon className="size-4.5" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-t border-border bg-secondary/40 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                How Persona AI evaluates a transaction
              </h2>
            </div>
            <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "01",
                  title: "Establish baseline",
                  description: "Import statements to learn typical amounts, merchants and timing.",
                },
                {
                  step: "02",
                  title: "Score in context",
                  description: "Every transaction is compared to the baseline plus live session signals.",
                },
                {
                  step: "03",
                  title: "Explain the result",
                  description: "Elevated risk always comes with a plain-language explanation.",
                },
                {
                  step: "04",
                  title: "Step up only when needed",
                  description: "Context-Bound OTP appears only above the configured risk threshold.",
                },
              ].map((item) => (
                <li key={item.step} className="space-y-2">
                  <span className="text-sm font-semibold text-primary">{item.step}</span>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} Persona AI. All rights reserved.</span>
          <span>Built as a demonstration platform. Not a licensed financial institution.</span>
        </div>
      </footer>
    </div>
  );
}
