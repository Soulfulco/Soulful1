---
name: Soulful API auth model
description: How HR vs Soulful-admin identity and per-company authorization work in the api-server
---

# Soulful API auth model

`req.user` is populated by `authMiddleware` from a session. Two kinds of authenticated users:
- **HR users**: `req.user.id` is `"hr:<hrUserId>"` (set in `routes/hrAuth.ts` on `/hr/login`). Their `company_id` is NOT on `req.user` — look it up via `SELECT company_id FROM hr_users WHERE id = <hrUserId>`.
- **Soulful admins**: Replit OIDC users; `req.user.id` does NOT start with `"hr:"`.

**Authorization rule for company-scoped writes:** admins may act on any company; HR may act only on their own company. See `authorizeCompanyWrite()` in `routes/employees.ts`.

**Why:** company-scoped HR endpoints (e.g. employee bulk create) must not be cross-company or public — a missing guard lets anyone write to any company.

**How to apply:** any new company-scoped write endpoint must call an authz guard before mutating. Note `POST /employees` (single self-registration via invite/join flow) is intentionally PUBLIC — do not lock it down.
