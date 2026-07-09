import { Router } from "express";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSession, clearSession, getSessionId, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";
import { hashAdminPassword, verifyAdminPassword } from "../lib/adminAuth";
import { isAdmin } from "../lib/roles";

const router = Router();

function setSessionCookie(res: any, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const [admin] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, String(email).toLowerCase().trim()));

    if (!admin) return res.status(401).json({ error: "Invalid credentials" });
    if (!verifyAdminPassword(password, admin.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionData = {
      user: {
        id: `admin:${admin.id}`,
        email: admin.email,
        firstName: admin.name.split(" ")[0] ?? admin.name,
        lastName: admin.name.split(" ").slice(1).join(" ") || null,
        profileImageUrl: null,
      },
      adminUserId: admin.id,
      access_token: "",
    };

    const sid = await createSession(sessionData as any);
    setSessionCookie(res, sid);
    res.json({ ok: true, user: sessionData.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/admin/logout", async (req, res) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ ok: true });
});

router.get("/admin/me", async (req, res) => {
  if (!req.isAuthenticated() || !isAdmin(req)) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: req.user });
});

router.post("/admin/users", async (req, res) => {
  if (!req.isAuthenticated() || !isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const { email, password, name } = req.body ?? {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password and name are required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const [created] = await db
      .insert(adminUsersTable)
      .values({
        email: String(email).toLowerCase().trim(),
        passwordHash: hashAdminPassword(password),
        name,
      })
      .returning({ id: adminUsersTable.id, email: adminUsersTable.email, name: adminUsersTable.name });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      return res.status(409).json({ error: "An admin with this email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create admin user" });
  }
});

export default router;
