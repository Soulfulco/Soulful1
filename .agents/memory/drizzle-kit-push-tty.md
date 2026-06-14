---
name: drizzle-kit push TTY limitation
description: drizzle-kit push can fail non-interactively on new/renamed tables; how to work around it in this repl
---

# drizzle-kit push needs a TTY for conflict prompts

`pnpm --filter @workspace/db run push` (and `push-force`) can crash with
"Interactive prompts require a TTY terminal" via `promptNamedWithSchemasConflict`
when drizzle-kit can't decide whether a new table is a rename of an existing one.
`--force` does NOT bypass this particular prompt.

**Why:** the agent shell is non-interactive (no TTY); drizzle-kit's rename-resolution
prompt has no flag to auto-answer.

**How to apply:** for a brand-new table, just create it directly with idempotent SQL
via `psql "$DATABASE_URL"` (CREATE TABLE IF NOT EXISTS ... matching the drizzle
schema), then seed. The drizzle schema file still serves as the source of truth for
the app/types. For production rollout, the table will be created when push runs in an
interactive context, or replicate the same SQL.
