import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "../lib/roles";

const router = Router();

async function getHrCompanyId(req: Request): Promise<number | null> {
  if (!req.isAuthenticated()) return null;
  const uid = req.user?.id ?? "";
  if (!uid.startsWith("hr:")) return null;
  const hrId = parseInt(uid.slice(3));
  if (Number.isNaN(hrId)) return null;
  const result = await db.execute(
    sql`SELECT company_id FROM hr_users WHERE id = ${hrId} AND is_active = true`,
  );
  const row = result.rows[0] as { company_id?: number } | undefined;
  return row?.company_id ?? null;
}

router.get("/companies", async (req, res) => {
  try {
    if (isAdmin(req)) {
      const companies = await db.select().from(companiesTable);
      return res.json(companies.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
    }
    const companyId = await getHrCompanyId(req);
    if (companyId !== null) {
      const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
      return res.json(companies.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
    }
    return res.status(403).json({ error: "Forbidden" });
  } catch {
    res.status(500).json({ error: "Failed to list companies" });
  }
});

router.post("/companies", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
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

router.get("/companies/showcase", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        logoUrl: companiesTable.logoUrl,
      })
      .from(companiesTable);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to list company showcase" });
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!isAdmin(req)) {
      const hrCompanyId = await getHrCompanyId(req);
      if (hrCompanyId !== id) return res.status(403).json({ error: "Forbidden" });
    }
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
    if (!isAdmin(req)) {
      const hrCompanyId = await getHrCompanyId(req);
      if (hrCompanyId !== id) return res.status(403).json({ error: "Forbidden" });
    }
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
