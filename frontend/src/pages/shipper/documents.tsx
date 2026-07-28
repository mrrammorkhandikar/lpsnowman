import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUpload } from "@/hooks/use-upload";
import { queryClient } from "@/lib/queryClient";
import { getApiUrl } from "@/lib/api-client";
import { useLoads } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-context";
import { onMarketplaceEvent } from "@/lib/marketplace-socket";
import { 
  FileText, Upload, Search, Filter, Download, Eye, Trash2, AlertCircle, 
  CheckCircle, X, Tag, Calendar, Link2, Plus, RotateCw, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, Clock, FileImage, Info, Edit2, History,
  Folder, FolderOpen, ArrowLeft, Receipt, Truck, Shield, Image, FileCheck,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import {
  useDocumentVault,
  documentCategoryLabels,
  formatFileSize,
  formatDate,
  getDaysUntilExpiry,
  type VaultDocument,
  type DocumentCategory,
  type DocumentStatus,
} from "@/lib/document-vault-store";
import { getDocumentUrl, parseStoredDocumentReference } from "@/lib/document-utils";

type SortOption = "newest" | "oldest" | "expiring" | "largest";

/** Map vault category → API document_type for POST /api/shipper/documents */
function categoryToShipperApiType(category: DocumentCategory): string {
  const map: Partial<Record<DocumentCategory, string>> = {
    pod: "pod",
    invoice: "invoice",
    lr: "lr_consignment",
    eway_bill: "eway_bill",
    photos: "loading_photos",
    verification: "other",
    other: "other",
    bol: "bol",
    weight_slip: "weight_slip",
    insurance: "other",
    rc: "other",
    fitness: "other",
    license: "other",
  };
  return map[category] ?? "other";
}

function isHeicFileName(name: string): boolean {
  return /\.(heic|heif)$/i.test(name);
}

/** When API returns 0 B, try HEAD on the object URL to read Content-Length (S3 / proxies). */
function DocumentSizeLabel({ bytes, storagePath }: { bytes: number; storagePath: string }) {
  const [resolved, setResolved] = useState(bytes);
  useEffect(() => {
    if (bytes > 0) {
      setResolved(bytes);
      return;
    }
    const url = getDocumentUrl(storagePath);
    if (!url) return;
    let cancelled = false;
    void fetch(url, { method: "HEAD", credentials: "include" })
      .then((res) => {
        const cl = res.headers.get("content-length");
        if (cl && !cancelled) {
          const n = parseInt(cl, 10);
          if (Number.isFinite(n) && n > 0) setResolved(n);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bytes, storagePath]);
  return <>{formatFileSize(resolved > 0 ? resolved : bytes)}</>;
}

// Helper function to check if a file URL is displayable (supports JSON metadata in DB)
const isDisplayableUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  const parsed = parseStoredDocumentReference(url);
  const path = parsed?.storagePath ?? url;
  return !!getDocumentUrl(path);
};

// Shipper-specific document categories (excluding carrier documents)
const shipperDocumentCategories: DocumentCategory[] = [
  "pod", "invoice", "lr", "eway_bill", "photos", "verification", "other"
];

// Folder configuration for shipper document categories
const documentFolders: Partial<Record<DocumentCategory, {
  label: string;
  icon: typeof FileText;
  color: string;
  bgColor: string;
  description: string;
}>> = {
  eway_bill: {
    label: "E-way Bills",
    icon: Shield,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    description: "GST e-way bill documents for transport",
  },
  lr: {
    label: "LR / Consignments",
    icon: FileCheck,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    description: "Lorry receipts and consignment notes",
  },
  pod: {
    label: "Proof of Delivery",
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    description: "Delivery confirmations and receipts",
  },
  bol: {
    label: "Bill of Lading",
    icon: Truck,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    description: "Transport and shipping contracts",
  },
  invoice: {
    label: "Invoices",
    icon: Receipt,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    description: "Billing and payment documents",
  },
  photos: {
    label: "Photos",
    icon: Image,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    description: "Loading, unloading, and delivery photos",
  },
  weight_slip: {
    label: "Weight Slips",
    icon: FileText,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    description: "Weighbridge and weight verification slips",
  },
  verification: {
    label: "Shipper's Documents",
    icon: Shield,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    description: "Business verification and onboarding documents",
  },
  other: {
    label: "Other Documents",
    icon: Folder,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
    description: "Miscellaneous supporting documents",
  },
};

const shipperCategoryLabels: Record<string, string> = {
  pod: "Proof of Delivery",
  bol: "Bill of Lading",
  invoice: "Invoice",
  lr: "LR / Consignment Note",
  eway_bill: "E-way Bill",
  weight_slip: "Weight Slip",
  photos: "Photos",
  verification: "Verification Document",
  other: "Other",
};

// Map API document types to our category types
const apiDocTypeToCategory: Record<string, DocumentCategory> = {
  lr_consignment: "lr",
  eway_bill: "eway_bill",
  loading_photos: "photos",
  delivery_photos: "photos",
  pod: "pod",
  invoice: "invoice",
  weight_slip: "weight_slip",
  bol: "bol",
  other: "other",
  gst_certificate: "verification",
  pan_card: "verification",
  incorporation_certificate: "verification",
  cancelled_cheque: "verification",
  address_proof: "verification",
  selfie: "verification",
  msme_certificate: "verification",
  udyam_certificate: "verification",
  lr_copy: "verification",
  alternative_authorization: "verification",
};

interface ApiDocument {
  id: string;
  userId: string;
  loadId?: string;
  shipmentId?: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  isVerified: boolean;
  createdAt: string;
  expiryDate?: string | null;
  load?: {
    shipperLoadNumber?: number;
    adminReferenceNumber?: number;
  } | null;
  isOnboardingDoc?: boolean;
}

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [location] = useLocation();
  const {
    templates,
    deleteDocument,
    verifyDocument,
    replaceDocument,
    getExpiringDocuments,
    getExpiredDocuments,
  } = useDocumentVault();
  const { user } = useAuth();
  const { data: onboardingData } = useQuery<any>({
    queryKey: ['/api/shipper/onboarding'],
    enabled: !!user,
  });
  const isTransporter = onboardingData?.shipperRole === "transporter";
  const { data: allLoads } = useLoads();
  const activeLoads = useMemo(() => {
    return (allLoads || [])
      .filter((load: any) => load.shipperId === user?.id)
      .map((load: any) => {
        const loadNum = load.adminReferenceNumber || load.shipperLoadNumber;
        const loadId = loadNum ? `LD-${String(loadNum).padStart(3, '0')}` : load.id.slice(0, 8);
        return {
          loadId,
          pickup: load.pickupCity || load.pickupLocation || '',
          drop: load.dropoffCity || load.dropoffLocation || '',
        };
      });
  }, [allLoads, user?.id]);
  
  // Get initial load filter from URL query parameter
  const getInitialLoadFilter = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const loadParam = urlParams.get('load');
      if (loadParam) {
        // If already in LD-XXX format, use directly
        if (loadParam.startsWith('LD-')) {
          return loadParam;
        }
        // Otherwise, format load ID to match our format (LD-XXX)
        const loadNum = parseInt(loadParam);
        if (!isNaN(loadNum)) {
          return `LD-${String(loadNum).padStart(3, '0')}`;
        }
        return loadParam;
      }
    }
    return "all";
  };
  
  // Fetch real shipment documents from API
  const { data: apiDocuments = [], isLoading: isLoadingApiDocs } = useQuery<ApiDocument[]>({
    queryKey: ['/api/shipper/documents'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const uploadVaultMutation = useMutation({
    mutationFn: async (body: {
      documentType: string;
      fileName: string;
      fileUrl: string;
      fileSize: number;
      loadId?: string;
      expiryDate?: string | null;
    }) => {
      const res = await fetch(getApiUrl("api/shipper/documents"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Failed to save document (${res.status})`
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipper/documents"] });
    },
  });

  const deleteVaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(getApiUrl(`api/shipper/documents/${encodeURIComponent(id)}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Failed to delete (${res.status})`
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipper/documents"] });
    },
  });

  const resolveLoadDbId = useCallback((loadIdForm: string): string | undefined => {
    if (!loadIdForm || loadIdForm === "none") return undefined;
    const m = loadIdForm.match(/^LD-(\d+)$/i);
    if (!m) return undefined;
    const num = parseInt(m[1], 10);
    const load = (allLoads || []).find((l: any) => {
      if (l.shipperId !== user?.id) return false;
      const n = l.adminReferenceNumber ?? l.shipperLoadNumber;
      return n === num;
    });
    return load?.id;
  }, [allLoads, user?.id]);
  
  // Convert API documents to VaultDocument format (real data only)
  const documents = useMemo(() => {
    const convertedApiDocs: VaultDocument[] = apiDocuments.map((doc) => {
      const category = apiDocTypeToCategory[doc.documentType] || "other";
      const loadNumber = doc.load?.adminReferenceNumber || doc.load?.shipperLoadNumber;
      const loadIdStr = loadNumber ? `LD-${String(loadNumber).padStart(3, '0')}` : doc.loadId;
      const expiry = doc.expiryDate ? new Date(doc.expiryDate) : undefined;
      const days = expiry ? getDaysUntilExpiry(expiry) : null;
      let status: DocumentStatus = "active";
      if (days !== null) {
        if (days < 0) status = "expired";
        else if (days <= 30) status = "expiring_soon";
      }

      // Onboarding uploads store JSON { path, name } in file_url; API used to derive a broken fileName from that.
      const fromUrl = parseStoredDocumentReference(doc.fileUrl);
      const fromName = doc.fileName.trim().startsWith("{") ? parseStoredDocumentReference(doc.fileName) : null;
      const effectiveFileUrl = fromUrl?.storagePath ?? fromName?.storagePath ?? doc.fileUrl;
      const effectiveFileName = fromUrl?.displayName ?? fromName?.displayName ?? doc.fileName;
      const lowerName = effectiveFileName.toLowerCase();
      const sizeFromMeta = fromUrl?.sizeBytes ?? fromName?.sizeBytes;
      const parsedDbSize = doc.fileSize == null || doc.fileSize === "" ? 0 : Number(doc.fileSize);
      const numericSize = Number.isFinite(parsedDbSize) ? parsedDbSize : 0;
      
      return {
        documentId: `api-${doc.id}`,
        fileName: effectiveFileName,
        fileSize: numericSize || sizeFromMeta || 0,
        fileType: lowerName.endsWith('.pdf') ? "pdf" as const : "image" as const,
        fileUrl: effectiveFileUrl,
        category,
        loadId: doc.isOnboardingDoc ? "Verification" : loadIdStr,
        shipmentId: doc.shipmentId,
        uploadedBy: doc.isOnboardingDoc ? "Shipper (Onboarding)" : "Carrier",
        uploadedDate: new Date(doc.createdAt),
        expiryDate: expiry,
        status,
        tags: doc.isOnboardingDoc ? [doc.documentType, "verification"] : [doc.documentType],
        version: 1,
        isVerified: doc.isVerified,
      };
    });
    
    return convertedApiDocs;
  }, [apiDocuments]);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [loadFilter, setLoadFilter] = useState(() => getInitialLoadFilter());
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedFolder, setSelectedFolder] = useState<DocumentCategory | null>(null);
  
  // Update load filter when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loadParam = urlParams.get('load');
    if (loadParam) {
      // Use the load param directly if it's already in LD-XXX format, otherwise format it
      if (loadParam.startsWith('LD-')) {
        setLoadFilter(loadParam);
      } else {
        const loadNum = parseInt(loadParam);
        if (!isNaN(loadNum)) {
          setLoadFilter(`LD-${String(loadNum).padStart(3, '0')}`);
        } else {
          setLoadFilter(loadParam);
        }
      }
    }
  }, [location]);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImageFailed, setViewerImageFailed] = useState(false);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<VaultDocument | null>(null);
  const [expiringViewOpen, setExpiringViewOpen] = useState(false);

  // File upload with real object storage
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>("");
  const [uploadedFileSize, setUploadedFileSize] = useState<number>(0);
  
  const { uploadFile, isUploading, error: uploadError } = useUpload({
    onSuccess: (response) => {
      // Use the object path directly - the server has /objects/:objectPath route
      // The objectPath is like "/objects/uploads/uuid"
      setUploadedFileUrl(response.objectPath);
      setUploadedFileSize(response.metadata.size);
      toast({
        title: t('documents.uploadComplete'),
        description: t('documents.fileUploaded'),
      });
    },
    onError: (err) => {
      console.error("Upload error:", err);
      toast({
        title: t('common.error'),
        description: err.message || t('documents.uploadFailed'),
        variant: "destructive",
      });
    },
  });

  const [uploadForm, setUploadForm] = useState({
    fileName: "",
    fileType: "pdf" as "pdf" | "image",
    category: "" as DocumentCategory | "",
    loadId: "none",
    notes: "",
    tags: "",
    expiryDate: "",
  });
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Listen for real-time document upload events
  // Note: The WebSocket connection is established at the app level, so we only subscribe to events here
  useEffect(() => {
    const unsubscribe = onMarketplaceEvent("shipment_document_uploaded", (data: any) => {
      const docType = data?.document?.documentType || data?.documentType;
      const categoryMapping: Record<string, string> = {
        lr_consignment: "LR / Consignment",
        eway_bill: "E-way Bill",
        loading_photos: "Photos",
        delivery_photos: "Photos",
        pod: "Proof of Delivery",
        invoice: "Invoice",
        weight_slip: "Weight Slip",
        bol: "Bill of Lading",
        gst_certificate: "Verification Document",
        pan_card: "Verification Document",
        incorporation_certificate: "Verification Document",
        cancelled_cheque: "Verification Document",
        address_proof: "Verification Document",
        selfie: "Verification Document",
        msme_certificate: "Verification Document",
        udyam_certificate: "Verification Document",
        lr_copy: "Verification Document",
        alternative_authorization: "Verification Document",
        other: "Other",
      };
      const categoryName = categoryMapping[docType] || docType || "Document";
      
      // Show toast notification for new document
      toast({
        title: t('documents.newDocumentReceived', { defaultValue: "New Document Received" }),
        description: t('documents.documentAddedToCategory', { 
          defaultValue: `${categoryName} document has been added to your vault`,
          category: categoryName 
        }),
      });
      
      // Query is already invalidated by the WebSocket handler in marketplace-socket.ts
    });
    
    return () => {
      unsubscribe();
    };
  }, [toast, t]);

  // Filter expiring/expired docs to only show shipper-relevant categories (not carrier documents)
  const expiringDocs = getExpiringDocuments().filter(doc => shipperDocumentCategories.includes(doc.category));
  const expiredDocs = getExpiredDocuments().filter(doc => shipperDocumentCategories.includes(doc.category));

  // Count documents per category for folder badges
  const documentCountsByCategory = useMemo(() => {
    const counts: Record<DocumentCategory, number> = {} as Record<DocumentCategory, number>;
    shipperDocumentCategories.forEach(cat => {
      counts[cat] = documents.filter(d => d.category === cat && shipperDocumentCategories.includes(d.category)).length;
    });
    return counts;
  }, [documents]);

  const filteredAndSortedDocs = useMemo(() => {
    let result = documents.filter(doc => {
      // Only show shipper-relevant document categories
      const isShipperCategory = shipperDocumentCategories.includes(doc.category);
      const matchesSearch = 
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.loadId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      // When a folder is selected, filter by that folder
      const matchesFolder = selectedFolder === null || doc.category === selectedFolder;
      const matchesType = typeFilter === "all" || doc.category === typeFilter;
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
      const matchesLoad = loadFilter === "all" || doc.loadId === loadFilter;
      return isShipperCategory && matchesSearch && matchesFolder && matchesType && matchesStatus && matchesLoad;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.uploadedDate.getTime() - a.uploadedDate.getTime();
        case "oldest":
          return a.uploadedDate.getTime() - b.uploadedDate.getTime();
        case "expiring":
          const aExp = a.expiryDate?.getTime() || Infinity;
          const bExp = b.expiryDate?.getTime() || Infinity;
          return aExp - bExp;
        case "largest":
          return b.fileSize - a.fileSize;
        default:
          return 0;
      }
    });

    return result;
  }, [documents, searchQuery, selectedFolder, typeFilter, statusFilter, loadFilter, sortBy]);

  // Handle folder navigation
  const handleFolderClick = (category: DocumentCategory) => {
    setSelectedFolder(category);
    setSearchQuery("");
    setStatusFilter("all");
    setLoadFilter("all");
  };

  const handleBackToFolders = () => {
    setSelectedFolder(null);
    setSearchQuery("");
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill filename from the file
      setUploadForm(prev => ({
        ...prev,
        fileName: file.name,
        fileType: file.type.includes('pdf') ? 'pdf' : 'image',
      }));
      // Upload the file immediately to object storage
      await uploadFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = () => {
    if (!uploadForm.category) {
      toast({
        title: t('common.error'),
        description: t('documents.selectDocumentType'),
        variant: "destructive",
      });
      return;
    }

    if (!uploadedFileUrl) {
      toast({
        title: t('common.error'),
        description: t('documents.pleaseSelectFile'),
        variant: "destructive",
      });
      return;
    }

    const template = templates.find(t => t.id === uploadForm.category);
    let expiryDate: Date | undefined;
    if (uploadForm.expiryDate) {
      expiryDate = new Date(uploadForm.expiryDate);
    } else if (template?.hasExpiry && template.defaultExpiryMonths) {
      expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + template.defaultExpiryMonths);
    }

    const loadUuid = resolveLoadDbId(uploadForm.loadId);
    const fileName = uploadForm.fileName || selectedFile?.name || "document";
    const fileSize = Math.max(uploadedFileSize ?? 0, selectedFile?.size ?? 0);

    uploadVaultMutation.mutate(
      {
        documentType: categoryToShipperApiType(uploadForm.category as DocumentCategory),
        fileName,
        fileUrl: uploadedFileUrl,
        fileSize,
        loadId: loadUuid,
        expiryDate: expiryDate ? expiryDate.toISOString() : null,
      },
      {
        onSuccess: () => {
          toast({
            title: t('documents.documentUploaded'),
            description: `${fileName} ${t('documents.addedToVault')}`,
          });
          setUploadForm({
            fileName: "",
            fileType: "pdf",
            category: "",
            loadId: "none",
            notes: "",
            tags: "",
            expiryDate: "",
          });
          setSelectedFile(null);
          setUploadedFileUrl("");
          setUploadedFileSize(0);
          setUploadDialogOpen(false);
        },
        onError: (err: Error) => {
          toast({
            title: t('common.error'),
            description: err.message || "Could not save document",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleView = (doc: VaultDocument) => {
    setSelectedDocument(doc);
    setViewerImageFailed(false);
    setZoom(100);
    setRotation(0);
    setViewerOpen(true);
  };

  const handleDetails = (doc: VaultDocument) => {
    setSelectedDocument(doc);
    setDetailPanelOpen(true);
  };

  const handleDelete = (doc: VaultDocument) => {
    if (doc.documentId.startsWith("api-")) {
      const rawId = doc.documentId.replace(/^api-/, "");
      if (rawId.startsWith("onboarding-")) {
        toast({
          title: "Cannot delete",
          description: "Update or remove this file from Shipper Onboarding instead.",
          variant: "destructive",
        });
        return;
      }
      deleteVaultMutation.mutate(rawId, {
        onSuccess: () => {
          toast({
            title: "Document Deleted",
            description: `${doc.fileName} has been removed from your vault.`,
          });
          setDetailPanelOpen(false);
        },
        onError: (err: Error) => {
          toast({
            title: t("common.error"),
            description: err.message,
            variant: "destructive",
          });
        },
      });
      return;
    }
    deleteDocument(doc.documentId);
    toast({
      title: "Document Deleted",
      description: `${doc.fileName} has been removed from your vault.`,
    });
    setDetailPanelOpen(false);
  };

  const handleVerify = (doc: VaultDocument) => {
    verifyDocument(doc.documentId);
    toast({
      title: "Document Verified",
      description: `${doc.fileName} has been marked as verified.`,
    });
  };

  const handleDownload = (doc: VaultDocument) => {
    const parsed = parseStoredDocumentReference(doc.fileUrl);
    const path = parsed?.storagePath ?? doc.fileUrl;
    const url = getDocumentUrl(path);
    const safeName = parsed?.displayName || doc.fileName || "document";
    if (!url) {
      toast({
        title: t("common.error"),
        description: "Could not resolve document URL.",
        variant: "destructive",
      });
      return;
    }
    void (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = safeName;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
        toast({
          title: "Download Started",
          description: `Downloading ${safeName}...`,
        });
      } catch {
        window.open(url, "_blank", "noopener,noreferrer");
        toast({
          title: "Opening document",
          description: `If download did not start, save the file from the new tab (${safeName}).`,
        });
      }
    })();
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setUploadForm((prev) => ({
      ...prev,
      category: templateId as DocumentCategory,
      tags: template?.suggestedTags?.length ? template.suggestedTags.join(", ") : prev.tags,
    }));
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate">Active</Badge>;
      case "expiring_soon":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate">Expiring Soon</Badge>;
      case "expired":
        return <Badge variant="destructive" className="no-default-hover-elevate no-default-active-elevate">Expired</Badge>;
    }
  };

  const linkedLoads = Array.from(new Set(documents.filter(d => d.loadId).map(d => d.loadId!)));

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{t('documents.title')}</h1>
          <p className="text-sm text-muted-foreground">{isTransporter ? "Transporter Documents" : t('shipper.documentsTitle')}</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-document" className="w-full sm:w-auto">
          <Upload className="h-4 w-4 mr-2" />
          <span className="sm:inline">{t('documents.uploadDocument')}</span>
        </Button>
      </div>

      {(expiringDocs.length > 0 || expiredDocs.length > 0) && !selectedFolder && (
        <Card className="mb-4 sm:mb-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base text-amber-800 dark:text-amber-200">
                  {expiredDocs.length > 0 && `${expiredDocs.length} ${t('documents.expired')}`}
                  {expiredDocs.length > 0 && expiringDocs.length > 0 && " & "}
                  {expiringDocs.length > 0 && `${expiringDocs.length} ${t('documents.expiringSoon')}`}
                </p>
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                  {t('documents.expiringDocuments')}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setExpiringViewOpen(true)}
                data-testid="button-view-expiring"
                className="w-full sm:w-auto"
              >
                {t('documents.viewDocument')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folder View - Show when no folder is selected */}
      {selectedFolder === null ? (
        <>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-4 sm:mb-6">
            {shipperDocumentCategories.map((category) => {
              const folder = documentFolders[category];
              if (!folder) return null;
              const count = documentCountsByCategory[category] || 0;
              const FolderIcon = folder.icon;
              
              return (
                <Card 
                  key={category}
                  className="hover-elevate cursor-pointer transition-all"
                  onClick={() => handleFolderClick(category)}
                  data-testid={`folder-${category}`}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3 mb-2 sm:mb-3">
                      <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg ${folder.bgColor} flex-shrink-0`}>
                        <FolderIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${folder.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm line-clamp-2">{category === "verification" && isTransporter ? "Transporter's Documents" : folder.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{count} {count === 1 ? 'document' : 'documents'}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{folder.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats */}
          <Card className="mb-4 sm:mb-6">
            <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
              <CardTitle className="text-sm sm:text-base">Quick Overview</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <div className="text-center p-2 sm:p-3 rounded-lg bg-muted/50">
                  <p className="text-xl sm:text-2xl font-bold">{documents.filter(d => shipperDocumentCategories.includes(d.category)).length}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Documents</p>
                </div>
                <div className="text-center p-2 sm:p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                    {documents.filter(d => d.status === "active" && shipperDocumentCategories.includes(d.category)).length}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
                </div>
                <div className="text-center p-2 sm:p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{expiringDocs.length}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Expiring Soon</p>
                </div>
                <div className="text-center p-2 sm:p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{expiredDocs.length}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Expired</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Folder Contents View - Show when a folder is selected */
        <>
          {/* Breadcrumb and Back Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 sm:mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToFolders}
              data-testid="button-back-to-folders"
              className="w-full sm:w-auto justify-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Folders
            </Button>
            <Separator orientation="vertical" className="hidden sm:block h-6" />
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-hidden">
              {(() => {
                const folder = documentFolders[selectedFolder];
                if (!folder) return null;
                const FolderIcon = folder.icon;
                return (
                  <>
                    <div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded ${folder.bgColor} flex-shrink-0`}>
                      <FolderIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${folder.color}`} />
                    </div>
                    <span className="font-medium text-sm sm:text-base truncate">{selectedFolder === "verification" && isTransporter ? "Transporter's Documents" : folder.label}</span>
                    <Badge variant="secondary" className="ml-auto sm:ml-2 no-default-hover-elevate no-default-active-elevate flex-shrink-0 text-xs">
                      {filteredAndSortedDocs.length}
                    </Badge>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Search and Filters for folder contents */}
          <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm"
                  data-testid="input-search-documents"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DocumentStatus | "all")}>
                <SelectTrigger className="w-full sm:w-36 md:w-40" data-testid="select-status-filter">
                  <SelectValue placeholder={t('common.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="active">{t('common.active')}</SelectItem>
                  <SelectItem value="expiring_soon">{t('documents.expiringSoon')}</SelectItem>
                  <SelectItem value="expired">{t('documents.expired')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={loadFilter} onValueChange={setLoadFilter}>
                <SelectTrigger className="w-full sm:w-36 md:w-40" data-testid="select-load-filter">
                  <Link2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('loads.title')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')} {t('loads.title')}</SelectItem>
                  {linkedLoads.map(loadId => (
                    <SelectItem key={loadId} value={loadId}>{loadId}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-full sm:w-32 md:w-36" data-testid="select-sort">
                  <SelectValue placeholder={t('common.sortBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="expiring">Expiring Soon</SelectItem>
                  <SelectItem value="largest">Largest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Document Cards */}
          {filteredAndSortedDocs.length === 0 ? (
            <EmptyState
              icon={Folder}
              title="No documents in this folder"
              description="Upload documents to organize them in this category."
              actionLabel={t('documents.uploadDocument')}
              onAction={() => setUploadDialogOpen(true)}
            />
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedDocs.map((doc) => (
                <Card 
                  key={doc.documentId} 
                  className="hover-elevate cursor-pointer" 
                  onClick={() => handleDetails(doc)}
                  data-testid={`document-card-${doc.documentId}`}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${
                        doc.fileType === "pdf" 
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        {doc.fileType === "pdf" ? <FileText className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" data-testid={`text-filename-${doc.documentId}`}>
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <DocumentSizeLabel bytes={doc.fileSize} storagePath={doc.fileUrl} />
                        </p>
                      </div>
                      {doc.isVerified ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between gap-2">
                        {getStatusBadge(doc.status)}
                      </div>
                      {doc.loadId && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t('loads.title')}</span>
                          <span className="font-medium">{doc.loadId}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('documents.uploadedOn')}</span>
                        <span>{formatDate(doc.uploadedDate)}</span>
                      </div>
                      {doc.expiryDate && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t('documents.expiryDate')}</span>
                          <span className={doc.status === "expired" ? "text-destructive" : doc.status === "expiring_soon" ? "text-amber-600 dark:text-amber-400" : ""}>
                            {formatDate(doc.expiryDate)}
                            {doc.status !== "active" && ` (${getDaysUntilExpiry(doc.expiryDate)}d)`}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 text-xs sm:text-sm" 
                        onClick={() => handleView(doc)}
                        data-testid={`button-view-${doc.documentId}`}
                      >
                        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                        <span className="hidden sm:inline">{t('common.view')}</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 text-xs sm:text-sm"
                        onClick={() => handleDownload(doc)}
                        data-testid={`button-download-${doc.documentId}`}
                      >
                        <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                        <span className="hidden sm:inline">{t('common.download')}</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9"
                        onClick={() => handleDelete(doc)}
                        data-testid={`button-delete-${doc.documentId}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{t('documents.uploadDocument')}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {t('documents.dragAndDrop')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">{t('documents.documentType')}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {shipperDocumentCategories.map((cat) => (
                  <Button
                    key={cat}
                    variant={uploadForm.category === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSelectTemplate(cat)}
                    className="text-xs h-auto min-h-8 py-1.5 px-2 leading-tight"
                    data-testid={`button-template-${cat}`}
                  >
                    {shipperCategoryLabels[cat] ?? cat}
                  </Button>
                ))}
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
              className="hidden"
              data-testid="input-file-upload"
            />
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer transition-colors ${
                selectedFile ? 'border-green-500 bg-green-500/5' : 'border-border'
              }`}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-upload"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
                  <p className="text-sm font-medium mb-1">{t('documents.uploadingFile')}</p>
                  <p className="text-xs text-muted-foreground">{t('common.pleaseWait')}...</p>
                </>
              ) : selectedFile && uploadedFileUrl ? (
                <>
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium mb-1 text-green-600">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(Math.max(uploadedFileSize ?? 0, selectedFile.size))}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('documents.fileReady')}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setUploadedFileUrl("");
                      setUploadedFileSize(0);
                      setUploadForm(prev => ({ ...prev, fileName: "" }));
                    }}
                    data-testid="button-clear-file"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t('common.change')}
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">{t('documents.clickToUpload')}</p>
                  <p className="text-xs text-muted-foreground">{t('documents.supportedFormats')}: PDF, JPG, PNG</p>
                </>
              )}
              {uploadError && (
                <p className="text-xs text-red-500 mt-2">{uploadError.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="fileName" className="text-sm">{t('documents.documentName')}</Label>
                <Input
                  id="fileName"
                  placeholder={t('common.name') + '...'}
                  value={uploadForm.fileName}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, fileName: e.target.value }))}
                  data-testid="input-file-name"
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fileType" className="text-sm">{t('common.type')}</Label>
                <Select 
                  value={uploadForm.fileType} 
                  onValueChange={(v) => setUploadForm(prev => ({ ...prev, fileType: v as "pdf" | "image" }))}
                >
                  <SelectTrigger data-testid="select-file-type" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm">{t('documents.documentType')}</Label>
                <Select 
                  value={uploadForm.category} 
                  onValueChange={(v) => setUploadForm(prev => ({ ...prev, category: v as DocumentCategory }))}
                >
                  <SelectTrigger data-testid="select-category" className="text-sm">
                    <SelectValue placeholder={t('documents.selectDocumentType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {shipperDocumentCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{shipperCategoryLabels[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loadId" className="text-sm">{t('loads.title')} ({t('common.optional')})</Label>
                <Select 
                  value={uploadForm.loadId} 
                  onValueChange={(v) => setUploadForm(prev => ({ ...prev, loadId: v }))}
                >
                  <SelectTrigger data-testid="select-load-link" className="text-sm">
                    <SelectValue placeholder={t('common.select') + '...'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('common.none')}</SelectItem>
                    {activeLoads.map(load => (
                      <SelectItem key={load.loadId} value={load.loadId}>
                        {load.loadId} - {load.pickup} to {load.drop}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDate" className="text-sm">{t('documents.expiryDate')} ({t('common.optional')})</Label>
              <Input
                id="expiryDate"
                type="date"
                value={uploadForm.expiryDate}
                onChange={(e) => setUploadForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                data-testid="input-expiry-date"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags" className="text-sm">{t('documents.tags')}</Label>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  id="tags"
                  placeholder={t('documents.addTag') + '...'}
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
                  data-testid="input-tags"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">{t('common.notes')}</Label>
              <Textarea
                id="notes"
                placeholder={t('common.notes') + '...'}
                value={uploadForm.notes}
                onChange={(e) => setUploadForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                data-testid="input-notes"
                className="text-sm resize-none"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} className="w-full sm:w-auto">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleUpload}
              data-testid="button-confirm-upload"
              className="w-full sm:w-auto"
              disabled={uploadVaultMutation.isPending || isUploading}
            >
              {uploadVaultMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {t('documents.uploadDocument')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] mx-auto max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg truncate">
              {selectedDocument?.fileType === "pdf" ? <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" /> : <FileImage className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />}
              <span className="truncate">{selectedDocument?.fileName}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 p-2 border-b flex-shrink-0">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(25, z - 25))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs sm:text-sm min-w-10 sm:min-w-12 text-center">{zoom}%</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(200, z + 25))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRotation(r => (r + 90) % 360)}>
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs sm:text-sm px-1">1/1</span>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => selectedDocument && handleDownload(selectedDocument)}>
              <Download className="h-3.5 w-3.5 sm:mr-2" />
              <span className="hidden sm:inline">{t('common.download')}</span>
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
            <div className="flex items-center justify-center bg-muted rounded-lg min-h-[200px] max-h-[60vh] overflow-auto">
              <div 
                className="flex items-center justify-center p-4 w-full h-full"
                style={{ 
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease"
                }}
              >
                {selectedDocument && (() => {
                  const url = getDocumentUrl(selectedDocument.fileUrl);
                  const canShow = !!(url && isDisplayableUrl(selectedDocument.fileUrl));

                  if (selectedDocument.fileType === "pdf") {
                    if (canShow && url) {
                      return (
                        <iframe
                          src={url}
                          className="w-full h-[400px] sm:h-[500px] border-0 rounded-lg bg-white"
                          title={selectedDocument.fileName}
                        />
                      );
                    }
                    return (
                      <div className="bg-background border rounded-lg p-4 sm:p-8 shadow-lg min-w-[250px] sm:min-w-[300px] text-center space-y-3">
                        <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">PDF preview is unavailable. Open in a new tab or download.</p>
                        {url ? (
                          <Button size="sm" variant="outline" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
                            Open PDF
                          </Button>
                        ) : null}
                      </div>
                    );
                  }

                  if (!canShow || !url) {
                    return (
                      <div className="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-lg p-4 sm:p-8 min-w-[250px] sm:min-w-[300px] min-h-[150px] sm:min-h-[200px] flex items-center justify-center">
                        <div className="text-center">
                          <FileImage className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 text-blue-500" />
                          <p className="font-medium text-sm sm:text-base truncate">{selectedDocument.fileName}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-2">Could not resolve document URL</p>
                        </div>
                      </div>
                    );
                  }

                  if (isHeicFileName(selectedDocument.fileName)) {
                    return (
                      <div className="text-center space-y-4 py-6 px-4 max-w-md mx-auto">
                        <FileImage className="h-16 w-16 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          HEIC/HEIF preview is not supported in most browsers. Open the file in a new tab or download it.
                        </p>
                        <Button onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>Open in new tab</Button>
                      </div>
                    );
                  }

                  if (viewerImageFailed) {
                    return (
                      <div className="text-center space-y-4 py-6 px-4 max-w-md mx-auto">
                        <FileImage className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">This image could not be displayed in the browser.</p>
                        <Button onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>Open in new tab</Button>
                      </div>
                    );
                  }

                  return (
                    <img
                      src={url}
                      alt={selectedDocument.fileName || "Document"}
                      className="max-w-full max-h-[300px] sm:max-h-[500px] rounded-lg object-contain shadow-lg"
                      onError={() => setViewerImageFailed(true)}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={detailPanelOpen} onOpenChange={setDetailPanelOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6" side="right">
          {selectedDocument && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
                  {selectedDocument.fileType === "pdf" ? <FileText className="h-4 w-4 sm:h-5 sm:w-5" /> : <FileImage className="h-4 w-4 sm:h-5 sm:w-5" />}
                  <span className="truncate">{t('documents.documentDetails')}</span>
                </SheetTitle>
                <SheetDescription className="text-xs sm:text-sm">
                  {t('documents.viewDocument')}
                </SheetDescription>
              </SheetHeader>

              <Tabs defaultValue="overview" className="mt-4 sm:mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm">
                    <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t('common.overview')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="preview" data-testid="tab-preview" className="text-xs sm:text-sm">
                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t('common.preview')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" data-testid="tab-history" className="text-xs sm:text-sm">
                    <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t('common.history')}</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('documents.documentName')}</span>
                        <span className="font-medium text-right max-w-48 truncate">{selectedDocument.fileName}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('common.type')}</span>
                        <Badge variant="secondary">{shipperCategoryLabels[selectedDocument.category] || documentCategoryLabels[selectedDocument.category]}</Badge>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('documents.fileSize')}</span>
                        <span>{formatFileSize(selectedDocument.fileSize)}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('documents.version')}</span>
                        <span>v{selectedDocument.version}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('common.status')}</span>
                        {getStatusBadge(selectedDocument.status)}
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('documents.verified')}</span>
                        {selectedDocument.isVerified ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate">{t('documents.verified')}</Badge>
                        ) : (
                          <Badge variant="outline">{t('common.pending')}</Badge>
                        )}
                      </div>
                      {selectedDocument.loadId && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('loads.title')}</span>
                            <span className="font-medium">{selectedDocument.loadId}</span>
                          </div>
                        </>
                      )}
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('documents.uploadedBy')}</span>
                        <span>{selectedDocument.uploadedBy}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('documents.uploadedOn')}</span>
                        <span>{formatDate(selectedDocument.uploadedDate)}</span>
                      </div>
                      {selectedDocument.expiryDate && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('documents.expiryDate')}</span>
                            <span className={selectedDocument.status !== "active" ? "text-destructive" : ""}>
                              {formatDate(selectedDocument.expiryDate)}
                            </span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {selectedDocument.tags.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t('documents.tags')}</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedDocument.tags.map(tag => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDocument.notes && (
                    <div className="space-y-2">
                      <Label>{t('common.notes')}</Label>
                      <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                        {selectedDocument.notes}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4">
                    <Button onClick={() => handleView(selectedDocument)} data-testid="button-panel-view" className="text-sm">
                      <Eye className="h-4 w-4 mr-2" />
                      {t('common.view')}
                    </Button>
                    <Button variant="outline" onClick={() => handleDownload(selectedDocument)} data-testid="button-panel-download" className="text-sm">
                      <Download className="h-4 w-4 mr-2" />
                      {t('common.download')}
                    </Button>
                    {!selectedDocument.isVerified && (
                      <Button 
                        variant="outline" 
                        className="col-span-1 sm:col-span-2 text-sm"
                        onClick={() => handleVerify(selectedDocument)}
                        data-testid="button-verify"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('documents.markVerified')}
                      </Button>
                    )}
                    <Button 
                      variant="destructive" 
                      className="col-span-1 sm:col-span-2 text-sm"
                      onClick={() => handleDelete(selectedDocument)}
                      data-testid="button-panel-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('documents.deleteDocument')}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                  <div className="bg-muted rounded-lg min-h-[300px] flex flex-col items-center justify-center overflow-hidden">
                    {selectedDocument.fileType === "pdf" ? (
                      (() => {
                        const baseUrl = getDocumentUrl(selectedDocument.fileUrl);
                        if (baseUrl && isDisplayableUrl(selectedDocument.fileUrl)) {
                          const url = `${baseUrl}?filename=${encodeURIComponent(selectedDocument.fileName)}`;
                          return (
                            <iframe
                              src={url}
                              className="w-full h-[400px] border-0"
                              title={selectedDocument.fileName}
                            />
                          );
                        }
                        return (
                        <div className="text-center p-8">
                          <FileText className="h-16 w-16 mx-auto mb-4 text-red-500" />
                          <p className="font-medium">{selectedDocument.fileName}</p>
                          <p className="text-sm text-muted-foreground mb-4">{formatFileSize(selectedDocument.fileSize)}</p>
                          <Button onClick={() => handleView(selectedDocument)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t('documents.viewDocument')}
                          </Button>
                        </div>
                        );
                      })()
                    ) : (
                      (() => {
                        const baseUrl = getDocumentUrl(selectedDocument.fileUrl);
                        if (baseUrl && isDisplayableUrl(selectedDocument.fileUrl)) {
                          if (isHeicFileName(selectedDocument.fileName)) {
                            return (
                              <div className="text-center p-8 space-y-4">
                                <FileImage className="h-16 w-16 mx-auto text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  HEIC/HEIF cannot be previewed in most browsers. Open in a new tab.
                                </p>
                                <Button onClick={() => window.open(baseUrl, "_blank", "noopener,noreferrer")}>
                                  {t('documents.openInNewTab', { defaultValue: 'Open in New Tab' })}
                                </Button>
                              </div>
                            );
                          }
                          const url = `${baseUrl}?filename=${encodeURIComponent(selectedDocument.fileName)}`;
                          return (
                            <div className="w-full p-4">
                              <img
                                src={url}
                                alt={selectedDocument.fileName}
                                className="max-w-full max-h-[400px] mx-auto rounded-lg object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const fallback = target.parentElement?.querySelector(".fallback-view") as HTMLElement;
                                  if (fallback) fallback.classList.remove("hidden");
                                }}
                              />
                              <div className="fallback-view hidden text-center py-8">
                                <FileImage className="h-16 w-16 mx-auto mb-4 text-blue-500" />
                                <p className="font-medium">{selectedDocument.fileName}</p>
                                <p className="text-sm text-muted-foreground mb-4">Click below to view this document</p>
                                <Button onClick={() => handleView(selectedDocument)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  {t('documents.openInNewTab', { defaultValue: 'Open in New Tab' })}
                                </Button>
                              </div>
                            </div>
                          );
                        }
                        return (
                        <div className="text-center p-8">
                          <FileImage className="h-16 w-16 mx-auto mb-4 text-blue-500" />
                          <p className="font-medium">{selectedDocument.fileName}</p>
                          <p className="text-sm text-muted-foreground mb-4">{formatFileSize(selectedDocument.fileSize)}</p>
                          <Button onClick={() => handleView(selectedDocument)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t('documents.viewDocument')}
                          </Button>
                        </div>
                        );
                      })()
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t('documents.version')} {selectedDocument.version} ({t('common.current')})</p>
                        <p className="text-xs text-muted-foreground">
                          {t('documents.uploadedBy')} {selectedDocument.uploadedBy} {t('common.on')} {formatDate(selectedDocument.uploadedDate)}
                        </p>
                      </div>
                    </div>
                    
                    {selectedDocument.previousVersions?.map(version => (
                      <div key={version.version} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <History className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{t('documents.version')} {version.version}</p>
                          <p className="text-xs text-muted-foreground">
                            {version.fileName} - {formatDate(version.uploadedDate)}
                          </p>
                        </div>
                      </div>
                    ))}

                    {!selectedDocument.previousVersions?.length && selectedDocument.version === 1 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t('documents.originalVersion')}
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Expiring Documents Dialog */}
      <Dialog open={expiringViewOpen} onOpenChange={setExpiringViewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 flex-shrink-0" />
              <span className="truncate">{t('documents.expiringDocuments')}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Auto-detected documents with expiry dates that need your attention
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Expired Documents Section */}
              {expiredDocs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <h3 className="font-semibold text-red-600 dark:text-red-400">
                      Expired Documents ({expiredDocs.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {expiredDocs.map((doc) => {
                      const rawDays = doc.expiryDate ? getDaysUntilExpiry(doc.expiryDate) : null;
                      const daysAgo = rawDays !== null ? Math.abs(rawDays) : 0;
                      const folder = documentFolders[doc.category];
                      const IconComponent = folder?.icon || FileText;
                      
                      return (
                        <Card key={doc.documentId} className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${folder?.bgColor || 'bg-gray-100'} flex-shrink-0`}>
                                <IconComponent className={`h-5 w-5 ${folder?.color || 'text-gray-600'}`} />
                              </div>
                              <div className="flex-1 min-w-0 w-full sm:w-auto">
                                <p className="font-medium text-sm truncate">{doc.fileName}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                  <span>{shipperCategoryLabels[doc.category] || doc.category}</span>
                                  {doc.loadId && (
                                    <>
                                      <span>•</span>
                                      <span>{doc.loadId}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-left sm:text-right">
                                  <Badge variant="destructive" className="mb-1 text-xs">
                                    {t('documents.expired')}
                                  </Badge>
                                  <p className="text-xs text-red-600 dark:text-red-400">
                                    <Calendar className="h-3 w-3 inline mr-1" />
                                    {doc.expiryDate && formatDate(doc.expiryDate)}
                                  </p>
                                  <p className="text-xs text-red-500 font-medium">
                                    {daysAgo} day{daysAgo !== 1 ? 's' : ''} ago
                                  </p>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                                  onClick={() => {
                                    setSelectedDocument(doc);
                                    setDetailPanelOpen(true);
                                    setExpiringViewOpen(false);
                                  }}
                                  data-testid={`button-view-expired-${doc.documentId}`}
                                >
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expiring Soon Documents Section */}
              {expiringDocs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <h3 className="font-semibold text-amber-600 dark:text-amber-400">
                      Expiring Soon ({expiringDocs.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {expiringDocs
                      .sort((a, b) => {
                        const aDays = a.expiryDate ? (getDaysUntilExpiry(a.expiryDate) ?? Infinity) : Infinity;
                        const bDays = b.expiryDate ? (getDaysUntilExpiry(b.expiryDate) ?? Infinity) : Infinity;
                        return aDays - bDays;
                      })
                      .map((doc) => {
                        const rawDaysLeft = doc.expiryDate ? getDaysUntilExpiry(doc.expiryDate) : null;
                        const daysLeft = rawDaysLeft ?? 0;
                        const folder = documentFolders[doc.category];
                        const IconComponent = folder?.icon || FileText;
                        const isUrgent = daysLeft <= 7;
                        const isWarning = daysLeft <= 14;
                        
                        return (
                          <Card 
                            key={doc.documentId} 
                            className={
                              isUrgent 
                                ? "border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/10"
                                : isWarning
                                  ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                                  : "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10"
                            }
                          >
                            <CardContent className="p-3 sm:p-4">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${folder?.bgColor || 'bg-gray-100'} flex-shrink-0`}>
                                  <IconComponent className={`h-5 w-5 ${folder?.color || 'text-gray-600'}`} />
                                </div>
                                <div className="flex-1 min-w-0 w-full sm:w-auto">
                                  <p className="font-medium text-sm truncate">{doc.fileName}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                    <span>{shipperCategoryLabels[doc.category] || doc.category}</span>
                                    {doc.loadId && (
                                      <>
                                        <span>•</span>
                                        <span>{doc.loadId}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                  <div className="text-left sm:text-right">
                                    <Badge 
                                      variant="outline" 
                                      className={
                                        isUrgent 
                                          ? "border-orange-400 text-orange-600 dark:text-orange-400 mb-1 text-xs"
                                          : "border-amber-400 text-amber-600 dark:text-amber-400 mb-1 text-xs"
                                      }
                                    >
                                      {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                                    </Badge>
                                    <p className="text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3 inline mr-1" />
                                      {doc.expiryDate && formatDate(doc.expiryDate)}
                                    </p>
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                                    onClick={() => {
                                      setSelectedDocument(doc);
                                      setDetailPanelOpen(true);
                                      setExpiringViewOpen(false);
                                    }}
                                    data-testid={`button-view-expiring-${doc.documentId}`}
                                  >
                                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* No expiring documents */}
              {expiredDocs.length === 0 && expiringDocs.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="font-medium text-green-600 dark:text-green-400">All documents are up to date!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No documents require immediate attention
                  </p>
                </div>
              )}

              {/* Auto-Detection Info */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Auto-Expiry Detection</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        The system automatically monitors document expiry dates and creates alerts when documents are within 30 days of expiration. 
                        Documents with past expiry dates are marked as expired.
                      </p>
                      <div className="flex gap-4 mt-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                          <span>Expired</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                          <span>≤7 days</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                          <span>≤14 days</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                          <span>≤30 days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setExpiringViewOpen(false)} className="w-full sm:w-auto">
              {t('common.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
