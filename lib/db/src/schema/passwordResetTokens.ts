// lib/db/src/schema/passwordResetTokens.ts
import { pgTable, serial, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("reset_account_type", [
  "hr", "practitioner", "employee", "admin",
]);

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  accountType: accountTypeEnum("account_type").notNull(),
  accountId: text("account_id").notNull(), // stored as text since it's an int for most but could vary
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});