import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { practitionersTable } from "./practitioners";

export const googleBusyBlocksTable = pgTable("google_busy_blocks", {
  id: serial("id").primaryKey(),
  practitionerId: integer("practitioner_id")
    .notNull()
    .references(() => practitionersTable.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

export type GoogleBusyBlock = typeof googleBusyBlocksTable.$inferSelect;
