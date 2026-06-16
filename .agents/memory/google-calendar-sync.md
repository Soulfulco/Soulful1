---
name: Per-practitioner Google Calendar sync (Soulful Phase 2)
description: Why custom Google OAuth (not the Replit connector) and how two-way sync is wired.
---

Soulful needs EACH practitioner to connect THEIR OWN Google account. The Replit-managed
Google connector authenticates a single account only, so it cannot be used here — a custom
Google Cloud OAuth app is required (secrets GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).

**Decision:** store a per-practitioner `google_refresh_token` (+ `google_email`) on the
practitioners row. Redirect URI is built at runtime from REPLIT_DOMAINS as
`https://<domain>/api/practitioner/google/callback` — it must be registered EXACTLY in the
Google console, and changes per environment (dev domain vs .replit.app prod domain).

**Two-way model:** PULL = freeBusy → replace rows in `google_busy_blocks`; public availability
hides unbooked slots overlapping a busy block. PUSH = create a Google event on booking
(store `bookings.google_event_id`), delete it on cancel. All push/pull is best-effort
(try/catch) so the booking flow never breaks if Google is down or unconnected.

**Security:** practitioner/HR session cookies are `sameSite:"none"`, so cookie-only POSTs are
CSRF-exposed. State-changing practitioner endpoints must call `isSameOrigin(req)`
(artifacts/api-server/src/lib/csrf.ts) after the auth check. The OAuth callback (a GET)
is protected by a state nonce cookie + matching practitioner id instead.
