import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { awardPoints } from "../lib/gamification";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildIcs(events: {
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  organiser: string;
  url?: string;
}[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Soulful//Wellbeing Social Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Soulful Wellbeing",
    "X-WR-TIMEZONE:Europe/London",
  ];

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}@soulful.co.uk`,
      `DTSTART:${toIcsDate(ev.start)}`,
      `DTEND:${toIcsDate(ev.end)}`,
      `SUMMARY:${escapeIcs(ev.summary)}`,
      `DESCRIPTION:${escapeIcs(ev.description)}`,
      `LOCATION:${escapeIcs(ev.location)}`,
      `ORGANIZER;CN=${escapeIcs(ev.organiser)}:mailto:noreply@soulfulco.uk`,
      `STATUS:CONFIRMED`,
      `TRANSP:OPAQUE`,
      ev.url ? `URL:${ev.url}` : "",
      "END:VEVENT",
    ).filter(Boolean);
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// List social events (filter by companyId if provided)
router.get("/social-events", async (req, res) => {
  try {
    const { companyId } = req.query as { companyId?: string };
    let result;
    if (companyId) {
      result = await db.execute(sql`
        SELECT se.*, c.name AS company_name,
          COUNT(ser.id)::int AS rsvp_count
        FROM social_events se
        JOIN companies c ON c.id = se.company_id
        LEFT JOIN social_event_rsvps ser ON ser.social_event_id = se.id
        WHERE se.company_id = ${Number(companyId)}
        GROUP BY se.id, c.name
        ORDER BY se.start_time ASC
      `);
    } else {
      result = await db.execute(sql`
        SELECT se.*, c.name AS company_name,
          COUNT(ser.id)::int AS rsvp_count
        FROM social_events se
        JOIN companies c ON c.id = se.company_id
        LEFT JOIN social_event_rsvps ser ON ser.social_event_id = se.id
        GROUP BY se.id, c.name
        ORDER BY se.start_time ASC
      `);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list social events" });
  }
});

// Create a social event (HR)
router.post("/social-events", async (req, res) => {
  try {
    const {
      companyId, title, description, eventType,
      startTime, endTime, location, locationUrl,
      organiserName, maxAttendees,
    } = req.body;
    const result = await db.execute(sql`
      INSERT INTO social_events
        (company_id, title, description, event_type, start_time, end_time,
         location, location_url, organiser_name, max_attendees)
      VALUES
        (${companyId}, ${title}, ${description ?? null}, ${eventType ?? "social"},
         ${startTime}::timestamp, ${endTime}::timestamp,
         ${location ?? ""}, ${locationUrl ?? null},
         ${organiserName ?? "HR Team"}, ${maxAttendees ?? null})
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create social event" });
  }
});

// Get single event + RSVPs
router.get("/social-events/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const event = await db.execute(sql`
      SELECT se.*, c.name AS company_name,
        COUNT(ser.id)::int AS rsvp_count
      FROM social_events se
      JOIN companies c ON c.id = se.company_id
      LEFT JOIN social_event_rsvps ser ON ser.social_event_id = se.id
      WHERE se.id = ${id}
      GROUP BY se.id, c.name
    `);
    if (!event.rows[0]) return res.status(404).json({ error: "Not found" });
    const rsvps = await db.execute(sql`
      SELECT * FROM social_event_rsvps WHERE social_event_id = ${id} ORDER BY created_at ASC
    `);
    res.json({ ...event.rows[0], rsvps: rsvps.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to get social event" });
  }
});

// Delete / cancel a social event (HR)
router.patch("/social-events/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, title, description, location, locationUrl, maxAttendees } = req.body;
    const result = await db.execute(sql`
      UPDATE social_events
      SET
        status = COALESCE(${status ?? null}, status),
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        location = COALESCE(${location ?? null}, location),
        location_url = COALESCE(${locationUrl ?? null}, location_url),
        max_attendees = COALESCE(${maxAttendees ?? null}, max_attendees)
      WHERE id = ${id}
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update social event" });
  }
});

// Employee RSVPs to a social event
router.post("/social-events/:id/rsvp", async (req, res) => {
  try {
    const socialEventId = Number(req.params.id);
    const { employeeId, employeeName, employeeEmail } = req.body;

    // Check capacity if set
    const evRow = await db.execute(sql`SELECT max_attendees FROM social_events WHERE id = ${socialEventId}`);
    if (!evRow.rows[0]) return res.status(404).json({ error: "Event not found" });
    const maxAtt = (evRow.rows[0] as any).max_attendees;
    if (maxAtt !== null) {
      const cnt = await db.execute(sql`SELECT COUNT(*)::int AS c FROM social_event_rsvps WHERE social_event_id = ${socialEventId}`);
      if ((cnt.rows[0] as any).c >= maxAtt) return res.status(409).json({ error: "Event is full" });
    }

    const result = await db.execute(sql`
      INSERT INTO social_event_rsvps (social_event_id, employee_id, employee_name, employee_email)
      VALUES (${socialEventId}, ${employeeId ?? null}, ${employeeName}, ${employeeEmail})
      ON CONFLICT (social_event_id, employee_email) DO NOTHING
      RETURNING *
    `);
    res.status(201).json(result.rows[0] ?? { message: "Already RSVPed" });

    if (result.rows[0] && employeeId) {
      awardPoints(Number(employeeId), "social_rsvp").catch((err) =>
        logger.error({ err, employeeId }, "Failed to award gamification points for social RSVP"),
      );
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to RSVP" });
  }
});

// Employee cancels RSVP
router.delete("/social-events/:id/rsvp", async (req, res) => {
  try {
    const socialEventId = Number(req.params.id);
    const { employeeEmail } = req.body;
    await db.execute(sql`
      DELETE FROM social_event_rsvps
      WHERE social_event_id = ${socialEventId} AND employee_email = ${employeeEmail}
    `);
    res.json({ message: "RSVP cancelled" });
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel RSVP" });
  }
});

// Download .ics for a single event
router.get("/social-events/:id/calendar.ics", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await db.execute(sql`
      SELECT se.*, c.name AS company_name
      FROM social_events se
      JOIN companies c ON c.id = se.company_id
      WHERE se.id = ${id}
    `);
    if (!row.rows[0]) return res.status(404).json({ error: "Not found" });
    const ev = row.rows[0] as any;
    const ics = buildIcs([{
      uid: `social-${ev.id}`,
      summary: ev.title,
      description: ev.description ?? "",
      location: ev.location ?? "",
      start: new Date(ev.start_time),
      end: new Date(ev.end_time),
      organiser: ev.organiser_name ?? "HR Team",
      url: ev.location_url ?? undefined,
    }]);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="soulful-event-${id}.ics"`);
    res.send(ics);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate calendar file" });
  }
});

// Download .ics for all upcoming company events (subscribe feed)
router.get("/social-events/company/:companyId/calendar.ics", async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const rows = await db.execute(sql`
      SELECT se.*, c.name AS company_name
      FROM social_events se
      JOIN companies c ON c.id = se.company_id
      WHERE se.company_id = ${companyId}
        AND se.status = 'active'
        AND se.start_time >= NOW()
      ORDER BY se.start_time ASC
    `);
    const ics = buildIcs(
      rows.rows.map((ev: any) => ({
        uid: `social-${ev.id}`,
        summary: ev.title,
        description: ev.description ?? "",
        location: ev.location ?? "",
        start: new Date(ev.start_time),
        end: new Date(ev.end_time),
        organiser: ev.organiser_name ?? "HR Team",
        url: ev.location_url ?? undefined,
      }))
    );
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="soulful-wellbeing-calendar.ics"`);
    res.send(ics);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate calendar" });
  }
});

export default router;
