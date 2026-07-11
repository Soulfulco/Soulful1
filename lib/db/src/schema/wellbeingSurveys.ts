import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const wellbeingSurveysTable = pgTable("wellbeing_surveys", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  surveyType: text("survey_type").notNull(),
  moodScore: integer("mood_score").notNull(),
  connectionScore: integer("connection_score").notNull(),
  productivityScore: integer("productivity_score").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_wellbeing_surveys_employee").on(table.employeeId, table.createdAt),
]);

export type WellbeingSurvey = typeof wellbeingSurveysTable.$inferSelect;