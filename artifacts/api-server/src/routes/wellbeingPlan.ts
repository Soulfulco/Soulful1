import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { wellbeingActionPlansTable, employeesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  REQUIREMENTS,
  getComplianceForEmployee,
  getComplianceForCompany,
  logRequirement,
  wellbeingRequirementKeys,
} from "../lib/wellbeingRequirements";
import type { WellbeingRequirementKey } from "@workspace/db";
import { isTrialLocked, TRIAL_LOCKED_MESSAGE } from "../lib/trialGate";

const router: IRouter = Router();

// GET /wellbeing/requirements — static metadata for the base engagement metrics.
router.get("/wellbeing/requirements", (_req, res) => {
  res.json(REQUIREMENTS);
});

// GET /wellbeing/action-plan/:companyId — fetch the current agreed action plan for a company.
router.get("/wellbeing/action-plan/:companyId", async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    if (await isTrialLocked(companyId)) {
      return res.status(402).json({ error: TRIAL_LOCKED_MESSAGE, locked: true });
    }
    const [plan] = await db
      .select()
      .from(wellbeingActionPlansTable)
      .where(eq(wellbeingActionPlansTable.companyId, companyId))
      .orderBy(desc(wellbeingActionPlansTable.uploadedAt))
      .limit(1);
    res.json(plan ?? null);
  } catch (err) {
    logger.error({ err }, "Failed to fetch wellbeing action plan");
    res.status(500).json({ error: "Failed to fetch wellbeing action plan" });
  }
});

// POST /wellbeing/action-plan — HR uploads (or replaces) the agreed action plan document.
router.post("/wellbeing/action-plan", async (req, res) => {
  try {
    const { companyId, fileUrl, fileName, uploadedBy } = req.body;
    if (!companyId || !fileUrl || !fileName) {
      return res.status(400).json({ error: "companyId, fileUrl and fileName are required" });
    }
    if (await isTrialLocked(Number(companyId))) {
      return res.status(402).json({ error: TRIAL_LOCKED_MESSAGE, locked: true });
    }
    const [plan] = await db
      .insert(wellbeingActionPlansTable)
      .values({ companyId, fileUrl, fileName, uploadedBy: uploadedBy ?? null })
      .returning();
    res.status(201).json(plan);
  } catch (err) {
    logger.error({ err }, "Failed to save wellbeing action plan");
    res.status(500).json({ error: "Failed to save wellbeing action plan" });
  }
});

// GET /employees/:id/wellbeing-requirements — compliance summary for one employee (used on employee dashboard).
router.get("/employees/:id/wellbeing-requirements", async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    if (!employeeId) return res.status(400).json({ error: "Invalid employee id" });
    const requirements = await getComplianceForEmployee(employeeId);
    res.json({ employeeId, requirements });
  } catch (err) {
    logger.error({ err }, "Failed to load wellbeing requirements");
    res.status(500).json({ error: "Failed to load wellbeing requirements" });
  }
});

// GET /companies/:id/wellbeing-requirements — HR view of every employee's compliance, for manual check-off.
router.get("/companies/:id/wellbeing-requirements", async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    if (!companyId) return res.status(400).json({ error: "Invalid company id" });
    const rows = await getComplianceForCompany(companyId);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to load company wellbeing requirements");
    res.status(500).json({ error: "Failed to load company wellbeing requirements" });
  }
});

// POST /employees/:id/wellbeing-requirements/:key/complete — HR manually marks a requirement as completed
// (e.g. after confirming a volunteering day or check-in took place outside the platform).
router.post("/employees/:id/wellbeing-requirements/:key/complete", async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const key = req.params.key as WellbeingRequirementKey;
    if (!employeeId) return res.status(400).json({ error: "Invalid employee id" });
    if (!wellbeingRequirementKeys.includes(key)) {
      return res.status(400).json({ error: "Invalid requirement key" });
    }
    const { recordedBy, note } = req.body ?? {};
    await logRequirement(employeeId, key, "manual", recordedBy, note);
    const requirements = await getComplianceForEmployee(employeeId);
    res.status(201).json({ employeeId, requirements });
  } catch (err) {
    logger.error({ err }, "Failed to record manual wellbeing requirement completion");
    res.status(500).json({ error: "Failed to record completion" });
  }
});

// POST /wellbeing/mood-checkin — quick weekly self-report from the employee (satisfies the mood_checkin requirement).
router.post("/wellbeing/mood-checkin", async (req, res) => {
  try {
    const { employeeId, mood, note } = req.body ?? {};
    const id = Number(employeeId);
    if (!id) return res.status(400).json({ error: "employeeId is required" });
    const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.id, id)).limit(1);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    await logRequirement(id, "mood_checkin", "auto", undefined, mood ? `Mood: ${mood}${note ? ` — ${note}` : ""}` : note);
    const requirements = await getComplianceForEmployee(id);
    res.status(201).json({ employeeId: id, requirements });
  } catch (err) {
    logger.error({ err }, "Failed to record mood check-in");
    res.status(500).json({ error: "Failed to record mood check-in" });
  }
});

export default router;
