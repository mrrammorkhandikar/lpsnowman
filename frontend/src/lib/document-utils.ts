// Utility helpers for working with document URLs returned by the backend.
// Normalizes legacy values (plain keys, missing prefixes) into a URL that
// the frontend can safely use in img/iframe/src and download links.
import { getApiUrl } from "@/lib/api-client";

/** Parsed upload metadata: JSON from DocumentUpload stores { path, name, size? }; some clients use storageKey/objectPath. */
export interface ParsedStoredDocument {
  storagePath: string;
  displayName: string;
  /** Byte size when stored in JSON metadata (upload hook). */
  sizeBytes?: number;
}

/**
 * Turn a DB value (JSON metadata or plain path/URL) into a storage path + display filename.
 */
export function parseStoredDocumentReference(raw: string | null | undefined): ParsedStoredDocument | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const extractFilenameFromPath = (path: string): string => {
    if (!path) return "Document";
    const cleanPath = path.split("?")[0];
    const segments = cleanPath.split("/");
    const filename = segments[segments.length - 1] || "";
    if (/^[a-f0-9-]{36}/i.test(filename)) {
      return "Uploaded Document";
    }
    return filename || "Document";
  };

  if (!value.startsWith("{")) {
    if (value.startsWith("data:")) {
      return { storagePath: value, displayName: "Uploaded Document" };
    }
    return { storagePath: value, displayName: extractFilenameFromPath(value) };
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const path =
      (typeof parsed.path === "string" && parsed.path) ||
      (typeof parsed.storageKey === "string" && parsed.storageKey) ||
      (typeof parsed.objectPath === "string" && parsed.objectPath) ||
      (typeof parsed.fileUrl === "string" && parsed.fileUrl) ||
      "";
    if (!path) return null;
    const name =
      (typeof parsed.name === "string" && parsed.name.trim()) ||
      extractFilenameFromPath(path);
    const sizeRaw = parsed.size;
    const sizeBytes =
      typeof sizeRaw === "number" && Number.isFinite(sizeRaw) && sizeRaw >= 0
        ? Math.round(sizeRaw)
        : undefined;
    return { storagePath: path, displayName: name || "Document", sizeBytes };
  } catch {
    return { storagePath: value, displayName: extractFilenameFromPath(value) };
  }
}

/**
 * Normalize a raw document URL or storage key into a browser-usable URL.
 *
 * Accepted inputs:
 * - Full URLs (http/https, data: URIs)
 * - `/objects/...` paths
 * - Legacy values like `objects/uploads/uuid`, `uploads/uuid`, `/uploads/uuid`
 * - Bare keys like `uuid.pdf` or `documents/uuid.pdf`
 *
 * Output is always one of:
 * - The original http/https/data URL
 * - A normalized `/objects/...` path (in dev) or full API URL in prod
 *   so that the request always targets the backend (api subdomain)
 */
export function getDocumentUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  // Already a fully-qualified URL or data URI.
  // Legacy data may contain localhost absolute URLs even in production.
  // For object-storage routes, normalize those to the configured API origin.
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    if (value.startsWith("data:")) return value;

    try {
      const parsed = new URL(value);
      const isLocalHost =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "0.0.0.0";
      const isObjectRoute =
        parsed.pathname.startsWith("/objects/") ||
        parsed.pathname.startsWith("/uploads/") ||
        parsed.pathname.startsWith("/api/objects/") ||
        parsed.pathname.startsWith("/api/uploads/");

      if (isLocalHost && isObjectRoute) {
        let normalizedPath = parsed.pathname;

        // Normalize older route variants into canonical object route.
        if (normalizedPath.startsWith("/api/objects/")) {
          normalizedPath = normalizedPath.replace("/api/objects/", "/objects/");
        }
        if (normalizedPath.startsWith("/api/uploads/")) {
          normalizedPath = normalizedPath.replace("/api/uploads/", "/uploads/");
        }
        if (normalizedPath.startsWith("/uploads/")) {
          normalizedPath = `/objects${normalizedPath}`;
        }

        return getApiUrl(`${normalizedPath}${parsed.search || ""}`);
      }
    } catch {
      // If URL parsing fails, keep legacy behavior and return original value.
    }

    return value;
  }

  // Already a normalized objects path.
  // In development (no VITE_API_BASE_URL), this stays as `/objects/...`
  // and Vite proxy/Express will route it. In production we MUST hit the
  // API origin, so wrap it with getApiUrl.
  if (value.startsWith("/objects/")) {
    return getApiUrl(value);
  }

  // Missing leading slash on objects path
  if (value.startsWith("objects/")) {
    return getApiUrl(`/${value}`);
  }

  // Legacy uploads paths – map to /objects/uploads/ so backend can resolve to S3
  if (value.startsWith("/uploads/")) {
    return getApiUrl(`/objects${value}`);
  }
  if (value.startsWith("uploads/")) {
    return getApiUrl(`/objects/${value}`);
  }

  // Fallback: treat as a key relative to /objects/
  const cleaned = value.replace(/^\/+/, "");
  return getApiUrl(`/objects/${cleaned}`);
}

/** Resolve JSON metadata or plain paths into display fields + browser preview URL. */
export function resolveDocumentDisplay(
  rawUrl: string | null | undefined,
  rawFileName?: string | null,
): {
  storagePath: string;
  displayName: string;
  previewUrl: string | null;
  fileSize?: number;
} {
  const fromUrl = parseStoredDocumentReference(rawUrl);
  const fromName =
    rawFileName?.trim().startsWith("{") ? parseStoredDocumentReference(rawFileName) : null;
  const storagePath = fromUrl?.storagePath ?? fromName?.storagePath ?? String(rawUrl ?? "").trim();
  const displayName =
    fromUrl?.displayName ?? fromName?.displayName ?? (rawFileName?.trim() || "Document");
  return {
    storagePath,
    displayName,
    previewUrl: getDocumentUrl(storagePath),
    fileSize: fromUrl?.sizeBytes ?? fromName?.sizeBytes,
  };
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic", "heif"]);

/** Infer whether a stored document is likely an image or PDF for preview routing. */
export function inferDocumentMediaKind(
  storagePath: string,
  displayName: string,
  documentType?: string,
): "pdf" | "image" | "unknown" {
  const lowerPath = storagePath.toLowerCase();
  const fromPath = (lowerPath.split("?")[0].split("/").pop() || "").split(".").pop() || "";
  const fromNameRaw = (displayName.split(".").pop() || "").toLowerCase();
  const fromName = fromNameRaw.length <= 5 ? fromNameRaw : "";
  const ext = fromPath || fromName;

  if (ext === "pdf" || lowerPath.endsWith(".pdf")) return "pdf";
  if (
    IMAGE_EXTENSIONS.has(ext) ||
    lowerPath.endsWith(".png") ||
    lowerPath.endsWith(".jpg") ||
    lowerPath.endsWith(".jpeg") ||
    lowerPath.startsWith("data:image/") ||
    lowerPath.includes("/assets/generated_images/")
  ) {
    return "image";
  }

  const imageDocTypes = new Set([
    "license",
    "driving_license",
    "aadhaar",
    "aadhar",
    "selfie",
    "pan",
    "pan_card",
    "loading_photos",
    "pod",
  ]);
  if (documentType && imageDocTypes.has(documentType)) {
    return "image";
  }

  return "unknown";
}

