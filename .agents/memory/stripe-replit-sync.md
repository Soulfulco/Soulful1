---
name: Stripe (stripe-replit-sync) integration gotchas
description: Non-obvious traps when using the stripe-replit-sync library + Replit Stripe connector in this monorepo.
---

# stripe-replit-sync gotchas

These bit us when wiring real Stripe payments (corporate + practitioner subscriptions) into the Soulful api-server.

## Connection settings key is `secret`, not `secret_key`
The Replit Stripe connector exposes credentials under `settings.secret` (plus `publishable`, `account_id`, `mcp`, `claim_url`). There is **no** `secret_key` or `webhook_secret`.
- **How to apply:** read `settings.secret ?? settings.secret_key` defensively. Leave `stripeWebhookSecret: ""` — `processWebhook` falls back to the stored managed-webhook secret, so an empty webhook secret is fine.

## esbuild must externalize `stripe-replit-sync`
Bundling the lib breaks its internal migrations-dir path resolution (it reads migration SQL files relative to its own package). Add `stripe-replit-sync` (and `stripe`) to the `external` array in the api-server `build.mjs`, and list both as real deps in `package.json`.
**Why:** otherwise `runMigrations` can't find the lib's migration files at runtime.

## Enum collision: pre-create `stripe.subscription_status`
The lib's migration 0004 guards enum creation with an **unqualified** `pg_type WHERE typname=...` check, which collides with the app's existing `public.subscription_status` enum and skips creating `stripe.subscription_status`.
- **How to apply:** before `runMigrations`, run an `ensureStripeEnumCompat()` that creates `stripe.subscription_status` with exactly 0004's values, **omitting `paused`** (migration 0039 adds `paused` via plain `ADD VALUE` and will fail if it already exists).

## `syncBackfill()` with no args syncs nothing
Call `syncBackfill({ object: "all" })` explicitly — bare `syncBackfill()` silently no-ops.

## App-side reconciliation is metadata-driven and must be deterministic
We set `metadata.appPlanId` + `appCompanyId`/`appPractitionerId` on both the Checkout session and `subscription_data`. A reconcile step reads `stripe.subscriptions` and writes status back to the app's `companies`/`practitioners` + `*_subscriptions` tables.
- **How to apply:** an entity can have multiple Stripe subscriptions (old canceled + new active). Group by entity and apply only the authoritative row (priority active/trialing > past_due > canceled, tie-broken by `created` desc) — never iterate-and-overwrite in arbitrary row order.

## Checkout is public (sign-up flow); portal/status are not
`POST /stripe/checkout` runs during corporate/practitioner sign-up before a session exists, so it stays unauthenticated — but validate exactly-one-of company/practitioner and that `plan.planType` matches the entity. `POST /stripe/portal` and `GET /stripe/subscription` MUST require auth and scope to the caller (HR → their own company only; non-`hr:` OIDC admins → any). Build redirect URLs from `REPLIT_DOMAINS`, never the request `Origin` header, and only allow app-relative (`/...`) success/cancel/return paths.
