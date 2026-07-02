import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { isSameOrigin } from "../lib/csrf";
import { googleConfigured, getAuthUrl, exchangeCode, createEvent } from "../lib/googleCalendar";

const router: IRouter = Router();

const EMPLOYEE_CALLBACK_PATH = "/api/employee/google/callback";
const STATE_COOKIE = "emp_g_oauth_state";
const PORTAL_PATH = "/employee";

const THEME_COLORS = new Set(["sage", "terracotta", "ocean", "lavender", "sunset"]);
const FOCUS_AREAS = new Set(["stress", "sleep", "fitness", "nutrition", "mindfulness", "connection"]);

type PreferencesRow = {
  employee_id: number;
  theme_color: string;
  avatar_emoji: string;
  focus_areas: string[];
  show_group_sessions: boolean;
  show_social_calendar: boolean;
  show_self_funded: boolean;
  google_refresh_token: string | null;
  google_email: string | null;
};

function serialize(row: PreferencesRow) {
  return {
    employeeId: row.employee_id,
    themeColor: row.theme_color,
    avatarEmoji: row.avatar_emoji,
    focusAreas: row.focus_areas ?? [],
    showGroupSessions: row.show_group_sessions,
    showSocialCalendar: row.show_social_calendar,
    showSelfFunded: row.show_self_funded,
    googleConnected: Boolean(row.google_refresh_token),
    googleEmail: row.google_email,
  };
}

async function getOrCreate(employeeId: number): Promise<PreferencesRow> {
  const existing = await db.execute<PreferencesRow>(sql`
    SELECT * FROM employee_preferences WHERE employee_id = ${employeeId}
  `);
  if (existing.rows[0]) return existing.rows[0];
  const created = await db.execute<PreferencesRow>(sql`
    INSERT INTO employee_preferences (employee_id) VALUES (${employeeId})
    ON CONFLICT (employee_id) DO UPDATE SET employee_id = EXCLUDED.employee_id
    RETURNING *
  `);
  return created.rows[0];
}

// GET /employee/preferences?employeeId=123
router.get("/employee/preferences", async (req, res) => {
  const employeeId = Number(req.query.employeeId);
  if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
  try {
    const row = await getOrCreate(employeeId);
    res.json(serialize(row));
  } catch (err) {
    logger.error({ err, employeeId }, "Failed to load employee preferences");
    res.status(500).json({ error: "Failed to load preferences" });
  }
});

// PUT /employee/preferences
router.put("/employee/preferences", async (req, res) => {
  const { employeeId, themeColor, avatarEmoji, focusAreas, showGroupSessions, showSocialCalendar, showSelfFunded } =
    req.body as {
      employeeId?: number;
      themeColor?: string;
      avatarEmoji?: string;
      focusAreas?: string[];
      showGroupSessions?: boolean;
      showSocialCalendar?: boolean;
      showSelfFunded?: boolean;
    };
  if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
  if (themeColor && !THEME_COLORS.has(themeColor)) {
    return res.status(400).json({ error: "Invalid theme color" });
  }
  const cleanedFocusAreas = Array.isArray(focusAreas)
    ? focusAreas.filter((f) => FOCUS_AREAS.has(f))
    : undefined;
  // Postgres array literal syntax — drizzle's sql`` template doesn't auto-convert
  // JS arrays into array params, so build the literal string ourselves.
  const focusAreasLiteral = cleanedFocusAreas
    ? `{${cleanedFocusAreas.map((a) => `"${a}"`).join(",")}}`
    : null;

  try {
    await getOrCreate(employeeId);
    const row = await db.execute<PreferencesRow>(sql`
      UPDATE employee_preferences SET
        theme_color = COALESCE(${themeColor}, theme_color),
        avatar_emoji = COALESCE(${avatarEmoji}, avatar_emoji),
        focus_areas = COALESCE(${focusAreasLiteral}::text[], focus_areas),
        show_group_sessions = COALESCE(${showGroupSessions ?? null}, show_group_sessions),
        show_social_calendar = COALESCE(${showSocialCalendar ?? null}, show_social_calendar),
        show_self_funded = COALESCE(${showSelfFunded ?? null}, show_self_funded),
        updated_at = now()
      WHERE employee_id = ${employeeId}
      RETURNING *
    `);
    res.json(serialize(row.rows[0]));
  } catch (err) {
    logger.error({ err, employeeId }, "Failed to update employee preferences");
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// GET /employee/google/connect?employeeId=123 — begin OAuth consent for the employee.
router.get("/employee/google/connect", (req, res) => {
  const employeeId = Number(req.query.employeeId);
  if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
  if (!googleConfigured()) {
    return res.status(503).json({ error: "Google Calendar is not configured yet" });
  }
  const nonce = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });
  const state = `${employeeId}:${nonce}`;
  res.redirect(getAuthUrl(state, EMPLOYEE_CALLBACK_PATH));
});

// OAuth callback: store the refresh token on the employee's preferences.
router.get("/employee/google/callback", async (req, res) => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
  const redirectBack = (status: string) => res.redirect(`${PORTAL_PATH}?google=${status}`);

  if (error || !code || !state) return redirectBack("error");

  const cookieNonce = req.cookies?.[STATE_COOKIE];
  const [stateId, stateNonce] = String(state).split(":");
  res.clearCookie(STATE_COOKIE, { path: "/" });
  const employeeId = Number(stateId);
  if (!cookieNonce || stateNonce !== cookieNonce || !employeeId) {
    return redirectBack("error");
  }

  try {
    const { refreshToken, email } = await exchangeCode(String(code), EMPLOYEE_CALLBACK_PATH);
    if (!refreshToken) {
      logger.warn({ employeeId }, "Google returned no refresh token for employee");
      return redirectBack("noaccess");
    }
    await getOrCreate(employeeId);
    await db.execute(sql`
      UPDATE employee_preferences
      SET google_refresh_token = ${refreshToken}, google_email = ${email}, updated_at = now()
      WHERE employee_id = ${employeeId}
    `);
    return redirectBack("connected");
  } catch (err) {
    logger.error({ err, employeeId }, "Employee Google OAuth callback failed");
    return redirectBack("error");
  }
});

// POST /employee/google/disconnect { employeeId }
router.post("/employee/google/disconnect", async (req, res) => {
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Invalid request origin" });
  const employeeId = Number((req.body as { employeeId?: number }).employeeId);
  if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
  try {
    await db.execute(sql`
      UPDATE employee_preferences
      SET google_refresh_token = NULL, google_email = NULL, updated_at = now()
      WHERE employee_id = ${employeeId}
    `);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, employeeId }, "Employee Google disconnect failed");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// POST /employee/google/sync { employeeId } — push upcoming items to the employee's Google Calendar.
router.post("/employee/google/sync", async (req, res) => {
  if (!isSameOrigin(req)) return res.status(403).json({ error: "Invalid request origin" });
  const employeeId = Number((req.body as { employeeId?: number }).employeeId);
  if (!employeeId) return res.status(400).json({ error: "employeeId is required" });

  try {
    const prefRow = await db.execute<PreferencesRow>(sql`
      SELECT * FROM employee_preferences WHERE employee_id = ${employeeId}
    `);
    const token = prefRow.rows[0]?.google_refresh_token;
    if (!token) return res.status(400).json({ error: "Google Calendar is not connected" });

    let synced = 0;

    // Confirmed 1:1 bookings not yet pushed.
    const bookings = await db.execute<{
      id: number;
      session_type: string;
      start_time: string | null;
      end_time: string | null;
      employee_email: string;
    }>(sql`
      SELECT b.id, b.session_type, ts.start_time, ts.end_time, b.employee_email
      FROM bookings b
      LEFT JOIN time_slots ts ON ts.id = b.time_slot_id
      WHERE b.employee_email = (SELECT email FROM employees WHERE id = ${employeeId})
        AND b.status IN ('confirmed', 'pending')
        AND b.employee_google_event_id IS NULL
        AND ts.start_time IS NOT NULL
        AND ts.start_time >= now()
    `);
    for (const b of bookings.rows) {
      const eventId = await createEvent(token, {
        summary: `Soulful: ${b.session_type}`,
        start: new Date(b.start_time!),
        end: new Date(b.end_time ?? b.start_time!),
      });
      await db.execute(sql`UPDATE bookings SET employee_google_event_id = ${eventId} WHERE id = ${b.id}`);
      synced++;
    }

    // Group sessions the employee is attending.
    const groupSessions = await db.execute<{
      id: number;
      session_type: string;
      start_time: string;
      end_time: string;
    }>(sql`
      SELECT gsa.id, gs.session_type, gs.start_time, gs.end_time
      FROM group_session_attendees gsa
      JOIN group_sessions gs ON gs.id = gsa.group_session_id
      WHERE gsa.employee_id = ${employeeId}
        AND gsa.employee_google_event_id IS NULL
        AND gs.start_time >= now()
        AND gs.status != 'cancelled'
    `);
    for (const s of groupSessions.rows) {
      const eventId = await createEvent(token, {
        summary: `Soulful: ${s.session_type} (group session)`,
        start: new Date(s.start_time),
        end: new Date(s.end_time),
      });
      await db.execute(sql`UPDATE group_session_attendees SET employee_google_event_id = ${eventId} WHERE id = ${s.id}`);
      synced++;
    }

    // Social events the employee has RSVP'd to.
    const socialEvents = await db.execute<{
      id: number;
      title: string;
      start_time: string;
      end_time: string;
    }>(sql`
      SELECT ser.id, se.title, se.start_time, se.end_time
      FROM social_event_rsvps ser
      JOIN social_events se ON se.id = ser.social_event_id
      WHERE ser.employee_id = ${employeeId}
        AND ser.employee_google_event_id IS NULL
        AND se.start_time >= now()
        AND se.status = 'active'
    `);
    for (const e of socialEvents.rows) {
      const eventId = await createEvent(token, {
        summary: `Soulful: ${e.title}`,
        start: new Date(e.start_time),
        end: new Date(e.end_time),
      });
      await db.execute(sql`UPDATE social_event_rsvps SET employee_google_event_id = ${eventId} WHERE id = ${e.id}`);
      synced++;
    }

    res.json({ ok: true, synced });
  } catch (err) {
    logger.error({ err, employeeId }, "Employee Google sync failed");
    res.status(502).json({ error: "Failed to sync with Google Calendar" });
  }
});

export default router;
