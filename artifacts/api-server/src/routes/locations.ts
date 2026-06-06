import { Router } from "express";
import { db } from "@workspace/db";
import { locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/locations", async (_req, res) => {
  try {
    const locations = await db.select().from(locationsTable);
    res.json(locations.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch {
    res.status(500).json({ error: "Failed to list locations" });
  }
});

router.post("/locations", async (req, res) => {
  try {
    const { name, address, city, postcode, capacity, description, type, imageUrl, amenities } = req.body;
    const [location] = await db
      .insert(locationsTable)
      .values({ name, address, city, postcode, capacity, description, type, imageUrl, amenities: amenities ?? [] })
      .returning();
    res.status(201).json({ ...location, createdAt: location.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to create location" });
  }
});

router.get("/locations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [location] = await db.select().from(locationsTable).where(eq(locationsTable.id, id));
    if (!location) return res.status(404).json({ error: "Not found" });
    res.json({ ...location, createdAt: location.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to get location" });
  }
});

router.patch("/locations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, city, postcode, capacity, description, type, imageUrl, amenities, isActive } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (postcode !== undefined) updates.postcode = postcode;
    if (capacity !== undefined) updates.capacity = capacity;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (amenities !== undefined) updates.amenities = amenities;
    if (isActive !== undefined) updates.isActive = isActive;
    const [location] = await db.update(locationsTable).set(updates).where(eq(locationsTable.id, id)).returning();
    if (!location) return res.status(404).json({ error: "Not found" });
    res.json({ ...location, createdAt: location.createdAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Failed to update location" });
  }
});

router.delete("/locations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(locationsTable).where(eq(locationsTable.id, id));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete location" });
  }
});

export default router;
