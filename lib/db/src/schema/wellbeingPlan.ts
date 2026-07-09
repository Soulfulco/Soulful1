import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

export const wellbeingRequirementKeys = [
  "volunteering",
  "one_on_one",
  "group_session",
  "mood_checkin",
  "modality_suggestion",
  "social_calendar",
] as const;
export type WellbeingRequirementKey = (typeof wellbeingRequirementKeys)[number];

export const wellbeingRequirementSourceEnum = pgEnum("wellbeing_requirement_source", ["auto", "manual"]);

export const wellbeingActionPlansTable = pgTable("wellbeing_action_plans", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  uploadedBy: text("uploaded_by"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWellbeingActionPlanSchema = createInsertSchema(wellbeingActionPlansTable).omit({
  id: true,
  uploadedAt: true,
});
export type InsertWellbeingActionPlan = z.infer<typeof insertWellbeingActionPlanSchema>;
export type WellbeingActionPlan = typeof wellbeingActionPlansTable.$inferSelect;

export const wellbeingRequirementLogTable = pgTable("wellbeing_requirement_log", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  requirementKey: text("requirement_key").notNull(),
  source: wellbeingRequirementSourceEnum("source").notNull().default("manual"),
  recordedBy: text("recorded_by"),
  note: text("note"),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWellbeingRequirementLogSchema = createInsertSchema(wellbeingRequirementLogTable).omit({
  id: true,
  completedAt: true,
});
export type InsertWellbeingRequirementLog = z.infer<typeof insertWellbeingRequirementLogSchema>;
export type WellbeingRequirementLog = typeof wellbeingRequirementLogTable.$inferSelect;
