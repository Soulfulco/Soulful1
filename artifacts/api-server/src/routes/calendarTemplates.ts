import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { addWeeks, addDays, startOfWeek, setHours, setMinutes, nextDay } from "date-fns";

const router = Router();

// List all active templates with their sessions
router.get("/calendar-templates", async (_req, res) => {
  try {
    const templates = await db.execute(sql`
      SELECT t.*,
        json_agg(
          json_build_object(
            'id', s.id, 'sessionType', s.session_type, 'specialism', s.specialism,
            'weekNumber', s.week_number, 'dayOfWeek', s.day_of_week,
            'startTime', s.start_time, 'durationMinutes', s.duration_minutes,
            'description', s.description, 'maxAttendees', s.max_attendees
          ) ORDER BY s.week_number, s.day_of_week
        ) AS sessions
      FROM calendar_templates t
      LEFT JOIN calendar_template_sessions s ON s.template_id = t.id
      WHERE t.is_active = true
      GROUP BY t.id
      ORDER BY t.id
    `);
    res.json(templates.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Schedule a template for a company → creates practitioner booking requests
router.post("/calendar-templates/:id/schedule", async (req, res) => {
  try {
    const { companyId, startDate, locationType = "virtual" } = req.body;
    if (!companyId || !startDate) {
      return res.status(400).json({ error: "companyId and startDate are required" });
    }

    const templateId = Number(req.params.id);
    const sessionsResult = await db.execute(sql`
      SELECT * FROM calendar_template_sessions WHERE template_id = ${templateId} ORDER BY week_number, day_of_week
    `);
    const sessions = sessionsResult.rows as any[];
    if (!sessions.length) return res.status(404).json({ error: "Template not found or has no sessions" });

    const programmeStart = new Date(startDate);
    const created: number[] = [];

    for (const session of sessions) {
      // Calculate the actual date: start of programme week + (week_number - 1) weeks + day_of_week offset
      const weekStart = addWeeks(programmeStart, session.week_number - 1);
      // day_of_week: 1=Mon, 2=Tue ... 5=Fri
      const sessionDate = addDays(weekStart, session.day_of_week - 1);
      const [hours, minutes] = session.start_time.split(":").map(Number);
      sessionDate.setHours(hours, minutes, 0, 0);

      const insertResult = await db.execute(sql`
        INSERT INTO practitioner_booking_requests
          (company_id, template_id, session_type, specialism, requested_date,
           duration_minutes, max_attendees, location_type, notes, status)
        VALUES
          (${Number(companyId)}, ${templateId}, ${session.session_type}, ${session.specialism},
           ${sessionDate.toISOString()}, ${session.duration_minutes}, ${session.max_attendees},
           ${locationType}, ${session.description ?? null}, 'open')
        RETURNING id
      `);
      created.push((insertResult.rows[0] as any).id);
    }

    res.status(201).json({ ok: true, requestsCreated: created.length, requestIds: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to schedule template" });
  }
});

// List booking requests (HR: own company; public practitioner view: by specialism/status)
router.get("/booking-requests", async (req, res) => {
  try {
    const { companyId, specialism, status } = req.query;

    const result = await db.execute(sql`
      SELECT
        br.*,
        c.name AS company_name,
        ct.name AS template_name,
        ct.theme AS template_theme,
        ct.colour AS template_colour,
        p.name AS accepted_by_name,
        p.email AS accepted_by_email
      FROM practitioner_booking_requests br
      JOIN companies c ON c.id = br.company_id
      LEFT JOIN calendar_templates ct ON ct.id = br.template_id
      LEFT JOIN practitioners p ON p.id = br.accepted_by_practitioner_id
      WHERE 1=1
        ${companyId ? sql`AND br.company_id = ${Number(companyId)}` : sql``}
        ${specialism ? sql`AND br.specialism = ${String(specialism)}` : sql``}
        ${status ? sql`AND br.status = ${String(status)}` : sql``}
      ORDER BY br.requested_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch booking requests" });
  }
});

// Practitioner accepts a booking request
router.post("/booking-requests/:id/accept", async (req, res) => {
  try {
    const { practitionerEmail } = req.body;
    if (!practitionerEmail) return res.status(400).json({ error: "practitionerEmail required" });

    const pResult = await db.execute(sql`
      SELECT id FROM practitioners WHERE email = ${practitionerEmail.toLowerCase().trim()} AND is_active = true
    `);
    const practitioner = pResult.rows[0] as { id: number } | undefined;
    if (!practitioner) return res.status(404).json({ error: "No active practitioner found with that email" });

    // Check request exists and is open
    const reqResult = await db.execute(sql`
      SELECT * FROM practitioner_booking_requests WHERE id = ${Number(req.params.id)}
    `);
    const request = reqResult.rows[0] as any;
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "open") return res.status(409).json({ error: "This request is no longer open" });

    // Create group session automatically
    const endTime = new Date(new Date(request.requested_date).getTime() + request.duration_minutes * 60000);
    const gsResult = await db.execute(sql`
      INSERT INTO group_sessions
        (company_id, practitioner_id, session_type, start_time, end_time,
         max_attendees, location_type, notes, status)
      VALUES
        (${request.company_id}, ${practitioner.id}, ${request.session_type},
         ${new Date(request.requested_date).toISOString()}, ${endTime.toISOString()},
         ${request.max_attendees}, ${request.location_type},
         ${request.notes ?? null}, 'scheduled')
      RETURNING id
    `);
    const groupSessionId = (gsResult.rows[0] as any).id;

    // Update request
    await db.execute(sql`
      UPDATE practitioner_booking_requests
      SET status = 'accepted', accepted_by_practitioner_id = ${practitioner.id},
          group_session_id = ${groupSessionId}, updated_at = NOW()
      WHERE id = ${Number(req.params.id)}
    `);

    res.json({ ok: true, groupSessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to accept request" });
  }
});

// Practitioner declines a booking request
router.post("/booking-requests/:id/decline", async (req, res) => {
  try {
    await db.execute(sql`
      UPDATE practitioner_booking_requests
      SET status = 'declined', updated_at = NOW()
      WHERE id = ${Number(req.params.id)} AND status = 'open'
    `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to decline request" });
  }
});

export default router;
