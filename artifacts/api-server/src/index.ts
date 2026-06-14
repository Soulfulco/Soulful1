import { runMigrations } from "stripe-replit-sync";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./stripeClient";
import { reconcileStripeToApp } from "./stripeReconcile";

/**
 * stripe-replit-sync's migrations guard enum creation with an UNQUALIFIED
 * `pg_type WHERE typname = '...'` check. This app already has a
 * `public.subscription_status` enum, so the guard sees it, skips creating
 * `stripe.subscription_status`, and the table migration then fails referencing
 * the missing type. Pre-create the stripe-schema enum (schema-qualified) so the
 * guard's skip is harmless. Values must match migration 0004 exactly; 'paused'
 * is intentionally omitted so migration 0039's `ADD VALUE 'paused'` still works.
 */
async function ensureStripeEnumCompat(): Promise<void> {
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS stripe`);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'subscription_status' AND n.nspname = 'stripe'
      ) THEN
        CREATE TYPE "stripe"."subscription_status" AS ENUM (
          'trialing', 'active', 'canceled', 'incomplete',
          'incomplete_expired', 'past_due', 'unpaid'
        );
      END IF;
    END
    $$;
  `);
}

/**
 * Initialize the Stripe schema and sync data on startup.
 * Resilient by design: this API server serves many features, so a missing or
 * not-yet-connected Stripe integration must NOT crash the process. All failures
 * are logged and swallowed.
 */
async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("Stripe init skipped: DATABASE_URL not set");
    return;
  }
  try {
    await ensureStripeEnumCompat();
    await runMigrations({ databaseUrl, schema: "stripe" });
    const stripeSync = await getStripeSync();

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      const webhookResult = await stripeSync.findOrCreateManagedWebhook(
        `https://${domain}/api/stripe/webhook`,
      );
      logger.info(
        { url: webhookResult?.webhook?.url ?? "configured" },
        "Stripe managed webhook ready",
      );
    } else {
      logger.warn("Stripe webhook setup skipped: REPLIT_DOMAINS not set");
    }

    // Backfill and reconcile in the background so startup isn't blocked.
    // `object: "all"` is required — with no params the library defaults to a
    // non-matching value and silently syncs nothing.
    stripeSync
      .syncBackfill({ object: "all" })
      .then(() => reconcileStripeToApp())
      .then(() => logger.info("Stripe data synced and reconciled"))
      .catch((err) => logger.error({ err }, "Stripe backfill/reconcile failed"));
  } catch (err) {
    logger.error({ err }, "Stripe initialization failed (continuing without Stripe)");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Initialize Stripe in the background; never block or crash the server.
  initStripe().catch((err) => logger.error({ err }, "initStripe threw unexpectedly"));
});
