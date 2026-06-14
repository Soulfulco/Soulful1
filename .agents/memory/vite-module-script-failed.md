---
name: Transient "Importing a module script failed" in Vite dev
description: When this runtime-error modal is a harmless dep-reoptimization artifact vs a real bug
---

# "Importing a module script failed." is usually a transient Vite dep re-optimize artifact

In the soulful web artifact (Vite dev + @replit/vite-plugin-runtime-error-modal),
the runtime-error overlay "Importing a module script failed." commonly fires right
after Vite optimizes/changes dependencies and reloads (e.g. log line
`✨ new dependencies optimized: <pkg>` / `optimized dependencies changed. reloading`,
or right after codegen briefly removes+regenerates the api-client `generated/*.ts`).
The browser was holding a stale module-chunk reference that no longer exists.

**Why:** it's a timing artifact of HMR/dep pre-bundling, not a code fault.

**How to apply:** before treating it as a real bug, check the web workflow log around
that timestamp. If it coincides with a dep re-optimize/reload or a codegen run, just
restart the web workflow (or reload) and re-check — it clears. Only dig into app code
if the error persists across a clean restart with no concurrent dep/codegen churn.
