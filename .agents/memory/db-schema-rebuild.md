---
name: lib/db schema changes require declaration rebuild
description: After editing lib/db schema, consumer typecheck fails until lib/db .d.ts is rebuilt, even though runtime works.
---

When you add/change columns or tables in `lib/db/src/schema/*`, the API server and
other consumers will still **run** fine (esbuild bundles `@workspace/db` from source),
but `tsc --noEmit` in consumers throws phantom errors like
`Module '"@workspace/db"' has no exported member 'X'` or `Property 'Y' does not exist`.

**Why:** `@workspace/db` is a composite TS project that emits declarations to `lib/db/dist`
(`emitDeclarationOnly`, project references). Consumers typecheck against those emitted
`.d.ts` files, which go stale until rebuilt. esbuild reads source directly, so runtime is unaffected.

**How to apply:** After any schema edit, run `npx tsc --build lib/db/tsconfig.json --force`
(or root `pnpm run typecheck:libs`) before trusting consumer typecheck results.
