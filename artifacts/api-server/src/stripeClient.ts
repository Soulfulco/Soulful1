import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

/**
 * Reads Stripe credentials from standard environment variables.
 *
 * Previously these were fetched from Replit's own "Connectors" API
 * (REPLIT_CONNECTORS_HOSTNAME / REPL_IDENTITY), which only exists inside
 * Replit's own hosting environment. That meant every Stripe-dependent
 * feature — checkout, subscription plan seeding, webhook sync — silently
 * failed once the app was deployed anywhere else (e.g. Railway). Reading
 * from plain env vars keeps this working regardless of host.
 */
function getStripeCredentials(): { secretKey: string; webhookSecret?: string } {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY environment variable is not set. " +
        "Add it in your hosting provider's Variables settings.",
    );
  }
  return {
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  };
}

/**
 * Returns an authenticated Stripe client.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns a StripeSync instance for webhook processing and data sync.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const { secretKey, webhookSecret } = getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}
