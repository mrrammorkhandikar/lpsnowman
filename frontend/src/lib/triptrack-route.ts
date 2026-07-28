import * as turf from "@turf/turf";

export type TriptrackPointInput = {
  lat: number;
  lng: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | number | null;
};

const DEFAULT_RADIUS_KM = 1;
const DEFAULT_MIN_HALT_MS = 60 * 60 * 1000;

function parsePointTimeMs(p: TriptrackPointInput): number | null {
  const raw = p.createdAt ?? p.updatedAt;
  if (raw == null || String(raw).trim() === "") return null;
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : null;
}

function distanceKm(a: TriptrackPointInput, b: TriptrackPointInput): number {
  return turf.distance(turf.point([a.lng, a.lat]), turf.point([b.lng, b.lat]), { units: "kilometers" });
}

function centroidOf(points: TriptrackPointInput[]): TriptrackPointInput {
  if (points.length === 1) return { ...points[0] };
  const fc = turf.featureCollection(points.map((p) => turf.point([p.lng, p.lat])));
  const c = turf.centroid(fc);
  const [lng, lat] = c.geometry.coordinates;
  const first = points[0];
  const last = points[points.length - 1];
  return {
    lat,
    lng,
    createdAt: first.createdAt ?? null,
    updatedAt: last.updatedAt ?? last.createdAt ?? null,
    address: last.address ?? first.address ?? null,
    city: last.city ?? first.city ?? null,
    state: last.state ?? first.state ?? null,
    pincode: last.pincode ?? first.pincode ?? null,
  };
}

/**
 * Consecutive run where each point stays within `radiusKm` of the first point in the run
 * (time order preserved—input should already be sorted by time).
 */
export type TriptrackSegment =
  | { kind: "moving"; points: TriptrackPointInput[] }
  | {
      kind: "halt";
      point: TriptrackPointInput;
      durationMs: number;
      startMs: number;
      endMs: number;
    };

export function segmentTriptrackForHalts(
  points: TriptrackPointInput[] | null | undefined,
  options?: { radiusKm?: number; minHaltDurationMs?: number }
): TriptrackSegment[] {
  const R = options?.radiusKm ?? DEFAULT_RADIUS_KM;
  const minHalt = options?.minHaltDurationMs ?? DEFAULT_MIN_HALT_MS;
  const list = (points || []).filter((p) => typeof p?.lat === "number" && typeof p?.lng === "number");
  if (list.length === 0) return [];

  const out: TriptrackSegment[] = [];
  let i = 0;
  const n = list.length;

  while (i < n) {
    let j = i;
    while (j + 1 < n && distanceKm(list[i]!, list[j + 1]!) <= R) {
      j++;
    }
    const slice = list.slice(i, j + 1);
    if (slice.length === 1) {
      out.push({ kind: "moving", points: [slice[0]!] });
    } else {
      const times = slice.map(parsePointTimeMs);
      const allHaveTime = times.every((t) => t != null);
      const t0 = times[0]!;
      const t1 = times[times.length - 1]!;
      if (allHaveTime && t1 - t0 > minHalt) {
        out.push({
          kind: "halt",
          point: centroidOf(slice),
          durationMs: t1 - t0,
          startMs: t0,
          endMs: t1,
        });
      } else {
        out.push({ kind: "moving", points: slice });
      }
    }
    i = j + 1;
  }

  return out;
}

export type TriptrackHaltMarker = {
  position: [number, number];
  /** Centroid + merged address/city from cluster (for popups) */
  point: TriptrackPointInput;
  durationMs: number;
  startMs: number;
  endMs: number;
};

export function formatHaltDuration(ms: number): string {
  if (ms < 60000) return "< 1 min";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
}

/** City + state, else address / pincode, for halt popups (from triprack JSON). */
export function formatHaltLocationLabel(p: TriptrackPointInput): string {
  const city = (p.city ?? "").trim();
  const state = (p.state ?? "").trim();
  const address = (p.address ?? "").trim();
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  if (address) return address.length > 80 ? `${address.slice(0, 77)}…` : address;
  const pc = p.pincode != null ? String(p.pincode).trim() : "";
  if (pc) return pc;
  return "Location not available";
}

/**
 * Build triptrack polyline (no pickup/drop) and halt metadata for map rendering.
 * Halt clusters contribute a single vertex (centroid); interior GPS noise is omitted.
 */
export function getTriptrackRouteVisualization(
  points: TriptrackPointInput[] | null | undefined,
  options?: { radiusKm?: number; minHaltDurationMs?: number }
): {
  segments: TriptrackSegment[];
  triptrackPolyline: [number, number][];
  halts: TriptrackHaltMarker[];
} {
  const segments = segmentTriptrackForHalts(points, options);
  const triptrackPolyline: [number, number][] = [];
  for (const s of segments) {
    if (s.kind === "moving") {
      for (const p of s.points) {
        triptrackPolyline.push([p.lat, p.lng]);
      }
    } else {
      triptrackPolyline.push([s.point.lat, s.point.lng]);
    }
  }
  const halts: TriptrackHaltMarker[] = segments
    .filter((seg): seg is Extract<TriptrackSegment, { kind: "halt" }> => seg.kind === "halt")
    .map((seg) => ({
      position: [seg.point.lat, seg.point.lng] as [number, number],
      point: { ...seg.point },
      durationMs: seg.durationMs,
      startMs: seg.startMs,
      endMs: seg.endMs,
    }));
  return { segments, triptrackPolyline, halts };
}

/**
 * Flat list of triptrack points for legacy callers (one point per segment vertex).
 */
export function collapseTriptrackHalts(
  points: TriptrackPointInput[] | null | undefined,
  options?: { radiusKm?: number; minDurationMs?: number }
): TriptrackPointInput[] {
  const segments = segmentTriptrackForHalts(points, {
    radiusKm: options?.radiusKm,
    minHaltDurationMs: options?.minDurationMs ?? DEFAULT_MIN_HALT_MS,
  });
  const out: TriptrackPointInput[] = [];
  for (const s of segments) {
    if (s.kind === "moving") out.push(...s.points);
    else out.push(s.point);
  }
  return out;
}
