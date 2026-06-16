import { Router } from "express";
import { db } from "@workspace/db";
import { specialismsTable } from "@workspace/db";
import { asc, eq, ilike } from "drizzle-orm";
import { isAdmin } from "../lib/roles";

const router = Router();


router.get("/specialisms", async (_req, res) => {
  try {
    const rows = await db
      .select({ id: specialismsTable.id, name: specialismsTable.name, sortOrder: specialismsTable.sortOrder })
      .from(specialismsTable)
      .orderBy(asc(specialismsTable.sortOrder), asc(specialismsTable.name));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to list specialisms" });
  }
});

router.post("/specialisms", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "Name is required" });

    const sortOrder = Number.isFinite(req.body?.sortOrder) ? Number(req.body.sortOrder) : 0;

    const existing = await db.select({ id: specialismsTable.id }).from(specialismsTable).where(ilike(specialismsTable.name, name));
    if (existing.length > 0) return res.status(409).json({ error: "Specialism already exists" });

    const [row] = await db.insert(specialismsTable).values({ name, sortOrder }).returning();
    res.status(201).json({ id: row.id, name: row.name, sortOrder: row.sortOrder });
  } catch {
    res.status(500).json({ error: "Failed to create specialism" });
  }
});

router.put("/specialisms/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const updates: Record<string, unknown> = {};
    if (typeof req.body?.name === "string") {
      const name = req.body.name.trim();
      if (!name) return res.status(400).json({ error: "Name cannot be empty" });
      const clash = await db.select({ id: specialismsTable.id }).from(specialismsTable).where(ilike(specialismsTable.name, name));
      if (clash.some((c) => c.id !== id)) return res.status(409).json({ error: "Specialism already exists" });
      updates.name = name;
    }
    if (Number.isFinite(req.body?.sortOrder)) updates.sortOrder = Number(req.body.sortOrder);

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update" });

    const [row] = await db.update(specialismsTable).set(updates).where(eq(specialismsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Specialism not found" });
    res.json({ id: row.id, name: row.name, sortOrder: row.sortOrder });
  } catch {
    res.status(500).json({ error: "Failed to update specialism" });
  }
});

router.delete("/specialisms/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [row] = await db.delete(specialismsTable).where(eq(specialismsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Specialism not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete specialism" });
  }
});

export default router;
