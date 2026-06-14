import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const specialismsTable = pgTable("specialisms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSpecialismSchema = createInsertSchema(specialismsTable).omit({ id: true, createdAt: true });
export type InsertSpecialism = z.infer<typeof insertSpecialismSchema>;
export type Specialism = typeof specialismsTable.$inferSelect;
