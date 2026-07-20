# Persona AI

Persona AI — AI-Powered Behavioral Fraud Prevention — is a behavioral fraud-prevention
layer for digital banking. It builds a personal behavioral baseline for every customer,
scores transactions against that baseline in real time with an explainable Adaptive
Risk Engine, and steps up authentication with a Context-Bound OTP (CB-OTP) only when a
transaction actually warrants it — rather than showing every customer a persistent,
anxiety-inducing risk score.

The interface is designed to read like a modern banking product (Mercury, Stripe
Dashboard, Ramp, Revolut Business) rather than a hackathon demo: no gamification, no
raw ML jargon on customer-facing screens, and every security action is explained in
plain language.

## Contents

- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Project structure](#project-structure)
- [Feature tour](#feature-tour)
- [How the risk pipeline works](#how-the-risk-pipeline-works)
- [Server actions & services reference](#server-actions--services-reference)
- [Security model](#security-model)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known limitations & roadmap](#known-limitations--roadmap)

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), TypeScript, React 19 |
| Styling | Tailwind CSS v4, shadcn/ui primitives (manually vendored), Lucide icons |
| Forms | React Hook Form + Zod |
| Charts | Recharts, lazy-loaded on data-heavy pages |
| Tables | TanStack Table (sorting + pagination) |
| Notifications | Sonner |
| Auth | Auth.js (NextAuth v5) with a Credentials provider, JWT sessions |
| Database | PostgreSQL via Prisma ORM |
| E2E testing | Playwright |

## Getting started

### Prerequisites

- Node.js 20+
- Docker (for the bundled Postgres container) or an existing PostgreSQL 16 instance

### 1. Install dependencies

```bash
npm install
```

### 2. Start Postgres

```bash
docker compose up -d
```

This starts a local `postgres:16-alpine` container matching the credentials in
`.env.example` (`securebank` / `securebank` / `securebank_ai` on port 5432). If you
already have a Postgres instance, point `DATABASE_URL` at it instead.

### 3. Configure environment variables

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# paste the output into AUTH_SECRET in .env
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Signing secret for Auth.js session JWTs |
| `NEXTAUTH_URL` | Canonical app URL (`http://localhost:3000` locally) |
| `RESEND_API_KEY` / `OTP_EMAIL_FROM` | Optional email delivery for CB-OTP codes. Leave `RESEND_API_KEY` unset to log codes to the server console and surface them directly in the UI instead — the safe default for local development and demos |
| `NEXT_PUBLIC_DEMO_MODE_ENABLED` | Gates the Context Signal Simulator (`/dev/context-simulator`) and the "Explore with a demo workspace" entry point |

### 4. Set up the database

```bash
npx prisma migrate dev
npm run db:seed
```

Seeding creates a demo customer and an analyst/admin account, and — if the demo
account has no transaction history yet — generates ~100 days of realistic synthetic
transactions so its behavioral baseline is populated immediately (see
[Demo accounts](#demo-accounts)).

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer (demo workspace) | `demo@securebank.ai` | `demo-password` |
| Admin / analyst | `analyst@securebank.ai` | `admin-password` |

The demo customer is pre-seeded with realistic transaction history so its behavioral
profile, spending charts, and risk scoring all work out of the box. From `/login`,
"Explore with a demo workspace" signs into this account directly.

## Project structure

```
app/                    Routes (App Router), grouped by (marketing) / (customer) / admin
components/             Shared UI: shadcn primitives, charts, layout, shared widgets
features/               Client-facing feature modules (forms, dialogs, server actions)
services/               Business logic and data access, organized by domain:
  risk-engine/            Adaptive Risk Engine (factor evaluators, scorer, thresholds)
  behavior-engine/        Behavioral baseline calculation
  otp-engine/             CB-OTP challenge creation, delivery, verification
  explainability/         Human-readable risk explanations
  context-signals/        Context Signal Simulator (demo call/SMS/location events)
  admin/                  Admin console read models
  audit/                  Audit logging and trail retrieval
lib/                    Cross-cutting utilities: auth, session, rate limiting, constants
prisma/                 Schema, migrations, and seed data
e2e/                    Playwright end-to-end tests
scripts/                One-off diagnostic scripts used during development
```

Business logic always lives in `services/`, never inside components — routes and
client components call into `features/*-actions.ts` (Next.js Server Actions), which
delegate to `services/`.

## Feature tour

| Area | Route | Notes |
| --- | --- | --- |
| Marketing | `/`, `/login`, `/register`, `/demo` | Public pages; demo workspace entry point |
| Dashboard | `/dashboard` | Balance, spending, security status, alerts preview, behavioral snapshot |
| Transactions | `/transactions`, `/transactions/[id]` | Searchable ledger, transaction detail with risk breakdown and audit trail |
| Statement import | `/transactions/import` | CSV upload → column mapping → preview → import |
| Behavioral profile | `/security/behavior` | Typical amount, active hours, top merchants |
| Devices & sessions | `/security/devices` | Trusted device management |
| Alerts | `/alerts`, `/alerts/[id]` | Customer-facing alert inbox and detail |
| Step-up auth | `/verify/otp` | CB-OTP entry screen for transactions that require it |
| Context Signal Simulator | `/dev/context-simulator` | Demo-only: inject simulated call/SMS/location signals |
| Admin overview | `/admin` | KPIs, risk distribution, recent alerts, top flagged transactions |
| Admin user directory | `/admin/users`, `/admin/users/[id]` | Customer search and full drill-down |
| Flagged queue | `/admin/transactions/flagged` | Approve/deny transactions awaiting review |
| Admin alerts | `/admin/alerts` | System-wide alert feed with disposition actions |
| Analytics | `/admin/analytics` | Alert volume trend, disposition breakdown, category risk |

## How the risk pipeline works

```mermaid
flowchart LR
  A[Transaction created] --> B[Context bundle]
  B --> C[Adaptive Risk Engine]
  C --> D{Score}
  D -->|"< 31 (LOW)"| E[Auto-approved]
  D -->|31-70 (MEDIUM)| F[Flagged for review]
  D -->|">= otpThreshold (default 71)"| G[CB-OTP challenge]
  G -->|Correct code| E
  G -->|Expired / max attempts| H[Denied]
```

1. **Context bundle** (`services/risk-engine/context-bundle.ts`) gathers everything
   the engine needs: the customer's behavioral baseline, merchant familiarity, device
   trust, recent transaction velocity, and any active simulated context signals.
2. **Factor evaluators** (`services/risk-engine/factor-evaluators.ts`) each inspect
   one dimension — unusual amount, unfamiliar merchant, unrecognized device, location
   anomaly, off-hours activity, velocity, simulated call/SMS — and contribute 0 or
   more points.
3. **Scorer** (`services/risk-engine/risk-scorer.ts`) sums contributions into a
   0–100 score, maps it to a `LOW` / `MEDIUM` / `HIGH` tier, and decides whether the
   score crosses the customer's `otpThreshold`.
4. **Explainability** (`services/explainability/explanation-builder.ts`) turns the
   contributing factors into a plain-language sentence shown to both customers and
   analysts — every score is explainable, never a black box.
5. **CB-OTP** (`services/otp-engine/`) is only triggered for the highest-risk
   transactions. The one-time code is cryptographically bound to the specific
   transaction's context hash (merchant, amount, beneficiary), so it can't be reused
   for a different payment.

Because a mobile companion SDK and carrier webhook integration are out of scope for
this build, real call/SMS/location signals are represented by the **Context Signal
Simulator** (`/dev/context-simulator`, demo-mode only) so the engine's reaction to
those signals can still be demonstrated end-to-end.

## Server actions & services reference

Business logic is organized by domain under `services/`, and exposed to the UI
through Server Actions under `features/*/`. The main entry points:

| Domain | Server actions | Backing services |
| --- | --- | --- |
| Auth | `lib/auth-actions.ts` (`loginAction`, `registerAction`, `demoLoginAction`, `signOutAction`) | Auth.js Credentials provider (`lib/auth.ts`) |
| Transactions & import | `features/transactions/import-actions.ts`, `simulate-payment-actions.ts` | `services/import/*`, `services/transactions/*` |
| Behavior & risk | — (read-only) | `services/behavior-engine/*`, `services/risk-engine/*`, `services/explainability/*` |
| Security / CB-OTP | `features/security/otp-actions.ts`, `device-actions.ts` | `services/otp-engine/*`, `services/security/*` |
| Context signals | `features/dev/context-signal-actions.ts` | `services/context-signals/*` |
| Alerts | `features/alerts/alert-actions.ts` | `services/alerts/*` |
| Admin | `features/admin/flagged-transaction-actions.ts`, `alert-disposition-actions.ts` | `services/admin/*`, `services/audit/*` |

Nearly every mutation writes an `AuditLog` entry (`services/audit/audit-logger.ts`),
surfaced as a read-only trail on both the customer transaction detail page and the
admin user drill-down page.

## Security model

- **Authentication** — Auth.js (NextAuth v5) with a Credentials provider; passwords
  are hashed with bcrypt. Sessions are signed JWTs (`lib/auth.config.ts`), checked in
  Edge middleware (`middleware.ts`) before any protected route renders.
- **Authorization** — Middleware enforces customer vs. admin/analyst route access;
  every Server Action independently re-validates the session and scopes queries to
  the authenticated user's own data (`requireUser()` in `lib/session.ts`), never
  trusting IDs supplied by the client.
- **Input validation** — All Server Actions validate input with Zod before touching
  the database.
- **Rate limiting** — An in-memory fixed-window limiter (`lib/rate-limit.ts`) guards
  login (8 attempts / 5 min, keyed by email), OTP verification (10 attempts / 2 min,
  keyed by user), CSV import (5 / 10 min), and payment simulation (15 / 5 min). This
  is sufficient for a single-instance deployment; a horizontally scaled deployment
  should swap it for a shared store (Redis / Upstash) so limits apply across
  instances.
- **Step-up authentication** — CB-OTP codes are single-use, expire quickly, are
  capped at a small number of attempts, and are cryptographically bound to the
  specific transaction's context hash (`services/otp-engine/context-hasher.ts`), so a
  leaked code can't authorize a different transaction.
- **Transport & browser hardening** — `next.config.ts` sets a restrictive
  Content-Security-Policy, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, and HSTS in production.
- **Error handling** — Tiered error boundaries (`app/global-error.tsx`,
  `app/error.tsx`, and segment-level boundaries) and not-found pages ensure
  unexpected failures never leak stack traces or internal details to the client.
- **Auditability** — Every risk-relevant action (OTP issuance/verification, admin
  approve/deny, alert disposition) is written to an append-only `AuditLog`.

## Testing

```bash
npm run lint          # ESLint
npx tsc --noEmit      # Type-check
npm run test:e2e       # Playwright end-to-end tests
```

The Playwright suite (`e2e/`) covers the flows that matter most for a fraud-prevention
product:

- **`auth.spec.ts`** — invalid credentials are rejected, valid credentials reach the
  dashboard, unauthenticated visitors are redirected away from protected routes.
- **`risk-and-otp.spec.ts`** — a small, familiar-merchant payment clears without a
  step-up challenge; a large payment to an unfamiliar merchant (combined with
  simulated call/SMS signals and recent transaction velocity) is scored `HIGH`,
  triggers a CB-OTP challenge, and is approved once the correct demo code is entered.

Playwright's config (`playwright.config.ts`) boots `next dev` on port 3000 and reuses
an already-running dev server if one is present, so `npm run test:e2e` works both
locally and in CI. Tests run against the seeded demo account and assert on
dialog-scoped locators rather than exact risk scores, so they stay reliable even as
the shared demo database accumulates history across runs.

## Deployment

The app is a standard Next.js 15 App Router project and deploys cleanly to Vercel with
a managed Postgres instance (Vercel Postgres, Neon, Supabase, or RDS all work).

1. Provision a Postgres database and run `npx prisma migrate deploy` against it.
2. Set the environment variables from [Getting started](#getting-started) in your
   hosting provider, using a production `AUTH_SECRET` and the deployed `NEXTAUTH_URL`.
3. Configure a real email provider (`RESEND_API_KEY`, `OTP_EMAIL_FROM`) so CB-OTP
   codes are delivered by email instead of being logged to the server console.
4. Set `NEXT_PUBLIC_DEMO_MODE_ENABLED="false"` in production unless you intend to
   keep the Context Signal Simulator and demo workspace entry point publicly
   reachable.
5. Deploy (`vercel deploy` or via Git integration). `next build` runs type-checking
   and linting as part of the build, so a successful deploy is already verified.
6. Swap the in-memory rate limiter (`lib/rate-limit.ts`) for a shared store if you
   run more than one server instance, so limits are enforced globally rather than
   per-instance.

## Known limitations & roadmap

- **Call/SMS/location signals are simulated.** Real detection would require a mobile
  companion SDK and carrier webhook integration, which is out of scope for a web-only
  build. The Context Signal Simulator demonstrates the risk engine's reaction to
  these signals without claiming to intercept real phone activity.
- **PDF statement import is not implemented.** Only CSV import is supported;
  confidence-scored PDF parsing was scoped as a stretch goal.
- **The rate limiter is in-memory** and per-instance; see
  [Deployment](#deployment) for the production guidance.
- **A dedicated `/settings` page has not been built yet**, though it is reserved in
  the customer navigation and route middleware for future account-preference
  features.
- **A Python-based anomaly-detection microservice** is a natural next step once
  there's enough real transaction volume to train on, but the deterministic,
  explainable rule-based engine in this build is intentionally simpler to reason
  about and audit — an important property for a fraud system.
