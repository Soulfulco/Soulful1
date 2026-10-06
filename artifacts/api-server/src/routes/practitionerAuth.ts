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
    // Pending applicants can sign in so they can complete their price list ahead of
    // their onboarding call. They stay hidden from the public directory until approved.
    // Rejected accounts, and approved accounts an admin has deactivated, stay blocked.
    if (!p.isActive && p.approvalStatus !== "pending") return res.status(403).json({ error: "This account is not active. Please contact Soulful." });
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

import { isInsuranceExpired, parseExpiryDate } from "../lib/insurance";

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
    inPersonRateGbp: p.inPersonRateGbp != null ? Number(p.inPersonRateGbp) : null,
    onlineRateGbp: p.onlineRateGbp != null ? Number(p.onlineRateGbp) : null,
    groupInPersonRateGbp: p.groupInPersonRateGbp != null ? Number(p.groupInPersonRateGbp) : null,
    groupOnlineRateGbp: p.groupOnlineRateGbp != null ? Number(p.groupOnlineRateGbp) : null,
    googleConnected: Boolean(p.googleRefreshToken),
    googleEmail: p.googleEmail ?? null,
    phoneNumber: p.phoneNumber,
    qualificationsFileUrl: p.qualificationsFileUrl,
    insuranceFileUrl: p.insuranceFileUrl,
    hasOwnSpace: p.hasOwnSpace,
    ownSpaceDescription: p.ownSpaceDescription ?? null,
    insuranceExpiresOn: p.insuranceExpiresOn ?? null,
    insuranceExpired: isInsuranceExpired(p.insuranceExpiresOn),
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
    const {
      phoneNumber, qualificationsFileUrl, insuranceFileUrl,
      inPersonRateGbp, onlineRateGbp, groupInPersonRateGbp, groupOnlineRateGbp,
      hasOwnSpace, ownSpaceDescription, insuranceExpiresOn,
    } = req.body ?? {};
    const updates: Record<string, unknown> = {};
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (qualificationsFileUrl !== undefined) updates.qualificationsFileUrl = qualificationsFileUrl;
    if (insuranceFileUrl !== undefined) updates.insuranceFileUrl = insuranceFileUrl;

    // "I have my own space": lets employers choose the practitioner's space as the
    // location for an in-person 1:1 session.
    if (hasOwnSpace !== undefined || ownSpaceDescription !== undefined) {
      if (hasOwnSpace !== undefined && typeof hasOwnSpace !== "boolean") {
        return res.status(400).json({ error: "hasOwnSpace must be true or false" });
      }
      if (ownSpaceDescription !== undefined && ownSpaceDescription !== null && typeof ownSpaceDescription !== "string") {
        return res.status(400).json({ error: "Space details must be text" });
      }
      const [existing] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
      if (!existing) return res.status(404).json({ error: "Practitioner not found" });
      const nextHasSpace = hasOwnSpace !== undefined ? hasOwnSpace : existing.hasOwnSpace;
      const rawDescription = ownSpaceDescription !== undefined ? ownSpaceDescription : existing.ownSpaceDescription;
      const nextDescription = typeof rawDescription === "string" ? rawDescription.trim() : "";
      if (nextDescription.length > 500) {
        return res.status(400).json({ error: "Space details must be 500 characters or fewer" });
      }
      if (nextHasSpace && !nextDescription) {
        return res.status(400).json({ error: "Add your space's address or details so clients know where to go" });
      }
      updates.hasOwnSpace = nextHasSpace;
      updates.ownSpaceDescription = nextHasSpace ? nextDescription : null;
    }

    // Insurance certificate and its expiry date. A newly uploaded certificate must come with the
    // expiry date printed on it, and removing the certificate clears the date. Practitioners who
    // uploaded a certificate before expiry dates existed can still edit their other details.
    if (insuranceFileUrl !== undefined || insuranceExpiresOn !== undefined) {
      const [cur] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
      if (!cur) return res.status(404).json({ error: "Practitioner not found" });
      let nextDate: string | null = cur.insuranceExpiresOn ?? null;
      if (insuranceExpiresOn !== undefined) {
        if (insuranceExpiresOn === null || insuranceExpiresOn === "") {
          nextDate = null;
        } else {
          const parsed = parseExpiryDate(insuranceExpiresOn);
          if (!parsed) {
            return res.status(400).json({ error: "Enter the insurance expiry date as a real date, no more than 10 years ahead" });
          }
          nextDate = parsed;
        }
      }
      const nextUrl = insuranceFileUrl !== undefined ? (insuranceFileUrl || null) : (cur.insuranceFileUrl ?? null);
      const documentChanged = insuranceFileUrl !== undefined && nextUrl !== (cur.insuranceFileUrl || null);
      if (!nextUrl) {
        nextDate = null;
      } else if (documentChanged && !nextDate) {
        return res.status(400).json({ error: "Add the expiry date shown on your new insurance certificate" });
      }
      updates.insuranceExpiresOn = nextDate;
    }

    // Price list ("My Offerings"): 1:1 and group rates, in-person and online.
    // Omitted = unchanged; null/empty/0 = clear that offering. sessionRateGbp
    // (the base rate the booking system reads) is re-derived so it always
    // matches a live offering, and at least one offering must remain.
    if (
      inPersonRateGbp !== undefined || onlineRateGbp !== undefined ||
      groupInPersonRateGbp !== undefined || groupOnlineRateGbp !== undefined
    ) {
      const [current] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
      if (!current) return res.status(404).json({ error: "Practitioner not found" });
      const toRate = (v: unknown, existing: string | null): number | null | undefined => {
        if (v === undefined) return existing != null ? Number(existing) : null;
        if (v === null || v === "") return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 10000) return undefined;
        return n > 0 ? n : null;
      };
      const inPerson = toRate(inPersonRateGbp, current.inPersonRateGbp);
      const online = toRate(onlineRateGbp, current.onlineRateGbp);
      const groupInPerson = toRate(groupInPersonRateGbp, current.groupInPersonRateGbp);
      const groupOnline = toRate(groupOnlineRateGbp, current.groupOnlineRateGbp);
      if ([inPerson, online, groupInPerson, groupOnline].includes(undefined)) {
        return res.status(400).json({ error: "Rates must be numbers between 0 and 10,000" });
      }
      const baseRate = inPerson ?? online ?? groupInPerson ?? groupOnline;
      if (baseRate == null) {
        return res.status(400).json({ error: "At least one rate is required" });
      }
      updates.inPersonRateGbp = inPerson != null ? String(inPerson) : null;
      updates.onlineRateGbp = online != null ? String(online) : null;
      updates.groupInPersonRateGbp = groupInPerson != null ? String(groupInPerson) : null;
      updates.groupOnlineRateGbp = groupOnline != null ? String(groupOnline) : null;
      updates.sessionRateGbp = String(baseRate);
    }
    const [updated] = await db.update(practitionersTable).set(updates).where(eq(practitionersTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Practitioner not found" });
    res.json({
      phoneNumber: updated.phoneNumber,
      qualificationsFileUrl: updated.qualificationsFileUrl,
      insuranceFileUrl: updated.insuranceFileUrl,
      inPersonRateGbp: updated.inPersonRateGbp != null ? Number(updated.inPersonRateGbp) : null,
      onlineRateGbp: updated.onlineRateGbp != null ? Number(updated.onlineRateGbp) : null,
      groupInPersonRateGbp: updated.groupInPersonRateGbp != null ? Number(updated.groupInPersonRateGbp) : null,
      groupOnlineRateGbp: updated.groupOnlineRateGbp != null ? Number(updated.groupOnlineRateGbp) : null,
      hasOwnSpace: updated.hasOwnSpace,
      ownSpaceDescription: updated.ownSpaceDescription ?? null,
      insuranceExpiresOn: updated.insuranceExpiresOn ?? null,
      insuranceExpired: isInsuranceExpired(updated.insuranceExpiresOn),
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
  {
    // Pending applicants can sign in, but can't open availability until approved.
    const pendingCheckId = practitionerId(req);
    if (pendingCheckId) {
      const [pr] = await db
        .select({ isActive: practitionersTable.isActive })
        .from(practitionersTable)
        .where(eq(practitionersTable.id, pendingCheckId));
      if (pr && !pr.isActive) {
        return res.status(403).json({ error: "Availability opens once your profile is approved." });
      }
    }
  }
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