import { Router } from "express";
import { db } from "@workspace/db";
import {
  practitionersTable,
  companiesTable,
  bookingsTable,
  subscriptionPlansTable,
  companySubscriptionsTable,
  practitionerSubscriptionsTable,
  timeSlotsTable,
  reviewsTable,
} from "@workspace/db";
import { eq, count, avg, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (_req, res) => {
  try {
    const [{ totalPractitioners }] = await db.select({ totalPractitioners: count() }).from(practitionersTable);
    const [{ totalCompanies }] = await db.select({ totalCompanies: count() }).from(companiesTable);
    const [{ totalBookings }] = await db.select({ totalBookings: count() }).from(bookingsTable);
    const [{ activePractitioners }] = await db
      .select({ activePractitioners: count() })
      .from(practitionersTable)
      .where(eq(practitionersTable.isActive, true));
    const [{ activeCompanies }] = await db
      .select({ activeCompanies: count() })
      .from(companiesTable)
      .where(eq(companiesTable.subscriptionStatus, "active"));

    // Revenue = sum of all subscription prices
    const corpSubs = await db.select({ planId: companySubscriptionsTable.planId }).from(companySubscriptionsTable).where(eq(companySubscriptionsTable.status, "active"));
    const practSubs = await db.select({ planId: practitionerSubscriptionsTable.planId }).from(practitionerSubscriptionsTable).where(eq(practitionerSubscriptionsTable.status, "active"));
    const plans = await db.select().from(subscriptionPlansTable);
    const planPriceMap = Object.fromEntries(plans.map((p) => [p.id, Number(p.priceGbp)]));
    const totalRevenue = [...corpSubs, ...practSubs].reduce((sum, s) => sum + (planPriceMap[s.planId] ?? 0), 0);

    // Bookings this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const allBookings = await db.select({ createdAt: bookingsTable.createdAt }).from(bookingsTable);
    const bookingsThisMonth = allBookings.filter((b) => b.createdAt >= monthStart).length;

    // Average rating
    const [{ avgRating }] = await db.select({ avgRating: avg(reviewsTable.rating) }).from(reviewsTable);

    res.json({
      totalPractitioners: Number(totalPractitioners),
      totalCompanies: Number(totalCompanies),
      totalBookings: Number(totalBookings),
      totalRevenue,
      activePractitioners: Number(activePractitioners),
      activeCompanies: Number(activeCompanies),
      bookingsThisMonth,
      averageRating: avgRating ? Number(Number(avgRating).toFixed(1)) : 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

router.get("/dashboard/upcoming-bookings", async (req, res) => {
  try {
    const { companyId, practitionerId } = req.query as { companyId?: string; practitionerId?: string };
    const bookings = await db.select().from(bookingsTable);
    const practitioners = await db.select({ id: practitionersTable.id, name: practitionersTable.name }).from(practitionersTable);
    const companies = await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable);
    const slots = await db.select().from(timeSlotsTable);

    const practMap = Object.fromEntries(practitioners.map((p) => [p.id, p.name]));
    const compMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    const slotMap = Object.fromEntries(slots.map((s) => [s.id, s]));

    let result = bookings
      .filter((b) => b.status !== "cancelled" && b.status !== "completed")
      .map((b) => ({
        ...b,
        practitionerName: practMap[b.practitionerId] ?? null,
        companyName: compMap[b.companyId] ?? null,
        startTime: slotMap[b.timeSlotId]?.startTime?.toISOString() ?? null,
        endTime: slotMap[b.timeSlotId]?.endTime?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
      }))
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
      .slice(0, 5);

    if (companyId) result = result.filter((b) => b.companyId === Number(companyId));
    if (practitionerId) result = result.filter((b) => b.practitionerId === Number(practitionerId));

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to get upcoming bookings" });
  }
});

router.get("/dashboard/popular-practitioners", async (_req, res) => {
  try {
    const bookings = await db.select({ practitionerId: bookingsTable.practitionerId }).from(bookingsTable);
    const counts: Record<number, number> = {};
    for (const b of bookings) counts[b.practitionerId] = (counts[b.practitionerId] ?? 0) + 1;
    const sorted = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => Number(id));

    const practitioners = await db.select().from(practitionersTable);
    const result = sorted
      .map((id) => practitioners.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({
        ...p!,
        sessionRateGbp: Number(p!.sessionRateGbp),
        inPersonRateGbp: p!.inPersonRateGbp != null ? Number(p!.inPersonRateGbp) : null,
        onlineRateGbp: p!.onlineRateGbp != null ? Number(p!.onlineRateGbp) : null,
        averageRating: p!.averageRating ? Number(p!.averageRating) : null,
        createdAt: p!.createdAt.toISOString(),
      }));

    // If fewer than 3, pad with any practitioners
    if (result.length < 3) {
      const extra = practitioners
        .filter((p) => !result.find((r) => r.id === p.id))
        .slice(0, 5 - result.length)
        .map((p) => ({
          ...p,
          sessionRateGbp: Number(p.sessionRateGbp),
          inPersonRateGbp: p.inPersonRateGbp != null ? Number(p.inPersonRateGbp) : null,
          onlineRateGbp: p.onlineRateGbp != null ? Number(p.onlineRateGbp) : null,
          averageRating: p.averageRating ? Number(p.averageRating) : null,
          createdAt: p.createdAt.toISOString(),
        }));
      result.push(...extra);
    }

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to get popular practitioners" });
  }
});

router.get("/dashboard/specialisms", async (_req, res) => {
  try {
    const bookings = await db.select({ practitionerId: bookingsTable.practitionerId }).from(bookingsTable);
    const practitioners = await db
      .select({ id: practitionersTable.id, specialism: practitionersTable.specialism })
      .from(practitionersTable);
    const specMap = Object.fromEntries(practitioners.map((p) => [p.id, p.specialism]));

    const counts: Record<string, number> = {};
    for (const b of bookings) {
      const s = specMap[b.practitionerId] ?? "Other";
      counts[s] = (counts[s] ?? 0) + 1;
    }

    // If no bookings yet, show practitioners by specialism
    if (Object.keys(counts).length === 0) {
      for (const p of practitioners) {
        counts[p.specialism] = (counts[p.specialism] ?? 0) + 1;
      }
    }

    res.json(Object.entries(counts).map(([specialism, count]) => ({ specialism, count })));
  } catch {
    res.status(500).json({ error: "Failed to get specialism breakdown" });
  }
});

export default router;
