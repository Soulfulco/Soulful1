---
  name: pnpm packageManager pin breaks Replit workflows
  description: This repo pins packageManager/engines.pnpm to 11.10.0 for Railway deploys, but the Replit env's pnpm is 10.26.1 and cannot self-install 11.10.0 (network-restricted), so every "pnpm --filter ... run dev" workflow hangs/fails with SIGABRT on "pnpm add pnpm@11.10.0".
  ---

  The pin was added deliberately (commits "pin pnpm version to match lockfile generator" / "pin engines.pnpm to force correct pnpm version in Railway builds") for the Railway deployment target, not a mistake — do not revert it without checking with the user.

  **Why:** Replit's workflow runner shells out via the pnpm wrapper, which reads packageManager/engines.pnpm and tries to self-install the pinned version before running any script. That install requires network access this sandbox restricts, so it SIGABRTs in a retry loop and the workflow never starts (port never opens), even though the underlying app code is fine.

  **How to apply:** When any `pnpm --filter <pkg> run <script>` workflow fails/hangs with repeated "ERROR pnpm add pnpm@<version>" in its log, don't debug the app code first — check `package.json` for a `packageManager`/`engines.pnpm` version mismatch against the installed `pnpm --version`. Work around it locally with direct tool invocations instead of the pnpm wrapper (e.g. `npx tsc -p <tsconfig>`, `npx tsc -b <project>`, `npx orval --config <config>`) rather than `pnpm --filter ... run <script>`. This also means dev-server workflows (vite, express, etc.) started via pnpm cannot run/preview in this env until the version pin is resolved — flag this to the user rather than silently declaring the feature untestable.
  