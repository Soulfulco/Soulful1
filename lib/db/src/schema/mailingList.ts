import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mailingListSubscribersTable = pgTable(
  "mailing_list_subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    source: text("source").notNull().default("website"),
    notes: text("notes"),
    hubspotContactId: text("hubspot_contact_id"),
    syncedAt: timestamp("synced_at"),
    syncError: text("sync_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_mailing_list_email").on(sql`lower(${t.email})`)]
);

export const insertMailingListSubscriberSchema = createInsertSchema(mailingListSubscribersTable).omit({
  id: true,
  hubspotContactId: true,
  syncedAt: true,
  syncError: true,
  createdAt: true,
});
export type InsertMailingListSubscriber = z.infer<typeof insertMailingListSubscriberSchema>;
export type MailingListSubscriber = typeof mailingListSubscribersTable.$inferSelect;
