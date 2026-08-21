import { Resend } from "resend";
import { logger } from "./logger";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set.");
    }
    client = new Resend(apiKey);
  }
  return client;
}

// Soulful's verified sending domain in Resend. Update if the address
// convention changes — this is used as the "From" on every email.
const FROM_ADDRESS = "Soulful <noreply@soulfulco.uk>";

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const resend = getClient();
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    if (result.error) {
      throw new Error(result.error.message);
    }
  } catch (err) {
    logger.error({ err, to, subject }, "Failed to send email");
    throw err;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #1a1a1a;">Reset your password</h2>
      <p style="color: #444; line-height: 1.5;">
        We received a request to reset your Soulful password. Click the button below to choose a new one.
        This link expires in 1 hour.
      </p>
      <a href="${resetUrl}" style="display: inline-block; background: #6b7c5f; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
        Reset password
      </a>
      <p style="color: #888; font-size: 13px; line-height: 1.5;">
        If you didn't request this, you can safely ignore this email — your password won't be changed.
      </p>
    </div>
  `;
  await sendEmail(to, "Reset your Soulful password", html);
}
