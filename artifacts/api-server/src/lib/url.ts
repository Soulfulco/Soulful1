/**
 * The app's own public URL, used for building redirect URLs (Stripe
 * checkout success/cancel, OAuth callbacks, etc). Previously this read
 * process.env.REPLIT_DOMAINS, which only exists inside Replit's own
 * infrastructure — so every redirect URL silently broke once deployed
 * anywhere else (e.g. Railway).
 *
 * Set APP_URL in your hosting provider's environment variables, e.g.
 * APP_URL=https://app.soulfulco.uk
 */
export function baseUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error(
      "APP_URL environment variable is not set. Set it to your app's public URL, e.g. https://app.soulfulco.uk",
    );
  }
  return url.replace(/\/$/, "");
}
