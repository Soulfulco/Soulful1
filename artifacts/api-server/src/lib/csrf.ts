import { type Request } from "express";

/**
 * Practitioner/HR session cookies are set with sameSite:"none", so the browser
 * will attach them to cross-site requests. For state-changing endpoints that
 * rely only on the session cookie, verify the request originated from our own
 * site by checking the Origin (falling back to Referer) against the app's
 * allowed hosts. Browsers always send Origin on cross-origin POST/DELETE and on
 * same-origin state-changing fetches, so a missing/mismatched value is rejected.
 */
export function isSameOrigin(req: Request): boolean {
  const allowed = new Set<string>();
  for (const d of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
    const t = d.trim().toLowerCase();
    if (t) allowed.add(t);
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
