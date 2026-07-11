import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { practitionersTable } from "./practitioners";
import { companiesTable } from "./companies";

export const sessionProposalsTable = pgTable("session_proposals", {
  id: serial("id").primaryKey(),
  practitionerId: integer("practitioner_id").notNull().references(() => practitionersTable.id, { onDelete: "cascade" }),
  sessionType: text("session_type").notNull(),
  description: text("description"),
  proposedDate: timestamp("proposed_date").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  maxAttendees: integer("max_attendees").notNull().default(20),
  locationType: text("location_type").notNull().default("virtual"),
  locationDescription: text("location_description"),
  format: text("format").notNull().default("group"),
  priceModel: text("price_model").notNull().default("included"),
  targetCompanyId: integer("target_company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_session_proposals_practitioner").on(table.practitionerId),
  index("idx_session_proposals_status").on(table.status),
]);

export type SessionProposal = typeof sessionProposalsTable.$inferSelect;