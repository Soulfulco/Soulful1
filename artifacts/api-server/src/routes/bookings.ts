import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { bookingsTable, practitionersTable, companiesTable, timeSlotsTable, employeesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createEvent, deleteEvent } from "../lib/googleCalendar";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../stripeClient";
import { awardPoints } from "../lib/gamification";
import { logRequirementSafe } from "../lib/wellbeingRequirements";
import {
  isHr,
  isAdmin,
  isPractitioner,
  isEmployee,
  employeeId,
  practitionerId as sessionPractitionerId,
  resolveHrCompanyId,
} from "../lib/roles";
import { baseUrl } from "../lib/url";
import { isInsuranceExpired } from "../lib/insurance";

const router = Router();

const decisionDeadlineHours = 24;


// Self-funded bookings are excluded from gamification per the privacy model.
async function awardBookingPoints(companyId: number, employeeEmail: string): Promise<void> {
  try {
    const [employee] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.companyId, companyId), eq(employeesTable.email, employeeEmail)))
      .limit(1);
    if (employee) {
      await awardPoints(employee.id, "booking_1on1");
      logRequirementSafe(employee.id, "one_on_one", "auto");
    }
  } catch (err) {
    logger.error({ err, companyId, employeeEmail }, "Failed to award gamification points for booking");
  }
}

// Only admin, the booking's company (HR), the employee who made it, or its practitioner
// may view or change a booking.
async function canAccessBooking(req: Request, b: typeof bookingsTable.$inferSelect): Promise<boolean> {
  if (!req.isAuthenticated()) return false;
  if (isAdmin(req)) return true;
  if (isHr(req)) return (await resolveHrCompanyId(req)) === b.companyId;
  if (isPractitioner(req)) return sessionPractitionerId(req) === b.practitionerId;
  if (isEmployee(req)) {
    const empId = employeeId(req);
    if (empId == null) return false;
    const [emp] = await db
      .select({ email: employeesTable.email, companyId: employeesTable.companyId })
      .from(employeesTable)
      .where(eq(employeesTable.id, empId))
      .limit(1);
    return !!emp && emp.companyId === b.companyId && String(emp.email).toLowerCase() === String(b.employeeEmail).toLowerCase();
  }
  return false;
}

// Payment internals (Stripe identifiers and the Google Calendar event id) go to nobody but
// Soulful admins. Customers (HR and employees) also never see the commission rate or the payout
// status. A practitioner can see their own commission and payout status.
function stripInternalBookingFields<T extends Record<string, any>>(req: Request, b: T): any {
  if (isAdmin(req)) return b;
  const hidden = ["stripeSessionId", "stripePaymentIntentId", "stripeTransferId", "googleEventId"];
  if (!isPractitioner(req)) hidden.push("commissionRatePct", "payoutStatus");
  const copy: Record<string, any> = { ...b };
  for (const key of hidden) delete copy[key];
  return copy;
}

// HR sees bookings without notes, and without the employee's identity unless they chose to share it.
function redactBookingForViewer(req: Request, rawBooking: any) {
  const b = stripInternalBookingFields(req, rawBooking);
  if (!isHr(req)) return b;
  const isPrivate = !b.shareWithEmployer;
  return {
    ...b,
    notes: null,
    employeeName: isPrivate ? null : b.employeeName,
    employeeEmail: isPrivate ? null : b.employeeEmail,
    isPrivateBooking: isPrivate,
    locationDescription: isPrivate ? null : b.locationDescription,
  };
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
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (isPractitioner(req) || isEmployee(req)) {
      return res.status(403).json({ error: "Not authorized to list bookings" });
    }

    const { practitionerId: practitionerIdParam, status } = req.query as {
      companyId?: string;
      practitionerId?: string;
      status?: string;
    };

    let scopedCompanyId: number | null = null;
    if (isHr(req)) {
      scopedCompanyId = await resolveHrCompanyId(req);
      if (scopedCompanyId == null) {
        return res.status(403).json({ error: "No company associated with this account" });
      }
    } else if (isAdmin(req)) {
      const { companyId } = req.query as { companyId?: string };
      scopedCompanyId = companyId ? Number(companyId) : null;
    }

    const bookings = await db.select().from(bookingsTable);
    const practitioners = await db.select({ id: practitionersTable.id, name: practitionersTable.name }).from(practitionersTable);
    const companies = await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable);
    const slots = await db.select().from(timeSlotsTable);

    const practMap = Object.fromEntries(practitioners.map((p) => [p.id, p.name]));
    const compMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    const slotMap = Object.fromEntries(slots.map((s) => [s.id, s]));

    let result = bookings.map((b) => {
      const redactForHr = isHr(req);
      const isPrivate = !b.shareWithEmployer;
      return {
        ...b,
        notes: redactForHr ? null : b.notes,
        employeeName: redactForHr && isPrivate ? null : b.employeeName,
        employeeEmail: redactForHr && isPrivate ? null : b.employeeEmail,
        isPrivateBooking: redactForHr && isPrivate,
        locationDescription: redactForHr && isPrivate ? null : b.locationDescription,
        practitionerName: practMap[b.practitionerId] ?? null,
        companyName: compMap[b.companyId] ?? null,
        startTime: slotMap[b.timeSlotId]?.startTime?.toISOString() ?? null,
        endTime: slotMap[b.timeSlotId]?.endTime?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
      };
    });

    if (scopedCompanyId != null) result = result.filter((b) => b.companyId === scopedCompanyId);
    if (practitionerIdParam) result = result.filter((b) => b.practitionerId === Number(practitionerIdParam));
    if (status) result = result.filter((b) => b.status === status);

    res.json(result.map((b) => stripInternalBookingFields(req, b)));
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

    if (booking.status !== "pending") return res.json({ status: booking.status, bookingId: booking.id });
    if (booking.stripePaymentIntentId) {
      // Already authorized on an earlier call to this route; nothing further to do here.
      return res.json({ status: booking.status, bookingId: booking.id, awaitingPractitioner: true });
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      // The card is authorized, not yet charged: the practitioner still has to accept
      // before the employee is actually billed.
      await db.update(bookingsTable).set({
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
        decideBy: new Date(Date.now() + decisionDeadlineHours * 3600000),
      }).where(eq(bookingsTable.id, booking.id));
      return res.json({ status: "pending", bookingId: booking.id, awaitingPractitioner: true });
    }
    res.json({ status: booking.status, bookingId: booking.id });
  } catch (err) {
    logger.error({ err }, "Failed to confirm booking");
    res.status(500).json({ error: "Failed to confirm booking" });
  }
});

router.post("/bookings", async (req, res) => {
  try {
    const { companyId: bodyCompanyId, practitionerId, timeSlotId, sessionType, employeeName: bodyEmployeeName, employeeEmail: bodyEmployeeEmail, notes, paymentType, shareWithEmployer, sessionMode, locationType: bodyLocationType } = req.body;

    // Who is booking? The company and the person come from the signed-in session, never
    // from the request, so nobody can book against another company's card.
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Please sign in to book a session" });
    let companyId: number;
    let employeeName: string;
    let employeeEmail: string;
    if (isEmployee(req)) {
      const empId = employeeId(req);
      if (empId == null) return res.status(403).json({ error: "Your employee account could not be found" });
      const [emp] = await db
        .select({ companyId: employeesTable.companyId, name: employeesTable.name, email: employeesTable.email })
        .from(employeesTable)
        .where(eq(employeesTable.id, empId))
        .limit(1);
      if (!emp) return res.status(403).json({ error: "Your employee account could not be found" });
      companyId = emp.companyId;
      employeeName = emp.name;
      employeeEmail = emp.email;
    } else if (isHr(req)) {
      const hrCompanyId = await resolveHrCompanyId(req);
      if (hrCompanyId == null) return res.status(403).json({ error: "No company associated with this account" });
      const u = req.user as any;
      companyId = hrCompanyId;
      employeeName = String(bodyEmployeeName ?? "").trim() || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "HR booking";
      employeeEmail = String(bodyEmployeeEmail ?? "").trim() || String(u?.email ?? "");
      if (!employeeEmail) return res.status(400).json({ error: "An email address is required" });
    } else if (isAdmin(req)) {
      companyId = Number(bodyCompanyId);
      employeeName = String(bodyEmployeeName ?? "").trim();
      employeeEmail = String(bodyEmployeeEmail ?? "").trim();
      if (!Number.isInteger(companyId) || !employeeName || !employeeEmail) {
        return res.status(400).json({ error: "companyId, employeeName and employeeEmail are required" });
      }
    } else {
      return res.status(403).json({ error: "Only employees and HR can book sessions" });
    }

    const effectivePaymentType: string = paymentType === "self" ? "self" : "corporate";
    const effectiveShare: boolean = effectivePaymentType === "corporate" ? true : (shareWithEmployer !== false);

    const stripe = await getUncachableStripeClient();

    const [practitionerForPricing] = await db
      .select({
        name: practitionersTable.name,
        specialism: practitionersTable.specialism,
        inPersonRateGbp: practitionersTable.inPersonRateGbp,
        onlineRateGbp: practitionersTable.onlineRateGbp,
        sessionRateGbp: practitionersTable.sessionRateGbp,
        isActive: practitionersTable.isActive,
        groupInPersonRateGbp: practitionersTable.groupInPersonRateGbp,
        groupOnlineRateGbp: practitionersTable.groupOnlineRateGbp,
        commissionRatePct: practitionersTable.commissionRatePct,
        stripeConnectAccountId: practitionersTable.stripeConnectAccountId,
        googleRefreshToken: practitionersTable.googleRefreshToken,
        hasOwnSpace: practitionersTable.hasOwnSpace,
        ownSpaceDescription: practitionersTable.ownSpaceDescription,
        insuranceExpiresOn: practitionersTable.insuranceExpiresOn,
      })
      .from(practitionersTable)
      .where(eq(practitionersTable.id, practitionerId));

    if (!practitionerForPricing) return res.status(404).json({ error: "Practitioner not found" });
    // Hidden practitioners (pending, rejected or deactivated) can't be booked.
    if (!practitionerForPricing.isActive) return res.status(404).json({ error: "Practitioner not found" });
    // Nor can one whose insurance has lapsed, until they add a new certificate and expiry date.
    if (isInsuranceExpired(practitionerForPricing.insuranceExpiresOn)) {
      return res.status(409).json({ error: "This practitioner is not available to book right now." });
    }

    // The slot must belong to this practitioner, still be free and be in the future.
    if (!Number.isInteger(Number(timeSlotId))) return res.status(400).json({ error: "timeSlotId is required" });
    const [slotToBook] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, Number(timeSlotId))).limit(1);
    if (!slotToBook || slotToBook.practitionerId !== Number(practitionerId)) {
      return res.status(400).json({ error: "That time slot isn't available" });
    }
    if (slotToBook.isBooked || slotToBook.startTime.getTime() < Date.now()) {
      return res.status(409).json({ error: "That time slot has just been taken. Please choose another." });
    }

    const inPersonRate = practitionerForPricing.inPersonRateGbp != null ? Number(practitionerForPricing.inPersonRateGbp) : null;
    const onlineRate = practitionerForPricing.onlineRateGbp != null ? Number(practitionerForPricing.onlineRateGbp) : null;
    const groupInPersonRate = practitionerForPricing.groupInPersonRateGbp != null ? Number(practitionerForPricing.groupInPersonRateGbp) : null;
    const groupOnlineRate = practitionerForPricing.groupOnlineRateGbp != null ? Number(practitionerForPricing.groupOnlineRateGbp) : null;
    // Which option the employee chose: 1:1 or group, in person or online. Older clients
    // send nothing and keep the previous behaviour: 1:1 in-person rate first, then
    // online, then the base rate.
    const modeRates: Record<string, number | null> = {
      in_person: inPersonRate,
      online: onlineRate,
      group_in_person: groupInPersonRate,
      group_online: groupOnlineRate,
    };
    const mode: string | null =
      typeof sessionMode === "string" && Object.prototype.hasOwnProperty.call(modeRates, sessionMode) ? sessionMode : null;
    if (mode && modeRates[mode] == null) {
      return res.status(400).json({ error: "This practitioner doesn't offer that session type" });
    }
    // Practitioners who only offer group sessions have to be booked through a group option.
    if (!mode && inPersonRate == null && onlineRate == null && (groupInPersonRate != null || groupOnlineRate != null)) {
      return res.status(400).json({ error: "Please choose a session type" });
    }
    const rate = Number(
      (mode ? modeRates[mode] : (inPersonRate ?? onlineRate)) ?? practitionerForPricing.sessionRateGbp ?? 0
    );
    const isGroup = mode === "group_in_person" || mode === "group_online";
    if (isGroup && !isHr(req) && !isAdmin(req)) {
      return res.status(403).json({ error: "Group sessions are booked by your HR team. Once one is scheduled you can sign up to it from your dashboard." });
    }
    const isOnline = mode === "online" || mode === "group_online";
    const productLabel = isGroup
      ? `Group ${isOnline ? "online" : "in-person"} session (up to 50 people)`
      : mode ? `1:1 ${isOnline ? "online" : "in-person"} session` : "1:1 session";
    const modeSuffix = mode ? ` (${isGroup ? "group, " : ""}${isOnline ? "online" : "in person"})` : "";
    if (rate <= 0) return res.status(400).json({ error: "Practitioner has no rate set" });

    // Where an in-person 1:1 session happens: the client's office, or the practitioner's own
    // space if they've set one up. The practitioner's details are copied onto the booking so
    // they stay correct if the practitioner later changes them. A location only means
    // something for in-person 1:1 sessions, so it's ignored for online and group bookings.
    let locationType: string | null = null;
    let locationDescription: string | null = null;
    if (bodyLocationType !== undefined && bodyLocationType !== null) {
      if (bodyLocationType !== "at_office" && bodyLocationType !== "practitioner_space") {
        return res.status(400).json({ error: "Invalid session location" });
      }
      if (mode === "in_person") {
        if (bodyLocationType === "practitioner_space") {
          if (!practitionerForPricing.hasOwnSpace || !practitionerForPricing.ownSpaceDescription) {
            return res.status(400).json({ error: "This practitioner doesn't offer sessions at their own space" });
          }
          locationType = "practitioner_space";
          locationDescription = practitionerForPricing.ownSpaceDescription;
        } else {
          locationType = "at_office";
        }
      }
    }

    const commissionPct = Number(practitionerForPricing.commissionRatePct ?? 10);
    const amountPence = Math.round(rate * 100);

    let canSplit = false;
    if (practitionerForPricing.stripeConnectAccountId) {
      try {
        const acct = await stripe.accounts.retrieve(practitionerForPricing.stripeConnectAccountId);
        canSplit = Boolean(acct.payouts_enabled);
      } catch {
        canSplit = false;
      }
    }

    // ── CORPORATE: off-session charge to the company's card on file ──────
    if (effectivePaymentType === "corporate") {
      const [company] = await db
        .select({ stripeCustomerId: companiesTable.stripeCustomerId, name: companiesTable.name })
        .from(companiesTable)
        .where(eq(companiesTable.id, companyId));

      if (!company?.stripeCustomerId) {
        return res.status(402).json({ error: "This company doesn't have a payment method on file. Please contact Soulful support." });
      }

      const paymentMethods = await stripe.paymentMethods.list({ customer: company.stripeCustomerId, type: "card" });
      const paymentMethodId = paymentMethods.data[0]?.id;
      if (!paymentMethodId) {
        return res.status(402).json({ error: "No card on file for this company. Please update billing details before booking." });
      }

      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount: amountPence,
          currency: "gbp",
          customer: company.stripeCustomerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          // Authorize now, capture later: only takes the company's money once the
          // practitioner accepts, so a decline or a missed 24-hour window never
          // needs a refund.
          capture_method: "manual",
          description: `Soulful session — ${practitionerForPricing.name} for ${employeeName}`,
          metadata: { practitionerId: String(practitionerId), companyId: String(companyId), sessionType: sessionType ?? "" },
          ...(canSplit
            ? {
                application_fee_amount: Math.round(amountPence * (commissionPct / 100)),
                transfer_data: { destination: practitionerForPricing.stripeConnectAccountId! },
              }
            : {}),
        });
      } catch (err) {
        logger.error({ err, companyId, practitionerId }, "Failed to authorize payment for corporate booking");
        return res.status(402).json({ error: "Payment failed. Please check the company's card on file and try again." });
      }

      if (paymentIntent.status !== "requires_capture") {
        return res.status(402).json({ error: "Payment could not be authorized. Please try again." });
      }

      const [booking] = await db
        .insert(bookingsTable)
        .values({
          companyId, practitionerId, timeSlotId, sessionType, employeeName, employeeEmail, notes,
          sessionMode: mode,
          paymentType: "corporate", status: "pending", shareWithEmployer: effectiveShare,
          locationType, locationDescription,
          priceGbp: String(rate),
          commissionRatePct: String(commissionPct),
          payoutStatus: canSplit ? "auto_pending" : "manual_pending",
          stripeSessionId: paymentIntent.id,
          stripePaymentIntentId: paymentIntent.id,
          decideBy: new Date(Date.now() + decisionDeadlineHours * 3600000),
        })
        .returning();

      await db.update(timeSlotsTable).set({ isBooked: true }).where(eq(timeSlotsTable.id, timeSlotId));

      const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, companyId));
      const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, timeSlotId));

      res.status(201).json(stripInternalBookingFields(req, serializeBooking(booking, {
        practitionerName: practitionerForPricing.name,
        companyName: c?.name,
        startTime: slot?.startTime?.toISOString(),
        endTime: slot?.endTime?.toISOString(),
      })));
      return;
    }

    // ── SELF-FUNDED: Stripe Checkout, split via destination charge ───────
    const [pending] = await db
      .insert(bookingsTable)
      .values({
        companyId, practitionerId, timeSlotId, sessionType, employeeName, employeeEmail, notes,
        sessionMode: mode,
        paymentType: "self", status: "pending", shareWithEmployer: effectiveShare,
        locationType, locationDescription,
        priceGbp: String(rate),
        commissionRatePct: String(commissionPct),
        payoutStatus: canSplit ? "auto_pending" : "manual_pending",
      })
      .returning();

    await db.update(timeSlotsTable).set({ isBooked: true }).where(eq(timeSlotsTable.id, timeSlotId));

    const origin = baseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: employeeEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: amountPence,
            product_data: {
              name: `${productLabel} with ${practitionerForPricing.name}`,
              description: `${practitionerForPricing.specialism ?? sessionType} — 60 minute session`,
            },
          },
        },
      ],
      payment_intent_data: {
        // Same authorize-then-capture treatment as corporate bookings: the employee's
        // card is only actually charged once the practitioner accepts.
        capture_method: "manual",
        ...(canSplit
          ? {
              application_fee_amount: Math.round(amountPence * (commissionPct / 100)),
              transfer_data: { destination: practitionerForPricing.stripeConnectAccountId! },
            }
          : {}),
      },
      metadata: { bookingId: String(pending.id), practitionerId: String(practitionerId) },
      success_url: `${origin}/practitioners/${practitionerId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/practitioners/${practitionerId}?checkout=cancelled`,
    });

    await db.update(bookingsTable).set({ stripeSessionId: session.id }).where(eq(bookingsTable.id, pending.id));

    return res.status(201).json({
      status: "payment_required",
      checkoutUrl: session.url,
      bookingId: pending.id,
    });
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
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });
    if (!(await canAccessBooking(req, booking))) return res.status(403).json({ error: "Not authorised" });
    const [p] = await db.select({ name: practitionersTable.name }).from(practitionersTable).where(eq(practitionersTable.id, booking.practitionerId));
    const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, booking.companyId));
    const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, booking.timeSlotId));
    res.json(redactBookingForViewer(req, serializeBooking(booking, {
      practitionerName: p?.name,
      companyName: c?.name,
      startTime: slot?.startTime?.toISOString(),
      endTime: slot?.endTime?.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: "Failed to get booking" });
  }
});

router.patch("/bookings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body;
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });
    const [existingBooking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
    if (!existingBooking) return res.status(404).json({ error: "Not found" });
    if (!(await canAccessBooking(req, existingBooking))) return res.status(403).json({ error: "Not authorised" });
    if (status !== undefined && !["pending", "confirmed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    // Employees can only cancel their own booking; they can't change anything else.
    if (isEmployee(req) && (status !== "cancelled" || notes !== undefined)) {
      return res.status(403).json({ error: "You can only cancel your own booking" });
    }
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    const [booking] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, id)).returning();
    if (!booking) return res.status(404).json({ error: "Not found" });

    // A cancelled booking frees its time slot again.
    if (status === "cancelled" && existingBooking.status !== "cancelled") {
      await db.update(timeSlotsTable).set({ isBooked: false }).where(eq(timeSlotsTable.id, booking.timeSlotId));
    }

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
    res.json(redactBookingForViewer(req, serializeBooking(booking, {
      practitionerName: p?.name,
      companyName: c?.name,
      startTime: slot?.startTime?.toISOString(),
      endTime: slot?.endTime?.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: "Failed to update booking" });
  }
});



// Readable location for a booking, used in emails and calendar events.
function describeBookingLocation(b: {
  sessionMode: string | null;
  locationType: string | null;
  locationDescription: string | null;
}): string | null {
  if (b.sessionMode === "online") return "Online";
  if (b.locationType === "practitioner_space") {
    return b.locationDescription
      ? `At the practitioner's space — ${b.locationDescription}`
      : "At the practitioner's space";
  }
  if (b.locationType === "at_office") return "At the company's office";
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Tells whoever made the booking that it's confirmed, when, and where. This is also how
// the address of a practitioner's own space reaches the person who booked it. Never throws:
// a failed email must not undo an acceptance that has already taken the payment.
async function notifyEmployeeOfConfirmation(
  booking: {
    id: number;
    employeeName: string;
    employeeEmail: string;
    sessionType: string | null;
    sessionMode: string | null;
    locationType: string | null;
    locationDescription: string | null;
  },
  details: { practitionerName: string | null; startTime: Date | null },
) {
  try {
    const { sendEmail } = await import("../lib/email");
    const when = details.startTime
      ? details.startTime.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/London" })
      : null;
    const location = describeBookingLocation(booking);
    await sendEmail(
      booking.employeeEmail,
      "Your session is confirmed",
      `<p>Hi ${escapeHtml(booking.employeeName)},</p>
<p>${escapeHtml(details.practitionerName ?? "Your practitioner")} has confirmed your "${escapeHtml(booking.sessionType ?? "session")}" booking.</p>
${when ? `<p><strong>When:</strong> ${escapeHtml(when)}</p>` : ""}
${location ? `<p><strong>Where:</strong> ${escapeHtml(location)}</p>` : ""}`,
    );
  } catch (err) {
    logger.error({ err, bookingId: booking.id }, "Failed to send booking confirmation email");
  }
}

// Practitioner: their own pending 1:1 booking requests. Self-funded bookings whose
// employee hasn't completed payment yet have no stripePaymentIntentId, so they don't
// show here — there's nothing for the practitioner to act on until payment is authorized.
router.get("/practitioner/bookings/requests", async (req, res) => {
  try {
    const id = sessionPractitionerId(req);
    if (!id) return res.status(401).json({ error: "Authentication required" });
    const rows = await db
      .select()
      .from(bookingsTable)
      .where(and(eq(bookingsTable.practitionerId, id), eq(bookingsTable.status, "pending")));
    const withDetails = await Promise.all(
      rows
        .filter((b) => b.stripePaymentIntentId)
        .map(async (b) => {
          const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, b.timeSlotId));
          const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, b.companyId));
          return stripInternalBookingFields(req, serializeBooking(b, {
            companyName: c?.name,
            startTime: slot?.startTime?.toISOString(),
            endTime: slot?.endTime?.toISOString(),
          }));
        }),
    );
    res.json(withDetails);
  } catch (err) {
    logger.error({ err }, "Failed to list booking requests");
    res.status(500).json({ error: "Failed to list requests" });
  }
});

// Practitioner accepts a pending 1:1 booking: captures the held payment, creates the
// calendar event, and only now counts towards gamification points and the company's
// booking counter — none of that happened at request time.
router.post("/practitioner/bookings/:id/accept", async (req, res) => {
  try {
    const practId = sessionPractitionerId(req);
    if (!practId) return res.status(401).json({ error: "Authentication required" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const [existing] = await db
      .select()
      .from(bookingsTable)
      .where(and(eq(bookingsTable.id, id), eq(bookingsTable.practitionerId, practId), eq(bookingsTable.status, "pending")));
    if (!existing) {
      return res.status(404).json({ error: "This request is no longer available to accept" });
    }
    const [lapseCheck] = await db
      .select({ insuranceExpiresOn: practitionersTable.insuranceExpiresOn })
      .from(practitionersTable)
      .where(eq(practitionersTable.id, practId));
    if (lapseCheck && isInsuranceExpired(lapseCheck.insuranceExpiresOn)) {
      return res.status(409).json({
        error: "Your insurance has expired. Add your new certificate and expiry date in your portal before accepting sessions.",
      });
    }
    if (existing.stripePaymentIntentId) {
      try {
        const stripe = await getUncachableStripeClient();
        const captured = await stripe.paymentIntents.capture(existing.stripePaymentIntentId);
        if (captured.status !== "succeeded") {
          return res.status(402).json({ error: "Payment could not be captured. Please contact Soulful support." });
        }
      } catch (err) {
        logger.error({ err, bookingId: id }, "Failed to capture payment for accepted booking");
        return res.status(402).json({ error: "Payment could not be captured. Please contact Soulful support." });
      }
    }

    const payoutStatus = existing.payoutStatus === "auto_pending" ? "auto_paid" : existing.payoutStatus;
    const [booking] = await db
      .update(bookingsTable)
      .set({ status: "confirmed", decideBy: null, payoutStatus })
      .where(and(eq(bookingsTable.id, id), eq(bookingsTable.practitionerId, practId), eq(bookingsTable.status, "pending")))
      .returning();
    if (!booking) {
      return res.status(404).json({ error: "This request is no longer available to accept" });
    }

    if (existing.paymentType === "corporate") {
      const prevTb = (await db.select({ tb: companiesTable.totalBookings }).from(companiesTable).where(eq(companiesTable.id, existing.companyId)))[0]?.tb ?? 0;
      await db.update(companiesTable).set({ totalBookings: prevTb + 1 }).where(eq(companiesTable.id, existing.companyId));
    }

    const [pr] = await db
      .select({ name: practitionersTable.name, specialism: practitionersTable.specialism, googleRefreshToken: practitionersTable.googleRefreshToken })
      .from(practitionersTable)
      .where(eq(practitionersTable.id, practId));
    const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, booking.companyId));
    const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, booking.timeSlotId));

    const locationLine = describeBookingLocation(booking);

    if (pr?.googleRefreshToken && slot) {
      try {
        const modeSuffixForEvent = booking.sessionMode ? ` (${booking.sessionMode === "online" ? "online" : "in person"})` : "";
        const eventId = await createEvent(pr.googleRefreshToken, {
          summary: `Soulful session — ${booking.employeeName}`,
          description: `${booking.sessionType ?? "Wellbeing session"}${modeSuffixForEvent} with ${booking.employeeName} (${booking.employeeEmail})${c?.name ? `, ${c.name}` : ""}.${booking.notes ? `\n\nNotes: ${booking.notes}` : ""}${locationLine ? `\n\nLocation: ${locationLine}` : ""}`,
          start: slot.startTime,
          end: slot.endTime,
          attendeeEmail: booking.employeeEmail,
        });
        await db.update(bookingsTable).set({ googleEventId: eventId }).where(eq(bookingsTable.id, booking.id));
        booking.googleEventId = eventId;
      } catch (err) {
        logger.warn({ err, bookingId: booking.id }, "Failed to push accepted booking to Google Calendar");
      }
    }

    if (existing.paymentType === "corporate") {
      awardBookingPoints(booking.companyId, booking.employeeEmail);
    }

    // Tell the person who booked that it's confirmed, when, and where.
    void notifyEmployeeOfConfirmation(booking, {
      practitionerName: pr?.name ?? null,
      startTime: slot?.startTime ?? null,
    });

    res.json(stripInternalBookingFields(req, serializeBooking(booking, {
      practitionerName: pr?.name,
      companyName: c?.name,
      startTime: slot?.startTime?.toISOString(),
      endTime: slot?.endTime?.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "Failed to accept booking");
    res.status(500).json({ error: "Failed to accept" });
  }
});

// Practitioner declines a pending 1:1 booking; a reason is required. The employee who
// booked is told the practitioner is unavailable and to choose another time or practitioner
// — there's no automatic replacement.
router.post("/practitioner/bookings/:id/decline", async (req, res) => {
  try {
    const practId = sessionPractitionerId(req);
    if (!practId) return res.status(401).json({ error: "Authentication required" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) return res.status(400).json({ error: "Please give a reason for declining" });

    const [booking] = await db
      .update(bookingsTable)
      .set({ status: "declined", declineReason: reason.slice(0, 500), decideBy: null })
      .where(and(eq(bookingsTable.id, id), eq(bookingsTable.practitionerId, practId), eq(bookingsTable.status, "pending")))
      .returning();
    if (!booking) {
      return res.status(404).json({ error: "This request is no longer available to decline" });
    }
    await releaseDeclinedBooking(booking);
    await notifyEmployeeOfDecline(booking);
    res.json(stripInternalBookingFields(req, booking));
  } catch (err) {
    logger.error({ err }, "Failed to decline booking");
    res.status(500).json({ error: "Failed to decline" });
  }
});

// Releases the held time slot and cancels the still-authorized payment for a booking
// that was declined or has just expired. Never throws: a failure here shouldn't stop
// the employee from being told the practitioner is unavailable.
async function releaseDeclinedBooking(booking: {
  id: number;
  timeSlotId: number;
  stripePaymentIntentId?: string | null;
}) {
  try {
    await db.update(timeSlotsTable).set({ isBooked: false }).where(eq(timeSlotsTable.id, booking.timeSlotId));
    if (booking.stripePaymentIntentId) {
      const stripe = await getUncachableStripeClient();
      await stripe.paymentIntents.cancel(booking.stripePaymentIntentId).catch((err: unknown) => {
        logger.warn({ err, bookingId: booking.id }, "Could not cancel booking payment authorization");
      });
    }
  } catch (err) {
    logger.error({ err, bookingId: booking.id }, "Failed to release a declined booking");
  }
}

// Tells the employee who booked that the practitioner is unavailable, so they know to
// pick another time or practitioner — used both for an active decline and a 24-hour expiry.
async function notifyEmployeeOfDecline(booking: {
  id: number;
  employeeEmail: string;
  sessionType: string | null;
}) {
  try {
    const { sendEmail } = await import("../lib/email");
    await sendEmail(
      booking.employeeEmail,
      "Your practitioner is unavailable",
      `<p>The practitioner for your "${booking.sessionType ?? "session"}" booking is unavailable.</p>
<p>Please choose another time or practitioner to rebook.</p>`,
    );
  } catch (err) {
    logger.error({ err, bookingId: booking.id }, "Failed to notify employee of a declined booking");
  }
}

// Called on a timer from index.ts. Any pending 1:1 booking whose 24-hour window has
// passed with no response is treated as a decline, and the employee is told the same way.
export async function expireOverdueBookingRequests(): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.status, "pending"));
    const overdue = rows.filter((b) => b.decideBy && b.decideBy.getTime() < Date.now());
    for (const booking of overdue) {
      const [updated] = await db
        .update(bookingsTable)
        .set({ status: "declined", declineReason: "No response within 24 hours", decideBy: null })
        .where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "pending")))
        .returning();
      if (!updated) continue;
      await releaseDeclinedBooking(updated);
      await notifyEmployeeOfDecline(updated);
    }
  } catch (err) {
    logger.error({ err }, "Failed to expire overdue booking requests");
  }
}

export default router;
