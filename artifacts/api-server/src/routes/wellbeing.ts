import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { awardPoints } from "../lib/gamification";
import { logger } from "../lib/logger";

const router = Router();

// Submit a survey (initial or monthly)
router.post("/wellbeing/surveys", async (req, res) => {
  try {
    const { employeeId, surveyType, moodScore, connectionScore, productivityScore, notes } = req.body;

    if (!employeeId || !surveyType || !moodScore || !connectionScore || !productivityScore) {
      return res.status(400).json({ error: "employeeId, surveyType, moodScore, connectionScore, productivityScore are required" });
    }
    if (!["initial", "monthly"].includes(surveyType)) {
      return res.status(400).json({ error: "surveyType must be 'initial' or 'monthly'" });
    }
    for (const score of [moodScore, connectionScore, productivityScore]) {
      if (score < 1 || score > 10) return res.status(400).json({ error: "Scores must be between 1 and 10" });
    }

    const result = await db.execute(sql`
      INSERT INTO wellbeing_surveys (employee_id, survey_type, mood_score, connection_score, productivity_score, notes)
      VALUES (${employeeId}, ${surveyType}, ${moodScore}, ${connectionScore}, ${productivityScore}, ${notes ?? null})
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);

    if (surveyType === "monthly") {
      awardPoints(Number(employeeId), "wellbeing_checkin").catch((err) =>
        logger.error({ err, employeeId }, "Failed to award gamification points for wellbeing check-in"),
      );
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit survey" });
  }
});

// Get survey history for an employee
router.get("/wellbeing/surveys", async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) return res.status(400).json({ error: "employeeId is required" });

    const result = await db.execute(sql`
      SELECT * FROM wellbeing_surveys
      WHERE employee_id = ${Number(employeeId)}
      ORDER BY created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch surveys" });
  }
});

// Check if employee needs to complete a survey
// Returns: { required: boolean, type: 'initial'|'monthly'|null, lastSurveyAt: string|null }
router.get("/wellbeing/surveys/status", async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) return res.status(400).json({ error: "employeeId is required" });

    const result = await db.execute(sql`
      SELECT survey_type, created_at
      FROM wellbeing_surveys
      WHERE employee_id = ${Number(employeeId)}
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const latest = result.rows[0] as { survey_type: string; created_at: string } | undefined;

    if (!latest) {
      return res.json({ required: true, type: "initial", lastSurveyAt: null });
    }

    const lastDate = new Date(latest.created_at);
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    // Monthly check-in due if 28+ days since last survey
    if (daysSince >= 28) {
      return res.json({ required: true, type: "monthly", lastSurveyAt: latest.created_at });
    }

    res.json({ required: false, type: null, lastSurveyAt: latest.created_at });
  } catch (err) {
    res.status(500).json({ error: "Failed to check survey status" });
  }
});

// HR: get aggregated wellbeing data for a company
router.get("/wellbeing/company/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    // Monthly averages across all employees
    const trends = await db.execute(sql`
      SELECT
        DATE_TRUNC('month', ws.created_at) AS month,
        ROUND(AVG(ws.mood_score), 1) AS avg_mood,
        ROUND(AVG(ws.connection_score), 1) AS avg_connection,
        ROUND(AVG(ws.productivity_score), 1) AS avg_productivity,
        COUNT(DISTINCT ws.employee_id) AS respondents
      FROM wellbeing_surveys ws
      JOIN employees e ON e.id = ws.employee_id
      WHERE e.company_id = ${Number(companyId)}
      GROUP BY DATE_TRUNC('month', ws.created_at)
      ORDER BY month ASC
    `);

    // Latest scores per employee
    const latest = await db.execute(sql`
      SELECT DISTINCT ON (ws.employee_id)
        ws.employee_id,
        e.name AS employee_name,
        ws.mood_score,
        ws.connection_score,
        ws.productivity_score,
        ws.created_at
      FROM wellbeing_surveys ws
      JOIN employees e ON e.id = ws.employee_id
      WHERE e.company_id = ${Number(companyId)}
      ORDER BY ws.employee_id, ws.created_at DESC
    `);

    // Overall averages
    const overall = await db.execute(sql`
      SELECT
        ROUND(AVG(ws.mood_score), 1) AS avg_mood,
        ROUND(AVG(ws.connection_score), 1) AS avg_connection,
        ROUND(AVG(ws.productivity_score), 1) AS avg_productivity,
        COUNT(*) AS total_responses,
        COUNT(DISTINCT ws.employee_id) AS total_respondents
      FROM wellbeing_surveys ws
      JOIN employees e ON e.id = ws.employee_id
      WHERE e.company_id = ${Number(companyId)}
        AND ws.created_at >= NOW() - INTERVAL '90 days'
    `);

    res.json({
      trends: trends.rows,
      latestByEmployee: latest.rows,
      overall: overall.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch company wellbeing data" });
  }
});

export default router;
