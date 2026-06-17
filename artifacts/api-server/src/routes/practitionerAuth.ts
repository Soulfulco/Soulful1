import { Router } from "express";
import { db } from "@workspace/db";
import { practitionersTable, timeSlotsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import crypto from "crypto";
import { createSession, clearSession, getSessionId, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";
import { isAdmin, practitionerId } from "../lib/roles";
import { isSameOrigin } from "../lib/csrf";
import { logger } from "../lib/logger";

const router = Router();

export function hashPassword(password: string): string {
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

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
function lastName(name: string): string | null {
  return name.split(" ").slice(1).join(" ") || null;
}

// Practitioner login
router.post("/practitioner/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const [p] = await db
      .select()
      .from(practitionersTable)
      .where(eq(practitionersTable.email, String(email).toLowerCase().trim()));

    if (!p || !p.passwordHash) return res.status(401).json({ error: "Invalid credentials" });
    if (!p.isActive) return res.status(403).json({ error: "This account is not active. Please contact Soulful." });
    if (hashPassword(String(password)) !== p.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionData = {
      user: {
        id: `pract:${p.id}`,
        email: p.email,
        firstName: firstName(p.name),
        lastName: lastName(p.name),
        profileImageUrl: p.avatarUrl ?? null,
      },
      practitionerId: p.id,
      access_token: "",
    };
    const sid = await createSession(sessionData as any);
    setSessionCookie(res, sid);
    res.json({ ok: true, user: sessionData.user });
  } catch (err) {
    logger.error({ err }, "Practitioner login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

// Practitioner logout
router.post("/practitioner/logout", async (req, res) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ ok: true });
});

// Current practitioner profile
router.get("/practitioner/me", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  const [p] = await db.select().from(practitionersTable).where(eq(practitionersTable.id, id));
  if (!p) return res.status(404).json({ error: "Practitioner not found" });
  res.json({
    id: p.id,
    name: p.name,
    email: p.email,
    specialism: p.specialism,
    avatarUrl: p.avatarUrl,
    isActive: p.isActive,
    approvalStatus: p.approvalStatus,
    googleConnected: Boolean(p.googleRefreshToken),
    googleEmail: p.googleEmail ?? null,
  });
});

// List my availability
router.get("/practitioner/availability", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const slots = await db
      .select()
      .from(timeSlotsTable)
      .where(eq(timeSlotsTable.practitionerId, id));
    res.json(
      slots.map((s) => ({
        ...s,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
      })),
    );
  } catch (err) {
    logger.error({ err }, "Failed to list practitioner availability");
    res.status(500).json({ error: "Failed to load availability" });
  }
});

// Add a slot to my availability
router.post("/practitioner/availability", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Invalid request origin" });
  try {
    const { startTime, endTime, sessionType } = req.body ?? {};
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "Valid startTime and endTime are required" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "End time must be after start time" });
    }
    const [slot] = await db
      .insert(timeSlotsTable)
      .values({ practitionerId: id, startTime: start, endTime: end, sessionType: sessionType ?? null })
      .returning();
    res.status(201).json({ ...slot, startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() });
  } catch (err) {
    logger.error({ err }, "Failed to add availability slot");
    res.status(500).json({ error: "Failed to add slot" });
  }
});

// Delete one of my slots (only if unbooked and mine)
router.delete("/practitioner/availability/:slotId", async (req, res) => {
  const id = practitionerId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Invalid request origin" });
  try {
    const slotId = Number(req.params.slotId);
    if (!slotId || Number.isNaN(slotId)) return res.status(400).json({ error: "Invalid slot id" });
    const [slot] = await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, slotId));
    if (!slot || slot.practitionerId !== id) return res.status(404).json({ error: "Slot not found" });
    if (slot.isBooked) return res.status(409).json({ error: "This slot is already booked and cannot be removed" });
    await db.delete(timeSlotsTable).where(and(eq(timeSlotsTable.id, slotId), eq(timeSlotsTable.practitionerId, id)));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete availability slot");
    res.status(500).json({ error: "Failed to delete slot" });
  }
});

// Admin: set/reset a practitioner's portal password (onboard existing practitioners)
router.post("/practitioners/:id/set-password", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Not authorised" });
  try {
    const id = Number(req.params.id);
    const { password } = req.body ?? {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const [p] = await db
      .update(practitionersTable)
      .set({ passwordHash: hashPassword(String(password)) })
      .where(eq(practitionersTable.id, id))
      .returning();
    if (!p) return res.status(404).json({ error: "Practitioner not found" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to set practitioner password");
    res.status(500).json({ error: "Failed to set password" });
  }
});

export default router;
