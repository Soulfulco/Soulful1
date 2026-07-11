import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * True once a free-tier company's 1-week trial has passed without
 * upgrading to a paid plan. Companies that started on a paid plan have
 * trialEndsAt = null and are never locked by this check.
 */
export async function isTrialLocked(companyId: number): Promise<boolean> {
  const [company] = await db
    .select({
      subscriptionStatus: companiesTable.subscriptionStatus,
      trialEndsAt: companiesTable.trialEndsAt,
    })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);

  if (!company || !company.trialEndsAt) return false;
  if (company.subscriptionStatus !== "trial") return false;
  return company.trialEndsAt.getTime() < Date.now();
}

export const TRIAL_LOCKED_MESSAGE =
  "Your free trial has ended. Upgrade to a paid plan to keep using this feature.";