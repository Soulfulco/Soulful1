import { db, mailingListSubscribersTable, type MailingListSubscriber } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Syncs a mailing list subscriber to HubSpot as a contact.
 *
 * NOTE: The HubSpot connector has not been connected yet. Until it is, this
 * function is a no-op that leaves the subscriber stored locally only —
 * signups are never lost, they just aren't pushed to HubSpot yet. Once the
 * HubSpot connection is added, this will be wired up to actually upsert the
 * contact via the HubSpot API.
 */
export async function syncSubscriberToHubspot(subscriber: MailingListSubscriber): Promise<void> {
  logger.info(
    { subscriberId: subscriber.id, email: subscriber.email },
    "HubSpot not yet connected — subscriber stored locally only"
  );
}

export async function resyncAllSubscribers(): Promise<void> {
  const rows = await db.select().from(mailingListSubscribersTable);
  for (const row of rows) {
    await syncSubscriberToHubspot(row);
  }
}

export function isHubspotConnected(): boolean {
  return false;
}
