import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { awardPoints } from "../lib/gamification";
import { logRequirementSafe } from "../lib/wellbeingRequirements";
import { logger } from "../lib/logger";
import { isTrialLocked, TRIAL_LOCKED_MESSAGE } from "../lib/trialGate";

const router = Router();

// List group sessions for a company (with attendee count + practitioner name)
router.get("/group-sessions", async (req, res) => {
  try {
    const { companyId } = req.query as { companyId?: string };
    if (companyId && (await isTrialLocked(Number(companyId)))) {
      return res.status(402).json({ error: TRIAL_LOCKED_MESSAGE, locked: true });
    }
    let query: ReturnType<typeof sql>;
    if (companyId) {
      query = sql`
        SELECT gs.*, p.name AS practitioner_name, p.specialism AS practitioner_specialism,
          COUNT(gsa.id)::int AS attendee_count
        FROM group_sessions gs
        JOIN practitioners p ON p.id = gs.practitioner_id
        LEFT JOIN group_session_attendees gsa ON gsa.group_session_id = gs.id
        WHERE gs.company_id = ${Number(companyId)}
        GROUP BY gs.id, p.name, p.specialism
        ORDER BY gs.start_time ASC
      `;
    } else {
      query = sql`
        SELECT gs.*, p.name AS practitioner_name, p.specialism AS practitioner_specialism,
          c.name AS company_name,
          COUNT(gsa.id)::int AS attendee_count
        FROM group_sessions gs
        JOIN practitioners p ON p.id = gs.practitioner_id
        JOIN companies c ON c.id = gs.company_id
        LEFT JOIN group_session_attendees gsa ON gsa.group_session_id = gs.id
        GROUP BY gs.id, p.name, p.specialism, c.name
        ORDER BY gs.start_time ASC
      `;
    }
    const result = await db.execute(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list group sessions" });
  }
});

// HR creates a group session
router.post("/group-sessions", async (req, res) => {
  try {
    const {
      companyId, practitionerId, sessionType,
      startTime, endTime, maxAttendees,
      locationType, locationDescription, notes,
    } = req.body;
    const result = await db.execute(sql`
      INSERT INTO group_sessions
        (company_id, practitioner_id, session_type, start_time, end_time,
         max_attendees, location_type, location_description, notes)
      VALUES
        (${companyId}, ${practitionerId}, ${sessionType},
         ${startTime}::timestamp, ${endTime}::timestamp,
         ${maxAttendees ?? 20}, ${locationType ?? "at_office"},
         ${locationDescription ?? null}, ${notes ?? null})
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create group session" });
  }
});

// Get a single group session with attendees
router.get("/group-sessions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const session = await db.execute(sql`
      SELECT gs.*, p.name AS practitioner_name, p.specialism AS practitioner_specialism
      FROM group_sessions gs
      JOIN practitioners p ON p.id = gs.practitioner_id
      WHERE gs.id = ${id}
    `);
    if (!session.rows[0]) return res.status(404).json({ error: "Not found" });
    const attendees = await db.execute(sql`
      SELECT * FROM group_session_attendees WHERE group_session_id = ${id} ORDER BY signed_up_at ASC
    `);
    res.json({ ...session.rows[0], attendees: attendees.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to get group session" });
  }
});

// Employee signs up to a group session
router.post("/group-sessions", async (req, res) => {
  try {
    const {
      companyId, practitionerId, sessionType,
      startTime, endTime, maxAttendees,
      locationType, locationDescription, notes,
    } = req.body;
    if (companyId && (await isTrialLocked(Number(companyId)))) {
      return res.status(402).json({ error: TRIAL_LOCKED_MESSAGE, locked: true });
    }
    const result = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM group_session_attendees WHERE group_session_id = ${groupSessionId}`);
    const currentCount = (countResult.rows[0] as any).cnt;
    if (currentCount >= (session.rows[0] as any).max_attendees) {
      return res.status(409).json({ error: "Session is full" });
    }

    const result = await db.execute(sql`
      INSERT INTO group_session_attendees (group_session_id, employee_id, employee_name, employee_email)
      VALUES (${groupSessionId}, ${employeeId ?? null}, ${employeeName}, ${employeeEmail})
      ON CONFLICT (group_session_id, employee_email) DO NOTHING
      RETURNING *
    `);
    res.status(201).json(result.rows[0] ?? { message: "Already signed up" });

    if (result.rows[0] && employeeId) {
      awardPoints(Number(employeeId), "group_session").catch((err) =>
        logger.error({ err, employeeId }, "Failed to award gamification points for group session"),
      );
      logRequirementSafe(Number(employeeId), "group_session", "auto");
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sign up" });
  }
});

// Employee withdraws from a group session
router.delete("/group-sessions/:id/attend", async (req, res) => {
  try {
    const groupSessionId = Number(req.params.id);
    const { employeeEmail } = req.body;
    await db.execute(sql`
      DELETE FROM group_session_attendees
      WHERE group_session_id = ${groupSessionId} AND employee_email = ${employeeEmail}
    `);
    res.json({ message: "Withdrawn" });
  } catch (err) {
    res.status(500).json({ error: "Failed to withdraw" });
  }
});

// Cancel a group session (HR)
router.patch("/group-sessions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const result = await db.execute(sql`
      UPDATE group_sessions SET status = ${status} WHERE id = ${id} RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update group session" });
  }
});

export default router;
