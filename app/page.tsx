import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck,
  Activity,
  Sparkles,
  ArrowRight,
  BrainCircuit,
  Network,
  PhoneCall,
  KeyRound,
  MessageSquareText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Persona AI — Hybrid AI Fraud Detection powered by FIN",
};

const FEATURES = [
  {
    icon: Activity,
    title: "Behavioural Intelligence",
    description:
      "Learns each customer's unique spending habits, login patterns, trusted devices and transaction behaviour to build a continuously evolving baseline instead of relying on fixed rules.",
  },
  {
    icon: Network,
    title: "Fraud Intelligence Network (FIN)",
    description:
      "Correlates suspicious devices, beneficiaries, merchants, fraud reports and behavioural signals across customers to uncover fraud patterns invisible to individual accounts.",
  },
  {
    icon: Sparkles,
    title: "Hybrid AI Risk Engine",
    description:
      "Combines behavioural scoring, machine learning predictions, rule-based detection and FIN intelligence into one explainable decision instead of relying on a single model.",
  },
  {
    icon: PhoneCall,
    title: "Social Engineering Protection",
    description:
      "Detects high-risk payment conditions such as active phone calls, remote access scenarios and suspicious payment behaviour to pause transactions before authorization.",
  },
];

const SIGNALS = [
  { icon: Activity, label: "Behavioural Intelligence" },
  { icon: Network, label: "FIN Intelligence Network" },
  { icon: BrainCircuit, label: "Machine Learning" },
  { icon: PhoneCall, label: "Social Engineering Protection" },
  { icon: KeyRound, label: "Adaptive Authentication" },
  { icon: MessageSquareText, label: "Explainable AI" },
];

const PIPELINE = [
  {
    step: "01",
    title: "Behavioural Intelligence",
    description: "Personal baselines from spending, logins, devices and transaction habits.",
  },
  {
    step: "02",
    title: "Transaction ML Model",
    description: "Machine learning predictions on live payment and session features.",
  },
  {
    step: "03",
    title: "Rule Engine",
    description: "Deterministic policy checks that catch known high-risk patterns.",
  },
  {
    step: "04",
    title: "FIN Intelligence Network",
    description: "Cross-customer correlation of devices, beneficiaries and fraud reports.",
  },
  {
    step: "05",
    title: "Device Intelligence",
    description: "Trusted devices, fingerprints and integrity signals for this session.",
  },
  {
    step: "06",
    title: "Social Engineering Protection",
    description: "Independent pause layer for active calls and coercion-style payment risk.",
  },
  {
    step: "07",
    title: "Adaptive Authentication",
    description: "Step-up only when risk or protection layers require stronger verification.",
  },
  {
    step: "08",
    title: "Unified Explainable Risk Decision",
    description:
      "One clear outcome with score, factors and plain-language explanation for customers and the SOC.",
  },
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
              Powered by the Fraud Intelligence Network (FIN)
            </Badge>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Hybrid AI fraud detection with FIN, behavioural intelligence and social engineering
              protection.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Persona AI unites machine learning, behavioural baselines and the Fraud Intelligence
              Network into one explainable decision pipeline — then pauses high-risk payments when
              social engineering signals appear, before money moves.
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
              Hybrid detection across behaviour, ML, rules and FIN — with Persona AI as an
              intelligent financial copilot that explains fraud decisions, reviews login activity,
              analyzes spending, recommends savings, supports English, Hindi and Punjabi with voice
              interaction, and uses real account context. Analysts operate a Security Operations
              Center powered by FIN for cross-customer fraud correlation, live incident monitoring,
              relationship analysis, explainable AI recommendations and device intelligence.
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
                How Persona AI reaches a unified explainable risk decision
              </h2>
              <p className="mt-3 text-muted-foreground">
                Every payment runs through our hybrid decision pipeline — not a single model or a
                single rule.
              </p>
            </div>
            <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((item) => (
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
