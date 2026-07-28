import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  loginWithDetails,
  getConsents as getConsentsRemote,
  startTrip as startTripRemote,
  endTrip as endTripRemote,
} from "./trips/intutrack-client";
import { storage } from "./storage";
import { refreshTriptrackLocationsForAllLoads } from "./trips/triptrack-locations-service";

const consentQuerySchema = z.object({
  tel: z.string().min(1, "tel is required"),
});

const startTripBodySchema = z
  .object({
    tel: z.string().min(1, "tel is required"),
    sim_no: z.string().optional(),
    device: z.string().optional(),
    src: z.array(z.union([z.string(), z.number()])).length(2),
    dest: z.array(z.union([z.string(), z.number()])).length(2),
    loadId: z.string().optional(), // optional: store triptrack_id on this load after success
  })
  .passthrough();

const endTripBodySchema = z.object({
  tripId: z.string().optional(),
  loadId: z.string().optional(), // if provided, use load's triptrack_id to end the trip
}).refine((data) => (data.tripId && data.tripId.trim()) || (data.loadId && data.loadId.trim()), {
  message: "Either tripId or loadId is required",
});

export function registerIntutrackRoutes(app: Express) {
  // 1) IntuTrack Login route
  //    Uses INTUTRACK_USERNAME/PASSWORD from .env and hits:
  //    POST https://sct.intutrack.com/api/prod/login
  //    Returns: { token, _id }
  app.post("/api/intutrack/login", async (_req: Request, res: Response) => {
    try {
      const payload = await loginWithDetails();
      const token = (payload as any).token;
      const user = (payload as any).user || {};

      if (!token) {
        return res.status(500).json({ error: "Login succeeded but no token returned from IntuTrack" });
      }

      return res.json({
        token,
        _id: user._id ?? null,
      });
    } catch (error: any) {
      console.error("IntuTrack login route error:", error);
      return res.status(500).json({
        error: "Failed to login to IntuTrack",
        details: error?.payload || error?.message,
      });
    }
  });

  // 2) IntuTrack Consent route
  //    First gets a bearer token via login helper (handled inside client),
  //    then calls:
  //    GET https://sct.intutrack.com/api/prod/consents?tel=xxxxxxxxxx
  //    Returns: { number, consent, consent_suggestion }
  app.get("/api/intutrack/consent", async (req: Request, res: Response) => {
    try {
      const { tel } = consentQuerySchema.parse(req.query);

      const raw = await getConsentsRemote(tel);
      const items = Array.isArray(raw) ? raw : [raw];

      // Map to the "result" objects if present
      const mapped = items
        .map((item: any) => item?.result ?? item)
        .filter((r: any) => r && typeof r === "object");

      const first = mapped[0];
      if (!first) {
        return res.status(404).json({ error: "No consent data found" });
      }

      return res.json({
        number: first.number ?? null,
        consent: first.consent ?? null,
        consent_suggestion: first.consent_suggestion ?? null,
      });
    } catch (error: any) {
      console.error("IntuTrack consent route error:", error);
      return res.status(500).json({
        error: "Failed to fetch consent status from IntuTrack",
        details: error?.payload || error?.message,
      });
    }
  });

  // 3) IntuTrack Start Trip route
  //    Body JSON should include:
  //    - tel, sim_no, device
  //    - src: [lat, lng]
  //    - dest: [lat, lng]
  //    As in APT_route_endpoint.md example.
  //    Uses login internally via client and calls:
  //    POST https://sct.intutrack.com/api/prod/trips/start
  //    Returns: { tripId }
  app.post("/api/intutrack/trips/start", async (req: Request, res: Response) => {
    try {
      const body = startTripBodySchema.parse(req.body);
      const response = await startTripRemote(body);
      const tripId = (response as any)?.tripId ?? (response as any)?._id ?? (response as any)?.id ?? null;

      if (!tripId) {
        return res.status(500).json({
          error: "Trip started but no tripId returned from IntuTrack",
          data: response,
        });
      }

      // Store triptrack_id (and map URL) in loads table when loadId is provided
      const loadId = body.loadId;
      if (loadId && typeof loadId === "string" && loadId.trim()) {
        try {
          const load = await storage.getLoad(loadId.trim());
          if (load) {
            const triptrackMap = `https://sct.intutrack.com/#!/public?tripId=${encodeURIComponent(tripId)}`;
            await storage.updateLoad(loadId.trim(), {
              triptrackId: String(tripId),
              triptrackMap,
            });
          }
        } catch (err) {
          console.error("IntuTrack start trip: failed to update load with triptrack_id:", err);
        }
      }

      return res.json({
        tripId,
        msg: (response as any)?.msg ?? "Trip started",
        consentResults: (response as any)?.consentResults ?? [],
        requestdata: (response as any)?.requestdata ?? null,
      });
    } catch (error: any) {
      console.error("IntuTrack start trip route error:", error);
      const raw = error?.payload ?? error?.message;
      const detailsStr =
        typeof raw === "string"
          ? raw
          : raw != null
            ? (typeof (raw as { message?: string })?.message === "string" ? (raw as { message: string }).message : JSON.stringify(raw))
            : "Unknown error";
      const hint =
        detailsStr === "fetch failed" || detailsStr.includes("timed out") || detailsStr.includes("ECONNREFUSED")
          ? " IntuTrack service may be unreachable—check network and VPN."
          : "";
      return res.status(500).json({
        error: "Failed to start trip in IntuTrack",
        details: detailsStr + hint,
      });
    }
  });

  // 4) IntuTrack End Trip route
  //    Body JSON: { tripId }
  //    Calls:
  //    POST https://sct.intutrack.com/api/prod/trips/end/{tripId}
  //    Returns: { msg }
  app.post("/api/intutrack/trips/end", async (req: Request, res: Response) => {
    try {
      const body = endTripBodySchema.parse(req.body);
      let tripId: string;
      if (body.tripId && body.tripId.trim()) {
        tripId = body.tripId.trim();
      } else if (body.loadId && body.loadId.trim()) {
        const load = await storage.getLoad(body.loadId.trim());
        if (!load?.triptrackId) {
          return res.status(400).json({
            error: "Load has no triptrack_id",
            details: "Cannot end trip without a trip ID. Start the trip first or pass tripId.",
          });
        }
        tripId = load.triptrackId;
      } else {
        return res.status(400).json({ error: "Either tripId or loadId is required" });
      }
      const response = await endTripRemote(tripId);
      const msg = (response as any)?.msg ?? null;

      if (!msg) {
        return res.status(500).json({
          error: "Trip ended but no message returned from IntuTrack",
          data: response,
        });
      }

      return res.json({
        msg,
      });
    } catch (error: any) {
      console.error("IntuTrack end trip route error:", error);
      return res.status(500).json({
        error: "Failed to end trip in IntuTrack",
        details: error?.payload || error?.message,
      });
    }
  });

  // 5) IntuTrack Locations Refresh route
  //    For each load with a triptrack_id:
  //      - Calls GET /status?tripId=...
  //      - Extracts [lat, lng] and key metadata
  //      - Stores them in loads.triptrack_locations (jsonb)
  //    Intended to be called once per minute by a cron or external scheduler.
  app.post("/api/intutrack/trips/refresh-locations", async (_req: Request, res: Response) => {
    try {
      const result = await refreshTriptrackLocationsForAllLoads();
      return res.json({
        ok: true,
        ...result,
      });
    } catch (error: any) {
      console.error("IntuTrack refresh locations route error:", error);
      return res.status(500).json({
        error: "Failed to refresh IntuTrack locations for loads",
        details: error?.message ?? String(error),
      });
    }
  });
}

