---
name: Event registration capacity & payment integrity
description: How free/paid event registration avoids overselling and duplicate seats in the Soulful events feature.
---

# Event registration integrity

Public event registration (free + paid via Stripe one-off `mode:"payment"` checkout) must
not oversell capacity or create duplicate registrations, even under concurrency.

**The rules:**
- A **pending** (unpaid) registration **holds a seat** — capacity counts BOTH `registered`
  and `pending` rows (not just `registered`). The same is true for the `spotsLeft` shown on
  public list/detail.
- Registration runs inside a DB transaction that locks the event row (`.for("update")`)
  before checking capacity and inserting, so concurrent requests serialize.
- A partial unique index `uq_event_reg_active_email` on `(event_id, lower(email)) WHERE
  status IN ('registered','pending')` is the backstop against duplicate/case-variant
  registrations. Catch Postgres error code `23505` → return 409.
- Paid flow: reserve the pending seat AND create the Stripe session inside the same
  transaction, so a Stripe failure rolls back the held seat.
- Stripe-return confirm endpoint just flips `pending`→`registered` after verifying
  `payment_status==='paid'`. **No capacity re-check needed** because the seat was already
  reserved at checkout creation — this is what makes confirm race-free.

**Why:** an architect review flagged read-then-insert capacity races and missing dedupe
constraints as a real payment-integrity risk (charging customers for non-existent seats).
The pending-holds-a-seat model resolves both the oversell race and the confirm-time race
without needing reservation expiry logic.

**How to apply:** any future change to event capacity logic must keep pending counted as a
held seat in every place capacity/spotsLeft is computed, or the guarantee breaks. Admin
management list is a separate endpoint (`/events/manage`) returning ALL events; the public
`/events` and `/events/:id` stay filtered to `isActive` (and upcoming for the list).
