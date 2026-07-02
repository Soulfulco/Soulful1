import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";

export const employeePreferencesTable = pgTable("employee_preferences", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .unique()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  themeColor: text("theme_color").notNull().default("sage"),
  avatarEmoji: text("avatar_emoji").notNull().default("🌿"),
  focusAreas: text("focus_areas")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  showGroupSessions: boolean("show_group_sessions").notNull().default(true),
  showSocialCalendar: boolean("show_social_calendar").notNull().default(true),
  showSelfFunded: boolean("show_self_funded").notNull().default(true),
  googleRefreshToken: text("google_refresh_token"),
  googleEmail: text("google_email"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const upsertEmployeePreferencesSchema = createInsertSchema(employeePreferencesTable).omit({
  id: true,
  googleRefreshToken: true,
  googleEmail: true,
  updatedAt: true,
});
export type UpsertEmployeePreferences = z.infer<typeof upsertEmployeePreferencesSchema>;
export type EmployeePreferences = typeof employeePreferencesTable.$inferSelect;
