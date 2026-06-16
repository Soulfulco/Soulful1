import { Router } from "express";
import { db } from "@workspace/db";
import { timeSlotsTable, googleBusyBlocksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/practitioners/:id/availability", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const slots = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.practitionerId, id));
    const busy = await db
      .select()
      .from(googleBusyBlocksTable)
      .where(eq(googleBusyBlocksTable.practitionerId, id));
    // Hide slots that overlap a Google "busy" interval so they can't be booked.
    const overlapsBusy = (start: Date, end: Date) =>
      busy.some((b) => start < b.endTime && end > b.startTime);
    res.json(
      slots
        .filter((s) => s.isBooked || !overlapsBusy(s.startTime, s.endTime))
        .map((s) => ({
          ...s,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime.toISOString(),
        })),
    );
  } catch {
    res.status(500).json({ error: "Failed to get availability" });
  }
});

router.post("/practitioners/:id/availability", async (req, res) => {
  try {
    const practitionerId = Number(req.params.id);
    const { startTime, endTime, sessionType } = req.body;
    const [slot] = await db
      .insert(timeSlotsTable)
      .values({ practitionerId, startTime: new Date(startTime), endTime: new Date(endTime), sessionType })
      .returning();
    res.status(201).json({ ...slot, startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create time slot" });
  }
});

router.delete("/timeslots/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(timeSlotsTable).where(eq(timeSlotsTable.id, id));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete time slot" });
  }
});

export default router;
