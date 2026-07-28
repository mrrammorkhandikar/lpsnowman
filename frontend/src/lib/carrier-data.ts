import type { User, CarrierProfile } from "@shared/schema";

export interface FleetBreakdown {
  type: string;
  count: number;
}

export interface CarrierDocument {
  name: string;
  expiry: string;
  status: "verified" | "pending" | "expired";
}

export interface ExtendedCarrierProfile {
  yearsInOperation: number;
  responseTime: string;
  avgDeliveryTime: string;
  monthlyCapacity: number;
  safetyScore: number;
  onTimeDeliveryPct: number;
  communicationRating: number;
  damageClaimRate: number;
  cancellationRate: number;
  activeDrivers: number;
  fleetBreakdown: FleetBreakdown[];
  preferredRoutes: string[];
  documents: CarrierDocument[];
  pricingFactor: number;
}

export type ExtendedCarrier = User & {
  carrierProfile: CarrierProfile | null;
  extendedProfile: ExtendedCarrierProfile;
};

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

const zones = [
  ["North India", "Delhi NCR", "Punjab", "Haryana"],
  ["West India", "Mumbai", "Gujarat", "Maharashtra"],
  ["South India", "Chennai", "Bangalore", "Hyderabad"],
  ["East India", "Kolkata", "Bihar", "Odisha"],
  ["North India", "Uttar Pradesh", "Rajasthan", "Madhya Pradesh"],
  ["Pan India", "North India", "South India", "West India"],
  ["West India", "Pune", "Goa", "Mumbai"],
  ["South India", "Kerala", "Tamil Nadu", "Karnataka"],
  ["East India", "West Bengal", "Jharkhand", "Assam"],
  ["Pan India", "Delhi NCR", "Mumbai", "Bangalore", "Chennai"],
];

const companyNames = [
  "FastHaul Logistics",
  "Swift Transport",
  "Premier Freight",
  "MegaHaul Express",
  "Titan Trucking Co.",
  "Eagle Express Freight",
  "BlueStar Carriers",
  "Continental Movers",
  "Thunder Road Logistics",
  "Pacific Haulers Inc.",
  "Midwest Express Lines",
  "Summit Freight Solutions",
];

const bios = [
  "Premium freight solutions with nationwide coverage and 24/7 support.",
  "Reliable freight services across the region with competitive rates.",
  "Specialists in time-sensitive deliveries with exceptional reliability.",
  "Growing fleet serving customers with dedication and care.",
  "Industry leader in heavy haul and oversized load transport.",
  "Fast and efficient carrier with a focus on customer satisfaction.",
  "Full-service logistics provider with modern fleet technology.",
  "Trusted partner for commercial freight needs since 2010.",
  "Committed to safe, on-time deliveries with real-time tracking.",
  "Expert handling of temperature-controlled shipments.",
  "Dedicated routes with consistent service quality.",
  "Comprehensive freight solutions for businesses of all sizes.",
];

const truckTypes = [
  "Open - 17 Feet", "Open - 19 Feet", "Open - 20 Feet", "Open - 22 Feet", 
  "Open - 10 Wheeler", "Open - 12 Wheeler", "Open - 14 Wheeler",
  "Container - 20 Ft", "Container - 32 Ft", "Container - 40 Ft",
  "LCV - Tata Ace", "LCV - Bolero Pickup", "LCV - 14 Feet", "LCV - 17 Feet",
  "Trailer - 40 Ft", "Trailer - Triple Axle",
  "Tipper - 10 Wheeler", "Tipper - 12 Wheeler",
  "Tanker - Oil/Fuel", "Tanker - Water", "Tanker - Chemical",
  "Dumper - Hyva", "Dumper - 10 Wheeler",
  "Bulker - Cement", "Bulker - Fly Ash"
];
const badgeLevels = ["platinum", "gold", "silver", "bronze"] as const;

const preferredRoutesList = [
  ["Delhi to Mumbai", "Delhi to Jaipur", "Delhi to Chandigarh"],
  ["Mumbai to Pune", "Mumbai to Ahmedabad", "Mumbai to Goa"],
  ["Bangalore to Chennai", "Bangalore to Hyderabad", "Bangalore to Mysore"],
  ["Kolkata to Patna", "Kolkata to Bhubaneswar", "Kolkata to Guwahati"],
  ["Delhi to Lucknow", "Delhi to Agra", "Jaipur to Udaipur"],
  ["Mumbai to Delhi", "Chennai to Mumbai", "Bangalore to Mumbai"],
  ["Pune to Mumbai", "Pune to Bangalore", "Pune to Hyderabad"],
  ["Chennai to Coimbatore", "Chennai to Madurai", "Bangalore to Kochi"],
  ["Kolkata to Ranchi", "Kolkata to Siliguri", "Guwahati to Shillong"],
  ["Delhi to Bangalore", "Mumbai to Chennai", "Hyderabad to Kolkata"],
];

function generateFleetBreakdown(fleetSize: number): FleetBreakdown[] {
  const types = truckTypes.slice(0, 3 + Math.floor(Math.random() * 3));
  const breakdown: FleetBreakdown[] = [];
  let remaining = fleetSize;
  
  types.forEach((type, idx) => {
    if (idx === types.length - 1) {
      breakdown.push({ type, count: remaining });
    } else {
      const count = Math.max(1, Math.floor(remaining * (0.2 + Math.random() * 0.4)));
      breakdown.push({ type, count });
      remaining -= count;
    }
  });
  
  return breakdown;
}

function generateDocuments(): CarrierDocument[] {
  const futureDate = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  return [
    { name: "Motor Carrier Authority (MC)", expiry: futureDate(18), status: "verified" },
    { name: "USDOT Registration", expiry: futureDate(24), status: "verified" },
    { name: "Commercial Auto Insurance", expiry: futureDate(8), status: "verified" },
    { name: "Cargo Insurance", expiry: futureDate(10), status: "verified" },
    { name: "General Liability Insurance", expiry: futureDate(6), status: "verified" },
    { name: "Workers Compensation", expiry: futureDate(4), status: Math.random() > 0.3 ? "verified" : "pending" },
  ];
}

export const mockCarriers: ExtendedCarrier[] = companyNames.map((name, idx) => {
  const fleetSize = 8 + Math.floor(Math.random() * 40);
  const reliabilityScore = (4.0 + Math.random()).toFixed(1);
  const communicationScore = (4.0 + Math.random()).toFixed(1);
  const onTimeScore = (4.0 + Math.random()).toFixed(1);
  const badgeLevel = badgeLevels[idx % badgeLevels.length];
  
  return {
    id: `carrier-${idx + 1}`,
    username: name.toLowerCase().replace(/[^a-z]/g, ""),
    email: `contact@${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
    password: "",
    role: "carrier" as const,
    companyName: name,
    phone: `(555) ${100 + idx}-${1000 + idx * 111}`,
    avatar: null,
    isVerified: idx < 8,
    createdAt: new Date(Date.now() - (idx * 30 * 24 * 60 * 60 * 1000)),
    carrierProfile: {
      id: `cp-${idx + 1}`,
      userId: `carrier-${idx + 1}`,
      fleetSize,
      serviceZones: zones[idx % zones.length],
      reliabilityScore,
      communicationScore,
      onTimeScore,
      totalDeliveries: 50 + Math.floor(Math.random() * 500),
      badgeLevel,
      bio: bios[idx],
    },
    extendedProfile: {
      yearsInOperation: 2 + Math.floor(Math.random() * 15),
      responseTime: ["< 30 min", "< 1 hour", "< 2 hours", "< 4 hours"][Math.floor(Math.random() * 4)],
      avgDeliveryTime: ["12-24h", "24-48h", "48-72h"][Math.floor(Math.random() * 3)],
      monthlyCapacity: 20 + Math.floor(Math.random() * 100),
      safetyScore: 85 + Math.floor(Math.random() * 15),
      onTimeDeliveryPct: 88 + Math.floor(Math.random() * 12),
      communicationRating: 85 + Math.floor(Math.random() * 15),
      damageClaimRate: Math.round((Math.random() * 2) * 10) / 10,
      cancellationRate: Math.round((Math.random() * 3) * 10) / 10,
      activeDrivers: Math.max(fleetSize, Math.floor(fleetSize * 1.2)),
      fleetBreakdown: generateFleetBreakdown(fleetSize),
      preferredRoutes: preferredRoutesList[idx % preferredRoutesList.length],
      documents: generateDocuments(),
      pricingFactor: 0.85 + Math.random() * 0.3,
    },
  };
});

export function getCarrierById(id: string): ExtendedCarrier | undefined {
  return mockCarriers.find(c => c.id === id);
}

export function getAllZones(): string[] {
  return Array.from(new Set(zones.flat())).sort();
}

export function estimateQuotePrice(
  carrier: ExtendedCarrier,
  distance: number,
  weight: number,
  truckType: string
): {
  baseRate: number;
  fuelSurcharge: number;
  carrierPremium: number;
  total: number;
} {
  const baseRate = Math.round(distance * 1.5 + weight * 10);
  const fuelSurcharge = Math.round(baseRate * 0.15);
  const premiumFactor = carrier.extendedProfile.pricingFactor - 1;
  const carrierPremium = Math.round(baseRate * premiumFactor);
  const total = baseRate + fuelSurcharge + carrierPremium;

  return { baseRate, fuelSurcharge, carrierPremium, total };
}
