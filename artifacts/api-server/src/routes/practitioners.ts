import { Router } from "express";
import { db } from "@workspace/db";
import { practitionersTable, specialismsTable } from "@workspace/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { isAdmin } from "../lib/roles";
import { hashPassword } from "./practitionerAuth";

type PractitionerRow = typeof practitionersTable.$inferSelect;

/**
 * Shape a practitioner DB row into a safe public DTO. Never spread the raw row
 * into responses: it carries secrets (passwordHash, googleRefreshToken, etc.)
 * that must not be exposed on public or admin practitioner endpoints.
 */
export function serializePractitioner(p: PractitionerRow) {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    specialism: p.specialism,
    bio: p.bio,
    sessionRateGbp: Number(p.sessionRateGbp),
    inPersonRateGbp: p.inPersonRateGbp != null ? Number(p.inPersonRateGbp) : null,
    onlineRateGbp: p.onlineRateGbp != null ? Number(p.onlineRateGbp) : null,
    isActive: p.isActive,
    approvalStatus: p.approvalStatus,
    subscriptionStatus: p.subscriptionStatus,
    avatarUrl: p.avatarUrl,
    location: p.location,
    qualifications: p.qualifications,
    averageRating: p.averageRating != null ? Number(p.averageRating) : null,
    totalReviews: p.totalReviews,
    createdAt: p.createdAt.toISOString(),
  };
}

const router = Router();

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
    res.json(practitioners.map(serializePractitioner));
  } catch (err) {
    res.status(500).json({ error: "Failed to list practitioners" });
  }
});

router.post("/practitioners", async (req, res) => {
  try {
    const { name, email, specialism, bio, sessionRateGbp, inPersonRateGbp, onlineRateGbp, location, qualifications, avatarUrl, password } = req.body;
    let passwordHash: string | undefined;
    if (password !== undefined && password !== null && password !== "") {
      if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      passwordHash = hashPassword(password);
    }
    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : email;
    // At least one of in-person / online rate must be set; the base
    // sessionRateGbp is always derived from them so the three never drift.
    const inPerson = inPersonRateGbp != null && Number.isFinite(Number(inPersonRateGbp)) && Number(inPersonRateGbp) > 0 ? Number(inPersonRateGbp) : null;
    const online = onlineRateGbp != null && Number.isFinite(Number(onlineRateGbp)) && Number(onlineRateGbp) > 0 ? Number(onlineRateGbp) : null;
    const baseRate = inPerson ?? online ?? (Number.isFinite(Number(sessionRateGbp)) && Number(sessionRateGbp) > 0 ? Number(sessionRateGbp) : null);
    if (baseRate == null) {
      return res.status(400).json({ error: "At least one of in-person or online rate is required" });
    }
    // Admin-created practitioners go live immediately; public self-registrations
    // are held as pending applications (hidden) until an admin approves them and
    // arranges an onboarding call.
    const adminCreating = isAdmin(req);
    const [p] = await db
      .insert(practitionersTable)
      .values({
        name,
        email: normalizedEmail,
        specialism,
        bio,
        sessionRateGbp: String(baseRate),
        inPersonRateGbp: inPerson != null ? String(inPerson) : null,
        onlineRateGbp: online != null ? String(online) : null,
        location,
        qualifications,
        avatarUrl,
        passwordHash,
        approvalStatus: adminCreating ? "approved" : "pending",
        isActive: adminCreating,
      })
      .returning();
    res.status(201).json(serializePractitioner(p));
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
      inPersonRateGbp: string | null;
      onlineRateGbp: string | null;
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
        inPersonRateGbp?: unknown;
        onlineRateGbp?: unknown;
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
      const inPersonRate = Number(r.inPersonRateGbp);
      const onlineRate = Number(r.onlineRateGbp);
      const inPerson = Number.isFinite(inPersonRate) && inPersonRate > 0 ? inPersonRate : null;
      const online = Number.isFinite(onlineRate) && onlineRate > 0 ? onlineRate : null;
      // Base rate is derived from the mode rates, falling back to an explicit
      // sessionRateGbp column for back-compat with older CSVs.
      const baseRate = inPerson ?? online ?? (Number.isFinite(rate) && rate > 0 ? rate : null);

      if (!name || !email || !specialism) {
        return invalid.push({ row: i + 1, reason: "missing name, email or specialism" });
      }
      if (!emailRe.test(email)) return invalid.push({ row: i + 1, reason: "invalid email" });
      if (baseRate == null) {
        return invalid.push({ row: i + 1, reason: "at least one of in-person or online rate is required" });
      }
      const key = email.toLowerCase();
      if (seen.has(key)) return; // skip duplicate (existing or earlier in batch)
      seen.add(key);

      toInsert.push({
        name,
        email,
        specialism,
        bio,
        sessionRateGbp: String(baseRate),
        inPersonRateGbp: inPerson != null ? String(inPerson) : null,
        onlineRateGbp: online != null ? String(online) : null,
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

    // Bulk import is admin-only (gated above), so imported practitioners are
    // trusted and go straight to approved.
    const created = toInsert.length > 0
      ? await db.insert(practitionersTable).values(toInsert.map((r) => ({ ...r, approvalStatus: "approved" as const }))).returning()
      : [];
    return res.status(201).json({
      created: created.length,
      skipped: rows.length - created.length - invalid.length,
      invalid,
      practitioners: created.map(serializePractitioner),
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
    res.json(serializePractitioner(p));
  } catch (err) {
    res.status(500).json({ error: "Failed to get practitioner" });
  }
});

router.patch("/practitioners/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
    const id = Number(req.params.id);
    const { name, bio, specialism, inPersonRateGbp, onlineRateGbp, location, qualifications, avatarUrl, isActive, approvalStatus } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (specialism !== undefined) updates.specialism = specialism;
    if (location !== undefined) updates.location = location;
    if (qualifications !== undefined) updates.qualifications = qualifications;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    // Invariant: a practitioner is only ever live (isActive) when approved. The
    // public directory, profile lookup and login gate on isActive, so we must
    // never leave a live-but-unapproved profile. Activating implies approval;
    // pending/rejected always force inactive.
    if (approvalStatus !== undefined) {
      if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid approvalStatus" });
      }
      if (approvalStatus !== "approved" && isActive === true) {
        return res
          .status(400)
          .json({ error: "Cannot activate a practitioner that hasn't been approved" });
      }
      updates.approvalStatus = approvalStatus;
      updates.isActive = approvalStatus === "approved" ? (isActive === undefined ? true : isActive) : false;
    } else if (isActive !== undefined) {
      if (isActive === true) updates.approvalStatus = "approved";
      updates.isActive = isActive;
    }

    // If either mode rate is being changed, recompute the derived base rate from
    // the merged (new ?? existing) values so the three rates never drift, and
    // reject clearing both.
    if (inPersonRateGbp !== undefined || onlineRateGbp !== undefined) {
      const [current] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
      if (!current) return res.status(404).json({ error: "Not found" });
      const toRate = (v: unknown, fallback: number | null): number | null => {
        if (v === undefined) return fallback;
        if (v === null) return null;
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const inPerson = toRate(inPersonRateGbp, current.inPersonRateGbp != null ? Number(current.inPersonRateGbp) : null);
      const online = toRate(onlineRateGbp, current.onlineRateGbp != null ? Number(current.onlineRateGbp) : null);
      const baseRate = inPerson ?? online;
      if (baseRate == null) {
        return res.status(400).json({ error: "At least one of in-person or online rate is required" });
      }
      updates.inPersonRateGbp = inPerson != null ? String(inPerson) : null;
      updates.onlineRateGbp = online != null ? String(online) : null;
      updates.sessionRateGbp = String(baseRate);
    }

    const [p] = await db.update(practitionersTable).set(updates).where(eq(practitionersTable.id, id)).returning();
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(serializePractitioner(p));
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
