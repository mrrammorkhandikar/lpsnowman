/**
 * Minimal load-like shape for building full address (pickup or dropoff).
 * Used for accurate geocoding with Google API.
 */
export type LoadAddressFields = {
  pickupAddress?: string | null;
  pickupLocality?: string | null;
  pickupLandmark?: string | null;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupPincode?: string | null;
  dropoffAddress?: string | null;
  dropoffLocality?: string | null;
  dropoffLandmark?: string | null;
  dropoffCity?: string | null;
  dropoffState?: string | null;
  dropoffPincode?: string | null;
};

/**
 * Build a single-line full address for geocoding (India).
 * Order: address, locality, landmark, city, state pincode, India.
 */
export function buildFullAddress(
  load: LoadAddressFields | null | undefined,
  side: "pickup" | "dropoff"
): string | null {
  if (!load) return null;
  const prefix = side === "pickup" ? "pickup" : "dropoff";
  const address = (load as any)[`${prefix}Address`]?.trim?.();
  const locality = (load as any)[`${prefix}Locality`]?.trim?.();
  const landmark = (load as any)[`${prefix}Landmark`]?.trim?.();
  const city = (load as any)[`${prefix}City`]?.trim?.();
  const state = (load as any)[`${prefix}State`]?.trim?.();
  const pincode = (load as any)[`${prefix}Pincode`]?.trim?.();

  const parts: string[] = [];
  if (address) parts.push(address);
  if (locality && locality !== address) parts.push(locality);
  if (landmark && !parts.includes(landmark)) parts.push(landmark);
  if (city) parts.push(city);
  if (state || pincode) parts.push([state, pincode].filter(Boolean).join(" ").trim());
  parts.push("India");

  const full = parts.filter(Boolean).join(", ");
  return full.length > 3 ? full : null;
}
 