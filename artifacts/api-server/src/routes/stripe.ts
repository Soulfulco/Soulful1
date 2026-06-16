import { Router } from "express";
import { db } from "@workspace/db";
import {
  subscriptionPlansTable,
  companiesTable,
  practitionersTable,
  companySubscriptionsTable,
  practitionerSubscriptionsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { isAdmin } from "../lib/roles";

const router = Router();

// Build redirect URLs from the trusted deployment domain — never from the
// request's Origin header (which a caller can forge to create an open redirect).
function baseUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : "";
}

// Only allow app-relative redirect paths (e.g. "/dashboard"); reject absolute
// URLs and protocol-relative paths ("//evil.com").
function safePath(p: unknown, fallback: string): string {
  if (typeof p === "string" && p.startsWith("/") && !p.startsWith("//")) return p;
  return fallback;
}

// HR sessions are scoped to a single company (user id is `hr:{hrUserId}`).
// Resolve the company they're allowed to act on. Returns null for non-HR users.
async function resolveHrCompanyId(userId: string): Promise<number | null> {
  if (!userId.startsWith("hr:")) return null;
  const hrId = Number(userId.slice(3));
  if (!hrId || Number.isNaN(hrId)) return null;
  const result = await db.execute(
    sql`SELECT company_id FROM hr_users WHERE id = ${hrId} AND is_active = true`,
  );
  const row = result.rows[0] as { company_id?: number } | undefined;
  return row?.company_id != null ? Number(row.company_id) : null;
}

// POST /stripe/checkout — start a subscription checkout for a company or practitioner.
// Public: this is part of the corporate/practitioner sign-up flow, before a
// session exists. We validate the entity + plan-type consistency rather than
// trusting auth here. (Worst case for a forged id is paying for someone else's
// listing, which Stripe attributes to the paying customer.)
router.post("/stripe/checkout", async (req, res) => {
  try {
    const { planId, companyId, practitionerId, successPath, cancelPath } = req.body ?? {};

    const pid = Number(planId);
    if (!pid || Number.isNaN(pid)) {
      return res.status(400).json({ error: "planId is required" });
    }

    const hasCompany = companyId !== undefined && companyId !== null && companyId !== "";
    const hasPractitioner =
      practitionerId !== undefined && practitionerId !== null && practitionerId !== "";
    if (hasCompany === hasPractitioner) {
      return res
        .status(400)
        .json({ error: "Provide exactly one of companyId or practitionerId" });
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, pid))
      .limit(1);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    if (!plan.stripePriceId) {
      return res
        .status(400)
        .json({ error: "Plan is not linked to Stripe yet. Run the seed-stripe-products script." });
    }

    // The plan's type must match the entity being subscribed.
    const expectedType = hasCompany ? "corporate" : "practitioner";
    if (plan.planType !== expectedType) {
      return res
        .status(400)
        .json({ error: `Plan ${pid} is a ${plan.planType} plan and cannot be used here` });
    }

    const stripe = await getUncachableStripeClient();
    const origin = baseUrl();

    const metadata: Record<string, string> = { appPlanId: String(pid) };
    let customerId: string | null = null;
    let email: string | null = null;

    if (hasCompany) {
      const cId = Number(companyId);
      const [company] = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, cId))
        .limit(1);
      if (!company) return res.status(404).json({ error: "Company not found" });
      metadata.appCompanyId = String(cId);
      customerId = company.stripeCustomerId;
      email = company.email;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: company.email,
          name: company.name,
          metadata: { appCompanyId: String(cId) },
        });
        customerId = customer.id;
        await db
          .update(companiesTable)
          .set({ stripeCustomerId: customerId })
          .where(eq(companiesTable.id, cId));
      }
    } else {
      const prId = Number(practitionerId);
      const [practitioner] = await db
        .select()
        .from(practitionersTable)
        .where(eq(practitionersTable.id, prId))
        .limit(1);
      if (!practitioner) return res.status(404).json({ error: "Practitioner not found" });
      metadata.appPractitionerId = String(prId);
      customerId = practitioner.stripeCustomerId;
      email = practitioner.email;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: practitioner.email,
          name: practitioner.name,
          metadata: { appPractitionerId: String(prId) },
        });
        customerId = customer.id;
        await db
          .update(practitionersTable)
          .set({ stripeCustomerId: customerId })
          .where(eq(practitionersTable.id, prId));
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId ?? undefined,
      ...(customerId ? {} : email ? { customer_email: email } : {}),
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      subscription_data: { metadata },
      metadata,
      success_url: `${origin}${safePath(successPath, "/dashboard")}?checkout=success`,
      cancel_url: `${origin}${safePath(cancelPath, "/")}?checkout=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Stripe checkout failed");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /stripe/portal — open the Stripe billing portal for a company or practitioner.
// Authenticated: HR users may only manage their own company; Soulful admins
// (Replit-authed, non-`hr:` ids) may manage any account.
router.post("/stripe/portal", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
    const { companyId, practitionerId, returnPath } = req.body ?? {};
    const isHr = req.user.id.startsWith("hr:");
    if (!isHr && !isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    let targetCompanyId = companyId ? Number(companyId) : null;
    let targetPractitionerId = practitionerId ? Number(practitionerId) : null;

    if (isHr) {
      const ownCompanyId = await resolveHrCompanyId(req.user.id);
      if (!ownCompanyId) return res.status(403).json({ error: "Forbidden" });
      // HR can only ever manage their own company's billing.
      targetCompanyId = ownCompanyId;
      targetPractitionerId = null;
    }

    let customerId: string | null = null;
    if (targetCompanyId) {
      const [company] = await db
        .select({ stripeCustomerId: companiesTable.stripeCustomerId })
        .from(companiesTable)
        .where(eq(companiesTable.id, targetCompanyId))
        .limit(1);
      customerId = company?.stripeCustomerId ?? null;
    } else if (targetPractitionerId) {
      const [practitioner] = await db
        .select({ stripeCustomerId: practitionersTable.stripeCustomerId })
        .from(practitionersTable)
        .where(eq(practitionersTable.id, targetPractitionerId))
        .limit(1);
      customerId = practitioner?.stripeCustomerId ?? null;
    } else {
      return res.status(400).json({ error: "companyId or practitionerId is required" });
    }

    if (!customerId) {
      return res.status(400).json({ error: "No Stripe customer for this account yet" });
    }

    const stripe = await getUncachableStripeClient();
    const origin = baseUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}${safePath(returnPath, "/dashboard")}`,
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Stripe portal failed");
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

// GET /stripe/subscription?companyId= | ?practitionerId= — current app-side status.
// Authenticated + scoped like the portal endpoint.
router.get("/stripe/subscription", async (req, res) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
    const isHr = req.user.id.startsWith("hr:");
    if (!isHr && !isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    let companyId = req.query.companyId ? Number(req.query.companyId) : null;
    let practitionerId = req.query.practitionerId ? Number(req.query.practitionerId) : null;

    if (isHr) {
      const ownCompanyId = await resolveHrCompanyId(req.user.id);
      if (!ownCompanyId) return res.status(403).json({ error: "Forbidden" });
      companyId = ownCompanyId;
      practitionerId = null;
    }

    if (companyId) {
      const [company] = await db
        .select({ status: companiesTable.subscriptionStatus })
        .from(companiesTable)
        .where(eq(companiesTable.id, companyId))
        .limit(1);
      if (!company) return res.status(404).json({ error: "Company not found" });
      const [sub] = await db
        .select()
        .from(companySubscriptionsTable)
        .where(eq(companySubscriptionsTable.companyId, companyId))
        .limit(1);
      return res.json({
        subscriptionStatus: company.status,
        planId: sub?.planId ?? null,
        status: sub?.status ?? null,
      });
    }
    if (practitionerId) {
      const [practitioner] = await db
        .select({ status: practitionersTable.subscriptionStatus })
        .from(practitionersTable)
        .where(eq(practitionersTable.id, practitionerId))
        .limit(1);
      if (!practitioner) return res.status(404).json({ error: "Practitioner not found" });
      const [sub] = await db
        .select()
        .from(practitionerSubscriptionsTable)
        .where(eq(practitionerSubscriptionsTable.practitionerId, practitionerId))
        .limit(1);
      return res.json({
        subscriptionStatus: practitioner.status,
        planId: sub?.planId ?? null,
        status: sub?.status ?? null,
      });
    }
    res.status(400).json({ error: "companyId or practitionerId is required" });
  } catch (err) {
    logger.error({ err }, "Stripe subscription status failed");
    res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

// GET /stripe/products-with-prices — products+prices synced from Stripe (best-effort)
router.get("/stripe/products-with-prices", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.description AS product_description,
        p.metadata AS product_metadata,
        pr.id AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY p.id, pr.unit_amount
    `);
    const map = new Map<string, any>();
    for (const row of result.rows as any[]) {
      if (!map.has(row.product_id)) {
        map.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata,
          prices: [],
        });
      }
      if (row.price_id) {
        map.get(row.product_id).prices.push({
          id: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }
    res.json({ data: Array.from(map.values()) });
  } catch (err) {
    logger.warn({ err }, "products-with-prices unavailable (stripe schema not ready)");
    res.json({ data: [] });
  }
});

export default router;
