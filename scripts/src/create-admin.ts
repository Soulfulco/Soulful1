import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import crypto from "crypto";

function hashAdminPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ");

  if (!email || !password || !name) {
    console.error('Usage: pnpm --filter @workspace/scripts exec tsx src/create-admin.ts "you@example.com" "your-password" "Your Name"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const [created] = await db
    .insert(adminUsersTable)
    .values({
      email: email.toLowerCase().trim(),
      passwordHash: hashAdminPassword(password),
      name,
    })
    .returning({ id: adminUsersTable.id, email: adminUsersTable.email, name: adminUsersTable.name });

  console.log("Admin account created:", created);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to create admin:", err);
  process.exit(1);
});
