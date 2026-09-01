import { pgTable, serial, integer, text, timestamp, numeric, unique, pgEnum } from "drizzle-orm/pg-core";
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

// Wellbeing Action Plan: a structured quarterly form HR fills in directly
// (not a document upload) — short/long-term absence, cost, and retention,
// so Soulful can show its own impact on these figures over time. One row
// per company per quarter.
export const wellbeingActionPlansTable = pgTable(
  "wellbeing_action_plans",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    // e.g. "2026-Q3" — kept as a simple sortable string rather than a date,
    // since this represents a whole quarter, not a specific day.
    quarter: text("quarter").notNull(),
    shortTermAbsenceDays: numeric("short_term_absence_days", { precision: 10, scale: 1 }).notNull(),
    longTermAbsenceDays: numeric("long_term_absence_days", { precision: 10, scale: 1 }).notNull(),
    absenceCostGbp: numeric("absence_cost_gbp", { precision: 10, scale: 2 }),
    retentionRatePct: numeric("retention_rate_pct", { precision: 5, scale: 2 }),
    submittedBy: text("submitted_by"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // One entry per company per quarter — resubmitting the same quarter
    // should update the existing row, not create a duplicate.
    uniqueCompanyQuarter: unique().on(table.companyId, table.quarter),
  }),
);

export const insertWellbeingActionPlanSchema = createInsertSchema(wellbeingActionPlansTable).omit({
  id: true,
  submittedAt: true,
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
