import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { createSession, clearSession, getSessionId, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";

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
  // Only Replit-authed admins (non-hr: prefix) can create HR accounts
  if (req.user.id.startsWith("hr:")) return res.status(403).json({ error: "Forbidden" });

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
  if (req.user.id.startsWith("hr:")) return res.status(403).json({ error: "Forbidden" });
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
