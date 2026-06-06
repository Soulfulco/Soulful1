import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, practitionersTable } from "@workspace/db";
import { eq, avg, count } from "drizzle-orm";

const router = Router();

router.post("/reviews", async (req, res) => {
  try {
    const { practitionerId, companyId, rating, comment, reviewerName } = req.body;
    const [review] = await db
      .insert(reviewsTable)
      .values({ practitionerId, companyId, rating, comment, reviewerName })
      .returning();

    // Update practitioner average rating
    const [stats] = await db
      .select({ avg: avg(reviewsTable.rating), count: count() })
      .from(reviewsTable)
      .where(eq(reviewsTable.practitionerId, practitionerId));

    if (stats) {
      await db
        .update(practitionersTable)
        .set({
          averageRating: String(Number(stats.avg).toFixed(2)),
          totalReviews: Number(stats.count),
        })
        .where(eq(practitionersTable.id, practitionerId));
    }

    res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create review" });
  }
});

export default router;
