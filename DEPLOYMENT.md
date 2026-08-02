# Persona AI — Production Deployment Guide

This runbook covers deploying Persona AI with **Neon Postgres**, the **Railway ML sidecar**, and **Vercel** for the Next.js app. The application remains feature-identical to the local build; only database hosting and environment configuration change.

---

## Required environment variables

Never commit real secrets. Use the host dashboards (Neon / Railway / Vercel) or a local gitignored `.env`.

### Database (Neon)

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon **pooled** connection (`…-pooler…`). App runtime / Vercel. Prefer `?sslmode=require&pgbouncer=true`. |
| `DIRECT_URL` | Yes | Neon **direct** connection (hostname **without** `-pooler`). Used by Prisma Migrate via `directUrl` in `prisma/schema.prisma`. |

Local Docker still works: set both `DATABASE_URL` and `DIRECT_URL` to the same local Postgres URL (see `.env.example`).

### Auth.js

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | Yes | JWT / session signing secret (long random string). |
| `AUTH_URL` | Recommended | Canonical public app URL (Auth.js v5). |
| `NEXTAUTH_URL` | Recommended | Canonical public app URL (used by WebAuthn helpers and legacy Auth.js). |
| `WEBAUTHN_RP_ID` | Optional | Override WebAuthn RP ID (defaults from `NEXTAUTH_URL` host). |
| `WEBAUTHN_ORIGIN` | Optional | Override WebAuthn origin. |

On Vercel, set both `AUTH_URL` and `NEXTAUTH_URL` to `https://<your-vercel-domain>`.

### Email / OTP

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Optional | When set, CB-OTP codes are emailed via Resend. When unset, codes log to the server console (fine for demos). |
| `OTP_EMAIL_FROM` | Optional | From address (default: `Persona AI <security@personaai.ai>`). |

### Demo gates

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_DEMO_MODE_ENABLED` | Recommended | `"true"` keeps Context Signal Simulator + demo workspace entry. Use `"false"` for a stricter production surface. |

### Transaction Intelligence (ML sidecar)

| Variable | Required | Purpose |
| --- | --- | --- |
| `TRANSACTION_AI_URL` | Recommended | Base URL of the FastAPI service (e.g. Railway). Defaults to `http://127.0.0.1:8001` locally. |
| `TRANSACTION_AI_TIMEOUT_MS` | Optional | Client timeout (default `800`). Soft-fails to keyword fallback if unreachable. |

### Persona AI assistant

| Variable | Required | Purpose |
| --- | --- | --- |
| `ASSISTANT_PROVIDER` | Recommended | Use `grounded` in production (default). Persona AI answers from transaction history, FIN, risk engine, ML classifier, and account data only — no OpenAI calls. |
| `OPENAI_API_KEY` | Optional | Only used when `ASSISTANT_PROVIDER=openai` (non-production / explicit opt-in). Leave empty in production. |
| `OPENAI_ASSISTANT_MODEL` | Optional | Default `gpt-4o-mini` (ignored when grounded). |

Maps / geolocation use keyless public providers (OpenFreeMap, Nominatim, ipwho.is / ipapi.co) — no map API keys required.

---

## Deployment order

```text
1. Neon       → migrate schema + seed demo data
2. Railway ML → deploy FastAPI transaction-ai container
3. Vercel     → deploy Next.js with env vars pointing at Neon + Railway
```

Do **not** run `prisma migrate deploy` or `db:seed` inside the Vercel build. Apply schema and seed once against Neon from a trusted machine (or CI job) before / independently of the web deploy.

---

## Commands used (Neon migration)

From the project root, with Neon URLs in `.env`:

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Apply all migrations (uses DIRECT_URL)
npx prisma migrate deploy

# 3. Seed production demo dataset
npm run db:seed

# 4. Verify counts / auth against Neon
npx tsx scripts/verify-neon-seed.ts
npx tsx scripts/verify-neon-auth.ts
```

`package.json` includes `"postinstall": "prisma generate"` so Vercel installs produce a Prisma Client without a separate generate step.

### Neon URL shape

```text
# Pooled (runtime)
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# Direct (migrations)
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

If the driver rejects `channel_binding=require`, omit that query parameter (keep `sslmode=require`).

---

## Railway — ML sidecar

Service root: `ml/transaction-ai/` (see `Dockerfile`).

1. Create a Railway service from that directory / Docker image.
2. Railway sets `PORT` automatically. The container binds to `0.0.0.0:$PORT` (Dockerfile / `python -m app.main`). Local default remains `8001`.
3. Confirm `GET /health` returns `{"status":"ok","model_loaded":true,…}`.
4. Copy the public HTTPS URL into Vercel as `TRANSACTION_AI_URL` (no trailing path; the app calls `{TRANSACTION_AI_URL}/api/ai/classify-transaction`).

Local equivalent:

```bash
npm run ml:serve
# or: docker compose up -d transaction-ai
# optional: PORT=8001 npm run ml:serve
```

---

## Vercel — Next.js app

1. Import the Git repository into Vercel.
2. Framework preset: Next.js (default). Build command: `next build` (default). Install runs `postinstall` → `prisma generate`.
3. Set environment variables (Production + Preview as needed):
   - `DATABASE_URL` (Neon pooled)
   - `DIRECT_URL` (Neon direct — required because Prisma schema declares `directUrl`)
   - `AUTH_SECRET`
   - `AUTH_URL` / `NEXTAUTH_URL` = `https://<your-domain>`
   - `TRANSACTION_AI_URL` = Railway ML URL
   - Optional: Resend, OpenAI, `NEXT_PUBLIC_DEMO_MODE_ENABLED`
4. Deploy.
5. After first deploy, confirm login + dashboards against Neon.

---

## Production checklist

- [ ] Neon project created; pooled + direct connection strings available
- [ ] `DATABASE_URL` + `DIRECT_URL` set locally and on Vercel
- [ ] `npx prisma migrate deploy` succeeded (all migrations applied)
- [ ] `npm run db:seed` completed once on Neon
- [ ] `scripts/verify-neon-seed.ts` shows expected demo users / FIN / transactions
- [ ] Railway ML `/health` OK; `TRANSACTION_AI_URL` set on Vercel
- [ ] Fresh `AUTH_SECRET` for production (do not reuse a public demo secret if the app is public)
- [ ] `AUTH_URL` / `NEXTAUTH_URL` match the public HTTPS origin
- [ ] Resend configured if email OTP delivery is required
- [ ] `NEXT_PUBLIC_DEMO_MODE_ENABLED` set intentionally (`true` for hackathon demo)
- [ ] Vercel deploy succeeds (`next build` green)
- [ ] Post-deployment verification checklist (below) completed

---

## Rollback steps

1. **App only** — Redeploy the previous Vercel deployment from the Vercel dashboard (instant rollback of Next.js).
2. **Database URL** — Point `DATABASE_URL` / `DIRECT_URL` back to the previous Postgres (local Docker or prior Neon branch) and redeploy / restart.
3. **Neon data** — Restore from a Neon PITR / branch snapshot if available; or reset the database and re-run:
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```
4. **Schema** — Do not invent down-migrations in production without review. Prefer restoring a Neon branch taken before `migrate deploy`.
5. **ML** — Redeploy the previous Railway image or temporarily unset / point `TRANSACTION_AI_URL` away; the app soft-fails to keyword classification.

---

## Demo account credentials

Seeded by `prisma/seed.ts` (unchanged):

| Role | Email | Password |
| --- | --- | --- |
| Customer (Arjun Mehta) | `demo@securebank.ai` | `demo-password` |
| Admin / analyst (Priya Nair) | `analyst@securebank.ai` | `admin-password` |
| FIN network customers | `rohan.kapoor@securebank.ai`, `sana.iyer@securebank.ai`, `vikram.singh@securebank.ai`, `devika.rao@securebank.ai` | `demo-password` |

---

## Post-deployment verification checklist

After Neon + Railway + Vercel are wired:

- [ ] **Customer login** — `demo@securebank.ai` / `demo-password`
- [ ] **Admin login** — `analyst@securebank.ai` / `admin-password`
- [ ] **Dashboard** — balances, recent activity load from Neon
- [ ] **Persona AI** — behavioral baseline / assistant route loads
- [ ] **Transaction simulation** — risk scoring + step-up paths respond
- [ ] **Security Map** — locations / map tiles render
- [ ] **Admin SOC** — FIN live / SOC views load
- [ ] **Relationship Graph** — graph page loads FIN network
- [ ] **FIN recommendations** — recommendation center populated from seeded fraud intel
- [ ] **ML transaction classifier** — Railway health OK; classify calls succeed (or soft-fallback noted)
- [ ] **Adaptive Authentication** — high-risk path increases verification
- [ ] **Social Engineering warning flow** — context / SE signals surface warnings
- [ ] **Accessibility Mode** — Senior Mode toggle works
- [ ] **i18n** — English / Hindi / Punjabi language switcher

### Local verification helpers (against whatever `DATABASE_URL` points at)

```bash
npx tsx scripts/verify-neon-seed.ts
npx tsx scripts/verify-neon-auth.ts
npm run dev   # with Neon URLs in .env
```

---

## Notes

- ML training artifacts live under `ml/transaction-ai/artifacts/` (filesystem), not in Postgres.
- Seed does not pre-create `Alert`, `AssistantThread`, or `UserSettings` rows; those appear through normal product use.
- Login history is stored as `Session` rows (no separate LoginHistory model).
- In-memory rate limiting (`lib/rate-limit.ts`) is per-instance; use a shared store if you scale to multiple Vercel instances with strict global limits.
