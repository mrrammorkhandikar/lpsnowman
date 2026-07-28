/** Build origin/destination strings for POST /api/distance/calculate (same shape as admin load details). */

export type CarrierRouteLoadLike = {
  pickupAddress?: string | null;
  pickupLocality?: string | null;
  pickupCity?: string | null;
  /** Display city when `pickupCity` is absent (e.g. CarrierLoad.origin). */
  origin?: string | null;
  pickupState?: string | null;
  pickupPincode?: string | null;
  dropoffAddress?: string | null;
  dropoffLocality?: string | null;
  dropoffCity?: string | null;
  destination?: string | null;
  dropoffState?: string | null;
  dropoffPincode?: string | null;
};

export function buildCarrierRouteOriginString(l: CarrierRouteLoadLike): string {
  const city = l.pickupCity ?? l.origin;
  return [l.pickupAddress, l.pickupLocality, city, l.pickupState, l.pickupPincode]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(", ");
}

export function buildCarrierRouteDestinationString(l: CarrierRouteLoadLike): string {
  const city = l.dropoffCity ?? l.destination;
  return [l.dropoffAddress, l.dropoffLocality, city, l.dropoffState, l.dropoffPincode]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(", ");
}
