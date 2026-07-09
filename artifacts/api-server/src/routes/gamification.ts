import { Router, type IRouter } from "express";
import { getGamificationSummary } from "../lib/gamification";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /employees/:id/gamification — private points/level/badges summary for one employee.
router.get("/employees/:id/gamification", async (req, res) => {
  const employeeId = Number(req.params.id);
  if (!employeeId) return res.status(400).json({ error: "Invalid employee id" });
  try {
    const summary = await getGamificationSummary(employeeId);
    res.json(summary);
  } catch (err) {
    logger.error({ err, employeeId }, "Failed to load gamification summary");
    res.status(500).json({ error: "Failed to load gamification summary" });
  }
});

export default router;
