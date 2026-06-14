import { getUncachableStripeClient } from "./stripeClient";
import { db } from "@workspace/db";
import { subscriptionPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

/**
 * Idempotent seed: creates/updates a Stripe product + price for each row in the
 * app's `subscription_plans` table, then writes the Stripe IDs back to the table.
 *
 * Stripe is the source of truth for products/prices; the app table keeps a
 * pointer (stripeProductId/stripePriceId) so the existing plans UI keeps working.
 *
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-stripe-products.ts
 */
function intervalFor(billingCycle: string): "month" | "year" {
  return billingCycle === "annual" ? "year" : "month";
}

async function seed() {
  const stripe = await getUncachableStripeClient();
  const plans = await db.select().from(subscriptionPlansTable);
  console.log(`Found ${plans.length} app plans to sync to Stripe...`);

  for (const plan of plans) {
    const interval = intervalFor(plan.billingCycle);
    const unitAmount = Math.round(Number(plan.priceGbp) * 100);
    const metadata: Record<string, string> = {
      appPlanId: String(plan.id),
      planType: plan.planType,
      billingCycle: plan.billingCycle,
      maxBookings: plan.maxBookings != null ? String(plan.maxBookings) : "",
      features: (plan.features ?? []).join(" | ").slice(0, 490),
    };

    // ---- Product (reuse stored id when present) ----
    let product: Stripe.Product | null = null;
    if (plan.stripeProductId) {
      try {
        const existing = await stripe.products.retrieve(plan.stripeProductId);
        if (!existing.deleted) {
          product = await stripe.products.update(plan.stripeProductId, {
            name: plan.name,
            description: plan.description,
            metadata,
            active: true,
          });
        }
      } catch {
        product = null;
      }
    }
    // If we have no stored id (or it was stale), look the product up by its
    // appPlanId metadata before creating, so re-running without DB ids does not
    // create duplicate Stripe products.
    if (!product) {
      try {
        const found = await stripe.products.search({
          query: `active:'true' AND metadata['appPlanId']:'${plan.id}'`,
          limit: 1,
        });
        const match = found.data[0];
        if (match) {
          product = await stripe.products.update(match.id, {
            name: plan.name,
            description: plan.description,
            metadata,
            active: true,
          });
        }
      } catch {
        product = null;
      }
    }
    if (!product) {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata,
      });
    }

    // ---- Price (immutable; reuse only when amount/interval/currency match) ----
    let priceId = plan.stripePriceId;
    let reuse = false;
    if (priceId) {
      try {
        const existing = await stripe.prices.retrieve(priceId);
        reuse =
          existing.active &&
          existing.unit_amount === unitAmount &&
          existing.currency === "gbp" &&
          existing.recurring?.interval === interval &&
          existing.product === product.id;
      } catch {
        reuse = false;
      }
    }
    if (!reuse) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: unitAmount,
        currency: "gbp",
        recurring: { interval },
        metadata: { appPlanId: String(plan.id) },
      });
      priceId = price.id;
      await stripe.products.update(product.id, { default_price: price.id });
    }

    await db
      .update(subscriptionPlansTable)
      .set({ stripeProductId: product.id, stripePriceId: priceId })
      .where(eq(subscriptionPlansTable.id, plan.id));

    console.log(
      `✓ ${plan.name} (#${plan.id}) → product ${product.id}, price ${priceId} (£${plan.priceGbp}/${interval})`,
    );
  }

  console.log("Done. Webhooks/backfill will sync these into the stripe schema.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
