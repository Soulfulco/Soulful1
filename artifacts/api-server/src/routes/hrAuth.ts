import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { createSession, clearSession, getSessionId, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";
import { isAdmin } from "../lib/roles";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + process.env.REPL_ID).digest("hex");
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

    const hash = hashPassword(password);
    if (hash !== hrUser.password_hash) return res.status(401).json({ error: "Invalid credentials" });

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

// Public: self-serve corporate sign-up on a FREE plan. Creates the company, an
// HR login account, the free subscription, and logs the user in. Paid plans must
// go through Stripe checkout instead, so this rejects any plan that has a price.
router.post("/hr/register", async (req, res) => {
  try {
    const { name, email, industry, employeeCount, contactName, password, planId } = req.body ?? {};
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
    if (plan.stripe_price_id || Number(plan.price_gbp) > 0) {
      return res
        .status(400)
        .json({ error: "This plan requires payment. Please complete checkout instead." });
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

    // Create company + HR login + free subscription atomically so a mid-sequence
    // failure (incl. a concurrent duplicate email) never leaves orphan rows.
    let company: { id: number; name: string };
    let hrUser: { id: number; email: string; name: string; role: string };
    try {
      const out = await db.transaction(async (tx) => {
        const companyResult = await tx.execute(sql`
          INSERT INTO companies (name, email, industry, employee_count, contact_name)
          VALUES (${name}, ${normEmail}, ${industry}, ${count}, ${contactName})
          RETURNING id, name
        `);
        const co = companyResult.rows[0] as { id: number; name: string };

        const hash = hashPassword(password);
        const hrResult = await tx.execute(sql`
          INSERT INTO hr_users (company_id, email, password_hash, name)
          VALUES (${co.id}, ${normEmail}, ${hash}, ${contactName})
          RETURNING id, email, name, role
        `);
        const hr = hrResult.rows[0] as { id: number; email: string; name: string; role: string };

        await tx.execute(sql`
          INSERT INTO company_subscriptions (company_id, plan_id, status)
          VALUES (${co.id}, ${pid}, 'active')
        `);
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
    const sid = await createSession(sessionData as any);
    setSessionCookie(res, sid);
    res.status(201).json({
      ok: true,
      user: sessionData.user,
      companyId: company.id,
      companyName: company.name,
      role: hrUser.role,
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

export default router;
