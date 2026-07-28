import type { Bid, Shipment } from "@shared/schema";

/** Shipment statuses that free a truck/driver for reassignment */
export const FLEET_TERMINAL_SHIPMENT_STATUSES = [
  "delivered",
  "closed",
  "cancelled",
  "completed",
] as const;

export function getLoadsWithCompletedShipments(shipments: Shipment[]): Set<string> {
  return new Set(
    shipments
      .filter((s) => FLEET_TERMINAL_SHIPMENT_STATUSES.includes((s.status || "") as typeof FLEET_TERMINAL_SHIPMENT_STATUSES[number]))
      .map((s) => s.loadId),
  );
}

export function getTrucksInActiveShipments(shipments: Shipment[]): Set<string> {
  return new Set(
    shipments
      .filter((s) => s.truckId && !FLEET_TERMINAL_SHIPMENT_STATUSES.includes((s.status || "") as typeof FLEET_TERMINAL_SHIPMENT_STATUSES[number]))
      .map((s) => s.truckId!),
  );
}

export function getDriversInActiveShipments(shipments: Shipment[]): Set<string> {
  return new Set(
    shipments
      .filter((s) => s.driverId && !FLEET_TERMINAL_SHIPMENT_STATUSES.includes((s.status || "") as typeof FLEET_TERMINAL_SHIPMENT_STATUSES[number]))
      .map((s) => s.driverId!),
  );
}

export function getTrucksBlockedByAcceptedBids(
  bids: Bid[],
  loadsWithCompletedShipments: Set<string>,
): Set<string> {
  return new Set(
    bids
      .filter(
        (b) =>
          b.truckId &&
          b.status === "accepted" &&
          !loadsWithCompletedShipments.has(b.loadId),
      )
      .map((b) => b.truckId!),
  );
}

export function getDriversBlockedByAcceptedBids(
  bids: Bid[],
  loadsWithCompletedShipments: Set<string>,
): Set<string> {
  return new Set(
    bids
      .filter(
        (b) =>
          b.driverId &&
          b.status === "accepted" &&
          !loadsWithCompletedShipments.has(b.loadId),
      )
      .map((b) => b.driverId!),
  );
}

export function findBlockingAcceptedBidForTruck(
  bids: Bid[],
  truckId: string,
  loadsWithCompletedShipments: Set<string>,
): Bid | undefined {
  return bids.find(
    (b) =>
      b.truckId === truckId &&
      b.status === "accepted" &&
      !loadsWithCompletedShipments.has(b.loadId),
  );
}

export function findBlockingAcceptedBidForDriver(
  bids: Bid[],
  driverId: string,
  loadsWithCompletedShipments: Set<string>,
): Bid | undefined {
  return bids.find(
    (b) =>
      b.driverId === driverId &&
      b.status === "accepted" &&
      !loadsWithCompletedShipments.has(b.loadId),
  );
}

export interface FleetAvailabilityContext {
  loadsWithCompletedShipments: Set<string>;
  trucksInActiveShipments: Set<string>;
  driversInActiveShipments: Set<string>;
  trucksInAcceptedBids: Set<string>;
  driversInAcceptedBids: Set<string>;
}

export function buildFleetAvailabilityContext(
  shipments: Shipment[],
  bids: Bid[],
): FleetAvailabilityContext {
  const loadsWithCompletedShipments = getLoadsWithCompletedShipments(shipments);
  return {
    loadsWithCompletedShipments,
    trucksInActiveShipments: getTrucksInActiveShipments(shipments),
    driversInActiveShipments: getDriversInActiveShipments(shipments),
    trucksInAcceptedBids: getTrucksBlockedByAcceptedBids(bids, loadsWithCompletedShipments),
    driversInAcceptedBids: getDriversBlockedByAcceptedBids(bids, loadsWithCompletedShipments),
  };
}

export function isTruckFleetAvailable(
  truckId: string,
  ctx: FleetAvailabilityContext,
): boolean {
  return (
    !ctx.trucksInActiveShipments.has(truckId) &&
    !ctx.trucksInAcceptedBids.has(truckId)
  );
}

export function isDriverFleetAvailable(
  driverId: string,
  ctx: FleetAvailabilityContext,
): boolean {
  return (
    !ctx.driversInActiveShipments.has(driverId) &&
    !ctx.driversInAcceptedBids.has(driverId)
  );
}

export const DRIVER_DELETE_BLOCKED_MESSAGE =
  "This driver cannot be deleted while associated trips exist in the system. Set status to Inactive instead, or remove the trips first.";

export const TRUCK_DELETE_BLOCKED_MESSAGE =
  "This truck cannot be deleted while associated trips exist in the system. Mark it unavailable instead, or remove the trips first.";

export function getDriverIdsWithShipmentHistory(shipments: Shipment[]): Set<string> {
  return new Set(
    shipments.filter((s) => s.driverId).map((s) => s.driverId!),
  );
}

export function getTruckIdsWithShipmentHistory(shipments: Shipment[]): Set<string> {
  return new Set(
    shipments.filter((s) => s.truckId).map((s) => s.truckId!),
  );
}

export function canDeleteDriver(driverId: string, shipments: Shipment[]): boolean {
  return !getDriverIdsWithShipmentHistory(shipments).has(driverId);
}

export function canDeleteTruck(truckId: string, shipments: Shipment[]): boolean {
  return !getTruckIdsWithShipmentHistory(shipments).has(truckId);
}
