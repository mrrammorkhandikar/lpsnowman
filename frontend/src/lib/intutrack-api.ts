/**
 * IntuTrack API client – typed functions to call backend IntuTrack proxy routes.
 * Backend hits https://sct.intutrack.com/api/prod/* using INTUTRACK_* env credentials.
 */

import { apiRequest } from "./queryClient";

// --- Response types (match backend intutrack-routes) ---

export type IntutrackLoginResponse = {
  token: string;
  _id: string | null;
};

export type IntutrackConsentResponse = {
  number: string | null;
  consent: string | null;
  consent_suggestion: string | null;
};

export type IntutrackStartTripResponse = {
  tripId: string;
  msg?: string;
  consentResults?: Array<{ number?: string; operator?: string; consent?: string; consent_suggestion?: string | null }>;
  requestdata?: unknown;
};

export type IntutrackEndTripResponse = {
  msg: string;
};

// --- Start trip body (required fields; backend allows more via passthrough) ---

export type IntutrackStartTripPayload = {
  tel: string;
  sim_no?: string;
  device?: string;
  src: [string | number, string | number];
  dest: [string | number, string | number];
  loadId?: string; // optional: backend stores triptrack_id on this load after success
  [key: string]: unknown;
};

const INTUTRACK_PREFIX = "/api/intutrack";

/**
 * Login to IntuTrack (uses backend credentials from env).
 * Returns token and user _id.
 */
export async function intutrackLogin(): Promise<IntutrackLoginResponse> {
  const res = await apiRequest("POST", `${INTUTRACK_PREFIX}/login`);
  return res.json();
}

/**
 * Check consent status for a phone number.
 * Returns number, consent, and consent_suggestion.
 */
export async function intutrackConsent(tel: string): Promise<IntutrackConsentResponse> {
  const url = `${INTUTRACK_PREFIX}/consent?tel=${encodeURIComponent(tel)}`;
  const res = await apiRequest("GET", url);
  return res.json();
}

/**
 * Start a trip in IntuTrack.
 * Payload must include tel, src [lat, lng], dest [lat, lng]; optional sim_no, device, etc.
 * Returns tripId.
 */
export async function intutrackStartTrip(
  payload: IntutrackStartTripPayload
): Promise<IntutrackStartTripResponse> {
  const res = await apiRequest("POST", `${INTUTRACK_PREFIX}/trips/start`, payload);
  return res.json();
}

/**
 * End a trip in IntuTrack.
 * Pass either tripId or loadId; if loadId, backend uses the load's triptrack_id from the table.
 * Returns msg (e.g. "Trip Completed").
 */
export async function intutrackEndTrip(
  payload: { tripId?: string; loadId?: string }
): Promise<IntutrackEndTripResponse> {
  const res = await apiRequest("POST", `${INTUTRACK_PREFIX}/trips/end`, payload);
  return res.json();
}

/** Geocode an address to lat/lng via backend API (Google with India bias + Nominatim fallback). */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address?.trim()) return null;
  try {
    const res = await apiRequest(
      "GET",
      `/api/geocode?address=${encodeURIComponent(address.trim())}`
    );
    const data = await res.json();
    if (typeof data?.lat === "number" && typeof data?.lng === "number") {
      return { lat: data.lat, lng: data.lng };
    }
    return null;
  } catch {
    return null;
  }
}
