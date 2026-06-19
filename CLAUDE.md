# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Specvla Ergon — Avditor Mvndi: a multi-tenant SaaS platform that performs AI-powered website growth audits. Users submit a URL and receive a structured audit scored across four "pillars" (Mercury/Communication, Venus/Aesthetic, Mars/Drive, Saturn/Structure). Built for creators, agencies, and consultants.

Production URL: https://specvla-ergon-avditor-mvndi.vercel.app

## Commands

```bash
npm run dev              # Start dev server (Next.js 16 + Turbopack)
npm run build            # Production build
npm run lint             # ESLint (config at .config/eslint.config.mjs)
npm test                 # Vitest unit tests (346 tests, config at .config/vitest.config.ts)
npm run test:watch       # Vitest in watch mode
npm run test:e2e         # Playwright E2E tests (config at .config/playwright.config.ts)
npx tsc --noEmit         # Type check without emitting
```

To run a single test file:
```bash
npx vitest run --config .config/vitest.config.ts src/services/evaluator.test.ts
```

To run a single test by name:
```bash
npx vitest run --config .config/vitest.config.ts -t "returns a passed result"
```

## Architecture

### Stack
- **Next.js 16** (App Router, all routes dynamic/server-rendered) + **React 19**
- **TypeScript** (strict mode, path alias `@/*` → `./src/*`)
- **Vercel AI SDK** (`ai` package) for LLM interaction
- **Sentry** for error monitoring (config in `.config/sentry/`)
- **PostHog** for analytics
- **Stripe** for Pro subscriptions
- **Resend** for transactional email

### AI Pipeline (the core product flow)

The audit pipeline is orchestrated in `src/services/aiOrchestrator.ts`:

```
User submits URL
  → scraper.ts (cheerio, multi-page crawl)
  → vision.ts (puppeteer screenshot → base64)
  → pagespeed.ts (Google Lighthouse API)
  → ragService.ts (dimensional inference — 3D coordinate-space similarity search)
  → promptTemplates.ts (assembles prompt with all context)
  → aiModelFactory.ts (creates Vercel AI SDK model instance)
  → generateText() / streamText()
  → evaluator.ts (LLM-as-a-Judge quality loop — may retry once)
  → scrubProprietaryInfo() (gates detailed tactics for non-Pro users)
```

Three AI providers are supported: **Gemini** (default), **OpenAI**, and **Claude** — selected at runtime via `X-AI-Provider` header. Users supply their own API keys (stored in browser localStorage, sent via `Authorization: Bearer` header).

Two audit endpoints:
- `POST /api/audit` — full orchestrated audit (non-streaming)
- `POST /api/audit/stream` — streaming audit via `streamText`

### Dual Database Layer

`src/lib/db.ts` implements every data operation with dual backends:
- **SQLite** (better-sqlite3) — used when Supabase env vars are absent. Data stored in `data/audits.db`.
- **Supabase** — used in production when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.

Every function checks `useSupabase` and branches accordingly. Both paths expose the same async interface.

A separate SQLite database at `data/config.db` (`src/lib/config.ts`) stores admin-configurable settings (branding, API keys, feature flags). This is always SQLite, never Supabase.

### Authentication

next-auth v5 beta (`src/auth.ts`) with three providers: Google, GitHub, Credentials. Session type is augmented in `src/types/next-auth.d.ts` with `isAdmin`, `isPro`, `isPremium` booleans and a `plan` string. These are populated in the JWT callback from the subscriptions table. `isPro` means "has paid-tier features" — it is true for **both** the Pro and Premium tiers, so every existing `isPro` gate works across paid tiers; `isPremium`/`plan` distinguish the top tier.

### Subscription Tiers

`src/lib/plans.ts` is the single source of truth for the subscription tiers (`free`, `pro` $29/mo, `premium` $99/mo), their per-tier entitlements (vault access, scrape depth, team seats, etc.), and Stripe price-ID resolution (`getStripePriceId`, `resolvePlanFromPriceId`). It is dependency-free and safe to import anywhere (client + server). The pricing page renders from this catalog and posts a `tier` key; `/api/subscription` resolves the price ID server-side (it never trusts a client-supplied price), and the Stripe webhook persists the resolved tier from checkout metadata.

### Key Patterns

- **Zod validation**: All API inputs validated through schemas in `src/lib/schemas.ts`
- **Rate limiting**: LRU-cache-based, in `src/lib/rate-limit.ts` — single-instance only
- **CSS blend-mode hack**: Components use `mixBlendMode: "destination-out"` (non-standard Canvas compositing value) to punch transparent holes through glassmorphism cards, revealing the p5.js starfield. This requires `as unknown as React.CSSProperties["mixBlendMode"]` casts — do not remove them.
- **p5.js background**: `SpaceTimeBackground.tsx` renders a fixed-position warp-speed starfield canvas at z-index -5
- **Test mocking for `auth`**: next-auth v5's `auth` export has complex overloaded types. Tests use `(auth as unknown as Mock)` from vitest to sidestep overload resolution issues. This is intentional.

### API Routes

| Route | Purpose |
|-------|---------|
| `/api/audit` | Full orchestrated audit |
| `/api/audit/stream` | Streaming audit |
| `/api/audit/feedback` | User feedback on audit sections |
| `/api/chat` | Follow-up chat about audit results |
| `/api/v1/analyze` | Public API (PAT-authenticated) |
| `/api/health` | Health check |
| `/api/teams`, `/api/teams/[id]/members` | Team CRUD |
| `/api/settings/*` | User settings (branding, schedules, integrations, data export/forget) |
| `/api/admin/*` | Admin dashboard (users, analytics, config, actions) |
| `/api/leads` | Lead capture |
| `/api/pdf` | PDF report generation (puppeteer) |
| `/api/share/[id]` | Public audit sharing |
| `/api/subscription`, `/api/checkout` | Stripe billing |
| `/api/webhooks/stripe` | Stripe webhook handler |
| `/api/cron` | Scheduled audit execution |
| `/api/og` | Dynamic OG image generation |

### Pages

| Page | Purpose |
|------|---------|
| `/` | Home — audit submission form with "Iceberg" portal UI |
| `/results` | Audit results display with pillar scores |
| `/compare` | Side-by-side audit comparison |
| `/history` | Audit history with trend charts |
| `/settings` | AI provider selection, agency branding, integrations |
| `/pricing` | Pro subscription tiers |
| `/vault` | Gated strategy playbooks (Pro-only) |
| `/teams`, `/teams/[id]` | Team management |
| `/admin` | Admin dashboard |
| `/about` | Methodology ("four pillars") |
| `/docs` | API documentation |
| `/examples` | Example audits |

## Environment Variables

All optional — the app runs locally with zero config (SQLite fallback, user-supplied AI keys):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (enables Supabase instead of SQLite) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GEMINI_API_KEY` | Server-side Gemini key (optional — users can supply their own) |
| `STRIPE_SECRET_KEY` | Stripe for Pro subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `STRIPE_PRICE_PRO` | Stripe recurring price ID for the Pro tier ($29/mo) |
| `STRIPE_PRICE_PREMIUM` | Stripe recurring price ID for the Premium tier ($99/mo) |
| `RESEND_API_KEY` | Transactional email via Resend |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error tracking |
| `CRON_SECRET` | Secret for `/api/cron` scheduled audits |
| `ADMIN_EMAILS` | Comma-separated admin email addresses |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth |

## Testing Notes

- Unit tests are co-located with source files (`*.test.ts` / `*.test.tsx`)
- E2E tests are in `e2e/`
- Test setup in `src/setupTests.ts` mocks `localStorage` and `sessionStorage`
- All configs live in `.config/` (eslint, vitest, playwright, sentry)
- The `auth` mock pattern uses `(auth as unknown as Mock)` — this is the correct approach for next-auth v5's overloaded types; do not change to `vi.mocked(auth)` as it will cause TypeScript errors
