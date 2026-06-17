import { Router } from "express";
import { db } from "@workspace/db";
import {
  subscriptionPlansTable,
  companySubscriptionsTable,
  practitionerSubscriptionsTable,
  companiesTable,
  practitionersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "../lib/roles";

const router = Router();

router.get("/subscriptions", async (_req, res) => {
  try {
    const plans = await db.select().from(subscriptionPlansTable);
    res.json(plans.map((p) => ({ ...p, priceGbp: Number(p.priceGbp) })));
  } catch {
    res.status(500).json({ error: "Failed to list plans" });
  }
});

// Public: record a FREE-plan subscription during self-serve sign-up. Only accepts
// plans with no price / no Stripe link — paid plans must go through checkout.
router.post("/subscriptions/start-free", async (req, res) => {
  try {
    // Must be signed in: the caller has to own the entity they're subscribing.
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
    const userId = req.user.id as string;

    const { companyId, practitionerId, planId } = req.body ?? {};
    const pid = Number(planId);
    if (!pid || Number.isNaN(pid)) return res.status(400).json({ error: "planId is required" });

    const hasCompany = companyId !== undefined && companyId !== null && companyId !== "";
    const hasPractitioner =
      practitionerId !== undefined && practitionerId !== null && practitionerId !== "";
    if (hasCompany === hasPractitioner) {
      return res
        .status(400)
        .json({ error: "Provide exactly one of companyId or practitionerId" });
    }

    // Ownership: a practitioner session may only subscribe its own profile; an HR
    // session may only subscribe its own company. Anything else is forbidden.
    if (hasPractitioner && userId !== `pract:${Number(practitionerId)}`) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (hasCompany) {
      if (!userId.startsWith("hr:")) return res.status(403).json({ error: "Forbidden" });
      const hrId = Number(userId.slice(3));
      const owns = await db.execute(
        sql`SELECT 1 FROM hr_users WHERE id = ${hrId} AND company_id = ${Number(companyId)} AND is_active = true`,
      );
      if (owns.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, pid))
      .limit(1);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    if (plan.stripePriceId || Number(plan.priceGbp) > 0) {
      return res.status(400).json({ error: "This plan is not free" });
    }
    const expectedType = hasCompany ? "corporate" : "practitioner";
    if (plan.planType !== expectedType) {
      return res
        .status(400)
        .json({ error: `Plan is a ${plan.planType} plan and cannot be used here` });
    }

    if (hasCompany) {
      const cId = Number(companyId);
      const [company] = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, cId))
        .limit(1);
      if (!company) return res.status(404).json({ error: "Company not found" });
      await db
        .insert(companySubscriptionsTable)
        .values({ companyId: cId, planId: pid, status: "active" });
    } else {
      const prId = Number(practitionerId);
      const [practitioner] = await db
        .select()
        .from(practitionersTable)
        .where(eq(practitionersTable.id, prId))
        .limit(1);
      if (!practitioner) return res.status(404).json({ error: "Practitioner not found" });
      await db
        .insert(practitionerSubscriptionsTable)
        .values({ practitionerId: prId, planId: pid, status: "active" });
    }

    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to start free subscription" });
  }
});

router.put("/subscriptions/:id", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
    if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid plan id" });

    const { name, priceGbp, description, features } = req.body;
    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name;
    if (priceGbp !== undefined && priceGbp !== null && priceGbp !== "")
      updates.priceGbp = String(priceGbp);
    if (typeof description === "string") updates.description = description;
    if (Array.isArray(features))
      updates.features = features.map((f) => String(f)).filter((f) => f.trim() !== "");

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: "No valid fields to update" });

    const [plan] = await db
      .update(subscriptionPlansTable)
      .set(updates)
      .where(eq(subscriptionPlansTable.id, id))
      .returning();

    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json({ ...plan, priceGbp: Number(plan.priceGbp) });
  } catch {
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.get("/subscriptions/company", async (_req, res) => {
  try {
    const subs = await db.select().from(companySubscriptionsTable);
    const companies = await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable);
    const plans = await db.select().from(subscriptionPlansTable);
    const compMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
    res.json(
      subs.map((s) => ({
        ...s,
        companyName: compMap[s.companyId] ?? "",
        planName: planMap[s.planId]?.name ?? "",
        priceGbp: Number(planMap[s.planId]?.priceGbp ?? 0),
        startDate: s.startDate.toISOString(),
        endDate: s.endDate?.toISOString() ?? null,
      })),
    );
  } catch {
    res.status(500).json({ error: "Failed to list company subscriptions" });
  }
});

router.post("/subscriptions/company", async (req, res) => {
  try {
    const { companyId, planId } = req.body;
    const [sub] = await db.insert(companySubscriptionsTable).values({ companyId, planId }).returning();
    await db.update(companiesTable).set({ subscriptionStatus: "active" }).where(eq(companiesTable.id, companyId));
    const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, companyId));
    const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, planId));
    res.status(201).json({
      ...sub,
      companyName: c?.name ?? "",
      planName: plan?.name ?? "",
      priceGbp: Number(plan?.priceGbp ?? 0),
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate?.toISOString() ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to create company subscription" });
  }
});

router.get("/subscriptions/practitioner", async (_req, res) => {
  try {
    const subs = await db.select().from(practitionerSubscriptionsTable);
    const practitioners = await db.select({ id: practitionersTable.id, name: practitionersTable.name }).from(practitionersTable);
    const plans = await db.select().from(subscriptionPlansTable);
    const practMap = Object.fromEntries(practitioners.map((p) => [p.id, p.name]));
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
    res.json(
      subs.map((s) => ({
        ...s,
        practitionerName: practMap[s.practitionerId] ?? "",
        planName: planMap[s.planId]?.name ?? "",
        priceGbp: Number(planMap[s.planId]?.priceGbp ?? 0),
        startDate: s.startDate.toISOString(),
        endDate: s.endDate?.toISOString() ?? null,
      })),
    );
  } catch {
    res.status(500).json({ error: "Failed to list practitioner subscriptions" });
  }
});

router.post("/subscriptions/practitioner", async (req, res) => {
  try {
    const { practitionerId, planId } = req.body;
    const [sub] = await db.insert(practitionerSubscriptionsTable).values({ practitionerId, planId }).returning();
    await db.update(practitionersTable).set({ subscriptionStatus: "active" }).where(eq(practitionersTable.id, practitionerId));
    const [p] = await db.select({ name: practitionersTable.name }).from(practitionersTable).where(eq(practitionersTable.id, practitionerId));
    const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, planId));
    res.status(201).json({
      ...sub,
      practitionerName: p?.name ?? "",
      planName: plan?.name ?? "",
      priceGbp: Number(plan?.priceGbp ?? 0),
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate?.toISOString() ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to create practitioner subscription" });
  }
});

export default router;
