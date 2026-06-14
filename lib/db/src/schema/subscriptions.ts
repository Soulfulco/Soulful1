import { pgTable, serial, text, numeric, integer, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { practitionersTable } from "./practitioners";
import { companiesTable } from "./companies";

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "annual"]);
export const planTypeEnum = pgEnum("plan_type", ["corporate", "practitioner"]);
export const subStatusEnum = pgEnum("sub_status", ["active", "cancelled", "past_due"]);

export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  priceGbp: numeric("price_gbp", { precision: 10, scale: 2 }).notNull(),
  billingCycle: billingCycleEnum("billing_cycle").notNull(),
  description: text("description").notNull(),
  features: text("features").array().notNull(),
  planType: planTypeEnum("plan_type").notNull(),
  maxBookings: integer("max_bookings"),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
});

export const companySubscriptionsTable = pgTable("company_subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  planId: integer("plan_id").notNull().references(() => subscriptionPlansTable.id),
  status: subStatusEnum("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
});

export const practitionerSubscriptionsTable = pgTable("practitioner_subscriptions", {
  id: serial("id").primaryKey(),
  practitionerId: integer("practitioner_id").notNull().references(() => practitionersTable.id),
  planId: integer("plan_id").notNull().references(() => subscriptionPlansTable.id),
  status: subStatusEnum("sub_status").notNull().default("active"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
});

export const insertCompanySubscriptionSchema = createInsertSchema(companySubscriptionsTable).omit({ id: true, startDate: true });
export const insertPractitionerSubscriptionSchema = createInsertSchema(practitionerSubscriptionsTable).omit({ id: true, startDate: true });
export type InsertCompanySubscription = z.infer<typeof insertCompanySubscriptionSchema>;
export type InsertPractitionerSubscription = z.infer<typeof insertPractitionerSubscriptionSchema>;
