import { db, companiesTable, companyReferralsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

// Flat reward paid to the referring company once a referred company signs a
// paid contract and its first real payment is confirmed by Stripe.
export const REFERRAL_REWARD_GBP = 250;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

function randomCode(length = 7): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

// Generates a unique referral code, retrying on the rare collision.
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const [existing] = await db
      .select({ id: companiesTable.id })
      .from(companiesTable)
      .where(eq(companiesTable.referralCode, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique referral code");
}

// Defensive: ensures a company has a referral code, generating one on demand
// for companies created before this feature existed.
export async function ensureReferralCode(companyId: number): Promise<string> {
  const [company] = await db
    .select({ referralCode: companiesTable.referralCode })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);
  if (company?.referralCode) return company.referralCode;
  const code = await generateUniqueReferralCode();
  await db.update(companiesTable).set({ referralCode: code }).where(eq(companiesTable.id, companyId));
  return code;
}

// Looks up the referring company for a code entered at signup. Returns null
// for an unknown/blank code (caller should treat it as "no referral").
export async function resolveReferralCode(
  code: string | null | undefined,
): Promise<{ id: number; name: string } | null> {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed) return null;
  const [company] = await db
    .select({ id: companiesTable.id, name: companiesTable.name })
    .from(companiesTable)
    .where(eq(companiesTable.referralCode, trimmed))
    .limit(1);
  return company ?? null;
}

// Records a pending referral link between a referrer and a newly-created
// company. Safe to call even if a row already exists (e.g. retried signup).
export async function recordReferral(referrerCompanyId: number, referredCompanyId: number): Promise<void> {
  if (referrerCompanyId === referredCompanyId) return;
  await db
    .insert(companyReferralsTable)
    .values({ referrerCompanyId, referredCompanyId, status: "pending" })
    .onConflictDoNothing({ target: companyReferralsTable.referredCompanyId });
}

// Called when a company's subscription becomes genuinely active via a real
// Stripe event (contract signed + first payment taken). Marks any pending
// referral for that company as rewarded. Idempotent — a referral can only be
// rewarded once, since it flips from 'pending' to 'rewarded'.
export async function rewardReferralIfEligible(referredCompanyId: number): Promise<void> {
  const result = await db
    .update(companyReferralsTable)
    .set({ status: "rewarded", rewardedAt: sql`now()`, rewardAmountGbp: REFERRAL_REWARD_GBP })
    .where(
      sql`${companyReferralsTable.referredCompanyId} = ${referredCompanyId} AND ${companyReferralsTable.status} = 'pending'`,
    )
    .returning({ id: companyReferralsTable.id, referrerCompanyId: companyReferralsTable.referrerCompanyId });

  if (result.length > 0) {
    logger.info(
      { referredCompanyId, referrerCompanyId: result[0].referrerCompanyId, amountGbp: REFERRAL_REWARD_GBP },
      "Referral reward granted",
    );
  }
}
