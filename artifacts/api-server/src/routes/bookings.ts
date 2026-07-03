import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, practitionersTable, companiesTable, timeSlotsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createEvent, deleteEvent } from "../lib/googleCalendar";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

function baseUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : "";
}

function serializeBooking(
  b: typeof bookingsTable.$inferSelect,
  extras: { practitionerName?: string | null; companyName?: string | null; startTime?: string | null; endTime?: string | null }
) {
  return {
    ...b,
    practitionerName: extras.practitionerName ?? null,
    companyName: extras.companyName ?? null,
    startTime: extras.startTime ?? null,
    endTime: extras.endTime ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/bookings", async (req, res) => {
  try {
    const { companyId, practitionerId, status } = req.query as {
      companyId?: string;
      practitionerId?: string;
      status?: string;
    };

    const bookings = await db.select().from(bookingsTable);
    const practitioners = await db.select({ id: practitionersTable.id, name: practitionersTable.name }).from(practitionersTable);
    const companies = await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable);
    const slots = await db.select().from(timeSlotsTable);

    const practMap = Object.fromEntries(practitioners.map((p) => [p.id, p.name]));
    const compMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    const slotMap = Object.fromEntries(slots.map((s) => [s.id, s]));

    let result = bookings.map((b) => ({
      ...b,
      practitionerName: practMap[b.practitionerId] ?? null,
      companyName: compMap[b.companyId] ?? null,
      startTime: slotMap[b.timeSlotId]?.startTime?.toISOString() ?? null,
      endTime: slotMap[b.timeSlotId]?.endTime?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    }));

    if (companyId) result = result.filter((b) => b.companyId === Number(companyId));
    if (practitionerId) result = result.filter((b) => b.practitionerId === Number(practitionerId));
    if (status) result = result.filter((b) => b.status === status);

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to list bookings" });
  }
});

// GET /bookings/confirm?session_id= — confirm a self-funded booking after Stripe redirect
router.get("/bookings/confirm", async (req, res) => {
  try {
    const sessionId = String(req.query.session_id ?? "");
    if (!sessionId) return res.status(400).json({ error: "session_id is required" });

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.stripeSessionId, sessionId))
      .limit(1);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.status === "confirmed") return res.json({ status: "confirmed", bookingId: booking.id });

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      await db.update(bookingsTable).set({ status: "confirmed" }).where(eq(bookingsTable.id, booking.id));
      return res.json({ status: "confirmed", bookingId: booking.id });
    }
    res.json({ status: booking.status, bookingId: booking.id });
  } catch (err) {
    logger.error({ err }, "Failed to confirm booking");
    res.status(500).json({ error: "Failed to confirm booking" });
  }
});

router.post("/bookings", async (req, res) => {
  try {
    const { companyId, practitionerId, timeSlotId, sessionType, employeeName, employeeEmail, notes, paymentType } = req.body;

    const effectivePaymentType: string = paymentType === "self" ? "self" : "corporate";

    // For self-funded bookings, create a pending booking then redirect to Stripe Checkout.
    if (effectivePaymentType === "self") {
      const [p] = await db
        .select({
          name: practitionersTable.name,
          specialism: practitionersTable.specialism,
          sessionRateGbp: practitionersTable.sessionRateGbp,
          inPersonRateGbp: practitionersTable.inPersonRateGbp,
          onlineRateGbp: practitionersTable.onlineRateGbp,
          googleRefreshToken: practitionersTable.googleRefreshToken,
        })
        .from(practitionersTable)
        .where(eq(practitionersTable.id, practitionerId));

      if (!p) return res.status(404).json({ error: "Practitioner not found" });

      const rate = Number(p.inPersonRateGbp ?? p.onlineRateGbp ?? p.sessionRateGbp ?? 0);
      if (rate <= 0) return res.status(400).json({ error: "Practitioner has no rate set" });

      const [booking] = await db
        .insert(bookingsTable)
        .values({ companyId, practitionerId, timeSlotId, sessionType, employeeName, employeeEmail, notes, paymentType: "self", status: "pending" })
        .returning();

      await db.update(timeSlotsTable).set({ isBooked: true }).where(eq(timeSlotsTable.id, timeSlotId));

      const stripe = await getUncachableStripeClient();
      const origin = baseUrl();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: employeeEmail,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "gbp",
              unit_amount: Math.round(rate * 100),
              product_data: {
                name: `1:1 session with ${p.name}`,
                description: `${p.specialism ?? sessionType} — 60 minute session`,
              },
            },
          },
        ],
        metadata: { bookingId: String(booking.id), practitionerId: String(practitionerId) },
        success_url: `${origin}/practitioners/${practitionerId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/practitioners/${practitionerId}?checkout=cancelled`,
      });

      await db.update(bookingsTable).set({ stripeSessionId: session.id }).where(eq(bookingsTable.id, booking.id));

      return res.status(201).json({
        status: "payment_required",
        checkoutUrl: session.url,
        bookingId: booking.id,
      });
    }

    // Corporate-funded booking — confirm immediately.
    const [booking] = await db
      .insert(bookingsTable)
      .values({ companyId, practitionerId, timeSlotId, sessionType, employeeName, employeeEmail, notes, paymentType: "corporate" })
      .returning();

    await db.update(timeSlotsTable).set({ isBooked: true }).where(eq(timeSlotsTable.id, timeSlotId));
    const prevTb = (await db.select({ tb: companiesTable.totalBookings }).from(companiesTable).where(eq(companiesTable.id, companyId)))[0]?.tb ?? 0;
    await db.update(companiesTable).set({ totalBookings: prevTb + 1 }).where(eq(companiesTable.id, companyId));

    const [p] = await db.select({ name: practitionersTable.name, googleRefreshToken: practitionersTable.googleRefreshToken }).from(practitionersTable).where(eq(practitionersTable.id, practitionerId));
    const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, companyId));
    const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, timeSlotId));

    if (p?.googleRefreshToken && slot) {
      try {
        const eventId = await createEvent(p.googleRefreshToken, {
          summary: `Soulful session — ${employeeName}`,
          description: `${sessionType ?? "Wellbeing session"} with ${employeeName} (${employeeEmail})${c?.name ? `, ${c.name}` : ""}.${notes ? `\n\nNotes: ${notes}` : ""}`,
          start: slot.startTime,
          end: slot.endTime,
          attendeeEmail: employeeEmail,
        });
        await db.update(bookingsTable).set({ googleEventId: eventId }).where(eq(bookingsTable.id, booking.id));
        booking.googleEventId = eventId;
      } catch (err) {
        logger.warn({ err, bookingId: booking.id }, "Failed to push booking to Google Calendar");
      }
    }

    res.status(201).json(serializeBooking(booking, {
      practitionerName: p?.name,
      companyName: c?.name,
      startTime: slot?.startTime?.toISOString(),
      endTime: slot?.endTime?.toISOString(),
    }));
  } catch (err) {
    logger.error({ err }, "Failed to create booking");
    res.status(500).json({ error: "Failed to create booking" });
  }
});

router.get("/bookings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
    if (!booking) return res.status(404).json({ error: "Not found" });
    const [p] = await db.select({ name: practitionersTable.name }).from(practitionersTable).where(eq(practitionersTable.id, booking.practitionerId));
    const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, booking.companyId));
    const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, booking.timeSlotId));
    res.json(serializeBooking(booking, {
      practitionerName: p?.name,
      companyName: c?.name,
      startTime: slot?.startTime?.toISOString(),
      endTime: slot?.endTime?.toISOString(),
    }));
  } catch {
    res.status(500).json({ error: "Failed to get booking" });
  }
});

router.patch("/bookings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body;
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    const [booking] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, id)).returning();
    if (!booking) return res.status(404).json({ error: "Not found" });

    if (status === "cancelled" && booking.googleEventId) {
      const [pr] = await db.select({ token: practitionersTable.googleRefreshToken }).from(practitionersTable).where(eq(practitionersTable.id, booking.practitionerId));
      if (pr?.token) {
        try {
          await deleteEvent(pr.token, booking.googleEventId);
          await db.update(bookingsTable).set({ googleEventId: null }).where(eq(bookingsTable.id, id));
          booking.googleEventId = null;
        } catch (err) {
          logger.warn({ err, bookingId: id }, "Failed to delete Google Calendar event");
        }
      }
    }

    const [p] = await db.select({ name: practitionersTable.name }).from(practitionersTable).where(eq(practitionersTable.id, booking.practitionerId));
    const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, booking.companyId));
    const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, booking.timeSlotId));
    res.json(serializeBooking(booking, {
      practitionerName: p?.name,
      companyName: c?.name,
      startTime: slot?.startTime?.toISOString(),
      endTime: slot?.endTime?.toISOString(),
    }));
  } catch {
    res.status(500).json({ error: "Failed to update booking" });
  }
});

export default router;
