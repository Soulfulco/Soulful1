import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// Get all content as a key→value map
router.get("/site-content", async (_req, res) => {
  try {
    const result = await db.execute(sql`SELECT key, value, label, section FROM site_content ORDER BY section, key`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch site content" });
  }
});

// Bulk update content entries
router.put("/site-content", async (req, res) => {
  try {
    const updates: { key: string; value: string }[] = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ error: "Expected array of {key, value}" });

    for (const { key, value } of updates) {
      await db.execute(sql`
        UPDATE site_content SET value = ${value}, updated_at = NOW() WHERE key = ${key}
      `);
    }
    res.json({ ok: true, updated: updates.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update site content" });
  }
});

export default router;
