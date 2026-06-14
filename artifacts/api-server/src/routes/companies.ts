import { Router } from "express";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/companies", async (_req, res) => {
  try {
    const companies = await db.select().from(companiesTable);
    res.json(companies.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to list companies" });
  }
});

router.post("/companies", async (req, res) => {
  try {
    const { name, email, industry, employeeCount, contactName, logoUrl } = req.body;
    if (!name || !email || !industry) {
      return res.status(400).json({ error: "name, email and industry are required" });
    }
    const count = Number(employeeCount);
    if (!Number.isInteger(count) || count < 1) {
      return res.status(400).json({ error: "employeeCount must be a positive whole number" });
    }
    const [c] = await db.insert(companiesTable).values({ name, email, industry, employeeCount: count, contactName, logoUrl }).returning();
    res.status(201).json({ ...c, createdAt: c.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create company" });
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [c] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json({ ...c, createdAt: c.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to get company" });
  }
});

router.patch("/companies/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, industry, employeeCount, contactName, logoUrl } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (industry !== undefined) updates.industry = industry;
    if (employeeCount !== undefined) updates.employeeCount = employeeCount;
    if (contactName !== undefined) updates.contactName = contactName;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    const [c] = await db.update(companiesTable).set(updates).where(eq(companiesTable.id, id)).returning();
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json({ ...c, createdAt: c.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update company" });
  }
});

export default router;
