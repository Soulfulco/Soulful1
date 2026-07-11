import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { practitionersTable } from "./practitioners";
import { calendarTemplatesTable } from "./calendarTemplates";
import { groupSessionsTable } from "./groupSessions";

export const practitionerBookingRequestsTable = pgTable("practitioner_booking_requests", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  templateId: integer("template_id").references(() => calendarTemplatesTable.id, { onDelete: "set null" }),
  sessionType: text("session_type").notNull(),
  specialism: text("specialism").notNull(),
  requestedDate: timestamp("requested_date").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  maxAttendees: integer("max_attendees").notNull().default(20),
  locationType: text("location_type").notNull().default("virtual"),
  notes: text("notes"),
  status: text("status").notNull().default("open"),
  acceptedByPractitionerId: integer("accepted_by_practitioner_id").references(() => practitionersTable.id, { onDelete: "set null" }),
  groupSessionId: integer("group_session_id").references(() => groupSessionsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_booking_requests_company").on(table.companyId),
  index("idx_booking_requests_specialism").on(table.specialism),
  index("idx_booking_requests_status").on(table.status),
]);

export type PractitionerBookingRequest = typeof practitionerBookingRequestsTable.$inferSelect;