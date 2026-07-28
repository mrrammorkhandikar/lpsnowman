import { useQuery } from "@tanstack/react-query";

export interface ShipperProfile {
  id: string;
  userId: string;
  username: string;
  email: string;
  isVerified: boolean;
  business: {
    legalCompanyName: string | null;
    tradeName: string | null;
    businessType: string | null;
    incorporationDate: string | null;
    cinNumber: string | null;
    panNumber: string | null;
    gstinNumber: string | null;
  };
  address: {
    addressLine: string | null;
    city: string | null;
    cityCustom: string | null;
    state: string | null;
    country: string | null;
    pincode: string | null;
  };
  contact: {
    name: string | null;
    designation: string | null;
    phone: string | null;
    email: string | null;
  };
  banking?: {
    bankName: string | null;
    accountNumber: string | null;
    ifscCode: string | null;
    branchName: string | null;
  };
  operations?: {
    operatingRegions: string[] | null;
    primaryCommodities: string[] | null;
    estimatedMonthlyLoads: number | null;
    avgLoadValueInr: string | null;
  };
  onboardingStatus: string;
  approvedAt?: string | null;
}

export function useShipperProfile() {
  return useQuery<ShipperProfile>({
    queryKey: ["/api/shipper/profile"],
    retry: false,
  });
}

export function useShipperProfileById(shipperId: string | undefined) {
  return useQuery<ShipperProfile>({
    queryKey: ["/api/shipper", shipperId, "profile"],
    enabled: !!shipperId,
    retry: false,
  });
}

export function getFormattedAddress(profile: ShipperProfile | undefined): string {
  if (!profile?.address) return "";
  
  const parts = [
    profile.address.addressLine,
    profile.address.city,
    profile.address.state,
    profile.address.country,
    profile.address.pincode,
  ].filter(Boolean);
  
  return parts.join(", ");
}

export function getDisplayCompanyName(profile: ShipperProfile | undefined): string {
  if (!profile?.business) return "";
  return profile.business.tradeName || profile.business.legalCompanyName || "";
}

export function getDisplayCity(profile: ShipperProfile | undefined): string {
  if (!profile?.address) return "";
  return profile.address.city || "";
}
