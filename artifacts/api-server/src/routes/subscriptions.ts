import { Router } from "express";
import { db } from "@workspace/db";
import {
  subscriptionPlansTable,
  companySubscriptionsTable,
  practitionerSubscriptionsTable,
  companiesTable,
  practitionersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/subscriptions", async (_req, res) => {
  try {
    const plans = await db.select().from(subscriptionPlansTable);
    res.json(plans.map((p) => ({ ...p, priceGbp: Number(p.priceGbp) })));
  } catch {
    res.status(500).json({ error: "Failed to list plans" });
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
