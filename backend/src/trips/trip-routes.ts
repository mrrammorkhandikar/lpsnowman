import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createTrip, getTripById, listTrips, updateTrip } from "./trip-storage";
import {
  endTrip as endTripRemote,
  generatePublicLink,
  getConsents,
  getLocations,
  startTrip as startTripRemote,
  submitTrip as submitTripRemote,
  updateTrip as updateTripRemote,
} from "./intutrack-client";

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const coordinateSchema = z.union([z.string(), z.number()]);

const startTripSchema = z
  .object({
    tel: z.string().min(1),
    truck_number: z.string().min(1),
    src_lat: coordinateSchema.optional(),
    src_lng: coordinateSchema.optional(),
    dest_lat: coordinateSchema.optional(),
    dest_lng: coordinateSchema.optional(),
    srcname: z.string().optional(),
    destname: z.string().optional(),
    invoice: z.string().optional(),
    eta_hrs: z.number().optional(),
    src: z.string().optional(),
    dest: z.union([z.string(), z.array(coordinateSchema)]).optional(),
    drops: z.array(z.unknown()).optional(),
    do_tracking: z.boolean().optional(),
    shipmentNumber: z.string().optional(),
  })
  .passthrough();

const updateTripSchema = z
  .object({
    tracking_state: z.enum(["START", "STOP"]).optional(),
    _id: z.string().optional(),
  })
  .passthrough();

const consentSchema = z.object({
  tel: z.string().min(1),
});

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function toDecimalString(value: number | undefined) {
  if (value === undefined) return undefined;
  return value.toString();
}

function parseLatLngFromString(value?: string) {
  if (!value) return {};
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 2) return {};
  const lat = toNumber(parts[0]);
  const lng = toNumber(parts[1]);
  return { lat, lng };
}

function extractTripId(response: any) {
  if (!response) return undefined;
  return response.tripId || response._id || response.id;
}

function buildIntutrackPayload(payload: Record<string, any>) {
  const {
    src_lat,
    src_lng,
    dest_lat,
    dest_lng,
    invoice,
    eta_hrs,
    src,
    dest,
    ...rest
  } = payload;
  const resolvedSrc = src || (src_lat !== undefined && src_lng !== undefined ? `${src_lat},${src_lng}` : undefined);
  const resolvedDest = dest || (dest_lat !== undefined && dest_lng !== undefined ? [String(dest_lat), String(dest_lng)] : undefined);
  const intutrackPayload: Record<string, unknown> = {
    ...rest,
    src: resolvedSrc,
    dest: resolvedDest,
  };
  if (eta_hrs !== undefined) intutrackPayload.eta_hrs = eta_hrs;
  if (invoice && !intutrackPayload.shipmentNumber) intutrackPayload.shipmentNumber = invoice;
  return intutrackPayload;
}

function extractCoordinates(payload: Record<string, any>) {
  let srcLat = toNumber(payload.src_lat);
  let srcLng = toNumber(payload.src_lng);
  let destLat = toNumber(payload.dest_lat);
  let destLng = toNumber(payload.dest_lng);

  if ((srcLat === undefined || srcLng === undefined) && typeof payload.src === "string") {
    const src = parseLatLngFromString(payload.src);
    srcLat = srcLat ?? src.lat;
    srcLng = srcLng ?? src.lng;
  }

  if ((destLat === undefined || destLng === undefined) && typeof payload.dest === "string") {
    const dest = parseLatLngFromString(payload.dest);
    destLat = destLat ?? dest.lat;
    destLng = destLng ?? dest.lng;
  }

  if ((destLat === undefined || destLng === undefined) && Array.isArray(payload.dest)) {
    destLat = destLat ?? toNumber(payload.dest[0]);
    destLng = destLng ?? toNumber(payload.dest[1]);
  }

  return {
    srcLat: toDecimalString(srcLat),
    srcLng: toDecimalString(srcLng),
    destLat: toDecimalString(destLat),
    destLng: toDecimalString(destLng),
  };
}

function normalizeLocations(data: any) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [data];
}

export function registerTripRoutes(app: Express) {
  app.post("/api/trips/start", requireAuth, async (req, res) => {
    try {
      const payload = startTripSchema.parse(req.body);
      const intutrackPayload = buildIntutrackPayload(payload);
      const response = await startTripRemote(intutrackPayload);
      const tripId = extractTripId(response);
      const { srcLat, srcLng, destLat, destLng } = extractCoordinates(payload);

      const created = await createTrip({
        intutrackTripId: tripId,
        truckNumber: payload.truck_number,
        invoice: payload.invoice,
        tel: payload.tel,
        srcLat,
        srcLng,
        destLat,
        destLng,
        etaHrs: payload.eta_hrs,
        status: "STARTED",
        startedAt: new Date(),
      });

      res.json({
        success: true,
        tripId: tripId || created.intutrackTripId,
        consentResults: response?.consentResults,
        data: response,
      });
    } catch (error: any) {
      console.error("Start trip error:", error);
      res.status(500).json({ error: "Failed to start trip", details: error?.payload || error?.message });
    }
  });

  app.post("/api/trips/submit", requireAuth, async (req, res) => {
    try {
      const payload = startTripSchema.parse(req.body);
      const intutrackPayload = buildIntutrackPayload(payload);
      const response = await submitTripRemote(intutrackPayload);
      const tripId = extractTripId(response);
      const { srcLat, srcLng, destLat, destLng } = extractCoordinates(payload);

      const created = await createTrip({
        intutrackTripId: tripId,
        truckNumber: payload.truck_number,
        invoice: payload.invoice,
        tel: payload.tel,
        srcLat,
        srcLng,
        destLat,
        destLng,
        etaHrs: payload.eta_hrs,
        status: "SUBMITTED",
      });

      res.json({
        success: true,
        tripId: tripId || created.intutrackTripId,
        data: response,
      });
    } catch (error: any) {
      console.error("Submit trip error:", error);
      res.status(500).json({ error: "Failed to submit trip", details: error?.payload || error?.message });
    }
  });

  app.put("/api/trips/:id", requireAuth, async (req, res) => {
    try {
      const payload = updateTripSchema.parse(req.body);
      const localTrip = await getTripById(req.params.id);
      const intutrackTripId = payload._id || localTrip?.intutrackTripId || req.params.id;
      const response = await updateTripRemote({ ...payload, _id: intutrackTripId });

      if (localTrip) {
        const updates: Record<string, unknown> = {};
        if (payload.tracking_state) updates.trackingState = payload.tracking_state;
        if (Object.keys(updates).length > 0) {
          await updateTrip(localTrip.id, updates);
        }
      }

      res.json({ success: true, data: response });
    } catch (error: any) {
      console.error("Update trip error:", error);
      res.status(500).json({ error: "Failed to update trip", details: error?.payload || error?.message });
    }
  });

  app.post("/api/trips/:id/end", requireAuth, async (req, res) => {
    try {
      const localTrip = await getTripById(req.params.id);
      const intutrackTripId = localTrip?.intutrackTripId || req.params.id;
      const response = await endTripRemote(intutrackTripId);

      if (localTrip) {
        await updateTrip(localTrip.id, {
          status: "ENDED",
          endedAt: new Date(),
        });
      }

      res.json({ success: true, data: response });
    } catch (error: any) {
      console.error("End trip error:", error);
      res.status(500).json({ error: "Failed to end trip", details: error?.payload || error?.message });
    }
  });

  app.get("/api/trips", requireAuth, async (_req, res) => {
    try {
      const trips = await listTrips();
      res.json(trips);
    } catch (error: any) {
      console.error("List trips error:", error);
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  });

  app.get("/api/trips/:id/live-location", requireAuth, async (req, res) => {
    try {
      const localTrip = await getTripById(req.params.id);
      const intutrackTripId = localTrip?.intutrackTripId || req.params.id;
      const response = await getLocations(intutrackTripId, 1);
      const locations = normalizeLocations(response);
      const latest = locations
        .filter((loc) => loc?.loc)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];

      if (!latest) {
        return res.status(404).json({ error: "No location data available" });
      }

      res.json({
        lat: latest.loc?.[0],
        lng: latest.loc?.[1],
        speed: latest.speed ?? null,
        lastTracked: latest.createdAt,
      });
    } catch (error: any) {
      console.error("Live location error:", error);
      res.status(500).json({ error: "Failed to fetch live location", details: error?.payload || error?.message });
    }
  });

  app.get("/api/trips/:id/history", requireAuth, async (req, res) => {
    try {
      const localTrip = await getTripById(req.params.id);
      const intutrackTripId = localTrip?.intutrackTripId || req.params.id;
      const response = await getLocations(intutrackTripId);
      const locations = normalizeLocations(response).filter((loc) => loc?.loc && loc?.createdAt);
      const sorted = locations.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      const path = sorted.map((loc) => ({
        lat: loc.loc?.[0],
        lng: loc.loc?.[1],
        timestamp: loc.createdAt,
      }));

      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalDuration = first && last ? (new Date(last.createdAt).getTime() - new Date(first.createdAt).getTime()) / 1000 : 0;
      const distanceStart = typeof first?.distance_remained === "number" ? first.distance_remained : undefined;
      const distanceEnd = typeof last?.distance_remained === "number" ? last.distance_remained : undefined;
      const totalDistance = distanceStart !== undefined && distanceEnd !== undefined && distanceStart >= distanceEnd
        ? distanceStart - distanceEnd
        : 0;

      res.json({
        path,
        totalDistance,
        totalDuration,
      });
    } catch (error: any) {
      console.error("Trip history error:", error);
      res.status(500).json({ error: "Failed to fetch trip history", details: error?.payload || error?.message });
    }
  });

  app.post("/api/trips/:id/public-link", requireAuth, async (req, res) => {
    try {
      const localTrip = await getTripById(req.params.id);
      const intutrackTripId = localTrip?.intutrackTripId || req.params.id;
      const response = await generatePublicLink(intutrackTripId);

      if (localTrip && response?.link) {
        await updateTrip(localTrip.id, { publicLink: response.link });
      }

      res.json({ success: true, link: response?.link, data: response });
    } catch (error: any) {
      console.error("Public link error:", error);
      res.status(500).json({ error: "Failed to generate public link", details: error?.payload || error?.message });
    }
  });

  app.get("/api/trips/consents", requireAuth, async (req, res) => {
    try {
      const { tel } = consentSchema.parse(req.query);
      const response = await getConsents(tel);
      res.json(response);
    } catch (error: any) {
      console.error("Consents error:", error);
      res.status(500).json({ error: "Failed to fetch consents", details: error?.payload || error?.message });
    }
  });
}
