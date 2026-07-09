import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const companyReferralStatusEnum = pgEnum("company_referral_status", ["pending", "rewarded"]);

export const companyReferralsTable = pgTable("company_referrals", {
  id: serial("id").primaryKey(),
  referrerCompanyId: integer("referrer_company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  referredCompanyId: integer("referred_company_id")
    .notNull()
    .unique()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  status: companyReferralStatusEnum("status").notNull().default("pending"),
  rewardAmountGbp: integer("reward_amount_gbp"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
});

export const insertCompanyReferralSchema = createInsertSchema(companyReferralsTable).omit({
  id: true,
  createdAt: true,
  rewardedAt: true,
});
export type InsertCompanyReferral = z.infer<typeof insertCompanyReferralSchema>;
export type CompanyReferral = typeof companyReferralsTable.$inferSelect;
