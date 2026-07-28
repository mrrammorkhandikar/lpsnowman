import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useUpload } from "@/hooks/use-upload";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Calendar,
  Download,
  Eye,
  Trash2,
  File,
  X,
  Loader2,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Truck,
  User,
  Package
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getDocumentUrl, parseStoredDocumentReference } from "@/lib/document-utils";

interface Document {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  expiryDate: string | null;
  isVerified: boolean;
  createdAt: string;
  verificationStatus?: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  driverId?: string | null;
  truckId?: string | null;
}

interface ShipmentDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  status: string;
  createdAt: string;
}

interface ShipmentWithDocs {
  id: string;
  loadNumber: number;
  status: string;
  documents: ShipmentDocument[];
}

interface ExpiryData {
  expired: Document[];
  expiringSoon: Document[];
  healthy: Document[];
  summary: {
    totalDocs: number;
    expiredCount: number;
    expiringSoonCount: number;
    healthyCount: number;
  };
}

const documentTypeLabels: Record<string, string> = {
  rc: "Registration Certificate (RC)",
  insurance: "Vehicle Insurance",
  fitness: "Fitness Certificate",
  license: "Driving License",
  puc: "PUC Certificate",
  permit: "Road Permit",
  pan_card: "PAN Card",
  aadhar: "Aadhar Card",
  aadhaar: "Aadhaar Card",
  pod: "Proof of Delivery",
  invoice: "Invoice",
  lr_consignment: "LR/Consignment Note",
  eway_bill: "E-Way Bill",
  weighment_slip: "Weighment Slip",
  other: "Other Document",
};

const documentCategories = {
  truck: ["rc", "insurance", "fitness", "puc", "permit"],
  driver: ["license", "driving_license", "pan_card", "pan", "aadhar", "aadhaar", "selfie"],
  trip: ["pod", "invoice", "lr_consignment", "eway_bill", "weighment_slip"],
  official: ["incorporation", "trade_license", "address_proof", "pan", "gstin", "tan", "gst", "void_cheque", "tds_declaration", "fleet_proof"],
};

/** Canonical path key for matching the same file across storage formats. */
function documentMatchKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = parseStoredDocumentReference(raw);
  const path = parsed?.storagePath ?? raw.trim();
  if (!path) return null;
  return path.replace(/^\/+/, "").toLowerCase();
}

function verifiedFieldsFromEntity(verified?: boolean): Pick<Document, "isVerified" | "verificationStatus"> {
  if (verified === true) {
    return { isVerified: true, verificationStatus: "approved" };
  }
  return { isVerified: false };
}

/** Normalize API rows so Surepass `is_verified` is always readable as `isVerified`. */
function normalizeApiDocument(raw: Record<string, unknown>): Document {
  const isVerified = raw.isVerified === true || raw.is_verified === true;
  return {
    id: String(raw.id ?? ""),
    documentType: String(raw.documentType ?? raw.document_type ?? ""),
    fileName: String(raw.fileName ?? raw.file_name ?? ""),
    fileUrl: String(raw.fileUrl ?? raw.file_url ?? ""),
    fileSize: typeof raw.fileSize === "number" ? raw.fileSize : typeof raw.file_size === "number" ? raw.file_size : undefined,
    expiryDate: (raw.expiryDate ?? raw.expiry_date ?? null) as string | null,
    isVerified,
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    verificationStatus: isVerified
      ? "approved"
      : (raw.verificationStatus ?? raw.verification_status) as Document["verificationStatus"],
    rejectionReason: (raw.rejectionReason ?? raw.rejection_reason) as string | undefined,
    driverId: (raw.driverId ?? raw.driver_id ?? null) as string | null,
    truckId: (raw.truckId ?? raw.truck_id ?? null) as string | null,
  };
}

function isSurepassOrApproved(doc: Document, surepassByUrl: Map<string, boolean>): boolean {
  if (doc.verificationStatus === "approved" || doc.isVerified === true) {
    return true;
  }
  const urlKey = documentMatchKey(doc.fileUrl);
  return urlKey ? surepassByUrl.get(urlKey) === true : false;
}

/** Prefer documents-table rows over synthetic profile/verification entries. */
function dedupeDocumentsPreferDb(docs: Document[]): Document[] {
  const byKey = new Map<string, Document>();
  for (const doc of docs) {
    const urlKey = documentMatchKey(doc.fileUrl);
    if (!urlKey) continue;
    const key = `${doc.documentType}:${urlKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, doc);
      continue;
    }
    const docIsDb = !doc.id.startsWith("driver-") && !doc.id.startsWith("truck-") && !doc.id.startsWith("verification-");
    const existingIsDb = !existing.id.startsWith("driver-") && !existing.id.startsWith("truck-") && !existing.id.startsWith("verification-");
    if (docIsDb && !existingIsDb) {
      byKey.set(key, doc);
    }
  }
  return Array.from(byKey.values());
}

function documentAlreadyListed(
  docs: Document[],
  documentType: string,
  fileUrl: string,
  owner?: { driverId?: string; truckId?: string },
): boolean {
  const urlKey = documentMatchKey(fileUrl);
  return docs.some((d) => {
    if (d.documentType !== documentType) return false;
    if (urlKey && documentMatchKey(d.fileUrl) === urlKey) return true;
    if (owner?.driverId && d.driverId === owner.driverId && d.documentType === documentType) return true;
    if (owner?.truckId && d.truckId === owner.truckId && d.documentType === documentType) return true;
    return false;
  });
}

type VerificationEntry = { status: string; rejectionReason?: string };

function setVerificationEntry(
  map: Record<string, VerificationEntry>,
  key: string,
  entry: VerificationEntry,
) {
  const existing = map[key];
  if (!existing) {
    map[key] = entry;
    return;
  }
  // Prefer approved over pending when multiple queue rows exist for the same key
  if (existing.status !== "approved" && entry.status === "approved") {
    map[key] = entry;
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Component to load images from authenticated /objects/ routes
function AuthenticatedImage({ 
  src, 
  alt, 
  className, 
  testId,
  onLoadError 
}: { 
  src: string; 
  alt: string; 
  className?: string; 
  testId?: string;
  onLoadError?: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl: string | null = null;
    
    async function fetchImage() {
      try {
        setLoading(true);
        setError(false);
        setBlobUrl(null);
        
        // If it's a data URL, use directly
        if (src.startsWith('data:')) {
          if (isMounted) {
            setBlobUrl(src);
            setLoading(false);
          }
          return;
        }
        
        // If it's an asset URL, use directly
        if (src.includes('/assets/')) {
          if (isMounted) {
            setBlobUrl(src);
            setLoading(false);
          }
          return;
        }
        
        const response = await fetch(src, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Verify content type is an image
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          throw new Error(`Invalid content type: ${contentType}`);
        }
        
        const blob = await response.blob();
        
        // Double-check blob type
        if (!blob.type.startsWith('image/') && blob.type !== '') {
          throw new Error(`Invalid blob type: ${blob.type}`);
        }
        
        if (isMounted) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
          setLoading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error loading authenticated image:', src, 'Error:', errorMessage);
        if (isMounted) {
          setError(true);
          setLoading(false);
          onLoadError?.();
        }
      }
    }
    
    if (src) {
      fetchImage();
    } else {
      setLoading(false);
      setError(true);
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
      <div className={`${className || ''} flex items-center justify-center bg-muted`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !blobUrl) {
    return null;
  }

  return (
    <img 
      src={blobUrl} 
      alt={alt} 
      className={className}
      data-testid={testId}
      onError={() => {
        setError(true);
        onLoadError?.();
      }}
    />
  );
}

// HEIC/HEIF preview helper: converts to JPEG in-browser for Chromium/Electron.
function AuthenticatedHeicImage({
  src,
  alt,
  typeHint,
  className,
  testId,
  onLoadError,
}: {
  src: string;
  alt: string;
  typeHint?: "image/heic" | "image/heif";
  className?: string;
  testId?: string;
  onLoadError?: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl: string | null = null;

    const canRenderImage = (url: string) =>
      new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });

    async function fetchAndConvert() {
      try {
        setLoading(true);
        setBlobUrl(null);
        setError(null);

        const response = await fetch(src, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();

        // 1) Try rendering directly (some Chromium builds support HEIF).
        const originalUrl = URL.createObjectURL(blob);
        const directOk = await canRenderImage(originalUrl);
        if (directOk) {
          if (!isMounted) {
            URL.revokeObjectURL(originalUrl);
            return;
          }
          currentBlobUrl = originalUrl;
          setBlobUrl(currentBlobUrl);
          return;
        }
        URL.revokeObjectURL(originalUrl);

        // 2) Try heic2any first (fast path, but fails for some HEIF variants).
        try {
          const heicAnyMod = await import("heic2any");
          const heic2any = (heicAnyMod as any).default ?? (heicAnyMod as any);
          const converted = await heic2any({
            blob,
            toType: "image/jpeg",
            quality: 0.9,
          } as any);
          const outBlob = Array.isArray(converted) ? converted[0] : converted;
          if (outBlob instanceof Blob) {
            if (!isMounted) return;
            currentBlobUrl = URL.createObjectURL(outBlob);
            setBlobUrl(currentBlobUrl);
            return;
          }
        } catch {
          // continue to WASM fallback
        }

        // 3) WASM decode fallback via libheif-js (more compatible).
        const { decode } = await import("libheif-js");
        const buf = await blob.arrayBuffer();
        const decoded = await decode({ buffer: buf });
        const frame = Array.isArray(decoded) ? decoded[0] : decoded;
        if (!frame?.width || !frame?.height || !frame?.data) {
          throw new Error("HEIF decode failed");
        }
        const canvas = document.createElement("canvas");
        canvas.width = frame.width;
        canvas.height = frame.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        const imageData = new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height);
        ctx.putImageData(imageData, 0, 0);
        const jpgBlob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
            "image/jpeg",
            0.9,
          );
        });

        if (!isMounted) return;
        currentBlobUrl = URL.createObjectURL(jpgBlob);
        setBlobUrl(currentBlobUrl);
      } catch (e) {
        console.error("HEIC preview conversion failed:", e);
        setError("Preview not supported for this HEIC/HEIF file. Please download and open it.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (src) fetchAndConvert();
    else {
      setLoading(false);
      onLoadError?.();
    }

    return () => {
      isMounted = false;
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [src, typeHint, onLoadError]);

  if (loading) {
    return (
      <div className={`${className || ""} flex items-center justify-center bg-muted`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className || ""} flex items-center justify-center bg-muted p-4 text-center`}>
        <div className="text-xs text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    onLoadError?.();
    return null;
  }

  return <img src={blobUrl} alt={alt} className={className} data-testid={testId} />;
}

// Document Preview component with authenticated image loading
function DocumentPreview({ fileUrl, fileName }: { fileUrl?: string; fileName: string }) {
  const [loadError, setLoadError] = useState(false);
  
  // Reset error state when fileUrl changes
  useEffect(() => {
    setLoadError(false);
  }, [fileUrl]);
  
  // Stable callback reference to prevent unnecessary re-renders
  const handleLoadError = useCallback(() => {
    setLoadError(true);
  }, []);
  
  if (!fileUrl) {
    return (
      <div className="w-full min-h-[200px] rounded-lg bg-muted flex items-center justify-center overflow-hidden" data-testid="document-preview-fallback">
        <div className="text-center text-muted-foreground flex flex-col items-center justify-center">
          <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Document Preview</p>
          <p className="text-xs">{fileName}</p>
        </div>
      </div>
    );
  }

  const lowerUrl = fileUrl.toLowerCase();
  const fromNameRaw = (fileName.split(".").pop() || "").toLowerCase();
  const fromName = fromNameRaw.length <= 5 ? fromNameRaw : "";
  const fromUrl = (lowerUrl.split("?")[0].split("/").pop() || "").split(".").pop() || "";
  const ext = fromName || fromUrl;

  const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif"];
  const isPdf = ext === "pdf" || lowerUrl.endsWith(".pdf");
  const isHeic = ext === "heic" || ext === "heif" || lowerUrl.endsWith(".heic") || lowerUrl.endsWith(".heif");
  const isImage =
    imageExts.includes(ext) ||
    lowerUrl.endsWith(".png") ||
    lowerUrl.endsWith(".jpg") ||
    lowerUrl.endsWith(".jpeg") ||
    lowerUrl.endsWith(".heic") ||
    lowerUrl.endsWith(".heif") ||
    lowerUrl.startsWith("data:image/") ||
    lowerUrl.includes("/assets/generated_images/");

  const normalizedUrl = getDocumentUrl(fileUrl);
  const canDisplay = !!normalizedUrl;

  // Show inline PDF using iframe when possible
  if (isPdf && !loadError) {
    return (
      <div className="w-full min-h-[300px] max-h-[55vh] overflow-hidden" data-testid="document-preview-pdf">
        <iframe
          src={normalizedUrl || ""}
          title={fileName}
          className="w-full h-full min-h-[300px] border-0 bg-white"
          style={{ height: "55vh" }}
        />
      </div>
    );
  }

  if (isHeic && !loadError) {
    return (
      <div className="w-full flex items-center justify-center bg-muted overflow-hidden" data-testid="document-preview-image-heic">
        <AuthenticatedHeicImage
          src={normalizedUrl || ""}
          alt={fileName}
          typeHint={ext === "heif" ? "image/heif" : ext === "heic" ? "image/heic" : undefined}
          className="w-full h-auto max-h-[55vh] object-contain"
          testId="img-document-preview-heic"
          onLoadError={handleLoadError}
        />
      </div>
    );
  }

  if (isImage && !loadError) {
    return (
      <div className="w-full flex items-center justify-center bg-muted overflow-hidden" data-testid="document-preview-image">
        <AuthenticatedImage
          src={normalizedUrl || ""}
          alt={fileName}
          className="w-full h-auto max-h-[55vh] object-contain"
          testId="img-document-preview"
          onLoadError={handleLoadError}
        />
      </div>
    );
  }

  return (
    <div className="w-full min-h-[200px] rounded-lg bg-muted flex items-center justify-center overflow-hidden" data-testid="document-preview-fallback">
      <div className="text-center text-muted-foreground flex flex-col items-center justify-center">
        <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Document Preview</p>
        <p className="text-xs">{fileName}</p>
      </div>
    </div>
  );
}

export default function MyDocumentsPage() {
  const { user, carrierType } = useAuth();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [isDocVerifying, setIsDocVerifying] = useState(false);
  const [docVerifyMessage, setDocVerifyMessage] = useState<string | null>(null);
  const [docVerified, setDocVerified] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    truck: true,
    driver: true,
    loads: true,
  });
  const [expandedLoads, setExpandedLoads] = useState<Record<string, boolean>>({});
  const [expandedDrivers, setExpandedDrivers] = useState<Record<string, boolean>>({});
  const [expandedTrucks, setExpandedTrucks] = useState<Record<string, boolean>>({});
  const [viewAllDialogOpen, setViewAllDialogOpen] = useState(false);
  const [viewAllFolderName, setViewAllFolderName] = useState("");
  const [viewAllDocuments, setViewAllDocuments] = useState<Document[]>([]);

  const { uploadFile, isUploading: isStorageUploading } = useUpload({
    onError: (err) => {
      console.error("Upload error:", err);
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload document to storage. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleDriver = (driverId: string) => {
    setExpandedDrivers(prev => ({ ...prev, [driverId]: !prev[driverId] }));
  };

  const openViewAllDialog = (folderName: string, documents: Document[]) => {
    setViewAllFolderName(folderName);
    setViewAllDocuments(documents);
    setViewAllDialogOpen(true);
  };

  const toggleTruck = (truckId: string) => {
    setExpandedTrucks(prev => ({ ...prev, [truckId]: !prev[truckId] }));
  };

  const { data, isLoading, error } = useQuery<ExpiryData>({
    queryKey: ["/api/carrier/documents/expiring"],
    enabled: !!user && user.role === "carrier",
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: shipmentsData, refetch: refetchShipments } = useQuery<any[]>({
    queryKey: ["/api/shipments/tracking"],
    enabled: !!user && user.role === "carrier",
    staleTime: 2000,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
    refetchOnWindowFocus: true,
  });

  // Fetch drivers to get their documents (license, aadhaar images)
  const { data: driversData } = useQuery<any[]>({
    queryKey: ["/api/drivers"],
    enabled: !!user && user.role === "carrier",
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  // Fetch trucks to get their documents (RC, insurance, etc.)
  const { data: trucksData } = useQuery<any[]>({
    queryKey: ["/api/trucks"],
    enabled: !!user && user.role === "carrier",
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  // Fetch carrier verification to get verification documents with their status
  const { data: verificationData } = useQuery<{
    id: string;
    status: string;
    documents?: Array<{
      id: string;
      documentType: string;
      fileName: string;
      fileUrl: string;
      status: string;
      rejectionReason?: string;
      createdAt: string;
    }>;
  } | null>({
    queryKey: ["/api/carrier/verification"],
    enabled: !!user && user.role === "carrier",
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  const uploadMutation = useMutation({
    mutationFn: async (docData: { documentType: string; fileName: string; fileUrl: string; fileSize: number; expiryDate: string | null; driverId?: string | null; truckId?: string | null; isVerified?: boolean }) => {
      return apiRequest("POST", "/api/carrier/documents", docData);
    },
    onSuccess: () => {
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded successfully.",
      });
      // Invalidate all document-related queries to update counts
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents/expiring"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trucks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments/tracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/verification"] });
      setUploadDialogOpen(false);
      resetUploadForm();
    },
    onError: (error: any) => {
      const message = error instanceof Error ? error.message : "Failed to upload document. Please try again.";
      toast({
        title: "Upload Failed",
        description: message,
        variant: "destructive",
      });
      console.error("Upload document error:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      return apiRequest("DELETE", `/api/carrier/documents/${docId}`);
    },
    onSuccess: () => {
      toast({
        title: "Document Deleted",
        description: "The document has been removed.",
      });
      // Invalidate all document-related queries to update counts
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents/expiring"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trucks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments/tracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/verification"] });
      setPreviewDialogOpen(false);
      setSelectedDocument(null);
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetUploadForm = () => {
    setSelectedDocType("");
    setSelectedFile(null);
    setExpiryDate("");
    setSelectedDriverId("");
    setSelectedTruckId("");
    setIsDocVerifying(false);
    setDocVerifyMessage(null);
    setDocVerified(false);
  };

  // Helper to check if document type is for drivers
  const isDriverDocType = (docType: string) => 
    ["license", "pan_card", "aadhar", "aadhaar"].includes(docType);

  // Helper to check if document type is for trucks
  const isTruckDocType = (docType: string) => 
    ["rc", "insurance", "fitness", "puc", "permit"].includes(docType);

  // Helper to get owner info for a document (driver name or truck registration)
  const getDocumentOwnerInfo = (doc: Document): string => {
    if (doc.driverId && driversData) {
      const driver = driversData.find((d: any) => d.id === doc.driverId);
      if (driver) return `(${driver.name})`;
    }
    if (doc.truckId && trucksData) {
      const truck = trucksData.find((t: any) => t.id === doc.truckId);
      if (truck) return `(${truck.registrationNumber})`;
    }
    return "";
  };

  const VERIFIABLE_DOC_TYPES = new Set(["rc", "aadhaar", "aadhar", "pan_card", "license"]);

  const handleVerifyDocument = async (fileOverride?: File) => {
    const file = fileOverride ?? selectedFile;
    if (!selectedDocType || !file) return;
    setIsDocVerifying(true);
    setDocVerifyMessage("Verifying document…");
    setDocVerified(false);
    try {
      const readOcrText = async () => {
        const { prepareFileForTesseract } = await import("@/lib/prepare-file-for-tesseract");
        const ocrSource = await prepareFileForTesseract(file);
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        try {
          const { data: { text } } = await worker.recognize(ocrSource);
          return text.replace(/[\n\r]/g, " ").toUpperCase();
        } finally {
          await worker.terminate();
        }
      };

      let result: { ok: boolean; message: string } = { ok: false, message: "Verification failed." };

      if (selectedDocType === "rc") {
        const normalized = await readOcrText();
        const rc = normalized.replace(/[\s\-]/g, "").match(/[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}/)?.[0] || "";
        if (!rc) { result = { ok: false, message: "RC number could not be read from document." }; }
        else {
          const res = await apiRequest("POST", "/api/kyc/rc-owner-history", { rc_number: rc, request_ref: "carrier_documents_rc_verify" });
          const body = await res.json();
          result = res.ok && body?.success
            ? { ok: true, message: `RC verified${body?.data?.current_owner_name ? ` (Owner: ${body.data.current_owner_name})` : ""}.` }
            : { ok: false, message: body?.message || "RC verification failed." };
        }
      } else if (selectedDocType === "aadhaar" || selectedDocType === "aadhar") {
        const { extractPdfFirstPageText } = await import("@/lib/prepare-file-for-tesseract");
        const { extractAadhaarFromOcrThenPdf } = await import("@/lib/extract-aadhaar-from-text");
        const pdfText = await extractPdfFirstPageText(file);
        const ocrText = await readOcrText();
        const aadhaar = extractAadhaarFromOcrThenPdf(ocrText, pdfText);
        if (!aadhaar || aadhaar.length !== 12) { result = { ok: false, message: "Aadhaar number could not be read from document." }; }
        else {
          const res = await apiRequest("POST", "/api/kyc/aadhaar-validation", { aadhaar_number: aadhaar, request_ref: "carrier_documents_aadhaar_verify" });
          const body = await res.json();
          result = res.ok && body?.success
            ? { ok: true, message: "Aadhaar verified successfully." }
            : { ok: false, message: body?.message || "Aadhaar verification failed." };
        }
      } else if (selectedDocType === "pan_card") {
        const normalized = await readOcrText();
        let pan = normalized.match(/[A-Z]{5}[0-9]{4}[A-Z]/)?.[0] || "";
        if (!pan) pan = normalized.replace(/\s+/g, "").match(/[A-Z]{5}[0-9]{4}[A-Z]/)?.[0] || "";
        if (!pan) { result = { ok: false, message: "PAN number could not be read from document." }; }
        else {
          const res = await apiRequest("POST", "/api/kyc/pan-comprehensive", { pan_number: pan, request_ref: "carrier_documents_pan_verify" });
          const body = await res.json();
          result = res.ok && body?.success
            ? { ok: true, message: "PAN verified successfully." }
            : { ok: false, message: body?.message || "PAN verification failed." };
        }
      } else if (selectedDocType === "license") {
        const normalized = await readOcrText();
        const compact = normalized.replace(/\s+/g, "");
        const dl = compact.match(/[A-Z]{2}\d{2}\d{11}/)?.[0] || compact.match(/[A-Z]{2}\d{13}/)?.[0] || compact.match(/[A-Z]{2}\d{2}[A-Z0-9]{8,14}/)?.[0] || "";
        const dobToken =
          normalized.match(/(?:DOB|DATE\s*OF\s*BIRTH)[^\d]*((?:[0-2]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:19|20)\d{2})/i)?.[1] ||
          normalized.match(/(?:DOB|DATE\s*OF\s*BIRTH)[^\d]*((?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:[0-2]\d|3[01]))/i)?.[1] || "";
        const toIsoDate = (raw: string): string | null => {
          const token = raw.replace(/[.]/g, "-").replace(/\//g, "-").trim();
          const ymd = token.match(/^((19|20)\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/);
          if (ymd) return `${ymd[1]}-${ymd[3]}-${ymd[4]}`;
          const dmy = token.match(/^([0-2]\d|3[01])-(0[1-9]|1[0-2])-((19|20)\d{2})$/);
          if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
          return null;
        };
        const dob = dobToken ? toIsoDate(dobToken) || "" : "";
        if (!dl || !dob) { result = { ok: false, message: !dl ? "License number could not be read." : "License DOB could not be read." }; }
        else {
          const res = await apiRequest("POST", "/api/kyc/driving-license", { id_number: dl, dob, request_ref: "carrier_documents_license_verify" });
          const body = await res.json();
          result = res.ok && body?.success
            ? { ok: true, message: "Driving license verified successfully." }
            : { ok: false, message: body?.message || "Driving license verification failed." };
        }
      }

      setDocVerifyMessage(result.message);
      setDocVerified(result.ok);
      toast({
        title: result.ok ? "Verification Successful" : "Verification Failed",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      });
    } catch {
      setDocVerifyMessage("Verification could not be completed. Please try again.");
      setDocVerified(false);
    } finally {
      setIsDocVerifying(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedDocType || !selectedFile) {
      toast({
        title: "Missing Information",
        description: "Please select a document type and file.",
        variant: "destructive",
      });
      return;
    }

    // For fleet/enterprise carriers, require driver/truck selection for relevant doc types
    if (carrierType === "enterprise") {
      if (isDriverDocType(selectedDocType) && !selectedDriverId && driversData && driversData.length > 0) {
        toast({
          title: "Missing Information",
          description: "Please select which driver this document belongs to.",
          variant: "destructive",
        });
        return;
      }
      if (isTruckDocType(selectedDocType) && !selectedTruckId && trucksData && trucksData.length > 0) {
        toast({
          title: "Missing Information",
          description: "Please select which truck this document belongs to.",
          variant: "destructive",
        });
        return;
      }
    }

    const runSurepassVerification = async (docType: string, file: File): Promise<{ ok: boolean; message: string }> => {
      const readOcrText = async () => {
        const { prepareFileForTesseract } = await import("@/lib/prepare-file-for-tesseract");
        const ocrSource = await prepareFileForTesseract(file);
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        try {
          const { data: { text } } = await worker.recognize(ocrSource);
          return text.replace(/[\n\r]/g, " ").toUpperCase();
        } finally {
          await worker.terminate();
        }
      };

      if (docType === "rc") {
        const normalized = await readOcrText();
        const rc = normalized.replace(/[\s\-]/g, "").match(/[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}/)?.[0] || "";
        if (!rc) return { ok: false, message: "RC number could not be read. Document uploaded for admin review." };
        const res = await apiRequest("POST", "/api/kyc/rc-owner-history", {
          rc_number: rc,
          request_ref: "carrier_documents_rc_upload",
        });
        const body = await res.json();
        return res.ok && body?.success
          ? { ok: true, message: `RC verified${body?.data?.current_owner_name ? ` (Owner: ${body.data.current_owner_name})` : ""}.` }
          : { ok: false, message: body?.message || "RC verification failed. Document uploaded for admin review." };
      }

      if (docType === "aadhaar" || docType === "aadhar") {
        const { extractPdfFirstPageText } = await import("@/lib/prepare-file-for-tesseract");
        const { extractAadhaarFromOcrThenPdf } = await import("@/lib/extract-aadhaar-from-text");
        const pdfText = await extractPdfFirstPageText(file);
        const ocrText = await readOcrText();
        const aadhaar = extractAadhaarFromOcrThenPdf(ocrText, pdfText);
        if (!aadhaar || aadhaar.length !== 12) {
          return { ok: false, message: "Aadhaar number could not be read. Document uploaded for admin review." };
        }
        const res = await apiRequest("POST", "/api/kyc/aadhaar-validation", {
          aadhaar_number: aadhaar,
          request_ref: "carrier_documents_aadhaar_upload",
        });
        const body = await res.json();
        return res.ok && body?.success
          ? { ok: true, message: "Aadhaar verified successfully." }
          : { ok: false, message: body?.message || "Aadhaar verification failed. Document uploaded for admin review." };
      }

      if (docType === "pan_card") {
        const normalized = await readOcrText();
        let pan = normalized.match(/[A-Z]{5}[0-9]{4}[A-Z]/)?.[0] || "";
        if (!pan) pan = normalized.replace(/\s+/g, "").match(/[A-Z]{5}[0-9]{4}[A-Z]/)?.[0] || "";
        if (!pan) return { ok: false, message: "PAN could not be read. Document uploaded for admin review." };
        const res = await apiRequest("POST", "/api/kyc/pan-comprehensive", {
          pan_number: pan,
          request_ref: "carrier_documents_pan_upload",
        });
        const body = await res.json();
        return res.ok && body?.success
          ? { ok: true, message: "PAN verified successfully." }
          : { ok: false, message: body?.message || "PAN verification failed. Document uploaded for admin review." };
      }

      if (docType === "license") {
        const normalized = await readOcrText();
        const compact = normalized.replace(/\s+/g, "");
        const dl =
          compact.match(/[A-Z]{2}\d{2}\d{11}/)?.[0] ||
          compact.match(/[A-Z]{2}\d{13}/)?.[0] ||
          compact.match(/[A-Z]{2}\d{2}[A-Z0-9]{8,14}/)?.[0] ||
          "";
        const dobToken =
          normalized.match(/(?:DOB|DATE\s*OF\s*BIRTH)[^\d]*((?:[0-2]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:19|20)\d{2})/i)?.[1] ||
          normalized.match(/(?:DOB|DATE\s*OF\s*BIRTH)[^\d]*((?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:[0-2]\d|3[01]))/i)?.[1] ||
          "";
        const toIsoDate = (raw: string): string | null => {
          const token = raw.replace(/[.]/g, "-").replace(/\//g, "-").trim();
          const ymd = token.match(/^((19|20)\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/);
          if (ymd) return `${ymd[1]}-${ymd[3]}-${ymd[4]}`;
          const dmy = token.match(/^([0-2]\d|3[01])-(0[1-9]|1[0-2])-((19|20)\d{2})$/);
          if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
          return null;
        };
        const dob = dobToken ? toIsoDate(dobToken) || "" : "";
        if (!dl) return { ok: false, message: "License number could not be read. Document uploaded for admin review." };
        if (!dob) return { ok: false, message: "License DOB could not be read. Document uploaded for admin review." };
        const res = await apiRequest("POST", "/api/kyc/driving-license", {
          id_number: dl,
          dob,
          request_ref: "carrier_documents_license_upload",
        });
        const body = await res.json();
        return res.ok && body?.success
          ? { ok: true, message: "Driving license verified successfully." }
          : { ok: false, message: body?.message || "Driving license verification failed. Document uploaded for admin review." };
      }

      return { ok: true, message: "" };
    };

    const verifiableTypes = new Set(["rc", "aadhaar", "aadhar", "pan_card", "license"]);
    let surepassVerified = docVerified;
    if (verifiableTypes.has(selectedDocType) && !surepassVerified) {
      setIsDocVerifying(true);
      setDocVerifyMessage("Verifying document with Surepass...");
      try {
        const result = await runSurepassVerification(selectedDocType, selectedFile);
        surepassVerified = result.ok;
        setDocVerifyMessage(result.message);
        toast({
          title: result.ok ? "Verification complete" : "Verification unclear",
          description: result.message || "Document uploaded.",
          variant: result.ok ? "default" : "destructive",
        });
      } catch {
        setDocVerifyMessage("Verification could not be completed. Document will still be uploaded for admin review.");
      } finally {
        setIsDocVerifying(false);
      }
    }

    // First upload the file to object storage (S3/local) using the shared upload hook
    const uploadResponse = await uploadFile(selectedFile);
    if (!uploadResponse) {
      // Error is handled inside useUpload's onError
      return;
    }

    const objectPath = uploadResponse.objectPath?.trim();
    if (!objectPath) {
      toast({
        title: "Upload Failed",
        description: "Storage upload completed but no file path was returned.",
        variant: "destructive",
      });
      return;
    }

    // Keep backend object paths (`/objects/...`) as-is so server-side validation
    // and object resolution work across production domains/subdomains.
    const fileUrl = objectPath;

    // For truck-type docs, use the explicitly selected truck or fall back to the
    // carrier's only truck (non-enterprise carriers never see the truck picker).
    const effectiveTruckId = isTruckDocType(selectedDocType)
      ? (selectedTruckId || (trucksData?.length === 1 ? trucksData[0].id : null))
      : null;

    uploadMutation.mutate({
      documentType: selectedDocType,
      fileName: selectedFile.name,
      fileUrl,
      fileSize: uploadResponse.metadata.size ?? selectedFile.size,
      expiryDate: expiryDate || null,
      driverId: isDriverDocType(selectedDocType) ? (selectedDriverId || null) : null,
      truckId: effectiveTruckId,
      isVerified: surepassVerified,
    });
  };

  const handlePreview = (doc: Document) => {
    setSelectedDocument(doc);
    setPreviewDialogOpen(true);
  };

  const isCarrierDocumentId = (docId: string): boolean => {
    return !(
      docId.startsWith("driver-") ||
      docId.startsWith("truck-") ||
      docId.startsWith("verification-")
    );
  };

  const handleDelete = (docId: string) => {
    if (!isCarrierDocumentId(docId)) {
      toast({
        title: "Delete Not Available",
        description: "This document is managed outside carrier documents and cannot be deleted from this dialog.",
        variant: "destructive",
      });
      return;
    }
    deleteMutation.mutate(docId);
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const toggleLoad = (loadId: string) => {
    setExpandedLoads(prev => ({ ...prev, [loadId]: !prev[loadId] }));
  };

  if (carrierType === undefined) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" data-testid="skeleton-title" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" data-testid="skeleton-stat-1" />
          <Skeleton className="h-24" data-testid="skeleton-stat-2" />
          <Skeleton className="h-24" data-testid="skeleton-stat-3" />
          <Skeleton className="h-24" data-testid="skeleton-stat-4" />
        </div>
        <Skeleton className="h-64" data-testid="skeleton-content" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" data-testid="skeleton-title" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" data-testid="skeleton-stat-1" />
          <Skeleton className="h-24" data-testid="skeleton-stat-2" />
          <Skeleton className="h-24" data-testid="skeleton-stat-3" />
          <Skeleton className="h-24" data-testid="skeleton-stat-4" />
        </div>
        <Skeleton className="h-64" data-testid="skeleton-content" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load documents. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { expired, expiringSoon, healthy, summary } = data || { 
    expired: [], 
    expiringSoon: [], 
    healthy: [], 
    summary: { totalDocs: 0, expiredCount: 0, expiringSoonCount: 0, healthyCount: 0 } 
  };

  const allDocuments = [...expired, ...expiringSoon, ...healthy]
    .map((d) => normalizeApiDocument(d as Record<string, unknown>))
    .filter((d) => !!documentMatchKey(d.fileUrl));

  const surepassVerifiedByUrl = new Map<string, boolean>();
  allDocuments.forEach((doc) => {
    if (!doc.isVerified) return;
    const urlKey = documentMatchKey(doc.fileUrl);
    if (urlKey) surepassVerifiedByUrl.set(urlKey, true);
  });
  
  // Helper to extract URL/path from mixed legacy payload formats.
  // Supports plain strings, JSON strings, and object payloads from different upload flows.
  const extractFileUrl = (urlData: any): string | null => {
    if (!urlData) return null;

    const fromObject = (value: Record<string, any>): string | null => {
      const candidates = [
        value.path,
        value.url,
        value.fileUrl,
        value.objectPath,
        value.key,
        value.location,
        value.secure_url,
      ];

      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          return candidate.trim();
        }
      }

      return null;
    };

    if (typeof urlData === "string") {
      const trimmed = urlData.trim();
      if (!trimmed) return null;

      // Parse JSON-like payloads only when they appear to be objects.
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === "object") {
            const extracted = fromObject(parsed);
            if (extracted) return extracted;
          }
        } catch {
          // Fall back to raw string handling below.
        }
      }

      return trimmed;
    }

    if (typeof urlData === "object") {
      return fromObject(urlData as Record<string, any>);
    }

    return null;
  };

  // Convert truck documents (RC, insurance, etc. stored on truck records) to Document format
  // Group truck documents by license plate for hierarchical display
  const truckDocumentsByPlate: Record<string, { truckId: string; licensePlate: string; documents: Document[] }> = {};
  
  (trucksData || []).forEach((truck: any) => {
    const truckDocs: Document[] = [];
    const plateLabel = truck.licensePlate || truck.registrationNumber || `Truck ${truck.id}`;
    
    const rcUrl = extractFileUrl(truck.rcDocumentUrl);
    if (rcUrl && !documentAlreadyListed(allDocuments, "rc", rcUrl, { truckId: truck.id })) {
      truckDocs.push({
        id: `truck-rc-${truck.id}`,
        documentType: "rc",
        fileName: "Registration Certificate",
        fileUrl: rcUrl,
        fileSize: undefined,
        expiryDate: truck.rcExpiry || null,
        createdAt: truck.createdAt || new Date().toISOString(),
        ...verifiedFieldsFromEntity(truck.rcVerified),
      });
    }
    const insuranceUrl = extractFileUrl(truck.insuranceDocumentUrl);
    if (insuranceUrl && !documentAlreadyListed(allDocuments, "insurance", insuranceUrl, { truckId: truck.id })) {
      truckDocs.push({
        id: `truck-insurance-${truck.id}`,
        documentType: "insurance",
        fileName: "Insurance",
        fileUrl: insuranceUrl,
        fileSize: undefined,
        expiryDate: truck.insuranceExpiry || null,
        createdAt: truck.createdAt || new Date().toISOString(),
        ...verifiedFieldsFromEntity(truck.insuranceVerified),
      });
    }
    const fitnessUrl = extractFileUrl(truck.fitnessDocumentUrl);
    if (fitnessUrl && !documentAlreadyListed(allDocuments, "fitness", fitnessUrl, { truckId: truck.id })) {
      truckDocs.push({
        id: `truck-fitness-${truck.id}`,
        documentType: "fitness",
        fileName: "Fitness Certificate",
        fileUrl: fitnessUrl,
        fileSize: undefined,
        expiryDate: truck.fitnessExpiry || null,
        createdAt: truck.createdAt || new Date().toISOString(),
        ...verifiedFieldsFromEntity(truck.fitnessVerified),
      });
    }
    const permitUrl = extractFileUrl(truck.permitDocumentUrl);
    if (permitUrl && !documentAlreadyListed(allDocuments, "permit", permitUrl, { truckId: truck.id })) {
      truckDocs.push({
        id: `truck-permit-${truck.id}`,
        documentType: "permit",
        fileName: "State Permit",
        fileUrl: permitUrl,
        fileSize: undefined,
        expiryDate: truck.permitExpiry || null,
        createdAt: truck.createdAt || new Date().toISOString(),
        ...verifiedFieldsFromEntity(truck.permitVerified),
      });
    }
    const pucUrl = extractFileUrl(truck.pucDocumentUrl);
    if (pucUrl && !documentAlreadyListed(allDocuments, "puc", pucUrl, { truckId: truck.id })) {
      truckDocs.push({
        id: `truck-puc-${truck.id}`,
        documentType: "puc",
        fileName: "PUC Certificate",
        fileUrl: pucUrl,
        fileSize: undefined,
        expiryDate: truck.pucExpiry || null,
        createdAt: truck.createdAt || new Date().toISOString(),
        ...verifiedFieldsFromEntity(truck.pucVerified),
      });
    }

    if (truckDocs.length > 0) {
      truckDocumentsByPlate[plateLabel] = {
        truckId: truck.id,
        licensePlate: plateLabel,
        documents: truckDocs,
      };
    }
  });

  // Add documents from the documents table to truckDocumentsByPlate.
  // Handles two cases:
  // 1. Doc has a truckId — find the matching truck folder
  // 2. Doc has NO truckId but is a truck-category doc — for carriers with a single truck,
  //    the upload form never showed a truck picker (non-enterprise), so truckId was never
  //    saved. Fall back to the only available truck so the folder view stays in sync with
  //    the Truck tab.
  const singleTruck = (trucksData || []).length === 1 ? (trucksData || [])[0] : null;

  allDocuments.forEach((doc) => {
    if (!documentCategories.truck.includes(doc.documentType)) return;

    const truck = doc.truckId
      ? (trucksData || []).find((t: any) => t.id === doc.truckId)
      : singleTruck;

    if (!truck) return;

    const plateLabel = truck.licensePlate || truck.registrationNumber || `Truck ${truck.id}`;

    if (!truckDocumentsByPlate[plateLabel]) {
      truckDocumentsByPlate[plateLabel] = {
        truckId: truck.id,
        licensePlate: plateLabel,
        documents: [],
      };
    }

    const existingDoc = truckDocumentsByPlate[plateLabel].documents.find(
      (d) => d.id === doc.id || (d.documentType === doc.documentType && d.fileUrl === doc.fileUrl),
    );
    if (!existingDoc) {
      truckDocumentsByPlate[plateLabel].documents.push(doc);
    }
  });

  // Drop truck folders that ended up empty
  for (const [plate, entry] of Object.entries(truckDocumentsByPlate)) {
    if (entry.documents.length === 0) {
      delete truckDocumentsByPlate[plate];
    }
  }

  // Verification queue lookup — URL/file specific; type fallback only for official/business docs
  const verificationByUrl: Record<string, VerificationEntry> = {};
  const verificationByFileName: Record<string, VerificationEntry> = {};
  const verificationByType: Record<string, VerificationEntry> = {};

  if (verificationData?.documents) {
    verificationData.documents.forEach((doc) => {
      const entry: VerificationEntry = { status: doc.status, rejectionReason: doc.rejectionReason };
      const urlKey = documentMatchKey(doc.fileUrl);
      if (urlKey) setVerificationEntry(verificationByUrl, urlKey, entry);
      if (doc.fileUrl) setVerificationEntry(verificationByUrl, doc.fileUrl, entry);
      if (doc.fileName) setVerificationEntry(verificationByFileName, doc.fileName, entry);
      if (documentCategories.official.includes(doc.documentType)) {
        setVerificationEntry(verificationByType, doc.documentType, entry);
      }
    });
  }

  // Same Surepass/approved rules for folders, tabs, and alerts
  const mergeVerificationStatus = (docs: Document[]): Document[] => {
    return docs.map((doc) => {
      if (isSurepassOrApproved(doc, surepassVerifiedByUrl)) {
        return {
          ...doc,
          verificationStatus: "approved" as const,
          isVerified: true,
        };
      }
      if (doc.verificationStatus === "rejected") {
        return { ...doc, isVerified: false };
      }

      const urlKey = documentMatchKey(doc.fileUrl);
      const verificationInfo =
        (urlKey && verificationByUrl[urlKey]) ||
        (doc.fileUrl ? verificationByUrl[doc.fileUrl] : undefined) ||
        (doc.fileName ? verificationByFileName[doc.fileName] : undefined) ||
        (documentCategories.official.includes(doc.documentType)
          ? verificationByType[doc.documentType]
          : undefined);

      if (verificationInfo) {
        const approved = verificationInfo.status === "approved";
        const rejected = verificationInfo.status === "rejected";
        return {
          ...doc,
          verificationStatus: rejected ? "rejected" : approved ? "approved" : "pending",
          rejectionReason: verificationInfo.rejectionReason,
          isVerified: approved,
        };
      }

      return {
        ...doc,
        verificationStatus: doc.verificationStatus ?? "pending",
        isVerified: false,
      };
    });
  };

  const truckDocsFromTable = allDocuments.filter(d => documentCategories.truck.includes(d.documentType));
  const driverDocsFromTable = allDocuments.filter(d => documentCategories.driver.includes(d.documentType));

  // Get all carrier shipments - backend already filters by current carrier
  const carrierShipments = shipmentsData || [];

  // Group shipments by load number - show all loads, with or without documents
  const shipmentsByLoad: Record<number, ShipmentWithDocs> = {};
  carrierShipments.forEach((s: any) => {
    const shipmentDocs = (s.documents || []).filter((d: ShipmentDocument) => !!documentMatchKey(d.fileUrl));
    if (shipmentDocs.length === 0) return;

    // Use shipperLoadNumber from the load object (this is the LD-XXX number)
    const loadNum = s.load?.shipperLoadNumber || s.load?.loadNumber || s.loadNumber;
    if (loadNum) {
      const existingDocs = shipmentsByLoad[loadNum]?.documents?.length || 0;
      if (!shipmentsByLoad[loadNum] || shipmentDocs.length > existingDocs) {
        shipmentsByLoad[loadNum] = {
          id: s.id,
          loadNumber: loadNum,
          status: s.status,
          documents: shipmentDocs,
        };
      }
    }
  });

  const renderDocument = (doc: Document, compact = false) => {
    const daysUntilExpiry = doc.expiryDate 
      ? differenceInDays(new Date(doc.expiryDate), new Date()) 
      : null;
    
    const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
    const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

    return (
      <div 
        key={doc.id}
        className={`p-3 rounded-lg border cursor-pointer hover-elevate ${
          isExpired 
            ? "border-red-200 bg-red-50 dark:bg-red-950/20" 
            : isExpiringSoon 
              ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20"
              : ""
        }`}
        onClick={() => handlePreview(doc)}
        data-testid={`card-document-${doc.id}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex-shrink-0">
              {isExpired ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : doc.verificationStatus === "rejected" ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : doc.isVerified || doc.verificationStatus === "approved" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">
                {documentTypeLabels[doc.documentType] || doc.documentType}
              </p>
              <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
              {doc.verificationStatus === "rejected" && doc.rejectionReason && (
                <p className="text-xs text-red-500 truncate mt-0.5">Rejected: {doc.rejectionReason}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isExpired && (
              <Badge variant="destructive" className="text-xs">
                Expired {Math.abs(daysUntilExpiry!)} days ago
              </Badge>
            )}
            {isExpiringSoon && !isExpired && (
              <Badge className="bg-amber-500 text-white text-xs no-default-hover-elevate no-default-active-elevate">
                {daysUntilExpiry === 0 ? "Expires today" : `${daysUntilExpiry} days left`}
              </Badge>
            )}
            {doc.verificationStatus === "rejected" && (
              <Badge variant="destructive" className="text-xs">Rejected</Badge>
            )}
            {!isExpired && !isExpiringSoon && doc.verificationStatus !== "rejected" && (doc.isVerified || doc.verificationStatus === "approved") && (
              <Badge variant="default" className="text-xs">Verified</Badge>
            )}
            {!doc.isVerified && doc.verificationStatus !== "approved" && doc.verificationStatus !== "rejected" && !isExpired && !isExpiringSoon && (
              <Badge variant="secondary" className="text-xs">Pending</Badge>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                const url = getDocumentUrl(doc.fileUrl);
                if (url) {
                  window.open(url, "_blank");
                }
              }}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderShipmentDocument = (doc: ShipmentDocument) => {
    return (
      <div 
        key={doc.id}
        className="p-3 rounded-lg border cursor-pointer hover-elevate"
        onClick={() => {
          setSelectedDocument({
            id: doc.id,
            documentType: doc.documentType,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            fileSize: undefined,
            expiryDate: null,
            isVerified: doc.status === "approved",
            createdAt: doc.createdAt,
          });
          setPreviewDialogOpen(true);
        }}
        data-testid={`card-shipment-doc-${doc.id}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">
                {documentTypeLabels[doc.documentType] || doc.documentType}
              </p>
              <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge 
              variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"} 
              className="text-xs"
            >
              {doc.status === "approved" ? "Verified" : doc.status === "rejected" ? "Rejected" : "Pending"}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                const url = getDocumentUrl(doc.fileUrl);
                if (url) {
                  window.open(url, "_blank");
                }
              }}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const FolderSection = ({ 
    title, 
    icon: Icon, 
    folderId, 
    documents, 
    emptyMessage 
  }: { 
    title: string; 
    icon: any; 
    folderId: string; 
    documents: Document[]; 
    emptyMessage: string;
  }) => {
    // Count expiring and expired documents in this folder
    const expiringCount = documents.filter(d => {
      if (!d.expiryDate) return false;
      const days = differenceInDays(new Date(d.expiryDate), new Date());
      return days >= 0 && days <= 30;
    }).length;
    const expiredCount = documents.filter(d => {
      if (!d.expiryDate) return false;
      return differenceInDays(new Date(d.expiryDate), new Date()) < 0;
    }).length;
    const hasAlerts = expiringCount > 0 || expiredCount > 0;

    return (
      <Collapsible 
        open={expandedFolders[folderId]} 
        onOpenChange={() => toggleFolder(folderId)}
      >
        <CollapsibleTrigger className="w-full">
          <div className={`flex items-center gap-2 p-3 rounded-lg hover-elevate border bg-card ${
            expiredCount > 0 ? "border-red-300 dark:border-red-800" : 
            expiringCount > 0 ? "border-amber-300 dark:border-amber-700" : ""
          }`}>
            {expandedFolders[folderId] ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {expandedFolders[folderId] ? (
              <FolderOpen className="h-5 w-5 text-amber-500" />
            ) : (
              <Folder className="h-5 w-5 text-amber-500" />
            )}
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{title}</span>
            {hasAlerts && (
              <div className="flex items-center gap-1">
                {expiredCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {expiredCount} expired
                  </Badge>
                )}
                {expiringCount > 0 && (
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
                    {expiringCount} expiring
                  </Badge>
                )}
              </div>
            )}
            <Badge variant="secondary" className="ml-auto text-xs">
              {documents.length}
            </Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-6 mt-2 space-y-2 border-l-2 border-muted pl-4">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">{emptyMessage}</p>
            ) : (
              documents.map(doc => renderDocument(doc, true))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const LoadsFolderSection = () => {
    const loadNumbers = Object.keys(shipmentsByLoad).map(Number).sort((a, b) => b - a);
    const totalDocs = Object.values(shipmentsByLoad).reduce((sum, s) => sum + s.documents.length, 0);

    return (
      <Collapsible 
        open={expandedFolders.loads} 
        onOpenChange={() => toggleFolder("loads")}
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-2 p-3 rounded-lg hover-elevate border bg-card">
            {expandedFolders.loads ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {expandedFolders.loads ? (
              <FolderOpen className="h-5 w-5 text-blue-500" />
            ) : (
              <Folder className="h-5 w-5 text-blue-500" />
            )}
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Loads</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {totalDocs} docs in {loadNumbers.length} loads
            </Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-6 mt-2 space-y-2 border-l-2 border-muted pl-4">
            {loadNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No load documents yet</p>
            ) : (
              loadNumbers.map(loadNum => {
                const shipment = shipmentsByLoad[loadNum];
                const isExpanded = expandedLoads[`load-${loadNum}`];
                return (
                  <Collapsible 
                    key={loadNum}
                    open={isExpanded}
                    onOpenChange={() => toggleLoad(`load-${loadNum}`)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center gap-2 p-2 rounded-lg hover-elevate border bg-muted/50">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                        {isExpanded ? (
                          <FolderOpen className="h-4 w-4 text-primary" />
                        ) : (
                          <Folder className="h-4 w-4 text-primary" />
                        )}
                        <span className="font-medium text-sm">LD-{String(loadNum).padStart(3, '0')}</span>
                        <Badge variant="outline" className="text-xs ml-2 capitalize">
                          {shipment.status.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {shipment.documents.length} {shipment.documents.length === 1 ? 'doc' : 'docs'}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 mt-2 space-y-2 border-l border-muted pl-3">
                        {shipment.documents.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">No documents uploaded yet</p>
                        ) : (
                          shipment.documents.map(doc => renderShipmentDocument(doc))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Collect driver documents from profile fields, documents table links, and verification queue
  const driverDocumentsDraft: Document[] = [];
  (driversData || []).forEach((driver: any) => {
    const licenseUrl = extractFileUrl(driver.licenseImageUrl);
    if (licenseUrl && !documentAlreadyListed(allDocuments, "license", licenseUrl, { driverId: driver.id })) {
      driverDocumentsDraft.push({
        id: `driver-license-${driver.id}`,
        documentType: "license",
        fileName: "Driving License",
        fileUrl: licenseUrl,
        fileSize: undefined,
        expiryDate: driver.licenseExpiry || null,
        isVerified: false,
        createdAt: driver.createdAt || new Date().toISOString(),
        driverId: driver.id,
      });
    }
    const aadhaarUrl = extractFileUrl(driver.aadhaarImageUrl);
    if (aadhaarUrl && !documentAlreadyListed(allDocuments, "aadhaar", aadhaarUrl, { driverId: driver.id })) {
      driverDocumentsDraft.push({
        id: `driver-aadhaar-${driver.id}`,
        documentType: "aadhaar",
        fileName: `Aadhaar Card${driver.aadhaarNumber ? ` (${driver.aadhaarNumber})` : ''}`,
        fileUrl: aadhaarUrl,
        fileSize: undefined,
        expiryDate: null,
        isVerified: false,
        createdAt: driver.createdAt || new Date().toISOString(),
        driverId: driver.id,
      });
    }
  });

  allDocuments.forEach((doc) => {
    if (doc.driverId && documentCategories.driver.includes(doc.documentType)) {
      if (!documentAlreadyListed(driverDocumentsDraft, doc.documentType, doc.fileUrl, { driverId: doc.driverId })) {
        driverDocumentsDraft.push(doc);
      }
    }
  });

  const carrierName = user?.companyName || user?.username || "Me";
  if (verificationData?.documents && verificationData.documents.length > 0) {
    verificationData.documents.forEach((doc) => {
      if (!documentCategories.driver.includes(doc.documentType)) return;
      if (!documentMatchKey(doc.fileUrl)) return;
      if (documentAlreadyListed(allDocuments, doc.documentType, doc.fileUrl)) return;
      if (documentAlreadyListed(driverDocumentsDraft, doc.documentType, doc.fileUrl)) return;

      driverDocumentsDraft.push({
        id: `verification-${doc.id}`,
        documentType: doc.documentType,
        fileName: doc.fileName || documentTypeLabels[doc.documentType] || doc.documentType,
        fileUrl: doc.fileUrl,
        fileSize: undefined,
        expiryDate: null,
        isVerified: doc.status === "approved",
        verificationStatus: doc.status as "pending" | "approved" | "rejected",
        rejectionReason: doc.rejectionReason,
        createdAt: doc.createdAt || new Date().toISOString(),
      });
    });
  }

  const allTruckDocsRaw = dedupeDocumentsPreferDb([
    ...truckDocsFromTable,
    ...Object.values(truckDocumentsByPlate).flatMap((t) => t.documents),
  ]);
  const truckDocs = mergeVerificationStatus(allTruckDocsRaw);
  const truckDocsById = new Map(truckDocs.map((d) => [d.id, d]));
  Object.values(truckDocumentsByPlate).forEach((entry) => {
    entry.documents = entry.documents.map((d) => truckDocsById.get(d.id) ?? d);
  });

  const allDriverDocsRaw = dedupeDocumentsPreferDb([
    ...driverDocsFromTable,
    ...driverDocumentsDraft,
  ]);
  const driverDocs = mergeVerificationStatus(allDriverDocsRaw);

  // Group the final driver list into folders (matches Driver tab)
  const resolveDriverFolder = (doc: Document): { name: string; driverId: string } => {
    if (doc.driverId) {
      const driver = (driversData || []).find((d: { id: string; name: string }) => d.id === doc.driverId);
      return { name: driver?.name ?? `Driver ${doc.driverId.slice(0, 8)}`, driverId: doc.driverId };
    }
    const syntheticMatch = doc.id.match(/^driver-(?:license|aadhaar)-(.+)$/);
    if (syntheticMatch) {
      const driver = (driversData || []).find((d: { id: string; name: string }) => d.id === syntheticMatch[1]);
      if (driver) return { name: driver.name, driverId: driver.id };
    }
    const drivers = driversData || [];
    if (drivers.length === 1) {
      return { name: drivers[0].name, driverId: drivers[0].id };
    }
    if (carrierType === "solo") {
      return { name: carrierName, driverId: user?.id ?? "solo" };
    }
    return { name: "Driver documents", driverId: "unassigned" };
  };

  const driverDocumentsByName: Record<string, { driverId: string; documents: Document[] }> = {};
  for (const doc of driverDocs) {
    const { name, driverId } = resolveDriverFolder(doc);
    if (!driverDocumentsByName[name]) {
      driverDocumentsByName[name] = { driverId, documents: [] };
    }
    const exists = driverDocumentsByName[name].documents.some(
      (d) =>
        d.id === doc.id ||
        (documentMatchKey(d.fileUrl) === documentMatchKey(doc.fileUrl) &&
          d.documentType === doc.documentType),
    );
    if (!exists) {
      driverDocumentsByName[name].documents.push(doc);
    }
  }

  const expiredForDisplay = mergeVerificationStatus(expired);
  const expiringSoonForDisplay = mergeVerificationStatus(expiringSoon);

  const DriverFolderSection = () => {
    const driverNames = Object.keys(driverDocumentsByName).sort();
    const totalDriverDocs = Object.values(driverDocumentsByName).reduce(
      (sum, d) => sum + d.documents.length, 0
    );

    return (
      <Collapsible 
        open={expandedFolders.driver} 
        onOpenChange={() => toggleFolder("driver")}
      >
        <div className="flex items-center gap-2 p-3 rounded-lg hover-elevate border bg-card">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1">
            {expandedFolders.driver ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {expandedFolders.driver ? (
              <FolderOpen className="h-5 w-5 text-amber-500" />
            ) : (
              <Folder className="h-5 w-5 text-amber-500" />
            )}
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Driver Documents</span>
          </CollapsibleTrigger>
          {totalDriverDocs > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                const allDriverDocs = Object.values(driverDocumentsByName).flatMap(d => d.documents);
                openViewAllDialog("Driver Documents", allDriverDocs);
              }}
              data-testid="button-view-all-driver-docs"
            >
              <Eye className="h-4 w-4 mr-1" />
              View All
            </Button>
          )}
          <Badge variant="secondary" className="text-xs">
            {totalDriverDocs}
          </Badge>
        </div>
        <CollapsibleContent>
          <div className="ml-6 mt-2 space-y-2 border-l-2 border-muted pl-4">
            {driverNames.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No driver documents uploaded</p>
            ) : driverNames.length === 1 ? (
              driverDocumentsByName[driverNames[0]].documents.map((doc) => renderDocument(doc, true))
            ) : (
              driverNames.map(driverName => {
                const driverData = driverDocumentsByName[driverName];
                const isExpanded = expandedDrivers[`driver-${driverData.driverId}`];
                return (
                  <Collapsible 
                    key={driverData.driverId}
                    open={isExpanded}
                    onOpenChange={() => toggleDriver(`driver-${driverData.driverId}`)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center gap-2 p-2 rounded-lg hover-elevate border bg-muted/50">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                        {isExpanded ? (
                          <FolderOpen className="h-4 w-4 text-primary" />
                        ) : (
                          <Folder className="h-4 w-4 text-primary" />
                        )}
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-sm">{driverName}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {driverData.documents.length} {driverData.documents.length === 1 ? 'doc' : 'docs'}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 mt-2 space-y-2 border-l border-muted pl-3">
                        {driverData.documents.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2 italic">No documents uploaded yet</p>
                        ) : (
                          driverData.documents.map((doc) => renderDocument(doc, true))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const TruckFolderSection = () => {
    const truckPlates = Object.keys(truckDocumentsByPlate).sort();
    const totalTruckDocs = Object.values(truckDocumentsByPlate).reduce(
      (sum, t) => sum + t.documents.length, 0
    );

    return (
      <Collapsible 
        open={expandedFolders.truck} 
        onOpenChange={() => toggleFolder("truck")}
      >
        <div className="flex items-center gap-2 p-3 rounded-lg hover-elevate border bg-card">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1">
            {expandedFolders.truck ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {expandedFolders.truck ? (
              <FolderOpen className="h-5 w-5 text-amber-500" />
            ) : (
              <Folder className="h-5 w-5 text-amber-500" />
            )}
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Truck Documents</span>
          </CollapsibleTrigger>
          {totalTruckDocs > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                const allTruckDocs = Object.values(truckDocumentsByPlate).flatMap(t => t.documents);
                openViewAllDialog("Truck Documents", allTruckDocs);
              }}
              data-testid="button-view-all-truck-docs"
            >
              <Eye className="h-4 w-4 mr-1" />
              View All
            </Button>
          )}
          <Badge variant="secondary" className="text-xs">
            {totalTruckDocs}
          </Badge>
        </div>
        <CollapsibleContent>
          <div className="ml-6 mt-2 space-y-2 border-l-2 border-muted pl-4">
            {truckPlates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No trucks added yet</p>
            ) : (
              truckPlates.map(plate => {
                const truckData = truckDocumentsByPlate[plate];
                const isExpanded = expandedTrucks[`truck-${truckData.truckId}`];
                return (
                  <Collapsible 
                    key={truckData.truckId}
                    open={isExpanded}
                    onOpenChange={() => toggleTruck(`truck-${truckData.truckId}`)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center gap-2 p-2 rounded-lg hover-elevate border bg-muted/50">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                        {isExpanded ? (
                          <FolderOpen className="h-4 w-4 text-primary" />
                        ) : (
                          <Folder className="h-4 w-4 text-primary" />
                        )}
                        <Truck className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-sm">{plate}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {truckData.documents.length} {truckData.documents.length === 1 ? 'doc' : 'docs'}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 mt-2 space-y-2 border-l border-muted pl-3">
                        {truckData.documents.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2 italic">No documents uploaded yet</p>
                        ) : (
                          truckData.documents.map((doc) => renderDocument(doc, true))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderDocumentList = (docs: Document[], emptyMessage: string) => (
    docs.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
        <Button 
          type="button"
          variant="outline" 
          className="mt-4"
          onClick={() => setUploadDialogOpen(true)}
          data-testid="button-upload-empty-state"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>
    ) : (
      <div className="space-y-3">
        {docs.map(doc => renderDocument(doc))}
      </div>
    )
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-page-title">My Documents</h1>
        <Button 
          type="button" 
          onClick={() => setUploadDialogOpen(true)} 
          data-testid="button-upload-document" 
          className="w-full sm:w-auto text-sm h-9 sm:h-10"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Mobile: Horizontal scroll with hidden scrollbar, Desktop: Normal grid */}
      <div className="sm:hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="grid grid-cols-2 gap-3 pb-2 min-w-max px-2">
            <Card>
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 dark:bg-blue-900 flex-shrink-0">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg sm:text-2xl font-bold truncate" data-testid="text-total-docs">{summary.totalDocs + driverDocumentsFromDrivers.length + truckDocumentsFromTrucks.length}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Documents</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={summary.expiredCount > 0 ? "border-red-200 bg-red-50 dark:bg-red-950/20" : ""}>
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-red-100 dark:bg-red-900 flex-shrink-0">
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg sm:text-2xl font-bold truncate" data-testid="text-expired-count">{summary.expiredCount}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Expired</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={summary.expiringSoonCount > 0 ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20" : ""}>
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-amber-100 dark:bg-amber-900 flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg sm:text-2xl font-bold truncate" data-testid="text-expiring-soon-count">{summary.expiringSoonCount}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Expiring Soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 dark:bg-green-900 flex-shrink-0">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg sm:text-2xl font-bold truncate" data-testid="text-healthy-count">{summary.healthyCount + driverDocumentsFromDrivers.length + truckDocumentsFromTrucks.length}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Valid</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Desktop: Normal grid layout */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 dark:bg-blue-900 flex-shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-2xl font-bold truncate" data-testid="text-total-docs">{summary.totalDocs + driverDocumentsFromDrivers.length + truckDocumentsFromTrucks.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={summary.expiredCount > 0 ? "border-red-200 bg-red-50 dark:bg-red-950/20" : ""}>
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-red-100 dark:bg-red-900 flex-shrink-0">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-2xl font-bold truncate" data-testid="text-expired-count">{summary.expiredCount}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={summary.expiringSoonCount > 0 ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20" : ""}>
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-amber-100 dark:bg-amber-900 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-2xl font-bold truncate" data-testid="text-expiring-soon-count">{summary.expiringSoonCount}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 dark:bg-green-900 flex-shrink-0">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-2xl font-bold truncate" data-testid="text-healthy-count">{summary.healthyCount + driverDocumentsFromDrivers.length + truckDocumentsFromTrucks.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Valid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(summary.expiredCount > 0 || summary.expiringSoonCount > 0) && (
        <Alert variant={summary.expiredCount > 0 ? "destructive" : "default"} className={summary.expiredCount === 0 ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : ""}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <AlertTitle className="text-sm sm:text-base">
            {summary.expiredCount > 0 ? "Action Required: Documents Expired" : "Reminder: Documents Expiring Soon"}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            {expired.length > 0 && (
              <div>
                <p className="font-medium text-red-600 dark:text-red-400 text-sm">Expired:</p>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                  {expired.map(doc => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        className="text-left underline hover:text-red-800 dark:hover:text-red-300 cursor-pointer break-words"
                        onClick={() => {
                          setSelectedDocument(doc);
                          setPreviewDialogOpen(true);
                        }}
                        data-testid={`link-expired-doc-${doc.id}`}
                      >
                        {documentTypeLabels[doc.documentType] || doc.documentType}
                      </button>
                      {doc.expiryDate && ` - expires ${new Date(doc.expiryDate).toLocaleDateString()}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {expiringSoon.length > 0 && (
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-400 text-sm">Expiring Soon:</p>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                  {expiringSoon.map(doc => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        className="text-left underline hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer break-words"
                        onClick={() => {
                          setSelectedDocument(doc);
                          setPreviewDialogOpen(true);
                        }}
                        data-testid={`link-expiring-doc-${doc.id}`}
                      >
                        {documentTypeLabels[doc.documentType] || doc.documentType}
                      </button>
                      {doc.expiryDate && ` - expires ${new Date(doc.expiryDate).toLocaleDateString()}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Please upload updated versions to maintain compliance and continue bidding on loads.
            </p>
            <Button 
              variant={summary.expiredCount > 0 ? "secondary" : "outline"}
              size="sm"
              className="mt-2 w-full sm:w-auto"
              onClick={() => setUploadDialogOpen(true)}
              data-testid="button-upload-from-alert"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Updated Documents
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="folders" className="w-full">
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-hide">
          <TabsList className="w-full sm:w-auto inline-flex min-w-max h-9 sm:h-10">
            <TabsTrigger value="folders" data-testid="tab-folders" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-1">Folders</TabsTrigger>
            <TabsTrigger value="truck" data-testid="tab-truck" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-1">Truck ({truckDocs.length})</TabsTrigger>
            <TabsTrigger value="driver" data-testid="tab-driver" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-1">Driver ({driverDocs.length})</TabsTrigger>
            <TabsTrigger value="loads" data-testid="tab-loads" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-1">Loads ({Object.values(shipmentsByLoad).reduce((sum, s) => sum + s.documents.length, 0)})</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-1">
              Alerts ({expired.length + expiringSoon.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="folders" className="mt-3 sm:mt-4">
          <Card>
            <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Document Folders</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Organize your documents by category</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {/* Mobile: Horizontal scroll with hidden scrollbar, Desktop: Normal vertical scroll */}
              <div className="sm:hidden">
                <div className="overflow-x-auto scrollbar-hide">
                  <div className="space-y-3 pb-2 min-w-max px-2">
                    <TruckFolderSection />
                    <DriverFolderSection />
                    <LoadsFolderSection />
                  </div>
                </div>
              </div>
              
              {/* Desktop: Vertical scroll */}
              <div className="hidden sm:block">
                <ScrollArea className="h-[60vh] sm:h-[65vh]">
                  <div className="space-y-2 sm:space-y-3 pr-2 sm:pr-4">
                    <TruckFolderSection />
                    <DriverFolderSection />
                    <LoadsFolderSection />
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="truck" className="mt-3 sm:mt-4">
          <Card>
            <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Truck Documents</CardTitle>
              <CardDescription className="text-xs sm:text-sm">RC, Insurance, Fitness, PUC, and Permits</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {/* Mobile: Horizontal scroll with hidden scrollbar */}
              <div className="sm:hidden">
                <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <div className="min-w-max pb-2">
                    {renderDocumentList(truckDocs, "No truck documents uploaded")}
                  </div>
                </div>
              </div>
              {/* Desktop: Vertical scroll */}
              <div className="hidden sm:block">
                <ScrollArea className="h-[65vh]">
                  <div className="pr-4">
                    {renderDocumentList(truckDocs, "No truck documents uploaded")}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="driver" className="mt-3 sm:mt-4">
          <Card>
            <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Driver Documents</CardTitle>
              <CardDescription className="text-xs sm:text-sm">License, PAN Card, and Aadhar</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {/* Mobile: Horizontal scroll with hidden scrollbar */}
              <div className="sm:hidden">
                <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <div className="min-w-max pb-2">
                    {renderDocumentList(driverDocs, "No driver documents uploaded")}
                  </div>
                </div>
              </div>
              {/* Desktop: Vertical scroll */}
              <div className="hidden sm:block">
                <ScrollArea className="h-[65vh]">
                  <div className="pr-4">
                    {renderDocumentList(driverDocs, "No driver documents uploaded")}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loads" className="mt-3 sm:mt-4">
          <Card>
            <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Load Documents</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Invoice, POD, E-Way Bill, and other shipment documents</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {(() => {
                const loadNumbers = Object.keys(shipmentsByLoad).map(Number).sort((a, b) => b - a);
                const loadsContent = loadNumbers.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="font-medium text-sm sm:text-base">No load documents yet</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Documents will appear here once you upload them for your shipments</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {loadNumbers.map(loadNum => {
                      const shipment = shipmentsByLoad[loadNum];
                      return (
                        <div key={loadNum} className="space-y-2" data-testid={`load-docs-${loadNum}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                            <span className="font-medium text-xs sm:text-sm">LD-{String(loadNum).padStart(3, '0')}</span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {shipment.status.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {shipment.documents.length} {shipment.documents.length === 1 ? 'doc' : 'docs'}
                            </Badge>
                          </div>
                          {shipment.documents.length > 0 ? (
                            <div className="ml-4 sm:ml-6 space-y-2">
                              {shipment.documents.map(doc => renderShipmentDocument(doc))}
                            </div>
                          ) : (
                            <p className="ml-4 sm:ml-6 text-xs sm:text-sm text-muted-foreground">No documents uploaded for this load</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
                return (
                  <>
                    {/* Mobile: Horizontal scroll with hidden scrollbar */}
                    <div className="sm:hidden">
                      <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <div className="min-w-max pb-2">
                          {loadsContent}
                        </div>
                      </div>
                    </div>
                    {/* Desktop: Vertical scroll */}
                    <div className="hidden sm:block">
                      <ScrollArea className="h-[65vh]">
                        <div className="pr-4">
                          {loadsContent}
                        </div>
                      </ScrollArea>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-3 sm:mt-4">
          <Card>
            <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-amber-600 text-base sm:text-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
                Documents Requiring Attention
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Expired or expiring documents</CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {expired.length === 0 && expiringSoon.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 text-green-500" />
                  <p className="font-medium text-sm sm:text-base">All documents are valid!</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">No documents require attention at this time</p>
                </div>
              ) : (
                <>
                  {/* Mobile: Horizontal scroll with hidden scrollbar */}
                  <div className="sm:hidden">
                    <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <div className="min-w-max pb-2 space-y-2">
                        {[...expiredForDisplay, ...expiringSoonForDisplay].map(doc => renderDocument(doc))}
                      </div>
                    </div>
                  </div>
                  {/* Desktop: Vertical scroll */}
                  <div className="hidden sm:block">
                    <ScrollArea className="h-[calc(100vh-450px)]">
                      <div className="pr-4 space-y-3">
                        {[...expiredForDisplay, ...expiringSoonForDisplay].map(doc => renderDocument(doc))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg w-[95vw] mx-auto max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-base sm:text-lg">Upload Document</DialogTitle>
            <DialogDescription className="text-sm">
              Upload your compliance documents. Supported formats: PDF, JPG, PNG
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Document Type</Label>
              <Select value={selectedDocType} onValueChange={(val) => {
                setSelectedDocType(val);
                setSelectedDriverId("");
                setSelectedTruckId("");
                setDocVerified(false);
                setDocVerifyMessage(null);
              }}>
                <SelectTrigger data-testid="select-document-type" className="w-full">
                  <SelectValue placeholder="Select document type..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="license">Driving License</SelectItem>
                  <SelectItem value="rc">Registration Certificate (RC)</SelectItem>
                  <SelectItem value="insurance">Vehicle Insurance</SelectItem>
                  <SelectItem value="fitness">Fitness Certificate</SelectItem>
                  <SelectItem value="permit">Road Permit</SelectItem>
                  <SelectItem value="puc">PUC Certificate</SelectItem>
                  <SelectItem value="pan_card">PAN Card</SelectItem>
                  <SelectItem value="aadhar">Aadhar Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Driver selection for fleet/enterprise carriers when uploading driver docs */}
            {carrierType === "enterprise" && 
              isDriverDocType(selectedDocType) && 
              driversData && driversData.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Driver</Label>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger data-testid="select-driver" className="w-full">
                    <SelectValue placeholder="Select which driver..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {driversData.map((driver: any) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{driver.name}</span>
                          {driver.phone && (
                            <span className="text-muted-foreground text-xs whitespace-nowrap">({driver.phone})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the driver this document belongs to
                </p>
              </div>
            )}

            {/* Truck selection for fleet/enterprise carriers when uploading truck docs */}
            {carrierType === "enterprise" && 
              isTruckDocType(selectedDocType) && 
              trucksData && trucksData.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Truck</Label>
                <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
                  <SelectTrigger data-testid="select-truck" className="w-full">
                    <SelectValue placeholder="Select which truck..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {trucksData.map((truck: any) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        <div className="flex items-center gap-2">
                          <Truck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{truck.licensePlate || truck.registrationNumber || `Truck ${truck.id}`}</span>
                          {truck.truckType && (
                            <span className="text-muted-foreground text-xs whitespace-nowrap">({truck.truckType})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the truck this document belongs to
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">File</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 sm:p-6 text-center">
                {selectedFile ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <File className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">({formatFileSize(selectedFile.size)})</span>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => { setSelectedFile(null); setDocVerified(false); setDocVerifyMessage(null); }}
                      data-testid="button-remove-file"
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to browse or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF, JPG, or PNG up to 10MB
                      </p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                        setDocVerified(false);
                        setDocVerifyMessage(null);
                        if (file && VERIFIABLE_DOC_TYPES.has(selectedDocType)) {
                          void handleVerifyDocument(file);
                        }
                      }}
                      data-testid="input-file-upload"
                    />
                  </label>
                )}
              </div>
              {docVerifyMessage && (
                <p className="text-xs text-muted-foreground">{docVerifyMessage}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Expiry Date (Optional)</Label>
              <Input 
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                data-testid="input-expiry-date"
              />
              <p className="text-xs text-muted-foreground">
                Set an expiry date to receive alerts before renewal is needed
              </p>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setUploadDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={
                !selectedDocType ||
                !selectedFile ||
                uploadMutation.isPending ||
                isStorageUploading ||
                isDocVerifying ||
                (VERIFIABLE_DOC_TYPES.has(selectedDocType) && !docVerified)
              }
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending || isStorageUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] mx-auto max-h-[90vh] flex flex-col">
          {selectedDocument && (
            <>
              <DialogHeader className="flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-base sm:text-lg truncate">
                      {documentTypeLabels[selectedDocument.documentType] || selectedDocument.documentType}
                    </DialogTitle>
                    <DialogDescription className="text-sm truncate">
                      {selectedDocument.fileName}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
                {/* Document Preview Section */}
                <div className="mb-4">
                  <div className="w-full rounded-lg border bg-muted/30 overflow-hidden">
                    <div className="w-full min-h-[200px] max-h-[55vh] overflow-hidden flex items-center justify-center">
                      <DocumentPreview 
                        fileUrl={selectedDocument.fileUrl}
                        fileName={selectedDocument.fileName}
                      />
                    </div>
                  </div>
                </div>

                {/* Document Information Section */}
                <div className="space-y-4 border-t pt-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">File Size</p>
                      <p className="font-medium mt-0.5">{formatFileSize(selectedDocument.fileSize)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <div className="mt-1">
                        {selectedDocument.verificationStatus === "rejected" ? (
                          <Badge variant="destructive">Rejected</Badge>
                        ) : selectedDocument.isVerified || selectedDocument.verificationStatus === "approved" ? (
                          <Badge variant="default">Verified</Badge>
                        ) : (
                          <Badge variant="secondary">Pending Review</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Uploaded</p>
                      <p className="font-medium mt-0.5">
                        {selectedDocument.createdAt ? format(new Date(selectedDocument.createdAt), "dd MMM yyyy") : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Expiry Date</p>
                      <p className="font-medium mt-0.5">
                        {selectedDocument.expiryDate 
                          ? format(new Date(selectedDocument.expiryDate), "dd MMM yyyy")
                          : "No expiry date"}
                      </p>
                    </div>
                  </div>

                  {selectedDocument.verificationStatus === "rejected" && selectedDocument.rejectionReason && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                      <p className="text-sm font-medium text-red-800 dark:text-red-400">Rejection Reason:</p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1 break-words">{selectedDocument.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline"
                  onClick={async () => {
                    const rawUrl = selectedDocument.fileUrl;
                    if (!rawUrl) return;
                    try {
                      const pathForApi = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
                        ? new URL(rawUrl).pathname
                        : rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
                      const res = await fetch(`/api/documents/presigned-url?path=${encodeURIComponent(pathForApi)}`, { credentials: "include" });
                      const data = await res.json().catch(() => ({}));
                      if (data?.url) {
                        window.open(data.url, "_blank", "noopener,noreferrer");
                      } else {
                        // fallback: open via authenticated objects route
                        const url = getDocumentUrl(rawUrl);
                        if (url) window.open(url, "_blank", "noopener,noreferrer");
                      }
                    } catch {
                      const url = getDocumentUrl(rawUrl);
                      if (url) window.open(url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  data-testid="button-view-full"
                  className="w-full sm:w-auto"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Full Size
                </Button>
                <Button 
                  variant="outline"
                  onClick={async () => {
                    const rawUrl = selectedDocument.fileUrl;
                    if (!rawUrl) return;
                    try {
                      const pathForApi = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
                        ? new URL(rawUrl).pathname
                        : rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
                      const res = await fetch(`/api/documents/presigned-url?path=${encodeURIComponent(pathForApi)}`, { credentials: "include" });
                      const data = await res.json().catch(() => ({}));
                      const finalUrl = data?.url || getDocumentUrl(rawUrl);
                      if (!finalUrl) return;
                      // Force download via anchor
                      const a = document.createElement("a");
                      a.href = finalUrl;
                      a.download = selectedDocument.fileName || "document";
                      a.target = "_blank";
                      a.rel = "noopener noreferrer";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    } catch {
                      const url = getDocumentUrl(rawUrl);
                      if (url) window.open(url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  data-testid="button-download-preview"
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleDelete(selectedDocument.id)}
                  disabled={
                    deleteMutation.isPending ||
                    !isCarrierDocumentId(selectedDocument.id)
                  }
                  data-testid="button-delete-document"
                  className="w-full sm:w-auto"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewAllDialogOpen} onOpenChange={setViewAllDialogOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] mx-auto max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FolderOpen className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <span className="truncate">{viewAllFolderName}</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              {viewAllDocuments.length} document{viewAllDocuments.length !== 1 ? 's' : ''} in this folder
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {viewAllDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No documents in this folder</p>
                </div>
              ) : (
                viewAllDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card hover-elevate cursor-pointer"
                    onClick={() => {
                      setSelectedDocument(doc);
                      setViewAllDialogOpen(false);
                      setPreviewDialogOpen(true);
                    }}
                    data-testid={`view-all-doc-${doc.id}`}
                  >
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {doc.verificationStatus === "approved" || doc.isVerified ? (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : doc.verificationStatus === "rejected" ? (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        )}
                        <p className="font-medium truncate text-sm sm:text-base">
                          {documentTypeLabels[doc.documentType] || doc.documentType}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {getDocumentOwnerInfo(doc) || doc.fileName}
                      </p>
                      {doc.expiryDate && (
                        <p className={`text-xs mt-1 ${
                          new Date(doc.expiryDate) < new Date() 
                            ? 'text-red-500' 
                            : differenceInDays(new Date(doc.expiryDate), new Date()) <= 30 
                              ? 'text-amber-500'
                              : 'text-muted-foreground'
                        }`}>
                          {new Date(doc.expiryDate) < new Date() 
                            ? 'Expired' 
                            : `Expires ${format(new Date(doc.expiryDate), 'MMM d, yyyy')}`
                          }
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-shrink-0">
                      <Badge 
                        variant={doc.verificationStatus === "approved" || doc.isVerified ? "default" : doc.verificationStatus === "rejected" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {doc.verificationStatus === "approved" || doc.isVerified ? 'Verified' : doc.verificationStatus === "rejected" ? 'Rejected' : 'Pending'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (doc.fileUrl) {
                            const url = getDocumentUrl(doc.fileUrl);
                            if (url) {
                              window.open(url, "_blank");
                            }
                          }
                        }}
                        data-testid={`button-download-viewall-${doc.id}`}
                        className="flex-shrink-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="flex-shrink-0">
            <Button 
              variant="outline" 
              onClick={() => setViewAllDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
