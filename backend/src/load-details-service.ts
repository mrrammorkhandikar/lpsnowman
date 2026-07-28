import { storage } from "./storage";
import type { Load, User, Truck, Driver, Shipment, Bid } from "@shared/schema";

export type LoadAssignmentType = "direct" | "bid" | "none";

export type LoadUserSummary = {
  id: string;
  username: string;
  email: string;
  company: string | null;
  phone: string | null;
  isVerified: boolean;
  role: string;
};

export type LoadTruckSummary = {
  id: string;
  licensePlate: string;
  manufacturer: string | null;
  model: string | null;
  truckType: string | null;
  capacity: string | null;
  chassisNumber: string | null;
  registrationNumber: string | null;
  bodyType: string | null;
  year: number | null;
  isAvailable: boolean | null;
};

export type LoadDriverSummary = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  status: string | null;
};

export type LoadShipmentSummary = {
  id: string;
  status: string;
  truckId: string | null;
  driverId: string | null;
  startOtpVerified?: boolean | null;
  endOtpVerified?: boolean | null;
  truck?: LoadTruckSummary | null;
  driver?: LoadDriverSummary | null;
};

export type EnrichedBid = Bid & {
  carrierType: string;
  carrier: Omit<User, "password"> | null;
  carrierProfile: {
    fleetSize: number | null;
    carrierType: string | null;
    operatingRegion: string | null;
    verificationStatus: string | null;
  } | null;
  truck: {
    id: string;
    registrationNumber: string | null;
    manufacturer: string | null;
    model: string | null;
    capacity: number | null;
    truckType: string | null;
  } | null;
  driver?: LoadDriverSummary | null;
};

export type LoadBidsSection = {
  soloBids: EnrichedBid[];
  enterpriseBids: EnrichedBid[];
  allBids: EnrichedBid[];
  summary: {
    totalBids: number;
    soloBidCount: number;
    enterpriseBidCount: number;
    lowestSoloBid: number | null;
    lowestEnterpriseBid: number | null;
  };
};

export type DirectAssignmentSection = {
  carrier: LoadUserSummary;
  truck: LoadTruckSummary | null;
  driver: LoadDriverSummary | null;
  carrierPayout: string | null;
  shipperPrice: string | null;
  assignedAt: Date | null;
  assignedBy: "admin";
  pickupId: string | null;
};

export type LoadDetailsResponse = {
  load: Load;
  assignmentType: LoadAssignmentType;
  shipper: LoadUserSummary | null;
  assignedCarrier: LoadUserSummary | null;
  carrierOnboarding: {
    carrierType: string | null;
    fleetSize: number | null;
  } | null;
  shipment: LoadShipmentSummary | null;
  directAssignment: DirectAssignmentSection | null;
  bids: LoadBidsSection | null;
  winningBid: EnrichedBid | null;
};

const FINALIZED_LOAD_STATUSES = new Set([
  "awarded",
  "assigned",
  "invoice_created",
  "invoice_sent",
  "invoice_acknowledged",
  "invoice_paid",
  "in_transit",
  "delivered",
  "closed",
]);

export function getLoadAssignmentType(load: Load): LoadAssignmentType {
  if (load.adminPostMode === "assign" && load.assignedCarrierId) {
    return "direct";
  }
  if (load.awardedBidId) {
    return "bid";
  }
  if (load.assignedCarrierId && FINALIZED_LOAD_STATUSES.has(load.status || "")) {
    return "bid";
  }
  return "none";
}

function toUserSummary(user: User): LoadUserSummary {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    company: user.companyName,
    phone: user.phone,
    isVerified: user.isVerified ?? false,
    role: user.role,
  };
}

function toTruckSummary(truck: Truck): LoadTruckSummary {
  return {
    id: truck.id,
    licensePlate: truck.licensePlate,
    manufacturer: truck.make,
    model: truck.model,
    truckType: truck.truckType,
    capacity: truck.capacity?.toString() || null,
    chassisNumber: truck.chassisNumber,
    registrationNumber: truck.registrationNumber,
    bodyType: truck.bodyType,
    year: truck.year,
    isAvailable: truck.isAvailable,
  };
}

function toDriverSummary(driver: Driver): LoadDriverSummary {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    email: driver.email,
    licenseNumber: driver.licenseNumber,
    status: driver.status,
  };
}

async function resolveTruck(
  load: Load,
  shipment: Shipment | undefined,
  awardedBid: Bid | undefined,
  carrierId: string | null,
): Promise<Truck | undefined> {
  if (shipment?.truckId) {
    const truck = await storage.getTruck(shipment.truckId);
    if (truck) return truck;
  }
  if (load.assignedTruckId) {
    const truck = await storage.getTruck(load.assignedTruckId);
    if (truck) return truck;
  }
  if (awardedBid?.truckId) {
    const truck = await storage.getTruck(awardedBid.truckId);
    if (truck) return truck;
  }
  if (carrierId) {
    const carrierTrucks = await storage.getTrucksByCarrier(carrierId);
    if (carrierTrucks.length > 0) return carrierTrucks[0];
  }
  return undefined;
}

async function resolveDriver(
  load: Load,
  shipment: Shipment | undefined,
  awardedBid: Bid | undefined,
  carrier: User | null,
  carrierType: string | null,
): Promise<LoadDriverSummary | null> {
  if (carrierType === "solo" && carrier) {
    return {
      id: carrier.id,
      name: carrier.companyName || carrier.username,
      phone: carrier.phone,
      email: carrier.email,
      licenseNumber: null,
      status: "available",
    };
  }

  if (shipment?.driverId) {
    const driver = await storage.getDriver(shipment.driverId);
    if (driver) return toDriverSummary(driver);
  }

  if (awardedBid?.driverId) {
    const driver = await storage.getDriver(awardedBid.driverId);
    if (driver) return toDriverSummary(driver);
  }

  return null;
}

async function enrichBid(bid: Bid): Promise<EnrichedBid> {
  const carrier = await storage.getUser(bid.carrierId);
  const carrierProfile = await storage.getCarrierProfile(bid.carrierId);
  const truck = bid.truckId ? await storage.getTruck(bid.truckId) : null;
  const driver = bid.driverId ? await storage.getDriver(bid.driverId) : null;
  const carrierType = bid.carrierType || carrierProfile?.carrierType || "enterprise";
  let carrierSummary: Omit<User, "password"> | null = null;
  if (carrier) {
    const { password: _password, ...rest } = carrier;
    carrierSummary = rest;
  }

  return {
    ...bid,
    carrierType,
    carrier: carrierSummary,
    carrierProfile: carrierProfile
      ? {
          fleetSize: carrierProfile.fleetSize,
          carrierType: carrierProfile.carrierType,
          operatingRegion: carrierProfile.operatingRegion,
          verificationStatus: (carrierProfile as { verificationStatus?: string }).verificationStatus ?? null,
        }
      : null,
    truck: truck
      ? {
          id: truck.id,
          registrationNumber: truck.registrationNumber,
          manufacturer: truck.make,
          model: truck.model,
          capacity: truck.capacity,
          truckType: truck.truckType,
        }
      : null,
    driver: driver ? toDriverSummary(driver) : null,
  };
}

function getLowestBid(bids: EnrichedBid[]): number | null {
  if (bids.length === 0) return null;
  const amounts = bids
    .map((b) => {
      const amt = b.amount;
      if (amt === null || amt === undefined) return Infinity;
      return typeof amt === "number" ? amt : parseFloat(String(amt));
    })
    .filter((a) => !isNaN(a) && a !== Infinity);
  return amounts.length > 0 ? Math.min(...amounts) : null;
}

async function buildBidsSection(loadId: string): Promise<LoadBidsSection> {
  const bidsList = await storage.getBidsByLoad(loadId);
  const enriched = await Promise.all(bidsList.map(enrichBid));
  const soloBids = enriched.filter((b) => b.carrierType === "solo");
  const enterpriseBids = enriched.filter((b) => b.carrierType === "enterprise");

  return {
    soloBids,
    enterpriseBids,
    allBids: enriched,
    summary: {
      totalBids: enriched.length,
      soloBidCount: soloBids.length,
      enterpriseBidCount: enterpriseBids.length,
      lowestSoloBid: getLowestBid(soloBids),
      lowestEnterpriseBid: getLowestBid(enterpriseBids),
    },
  };
}

function shouldIncludeBidsForUser(user: User, load: Load): boolean {
  if (user.role !== "shipper") return true;
  return FINALIZED_LOAD_STATUSES.has(load.status || "");
}

export async function buildLoadDetailsResponse(
  load: Load,
  user: User,
): Promise<LoadDetailsResponse> {
  const assignmentType = getLoadAssignmentType(load);
  const shipment = await storage.getShipmentByLoad(load.id);
  const awardedBid = load.awardedBidId ? await storage.getBid(load.awardedBidId) : undefined;

  let shipper: LoadUserSummary | null = null;
  if (load.shipperId) {
    const shipperUser = await storage.getUser(load.shipperId);
    if (shipperUser) shipper = toUserSummary(shipperUser);
  }

  let assignedCarrier: LoadUserSummary | null = null;
  let carrierProfile = null;
  if (load.assignedCarrierId) {
    const carrierUser = await storage.getUser(load.assignedCarrierId);
    if (carrierUser) assignedCarrier = toUserSummary(carrierUser);
    carrierProfile = await storage.getCarrierProfile(load.assignedCarrierId);
  }

  const carrierType = carrierProfile?.carrierType || null;
  const carrierUser = load.assignedCarrierId ? await storage.getUser(load.assignedCarrierId) : null;
  const truck = await resolveTruck(load, shipment, awardedBid, load.assignedCarrierId);
  const driver = await resolveDriver(load, shipment, awardedBid, carrierUser ?? null, carrierType);

  let shipmentSummary: LoadShipmentSummary | null = null;
  if (shipment || truck || driver) {
    shipmentSummary = {
      id: shipment?.id || "",
      status: shipment?.status || "pending",
      truckId: shipment?.truckId || load.assignedTruckId || truck?.id || null,
      driverId: shipment?.driverId || awardedBid?.driverId || null,
      startOtpVerified: shipment?.startOtpVerified,
      endOtpVerified: shipment?.endOtpVerified,
      truck: truck ? toTruckSummary(truck) : null,
      driver,
    };
  }

  const carrierOnboarding = carrierProfile
    ? {
        carrierType: carrierProfile.carrierType,
        fleetSize: carrierProfile.fleetSize,
      }
    : null;

  let directAssignment: DirectAssignmentSection | null = null;
  if (assignmentType === "direct" && assignedCarrier) {
    directAssignment = {
      carrier: assignedCarrier,
      truck: truck ? toTruckSummary(truck) : null,
      driver,
      carrierPayout: load.finalPrice,
      shipperPrice: load.adminFinalPrice,
      assignedAt: load.awardedAt || load.statusChangedAt || null,
      assignedBy: "admin",
      pickupId: load.pickupId,
    };
  }

  let bids: LoadBidsSection | null = null;
  let winningBid: EnrichedBid | null = null;

  if (assignmentType !== "direct" && shouldIncludeBidsForUser(user, load)) {
    bids = await buildBidsSection(load.id);
    if (load.awardedBidId) {
      winningBid = bids.allBids.find((b) => b.id === load.awardedBidId) || null;
      if (!winningBid) {
        const bid = await storage.getBid(load.awardedBidId);
        if (bid) winningBid = await enrichBid(bid);
      }
    }
  } else if (assignmentType === "bid" && load.awardedBidId) {
    const bid = await storage.getBid(load.awardedBidId);
    if (bid) winningBid = await enrichBid(bid);
  }

  return {
    load,
    assignmentType,
    shipper,
    assignedCarrier,
    carrierOnboarding,
    shipment: shipmentSummary,
    directAssignment,
    bids,
    winningBid,
  };
}

export function getAssignmentTypeForList(load: Load): LoadAssignmentType {
  return getLoadAssignmentType(load);
}
