import { indianStates } from "./shared/indian-locations";

/** Address fields from signup (Google Places + manual) to seed shipper onboarding draft */
export type SeededOnboardingAddress = {
  registeredAddress?: string;
  registeredState?: string;
  registeredCity?: string;
  registeredCityCustom?: string;
  registeredPincode?: string;
  registeredCountry?: string;
};

function resolveIndianStateName(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";

  const exact = indianStates.find(
    (st) => st.name.toLowerCase() === s || st.code.toLowerCase() === s
  );
  if (exact) return exact.name;

  const candidates = indianStates.filter((st) => {
    const n = st.name.toLowerCase();
    return s.includes(n) || n.includes(s);
  });
  if (candidates.length === 0) return "";
  candidates.sort((a, b) => b.name.length - a.name.length);
  return candidates[0]!.name;
}

function resolveCityForState(
  stateName: string,
  rawCity: string
): { city: string; cityCustom: string } {
  const cityTrim = rawCity.trim();
  if (!cityTrim) return { city: "", cityCustom: "" };

  const stateData = indianStates.find((st) => st.name === stateName);
  if (!stateData) {
    return { city: "other", cityCustom: cityTrim };
  }

  const match = stateData.cities.find(
    (c) => c.name.toLowerCase() === cityTrim.toLowerCase()
  );
  if (match) {
    return { city: match.name, cityCustom: "" };
  }

  return { city: "other", cityCustom: cityTrim };
}

/** Find state + city when only city is known (search all states). */
function resolveCityAcrossStates(rawCity: string): { state: string; city: string; cityCustom: string } {
  const cityTrim = rawCity.trim();
  if (!cityTrim) return { state: "", city: "", cityCustom: "" };

  for (const st of indianStates) {
    const match = st.cities.find((c) => c.name.toLowerCase() === cityTrim.toLowerCase());
    if (match) {
      return { state: st.name, city: match.name, cityCustom: "" };
    }
  }

  return { state: "", city: "other", cityCustom: cityTrim };
}

/**
 * Maps registration payload + parsed user row into optional onboarding address columns.
 * Used when creating the initial shipper onboarding draft so the form is pre-filled.
 */
export function seedOnboardingAddressFromRegistration(
  body: Record<string, unknown>,
  parsedUser: {
    companyAddress?: string | null;
    defaultPickupCity?: string | null;
  }
): SeededOnboardingAddress {
  const companyAddress =
    (typeof parsedUser.companyAddress === "string" && parsedUser.companyAddress.trim()) ||
    (typeof body.address === "string" && body.address.trim()) ||
    "";

  const rawState =
    typeof body.addressState === "string" ? body.addressState : "";
  const rawCityFromBody =
    (typeof body.addressCity === "string" && body.addressCity.trim()) ||
    (typeof body.city === "string" && body.city.trim()) ||
    (typeof parsedUser.defaultPickupCity === "string" && parsedUser.defaultPickupCity.trim()) ||
    "";

  const rawPostal = typeof body.addressPostalCode === "string" ? body.addressPostalCode : "";
  const digits = rawPostal.replace(/\D/g, "").slice(0, 6);
  const registeredPincode = digits.length === 6 ? digits : undefined;

  const rawCountry =
    typeof body.addressCountry === "string" && body.addressCountry.trim()
      ? body.addressCountry.trim()
      : "India";

  const out: SeededOnboardingAddress = {};

  if (companyAddress) {
    out.registeredAddress = companyAddress;
  }

  let stateName = resolveIndianStateName(rawState);
  let cityResolved: { city: string; cityCustom: string };

  if (stateName && rawCityFromBody) {
    cityResolved = resolveCityForState(stateName, rawCityFromBody);
  } else if (!stateName && rawCityFromBody) {
    const across = resolveCityAcrossStates(rawCityFromBody);
    stateName = across.state;
    cityResolved = { city: across.city, cityCustom: across.cityCustom };
  } else {
    cityResolved = { city: "", cityCustom: "" };
  }

  if (stateName) {
    out.registeredState = stateName;
  }
  if (cityResolved.city) {
    out.registeredCity = cityResolved.city;
  }
  if (cityResolved.cityCustom) {
    out.registeredCityCustom = cityResolved.cityCustom;
  }
  if (registeredPincode) {
    out.registeredPincode = registeredPincode;
  }
  if (rawCountry) {
    out.registeredCountry = rawCountry;
  }

  return out;
}
