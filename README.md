# Specvla Ergon - Avditor Mvndi

[![Status](https://img.shields.io/badge/status-omega-blueviolet?style=for-the-badge)](https://github.com/organvm-iii-ergon/specvla-ergon--avditor-mvndi)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)

Avditor Mvndi is a production-oriented AI growth-audit platform for websites, landing pages, and digital brands. It turns a URL, business niche, and growth goal into a strategic audit with scores, recommendations, shareable reports, PDF export, history, comparisons, teams, scheduled re-audits, and subscription-gated agency features.

The product uses a "cosmic alignment" vocabulary in the UI, but the underlying job is practical: find messaging, design, conversion, reach, and technical bottlenecks that keep a digital property from converting.

## What It Is

Avditor Mvndi combines:

- A Next.js 16 App Router frontend for audits, comparisons, results, settings, pricing, teams, history, and admin workflows.
- API routes for audit generation, streaming results, lead capture, sharing, PDF generation, subscriptions, webhooks, recurring audits, teams, settings, and a Pro-only public API.
- A multi-provider AI layer that supports Google Gemini, OpenAI, and Anthropic Claude through the Vercel AI SDK.
- Website scraping and PageSpeed enrichment for audit context.
- Supabase persistence in production, with an in-memory fallback for local development.
- Stripe billing for the Basic/Pro tier model and optional post-audit service offers.
- Resend email notifications for subscription and recurring-audit flows.

The audit experience is organized around strategic signal pillars such as communication, aesthetic, drive, structure, reach, psychology, identity, and vision. Reports can be viewed in the app, shared publicly, exported to PDF, discussed with the chat assistant, and tracked over time.

## Who Pays

The free user is an individual creator, founder, or operator who wants a quick audit and is willing to bring their own AI provider key.

The paying customer is usually a professional founder, consultant, studio, or agency that needs repeatable client-facing audits. They pay for Pro because the platform becomes part of their workflow: deeper crawling, scheduled re-audits, team collaboration, white-label reports, and API access.

Typical payer profiles:

- Agencies that sell website, SEO, conversion, or brand audits to clients.
- Freelancers and consultants who need polished PDF deliverables.
- Founders and growth teams that want recurring benchmarks and trend history.
- Internal teams that want shared audit archives and repeatable competitive analysis.
- Developers or partner platforms that need programmatic analysis via the Pro API.

## Pricing And Monetization

The app currently exposes a two-tier subscription model in `src/app/pricing/page.tsx`.

| Tier | Price | Buyer | Included |
| --- | ---: | --- | --- |
| Basic | `$0` | Individual creators and hobbyists | Single-page audits, manual PDF exports, standard AI models, public sharing |
| Pro | `$49/mo` | Professional founders and agencies | Multi-page deep analysis, scheduled recurring audits, white-label PDF reports, team collaboration for 3 members, premium AI models |

Feature gates are driven by the session's `isPro` or `isAdmin` flags. Active Pro subscriptions are stored as `plan: "pro"` and `status: "active"` in the `subscriptions` data store. Stripe webhooks update that subscription state when checkout sessions complete or subscriptions change.

Additional monetization paths appear after an audit:

| Path | Checkout amount | Positioning |
| --- | ---: | --- |
| The Builder | `$1,500` one time | Expert execution and implementation support |
| The Vault | `$297` one time | Templates, blueprints, and proprietary resources |
| The Oracle | `$500` one time | 1-on-1 diagnostic or consultation |

Production billing notes:

- `/pricing` posts to `/api/subscription` and starts a Stripe subscription checkout.
- The current Pro button uses `price_placeholder_pro`; replace it with a real Stripe recurring price ID before charging customers.
- `/api/checkout` supports the one-time post-audit paths listed above.
- `/api/webhooks/stripe` must be registered as the Stripe webhook endpoint so Pro state is persisted.
- With placeholder Stripe secrets, checkout routes return mock Stripe URLs for local testing.

## Install

### Requirements

- Node.js 20+
- npm
- An AI provider key for local audits: Gemini, OpenAI, or Anthropic
- Optional production services: Supabase, Stripe, Resend, PostHog, Sentry

### Local Setup

```bash
git clone https://github.com/organvm-iii-ergon/specvla-ergon--avditor-mvndi.git
cd specvla-ergon--avditor-mvndi
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

For the browser audit flow, users can paste their AI provider key in Settings or through the inline API key prompt. Those user-supplied keys are stored in browser `localStorage` and are sent as Bearer tokens to the audit endpoints.

### Environment

`.env.local.example` lists the expected variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
AUTH_SECRET=
NEXTAUTH_SECRET=
CRON_SECRET=
ADMIN_EMAILS=
NEXT_PUBLIC_BASE_URL=
```

Useful optional variables supported by the app include:

```bash
AUTH_PASSWORD=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NEXT_PUBLIC_POSTHOG_HOST=
NEXT_PUBLIC_APP_NAME=
WEBHOOK_URL=
WEBHOOK_SECRET=
```

Local development works without Supabase by using an in-memory store. That data resets when the dev server restarts. For durable teams, subscriptions, schedules, audit history, integrations, leads, and API tokens, configure Supabase.

## Usage

### Run A Browser Audit

1. Start the app with `npm run dev`.
2. Visit `/settings` and choose an AI provider: `gemini`, `openai`, or `claude`.
3. Paste the matching provider API key.
4. Return to `/`.
5. Enter the URL, business niche, and growth goal.
6. Generate the audit and review the results at `/results`.

The results view can show strategic scores, reveal the full audit, export a PDF, collect feedback, share a public report, and open a context-aware chat assistant.

### Compare Competitors

Use `/compare` to compare two or three URLs against the same business type and growth goal. The comparison flow also uses the browser-stored AI provider key.

### Use Teams

Authenticated users can create teams at `/teams`, invite members, and assign audits or schedules to a team. Team roles include `owner`, `admin`, and `member`.

### Use Pro Features

After a user has an active Pro subscription, the session receives `isPro: true`. That unlocks:

- Multi-page scraping for deeper audit context.
- Scheduled weekly or monthly audits at `/settings/schedules`.
- White-label agency logo configuration in `/settings`.
- Team-oriented workflows.
- Pro-only public API access when a valid personal access token exists.

Admins listed in `ADMIN_EMAILS` receive admin privileges without needing a paid subscription.

### Public API

There are two audit API patterns:

- `/api/audit` and `/api/audit/stream` accept a user-supplied AI provider key as `Authorization: Bearer <provider-api-key>` and optionally `X-AI-Provider: gemini | openai | claude`.
- `/api/v1/analyze` is the Pro public API. It requires a personal access token stored in the app database and an active subscription. Token storage is implemented in `src/lib/db.ts`; wire token issuance into your admin or account flow before offering this endpoint externally.

Example browser-style audit request:

```bash
curl -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GEMINI_API_KEY" \
  -H "X-AI-Provider: gemini" \
  -d '{
    "link": "https://example.com",
    "businessType": "SaaS",
    "goals": "Increase trial signups and improve activation"
  }'
```

Example Pro API request:

```bash
curl -X POST http://localhost:3000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AVDITOR_PAT" \
  -d '{
    "link": "https://example.com",
    "businessType": "SaaS",
    "goals": "Increase trial signups and improve activation"
  }'
```

### Recurring Audits

The cron endpoint is `GET /api/cron` and expects:

```bash
Authorization: Bearer $CRON_SECRET
```

It checks due schedules, runs audits with the server-side `GEMINI_API_KEY`, saves the results, and sends notifications through Resend when configured.

## Development

```bash
npm run dev
npm run lint
npm run test
npm run test:watch
npm run test:e2e
npm run test:e2e:ui
npm run build
npm run start
```

The test suite uses Vitest for unit and route tests, plus Playwright for end-to-end coverage.

## Project Structure

```text
src/app/                 Next.js routes, pages, layouts, and API endpoints
src/app/api/audit        Browser audit and streaming audit endpoints
src/app/api/v1/analyze   Pro public API endpoint
src/app/pricing          Basic/Pro pricing UI
src/app/settings         AI keys, agency branding, integrations, privacy controls
src/app/teams            Team collaboration UI
src/components           Reusable UI components
src/lib                  Database, config, schemas, rate limiting, validation
src/services             AI orchestration, scraping, email, webhooks, PDF support
docs/                    Architecture notes, roadmap, and product specs
```

## Deployment Notes

For production:

- Set `NEXT_PUBLIC_BASE_URL` to the deployed app URL.
- Configure Supabase credentials for durable data.
- Set `GEMINI_API_KEY` for server-side jobs, admin actions, cron, and Pro API flows.
- Configure Stripe keys and webhook secret.
- Replace placeholder Stripe price IDs with real products/prices.
- Set `RESEND_API_KEY` if subscription and schedule emails should send.
- Set `AUTH_SECRET`/`NEXTAUTH_SECRET`, OAuth credentials if used, `AUTH_PASSWORD`, and `ADMIN_EMAILS`.
- Secure scheduled jobs by setting `CRON_SECRET` and sending it in the cron request.
- Configure observability keys such as PostHog and Sentry as needed.
