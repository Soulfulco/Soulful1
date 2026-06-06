import { pgTable, serial, integer, timestamp, boolean, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { practitionersTable } from "./practitioners";

export const timeSlotsTable = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  practitionerId: integer("practitioner_id").notNull().references(() => practitionersTable.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isBooked: boolean("is_booked").notNull().default(false),
  sessionType: text("session_type"),
});

export const insertTimeSlotSchema = createInsertSchema(timeSlotsTable).omit({ id: true, isBooked: true });
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;
export type TimeSlot = typeof timeSlotsTable.$inferSelect;
