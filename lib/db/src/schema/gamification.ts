import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";

export const gamificationActivityTypes = [
  "wellbeing_checkin",
  "booking_1on1",
  "group_session",
  "social_rsvp",
  "profile_complete",
  "streak_bonus",
  "monthly_milestone",
] as const;
export type GamificationActivityType = (typeof gamificationActivityTypes)[number];

export const badgeKeys = [
  "first_step",
  "profile_done",
  "first_checkin",
  "team_player",
  "social_butterfly",
  "group_regular",
  "mindful",
  "consistent",
  "monthly_warrior",
  "five_sessions",
  "ten_sessions",
  "six_month_veteran",
] as const;
export type BadgeKey = (typeof badgeKeys)[number];

export const gamificationActivityTable = pgTable("gamification_activity", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGamificationActivitySchema = createInsertSchema(gamificationActivityTable).omit({
  id: true,
  createdAt: true,
});
export type InsertGamificationActivity = z.infer<typeof insertGamificationActivitySchema>;
export type GamificationActivity = typeof gamificationActivityTable.$inferSelect;

export const employeeBadgesTable = pgTable(
  "employee_badges",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "cascade" }),
    badgeKey: text("badge_key").notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.employeeId, t.badgeKey)],
);

export const insertEmployeeBadgeSchema = createInsertSchema(employeeBadgesTable).omit({
  id: true,
  earnedAt: true,
});
export type InsertEmployeeBadge = z.infer<typeof insertEmployeeBadgeSchema>;
export type EmployeeBadge = typeof employeeBadgesTable.$inferSelect;
