import { createHash } from "crypto";
import type { FinanceReview, Load, Shipment, Driver, User } from "@shared/schema";
import { BC_EXTERNAL_PREFIX, BC_META_PREFIX } from "./config";
import type { BcSalesOrder } from "./client";

export type TripType = "carrier_fix" | "driver_fix";

export type LoadPilotSnapshot = {
  loadId: string;
  loadNumber: string;
  pickupAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupPincode: string;
  dropoffAddress: string;
  dropoffCity: string;
  dropoffState: string;
  dropoffPincode: string;
  loadStatus: string;
  tripType: TripType;
  driverName: string;
  paymentStatus: string;
  advanceReleased: boolean;
  price: string;
  shipperName: string;
  phone: string;
  pickupDate: string | null;
  deliveryDate: string | null;
};

export function compactLoadId(loadId: string): string {
  return `${BC_EXTERNAL_PREFIX}${loadId.replace(/-/g, "").slice(0, 32)}`;
}

export function loadIdFromExternal(external: string | null | undefined): string | null {
  if (!external || !external.startsWith(BC_EXTERNAL_PREFIX)) return null;
  const hex = external.slice(BC_EXTERNAL_PREFIX.length);
  if (hex.length !== 32) return null;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function resolveTripType(load: Load): TripType {
  return load.adminPostMode === "assign" ? "driver_fix" : "carrier_fix";
}

export function formatLoadNumber(load: Load): string {
  const n = load.shipperLoadNumber ?? load.adminReferenceNumber;
  if (n) return `LD-${String(n).padStart(3, "0")}`;
  return load.id.slice(0, 8);
}

function clip(value: string | null | undefined, max: number): string {
  return (value || "").trim().slice(0, max);
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function buildSnapshot(input: {
  load: Load;
  shipment?: Shipment | null;
  driver?: Driver | null;
  shipper?: User | null;
  review?: FinanceReview | null;
}): LoadPilotSnapshot {
  const { load, shipment, driver, shipper, review } = input;
  return {
    loadId: load.id,
    loadNumber: formatLoadNumber(load),
    pickupAddress: load.pickupAddress || "",
    pickupCity: load.pickupCity || "",
    pickupState: load.pickupState || "",
    pickupPincode: load.pickupPincode || "",
    dropoffAddress: load.dropoffAddress || "",
    dropoffCity: load.dropoffCity || "",
    dropoffState: load.dropoffState || "",
    dropoffPincode: load.dropoffPincode || "",
    loadStatus: load.status || "",
    tripType: resolveTripType(load),
    driverName: driver?.name || "",
    paymentStatus: review?.paymentStatus || "not_released",
    advanceReleased: Boolean(review?.advancePaymentReleasedAt),
    price: String(load.finalPrice || load.adminFinalPrice || load.estimatedPrice || ""),
    shipperName:
      load.shipperCompanyName ||
      load.shipperContactName ||
      shipper?.companyName ||
      shipper?.username ||
      "",
    phone: load.shipperPhone || shipper?.phone || "",
    pickupDate: isoDate(load.pickupDate),
    deliveryDate: isoDate(load.deliveryDate),
  };
}

export function snapshotHash(snapshot: LoadPilotSnapshot): string {
  const canonical = JSON.stringify(snapshot);
  return createHash("sha256").update(canonical).digest("hex");
}

export function encodeMeta(snapshot: LoadPilotSnapshot): string {
  const advance = snapshot.advanceReleased ? "adv1" : "adv0";
  return clip(
    `${BC_META_PREFIX}${snapshot.loadStatus}|${snapshot.tripType}|${advance}|${snapshot.loadNumber}|${snapshot.paymentStatus}`,
    100,
  );
}

export function parseMeta(line: string | null | undefined): {
  loadStatus?: string;
  tripType?: string;
  advanceReleased?: boolean;
  loadNumber?: string;
  paymentStatus?: string;
} {
  if (!line || !line.startsWith(BC_META_PREFIX)) return {};
  const [loadStatus, tripType, advance, loadNumber, paymentStatus] = line
    .slice(BC_META_PREFIX.length)
    .split("|");
  return {
    loadStatus,
    tripType,
    advanceReleased: advance === "adv1",
    loadNumber,
    paymentStatus,
  };
}

export function parsePaymentStatus(raw: string | null | undefined): string {
  const value = (raw || "").trim().toLowerCase();
  if (value === "released" || value.endsWith("released")) return "released";
  if (value === "processing" || value.includes("processing")) return "processing";
  if (value === "not_released" || value.includes("not_released")) return "not_released";
  return "not_released";
}

function countryCode(stateOrCountry: string): string {
  const v = (stateOrCountry || "").trim().toUpperCase();
  if (!v || v === "INDIA" || v === "IN") return "IN";
  return clip(v, 10) || "IN";
}

export function toSalesOrderBody(
  snapshot: LoadPilotSnapshot,
  customerNumber: string,
): Record<string, unknown> {
  return {
    customerNumber,
    externalDocumentNumber: compactLoadId(snapshot.loadId),
    phoneNumber: clip(snapshot.phone, 30),
    orderDate: snapshot.pickupDate || undefined,
    requestedDeliveryDate: snapshot.deliveryDate || undefined,
    shipToName: clip(snapshot.shipperName || snapshot.dropoffCity, 100),
    shipToContact: clip(snapshot.driverName, 100),
    shipToAddressLine1: clip(snapshot.dropoffAddress, 100),
    shipToCity: clip(snapshot.dropoffCity, 50),
    shipToState: clip(snapshot.dropoffState, 30),
    shipToPostCode: clip(snapshot.dropoffPincode, 20),
    shipToCountry: countryCode(snapshot.dropoffState),
    sellToAddressLine1: clip(snapshot.pickupAddress, 100),
    sellToAddressLine2: encodeMeta(snapshot),
    sellToCity: clip(snapshot.pickupCity, 50),
    sellToState: clip(snapshot.pickupState, 30),
    sellToPostCode: clip(snapshot.pickupPincode, 20),
    sellToCountry: countryCode(snapshot.pickupState),
  };
}

export function snapshotFromBcOrder(order: BcSalesOrder): Partial<LoadPilotSnapshot> & {
  externalDocumentNumber?: string;
} {
  const meta = parseMeta(order.sellToAddressLine2);
  return {
    loadId: loadIdFromExternal(order.externalDocumentNumber) || "",
    loadNumber: meta.loadNumber || "",
    pickupAddress: order.sellToAddressLine1 || "",
    pickupCity: order.sellToCity || "",
    pickupState: order.sellToState || "",
    pickupPincode: order.sellToPostCode || "",
    dropoffAddress: order.shipToAddressLine1 || "",
    dropoffCity: order.shipToCity || "",
    dropoffState: order.shipToState || "",
    dropoffPincode: order.shipToPostCode || "",
    loadStatus: meta.loadStatus || "",
    tripType: (meta.tripType as TripType) || undefined,
    driverName: order.shipToContact || "",
    paymentStatus: parsePaymentStatus(meta.paymentStatus || order.yourReference),
    advanceReleased: meta.advanceReleased || false,
    shipperName: order.shipToName || order.customerName || "",
    phone: order.phoneNumber || "",
    pickupDate: order.orderDate || null,
    deliveryDate: order.requestedDeliveryDate || null,
    externalDocumentNumber: order.externalDocumentNumber || undefined,
  };
}

export function diffSnapshots(
  ours: LoadPilotSnapshot,
  bc: Partial<LoadPilotSnapshot>,
): string[] {
  const fields: Array<keyof LoadPilotSnapshot> = [
    "pickupCity",
    "dropoffCity",
    "loadStatus",
    "tripType",
    "driverName",
    "paymentStatus",
    "advanceReleased",
  ];
  const mismatches: string[] = [];
  for (const field of fields) {
    const a = String(ours[field] ?? "");
    const b = String(bc[field] ?? "");
    if (a !== b) mismatches.push(field);
  }
  return mismatches;
}
