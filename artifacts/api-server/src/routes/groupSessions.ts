import { Router, type Request } from "express";
import { db, employeesTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { awardPoints } from "../lib/gamification";
import { logRequirementSafe } from "../lib/wellbeingRequirements";
import { logger } from "../lib/logger";
import { isTrialLocked, TRIAL_LOCKED_MESSAGE } from "../lib/trialGate";
import {
  isAdmin,
  isHr,
  isEmployee,
  isPractitioner,
  employeeId,
  practitionerId as sessionPractitionerId,
  resolveHrCompanyId,
} from "../lib/roles";

const router = Router();

type Viewer =
  | { kind: "admin" }
  | { kind: "hr"; companyId: number }
  | { kind: "employee"; companyId: number; employeeId: number; name: string; email: string }
  | { kind: "practitioner"; practitionerId: number };

// Works out who is calling from the signed-in session. The company always comes from
// the session, never from anything the browser sends.
async function getViewer(req: Request): Promise<Viewer | null> {
  if (!req.isAuthenticated()) return null;
  if (isAdmin(req)) return { kind: "admin" };
  if (isHr(req)) {
    const companyId = await resolveHrCompanyId(req);
    return companyId == null ? null : { kind: "hr", companyId };
  }
  if (isEmployee(req)) {
    const id = employeeId(req);
    if (id == null) return null;
    const [row] = await db
      .select({ id: employeesTable.id, companyId: employeesTable.companyId, name: employeesTable.name, email: employeesTable.email })
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .limit(1);
    return row ? { kind: "employee", companyId: row.companyId, employeeId: row.id, name: row.name, email: row.email } : null;
  }
  if (isPractitioner(req)) {
    const id = sessionPractitionerId(req);
    return id == null ? null : { kind: "practitioner", practitionerId: id };
  }
  return null;
}

const SESSION_STATUSES = ["pending", "confirmed", "cancelled", "declined"];
const decisionDeadlineHours = 24;

// List group sessions (with attendee count + practitioner name).
// Employees see their own company's confirmed sessions; HR sees their company's sessions;
// practitioners see their own; admin can see everything (or filter by ?companyId=).
router.get("/group-sessions", async (req, res) => {
  try {
    const viewer = await getViewer(req);
    if (!viewer) return res.status(401).json({ error: "Authentication required" });

    let companyId: number | null = null;
    let practitionerIdFilter: number | null = null;
    if (viewer.kind === "hr" || viewer.kind === "employee") {
      companyId = viewer.companyId;
    } else if (viewer.kind === "practitioner") {
      practitionerIdFilter = viewer.practitionerId;
    } else {
      const q = (req.query as { companyId?: string }).companyId;
      if (q) {
        companyId = Number(q);
        if (!Number.isInteger(companyId)) return res.status(400).json({ error: "Invalid companyId" });
      }
    }
    if (companyId != null && (await isTrialLocked(companyId))) {
      return res.status(402).json({ error: TRIAL_LOCKED_MESSAGE, locked: true });
    }
    const onlyConfirmed = viewer.kind === "employee";

    const result = await db.execute(sql`
      SELECT gs.*, p.name AS practitioner_name, p.specialism AS practitioner_specialism,
        c.name AS company_name,
        COUNT(gsa.id)::int AS attendee_count
      FROM group_sessions gs
      JOIN practitioners p ON p.id = gs.practitioner_id
      JOIN companies c ON c.id = gs.company_id
      LEFT JOIN group_session_attendees gsa ON gsa.group_session_id = gs.id
      WHERE (${companyId}::int IS NULL OR gs.company_id = ${companyId}::int)
        AND (${practitionerIdFilter}::int IS NULL OR gs.practitioner_id = ${practitionerIdFilter}::int)
        AND (${onlyConfirmed}::boolean = false OR gs.status = 'confirmed')
      GROUP BY gs.id, p.name, p.specialism, c.name
      ORDER BY gs.start_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "Failed to list group sessions");
    res.status(500).json({ error: "Failed to list group sessions" });
  }
});

// HR schedules a group session for their own company
router.post("/group-sessions", async (req, res) => {
  try {
    const viewer = await getViewer(req);
    if (!viewer) return res.status(401).json({ error: "Authentication required" });
    if (viewer.kind !== "hr" && viewer.kind !== "admin") {
      return res.status(403).json({ error: "Only HR can schedule group sessions" });
    }
    const body = req.body ?? {};
    const companyId = viewer.kind === "hr" ? viewer.companyId : Number(body.companyId);
    if (!Number.isInteger(companyId)) return res.status(400).json({ error: "companyId is required" });
    const practitionerId = Number(body.practitionerId);
    const sessionType = typeof body.sessionType === "string" ? body.sessionType.trim() : "";
    if (!Number.isInteger(practitionerId) || !sessionType) {
      return res.status(400).json({ error: "practitionerId and sessionType are required" });
    }
    const start = new Date(body.startTime);
    const end = new Date(body.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: "A valid start and end time are required" });
    }
    const maxAttendees = body.maxAttendees == null ? 20 : Number(body.maxAttendees);
    if (!Number.isInteger(maxAttendees) || maxAttendees < 1 || maxAttendees > 500) {
      return res.status(400).json({ error: "maxAttendees must be between 1 and 500" });
    }
    if (await isTrialLocked(companyId)) {
      return res.status(402).json({ error: TRIAL_LOCKED_MESSAGE, locked: true });
    }
    const pract = await db.execute(sql`SELECT is_active FROM practitioners WHERE id = ${practitionerId}`);
    const practRow = pract.rows[0] as { is_active?: boolean } | undefined;
    if (!practRow || !practRow.is_active) return res.status(404).json({ error: "Practitioner not found" });

    const result = await db.execute(sql`
      INSERT INTO group_sessions
        (company_id, practitioner_id, session_type, start_time, end_time,
         max_attendees, location_type, location_description, notes, status, decide_by)
      VALUES
        (${companyId}, ${practitionerId}, ${sessionType},
         ${String(body.startTime)}::timestamp, ${String(body.endTime)}::timestamp,
         ${maxAttendees}, ${body.locationType ?? "at_office"},
         ${body.locationDescription ?? null}, ${body.notes ?? null},
         'pending', NOW() + INTERVAL '${decisionDeadlineHours} hours')
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error({ err }, "Failed to create group session");
    res.status(500).json({ error: "Failed to create group session" });
  }
});


// Practitioner: their own pending group session requests
router.get("/practitioner/group-sessions/requests", async (req, res) => {
  try {
    const viewer = await getViewer(req);
    if (!viewer || viewer.kind !== "practitioner") return res.status(401).json({ error: "Authentication required" });
    const result = await db.execute(sql`
      SELECT gs.*, c.name AS company_name
      FROM group_sessions gs
      JOIN companies c ON c.id = gs.company_id
      WHERE gs.practitioner_id = ${viewer.practitionerId} AND gs.status = 'pending'
      ORDER BY gs.start_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "Failed to list group session requests");
    res.status(500).json({ error: "Failed to list requests" });
  }
});

// Practitioner accepts a pending group session
router.post("/practitioner/group-sessions/:id/accept", async (req, res) => {
  try {
    const viewer = await getViewer(req);
    if (!viewer || viewer.kind !== "practitioner") return res.status(401).json({ error: "Authentication required" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await db.execute(sql`
      UPDATE group_sessions SET status = 'confirmed', decide_by = NULL
      WHERE id = ${id} AND practitioner_id = ${viewer.practitionerId} AND status = 'pending'
      RETURNING *
    `);
    if (!result.rows[0]) {
      return res.status(404).json({ error: "This request is no longer available to accept" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err }, "Failed to accept group session");
    res.status(500).json({ error: "Failed to accept" });
  }
});

// Practitioner declines a pending group session; a reason is required. HR is told the
// practitioner is unavailable and to choose someone else — there's no automatic replacement.
router.post("/practitioner/group-sessions/:id/decline", async (req, res) => {
  try {
    const viewer = await getViewer(req);
    if (!viewer || viewer.kind !== "practitioner") return res.status(401).json({ error: "Authentication required" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) return res.status(400).json({ error: "Please give a reason for declining" });
    const result = await db.execute(sql`
      UPDATE group_sessions SET status = 'declined', decline_reason = ${reason.slice(0, 500)}, decide_by = NULL
      WHERE id = ${id} AND practitioner_id = ${viewer.practitionerId} AND status = 'pending'
      RETURNING *
    `);
    if (!result.rows[0]) {
      return res.status(404).json({ error: "This request is no longer available to decline" });
    }
    await notifyHrOfDecline(result.rows[0] as any);
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err }, "Failed to decline group session");
    res.status(500).json({ error: "Failed to decline" });
  }
});

// Get a single group session. HR, admin and the practitioner see the full attendee list;
// an employee only sees their own entry (so the portal can show whether they're signed up).
router.get("/group-sessions/:id", async (req, res) => {
  try {
    const viewer = await getViewer(req);
    if (!viewer) return res.status(401).json({ error: "Authentication required" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const session = await db.execute(sql`
      SELECT gs.*, p.name AS practitioner_name, p.specialism AS practitioner_specialism
      FROM group_sessions gs
      JOIN practitioners p ON p.id = gs.practitioner_id
      WHERE gs.id = ${id}
    `);
    const row = session.rows[0] as Record<string, any> | undefined;
    if (!row) return res.status(404).json({ error: "Not found" });

    const sameCompany = (viewer.kind === "hr" || viewer.kind === "employee") && row.company_id === viewer.companyId;
    const ownSession = viewer.kind === "practitioner" && row.practitioner_id === viewer.practitionerId;
    if (viewer.kind !== "admin" && !sameCompany && !ownSession) return res.status(404).json({ error: "Not found" });
    if (viewer.kind === "employee" && row.status !== "confirmed") return res.status(404).json({ error: "Not found" });

    const attendees = await db.execute(sql`
      SELECT * FROM group_session_attendees WHERE group_session_id = ${id} ORDER BY signed_up_at ASC
    `);
    let visible = attendees.rows as Record<string, any>[];
    if (viewer.kind === "employee") {
      visible = visible.filter((a) => String(a.employee_email).toLowerCase() === viewer.email.toLowerCase());
    }
    res.json({ ...row, attendee_count: attendees.rows.length, attendees: visible });
  } catch (err) {
    logger.error({ err }, "Failed to get group session");
    res.status(500).json({ error: "Failed to get group session" });
  }
});

// An employee signs up to a group session at their own company
router.post("/group-sessions/:id/attend", async (req, res) => {
  try {
    const viewer = await getViewer(req);
    if (!viewer) return res.status(401).json({ error: "Authentication required" });
    if (viewer.kind !== "employee") return res.status(403).json({ error: "Only employees can sign up to a session" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const found = await db.execute(sql`
      SELECT id, company_id, status, end_time, max_attendees FROM group_sessions WHERE id = ${id}
    `);
    const gs = found.rows[0] as
      | { id: number; company_id: number; status: string; end_time: string | Date; max_attendees: number }
      | undefined;
    if (!gs || gs.company_id !== viewer.companyId || gs.status !== "confirmed") {
      return res.status(404).json({ error: "Session not found" });
    }
    if (new Date(gs.end_time).getTime() < Date.now()) {
      return res.status(409).json({ error: "This session has already finished" });
    }

    const inserted = await db.execute(sql`
      INSERT INTO group_session_attendees (group_session_id, employee_id, employee_name, employee_email)
      SELECT ${id}::int, ${viewer.employeeId}::int, ${viewer.name}::text, ${viewer.email}::text
      WHERE (SELECT COUNT(*) FROM group_session_attendees WHERE group_session_id = ${id}::int) < ${gs.max_attendees}::int
      ON CONFLICT (group_session_id, employee_email) DO NOTHING
      RETURNING id
    `);
    if (inserted.rows.length === 0) {
      const existing = await db.execute(sql`
        SELECT 1 FROM group_session_attendees WHERE group_session_id = ${id} AND employee_email = ${viewer.email}
      `);
      if (existing.rows.length > 0) return res.status(409).json({ error: "You're already signed up to this session" });
      return res.status(409).json({ error: "This session is full" });
    }

    try {
      await awardPoints(viewer.employeeId, "group_session");
      logRequirementSafe(viewer.employeeId, "group_session", "auto");
    } catch (err) {
      logger.error({ err, employeeId: viewer.employeeId }, "Failed to award points for group session sign-up");
    }
    res.status(201).json({ message: "Signed up" });
  } catch (err) {
    logger.error({ err }, "Failed to sign up to group session");
    res.status(500).json({ error: "Failed to sign up" });
  }
});

// An employee withdraws themselves from a group session
router.delete("/group-sessions/:id/attend", async (req, res) => {
  try {
    const viewer = await getViewer(req);
    if (!viewer) return res.status(401).json({ error: "Authentication required" });
    if (viewer.kind !== "employee") return res.status(403).json({ error: "Only employees can withdraw from a session" });
    const groupSessionId = Number(req.params.id);
    if (!Number.isInteger(groupSessionId)) return res.status(400).json({ error: "Invalid id" });
    await db.execute(sql`
      DELETE FROM group_session_attendees
      WHERE group_session_id = ${groupSessionId} AND employee_email = ${viewer.email}
    `);
    res.json({ message: "Withdrawn" });
  } catch (err) {
    logger.error({ err }, "Failed to withdraw from group session");
    res.status(500).json({ error: "Failed to withdraw" });
  }
});

// HR cancels (or re-confirms) a group session at their own company
router.patch("/group-sessions/:id", async (req, res) => {
  try {
    const viewer = await getViewer(req);
    if (!viewer) return res.status(401).json({ error: "Authentication required" });
    if (viewer.kind !== "hr" && viewer.kind !== "admin") {
      return res.status(403).json({ error: "Only HR can change a group session" });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { status } = req.body ?? {};
    if (!SESSION_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const scopedCompanyId = viewer.kind === "hr" ? viewer.companyId : null;
    const result = await db.execute(sql`
      UPDATE group_sessions SET status = ${status}
      WHERE id = ${id} AND (${scopedCompanyId}::int IS NULL OR company_id = ${scopedCompanyId}::int)
      RETURNING *
    `);
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err }, "Failed to update group session");
    res.status(500).json({ error: "Failed to update group session" });
  }
});


// Tells HR their chosen practitioner can't do this session, so they know to pick another —
// used both when a practitioner actively declines and when 24 hours pass with no response.
async function notifyHrOfDecline(gs: { id: number; company_id: number; session_type: string; start_time: string | Date }) {
  try {
    const { sendEmail } = await import("../lib/email");
    const hrRows = await db.execute(sql`SELECT email FROM hr_users WHERE company_id = ${gs.company_id}`);
    const when = new Date(gs.start_time).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    for (const row of hrRows.rows as { email: string }[]) {
      await sendEmail(
        row.email,
        "A practitioner is unavailable for your group session",
        `<p>The practitioner for your "${gs.session_type}" group session on ${when} is unavailable.</p>
<p>Please choose another practitioner to schedule this session.</p>`,
      );
    }
  } catch (err) {
    logger.error({ err, groupSessionId: gs.id }, "Failed to notify HR of a declined group session");
  }
}

// Called on a timer from index.ts. Any pending request whose 24-hour window has passed with
// no response is treated as a decline, and HR is told the same way.
export async function expireOverdueGroupSessionRequests(): Promise<void> {
  try {
    const overdue = await db.execute(sql`
      UPDATE group_sessions
      SET status = 'declined', decline_reason = 'No response within 24 hours', decide_by = NULL
      WHERE status = 'pending' AND decide_by IS NOT NULL AND decide_by < NOW()
      RETURNING id, company_id, session_type, start_time
    `);
    for (const gs of overdue.rows as any[]) {
      await notifyHrOfDecline(gs);
    }
  } catch (err) {
    logger.error({ err }, "Failed to expire overdue group session requests");
  }
}

export default router;
