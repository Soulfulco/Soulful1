---
name: Soulful frontend route paths
description: Canonical wouter routes for the soulful app, to avoid hardcoding wrong redirect paths from the backend
---

Employee-facing wellness space page: `/employee` (component `EmployeePortal.tsx`). It is NOT `/portal` — that path doesn't exist and 404s.

Practitioner-facing page: `/practitioner/portal`.

**Why:** Backend redirect constants (e.g. OAuth callback redirect targets) are easy to guess wrong since "portal" sounds like the natural name. A wrong guess causes a silent 404 after redirect, not an obvious error.

**How to apply:** Before hardcoding any server-side redirect to a soulful frontend route, grep `artifacts/soulful/src/App.tsx` for the actual `<Route path=...>` list rather than assuming.
