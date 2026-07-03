import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { practitionersTable } from "./practitioners";
import { companiesTable } from "./companies";
import { timeSlotsTable } from "./timeslots";

export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "completed", "cancelled"]);

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  practitionerId: integer("practitioner_id").notNull().references(() => practitionersTable.id),
  timeSlotId: integer("time_slot_id").notNull().references(() => timeSlotsTable.id),
  status: bookingStatusEnum("status").notNull().default("pending"),
  sessionType: text("session_type").notNull(),
  employeeName: text("employee_name").notNull(),
  employeeEmail: text("employee_email").notNull(),
  notes: text("notes"),
  googleEventId: text("google_event_id"),
  stripeSessionId: text("stripe_session_id"),
  paymentType: text("payment_type").notNull().default("corporate"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, status: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
