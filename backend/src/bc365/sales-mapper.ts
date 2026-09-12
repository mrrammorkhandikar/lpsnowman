import type { Invoice, Load, User } from "@shared/schema";
import { formatLoadNumber } from "./mapper";

function clip(value: string | null | undefined, max: number): string {
  return (value || "").trim().slice(0, max);
}

function isoDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

export function shipperCustomerNumber(shipperId: string): string {
  const compact = shipperId.replace(/-/g, "").toUpperCase();
  return `LP${compact.slice(0, 18)}`.slice(0, 20);
}

export function shipperDisplayName(load: Load, shipper?: User | null): string {
  return clip(
    load.shipperCompanyName ||
      load.shipperContactName ||
      shipper?.companyName ||
      shipper?.username ||
      "LoadPilot Shipper",
    100,
  );
}

export function loadOrderExternalNumber(load: Load): string {
  return clip(formatLoadNumber(load), 35);
}

export function memoInvoiceExternalNumber(invoice: Invoice, load: Load): string {
  return clip(invoice.invoiceNumber || `MEMO-${formatLoadNumber(load)}`, 35);
}

export function freightLineDescription(load: Load): string {
  const goods = load.goodsToBeCarried || load.materialType || "Freight";
  const weight = load.weight ? `${load.weight} ${load.weightUnit || "MT"}` : "";
  const route = `${load.pickupCity || "Pickup"} to ${load.dropoffCity || "Drop"}`;
  return clip(`${formatLoadNumber(load)}: ${route} | ${goods}${weight ? ` | ${weight}` : ""}`, 100);
}

export function documentAmount(load: Load, invoice?: Invoice | null): number {
  const fromMemo = Number.parseFloat(String(invoice?.totalAmount ?? ""));
  if (Number.isFinite(fromMemo) && fromMemo > 0) return fromMemo;
  const fromLoad = Number.parseFloat(
    String(load.finalPrice || load.adminFinalPrice || load.estimatedPrice || "0"),
  );
  return Number.isFinite(fromLoad) ? fromLoad : 0;
}

export function customerBody(
  load: Load,
  shipper?: User | null,
  country?: string | null,
): Record<string, unknown> {
  return {
    number: shipperCustomerNumber(load.shipperId),
    displayName: shipperDisplayName(load, shipper),
    type: "Company",
    phoneNumber: clip(load.shipperPhone || shipper?.phone, 30) || undefined,
    addressLine1: clip(load.shipperCompanyAddress || load.pickupAddress, 100) || undefined,
    city: clip(load.pickupCity, 30) || undefined,
    postalCode: clip(load.pickupPincode, 20) || undefined,
    country: country || undefined,
  };
}

export function salesOrderBody(
  load: Load,
  customerNumber: string,
  country?: string | null,
): Record<string, unknown> {
  return {
    customerNumber,
    externalDocumentNumber: loadOrderExternalNumber(load),
    orderDate: isoDate(load.createdAt) || isoDate(new Date()),
    requestedDeliveryDate: isoDate(load.deliveryDate) || isoDate(load.pickupDate),
    phoneNumber: clip(load.shipperPhone, 30) || undefined,
    sellToAddressLine1: clip(load.pickupAddress, 100) || undefined,
    sellToCity: clip(load.pickupCity, 30) || undefined,
    sellToPostCode: clip(load.pickupPincode, 20) || undefined,
    sellToCountry: country || undefined,
    shipToName: clip(load.dropoffBusinessName || load.receiverName || load.dropoffCity, 100) || undefined,
    shipToAddressLine1: clip(load.dropoffAddress, 100) || undefined,
    shipToCity: clip(load.dropoffCity, 30) || undefined,
    shipToPostCode: clip(load.dropoffPincode, 20) || undefined,
    shipToCountry: country || undefined,
  };
}

export function salesInvoiceBody(
  load: Load,
  invoice: Invoice,
  customerNumber: string,
  country?: string | null,
): Record<string, unknown> {
  return {
    customerNumber,
    externalDocumentNumber: memoInvoiceExternalNumber(invoice, load),
    invoiceDate: isoDate(invoice.sentAt || invoice.createdAt) || isoDate(new Date()),
    dueDate: isoDate(invoice.dueDate),
    phoneNumber: clip(load.shipperPhone, 30) || undefined,
    sellToAddressLine1: clip(load.pickupAddress, 100) || undefined,
    sellToCity: clip(load.pickupCity, 30) || undefined,
    sellToPostCode: clip(load.pickupPincode, 20) || undefined,
    sellToCountry: country || undefined,
    shipToName: clip(load.dropoffBusinessName || load.receiverName || load.dropoffCity, 100) || undefined,
    shipToAddressLine1: clip(load.dropoffAddress, 100) || undefined,
    shipToCity: clip(load.dropoffCity, 30) || undefined,
    shipToPostCode: clip(load.dropoffPincode, 20) || undefined,
    shipToCountry: country || undefined,
  };
}

export function freightLineBody(
  lineType: string,
  objectNumber: string,
  load: Load,
  amount: number,
): Record<string, unknown> {
  return {
    lineType,
    ...(lineType === "Comment" ? {} : { lineObjectNumber: objectNumber }),
    description: freightLineDescription(load),
    quantity: 1,
    unitPrice: amount,
  };
}

export function odataEq(field: string, value: string): string {
  return `${field} eq '${value.replace(/'/g, "''")}'`;
}
