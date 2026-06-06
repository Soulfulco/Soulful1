import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const locationTypeEnum = pgEnum("location_type", ["office", "studio", "outdoor", "virtual", "hotel"]);

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  postcode: text("postcode").notNull(),
  capacity: integer("capacity").notNull(),
  description: text("description").notNull(),
  type: locationTypeEnum("type").notNull(),
  imageUrl: text("image_url"),
  amenities: text("amenities").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLocationSchema = createInsertSchema(locationsTable).omit({ id: true, createdAt: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationsTable.$inferSelect;
