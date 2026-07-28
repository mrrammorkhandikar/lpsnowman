import { useState, useCallback } from "react";
import type { UppyFile } from "@uppy/core";
import { getApiUrl } from "@/lib/api-client";

/** Browsers often report HEIC/HEIF as video/quicktime or ""; normalize using the file extension. */
export function effectiveUploadContentType(fileName: string, declaredMime: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  const raw = (declaredMime || "").trim().toLowerCase();
  return raw || "application/octet-stream";
}

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
  requestId?: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
  metadataHeaders?: Record<string, string>;
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * React hook for handling file uploads with presigned URLs.
 *
 * This hook implements the two-step presigned URL upload flow:
 * 1. Request a presigned URL from your backend (sends JSON metadata, NOT the file)
 * 2. Upload the file directly to the presigned URL
 *
 * @example
 * ```tsx
 * function FileUploader() {
 *   const { uploadFile, isUploading, error } = useUpload({
 *     onSuccess: (response) => {
 *       console.log("Uploaded to:", response.objectPath);
 *     },
 *   });
 *
 *   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (file) {
 *       await uploadFile(file);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleFileChange} disabled={isUploading} />
 *       {isUploading && <p>Uploading...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  /**
   * Request a presigned URL from the backend.
   * IMPORTANT: Send JSON metadata, NOT the file itself.
   */
  // Simple in-memory circuit breaker for /request-url
  const BREAKER_THRESHOLD = 5;
  const BREAKER_OPEN_MS = 60_000;
  let breakerState = (globalThis as any).__uploadBreaker || { failures: 0, openUntil: 0 };
  (globalThis as any).__uploadBreaker = breakerState;

  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const now = Date.now();
      if (breakerState.openUntil && now < breakerState.openUntil) {
        throw new Error("Uploads are temporarily unavailable. Please try again shortly.");
      }

      try {
        const response = await fetch(getApiUrl("api/uploads/request-url"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: effectiveUploadContentType(file.name, file.type),
          }),
        });

        if (!response.ok) {
          // Trigger breaker on auth/capacity/server errors
          if ([401,403,429].includes(response.status) || response.status >= 500) {
            breakerState.failures++;
            if (breakerState.failures >= BREAKER_THRESHOLD) {
              breakerState.openUntil = now + BREAKER_OPEN_MS;
            }
          } else {
            breakerState.failures = 0;
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to get upload URL (HTTP ${response.status})`);
        }

        breakerState.failures = 0; // reset on success
        return response.json();
      } catch (e) {
        // Network errors also count toward breaker
        breakerState.failures++;
        if (breakerState.failures >= BREAKER_THRESHOLD) {
          breakerState.openUntil = now + BREAKER_OPEN_MS;
        }
        throw e instanceof Error ? e : new Error("Failed to get upload URL");
      }
    },
    []
  );

  /**
   * Upload a file directly to the presigned URL.
   */
  const uploadToPresignedUrl = useCallback(
    async (file: File, uploadURL: string, extraHeaders?: Record<string, string>): Promise<Response> => {
      let attempt = 0;
      const maxAttempts = 5;
      let lastError: unknown = null;
      while (attempt < maxAttempts) {
        try {
          const ct = effectiveUploadContentType(file.name, file.type);
          const response = await fetch(uploadURL, {
            method: "PUT",
            body: file,
            headers: {
              "Content-Type": ct,
              ...(extraHeaders || {}),
            },
          });
          if (response.ok) {
            return response;
          }
          if (!(response.status === 429 || response.status >= 500)) {
            return response;
          }
        } catch (e) {
          lastError = e;
        }
        const base = 200;
        const delay = base * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
      }
      if (lastError instanceof Error) {
        throw lastError;
      }
      throw new Error("Upload failed after retries");
    },
    []
  );

  /**
   * POST file bytes through API → often blocked by AWS WAF/ALB (403 HTML) on production.
   */
  const uploadViaApiProxy = useCallback(async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetch(getApiUrl("api/uploads/upload-file"), {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed (HTTP ${response.status})`);
    }

    const data = await response.json();
    return {
      uploadURL: "",
      objectPath: data.objectPath,
      metadata: data.metadata,
    };
  }, []);

  /**
   * Default upload: presigned S3 PUT first (only a small JSON POST hits the API; file goes to S3 — avoids ALB/WAF on /upload-file).
   * Falls back to API proxy for local dev when presigned PUT fails (e.g. localhost CORS).
   *
   * Production S3 bucket must allow CORS: PUT from https://www.loadpilot.in (and apex), AllowedHeaders Content-Type + x-amz-*.
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(15);

        try {
          const presign = await requestUploadUrl(file);
          setProgress(45);
          const putRes = await uploadToPresignedUrl(file, presign.uploadURL, presign.metadataHeaders);
          if (!putRes.ok) {
            const snippet = await putRes.text().catch(() => "");
            throw new Error(
              `Direct upload failed (${putRes.status})${snippet ? `: ${snippet.slice(0, 200)}` : ""}`,
            );
          }
          const uploadResponse: UploadResponse = {
            uploadURL: presign.uploadURL,
            objectPath: presign.objectPath,
            metadata: presign.metadata,
          };
          setProgress(100);
          options.onSuccess?.(uploadResponse);
          return uploadResponse;
        } catch (presignErr) {
          console.warn("[useUpload] Presigned upload failed, falling back to API proxy:", presignErr);
          setProgress(55);
          const fallback = await uploadViaApiProxy(file);
          setProgress(100);
          options.onSuccess?.(fallback);
          return fallback;
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [options, requestUploadUrl, uploadToPresignedUrl, uploadViaApiProxy]
  );

  /**
   * Get upload parameters for Uppy's AWS S3 plugin.
   *
   * IMPORTANT: This function receives the UppyFile object from Uppy.
   * Use file.name, file.size, file.type to request per-file presigned URLs.
   *
   * Use this with the ObjectUploader component:
   * ```tsx
   * <ObjectUploader onGetUploadParameters={getUploadParameters}>
   *   Upload
   * </ObjectUploader>
   * ```
   */
  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      // Use the actual file properties to request a per-file presigned URL
      const response = await fetch(getApiUrl("api/uploads/request-url"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: effectiveUploadContentType(file.name || "", file.type || ""),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const data: UploadResponse = await response.json();
      const ct = effectiveUploadContentType(file.name || "", file.type || "");
      return {
        method: "PUT",
        url: data.uploadURL,
        headers: {
          "Content-Type": ct,
          ...(data.metadataHeaders || {}),
        },
      };
    },
    []
  );

  return {
    uploadFile,
    getUploadParameters,
    isUploading,
    error,
    progress,
  };
}

/**
 * Same upload strategy as `useUpload().uploadFile` for callers that cannot use the hook (e.g. `useMutation` handlers).
 * Presigned S3 PUT first, then multipart proxy fallback.
 */
export async function uploadFileWithPresignedFallback(file: File): Promise<UploadResponse> {
  const ct = effectiveUploadContentType(file.name, file.type);

  async function presigned(): Promise<UploadResponse> {
    const response = await fetch(getApiUrl("api/uploads/request-url"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: ct,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to get upload URL (HTTP ${response.status})`);
    }
    const presign: UploadResponse = await response.json();

    let attempt = 0;
    const maxAttempts = 5;
    while (attempt < maxAttempts) {
      const putRes = await fetch(presign.uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": ct,
          ...(presign.metadataHeaders || {}),
        },
      });
      if (putRes.ok) {
        return presign;
      }
      if (!(putRes.status === 429 || putRes.status >= 500)) {
        const t = await putRes.text().catch(() => "");
        throw new Error(`Direct upload failed (${putRes.status}) ${t.slice(0, 160)}`);
      }
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt) + Math.floor(Math.random() * 80)));
      attempt++;
    }
    throw new Error("Direct upload failed after retries");
  }

  async function proxy(): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file, file.name);
    const response = await fetch(getApiUrl("api/uploads/upload-file"), {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed (HTTP ${response.status})`);
    }
    const data = await response.json();
    return {
      uploadURL: "",
      objectPath: data.objectPath,
      metadata: data.metadata,
    };
  }

  try {
    return await presigned();
  } catch (e) {
    console.warn("[uploadFileWithPresignedFallback] Presigned path failed, trying API proxy:", e);
    return await proxy();
  }
}
