import { createHash } from "crypto";
import type { FinanceReview, Load, Shipment, Driver, User } from "@shared/schema";
import { BC_EXTERNAL_PREFIX, BC_META_PREFIX } from "./config";
import type { BcLoadRecord } from "./client";

export type TripType = "carrier_fix" | "driver_fix";

export type LoadPilotSnapshot = {
  loadId: string;
  loadNumber: string;
  shipperId: string;
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

export function normalizeLoadId(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
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
    shipperId: load.shipperId || "",
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
  if (value === "not_released" || value.includes("not_released")) return "not_released";
  if (value === "processing" || value.includes("processing")) return "processing";
  if (value === "released") return "released";
  return "not_released";
}

export function toLoadBody(snapshot: LoadPilotSnapshot): Record<string, unknown> {
  const price = Number.parseFloat(snapshot.price);
  return {
    loadId: clip(snapshot.loadId, 50).toUpperCase(),
    loadNumber: clip(snapshot.loadNumber, 30),
    shipperId: clip(snapshot.shipperId, 50),
    shipperName: clip(snapshot.shipperName, 100),
    pickupAddress: clip(snapshot.pickupAddress, 250),
    pickupCity: clip(snapshot.pickupCity, 50),
    pickupState: clip(snapshot.pickupState, 50),
    pickupPincode: clip(snapshot.pickupPincode, 20),
    dropoffAddress: clip(snapshot.dropoffAddress, 250),
    dropoffCity: clip(snapshot.dropoffCity, 50),
    dropoffState: clip(snapshot.dropoffState, 50),
    dropoffPincode: clip(snapshot.dropoffPincode, 20),
    loadStatus: clip(snapshot.loadStatus, 50),
    tripType: clip(snapshot.tripType, 20),
    driverName: clip(snapshot.driverName, 100),
    paymentStatus: clip(snapshot.paymentStatus, 30),
    price: Number.isFinite(price) ? price : 0,
    pickupDate: snapshot.pickupDate || undefined,
    deliveryDate: snapshot.deliveryDate || undefined,
  };
}

export function snapshotFromBcLoad(record: BcLoadRecord): Partial<LoadPilotSnapshot> {
  return {
    loadId: record.loadId || "",
    loadNumber: record.loadNumber || "",
    shipperId: record.shipperId || "",
    pickupAddress: record.pickupAddress || "",
    pickupCity: record.pickupCity || "",
    pickupState: record.pickupState || "",
    pickupPincode: record.pickupPincode || "",
    dropoffAddress: record.dropoffAddress || "",
    dropoffCity: record.dropoffCity || "",
    dropoffState: record.dropoffState || "",
    dropoffPincode: record.dropoffPincode || "",
    loadStatus: record.loadStatus || "",
    tripType: (record.tripType as TripType) || undefined,
    driverName: record.driverName || "",
    paymentStatus: parsePaymentStatus(record.paymentStatus),
    shipperName: record.shipperName || "",
    pickupDate: record.pickupDate || null,
    deliveryDate: record.deliveryDate || null,
    price: record.price == null ? "" : String(record.price),
  };
}

export function diffSnapshots(
  ours: LoadPilotSnapshot,
  bc: Partial<LoadPilotSnapshot>,
): string[] {
  const fields: Array<keyof LoadPilotSnapshot> = [
    "loadNumber",
    "pickupCity",
    "dropoffCity",
    "loadStatus",
    "tripType",
    "driverName",
    "paymentStatus",
  ];
  const mismatches: string[] = [];
  for (const field of fields) {
    const a = String(ours[field] ?? "");
    const b = String(bc[field] ?? "");
    if (a !== b) mismatches.push(field);
  }
  return mismatches;
}
