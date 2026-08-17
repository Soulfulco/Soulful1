import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { practitionersTable, timeSlotsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  createSession,
  clearSession,
  getSessionId,
  SESSION_COOKIE,
  SESSION_TTL,
} from "../lib/auth";
import { isAdmin, practitionerId } from "../lib/roles";
import { isSameOrigin } from "../lib/csrf";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../stripeClient";
import { baseUrl } from "../lib/url";

const router = Router();

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

function setSessionCookie(res: any, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
function lastName(name: string): string | null {
  return name.split(" ").slice(1).join(" ") || null;
}

// Practitioner login
router.post("/practitioner/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const [p] = await db
      .select()
      .from(practitionersTable)
      .where(eq(practitionersTable.email, String(email).toLowerCase().trim()));

    if (!p || !p.passwordHash) return res.status(401).json({ error: "Invalid credentials" });
    if (!p.isActive) return res.status(403).json({ error: "This account is not active. Please contact Soulful." });
    if (!verifyPassword(String(password), p.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionData = {
      user: {
        id: `pract:${p.id}`,
        email: p.email,
        firstName: firstName(p.name),
        lastName: lastName(p.name),
        profileImageUrl: p.avatarUrl ?? null,
      },
      practitionerId: p.id,
      access_token: "",
    };
    const sid = await createSession(sessionData as any);
    setSessionCookie(res, sid);
    res.json({ ok: true, user: sessionData.user });
  } catch (err) {
    logger.error({ err }, "Practitioner login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

// Practitioner logout
router.post("/practitioner/logout", async (req, res) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ ok: true });
});

// Current practitioner profile
router.get("/practitioner/me", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  const [p] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
  if (!p) return res.status(404).json({ error: "Practitioner not found" });
  res.json({
    id: p.id,
    name: p.name,
    email: p.email,
    specialism: p.specialism,
    avatarUrl: p.avatarUrl,
    isActive: p.isActive,
    approvalStatus: p.approvalStatus,
    googleConnected: Boolean(p.googleRefreshToken),
    googleEmail: p.googleEmail ?? null,
    phoneNumber: p.phoneNumber,
    qualificationsFileUrl: p.qualificationsFileUrl,
    insuranceFileUrl: p.insuranceFileUrl,
  });
});

// ── Stripe Connect (payouts) ──────────────────────────────────────────

router.post("/practitioner/stripe/connect", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const [p] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
    if (!p) return res.status(404).json({ error: "Practitioner not found" });

    const stripe = await getUncachableStripeClient();
    let accountId = p.stripeConnectAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: p.email,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_type: "individual",
      });
      accountId = account.id;
      await db.update(practitionersTable).set({ stripeConnectAccountId: accountId }).where(eq(practitionersTable.id, id));
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl()}/practitioner/portal?stripe=refresh`,
      return_url: `${baseUrl()}/practitioner/portal?stripe=return`,
      type: "account_onboarding",
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    logger.error({ err }, "Failed to start Stripe Connect onboarding");
    res.status(500).json({ error: "Failed to start Stripe onboarding" });
  }
});

router.get("/practitioner/stripe/status", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const [p] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
    if (!p) return res.status(404).json({ error: "Practitioner not found" });
    if (!p.stripeConnectAccountId) {
      return res.json({ connected: false, chargesEnabled: false, payoutsEnabled: false });
    }
    const stripe = await getUncachableStripeClient();
    const account = await stripe.accounts.retrieve(p.stripeConnectAccountId);
    res.json({
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch Stripe Connect status");
    res.status(500).json({ error: "Failed to fetch Stripe status" });
  }
});

// ── Self-service profile fields (phone, documents) ────────────────────

router.patch("/practitioner/profile", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Invalid request origin" });
  try {
    const { phoneNumber, qualificationsFileUrl, insuranceFileUrl } = req.body ?? {};
    const updates: Record<string, unknown> = {};
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (qualificationsFileUrl !== undefined) updates.qualificationsFileUrl = qualificationsFileUrl;
    if (insuranceFileUrl !== undefined) updates.insuranceFileUrl = insuranceFileUrl;
    const [updated] = await db.update(practitionersTable).set(updates).where(eq(practitionersTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Practitioner not found" });
    res.json({
      phoneNumber: updated.phoneNumber,
      qualificationsFileUrl: updated.qualificationsFileUrl,
      insuranceFileUrl: updated.insuranceFileUrl,
    });
  } catch (err) {
    logger.error({ err }, "Failed to update practitioner profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ── Dashboard stats ─────────────────────────────────────────────────────

router.get("/practitioner/dashboard-stats", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const [practitioner] = await db
      .select({ averageRating: practitionersTable.averageRating, totalReviews: practitionersTable.totalReviews })
      .from(practitionersTable)
      .where(eq(practitionersTable.id, id));

    const revenueResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(price_gbp * (1 - commission_rate_pct / 100)), 0) AS earnings_this_month_gbp,
        COUNT(*) FILTER (WHERE status IN ('confirmed', 'pending')) AS bookings_this_month
      FROM bookings b
      JOIN time_slots ts ON ts.id = b.time_slot_id
      WHERE b.practitioner_id = ${id}
        AND ts.start_time >= date_trunc('month', now())
        AND ts.start_time < date_trunc('month', now()) + interval '1 month'
        AND b.price_gbp IS NOT NULL
    `);
    const revenueRow = revenueResult.rows[0] as { earnings_this_month_gbp: string; bookings_this_month: string };

    const upcomingResult = await db.execute(sql`
      SELECT COUNT(*) AS upcoming_count
      FROM bookings b
      JOIN time_slots ts ON ts.id = b.time_slot_id
      WHERE b.practitioner_id = ${id}
        AND b.status IN ('confirmed', 'pending')
        AND ts.start_time >= now()
    `);
    const upcomingCount = Number((upcomingResult.rows[0] as { upcoming_count: string }).upcoming_count);

    const capacityResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(gs.max_attendees), 0) AS total_capacity,
        COALESCE(COUNT(gsa.id), 0) AS total_attendees
      FROM group_sessions gs
      LEFT JOIN group_session_attendees gsa ON gsa.group_session_id = gs.id
      WHERE gs.practitioner_id = ${id}
        AND gs.start_time >= now() - interval '30 days'
    `);
    const capRow = capacityResult.rows[0] as { total_capacity: string; total_attendees: string };
    const totalCapacity = Number(capRow.total_capacity);
    const totalAttendees = Number(capRow.total_attendees);

    res.json({
      earningsThisMonthGbp: Number(revenueRow.earnings_this_month_gbp),
      bookingsThisMonth: Number(revenueRow.bookings_this_month),
      upcomingBookings: upcomingCount,
      avgCapacityFilledPct: totalCapacity > 0 ? Math.round((totalAttendees / totalCapacity) * 100) : null,
      ratingOutOf5: practitioner?.averageRating != null ? Number(practitioner.averageRating) : null,
      totalReviews: practitioner?.totalReviews ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch practitioner dashboard stats");
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// List my availability
router.get("/practitioner/availability", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const slots = await db
      .select()
      .from(timeSlotsTable)
      .where(eq(timeSlotsTable.practitionerId, id));
    res.json(
      slots.map((s) => ({
        ...s,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
      })),
    );
  } catch (err) {
    logger.error({ err }, "Failed to list practitioner availability");
    res.status(500).json({ error: "Failed to load availability" });
  }
});

// Add a slot to my availability
router.post("/practitioner/availability", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Invalid request origin" });
  try {
    const { startTime, endTime, sessionType } = req.body ?? {};
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "Valid startTime and endTime are required" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "End time must be after start time" });
    }
    const [slot] = await db
      .insert(timeSlotsTable)
      .values({ practitionerId: id, startTime: start, endTime: end, sessionType: sessionType ?? null })
      .returning();
    res.status(201).json({ ...slot, startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() });
  } catch (err) {
    logger.error({ err }, "Failed to add availability slot");
    res.status(500).json({ error: "Failed to add slot" });
  }
});

// Delete one of my slots (only if unbooked and mine)
router.delete("/practitioner/availability/:slotId", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Invalid request origin" });
  try {
    const slotId = Number(req.params.slotId);
    if (!slotId || Number.isNaN(slotId)) return res.status(400).json({ error: "Invalid slot id" });
    const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, slotId));
    if (!slot || slot.practitionerId !== id) return res.status(404).json({ error: "Slot not found" });
    if (slot.isBooked) return res.status(409).json({ error: "This slot is already booked and cannot be removed" });
    await db.delete(timeSlotsTable).where(and(eq(timeSlotsTable.id, slotId), eq(timeSlotsTable.practitionerId, id)));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete availability slot");
    res.status(500).json({ error: "Failed to delete slot" });
  }
});

// Admin: set/reset a practitioner's portal password (onboard existing practitioners)
router.post("/practitioners/:id/set-password", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
  try {
    const id = Number(req.params.id);
    const { password } = req.body ?? {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const [p] = await db
      .update(practitionersTable)
      .set({ passwordHash: hashPassword(String(password)) })
      .where(eq(practitionersTable.id, id))
      .returning();
    if (!p) return res.status(404).json({ error: "Practitioner not found" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to set practitioner password");
    res.status(500).json({ error: "Failed to set password" });
  }
});

export default router;