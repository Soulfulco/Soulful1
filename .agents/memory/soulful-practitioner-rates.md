---
name: Soulful practitioner rate model
description: How in-person / online / base session rates relate and the invariant the API enforces
---

# Practitioner rates: two optional mode rates + a derived base

Practitioners have `inPersonRateGbp` and `onlineRateGbp` (both nullable) plus the
original `sessionRateGbp` (NOT NULL). `sessionRateGbp` is a **derived base/fallback**,
never an independent input.

**Invariant:** `sessionRateGbp = inPersonRateGbp ?? onlineRateGbp`. At least one mode
rate must be set. The API derives the base server-side on create, bulk import, and
patch — it does NOT trust a client-sent `sessionRateGbp` for writes (the field was
removed from `PractitionerUpdate`; create/bulk only use it as a back-compat fallback
when no mode rate is given).

**Why:** Independent fields drift. A non-UI client could set a base that matches
neither mode rate. Deriving server-side keeps the three consistent regardless of caller.

**How to apply:**
- Clearing a mode rate: send explicit `null` (not `undefined`) on PATCH — `undefined`
  means "leave unchanged". `PractitionerUpdate.inPersonRateGbp/onlineRateGbp` are typed
  `number | null` for this reason; the dashboard edit form sends `rate ?? null`.
- Patch recomputes the base from merged (new ?? existing) values and rejects clearing
  both rates with 400.
- Numeric columns come back as strings from drizzle — convert with `x != null ? Number(x) : null`.
