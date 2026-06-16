import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable, eventRegistrationsTable } from "@workspace/db";
import { and, asc, count, desc, eq, gte, ilike, inArray, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { isAdmin } from "../lib/roles";

const router = Router();


function baseUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : "";
}

function serializeEvent(e: typeof eventsTable.$inferSelect, registeredCount = 0) {
  return {
    ...e,
    priceGbp: Number(e.priceGbp),
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
    registeredCount,
    spotsLeft: e.capacity != null ? Math.max(0, e.capacity - registeredCount) : null,
  };
}

// GET /events — public list of upcoming, active events (with optional location/search filters)
router.get("/events", async (req, res) => {
  try {
    const { location, search } = req.query as { location?: string; search?: string };
    const filters = [eq(eventsTable.isActive, true), gte(eventsTable.startsAt, new Date())];
    if (location) filters.push(ilike(eventsTable.city, location));
    if (search) filters.push(ilike(eventsTable.title, `%${search}%`));

    const events = await db
      .select()
      .from(eventsTable)
      .where(and(...filters))
      .orderBy(asc(eventsTable.startsAt));

    const counts = await db
      .select({ eventId: eventRegistrationsTable.eventId, c: count() })
      .from(eventRegistrationsTable)
      .where(inArray(eventRegistrationsTable.status, ["registered", "pending"]))
      .groupBy(eventRegistrationsTable.eventId);
    const countMap = new Map(counts.map((r) => [r.eventId, Number(r.c)]));

    res.json(events.map((e) => serializeEvent(e, countMap.get(e.id) ?? 0)));
  } catch (err) {
    logger.error({ err }, "Failed to list events");
    res.status(500).json({ error: "Failed to list events" });
  }
});

// GET /events/locations — distinct upcoming-event cities for the location filter
router.get("/events/locations", async (_req, res) => {
  try {
    const rows = await db
      .selectDistinct({ city: eventsTable.city })
      .from(eventsTable)
      .where(and(eq(eventsTable.isActive, true), gte(eventsTable.startsAt, new Date())))
      .orderBy(asc(eventsTable.city));
    res.json(rows.map((r) => r.city));
  } catch (err) {
    logger.error({ err }, "Failed to list event locations");
    res.status(500).json({ error: "Failed to list event locations" });
  }
});

// GET /events/registration/confirm?session_id= — confirm a paid registration after Stripe redirect
router.get("/events/registration/confirm", async (req, res) => {
  try {
    const sessionId = String(req.query.session_id ?? "");
    if (!sessionId) return res.status(400).json({ error: "session_id is required" });

    const [reg] = await db
      .select()
      .from(eventRegistrationsTable)
      .where(eq(eventRegistrationsTable.stripeSessionId, sessionId))
      .limit(1);
    if (!reg) return res.status(404).json({ error: "Registration not found" });

    if (reg.status === "registered") return res.json({ status: "registered" });

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      await db
        .update(eventRegistrationsTable)
        .set({ status: "registered" })
        .where(eq(eventRegistrationsTable.id, reg.id));
      return res.json({ status: "registered" });
    }
    res.json({ status: reg.status });
  } catch (err) {
    logger.error({ err }, "Failed to confirm registration");
    res.status(500).json({ error: "Failed to confirm registration" });
  }
});

// GET /events/manage — admin list of ALL events (incl. inactive/past) with seat counts
router.get("/events/manage", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
    const events = await db.select().from(eventsTable).orderBy(desc(eventsTable.startsAt));
    const counts = await db
      .select({ eventId: eventRegistrationsTable.eventId, c: count() })
      .from(eventRegistrationsTable)
      .where(inArray(eventRegistrationsTable.status, ["registered", "pending"]))
      .groupBy(eventRegistrationsTable.eventId);
    const countMap = new Map(counts.map((r) => [r.eventId, Number(r.c)]));
    res.json(events.map((e) => serializeEvent(e, countMap.get(e.id) ?? 0)));
  } catch (err) {
    logger.error({ err }, "Failed to list events for management");
    res.status(500).json({ error: "Failed to list events" });
  }
});

// GET /events/:id — public single event
router.get("/events/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.id, id), eq(eventsTable.isActive, true)));
    if (!event) return res.status(404).json({ error: "Not found" });
    const [{ c } = { c: 0 }] = await db
      .select({ c: count() })
      .from(eventRegistrationsTable)
      .where(and(eq(eventRegistrationsTable.eventId, id), inArray(eventRegistrationsTable.status, ["registered", "pending"])));
    res.json(serializeEvent(event, Number(c)));
  } catch (err) {
    logger.error({ err }, "Failed to get event");
    res.status(500).json({ error: "Failed to get event" });
  }
});

// POST /events/:id/register — public registration. Free events register directly;
// paid events return a Stripe checkout URL and create a pending registration.
router.post("/events/:id/register", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !emailRe.test(email)) {
      return res.status(400).json({ error: "Valid name and email are required" });
    }

    // Everything runs in a transaction with the event row locked so that
    // concurrent registrations can't oversell capacity or create duplicates.
    // A pending (unpaid) registration holds a seat, so capacity counts both
    // registered and pending — this also makes paid confirmation race-free.
    type RegResult =
      | { status: 201; body: { status: "registered" } | { status: "payment_required"; checkoutUrl: string | null } }
      | { status: 400 | 404 | 409; body: { error: string } };

    const result = await db.transaction(async (tx): Promise<RegResult> => {
      const [event] = await tx
        .select()
        .from(eventsTable)
        .where(eq(eventsTable.id, id))
        .for("update");
      if (!event || !event.isActive) return { status: 404, body: { error: "Event not found" } };
      if (event.startsAt.getTime() < Date.now()) {
        return { status: 400, body: { error: "This event has already started" } };
      }

      // Already registered (or pending) with this email?
      const [existing] = await tx
        .select()
        .from(eventRegistrationsTable)
        .where(
          and(
            eq(eventRegistrationsTable.eventId, id),
            ilike(eventRegistrationsTable.email, email),
            inArray(eventRegistrationsTable.status, ["registered", "pending"])
          )
        )
        .limit(1);
      if (existing) {
        return { status: 409, body: { error: "You're already registered for this event" } };
      }

      // Capacity check — count seats held (registered + pending).
      if (event.capacity != null) {
        const [{ c } = { c: 0 }] = await tx
          .select({ c: count() })
          .from(eventRegistrationsTable)
          .where(and(eq(eventRegistrationsTable.eventId, id), inArray(eventRegistrationsTable.status, ["registered", "pending"])));
        if (Number(c) >= event.capacity) {
          return { status: 409, body: { error: "This event is fully booked" } };
        }
      }

      const price = Number(event.priceGbp);

      if (price <= 0) {
        await tx.insert(eventRegistrationsTable).values({ eventId: id, name, email, status: "registered" });
        return { status: 201, body: { status: "registered" } };
      }

      // Paid event — reserve a pending seat, then create a one-off Stripe Checkout
      // session inside the same transaction so a Stripe failure rolls back the seat.
      const [reg] = await tx
        .insert(eventRegistrationsTable)
        .values({ eventId: id, name, email, status: "pending" })
        .returning();

      const stripe = await getUncachableStripeClient();
      const origin = baseUrl();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "gbp",
              unit_amount: Math.round(price * 100),
              product_data: {
                name: event.title,
                description: `${event.venue}, ${event.city}`,
              },
            },
          },
        ],
        metadata: { eventRegistrationId: String(reg.id), eventId: String(id) },
        success_url: `${origin}/events?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/events?checkout=cancelled`,
      });

      await tx
        .update(eventRegistrationsTable)
        .set({ stripeSessionId: session.id })
        .where(eq(eventRegistrationsTable.id, reg.id));

      return { status: 201, body: { status: "payment_required", checkoutUrl: session.url } };
    });

    res.status(result.status).json(result.body);
  } catch (err) {
    // Unique-index violation = concurrent duplicate registration.
    if ((err as { code?: string })?.code === "23505") {
      return res.status(409).json({ error: "You're already registered for this event" });
    }
    logger.error({ err }, "Failed to register for event");
    res.status(500).json({ error: "Failed to register for event" });
  }
});

// ---- Admin endpoints ----

// POST /events — admin create
router.post("/events", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
    const b = req.body ?? {};
    if (!b.title || !b.description || !b.city || !b.venue || !b.startsAt) {
      return res.status(400).json({ error: "title, description, city, venue and startsAt are required" });
    }
    const [event] = await db
      .insert(eventsTable)
      .values({
        title: b.title,
        description: b.description,
        category: b.category || null,
        city: b.city,
        venue: b.venue,
        address: b.address || null,
        startsAt: new Date(b.startsAt),
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
        capacity: b.capacity != null && b.capacity !== "" ? Number(b.capacity) : null,
        priceGbp: String(Number(b.priceGbp) || 0),
        imageUrl: b.imageUrl || null,
        organizer: b.organizer || null,
        isActive: b.isActive ?? true,
      })
      .returning();
    res.status(201).json(serializeEvent(event, 0));
  } catch (err) {
    logger.error({ err }, "Failed to create event");
    res.status(500).json({ error: "Failed to create event" });
  }
});

// PATCH /events/:id — admin update
router.patch("/events/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const b = req.body ?? {};
    const updates: Record<string, unknown> = {};
    if (b.title !== undefined) updates.title = b.title;
    if (b.description !== undefined) updates.description = b.description;
    if (b.category !== undefined) updates.category = b.category || null;
    if (b.city !== undefined) updates.city = b.city;
    if (b.venue !== undefined) updates.venue = b.venue;
    if (b.address !== undefined) updates.address = b.address || null;
    if (b.startsAt !== undefined) updates.startsAt = new Date(b.startsAt);
    if (b.endsAt !== undefined) updates.endsAt = b.endsAt ? new Date(b.endsAt) : null;
    if (b.capacity !== undefined) updates.capacity = b.capacity != null && b.capacity !== "" ? Number(b.capacity) : null;
    if (b.priceGbp !== undefined) updates.priceGbp = String(Number(b.priceGbp) || 0);
    if (b.imageUrl !== undefined) updates.imageUrl = b.imageUrl || null;
    if (b.organizer !== undefined) updates.organizer = b.organizer || null;
    if (b.isActive !== undefined) updates.isActive = b.isActive;

    const [event] = await db.update(eventsTable).set(updates).where(eq(eventsTable.id, id)).returning();
    if (!event) return res.status(404).json({ error: "Not found" });
    res.json(serializeEvent(event, 0));
  } catch (err) {
    logger.error({ err }, "Failed to update event");
    res.status(500).json({ error: "Failed to update event" });
  }
});

// DELETE /events/:id — admin delete
router.delete("/events/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [event] = await db.delete(eventsTable).where(eq(eventsTable.id, id)).returning();
    if (!event) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete event");
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// GET /events/:id/registrations — admin list of registrations for an event
router.get("/events/:id/registrations", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const rows = await db
      .select()
      .from(eventRegistrationsTable)
      .where(eq(eventRegistrationsTable.eventId, id))
      .orderBy(asc(eventRegistrationsTable.createdAt));
    res.json(
      rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
    );
  } catch (err) {
    logger.error({ err }, "Failed to list registrations");
    res.status(500).json({ error: "Failed to list registrations" });
  }
});

export default router;
