import { Router, type IRouter } from "express";
import { db, mailingListSubscribersTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { isAdmin } from "../lib/roles";
import { syncSubscriberToHubspot } from "../lib/hubspot";

const router: IRouter = Router();

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /mailing-list/subscribe — public: anyone can join a mailing list.
router.post("/mailing-list/subscribe", async (req, res) => {
  try {
    const { email, name, source } = req.body as { email?: string; name?: string; source?: string };
    if (!email || !emailRe.test(email.trim())) {
      return res.status(400).json({ error: "A valid email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name?.trim() || null;
    const normalizedSource = source?.trim() || "website";

    const result = await db.execute(sql`
      INSERT INTO mailing_list_subscribers (email, name, source)
      VALUES (${normalizedEmail}, ${normalizedName}, ${normalizedSource})
      ON CONFLICT (lower(email)) DO UPDATE
      SET name = COALESCE(${normalizedName}, mailing_list_subscribers.name),
          source = COALESCE(${normalizedSource}, mailing_list_subscribers.source)
      RETURNING id, email, name, source, hubspot_contact_id AS "hubspotContactId", synced_at AS "syncedAt", sync_error AS "syncError", created_at AS "createdAt"
    `);
    const subscriber = (result as unknown as { rows: (typeof mailingListSubscribersTable.$inferSelect)[] }).rows[0];

    // Fire-and-forget HubSpot sync so the signup response isn't blocked on an external API.
    syncSubscriberToHubspot(subscriber).catch((err) => {
      logger.error({ err, subscriberId: subscriber.id }, "HubSpot sync failed");
    });

    res.status(201).json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to subscribe to mailing list");
    res.status(500).json({ error: "Could not subscribe. Please try again." });
  }
});

// GET /mailing-list/subscribers — admin only.
router.get("/mailing-list/subscribers", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const rows = await db
      .select()
      .from(mailingListSubscribersTable)
      .orderBy(desc(mailingListSubscribersTable.createdAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to list mailing list subscribers");
    res.status(500).json({ error: "Failed to list subscribers" });
  }
});

// POST /mailing-list/subscribers/:id/resync — admin only, retry a failed HubSpot sync.
router.post("/mailing-list/subscribers/:id/resync", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const id = Number(req.params.id);
    const [subscriber] = await db
      .select()
      .from(mailingListSubscribersTable)
      .where(eq(mailingListSubscribersTable.id, id));
    if (!subscriber) return res.status(404).json({ error: "Subscriber not found" });
    await syncSubscriberToHubspot(subscriber);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to resync subscriber to HubSpot");
    res.status(500).json({ error: "Failed to sync to HubSpot" });
  }
});

export default router;
