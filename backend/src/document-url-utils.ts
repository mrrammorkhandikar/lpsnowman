/** Collapse alias document types for URL matching. */
export function normalizeDocumentType(type: string): string {
  if (type === "driving_license") return "license";
  if (type === "aadhar") return "aadhaar";
  if (type === "pan_card") return "pan";
  return type;
}

/** Normalize stored document URLs/JSON metadata for deduplication. */
export function documentStorageKey(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      const path =
        (typeof parsed.path === "string" && parsed.path) ||
        (typeof parsed.objectPath === "string" && parsed.objectPath) ||
        (typeof parsed.fileUrl === "string" && parsed.fileUrl) ||
        (typeof parsed.storageKey === "string" && parsed.storageKey) ||
        value;
      return path.replace(/^\/+/, "").split("?")[0].toLowerCase();
    } catch {
      // fall through
    }
  }

  return value.replace(/^\/+/, "").split("?")[0].toLowerCase();
}

export function documentMatchKey(documentType: string, raw: string): string {
  return `${normalizeDocumentType(documentType)}:${documentStorageKey(raw)}`;
}
