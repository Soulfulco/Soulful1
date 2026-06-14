import { Router } from "express";
import { db } from "@workspace/db";
import { practitionersTable, specialismsTable } from "@workspace/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";

const router = Router();

function isAdmin(req: Express.Request): boolean {
  return req.isAuthenticated() && !req.user.id.startsWith("hr:");
}

router.get("/practitioners", async (req, res) => {
  try {
    const { specialism, search } = req.query as { specialism?: string; search?: string };
    // Non-admin (public) callers only ever see active practitioners; admins see all
    // so they can manage hidden ones from the dashboard.
    const activeOnly = !isAdmin(req);
    let query = db.select().from(practitionersTable).$dynamic();
    const filters = [];
    if (activeOnly) filters.push(eq(practitionersTable.isActive, true));
    if (specialism) {
      filters.push(eq(practitionersTable.specialism, specialism));
    } else if (search) {
      filters.push(
        or(
          ilike(practitionersTable.name, `%${search}%`),
          ilike(practitionersTable.specialism, `%${search}%`),
        ),
      );
    }
    if (filters.length > 0) query = query.where(and(...filters));
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

router.get("/practitioners/showcase", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: practitionersTable.id,
        name: practitionersTable.name,
        specialism: practitionersTable.specialism,
        avatarUrl: practitionersTable.avatarUrl,
      })
      .from(practitionersTable)
      .where(eq(practitionersTable.isActive, true));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to list practitioner showcase" });
  }
});

router.post("/practitioners/bulk", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });

    const rows = Array.isArray(req.body?.practitioners) ? req.body.practitioners : null;
    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: "practitioners must be a non-empty array" });
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const existing = await db.select({ email: practitionersTable.email }).from(practitionersTable);
    const seen = new Set(existing.map((e) => e.email.toLowerCase()));

    const toInsert: {
      name: string;
      email: string;
      specialism: string;
      bio: string;
      sessionRateGbp: string;
      location: string | null;
      qualifications: string | null;
    }[] = [];
    const invalid: { row: number; reason: string }[] = [];

    rows.forEach((raw: unknown, i: number) => {
      const r = raw as {
        name?: unknown;
        email?: unknown;
        specialism?: unknown;
        bio?: unknown;
        sessionRateGbp?: unknown;
        location?: unknown;
        qualifications?: unknown;
      };
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const email = typeof r.email === "string" ? r.email.trim() : "";
      const specialism = typeof r.specialism === "string" ? r.specialism.trim() : "";
      const bio = typeof r.bio === "string" ? r.bio.trim() : "";
      const location = typeof r.location === "string" && r.location.trim() ? r.location.trim() : null;
      const qualifications = typeof r.qualifications === "string" && r.qualifications.trim() ? r.qualifications.trim() : null;
      const rate = Number(r.sessionRateGbp);

      if (!name || !email || !specialism) {
        return invalid.push({ row: i + 1, reason: "missing name, email or specialism" });
      }
      if (!emailRe.test(email)) return invalid.push({ row: i + 1, reason: "invalid email" });
      if (!Number.isFinite(rate) || rate <= 0) {
        return invalid.push({ row: i + 1, reason: "invalid session rate" });
      }
      const key = email.toLowerCase();
      if (seen.has(key)) return; // skip duplicate (existing or earlier in batch)
      seen.add(key);

      toInsert.push({
        name,
        email,
        specialism,
        bio,
        sessionRateGbp: String(rate),
        location,
        qualifications,
      });
    });

    if (toInsert.length > 0) {
      const existingSpecs = await db.select({ name: specialismsTable.name }).from(specialismsTable);
      const knownSpecs = new Set(existingSpecs.map((s) => s.name.toLowerCase()));
      const newSpecs = new Map<string, string>();
      for (const row of toInsert) {
        const key = row.specialism.toLowerCase();
        if (!knownSpecs.has(key) && !newSpecs.has(key)) newSpecs.set(key, row.specialism);
      }
      if (newSpecs.size > 0) {
        await db
          .insert(specialismsTable)
          .values([...newSpecs.values()].map((name) => ({ name })))
          .onConflictDoNothing();
      }
    }

    const created = toInsert.length > 0 ? await db.insert(practitionersTable).values(toInsert).returning() : [];
    return res.status(201).json({
      created: created.length,
      skipped: rows.length - created.length - invalid.length,
      invalid,
      practitioners: created.map((p) => ({
        ...p,
        sessionRateGbp: Number(p.sessionRateGbp),
        averageRating: null,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch {
    return res.status(500).json({ error: "Failed to import practitioners" });
  }
});

router.get("/practitioners/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [p] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
    // Hidden practitioners are only viewable by admins, not via direct ID lookup.
    if (!p || (!p.isActive && !isAdmin(req))) return res.status(404).json({ error: "Not found" });
    res.json({ ...p, sessionRateGbp: Number(p.sessionRateGbp), averageRating: p.averageRating ? Number(p.averageRating) : null, createdAt: p.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get practitioner" });
  }
});

router.patch("/practitioners/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
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
