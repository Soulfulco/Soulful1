import { type Request } from "express";
import { baseUrl } from "./url";

/**
 * Practitioner/HR session cookies are set with sameSite:"none", so the browser
 * will attach them to cross-site requests. For state-changing endpoints that
 * rely only on the session cookie, verify the request originated from our own
 * frontend by checking the Origin (falling back to Referer) against the app's
 * allowed hosts. Browsers always send Origin on cross-origin POST/DELETE and on
 * same-origin state-changing fetches, so a missing/mismatched value is rejected.
 *
 * Previously checked process.env.REPLIT_DOMAINS (Replit-only, empty on
 * Railway) and req.headers.host (the API's own domain, e.g. api.soulfulco.uk)
 * — neither ever matched the real Origin header sent by the frontend
 * (app.soulfulco.uk), since frontend and API are deliberately on different
 * subdomains. This silently blocked every state-changing request that used
 * this check. baseUrl() (APP_URL) correctly resolves to the frontend's real
 * domain instead.
 */
export function isSameOrigin(req: Request): boolean {
  const allowed = new Set<string>();

  try {
    allowed.add(new URL(baseUrl()).host.toLowerCase());
  } catch {
    // APP_URL not set — fall through to host-only check below.
  }

  const host = req.headers.host?.toLowerCase();
  if (host) allowed.add(host);

  const source = req.headers.origin ?? req.headers.referer;
  if (!source) return false;
  try {
    return allowed.has(new URL(source).host.toLowerCase());
  } catch {
    return false;
  }
}
