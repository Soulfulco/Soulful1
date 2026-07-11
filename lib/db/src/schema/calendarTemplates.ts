import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const calendarTemplatesTable = pgTable("calendar_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  theme: text("theme").notNull(),
  durationWeeks: integer("duration_weeks").notNull().default(4),
  icon: text("icon").notNull().default("Sparkles"),
  colour: text("colour").notNull().default("#dae8bc"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const calendarTemplateSessionsTable = pgTable("calendar_template_sessions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => calendarTemplatesTable.id, { onDelete: "cascade" }),
  sessionType: text("session_type").notNull(),
  specialism: text("specialism").notNull(),
  weekNumber: integer("week_number").notNull().default(1),
  dayOfWeek: integer("day_of_week").notNull().default(1),
  startTime: text("start_time").notNull().default("12:00"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  maxAttendees: integer("max_attendees").notNull().default(20),
  description: text("description"),
});

export type CalendarTemplate = typeof calendarTemplatesTable.$inferSelect;
export type CalendarTemplateSession = typeof calendarTemplateSessionsTable.$inferSelect;
