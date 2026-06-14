import { db } from "@workspace/db";
import {
  companiesTable,
  practitionersTable,
  companySubscriptionsTable,
  practitionerSubscriptionsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./lib/logger";

type SubStatus = "active" | "cancelled" | "past_due";
type EntityStatus = "active" | "inactive" | "trial";

function mapStatuses(stripeStatus: string): { sub: SubStatus; entity: EntityStatus } {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return { sub: "active", entity: "active" };
    case "past_due":
    case "unpaid":
      return { sub: "past_due", entity: "inactive" };
    default:
      // canceled, incomplete, incomplete_expired, paused
      return { sub: "cancelled", entity: "inactive" };
  }
}

// Higher number = more authoritative. Used to pick the "current" subscription
// when an entity has multiple rows (e.g. an old canceled one + a new active one).
function statusPriority(stripeStatus: string): number {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return 3;
    case "past_due":
    case "unpaid":
      return 2;
    default:
      return 1;
  }
}

interface StripeSubRow {
  id: string;
  status: string;
  customer: string | null;
  metadata: Record<string, unknown> | null;
  created: number | null;
}

/**
 * Picks the single authoritative subscription for an entity from potentially
 * many rows. Prefers active/trialing over past_due over canceled; ties broken
 * by most-recently created. This makes reconciliation deterministic regardless
 * of row iteration order.
 */
function pickBest(rows: StripeSubRow[]): StripeSubRow {
  return rows.reduce((best, cur) => {
    const bp = statusPriority(best.status);
    const cp = statusPriority(cur.status);
    if (cp !== bp) return cp > bp ? cur : best;
    return (cur.created ?? 0) >= (best.created ?? 0) ? cur : best;
  });
}

/**
 * Reads subscriptions synced into the `stripe` schema and reconciles them
 * with the application's company/practitioner subscription tables, using the
 * metadata (appPlanId + appCompanyId/appPractitionerId) we set at checkout.
 *
 * Designed to be resilient: never throws, logs and returns on any failure
 * (e.g. the stripe schema not existing yet).
 */
export async function reconcileStripeToApp(): Promise<void> {
  let rows: StripeSubRow[];
  try {
    const result = await db.execute(
      sql`SELECT id, status, customer, metadata, created FROM stripe.subscriptions`,
    );
    rows = result.rows as unknown as StripeSubRow[];
  } catch (err) {
    logger.warn({ err }, "Stripe reconcile: could not read stripe.subscriptions (skipping)");
    return;
  }

  // Group rows by the app entity they belong to, then reconcile only the
  // authoritative subscription per entity.
  const companyGroups = new Map<number, StripeSubRow[]>();
  const practitionerGroups = new Map<number, StripeSubRow[]>();

  for (const row of rows) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const appPlanId = Number(metadata.appPlanId);
    if (!appPlanId || Number.isNaN(appPlanId)) continue;

    if (metadata.appCompanyId) {
      const companyId = Number(metadata.appCompanyId);
      if (!companyId || Number.isNaN(companyId)) continue;
      const list = companyGroups.get(companyId) ?? [];
      list.push(row);
      companyGroups.set(companyId, list);
    } else if (metadata.appPractitionerId) {
      const practitionerId = Number(metadata.appPractitionerId);
      if (!practitionerId || Number.isNaN(practitionerId)) continue;
      const list = practitionerGroups.get(practitionerId) ?? [];
      list.push(row);
      practitionerGroups.set(practitionerId, list);
    }
  }

  for (const [companyId, group] of companyGroups) {
    const row = pickBest(group);
    try {
      const appPlanId = Number((row.metadata as Record<string, unknown>).appPlanId);
      const { sub: subStatus, entity: entityStatus } = mapStatuses(row.status);

      await db
        .update(companiesTable)
        .set({
          subscriptionStatus: entityStatus,
          ...(row.customer ? { stripeCustomerId: row.customer } : {}),
        })
        .where(eq(companiesTable.id, companyId));

      const [existing] = await db
        .select({ id: companySubscriptionsTable.id })
        .from(companySubscriptionsTable)
        .where(eq(companySubscriptionsTable.companyId, companyId))
        .limit(1);

      if (existing) {
        await db
          .update(companySubscriptionsTable)
          .set({ planId: appPlanId, status: subStatus })
          .where(eq(companySubscriptionsTable.id, existing.id));
      } else {
        await db
          .insert(companySubscriptionsTable)
          .values({ companyId, planId: appPlanId, status: subStatus });
      }
    } catch (err) {
      logger.error({ err, subscriptionId: row.id }, "Stripe reconcile: failed for company");
    }
  }

  for (const [practitionerId, group] of practitionerGroups) {
    const row = pickBest(group);
    try {
      const appPlanId = Number((row.metadata as Record<string, unknown>).appPlanId);
      const { sub: subStatus, entity: entityStatus } = mapStatuses(row.status);

      await db
        .update(practitionersTable)
        .set({
          subscriptionStatus: entityStatus,
          ...(row.customer ? { stripeCustomerId: row.customer } : {}),
        })
        .where(eq(practitionersTable.id, practitionerId));

      const [existing] = await db
        .select({ id: practitionerSubscriptionsTable.id })
        .from(practitionerSubscriptionsTable)
        .where(eq(practitionerSubscriptionsTable.practitionerId, practitionerId))
        .limit(1);

      if (existing) {
        await db
          .update(practitionerSubscriptionsTable)
          .set({ planId: appPlanId, status: subStatus })
          .where(eq(practitionerSubscriptionsTable.id, existing.id));
      } else {
        await db
          .insert(practitionerSubscriptionsTable)
          .values({ practitionerId, planId: appPlanId, status: subStatus });
      }
    } catch (err) {
      logger.error({ err, subscriptionId: row.id }, "Stripe reconcile: failed for practitioner");
    }
  }
}
