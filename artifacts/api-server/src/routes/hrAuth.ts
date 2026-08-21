import { Router } from "express";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createSession, clearSession, getSessionId, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";
import { isAdmin, isHr, resolveHrCompanyId } from "../lib/roles";
import { resolveReferralCode, generateUniqueReferralCode, generateUniqueInviteCode } from "../lib/referrals";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../stripeClient";
import { baseUrl } from "../lib/url";

const router = Router();

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}
function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

function setSessionCookie(res: any, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

// HR Login
router.post("/hr/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await db.execute(sql`
      SELECT hr.*, c.name AS company_name
      FROM hr_users hr
      JOIN companies c ON c.id = hr.company_id
      WHERE hr.email = ${email.toLowerCase().trim()} AND hr.is_active = true
    `);
    const hrUser = result.rows[0] as any;

    if (!hrUser) return res.status(401).json({ error: "Invalid credentials" });

    if (!verifyPassword(password, hrUser.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionData = {
      user: {
        id: `hr:${hrUser.id}`,
        email: hrUser.email,
        firstName: hrUser.name.split(" ")[0] ?? hrUser.name,
        lastName: hrUser.name.split(" ").slice(1).join(" ") || null,
        profileImageUrl: null,
      },
      hrUserId: hrUser.id,
      companyId: hrUser.company_id,
      companyName: hrUser.company_name,
      role: hrUser.role,
      access_token: "",
    };

    const sid = await createSession(sessionData as any);
    setSessionCookie(res, sid);
    res.json({
      ok: true,
      user: sessionData.user,
      companyId: hrUser.company_id,
      companyName: hrUser.company_name,
      role: hrUser.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Public: self-serve corporate sign-up — handles free plans (instant
// activation) and paid plans (creates the login, then redirects to Stripe
// checkout) in one unified flow, so every signup ends up with a working
// login regardless of which plan they picked.
router.post("/hr/register", async (req, res) => {
  try {
    const { name, email, industry, employeeCount, contactName, password, planId, referralCode, employerName } =
      req.body ?? {};
    if (!name || !email || !industry || !contactName || !password) {
      return res
        .status(400)
        .json({ error: "name, email, industry, contactName and password are required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const count = Number(employeeCount);
    if (!Number.isInteger(count) || count < 1) {
      return res.status(400).json({ error: "employeeCount must be a positive whole number" });
    }
    const pid = Number(planId);
    if (!pid || Number.isNaN(pid)) {
      return res.status(400).json({ error: "planId is required" });
    }

    const planResult = await db.execute(sql`
      SELECT plan_type, price_gbp, stripe_price_id FROM subscription_plans WHERE id = ${pid}
    `);
    const plan = planResult.rows[0] as
      | { plan_type: string; price_gbp: string; stripe_price_id: string | null }
      | undefined;
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    if (plan.plan_type !== "corporate") {
      return res.status(400).json({ error: "This is not a corporate plan" });
    }
    const isPaidPlan = !!plan.stripe_price_id || Number(plan.price_gbp) > 0;
    if (isPaidPlan && !plan.stripe_price_id) {
      return res
        .status(400)
        .json({ error: "This plan is not yet linked to Stripe. Run the seed-stripe-products script first." });
    }

    const normEmail = email.toLowerCase().trim();
    const dupe = await db.execute(sql`
      SELECT 1 FROM hr_users WHERE email = ${normEmail}
      UNION SELECT 1 FROM companies WHERE email = ${normEmail}
      LIMIT 1
    `);
    if (dupe.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists. Please log in." });
    }

    const referrer = await resolveReferralCode(referralCode);
    const ownReferralCode = await generateUniqueReferralCode();
    const employeeInviteCode = await generateUniqueInviteCode();

    // Education-sector signups get permanent free access — never locked —
    // rather than the normal 1-week trial. Detected from the self-declared
    // Industry field; a company can always be moved off this later by an
    // admin editing their record, same as any other plan change.
    const EDUCATION_KEYWORDS = ["education", "school", "university", "college", "academy", "nursery"];
    const isEducation = EDUCATION_KEYWORDS.some((kw) => industry.toLowerCase().includes(kw));

    // Create company + HR login + free subscription atomically so a mid-sequence
    // failure (incl. a concurrent duplicate email) never leaves orphan rows.
    let company: { id: number; name: string };
    let hrUser: { id: number; email: string; name: string; role: string };
    try {
      const out = await db.transaction(async (tx) => {
        const companyResult = await tx.execute(sql`
          INSERT INTO companies (name, email, industry, employee_count, contact_name, referral_code, referred_by_company_id, invite_code, trial_ends_at)
          VALUES (${name}, ${normEmail}, ${industry}, ${count}, ${contactName}, ${ownReferralCode}, ${referrer?.id ?? null}, ${employeeInviteCode}, ${isEducation ? null : sql`now() + interval '7 days'`})
          RETURNING id, name
        `);
        const co = companyResult.rows[0] as { id: number; name: string };

        if (referrer) {
          await tx.execute(sql`
            INSERT INTO company_referrals (referrer_company_id, referred_company_id, status)
            VALUES (${referrer.id}, ${co.id}, 'pending')
            ON CONFLICT (referred_company_id) DO NOTHING
          `);
        }

        const hash = hashPassword(password);
        const hrResult = await tx.execute(sql`
          INSERT INTO hr_users (company_id, email, password_hash, name)
          VALUES (${co.id}, ${normEmail}, ${hash}, ${contactName})
          RETURNING id, email, name, role
        `);
        const hr = hrResult.rows[0] as { id: number; email: string; name: string; role: string };

        // Free plans activate immediately. Paid plans don't get a
        // company_subscriptions row yet — Stripe is the source of truth for
        // whether payment actually succeeded, and the webhook sync creates
        // this record once it does. Writing "active" here before payment
        // completes would be misleading if checkout is abandoned.
        if (!isPaidPlan) {
          await tx.execute(sql`
            INSERT INTO company_subscriptions (company_id, plan_id, status)
            VALUES (${co.id}, ${pid}, 'active')
          `);
        }
        return { co, hr };
      });
      company = out.co;
      hrUser = out.hr;
    } catch (err: any) {
      // Unique-violation (email already taken) — friendly 409 instead of a 500.
      if (err?.code === "23505" || err?.cause?.code === "23505") {
        return res
          .status(409)
          .json({ error: "An account with this email already exists. Please log in." });
      }
      throw err;
    }

    // Best-effort mailing list capture. The low-friction free/individual
    // tiers exist partly to gather contact details, so every signup is
    // added here too, along with their stated employer if given (e.g. an
    // Individual Membership signup whose employer isn't yet a customer —
    // a qualified lead for follow-up). Never blocks or fails the signup.
    const leadNotes =
      typeof employerName === "string" && employerName.trim()
        ? `Stated employer: ${employerName.trim()}`
        : null;
    db.execute(sql`
      INSERT INTO mailing_list_subscribers (email, name, source, notes)
      VALUES (${normEmail}, ${contactName}, ${isPaidPlan ? "paid-tier-signup" : "free-tier-signup"}, ${leadNotes})
      ON CONFLICT (lower(email)) DO NOTHING
    `).catch((err: unknown) => logger.warn({ err, email: normEmail }, "Failed to add signup contact to mailing list"));

    const sessionData = {
      user: {
        id: `hr:${hrUser.id}`,
        email: hrUser.email,
        firstName: hrUser.name.split(" ")[0] ?? hrUser.name,
        lastName: hrUser.name.split(" ").slice(1).join(" ") || null,
        profileImageUrl: null,
      },
      hrUserId: hrUser.id,
      companyId: company.id,
      companyName: company.name,
      role: hrUser.role,
      access_token: "",
    };
    // Log them in immediately either way — for paid plans this means
    // they're already authenticated when Stripe redirects them back,
    // rather than landing on the dashboard with no way to sign in.
    const sid = await createSession(sessionData as any);
    setSessionCookie(res, sid);

    if (!isPaidPlan) {
      return res.status(201).json({
        ok: true,
        user: sessionData.user,
        companyId: company.id,
        companyName: company.name,
        role: hrUser.role,
      });
    }

    // Paid plan — kick off Stripe checkout for their new subscription.
    const stripe = await getUncachableStripeClient();
    const origin = baseUrl();
    const customer = await stripe.customers.create({
      email: normEmail,
      name: company.name,
      metadata: { appCompanyId: String(company.id) },
    });
    await db
      .update(companiesTable)
      .set({ stripeCustomerId: customer.id })
      .where(eq(companiesTable.id, company.id));

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: plan.stripe_price_id!, quantity: 1 }],
      subscription_data: {
        metadata: { appPlanId: String(pid), appCompanyId: String(company.id) },
        trial_period_days: 7,
      },
      metadata: { appPlanId: String(pid), appCompanyId: String(company.id) },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/for-corporates?checkout=cancelled`,
    });

    res.status(201).json({
      ok: true,
      user: sessionData.user,
      companyId: company.id,
      companyName: company.name,
      role: hrUser.role,
      checkoutUrl: session.url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// HR Logout
router.post("/hr/logout", async (req, res) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ ok: true });
});

// Get current HR session info (augments /api/auth/user)
router.get("/hr/me", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
  const userId = req.user.id;
  if (!userId.startsWith("hr:")) return res.status(403).json({ error: "Not an HR account" });

  const hrId = parseInt(userId.slice(3));
  const result = await db.execute(sql`
    SELECT hr.*, c.name AS company_name
    FROM hr_users hr
    JOIN companies c ON c.id = hr.company_id
    WHERE hr.id = ${hrId}
  `);
  const hrUser = result.rows[0] as any;
  if (!hrUser) return res.status(404).json({ error: "HR user not found" });

  res.json({
    id: hrUser.id,
    email: hrUser.email,
    name: hrUser.name,
    role: hrUser.role,
    companyId: hrUser.company_id,
    companyName: hrUser.company_name,
  });
});

// Admin: create an HR user for a company (Soulful admin only)
router.post("/hr/users", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
  // Only Soulful admins can create HR accounts (excludes hr: and pract: sessions)
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

  try {
    const { companyId, email, password, name } = req.body;
    if (!companyId || !email || !password || !name) {
      return res.status(400).json({ error: "companyId, email, password, name are required" });
    }
    const hash = hashPassword(password);
    const result = await db.execute(sql`
      INSERT INTO hr_users (company_id, email, password_hash, name)
      VALUES (${companyId}, ${email.toLowerCase().trim()}, ${hash}, ${name})
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        company_id = EXCLUDED.company_id
      RETURNING id, email, name, role, company_id, created_at
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create HR user" });
  }
});

// Admin: list HR users
router.get("/hr/users", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const result = await db.execute(sql`
      SELECT hr.id, hr.email, hr.name, hr.role, hr.is_active, hr.created_at,
        c.name AS company_name, c.id AS company_id
      FROM hr_users hr
      JOIN companies c ON c.id = hr.company_id
      ORDER BY c.name, hr.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to list HR users" });
  }
});

// ── Payment method (self-service, for logged-in HR users) ──────────────

// GET /company/payment-method — does the logged-in HR user's company have a card on file?
router.get("/company/payment-method", async (req, res) => {
  if (!isHr(req)) return res.status(403).json({ error: "Not an HR account" });
  try {
    const companyId = await resolveHrCompanyId(req);
    if (!companyId) return res.status(403).json({ error: "No company associated with this account" });

    const [company] = await db
      .select({ stripeCustomerId: companiesTable.stripeCustomerId })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId));

    if (!company?.stripeCustomerId) {
      return res.json({ hasPaymentMethod: false, last4: null, brand: null });
    }

    const stripe = await getUncachableStripeClient();
    const methods = await stripe.paymentMethods.list({ customer: company.stripeCustomerId, type: "card" });
    const card = methods.data[0]?.card;
    res.json({
      hasPaymentMethod: Boolean(card),
      last4: card?.last4 ?? null,
      brand: card?.brand ?? null,
    });
    } catch (err) {
        logger.error({ err }, "Failed to fetch company payment method");
        res.status(500).json({ error: "Failed to fetch payment method" });
    }
  });

  // POST /company/payment-method/setup — creates a Stripe customer if the

// POST /company/payment-method/setup — creates a Stripe customer if the
// company doesn't have one yet, then returns a Stripe-hosted Checkout URL
// (mode: "setup") to add or replace a card, with no charge involved.
router.post("/company/payment-method/setup", async (req, res) => {
  if (!isHr(req)) return res.status(403).json({ error: "Not an HR account" });
  try {
    const companyId = await resolveHrCompanyId(req);
    if (!companyId) return res.status(403).json({ error: "No company associated with this account" });

    const [company] = await db
      .select({ stripeCustomerId: companiesTable.stripeCustomerId, name: companiesTable.name, email: companiesTable.email })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId));
    if (!company) return res.status(404).json({ error: "Company not found" });

    const stripe = await getUncachableStripeClient();
    let customerId = company.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: company.email,
        name: company.name,
        metadata: { appCompanyId: String(companyId) },
      });
      customerId = customer.id;
      await db.update(companiesTable).set({ stripeCustomerId: customerId }).where(eq(companiesTable.id, companyId));
    }

    const origin = baseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      success_url: `${origin}/dashboard?payment_method=success`,
      cancel_url: `${origin}/dashboard?payment_method=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Failed to start payment method setup");
    res.status(500).json({ error: "Failed to start payment method setup" });
  }
});

export default router;
