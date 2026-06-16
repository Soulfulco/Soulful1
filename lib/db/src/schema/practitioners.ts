import { pgTable, serial, text, numeric, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "inactive", "trial"]);

export const practitionersTable = pgTable("practitioners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  specialism: text("specialism").notNull(),
  bio: text("bio").notNull(),
  sessionRateGbp: numeric("session_rate_gbp", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").notNull().default("trial"),
  avatarUrl: text("avatar_url"),
  location: text("location"),
  qualifications: text("qualifications"),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
  totalReviews: integer("total_reviews").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id"),
  googleRefreshToken: text("google_refresh_token"),
  googleEmail: text("google_email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPractitionerSchema = createInsertSchema(practitionersTable).omit({ id: true, createdAt: true, averageRating: true, totalReviews: true });
export type InsertPractitioner = z.infer<typeof insertPractitionerSchema>;
export type Practitioner = typeof practitionersTable.$inferSelect;
