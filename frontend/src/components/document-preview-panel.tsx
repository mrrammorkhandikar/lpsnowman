import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import {
  getDocumentUrl,
  inferDocumentMediaKind,
  resolveDocumentDisplay,
} from "@/lib/document-utils";

function AuthenticatedImage({
  src,
  alt,
  className,
  testId,
  onLoadError,
}: {
  src: string;
  alt: string;
  className?: string;
  testId?: string;
  onLoadError?: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl: string | null = null;

    async function fetchImage() {
      try {
        setLoading(true);
        setBlobUrl(null);

        if (src.startsWith("data:") || src.includes("/assets/")) {
          if (isMounted) {
            setBlobUrl(src);
            setLoading(false);
          }
          return;
        }

        const response = await fetch(src, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        if (isMounted) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error("Document preview load failed:", src, err);
        if (isMounted) {
          setLoading(false);
          onLoadError?.();
        }
      }
    }

    if (src) {
      void fetchImage();
    } else {
      setLoading(false);
      onLoadError?.();
    }

    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [src, onLoadError]);

  if (loading) {
    return (
      <div className={`${className || ""} flex items-center justify-center bg-muted min-h-[280px]`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!blobUrl) {
    return null;
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      data-testid={testId}
      onError={() => onLoadError?.()}
    />
  );
}

export type DocumentPreviewSource = {
  fileUrl?: string | null;
  fileName?: string | null;
  documentType?: string;
};

export function DocumentPreviewPanel({
  document,
  className,
}: {
  document: DocumentPreviewSource;
  className?: string;
}) {
  const [loadError, setLoadError] = useState(false);
  const handleLoadError = useCallback(() => setLoadError(true), []);

  const rawUrl = document.fileUrl ?? "";
  const { storagePath, displayName, previewUrl } = resolveDocumentDisplay(
    rawUrl,
    document.fileName,
  );

  useEffect(() => {
    setLoadError(false);
  }, [rawUrl, document.fileName]);

  if (!storagePath || !previewUrl) {
    return (
      <div
        className={`w-full min-h-[280px] rounded-lg bg-muted flex items-center justify-center ${className || ""}`}
        data-testid="document-preview-fallback"
      >
        <div className="text-center text-muted-foreground p-4">
          <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No preview available</p>
          <p className="text-xs">{displayName}</p>
        </div>
      </div>
    );
  }

  const mediaKind = inferDocumentMediaKind(storagePath, displayName, document.documentType);

  if (mediaKind === "pdf" && !loadError) {
    return (
      <div className={`w-full min-h-[280px] max-h-[55vh] overflow-hidden ${className || ""}`}>
        <iframe
          src={previewUrl}
          title={displayName}
          className="w-full border-0 bg-white min-h-[280px]"
          style={{ height: "55vh" }}
          data-testid="document-preview-pdf"
        />
      </div>
    );
  }

  if ((mediaKind === "image" || mediaKind === "unknown") && !loadError) {
    return (
      <div className={`w-full flex items-center justify-center bg-muted min-h-[280px] max-h-[55vh] overflow-hidden ${className || ""}`}>
        <AuthenticatedImage
          src={previewUrl}
          alt={displayName}
          className="w-full h-auto max-h-[55vh] object-contain"
          testId="img-document-preview"
          onLoadError={handleLoadError}
        />
      </div>
    );
  }

  return (
    <div
      className={`w-full min-h-[280px] rounded-lg bg-muted flex items-center justify-center ${className || ""}`}
      data-testid="document-preview-fallback"
    >
      <div className="text-center text-muted-foreground p-4">
        <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Preview could not be loaded</p>
        <p className="text-xs">{displayName}</p>
      </div>
    </div>
  );
}

export function getDocumentOpenUrl(document: DocumentPreviewSource): string | null {
  const { storagePath } = resolveDocumentDisplay(document.fileUrl, document.fileName);
  return getDocumentUrl(storagePath);
}
