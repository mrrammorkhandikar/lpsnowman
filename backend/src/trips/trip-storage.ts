import { desc, eq } from "drizzle-orm";
import { tripDb } from "./trip-db";
import { trips, type InsertTrip, type Trip } from "./trip-schema";

export async function createTrip(input: InsertTrip): Promise<Trip> {
  const [created] = await tripDb.insert(trips).values(input).returning();
  return created;
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  const [trip] = await tripDb.select().from(trips).where(eq(trips.id, id)).limit(1);
  return trip;
}

export async function getTripByIntutrackId(intutrackTripId: string): Promise<Trip | undefined> {
  const [trip] = await tripDb
    .select()
    .from(trips)
    .where(eq(trips.intutrackTripId, intutrackTripId))
    .limit(1);
  return trip;
}

export async function listTrips(): Promise<Trip[]> {
  return tripDb.select().from(trips).orderBy(desc(trips.startedAt));
}

export async function updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined> {
  const [updated] = await tripDb.update(trips).set(updates).where(eq(trips.id, id)).returning();
  return updated;
}
