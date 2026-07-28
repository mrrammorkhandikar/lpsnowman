import { documentMatchKey, normalizeDocumentType } from "./document-url-utils";
import type { Driver } from "@shared/schema";
import type { DatabaseStorage } from "./storage";
export function extractDocumentStoragePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      const path =
        (typeof parsed.path === "string" && parsed.path) ||
        (typeof parsed.objectPath === "string" && parsed.objectPath) ||
        (typeof parsed.fileUrl === "string" && parsed.fileUrl) ||
        (typeof parsed.storageKey === "string" && parsed.storageKey) ||
        null;
      return path?.trim() || null;
    } catch {
      return value;
    }
  }

  return value;
}

export function normalizeDriverProfileImageUrl(raw: string | null | undefined): string | null {
  return extractDocumentStoragePath(raw);
}

type ProfileDocSpec = {
  type: string;
  rawUrl: string | null | undefined;
  fileName: string;
  expiryDate?: Date | null;
};

/**
 * Ensure driver license/aadhaar profile images exist in `documents` with canonical paths.
 * Also normalizes legacy JSON values on the driver row.
 */
export type SyncDriverProfileDocumentsOptions = {
  /** Document types (license, aadhaar) that passed Surepass/local KYC at upload time. */
  verifiedTypes?: Set<string>;
};

export async function syncDriverProfileDocuments(
  storage: DatabaseStorage,
  driver: Driver,
  options?: SyncDriverProfileDocumentsOptions,
): Promise<Driver> {
  const verifiedTypes = options?.verifiedTypes ?? new Set<string>();
  if (!driver.userId) return driver;

  const specs: ProfileDocSpec[] = [
    {
      type: "license",
      rawUrl: driver.licenseImageUrl,
      fileName: "Driving License",
      expiryDate: driver.licenseExpiry,
    },
    {
      type: "aadhaar",
      rawUrl: driver.aadhaarImageUrl,
      fileName: "Aadhaar Card",
    },
  ];

  const driverUpdates: Partial<Driver> = {};
  const existing = await storage.getDocumentsByDriver(driver.id);

  for (const spec of specs) {
    const storagePath = extractDocumentStoragePath(spec.rawUrl);
    if (!storagePath) continue;

    const normalizedType = normalizeDocumentType(spec.type);

    if (spec.rawUrl !== storagePath) {
      if (normalizedType === "license") driverUpdates.licenseImageUrl = storagePath;
      if (normalizedType === "aadhaar") driverUpdates.aadhaarImageUrl = storagePath;
    }

    const urlKey = documentMatchKey(normalizedType, storagePath);
    const matchByUrl = existing.find(
      (doc) =>
        !doc.loadId &&
        documentMatchKey(doc.documentType, doc.fileUrl) === urlKey,
    );

    const markVerified = verifiedTypes.has(normalizedType);

    if (matchByUrl) {
      const updates: { fileUrl?: string; isVerified?: boolean } = {};
      if (extractDocumentStoragePath(matchByUrl.fileUrl) !== storagePath) {
        updates.fileUrl = storagePath;
      }
      if (markVerified && matchByUrl.isVerified !== true) {
        updates.isVerified = true;
      }
      if (Object.keys(updates).length > 0) {
        await storage.updateDocument(matchByUrl.id, updates);
      }
      continue;
    }

    const sameType = existing.find(
      (doc) => !doc.loadId && normalizeDocumentType(doc.documentType) === normalizedType,
    );

    if (sameType) {
      await storage.updateDocument(sameType.id, {
        fileUrl: storagePath,
        fileName: spec.fileName,
        expiryDate: spec.expiryDate ?? sameType.expiryDate,
        ...(markVerified ? { isVerified: true } : {}),
      });
      continue;
    }

    await storage.createDocument({
      userId: driver.userId,
      driverId: driver.id,
      documentType: normalizedType,
      fileName: spec.fileName,
      fileUrl: storagePath,
      fileSize: 0,
      expiryDate: spec.expiryDate ?? null,
      isVerified: markVerified,
    });
  }

  if (Object.keys(driverUpdates).length === 0) {
    return driver;
  }

  const updated = await storage.updateDriver(driver.id, driverUpdates);
  return updated ?? { ...driver, ...driverUpdates };
}
