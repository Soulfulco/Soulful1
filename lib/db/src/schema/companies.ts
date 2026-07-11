import { pgTable, serial, text, integer, timestamp, pgEnum, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companySubscriptionStatusEnum = pgEnum("company_subscription_status", ["active", "inactive", "trial"]);

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  industry: text("industry").notNull(),
  employeeCount: integer("employee_count").notNull(),
  subscriptionStatus: companySubscriptionStatusEnum("subscription_status").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at"),
  logoUrl: text("logo_url"),
  contactName: text("contact_name"),
  totalBookings: integer("total_bookings").notNull().default(0),
  inviteCode: text("invite_code").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  referralCode: text("referral_code").unique(),
  referredByCompanyId: integer("referred_by_company_id").references((): AnyPgColumn => companiesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true, totalBookings: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
