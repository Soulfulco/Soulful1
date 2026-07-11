import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { practitionersTable } from "./practitioners";
import { employeesTable } from "./employees";

export const groupSessionsTable = pgTable("group_sessions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  practitionerId: integer("practitioner_id").notNull().references(() => practitionersTable.id),
  sessionType: text("session_type").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  maxAttendees: integer("max_attendees").notNull().default(20),
  locationType: text("location_type").notNull().default("at_office"),
  locationDescription: text("location_description"),
  notes: text("notes"),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupSessionAttendeesTable = pgTable("group_session_attendees", {
  id: serial("id").primaryKey(),
  groupSessionId: integer("group_session_id").notNull().references(() => groupSessionsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  employeeName: text("employee_name").notNull(),
  employeeEmail: text("employee_email").notNull(),
  signedUpAt: timestamp("signed_up_at").notNull().defaultNow(),
  employeeGoogleEventId: text("employee_google_event_id"),
}, (table) => [
  unique().on(table.groupSessionId, table.employeeEmail),
]);

export type GroupSession = typeof groupSessionsTable.$inferSelect;
export type GroupSessionAttendee = typeof groupSessionAttendeesTable.$inferSelect;
