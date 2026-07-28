import { URL } from "node:url";

/**
 * Resolve Google Maps API key: backend prefers GOOGLE_MAPS_API_KEY,
 * fallback to VITE_GOOGLE_MAPS_API_KEY if set (e.g. same key in backend .env).
 */
export function getGoogleMapsApiKey(): string | undefined {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    undefined
  );
}

/** Options for more accurate geocoding (e.g. bias to India). */
export type GeocodeOptions = {
  /** Two-letter region code (e.g. "in" for India) to bias results. */
  region?: string;
  /** Restrict to country, e.g. "IN" for India. */
  components?: string;
  /** Preferred language for results. */
  language?: string;
};

/**
 * Get lat/lng for an address using Google Geocoding API.
 * Uses India bias by default for more accurate results in India.
 * Returns null if key missing, request fails, or no results.
 */
export async function getCoordinatesFromAddress(
  address: string,
  options: GeocodeOptions = {}
): Promise<{ lat: number; lng: number } | null> {
  const key = getGoogleMapsApiKey();
  if (!key || key.length < 10) {
    return null;
  }

  const apiUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  apiUrl.searchParams.set("address", address.trim());
  apiUrl.searchParams.set("key", key);
  // Bias to India for accuracy (logistics use case)
  apiUrl.searchParams.set("region", options.region ?? "in");
  if (options.components) {
    apiUrl.searchParams.set("components", options.components);
  } else {
    apiUrl.searchParams.set("components", "country:IN");
  }
  if (options.language) {
    apiUrl.searchParams.set("language", options.language);
  }

  const res = await fetch(apiUrl.toString());
  const data = (await res.json()) as {
    status: string;
    results?: Array<{
      geometry?: { location?: { lat: number; lng: number }; location_type?: string };
      formatted_address?: string;
    }>;
  };

  if (data.status !== "OK" || !data.results?.length) {
    return null;
  }

  // Prefer ROOFTOP or RANGE_INTERPOLATED for accuracy; fallback to first result
  const preferred = data.results.find(
    (r) =>
      r.geometry?.location_type === "ROOFTOP" || r.geometry?.location_type === "RANGE_INTERPOLATED"
  );
  const first = data.results[0];
  const chosen = preferred ?? first;
  const loc = chosen.geometry?.location;
  if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") {
    return null;
  }

  return { lat: loc.lat, lng: loc.lng };
}
 