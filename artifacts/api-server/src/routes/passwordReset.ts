import { Router } from "express";
import { db } from "@workspace/db";
import { hrUsersTable, practitionersTable, employeesTable, adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { hashAdminPassword } from "../lib/adminAuth";
import { createResetToken, verifyResetToken, markTokenUsed, ResetAccountType } from "../lib/passwordReset";
import { sendPasswordResetEmail } from "../lib/email";
import { baseUrl } from "../lib/url";
import { logger } from "../lib/logger";

const router = Router();

const ACCOUNT_TYPES: ResetAccountType[] = ["hr", "practitioner", "employee", "admin"];

async function findAccount(
  accountType: ResetAccountType,
  email: string,
): Promise<{ id: number; email: string } | null> {
  const normEmail = email.toLowerCase().trim();
  if (accountType === "hr") {
    const [row] = await db.select().from(hrUsersTable).where(eq(hrUsersTable.email, normEmail));
    return row ? { id: row.id, email: row.email } : null;
  }
  if (accountType === "practitioner") {
    const [row] = await db.select().from(practitionersTable).where(eq(practitionersTable.email, normEmail));
    return row ? { id: row.id, email: row.email } : null;
  }
  if (accountType === "employee") {
    const [row] = await db.select().from(employeesTable).where(eq(employeesTable.email, normEmail));
    return row ? { id: row.id, email: row.email } : null;
  }
  const [row] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, normEmail));
  return row ? { id: row.id, email: row.email } : null;
}

async function updatePassword(accountType: ResetAccountType, accountId: string, newPassword: string): Promise<void> {
  const id = Number(accountId);
  if (accountType === "hr") {
    await db.update(hrUsersTable).set({ passwordHash: bcrypt.hashSync(newPassword, 10) }).where(eq(hrUsersTable.id, id));
    return;
  }
  if (accountType === "practitioner") {
    await db.update(practitionersTable).set({ passwordHash: bcrypt.hashSync(newPassword, 10) }).where(eq(practitionersTable.id, id));
    return;
  }
  if (accountType === "employee") {
    await db.update(employeesTable).set({ passwordHash: bcrypt.hashSync(newPassword, 10) }).where(eq(employeesTable.id, id));
    return;
  }
  await db.update(adminUsersTable).set({ passwordHash: hashAdminPassword(newPassword) }).where(eq(adminUsersTable.id, id));
}

// POST /forgot-password  { accountType, email }
router.post("/forgot-password", async (req, res) => {
  try {
    const { accountType, email } = req.body as { accountType?: string; email?: string };
    if (!accountType || !email || !ACCOUNT_TYPES.includes(accountType as ResetAccountType)) {
      return res.status(400).json({ error: "accountType and email are required" });
    }
    const account = await findAccount(accountType as ResetAccountType, email);
    // Always return the same generic message whether or not the account
    // exists — this avoids leaking which emails have accounts on the platform.
    if (account) {
      const token = await createResetToken(accountType as ResetAccountType, account.id, account.email);
      const resetUrl = `${baseUrl()}/reset-password?token=${token}&type=${accountType}`;
      sendPasswordResetEmail(account.email, resetUrl).catch((err) =>
        logger.error({ err, email: account.email }, "Failed to send password reset email"),
      );
    }
    res.json({ ok: true, message: "If an account exists with that email, a reset link has been sent." });
  } catch (err) {
    logger.error({ err }, "Failed to process forgot-password request");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// POST /reset-password  { token, newPassword }
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword) {
      return res.status(400).json({ error: "token and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const record = await verifyResetToken(token);
    if (!record) {
      return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    }
    await updatePassword(record.accountType, record.accountId, newPassword);
    await markTokenUsed(record.id);
    res.json({ ok: true, message: "Password updated. You can now log in with your new password." });
  } catch (err) {
    logger.error({ err }, "Failed to reset password");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;