import { Router } from "express";
import { db } from "@workspace/db";
import { practitionersTable, googleBusyBlocksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { baseUrl } from "../lib/url";
import { practitionerId } from "../lib/roles";
import { isSameOrigin } from "../lib/csrf";
import { logger } from "../lib/logger";
import {
  googleConfigured,
  getAuthUrl,
  exchangeCode,
  getFreeBusy,
} from "../lib/googleCalendar";

const router = Router();

const STATE_COOKIE = "g_oauth_state";
const PORTAL_PATH = "/practitioner/portal";

// How far ahead to pull busy times when syncing.
const SYNC_WINDOW_DAYS = 60;

// Begin the OAuth consent flow for the logged-in practitioner.
router.get("/practitioner/google/connect", (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  if (!googleConfigured()) {
    return res.status(503).json({ error: "Google Calendar is not configured yet" });
  }
  const nonce = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });
  const state = `${id}:${nonce}`;
  res.redirect(getAuthUrl(state));
});

// OAuth callback: store the refresh token on the practitioner.
router.get("/practitioner/google/callback", async (req, res) => {
  const id = practitionerId(req);
  const { code, state, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };
  const redirectBack = (status: string) => res.redirect(`${baseUrl()}${PORTAL_PATH}?google=${status}`);

  if (error || !code || !state) return redirectBack("error");
  if (!id) return res.status(401).json({ error: "Not authenticated" });

  const cookieNonce = req.cookies?.[STATE_COOKIE];
  const [stateId, stateNonce] = String(state).split(":");
  res.clearCookie(STATE_COOKIE, { path: "/" });
  if (!cookieNonce || stateNonce !== cookieNonce || Number(stateId) !== id) {
    return redirectBack("error");
  }

  try {
    const { refreshToken, email } = await exchangeCode(String(code));
    if (!refreshToken) {
      // No refresh token means Google didn't re-consent; ask the user to retry.
      logger.warn({ practitionerId: id }, "Google returned no refresh token");
      return redirectBack("noaccess");
    }
    await db
      .update(practitionersTable)
      .set({ googleRefreshToken: refreshToken, googleEmail: email })
      .where(eq(practitionersTable.id, id));

    await syncBusyBlocks(id, refreshToken).catch((err) =>
      logger.warn({ err, practitionerId: id }, "Initial busy sync failed"),
    );
    return redirectBack("connected");
  } catch (err) {
    logger.error({ err, practitionerId: id }, "Google OAuth callback failed");
    return redirectBack("error");
  }
});

// Disconnect Google Calendar.
router.post("/practitioner/google/disconnect", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Invalid request origin" });
  try {
    await db
      .update(practitionersTable)
      .set({ googleRefreshToken: null, googleEmail: null })
      .where(eq(practitionersTable.id, id));
    await db.delete(googleBusyBlocksTable).where(eq(googleBusyBlocksTable.practitionerId, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, practitionerId: id }, "Google disconnect failed");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// Manually re-pull busy times from Google.
router.post("/practitioner/google/sync", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Invalid request origin" });
  try {
    const [p] = await db
      .select({ token: practitionersTable.googleRefreshToken })
      .from(practitionersTable)
      .where(eq(practitionersTable.id, id));
    if (!p?.token) return res.status(400).json({ error: "Google Calendar is not connected" });
    const count = await syncBusyBlocks(id, p.token);
    res.json({ ok: true, busyBlocks: count });
  } catch (err) {
    logger.error({ err, practitionerId: id }, "Google sync failed");
    res.status(502).json({ error: "Failed to sync with Google Calendar" });
  }
});

// Replace the stored busy blocks for a practitioner with a fresh pull.
export async function syncBusyBlocks(id: number, refreshToken: string): Promise<number> {
  const now = new Date();
  const until = new Date(now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  // Fetch from Google BEFORE touching the DB so a network failure never wipes
  // existing busy blocks. The delete+insert swap runs atomically in a transaction.
  const busy = await getFreeBusy(refreshToken, now, until);
  await db.transaction(async (tx) => {
    await tx.delete(googleBusyBlocksTable).where(eq(googleBusyBlocksTable.practitionerId, id));
    if (busy.length > 0) {
      await tx.insert(googleBusyBlocksTable).values(
        busy.map((b) => ({ practitionerId: id, startTime: b.start, endTime: b.end })),
      );
    }
  });
  return busy.length;
}

export default router;
