import { Router } from "express";
import { db } from "@workspace/db";
import { practitionersTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";

const router = Router();

router.get("/practitioners", async (req, res) => {
  try {
    const { specialism, search } = req.query as { specialism?: string; search?: string };
    let query = db.select().from(practitionersTable).$dynamic();
    if (specialism) {
      query = query.where(eq(practitionersTable.specialism, specialism));
    } else if (search) {
      query = query.where(
        or(
          ilike(practitionersTable.name, `%${search}%`),
          ilike(practitionersTable.specialism, `%${search}%`),
        ),
      );
    }
    const practitioners = await query;
    res.json(
      practitioners.map((p) => ({
        ...p,
        sessionRateGbp: Number(p.sessionRateGbp),
        averageRating: p.averageRating ? Number(p.averageRating) : null,
        createdAt: p.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list practitioners" });
  }
});

router.post("/practitioners", async (req, res) => {
  try {
    const { name, email, specialism, bio, sessionRateGbp, location, qualifications, avatarUrl } = req.body;
    const [p] = await db
      .insert(practitionersTable)
      .values({ name, email, specialism, bio, sessionRateGbp: String(sessionRateGbp), location, qualifications, avatarUrl })
      .returning();
    res.status(201).json({ ...p, sessionRateGbp: Number(p.sessionRateGbp), averageRating: null, createdAt: p.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to create practitioner" });
  }
});

router.get("/practitioners/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json({ ...p, sessionRateGbp: Number(p.sessionRateGbp), averageRating: p.averageRating ? Number(p.averageRating) : null, createdAt: p.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get practitioner" });
  }
});

router.patch("/practitioners/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, bio, specialism, sessionRateGbp, location, qualifications, avatarUrl, isActive } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (specialism !== undefined) updates.specialism = specialism;
    if (sessionRateGbp !== undefined) updates.sessionRateGbp = String(sessionRateGbp);
    if (location !== undefined) updates.location = location;
    if (qualifications !== undefined) updates.qualifications = qualifications;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (isActive !== undefined) updates.isActive = isActive;
    const [p] = await db.update(practitionersTable).set(updates).where(eq(practitionersTable.id, id)).returning();
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json({ ...p, sessionRateGbp: Number(p.sessionRateGbp), averageRating: p.averageRating ? Number(p.averageRating) : null, createdAt: p.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update practitioner" });
  }
});

router.get("/practitioners/:id/reviews", async (req, res) => {
  try {
    const { reviewsTable } = await import("@workspace/db");
    const id = Number(req.params.id);
    const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.practitionerId, id));
    res.json(reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: "Failed to get reviews" });
  }
});

export default router;
