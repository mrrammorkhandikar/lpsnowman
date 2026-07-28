import pLimit from "p-limit";
import { db } from "../db";
import { loads } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { getLocations } from "./intutrack-client";

/** Max parallel IntuTrack calls per refresh (lower = less API/DB contention with user traffic). */
const parsedConcurrency = Number.parseInt(process.env.INTUTRACK_REFRESH_CONCURRENCY || "3", 10);
const REFRESH_CONCURRENCY = Number.isFinite(parsedConcurrency)
  ? Math.min(10, Math.max(1, parsedConcurrency))
  : 3;
const limit = pLimit(REFRESH_CONCURRENCY);

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

type TriptrackLocationPoint = {
  lat: number;
  lng: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | number | null;
};

function extractTriptrackItems(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as any).result)) return (raw as any).result;
  return [];
}

function mapItemToTriptrackPoint(item: any): TriptrackLocationPoint | null {
  if (!item || !Array.isArray(item.loc) || item.loc.length < 2) return null;
  const [lat, lng] = item.loc;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    lat,
    lng,
    createdAt: item.createdAt ?? null,
    updatedAt: item.updatedAt ?? null,
    address: item.address ?? null,
    city: item.city ?? null,
    state: item.state ?? null,
    pincode: item.pincode ?? null,
  };
}

async function updateLoadTriptrackLocations(row: { id: string }, points: TriptrackLocationPoint[]) {
  await db
    .update(loads)
    .set({ triptrackLocations: points as any })
    .where(eq(loads.id, row.id));
}

/** Module-level guard — prevents concurrent background refreshes from stacking up. */
let _refreshInProgress = false;

/**
 * Schedule a background IntuTrack location refresh if one isn't already running.
 * Safe to call from any route handler — runs after the current event-loop tick so
 * it never blocks the calling HTTP response.
 */
export function scheduleIntuTrackRefresh(): void {
  if (_refreshInProgress) return;
  setImmediate(() => {
    if (_refreshInProgress) return;
    _refreshInProgress = true;
    refreshTriptrackLocationsForAllLoads()
      .catch((err) => {
        console.error("[IntuTrack] Scheduled refresh failed:", err);
      })
      .finally(() => {
        _refreshInProgress = false;
      });
  });
}

export async function refreshTriptrackLocationsForAllLoads() {
  console.log("[IntuTrack] refreshTriptrackLocationsForAllLoads: starting refresh");
  // Find all loads that have a triptrack_id set
  const rows = await db
    .select({
      id: loads.id,
      triptrackId: loads.triptrackId,
    })
    .from(loads)
    .where(sql`${loads.triptrackId} IS NOT NULL AND ${loads.triptrackId} <> ''`);

  console.log("[IntuTrack] refreshTriptrackLocationsForAllLoads: found loads with triptrack_id =", rows.length);

  type Row = { id: string; triptrackId: string | null };
  const processOne = async (row: Row): Promise<number> => {
    const tripId = row.triptrackId;
    if (!tripId) return 0;
    try {
      const raw = await getLocations(tripId);
      const items = extractTriptrackItems(raw);
      const points = items
        .map(mapItemToTriptrackPoint)
        .filter((p): p is TriptrackLocationPoint => p !== null);

      await updateLoadTriptrackLocations(row, points);

      console.log(
        "[IntuTrack] refreshTriptrackLocationsForAllLoads: updated load",
        row.id,
        "tripId",
        tripId,
        "points=",
        points.length,
      );
      return 1;
    } catch (error) {
      console.error("Failed to refresh IntuTrack locations for load", row.id, "tripId", tripId, error);
      return 0;
    }
  };

  // Process in chunks and yield between chunks so the event loop can serve HTTP requests
  // (avoids long stretches where only IntuTrack + DB work runs, which correlates with 504s).
  const chunkSize = Math.max(REFRESH_CONCURRENCY * 2, 6);
  let updated = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map((row) => limit(() => processOne(row))));
    updated += chunkResults.reduce((a, b) => a + b, 0);
    await yieldEventLoop();
  }

  console.log("[IntuTrack] refreshTriptrackLocationsForAllLoads: finished - totalLoadsWithTripId =", rows.length, "updatedLoads =", updated);
  return { totalLoadsWithTripId: rows.length, updatedLoads: updated };
}

