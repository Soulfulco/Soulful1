import { pgTable, serial, integer, text, numeric, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category"),
  city: text("city").notNull(),
  venue: text("venue").notNull(),
  address: text("address"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  capacity: integer("capacity"),
  priceGbp: numeric("price_gbp", { precision: 10, scale: 2 }).notNull().default("0"),
  imageUrl: text("image_url"),
  organizer: text("organizer"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventRegistrationStatusValues = ["registered", "pending", "cancelled"] as const;

export const eventRegistrationsTable = pgTable(
  "event_registrations",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    status: text("status").notNull().default("registered"),
    stripeSessionId: text("stripe_session_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_event_registrations_event").on(t.eventId),
    // Prevent duplicate active (registered/pending) registrations for the same
    // email on the same event. Cancelled rows are excluded so re-registration is possible.
    uniqueIndex("uq_event_reg_active_email")
      .on(t.eventId, sql`lower(${t.email})`)
      .where(sql`status IN ('registered','pending')`),
  ]
);

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;

export const insertEventRegistrationSchema = createInsertSchema(eventRegistrationsTable).omit({ id: true, createdAt: true });
export type InsertEventRegistration = z.infer<typeof insertEventRegistrationSchema>;
export type EventRegistration = typeof eventRegistrationsTable.$inferSelect;
