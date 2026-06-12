---
name: Auth architecture
description: How Soulful's dual auth system works — Replit OIDC for admins, password-based for HR managers
---

## The rule
Two distinct auth paths share one session store (PostgreSQL `sessions` table via `lib/auth.ts`):
1. **Soulful admins** — Replit OIDC (`/api/login` → `/api/callback`). User ID is the Replit sub claim (UUID string).
2. **HR managers** — Username/password stored in `hr_users` table. User ID is prefixed `hr:<numeric_id>`. Password hashed with SHA-256 + REPL_ID as salt.

## Distinguishing user types
Check `user.id.startsWith("hr:")` to differentiate — used in `AuthContext.tsx` (`isHrUser` vs `isAdminUser`) and on the API side to gate admin-only endpoints.

## HR session flow
POST `/api/hr/login` → creates a session record → sets `sid` cookie → GET `/api/hr/me` returns company context (companyId, companyName, role).

## Frontend auth context
`artifacts/soulful/src/contexts/AuthContext.tsx` — wraps all auth state. HR logout POSTs to `/api/hr/logout` then redirects to `/dashboard/login`; admin logout redirects to `/api/logout` (OIDC end-session).

## DB tables
- `sessions` — shared session store (sid VARCHAR PK, sess JSONB, expire TIMESTAMP)
- `users` — Replit OIDC users (id VARCHAR PK = Replit sub)
- `hr_users` — HR manager accounts (company_id FK, email UNIQUE, password_hash, name, role)

**Why:** Single session store avoids two separate middleware chains; the `hr:` prefix is enough to branch logic without a separate auth middleware.
