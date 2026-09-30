import { pgTable, serial, integer, text, timestamp, unique, numeric } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { practitionersTable } from "./practitioners";
import { employeesTable } from "./employees";
import { timeSlotsTable } from "./timeslots";

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
  // A practitioner has 24 hours to accept or decline a pending request; null once decided.
  decideBy: timestamp("decide_by"),
  declineReason: text("decline_reason"),
  // Links a group session to the practitioner's own published availability, so it
  // can't be double-booked against a 1:1 booking of the same slot.
  timeSlotId: integer("time_slot_id").references(() => timeSlotsTable.id),
  // The flat group rate charged for this session, and the practitioner's commission
  // rate at the time it was booked — both captured so a later rate change never
  // rewrites the price of a session that's already scheduled.
  priceGbp: numeric("price_gbp", { precision: 10, scale: 2 }),
  commissionRatePct: numeric("commission_rate_pct", { precision: 5, scale: 2 }),
  payoutStatus: text("payout_status"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
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
