---
name: Multi-role session gating
description: How Soulful's api-server distinguishes user roles by session id prefix, and the escalation trap to avoid when adding a new role.
---

Soulful's api-server identifies the logged-in role by the session user's id prefix:
`hr:<id>` = company HR user, `pract:<id>` = practitioner, and a Soulful **admin** is
any authenticated session that is **neither** `hr:` nor `pract:`. The shared helper
`artifacts/api-server/src/lib/roles.ts` exposes `isHr`/`isPractitioner`/`isAdmin`/`practitionerId`.

**Rule:** Admin-only routes MUST gate with `isAdmin(req)`, never with an inverse check
like `if (req.user.id.startsWith("hr:")) return 403`.

**Why:** The inverse check treats *every* non-HR authenticated session as admin. That was
safe when only HR + admin existed, but the moment a third role (`pract:`) was added, every
inverse-`hr:` gate silently became a privilege-escalation hole — a practitioner session
passed the check and gained admin powers. A code review caught two missed spots in
`hrAuth.ts` (`POST /hr/users`, `GET /hr/users`) after the obvious ones were fixed.

**How to apply:** Whenever you add a new session role or audit access control, grep for
`startsWith("hr:")` (and any other role prefix used as an inverse admin gate) across
`artifacts/api-server/src/routes/` and convert each admin-intent gate to `isAdmin(req)`.
A *positive* requirement like `if (!id.startsWith("hr:")) return 403` ("must be HR") is fine —
only the inverse "non-HR ⇒ admin" pattern is dangerous.
