---
name: Practitioner approval workflow
description: How self-registered practitioners are gated for admin approval, and the deployment-safe column-default decision behind it.
---

# Practitioner approval workflow

Self-registered practitioners must be admin-approved (and have an onboarding call)
before going live. `practitioners.approval_status` enum: `pending | approved | rejected`.

- POST /practitioners: public self-reg → `pending` + `isActive:false`; admin-created → `approved` + active; bulk import → `approved`.
- Self-reg signup UX: no Stripe / start-free / auto-login — just a "we'll review & arrange a call" confirmation.
- Public directory, showcase, profile-by-id, and practitioner login all gate on `isActive` only.

## Invariant: live ⟹ approved
**Rule:** never leave a profile `isActive:true` while `approvalStatus != approved`, because every public/login gate keys on `isActive`. PATCH enforces this: activating coerces `approvalStatus` to `approved`; `pending`/`rejected` force `isActive:false`; setting `isActive:true` together with a non-approved status is a 400.
**Why:** the admin "Directory Status" toggle could otherwise publish an unapproved applicant.
**How to apply:** any new write path to `isActive` must preserve this coupling (or add an explicit `approvalStatus='approved'` filter to the gates).

## Deployment-safe default (drizzle-kit push gotcha)
**Rule:** the `approval_status` column default is `approved`, NOT `pending`. The self-reg path overrides to `pending` explicitly in code.
**Why:** post-merge runs `pnpm --filter db push` (`drizzle-kit push`, no migration files). When push adds a NOT NULL column to prod, **existing rows take the column DEFAULT**. A `pending` default would silently hide every existing live practitioner on deploy. A separate backfill can't live in post-merge (runs every merge → would re-approve future pending applicants).
**How to apply:** for any new NOT NULL column where existing prod rows need a specific value, set the schema default to that value rather than relying on a manual/one-off backfill.
