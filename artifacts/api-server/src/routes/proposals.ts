import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// List proposals (admin: all; filtered by status)
router.get("/proposals", async (req, res) => {
  try {
    const { status, practitionerId } = req.query;
    const result = await db.execute(sql`
      SELECT
        sp.*,
        p.name AS practitioner_name,
        p.email AS practitioner_email,
        p.specialism AS practitioner_specialism,
        p.avatar_url AS practitioner_avatar,
        c.name AS company_name
      FROM session_proposals sp
      JOIN practitioners p ON p.id = sp.practitioner_id
      LEFT JOIN companies c ON c.id = sp.target_company_id
      WHERE 1=1
        ${status ? sql`AND sp.status = ${String(status)}` : sql``}
        ${practitionerId ? sql`AND sp.practitioner_id = ${Number(practitionerId)}` : sql``}
      ORDER BY sp.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
});

// Get single proposal
router.get("/proposals/:id", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT sp.*, p.name AS practitioner_name, p.email AS practitioner_email,
        p.specialism AS practitioner_specialism, p.avatar_url AS practitioner_avatar,
        c.name AS company_name
      FROM session_proposals sp
      JOIN practitioners p ON p.id = sp.practitioner_id
      LEFT JOIN companies c ON c.id = sp.target_company_id
      WHERE sp.id = ${Number(req.params.id)}
    `);
    if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch proposal" });
  }
});

// Submit a proposal (practitioner-facing, public)
router.post("/proposals", async (req, res) => {
  try {
    const {
      practitionerEmail,
      sessionType, description,
      proposedDate, durationMinutes,
      maxAttendees, locationType,
      locationDescription, priceModel,
      targetCompanyId,
    } = req.body;

    if (!practitionerEmail || !sessionType || !proposedDate) {
      return res.status(400).json({ error: "practitionerEmail, sessionType, and proposedDate are required" });
    }

    // Look up practitioner by email
    const pResult = await db.execute(sql`
      SELECT id FROM practitioners WHERE email = ${practitionerEmail.toLowerCase().trim()} AND is_active = true
    `);
    const practitioner = pResult.rows[0] as { id: number } | undefined;
    if (!practitioner) {
      return res.status(404).json({ error: "No active practitioner account found with that email" });
    }

    const result = await db.execute(sql`
      INSERT INTO session_proposals
        (practitioner_id, session_type, description, proposed_date, duration_minutes,
         max_attendees, location_type, location_description, price_model, target_company_id)
      VALUES
        (${practitioner.id}, ${sessionType}, ${description ?? null}, ${proposedDate},
         ${durationMinutes ?? 60}, ${maxAttendees ?? 20},
         ${locationType ?? "virtual"}, ${locationDescription ?? null},
         ${priceModel ?? "included"}, ${targetCompanyId ?? null})
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit proposal" });
  }
});

// Approve a proposal → creates a group session automatically
router.post("/proposals/:id/approve", async (req, res) => {
  try {
    const { companyId, adminNotes } = req.body;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });

    const propResult = await db.execute(sql`
      SELECT * FROM session_proposals WHERE id = ${Number(req.params.id)}
    `);
    const proposal = propResult.rows[0] as any;
    if (!proposal) return res.status(404).json({ error: "Proposal not found" });
    if (proposal.status !== "pending") return res.status(409).json({ error: "Proposal is not pending" });

    // Create the group session
    const startTime = new Date(proposal.proposed_date);
    const endTime = new Date(startTime.getTime() + proposal.duration_minutes * 60000);

    const gsResult = await db.execute(sql`
      INSERT INTO group_sessions
        (company_id, practitioner_id, session_type, start_time, end_time,
         max_attendees, location_type, location_description, notes, status)
      VALUES
        (${Number(companyId)}, ${proposal.practitioner_id}, ${proposal.session_type},
         ${startTime.toISOString()}, ${endTime.toISOString()},
         ${proposal.max_attendees}, ${proposal.location_type},
         ${proposal.location_description ?? null},
         ${proposal.description ?? null}, 'scheduled')
      RETURNING id
    `);
    const groupSessionId = (gsResult.rows[0] as any).id;

    // Mark proposal as scheduled
    await db.execute(sql`
      UPDATE session_proposals
      SET status = 'scheduled', admin_notes = ${adminNotes ?? null},
          target_company_id = ${Number(companyId)}, updated_at = NOW()
      WHERE id = ${Number(req.params.id)}
    `);

    res.json({ ok: true, groupSessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve proposal" });
  }
});

// Reject a proposal
router.post("/proposals/:id/reject", async (req, res) => {
  try {
    const { adminNotes } = req.body;
    await db.execute(sql`
      UPDATE session_proposals
      SET status = 'rejected', admin_notes = ${adminNotes ?? null}, updated_at = NOW()
      WHERE id = ${Number(req.params.id)}
    `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reject proposal" });
  }
});

export default router;
