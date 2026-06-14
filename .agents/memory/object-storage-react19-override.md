---
name: object-storage React 19 override
description: Why the object-storage skill's $react pnpm override must be skipped in this repo.
---

The object-storage skill tells you to add a root `pnpm.overrides` block mapping `react`/`react-dom` to `$react`/`$react-dom`. **Skip this step in this project.**

**Why:** The skill assumes React 18 and uses `$react` to prevent Uppy v5 (peer `react>=19`) from pulling a duplicate React. This repo's pnpm catalog already pins React 19, so (a) the peer is already satisfied and no duplicate is installed, and (b) `$react` resolves against the *root package's direct dependencies*, but react is not a root direct dep here — so `pnpm install`/`add` fails with "Cannot resolve version $react in overrides."

**How to apply:** When following the object-storage (or any Uppy v5) setup, check the catalog's react version in `pnpm-workspace.yaml` first. If it's already >=19, do not add the `$react` overrides at all.
