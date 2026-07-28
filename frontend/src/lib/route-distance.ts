import { calculateDistance, getRouteInfo } from "@/components/address-autocomplete";

/** Road-ish distance from coordinates (great-circle × 1.3) or city centroids — never uses stored DB `distance`. */
export function computeRouteDistanceKmEstimate(params: {
  pickupLat?: string | number | null;
  pickupLng?: string | number | null;
  dropoffLat?: string | number | null;
  dropoffLng?: string | number | null;
  pickupCity?: string | null;
  dropoffCity?: string | null;
}): number {
  const pickupLat = params.pickupLat != null ? parseFloat(String(params.pickupLat)) : NaN;
  const pickupLng = params.pickupLng != null ? parseFloat(String(params.pickupLng)) : NaN;
  const dropoffLat = params.dropoffLat != null ? parseFloat(String(params.dropoffLat)) : NaN;
  const dropoffLng = params.dropoffLng != null ? parseFloat(String(params.dropoffLng)) : NaN;

  const canComputeFromCoords =
    Number.isFinite(pickupLat) &&
    Number.isFinite(pickupLng) &&
    Number.isFinite(dropoffLat) &&
    Number.isFinite(dropoffLng) &&
    Math.abs(pickupLat) > 0.000001 &&
    Math.abs(pickupLng) > 0.000001 &&
    Math.abs(dropoffLat) > 0.000001 &&
    Math.abs(dropoffLng) > 0.000001;

  if (canComputeFromCoords) {
    const coordKm = Math.round(calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng) * 1.3);
    if (coordKm >= 1) {
      return coordKm;
    }
    // Coords ~0 km but cities differ (duplicate/wrong geocodes) — use centroid lookup instead.
    const pc = params.pickupCity?.trim();
    const dc = params.dropoffCity?.trim();
    if (pc && dc && pc.toLowerCase() !== dc.toLowerCase()) {
      const cityRoute = getRouteInfo(pc, dc);
      if (cityRoute && Number.isFinite(cityRoute.distance) && cityRoute.distance >= 1) {
        return cityRoute.distance;
      }
    }
    return NaN;
  }

  const pickupCity = params.pickupCity;
  const dropoffCity = params.dropoffCity;
  if (pickupCity && dropoffCity) {
    const cityRoute = getRouteInfo(String(pickupCity).trim(), String(dropoffCity).trim());
    if (cityRoute && Number.isFinite(cityRoute.distance)) {
      return cityRoute.distance;
    }
  }

  return NaN;
}
