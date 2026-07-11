import Stripe from "stripe";

/**
 * Reads the Stripe secret key from a standard environment variable rather
 * than Replit's Connectors API, so this script works from any environment
 * (CI, another host's shell, etc.), not just inside Replit itself.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY environment variable is not set. " +
        "Set it before running this script.",
    );
  }
  return new Stripe(secretKey);
}
