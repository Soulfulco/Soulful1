import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { practitionersTable } from "./practitioners";
import { companiesTable } from "./companies";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  practitionerId: integer("practitioner_id").notNull().references(() => practitionersTable.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  reviewerName: text("reviewer_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
