---
name: replit-auth-web tsconfig
description: lib/replit-auth-web needs a custom env.d.ts to resolve import.meta.env
---

## The rule
`lib/replit-auth-web` is a shared lib (not a Vite app), so it can't declare `"types": ["vite/client"]` in tsconfig — `vite/client` is not installed as a dep.

Instead, add `lib/replit-auth-web/src/env.d.ts` with a manual `ImportMeta` interface declaring `.env.BASE_URL` etc.

**Why:** The lib uses `import.meta.env.BASE_URL` to build redirect URLs. Without the type declaration `tsc --build` fails with "Property 'env' does not exist on type 'ImportMeta'", which blocks codegen.

**How to apply:** Any time this lib is edited or the tsconfig is regenerated, ensure `env.d.ts` stays in `src/` and is included in the tsconfig `include` glob.
