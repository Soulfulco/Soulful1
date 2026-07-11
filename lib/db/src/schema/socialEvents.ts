import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

export const socialEventsTable = pgTable("social_events", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("social"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location").notNull().default(""),
  locationUrl: text("location_url"),
  organiserName: text("organiser_name").notNull().default("HR Team"),
  maxAttendees: integer("max_attendees"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const socialEventRsvpsTable = pgTable("social_event_rsvps", {
  id: serial("id").primaryKey(),
  socialEventId: integer("social_event_id").notNull().references(() => socialEventsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  employeeName: text("employee_name").notNull(),
  employeeEmail: text("employee_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  employeeGoogleEventId: text("employee_google_event_id"),
}, (table) => [
  unique().on(table.socialEventId, table.employeeEmail),
]);

export type SocialEvent = typeof socialEventsTable.$inferSelect;
export type SocialEventRsvp = typeof socialEventRsvpsTable.$inferSelect;