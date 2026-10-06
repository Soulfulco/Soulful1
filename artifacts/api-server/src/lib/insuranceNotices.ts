import { db, practitionersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { baseUrl } from "./url";
import { daysUntilExpiry } from "./insurance";

// How far ahead a practitioner is warned that their insurance is about to run out.
const REMINDER_DAYS = 30;

// Soulful's own address for the "this practitioner's insurance has expired" notice.
function adminNoticeAddress(): string {
  return process.env.ADMIN_NOTIFY_EMAIL || "enquiries@soulfulco.uk";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Emails practitioners about their insurance expiry date, once per expiry date:
//   - within 30 days of it: a reminder to the practitioner
//   - after it has passed: a notice to the practitioner, and to Soulful so someone can chase it
// Each is recorded against the expiry date it was sent for, so it isn't repeated on every run,
// and a renewed certificate with a new date starts the cycle again. Runs on a timer, never throws.
export async function sendInsuranceNotices(now: Date = new Date()): Promise<void> {
  try {
    const { sendEmail } = await import("./email");
    const rows = await db.select().from(practitionersTable).where(eq(practitionersTable.isActive, true));

    let portalUrl = "https://app.soulfulco.uk/practitioner/portal";
    try {
      portalUrl = `${baseUrl()}/practitioner/portal`;
    } catch {
      /* keep the default */
    }

    for (const p of rows) {
      try {
        const expiresOn = p.insuranceExpiresOn;
        const days = daysUntilExpiry(expiresOn, now);
        if (!expiresOn || days === null) continue;
        const name = escapeHtml(p.name);
        const when = formatDate(expiresOn);

        if (days < 0) {
          if (p.insuranceExpiredNoticeSentFor === expiresOn) continue;
          await sendEmail(
            p.email,
            "Your insurance has expired, so your Soulful profile is hidden",
            `<p>Hi ${name},</p>
<p>The insurance certificate on your Soulful profile expired on ${when}.</p>
<p>Until you add a new certificate and its expiry date, you can't take new bookings and your profile is hidden from the directory.</p>
<p><a href="${portalUrl}">Update your insurance in your portal</a></p>`,
          );
          // Recorded as soon as the practitioner has been told, so a problem emailing Soulful
          // below can't cause them to be emailed again on every run.
          await db
            .update(practitionersTable)
            .set({ insuranceExpiredNoticeSentFor: expiresOn })
            .where(eq(practitionersTable.id, p.id));
          try {
            await sendEmail(
              adminNoticeAddress(),
              `Insurance expired: ${p.name}`,
              `<p>${name} (${escapeHtml(p.email)}, ${escapeHtml(p.specialism)}) has insurance that expired on ${when}.</p>
<p>They are now hidden from the directory and can't take new bookings until they add a new certificate and expiry date. They have been emailed asking them to renew.</p>`,
            );
          } catch (err) {
            logger.error({ err, practitionerId: p.id }, "Failed to email Soulful about an expired insurance certificate");
          }
        } else if (days <= REMINDER_DAYS) {
          if (p.insuranceReminderSentFor === expiresOn) continue;
          await sendEmail(
            p.email,
            days === 0 ? "Your insurance expires today" : `Your insurance expires in ${days} day${days === 1 ? "" : "s"}`,
            `<p>Hi ${name},</p>
<p>The insurance certificate on your Soulful profile ${days === 0 ? "expires today" : `expires on ${when}`}.</p>
<p>To keep taking bookings and stay visible in the directory, upload your renewed certificate and enter its new expiry date in your portal. After ${when} you won't be able to take new bookings, and your profile will be hidden until you do.</p>
<p><a href="${portalUrl}">Update your insurance in your portal</a></p>`,
          );
          await db
            .update(practitionersTable)
            .set({ insuranceReminderSentFor: expiresOn })
            .where(eq(practitionersTable.id, p.id));
        }
      } catch (err) {
        // One practitioner's problem (for example an undeliverable address) must not stop the rest.
        logger.error({ err, practitionerId: p.id }, "Failed to send an insurance notice");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to run the insurance notices");
  }
}
