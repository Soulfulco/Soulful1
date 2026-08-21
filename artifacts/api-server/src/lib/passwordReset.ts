import crypto from "crypto";
import { db } from "@workspace/db";
import { passwordResetTokensTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export type ResetAccountType = "hr" | "practitioner" | "employee" | "admin";

export async function createResetToken(
  accountType: ResetAccountType,
  accountId: string | number,
  email: string,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.insert(passwordResetTokensTable).values({
    accountType,
    accountId: String(accountId),
    email,
    token,
    expiresAt,
  });
  return token;
}

export interface ValidResetToken {
  id: number;
  accountType: ResetAccountType;
  accountId: string;
  email: string;
}

// Returns the token record if it's valid (exists, not used, not expired),
// or null otherwise. Does not mark it used — call markTokenUsed separately
// once the password has actually been changed.
export async function verifyResetToken(token: string): Promise<ValidResetToken | null> {
  const [row] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        eq(passwordResetTokensTable.used, false),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    accountType: row.accountType as ResetAccountType,
    accountId: row.accountId,
    email: row.email,
  };
}

export async function markTokenUsed(id: number): Promise<void> {
  await db.update(passwordResetTokensTable).set({ used: true }).where(eq(passwordResetTokensTable.id, id));
}
