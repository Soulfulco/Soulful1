---
name: Soulful free-trial / self-serve signup
description: How free (£0) plans and employer self-registration work, and why the flow is shaped the way it is.
---

# Free-trial plans & self-serve signup

**Convention:** a plan is "free" when it has no `stripePriceId` and `priceGbp == 0`.
`POST /stripe/checkout` already 400s on any plan without a `stripePriceId`, so free
plans must never go through checkout — the frontend branches on `isFreePlan` and skips
Stripe entirely.

**Employer (corporate) self-serve accounts:** `POST /api/companies` only creates a
company row with no login. HR login accounts (`hr_users`) were historically created
ONLY by the admin-gated `POST /hr/users`. So free corporate signup uses a dedicated
public `POST /hr/register` that creates company + hr_user (hashed pw) + free
`company_subscriptions` row + session, all in one DB transaction, and auto-logs-in.
**Why transaction:** otherwise a mid-sequence failure / concurrent duplicate email
leaves orphan company rows; unique-violation (PG `23505`) is mapped to 409.

**Practitioners** already self-register with a portal password (`POST /api/practitioners`),
so they already have accounts. Free practitioner signup just skips Stripe.

**`POST /subscriptions/start-free` is ownership-gated, not public-anonymous.** It records
a free `*_subscriptions` row but REQUIRES an authenticated session that owns the entity
(`pract:{id}` must match `practitionerId`; `hr:` must match the company). **How to apply:**
the practitioner free flow must log in BEFORE calling start-free (login → start-free →
redirect), otherwise it 401/403s. An earlier version was unauthenticated and was an IDOR.
