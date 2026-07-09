import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { companiesTable, companyReferralsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "../lib/roles";
import { ensureReferralCode, resolveReferralCode, REFERRAL_REWARD_GBP } from "../lib/referrals";

const router = Router();

async function getHrCompanyId(req: Request): Promise<number | null> {
  if (!req.isAuthenticated()) return null;
  const uid = req.user?.id ?? "";
  if (!uid.startsWith("hr:")) return null;
  const hrId = parseInt(uid.slice(3));
  if (Number.isNaN(hrId)) return null;
  const result = await db.execute(
    sql`SELECT company_id FROM hr_users WHERE id = ${hrId} AND is_active = true`,
  );
  const row = result.rows[0] as { company_id?: number } | undefined;
  return row?.company_id ?? null;
}

// GET /companies/:id/referrals — a company's own referral code, its referral
// history, and total rewards earned. HR may only view their own company.
router.get("/companies/:id/referrals", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!isAdmin(req)) {
      const hrCompanyId = await getHrCompanyId(req);
      if (hrCompanyId !== id) return res.status(403).json({ error: "Forbidden" });
    }

    const referralCode = await ensureReferralCode(id);

    const referrals = await db
      .select({
        id: companyReferralsTable.id,
        referredCompanyId: companyReferralsTable.referredCompanyId,
        referredCompanyName: companiesTable.name,
        status: companyReferralsTable.status,
        rewardAmountGbp: companyReferralsTable.rewardAmountGbp,
        createdAt: companyReferralsTable.createdAt,
        rewardedAt: companyReferralsTable.rewardedAt,
      })
      .from(companyReferralsTable)
      .innerJoin(companiesTable, eq(companiesTable.id, companyReferralsTable.referredCompanyId))
      .where(eq(companyReferralsTable.referrerCompanyId, id))
      .orderBy(companyReferralsTable.createdAt);

    const totalEarnedGbp = referrals
      .filter((r) => r.status === "rewarded")
      .reduce((sum, r) => sum + (r.rewardAmountGbp ?? 0), 0);

    res.json({
      referralCode,
      rewardAmountGbp: REFERRAL_REWARD_GBP,
      totalEarnedGbp,
      referrals: referrals.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        rewardedAt: r.rewardedAt ? r.rewardedAt.toISOString() : null,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to load referral programme" });
  }
});

// GET /referrals/resolve/:code — public lookup used by signup forms to show
// "You were referred by <company>" before submitting.
router.get("/referrals/resolve/:code", async (req, res) => {
  try {
    const referrer = await resolveReferralCode(req.params.code);
    if (!referrer) return res.status(404).json({ error: "Referral code not found" });
    res.json({ companyName: referrer.name });
  } catch {
    res.status(500).json({ error: "Failed to resolve referral code" });
  }
});

export default router;
