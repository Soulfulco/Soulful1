import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const hrUsersTable = pgTable("hr_users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("hr_manager"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type HrUser = typeof hrUsersTable.$inferSelect;
