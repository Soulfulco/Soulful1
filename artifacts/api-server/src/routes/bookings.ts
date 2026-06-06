import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, practitionersTable, companiesTable, timeSlotsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

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

router.post("/bookings", async (req, res) => {
  try {
    const { companyId, practitionerId, timeSlotId, sessionType, employeeName, employeeEmail, notes } = req.body;
    const [booking] = await db
      .insert(bookingsTable)
      .values({ companyId, practitionerId, timeSlotId, sessionType, employeeName, employeeEmail, notes })
      .returning();

    await db.update(timeSlotsTable).set({ isBooked: true }).where(eq(timeSlotsTable.id, timeSlotId));
    await db.update(companiesTable).set({ totalBookings: (await db.select({ tb: companiesTable.totalBookings }).from(companiesTable).where(eq(companiesTable.id, companyId)))[0]?.tb + 1 || 1 }).where(eq(companiesTable.id, companyId));

    const [p] = await db.select({ name: practitionersTable.name }).from(practitionersTable).where(eq(practitionersTable.id, practitionerId));
    const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, companyId));
    const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, timeSlotId));

    res.status(201).json({
      ...booking,
      practitionerName: p?.name ?? null,
      companyName: c?.name ?? null,
      startTime: slot?.startTime?.toISOString() ?? null,
      endTime: slot?.endTime?.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch {
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
    res.json({
      ...booking,
      practitionerName: p?.name ?? null,
      companyName: c?.name ?? null,
      startTime: slot?.startTime?.toISOString() ?? null,
      endTime: slot?.endTime?.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
    });
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
    const [p] = await db.select({ name: practitionersTable.name }).from(practitionersTable).where(eq(practitionersTable.id, booking.practitionerId));
    const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, booking.companyId));
    const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, booking.timeSlotId));
    res.json({
      ...booking,
      practitionerName: p?.name ?? null,
      companyName: c?.name ?? null,
      startTime: slot?.startTime?.toISOString() ?? null,
      endTime: slot?.endTime?.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to update booking" });
  }
});

export default router;
