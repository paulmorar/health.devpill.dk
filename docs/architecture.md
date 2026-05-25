# health.devpill.dk — Architecture

Personal health dashboard for 1–2 users. Pulls activities from Strava, accepts
manual wellness + food entries, tracks metric and habit goals.

## Decisions

| # | Area | Decision | Rationale |
|---|---|---|---|
| 1 | Data source | **Strava only** for activities; **manual entry** for sleep, weight, resting HR, HRV, mood, etc. | Garmin Health API requires partner approval (slow, business-only). Strava is instant OAuth. Wellness gap filled by fast manual UI. |
| 2 | Hosting | **Vercel** + **Neon Postgres** (US region) | Zero-ops, free tier sufficient, native Next.js fit. US-hosting tradeoff accepted. |
| 3 | Framework | **Next.js 15** (App Router) + React, installable as **PWA** | RSC for data-heavy pages, server actions for mutations, best chart ecosystem, single codebase for desktop + mobile. |
| 4 | ORM | **Drizzle** + `drizzle-kit` migrations | SQL-shaped queries (needed for time-series aggregations), edge-friendly, inferred types from schema. |
| 5 | Auth | **Auth.js v5**, providers: **GitHub** + **Resend magic link**, hardcoded email allowlist (2 users) | Identity decoupled from data sources. Magic link for non-dev user. App is "private-but-multi-user-capable". |
| 6 | UI | **Tailwind** + **shadcn/ui** + **Tremor** (Recharts under the hood) | Own the component source, dashboard-tuned primitives, vast ecosystem. |
| 7 | Strava ingestion | **Push (webhook) + Pull (hourly cron safety net)**, **Inngest** for durable jobs; **raw jsonb + normalized** tables | Webhooks for low latency, cron catches missed/edited events. Raw storage allows reprocessing without re-hitting the API. |
| 8 | Food data | **Open Food Facts** lookup + **barcode scan** (`BarcodeDetector` native, ZXing fallback for iOS); macros denormalized onto each entry; quick-log escape hatch for unmatched foods | Free EU-friendly food DB, barcode is the killer mobile UX. Denormalization keeps history stable when the food DB changes. |
| 9 | Goals | **Metric** + **Habit** kinds. Progress **computed on read** from raw tables. v1 metrics: `weight_kg`, `distance_km`, workout count. | Single uniform model, no goal-progress sync issues, easy to add/remove goals without touching data. |
| 10 | Information architecture | **Today** home (logging-first) with goal cards, `/goals`, `/insights`, floating quick-log sheet. **3-tab bottom nav, mobile-first** (designed at 375px). | Daily entry must be <10s — home is the fastest possible logging surface. Insights are destination content. |
| 11 | Locale & units | **Metric only**, Europe/Copenhagen, Monday week start. Hardcoded. | Single-region app, two users, no need for a settings page. |
| 12 | Offline | **Online-only logging** with clean error UI. | Network gaps rare in DK; queue/sync engine is large scope deferred until it's actually a problem. |
| 13 | Backups | **None in v1** (deferred). Risk acknowledged. | Add nightly `pg_dump` → Cloudflare R2 before data becomes irreplaceable. |
| 14 | Data fetching | **RSC** for reads (Drizzle direct), **Server Actions** for writes. No tRPC. TanStack Query only if optimistic UI is needed later. | Simplest possible reads + writes within the Next.js model. |
| 15 | Validation | **Zod** + `drizzle-zod` (schemas derived from DB tables) | Single source of truth at the boundary. |
| 16 | Errors / logs | **Sentry** (free tier) for client + server. Vercel logs for everything else. | Minimal viable observability. |

## Tech stack summary

- **Runtime**: Node 22 on Vercel
- **Framework**: Next.js 15 (App Router, RSC, Server Actions)
- **Language**: TypeScript (strict)
- **DB**: Neon Postgres + Drizzle ORM + `drizzle-kit`
- **Auth**: Auth.js v5 (GitHub + Resend) with Drizzle adapter
- **UI**: Tailwind CSS, shadcn/ui, Tremor, Recharts
- **Background jobs**: Inngest (durable functions, retries, cron)
- **External APIs**: Strava v3, Open Food Facts
- **Errors**: Sentry
- **Email**: Resend (magic links)
- **PWA**: `next-pwa` or hand-rolled manifest + service worker
- **Hosting**: Vercel + custom domain `health.devpill.dk`

## Data model (v1)

```
users                  -- Auth.js
accounts               -- Auth.js (holds Strava OAuth tokens per user)
sessions               -- Auth.js
verification_tokens    -- Auth.js (magic links)

strava_activities_raw  -- id, user_id, strava_id (unique), payload jsonb, received_at
activities             -- id, user_id, strava_id, sport_type, started_at, distance_m,
                          moving_s, elapsed_s, calories, avg_hr, max_hr, elev_gain_m, name

wellness_entries       -- id, user_id, date (unique per user),
                          weight_kg, resting_hr, sleep_hours, sleep_quality,
                          hrv_ms, mood, energy, notes

foods                  -- id, off_id (unique nullable), name, brand,
                          kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
                          source ('off' | 'manual'), created_at
food_entries           -- id, user_id, eaten_at, meal_type, food_id (nullable),
                          quantity_g, kcal, protein_g, carbs_g, fat_g, notes
                          -- macros denormalized; food_id is a reference, not a dependency

goals                  -- id, user_id, title, kind ('metric' | 'habit'),
                          metric (nullable enum), comparator ('lte' | 'gte' | 'eq'),
                          target_value, period ('once' | 'daily' | 'weekly' | 'monthly'),
                          start_date, end_date (nullable),
                          status ('active' | 'paused' | 'completed' | 'abandoned'),
                          created_at
```

**Hard rules**:
- Every domain table has `user_id` FK; every query is scoped by the logged-in user.
- Goals never store progress; progress is derived from raw tables on read.
- Food entries store macros directly; never recomputed from the linked food row.

## Routes

| Route | Render | Purpose |
|---|---|---|
| `/` | RSC | Today view: today's logs, active goal cards, quick-add CTAs |
| `/goals` | RSC | Active + past goals, create/edit |
| `/insights` | RSC | Charts: weight trend, weekly volume, sleep avg, macro split |
| `/settings` | RSC | Strava connect/disconnect, profile |
| `/api/auth/[...nextauth]` | — | Auth.js handler |
| `/api/strava/webhook` | Route handler | Strava push events (verification + activity events) |
| `/api/inngest` | Route handler | Inngest function endpoint |

Server Actions live colocated with the components that call them (e.g. `app/(app)/_actions/log-weight.ts`).

## Background jobs (Inngest)

| Job | Trigger | Purpose |
|---|---|---|
| `strava.backfill` | On first connect; chunked | Page through full activity history → raw + normalized |
| `strava.process-webhook` | Webhook event | Fetch full activity by ID, upsert raw + normalized |
| `strava.sync-recent` | Cron, hourly | Pull last 24h of activities (safety net) |
| `strava.refresh-tokens` | Cron, every 4h | Refresh OAuth tokens nearing expiry |

## Phased build plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Foundation** | Next.js + TS + Tailwind + shadcn scaffold, Drizzle + Neon connection, Auth.js (GitHub) + allowlist, Vercel deploy at `health.devpill.dk` | You can log in with GitHub on the live domain and see an empty dashboard |
| **1 — Strava ingest** | OAuth connect flow, Inngest setup, backfill + webhook + hourly cron, `activities` + `strava_activities_raw` tables, basic activity list | Finishing a run on Strava shows it in the app within minutes |
| **2 — Wellness** | `wellness_entries` table, quick-log sheet on Today screen, weight + sleep + resting HR entry | You can log a weigh-in in <10s from the home screen |
| **3 — Food** | `foods` + `food_entries`, Open Food Facts client, barcode scanner, search, quick-log fallback | You can scan a yogurt and log a meal in <20s |
| **4 — Goals** | `goals` table, create/edit UI, progress computation views, Today-screen goal cards | You can create the 3 v1 goal flavors (weight, weekly volume, weekly frequency) and see real progress |
| **5 — Insights** | `/insights` route with weight trend, volume chart, sleep average, macro split | You enjoy looking at the charts |
| **6 — Polish** | PWA manifest + service worker + install prompt, Resend magic-link provider for second user, Sentry wiring | Both users have the PWA installed on their home screens |

## Known deferred items

- **Backups** — add nightly `pg_dump` → R2 before significant data accrues.
- **Offline logging** — revisit if connectivity gaps become an actual problem.
- **Photo + LLM food estimation** — v2 input method on top of the existing food schema.
- **Strength training** — would need a `strength_entries` table; out of scope for v1.
- **Performance/race goals** (PRs, paces) — would need a derived "personal bests" layer; out of scope for v1.
- **Garmin or other source migration** — current schema is provider-aware on `activities` via `strava_id`; adding a `source` column later is a small migration.
