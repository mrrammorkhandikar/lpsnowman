export const RECEIPT_CATEGORIES = [
  { key: "fuel_receipt", label: "Fuel Receipt" },
  { key: "toll_receipt", label: "Toll Receipt" },
  { key: "maintenance_receipt", label: "Maintenance Receipt" },
  { key: "other_receipt", label: "Other Receipt" },
] as const;

export type ReceiptCategoryKey = (typeof RECEIPT_CATEGORIES)[number]["key"];

export const RECEIPT_CATEGORY_KEYS: ReceiptCategoryKey[] = RECEIPT_CATEGORIES.map(
  (category) => category.key
);

export function isReceiptDocumentType(documentType: string | null | undefined): boolean {
  const type = (documentType || "").trim();
  return (
    type === "receipts" ||
    type === "receipt" ||
    RECEIPT_CATEGORY_KEYS.includes(type as ReceiptCategoryKey)
  );
}

/** Persist generic receipt uploads as Other Receipt. */
export function normalizeReceiptUploadType(documentType: string): string {
  if (documentType === "receipts" || documentType === "receipt") {
    return "other_receipt";
  }
  return documentType;
}

export function receiptCategoryKey(documentType: string | null | undefined): ReceiptCategoryKey {
  const type = (documentType || "").trim();
  if (RECEIPT_CATEGORY_KEYS.includes(type as ReceiptCategoryKey)) {
    return type as ReceiptCategoryKey;
  }
  return "other_receipt";
}

export function receiptCategoryLabel(documentType: string | null | undefined): string {
  const key = receiptCategoryKey(documentType);
  return RECEIPT_CATEGORIES.find((category) => category.key === key)?.label || "Other Receipt";
}

export function getReceiptsForCategory<T extends { documentType: string }>(
  documents: T[] | null | undefined,
  categoryKey: string
): T[] {
  const docs = documents || [];
  return docs.filter((doc) => isReceiptDocumentType(doc.documentType) && receiptCategoryKey(doc.documentType) === categoryKey);
}

export function getAllReceiptDocuments<T extends { documentType: string }>(
  documents: T[] | null | undefined
): T[] {
  return (documents || []).filter((doc) => isReceiptDocumentType(doc.documentType));
}
