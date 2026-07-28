import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Truck, Search, FileText, ChevronLeft, Eye, ExternalLink,
  ShieldCheck, ShieldX, ShieldAlert, Clock, CreditCard,
  CheckCircle, XCircle, User, Building2, MapPin, Phone,
  ChevronDown, Info, Image, FileType, Ruler, PauseCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

// Document Requirements for Solo Operators
const SOLO_DOCUMENT_REQUIREMENTS = [
  { type: "aadhaar_card", name: "Aadhaar Card", formats: "JPG / PNG / PDF" },
  { type: "driver_license", name: "Driver License", formats: "JPG / PNG / PDF" },
  { type: "pan_card", name: "PAN Card", formats: "JPG / PNG / PDF" },
  { type: "permit_document", name: "Permit Document (National/Domestic)", formats: "JPG / PNG / PDF" },
  { type: "rc", name: "RC (Registration Certificate)", formats: "JPG / PNG / PDF" },
  { type: "insurance_certificate", name: "Insurance Certificate", formats: "JPG / PNG / PDF" },
  { type: "fitness_certificate", name: "Fitness Certificate", formats: "PDF / JPG" },
];

// Document Requirements for Fleet/Company Carriers
const ENTERPRISE_DOCUMENT_REQUIREMENTS = [
  { type: "incorporation_certificate", name: "Incorporation Certificate", formats: "PDF / JPG" },
  { type: "trade_license", name: "Trade License / Business Registration", formats: "PDF / JPG" },
  { type: "address_proof", name: "Business Address Proof", formats: "PDF / JPG" },
  { type: "pan_card", name: "PAN Card", formats: "JPG / PNG / PDF" },
  { type: "gstin_certificate", name: "GSTIN Certificate", formats: "PDF / JPG" },
  { type: "tan_certificate", name: "TAN Certificate", formats: "PDF / JPG" },
];

// Complete document type labels for all supported types
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  rc: "RC (Registration Certificate)",
  insurance: "Vehicle Insurance",
  fitness: "Fitness Certificate",
  permit: "National / State Permit",
  puc: "PUC Certificate",
  road_tax: "Road Tax / Challan Clearance",
  license: "Driving License",
  pan: "PAN Card",
  gst: "GST Certificate",
  aadhar: "Aadhaar Card",
  aadhaar: "Aadhaar Card",
  fleet_proof: "Fleet Ownership Proof",
  aadhaar_card: "Aadhaar Card",
  driver_license: "Driver License",
  permit_document: "Permit Document",
  insurance_certificate: "Insurance Certificate",
  fitness_certificate: "Fitness Certificate",
  incorporation_certificate: "Incorporation Certificate",
  trade_license: "Trade License",
  address_proof: "Business Address Proof",
  address_proof_rent_agreement: "Address Proof (Rent Agreement)",
  address_proof_electricity_bill: "Address Proof (Electricity Bill)",
  address_proof_office_photo: "Address Proof (Office Photo with Board)",
  pan_card: "PAN Card",
  gstin_certificate: "GSTIN Certificate",
  tan_certificate: "TAN Certificate",
  tds_declaration: "TDS Declaration",
  cin: "CIN Certificate",
  selfie: "Selfie",
  msme_udyam: "MSME / Udyam Certificate",
  msme: "MSME / Udyam Certificate",
  udyam: "MSME / Udyam Certificate",
  void_cheque: "Void Cheque / Cancelled Cheque",
};

// Helper to get document display name
const getDocumentDisplayName = (type: string) => {
  return DOCUMENT_TYPE_LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

// Document priority order for display (lower number = higher priority)
const DOCUMENT_PRIORITY: Record<string, number> = {
  // Solo operator documents - identity first
  aadhaar: 1,
  aadhar: 1,
  aadhaar_card: 1,
  license: 2,
  driver_license: 2,
  permit: 3,
  permit_document: 3,
  rc: 4,
  insurance: 5,
  insurance_certificate: 5,
  fitness: 6,
  fitness_certificate: 6,
  // Fleet/Company documents
  incorporation: 10,
  incorporation_certificate: 10,
  trade_license: 11,
  address_proof: 12,
  address_proof_rent_agreement: 12,
  address_proof_electricity_bill: 12,
  address_proof_office_photo: 12,
  pan: 13,
  pan_card: 13,
  gstin: 14,
  gstin_certificate: 14,
  gst: 14,
  tan: 15,
  tan_certificate: 15,
  tds_declaration: 16,
  fleet_proof: 17,
  other: 99,
};

// Sort documents by priority
const sortDocumentsByPriority = (docs: VerificationDocument[]) => {
  return [...docs].sort((a, b) => {
    const priorityA = DOCUMENT_PRIORITY[a.documentType] ?? 50;
    const priorityB = DOCUMENT_PRIORITY[b.documentType] ?? 50;
    return priorityA - priorityB;
  });
};

interface CarrierVerification {
  id: string;
  carrierId: string;
  carrierType: "solo" | "enterprise";
  fleetSize: number;
  status: "draft" | "pending" | "under_review" | "approved" | "rejected" | "on_hold";
  notes?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  submittedAt?: string;
  carrier?: {
    id: string;
    username: string;
    companyName: string;
    email: string;
    phone?: string;
    serviceZones?: string[];
  };
  documents?: VerificationDocument[];
  aadhaarNumber?: string;
  driverLicenseNumber?: string;
  permitType?: "national" | "domestic";
  uniqueRegistrationNumber?: string;
  chassisNumber?: string;
  licensePlateNumber?: string;
  incorporationType?: "pvt_ltd" | "llp" | "proprietorship" | "partnership";
  businessType?: string;
  cinNumber?: string;
  partnerName?: string;
  businessRegistrationNumber?: string;
  businessAddress?: string;
  businessLocality?: string;
  panNumber?: string;
  gstinNumber?: string;
  tanNumber?: string;
  // Address proof
  addressProofType?: string;
  // Bank details
  bankName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankAccountHolderName?: string;
}

interface VerificationDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  status?: "pending" | "approved" | "rejected";
}

/** Tries to show URL as image; on load error shows fallback (for generic names like "Uploaded Document"). */
function UnknownTypePreview({
  previewDisplayUrl,
  fileName,
  fallback,
}: {
  previewDisplayUrl: string;
  fileName: string;
  fallback: ReactNode;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) return <>{fallback}</>;
  return (
    <div className="flex justify-center">
      <img
        src={previewDisplayUrl}
        alt={fileName}
        className="max-h-[400px] w-auto max-w-full object-contain rounded border bg-white"
        onError={() => setImgFailed(true)}
      />
    </div>
  );
}

export default function CarrierVerificationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedVerification, setSelectedVerification] = useState<CarrierVerification | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [holdNotes, setHoldNotes] = useState("");
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<VerificationDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDisplayUrl, setPreviewDisplayUrl] = useState<string | null>(null);
  const [previewUrlLoading, setPreviewUrlLoading] = useState(false);
  const [previewUrlError, setPreviewUrlError] = useState<string | null>(null);

  // Fetch presigned URL for inline preview when document preview dialog opens
  useEffect(() => {
    if (!previewOpen || !previewDoc?.fileUrl?.trim()) {
      setPreviewDisplayUrl(null);
      setPreviewUrlLoading(false);
      setPreviewUrlError(null);
      return;
    }
    const rawUrl = previewDoc.fileUrl.trim();
    const pathForApi = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? (() => {
          try {
            return new URL(rawUrl).pathname;
          } catch {
            return rawUrl;
          }
        })()
      : rawUrl.startsWith("/")
      ? rawUrl
      : `/${rawUrl}`;

    setPreviewUrlLoading(true);
    setPreviewUrlError(null);
    setPreviewDisplayUrl(null);
    fetch(`/api/documents/presigned-url?path=${encodeURIComponent(pathForApi)}`, { credentials: "include" })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (data?.url) {
          setPreviewDisplayUrl(data.url);
          setPreviewUrlError(null);
        } else {
          setPreviewUrlError("Could not load preview.");
        }
      })
      .catch(() => setPreviewUrlError("Could not load preview."))
      .finally(() => setPreviewUrlLoading(false));
  }, [previewOpen, previewDoc?.id, previewDoc?.fileUrl]);

  const { data: verifications = [], isLoading, refetch } = useQuery<CarrierVerification[]>({
    queryKey: ["/api/admin/verifications"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/verifications/${id}/approve`, {});
    },
    onSuccess: () => {
      // Invalidate all related queries for consistent data across portal
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] }); // Update dashboard
      toast({
        title: "Carrier Verified",
        description: "The carrier has been verified and added to the directory.",
      });
      setDetailsOpen(false);
      setSelectedVerification(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to approve verification",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/admin/verifications/${id}/reject`, { reason });
    },
    onSuccess: () => {
      // Invalidate all related queries for consistent data across portal
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] }); // Update dashboard
      toast({
        title: "Verification Rejected",
        description: "The carrier verification has been rejected.",
      });
      setRejectDialogOpen(false);
      setDetailsOpen(false);
      setSelectedVerification(null);
      setRejectReason("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to reject verification",
      });
    },
  });

  const holdMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return apiRequest("POST", `/api/admin/verifications/${id}/hold`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      toast({
        title: "Verification On Hold",
        description: "The carrier verification has been put on hold.",
      });
      setHoldDialogOpen(false);
      setDetailsOpen(false);
      setSelectedVerification(null);
      setHoldNotes("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to put verification on hold",
      });
    },
  });

  // Individual document verification mutation
  const documentVerifyMutation = useMutation({
    mutationFn: async ({ docId, status, rejectionReason }: { docId: string; status: "approved" | "rejected"; rejectionReason?: string }) => {
      return apiRequest("PATCH", `/api/admin/verification-documents/${docId}`, { status, rejectionReason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      toast({
        title: variables.status === "approved" ? "Document Approved" : "Document Rejected",
        description: variables.status === "approved" 
          ? "The document has been verified successfully." 
          : "The carrier has been notified of the rejection.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update document status",
      });
    },
  });

  // State for document rejection dialog
  const [docRejectDialogOpen, setDocRejectDialogOpen] = useState(false);
  const [docRejectReason, setDocRejectReason] = useState("");
  const [selectedDocForReject, setSelectedDocForReject] = useState<VerificationDocument | null>(null);

  const handleDocApprove = (doc: VerificationDocument) => {
    documentVerifyMutation.mutate({ docId: doc.id, status: "approved" });
  };

  const handleDocReject = () => {
    if (selectedDocForReject && docRejectReason.trim()) {
      documentVerifyMutation.mutate({ 
        docId: selectedDocForReject.id, 
        status: "rejected", 
        rejectionReason: docRejectReason 
      });
      setDocRejectDialogOpen(false);
      setDocRejectReason("");
      setSelectedDocForReject(null);
    }
  };

  // Sort function: latest (most recent) first
  const sortByLatestFirst = (list: CarrierVerification[]) => {
    return [...list].sort((a, b) => {
      const dateA = new Date(a.submittedAt || a.createdAt).getTime();
      const dateB = new Date(b.submittedAt || b.createdAt).getTime();
      return dateB - dateA; // Descending order (latest first)
    });
  };

  const pendingVerifications = useMemo(() => {
    const pending = verifications.filter(v => v.status === "pending" || v.status === "under_review");
    return sortByLatestFirst(pending);
  }, [verifications]);

  // Categorized pending verifications
  const pendingSoloVerifications = useMemo(() => {
    return pendingVerifications.filter(v => v.carrierType === "solo" || (!v.carrierType && v.fleetSize === 1));
  }, [pendingVerifications]);

  const pendingFleetVerifications = useMemo(() => {
    return pendingVerifications.filter(v => v.carrierType === "enterprise" || (!v.carrierType && v.fleetSize > 1));
  }, [pendingVerifications]);

  const draftVerifications = useMemo(() => {
    const drafts = verifications.filter(v => v.status === "draft");
    return sortByLatestFirst(drafts);
  }, [verifications]);

  const rejectedVerifications = useMemo(() => {
    const rejected = verifications.filter(v => v.status === "rejected" || v.status === "on_hold");
    return sortByLatestFirst(rejected);
  }, [verifications]);

  // Search filter function
  const filterBySearch = (list: CarrierVerification[]) => {
    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(v => 
      v.carrier?.companyName?.toLowerCase().includes(query) ||
      v.carrier?.email?.toLowerCase().includes(query)
    );
  };

  const filteredVerifications = useMemo(() => {
    const list = activeTab === "pending" ? pendingVerifications : 
                 activeTab === "draft" ? draftVerifications : rejectedVerifications;
    return filterBySearch(list);
  }, [activeTab, pendingVerifications, draftVerifications, rejectedVerifications, searchQuery]);

  // Filtered categorized pending lists for display
  const filteredPendingSolo = useMemo(() => filterBySearch(pendingSoloVerifications), [pendingSoloVerifications, searchQuery]);
  const filteredPendingFleet = useMemo(() => filterBySearch(pendingFleetVerifications), [pendingFleetVerifications, searchQuery]);

  const handleApprove = (verification: CarrierVerification) => {
    approveMutation.mutate(verification.id);
  };

  const handleReject = () => {
    if (selectedVerification && rejectReason.trim()) {
      rejectMutation.mutate({ id: selectedVerification.id, reason: rejectReason });
    }
  };

  const handleHold = () => {
    if (selectedVerification && holdNotes.trim()) {
      holdMutation.mutate({ id: selectedVerification.id, notes: holdNotes });
    }
  };

  const openDetails = (verification: CarrierVerification) => {
    setSelectedVerification(verification);
    setDetailsOpen(true);
  };

  const getCarrierTypeDisplay = (verification: CarrierVerification) => {
    // Prioritize explicit carrierType from database over fleet size
    if (verification.carrierType === "solo") {
      return { label: "Solo Owner-Operator", icon: User, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    }
    // Enterprise/fleet carriers show as Fleet regardless of fleet size
    if (verification.carrierType === "enterprise") {
      return { label: `Fleet (${verification.fleetSize} truck${verification.fleetSize !== 1 ? 's' : ''})`, icon: Building2, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" };
    }
    // Fallback for legacy data without explicit carrierType
    if (verification.fleetSize === 1) {
      return { label: "Solo Owner-Operator", icon: User, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    }
    return { label: `Fleet (${verification.fleetSize} trucks)`, icon: Building2, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" };
  };

  const renderVerificationCard = (verification: CarrierVerification) => {
    const carrierType = getCarrierTypeDisplay(verification);
    const CarrierIcon = carrierType.icon;
    const documents = verification.documents || [];

    return (
      <Card key={verification.id} className="hover-elevate" data-testid={`verification-card-${verification.id}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-start sm:items-center gap-3 flex-wrap">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate" data-testid={`text-carrier-name-${verification.id}`}>
                    {verification.carrier?.companyName || "Unknown Carrier"}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">{verification.carrier?.email}</p>
                </div>
                <Badge className={`${carrierType.color} no-default-hover-elevate no-default-active-elevate flex-shrink-0`}>
                  <CarrierIcon className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">{carrierType.label}</span>
                  <span className="sm:hidden">{verification.carrierType === "solo" ? "Solo" : `Fleet (${verification.fleetSize})`}</span>
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{verification.carrier?.phone || "Not provided"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{verification.carrier?.serviceZones?.slice(0, 2).join(", ") || "Not specified"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Truck className="h-4 w-4 flex-shrink-0" />
                  <span>{verification.fleetSize} truck(s)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Applied {format(new Date(verification.submittedAt || verification.createdAt), "MMM d, yyyy")}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {documents.length} Documents
                </Badge>
                {verification.status === "rejected" && verification.rejectionReason && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    <span className="hidden sm:inline">Rejected: {verification.rejectionReason}</span>
                    <span className="sm:hidden">Rejected</span>
                  </Badge>
                )}
                {verification.status === "on_hold" && verification.notes && (
                  <Badge variant="secondary" className="gap-1">
                    <PauseCircle className="h-3 w-3" />
                    <span className="hidden sm:inline">On Hold: {verification.notes}</span>
                    <span className="sm:hidden">On Hold</span>
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => openDetails(verification)}
                data-testid={`button-view-details-${verification.id}`}
                className="w-full sm:w-auto"
              >
                <Eye className="h-4 w-4 mr-2" />
                Review
              </Button>
              {verification.status === "pending" && (
                <>
                  <Button 
                    onClick={() => handleApprove(verification)}
                    disabled={approveMutation.isPending}
                    data-testid={`button-quick-approve-${verification.id}`}
                    className="w-full sm:w-auto"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      setSelectedVerification(verification);
                      setRejectDialogOpen(true);
                    }}
                    data-testid={`button-quick-reject-${verification.id}`}
                    className="w-full sm:w-auto"
                  >
                    <XCircle className="h-4 w-4 mr-2 sm:mr-0" />
                    <span className="sm:hidden">Reject</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/admin")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Carrier Verification</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Review and verify carrier applications with documents</p>
          </div>
        </div>
        <Button 
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={async () => {
            try {
              const res = await fetch("/api/admin/seed-pending-verifications", { method: "POST", credentials: "include" });
              const data = await res.json();
              if (res.ok) {
                toast({
                  title: "Pending Verifications Seeded",
                  description: `Created ${data.carriers?.length || 0} pending carrier verification requests.`,
                });
                refetch();
              } else {
                toast({
                  title: "Seed Failed",
                  description: data.error || "Failed to seed pending verifications",
                  variant: "destructive",
                });
              }
            } catch (e) {
              console.error("Seed error:", e);
              toast({
                title: "Error",
                description: "Failed to seed pending verifications.",
                variant: "destructive",
              });
            }
          }}
          data-testid="button-seed-pending"
        >
          <ShieldAlert className="h-4 w-4 mr-2" />
          Seed Pending
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold" data-testid="stat-pending">{pendingVerifications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <ShieldX className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold" data-testid="stat-rejected">{rejectedVerifications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Verified</p>
                <p className="text-2xl font-bold" data-testid="stat-verified-today">
                  {verifications.filter(v => v.status === "approved").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Requirements Reference */}
      <Collapsible open={requirementsOpen} onOpenChange={setRequirementsOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm font-medium">Document Requirements Reference</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${requirementsOpen ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">Solo Operator Documents</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Document Type</th>
                        <th className="text-left py-2 px-3 font-medium">
                          <div className="flex items-center gap-1">
                            <FileType className="h-3 w-3" /> Formats
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {SOLO_DOCUMENT_REQUIREMENTS.map((doc) => (
                        <tr key={doc.type} className="border-b last:border-0">
                          <td className="py-2 px-3 font-medium">{doc.name}</td>
                          <td className="py-2 px-3">
                            <Badge variant="secondary" className="text-xs">{doc.formats}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">Fleet/Company Documents</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Document Type</th>
                        <th className="text-left py-2 px-3 font-medium">
                          <div className="flex items-center gap-1">
                            <FileType className="h-3 w-3" /> Formats
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ENTERPRISE_DOCUMENT_REQUIREMENTS.map((doc) => (
                        <tr key={doc.type} className="border-b last:border-0">
                          <td className="py-2 px-3 font-medium">{doc.name}</td>
                          <td className="py-2 px-3">
                            <Badge variant="secondary" className="text-xs">{doc.formats}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-full justify-between min-w-max">
            <TabsTrigger value="pending" data-testid="tab-pending" className="gap-2 whitespace-nowrap flex-1">
              <ShieldAlert className="h-4 w-4" />
              <span>Pending ({pendingVerifications.length})</span>
            </TabsTrigger>
            <TabsTrigger value="draft" data-testid="tab-draft" className="gap-2 whitespace-nowrap flex-1">
              <Clock className="h-4 w-4" />
              <span>Draft ({draftVerifications.length})</span>
            </TabsTrigger>
            <TabsTrigger value="rejected" data-testid="tab-rejected" className="gap-2 whitespace-nowrap flex-1">
              <ShieldX className="h-4 w-4" />
              <span>Rejected ({rejectedVerifications.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="mt-4 space-y-6">
          {filteredVerifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShieldCheck className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">All Caught Up!</h3>
                <p className="text-muted-foreground">No pending verification requests at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Solo Owner-Operator Section */}
              {filteredPendingSolo.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <User className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">Solo Owner-Operator</h3>
                    <Badge variant="secondary" className="ml-auto">{filteredPendingSolo.length}</Badge>
                  </div>
                  <div className="space-y-4">
                    {filteredPendingSolo.map(verification => renderVerificationCard(verification))}
                  </div>
                </div>
              )}

              {/* Fleet/Enterprise Section */}
              {filteredPendingFleet.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Building2 className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold">Fleet Carriers</h3>
                    <Badge variant="secondary" className="ml-auto">{filteredPendingFleet.length}</Badge>
                  </div>
                  <div className="space-y-4">
                    {filteredPendingFleet.map(verification => renderVerificationCard(verification))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="draft" className="mt-4 space-y-4">
          {filteredVerifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Draft Applications</h3>
                <p className="text-muted-foreground">No carriers have started their onboarding yet.</p>
              </CardContent>
            </Card>
          ) : (
            filteredVerifications.map(verification => renderVerificationCard(verification))
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-4 space-y-4">
          {filteredVerifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Rejected Applications</h3>
                <p className="text-muted-foreground">No carriers have been rejected.</p>
              </CardContent>
            </Card>
          ) : (
            filteredVerifications.map(verification => renderVerificationCard(verification))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col p-3 sm:p-6">
          <DialogHeader className="flex-shrink-0 pb-2 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Truck className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">{selectedVerification?.carrier?.companyName || "Carrier Details"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Review carrier details and uploaded documents
            </DialogDescription>
          </DialogHeader>
          
          {selectedVerification && (
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 min-h-0">
              <div className="space-y-3 sm:space-y-6 pb-2 sm:pb-4">
                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm">Carrier Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm px-3 sm:px-6 pb-3 sm:pb-6">
                    <div>
                      <Label className="text-muted-foreground text-xs">{selectedVerification.carrierType === "solo" ? "Driver Name" : "Company Name"}</Label>
                      <p className="font-medium break-words">{selectedVerification.carrier?.companyName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Type</Label>
                      <p className="font-medium">
                        {selectedVerification.carrierType === "solo" ? "Solo Owner-Operator" : `Fleet (${selectedVerification.fleetSize} trucks)`}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Email</Label>
                      <p className="font-medium break-all">{selectedVerification.carrier?.email || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Phone</Label>
                      <p className="font-medium">{selectedVerification.carrier?.phone || "Not provided"}</p>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs">Service Zones</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedVerification.carrier?.serviceZones?.map((zone, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{zone}</Badge>
                        )) || <span className="text-muted-foreground text-xs">Not specified</span>}
                      </div>
                    </div>
                    {selectedVerification.notes && selectedVerification.status !== "on_hold" && (
                      <div className="col-span-1 sm:col-span-2">
                        <Label className="text-muted-foreground text-xs">Notes from Carrier</Label>
                        <p className="font-medium break-words">{selectedVerification.notes}</p>
                      </div>
                    )}
                    {selectedVerification.status === "on_hold" && selectedVerification.notes && (
                      <div className="col-span-1 sm:col-span-2">
                        <Label className="text-muted-foreground flex items-center gap-2 text-xs">
                          <PauseCircle className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
                          Admin Notes (On Hold)
                        </Label>
                        <p className="font-medium text-orange-600 dark:text-orange-400 break-words">{selectedVerification.notes}</p>
                      </div>
                    )}
                    {selectedVerification.status === "rejected" && selectedVerification.rejectionReason && (
                      <div className="col-span-1 sm:col-span-2">
                        <Label className="text-muted-foreground flex items-center gap-2 text-xs">
                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                          Rejection Reason
                        </Label>
                        <p className="font-medium text-destructive break-words">{selectedVerification.rejectionReason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Solo Operator Details */}
                {selectedVerification.carrierType === "solo" && (
                  <Card>
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                        <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                        Solo Operator Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm px-3 sm:px-6 pb-3 sm:pb-6">
                      <div>
                        <Label className="text-muted-foreground text-xs">Aadhaar Number</Label>
                        <p className="font-medium break-all">{selectedVerification.aadhaarNumber || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Driver License Number</Label>
                        <p className="font-medium break-all">{selectedVerification.driverLicenseNumber || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">PAN Number</Label>
                        <p className="font-medium break-all">{selectedVerification.panNumber || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Permit Type</Label>
                        <p className="font-medium">
                          {selectedVerification.permitType === "national" ? "National Permit" : 
                           selectedVerification.permitType === "domestic" ? "State Permit" : "Not provided"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">License Plate Number</Label>
                        <p className="font-medium break-all">{selectedVerification.licensePlateNumber || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Chassis Number</Label>
                        <p className="font-medium break-all">{selectedVerification.chassisNumber || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Unique Registration Number</Label>
                        <p className="font-medium break-all">{selectedVerification.uniqueRegistrationNumber || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Locality / Area</Label>
                        <p className="font-medium break-words">{selectedVerification.businessLocality || "Not provided"}</p>
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <Label className="text-muted-foreground text-xs">Business Address</Label>
                        <p className="font-medium break-words">{selectedVerification.businessAddress || "Not provided"}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Fleet/Company Details */}
                {selectedVerification.carrierType === "enterprise" && (
                  <Card>
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                        <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                        Fleet/Company Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm px-3 sm:px-6 pb-3 sm:pb-6">
                      <div>
                        <Label className="text-muted-foreground text-xs">Business Type</Label>
                        <p className="font-medium break-words">
                          {selectedVerification.businessType === "sole_proprietor" ? "Sole Proprietor" :
                           selectedVerification.businessType === "registered_partnership" ? "Registered Partnership" :
                           selectedVerification.businessType === "non_registered_partnership" ? "Non-Registered Partnership" :
                           selectedVerification.businessType === "other" ? "Other (Pvt Ltd, LLP, etc.)" : "Not provided"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Aadhaar Number</Label>
                        <p className="font-medium break-all">{selectedVerification.aadhaarNumber || "Not provided"}</p>
                      </div>
                      {selectedVerification.businessType === "registered_partnership" && (
                        <div>
                          <Label className="text-muted-foreground text-xs">GSTIN Number</Label>
                          <p className="font-medium break-all">{selectedVerification.gstinNumber || "Not provided"}</p>
                        </div>
                      )}
                      {selectedVerification.businessType === "non_registered_partnership" && (
                        <>
                          <div>
                            <Label className="text-muted-foreground text-xs">Partner Name</Label>
                            <p className="font-medium break-words">{selectedVerification.partnerName || "Not provided"}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Partner Driver License</Label>
                            <p className="font-medium break-all">{selectedVerification.driverLicenseNumber || "Not provided"}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Partner PAN Number</Label>
                            <p className="font-medium break-all">{selectedVerification.panNumber || "Not provided"}</p>
                          </div>
                        </>
                      )}
                      {selectedVerification.businessType === "other" && (
                        <div>
                          <Label className="text-muted-foreground text-xs">CIN Number</Label>
                          <p className="font-medium break-all">{selectedVerification.cinNumber || "Not provided"}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-muted-foreground text-xs">Locality / Area</Label>
                        <p className="font-medium break-words">{selectedVerification.businessLocality || "Not provided"}</p>
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <Label className="text-muted-foreground text-xs">Business Address</Label>
                        <p className="font-medium break-words">{selectedVerification.businessAddress || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Fleet Size</Label>
                        <p className="font-medium">{selectedVerification.fleetSize || 1} truck(s)</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bank Details */}
                {(selectedVerification.bankName || selectedVerification.bankAccountNumber || selectedVerification.bankIfscCode || selectedVerification.bankAccountHolderName) && (
                  <Card>
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                        <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                        Bank Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm px-3 sm:px-6 pb-3 sm:pb-6">
                      <div>
                        <Label className="text-muted-foreground text-xs">Account Holder Name</Label>
                        <p className="font-medium break-words">{selectedVerification.bankAccountHolderName || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Bank Name</Label>
                        <p className="font-medium break-words">{selectedVerification.bankName || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Account Number</Label>
                        <p className="font-medium break-all">{selectedVerification.bankAccountNumber || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">IFSC Code</Label>
                        <p className="font-medium break-all">{selectedVerification.bankIfscCode || "Not provided"}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm">Uploaded Documents</CardTitle>
                    <CardDescription className="text-xs">Review and verify each document (scroll to see all)</CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <div className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto pr-1 sm:pr-2">
                      {(selectedVerification.documents || []).length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 text-xs sm:text-sm">No documents uploaded yet</p>
                      ) : (
                        sortDocumentsByPriority(selectedVerification.documents || []).map((doc) => (
                          <div key={doc.id} className="p-2 sm:p-3 border rounded-lg space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-xs sm:text-sm break-words">
                                    {doc.documentType === "address_proof" && selectedVerification?.addressProofType ? 
                                      getDocumentDisplayName(`address_proof_${selectedVerification.addressProofType === "office_photo_with_board" ? "office_photo" : selectedVerification.addressProofType}`) :
                                      getDocumentDisplayName(doc.documentType)}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                                    {doc.uploadedAt ? `Uploaded ${format(new Date(doc.uploadedAt), "MMM d, yyyy")}` : "Recently uploaded"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {doc.status === "approved" ? (
                                  <Badge variant="default" className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
                                ) : doc.status === "rejected" ? (
                                  <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                                )}
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  data-testid={`button-view-${doc.documentType}`}
                                  onClick={() => {
                                    setPreviewDoc(doc);
                                    setPreviewOpen(true);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </div>
                            </div>
                            {doc.status === "pending" && (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pl-0 sm:pl-8">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950 text-xs w-full sm:w-auto"
                                  onClick={() => handleDocApprove(doc)}
                                  disabled={documentVerifyMutation.isPending}
                                  data-testid={`button-approve-doc-${doc.documentType}`}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-xs w-full sm:w-auto"
                                  onClick={() => {
                                    setSelectedDocForReject(doc);
                                    setDocRejectDialogOpen(true);
                                  }}
                                  disabled={documentVerifyMutation.isPending}
                                  data-testid={`button-reject-doc-${doc.documentType}`}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-shrink-0 border-t pt-3 sm:pt-4 flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDetailsOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
            {(selectedVerification?.status === "pending" || selectedVerification?.status === "draft") && (
              <>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    setRejectDialogOpen(true);
                  }}
                  data-testid="button-reject-carrier"
                  className="w-full sm:w-auto text-sm"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                {selectedVerification?.status === "pending" && (
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      setHoldDialogOpen(true);
                    }}
                    data-testid="button-hold-carrier"
                    className="w-full sm:w-auto text-sm"
                  >
                    <PauseCircle className="h-4 w-4 mr-2" />
                    Put on Hold
                  </Button>
                )}
                <Button 
                  onClick={() => handleApprove(selectedVerification)}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve-carrier"
                  className="w-full sm:w-auto text-sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {selectedVerification?.status === "draft" ? "Approve Draft" : "Approve & Verify"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Reject Verification</DialogTitle>
            <DialogDescription className="text-sm">
              Please provide a reason for rejecting {selectedVerification?.carrier?.companyName}'s verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder=""
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-2"
                data-testid="input-reject-reason"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
              className="w-full sm:w-auto"
            >
              Reject Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Put on Hold Dialog */}
      <Dialog open={holdDialogOpen} onOpenChange={(open) => {
        setHoldDialogOpen(open);
        if (!open) setHoldNotes("");
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Put Verification on Hold</DialogTitle>
            <DialogDescription className="text-sm">
              Add notes explaining why {selectedVerification?.carrier?.companyName}'s verification is being put on hold.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder=""
                value={holdNotes}
                onChange={(e) => setHoldNotes(e.target.value)}
                className="mt-2"
                data-testid="input-hold-notes"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setHoldDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleHold}
              disabled={!holdNotes.trim() || holdMutation.isPending}
              data-testid="button-confirm-hold"
              className="w-full sm:w-auto"
            >
              <PauseCircle className="h-4 w-4 mr-2" />
              Put on Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{previewDoc && getDocumentDisplayName(previewDoc.documentType)}</span>
            </DialogTitle>
            <DialogDescription className="text-xs truncate">
              {previewDoc?.fileName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-h-0">
            {previewDoc && (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Document Type</Label>
                    <p className="font-medium text-xs sm:text-sm mt-0.5">{getDocumentDisplayName(previewDoc.documentType)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">File Name</Label>
                    <p className="font-medium text-xs sm:text-sm mt-0.5 break-all">{previewDoc.fileName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Upload Date</Label>
                    <p className="font-medium text-xs sm:text-sm mt-0.5">
                      {previewDoc.uploadedAt ? format(new Date(previewDoc.uploadedAt), "MMM d, yyyy HH:mm") : "Recently uploaded"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      {previewDoc.status === "approved" ? (
                        <Badge className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
                      ) : previewDoc.status === "rejected" ? (
                        <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Document Preview */}
                <div className="border rounded-lg bg-muted/30 overflow-hidden">
                  {!previewDoc.fileUrl?.trim() ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-muted-foreground">
                      <p className="text-xs text-amber-600 dark:text-amber-500 text-center">
                        Document file link is missing. You cannot preview or open this document.
                      </p>
                    </div>
                  ) : previewUrlLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Skeleton className="h-16 w-16 rounded-full mb-3" />
                      <p className="text-xs">Loading preview…</p>
                    </div>
                  ) : previewUrlError || !previewDisplayUrl ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-muted-foreground">
                      <FileText className="h-8 w-8 mb-3 opacity-50" />
                      <p className="text-xs text-amber-600 dark:text-amber-500 mb-1 text-center">{previewUrlError || "Preview unavailable"}</p>
                      <p className="text-xs mb-3 text-center">Use &quot;Open in New Tab&quot; to view the document</p>
                      <Badge variant="outline" className="text-xs">
                        {previewDoc.fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                      </Badge>
                    </div>
                  ) : (() => {
                    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                    const fromFileName = (previewDoc.fileName.split('.').pop() || '').toLowerCase();
                    const fromPath = (previewDoc.fileUrl || '').split('/').pop()?.split('.').pop()?.toLowerCase() || '';
                    const ext = imageExtensions.includes(fromFileName) || fromFileName === 'pdf'
                      ? fromFileName
                      : imageExtensions.includes(fromPath) || fromPath === 'pdf'
                        ? fromPath
                        : fromFileName || fromPath || '';
                    const isPdf = ext === 'pdf';
                    const isImage = imageExtensions.includes(ext);
                    if (isPdf) {
                      return (
                        <iframe
                          title={previewDoc.fileName}
                          src={previewDisplayUrl}
                          className="w-full h-[40vh] rounded border-0 bg-white"
                        />
                      );
                    }
                    if (isImage) {
                      return (
                        <div className="flex justify-center p-3">
                          <img
                            src={previewDisplayUrl}
                            alt={previewDoc.fileName}
                            className="max-h-[40vh] w-auto max-w-full object-contain rounded"
                          />
                        </div>
                      );
                    }
                    return (
                      <UnknownTypePreview
                        previewDisplayUrl={previewDisplayUrl}
                        fileName={previewDoc.fileName}
                        fallback={
                          <div className="flex flex-col items-center justify-center py-8 px-4 text-muted-foreground">
                            <FileText className="h-8 w-8 mb-3 opacity-50" />
                            <p className="text-xs mb-1 text-center">Preview not available for this file type</p>
                            <p className="text-xs mb-3 text-center">Use &quot;Open in New Tab&quot; to view the document</p>
                            <Badge variant="outline" className="text-xs">
                              {ext ? ext.toUpperCase() : 'FILE'}
                            </Badge>
                          </div>
                        }
                      />
                    );
                  })()}
                </div>
              </>
            )}
          </div>
          <DialogFooter className="px-4 sm:px-6 py-3 border-t shrink-0 gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} className="w-full sm:w-auto text-sm">
              Close
            </Button>
            <Button 
              onClick={async () => {
                const rawUrl = previewDoc?.fileUrl?.trim();
                if (!rawUrl) {
                  toast({
                    title: "Document unavailable",
                    description: "This document has no file link. It may have been uploaded before storage was configured.",
                    variant: "destructive",
                  });
                  return;
                }
                try {
                  // Normalize: use pathname only so backend accepts full URLs or paths
                  const pathForApi = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
                    ? (() => {
                        try {
                          return new URL(rawUrl).pathname;
                        } catch {
                          return rawUrl;
                        }
                      })()
                    : rawUrl.startsWith("/")
                    ? rawUrl
                    : `/${rawUrl}`;
                  const response = await fetch(`/api/documents/presigned-url?path=${encodeURIComponent(pathForApi)}`, {
                    credentials: "include",
                  });
                  const data = await response.json().catch(() => ({}));
                  if (!response.ok) {
                    const msg = data?.error || response.statusText || "Failed to get document URL";
                    toast({
                      title: "Cannot open document",
                      description: response.status === 404 ? "Document not found in storage. It may have been moved or deleted." : msg,
                      variant: "destructive",
                    });
                    return;
                  }
                  if (data?.url) {
                    window.open(data.url, "_blank", "noopener,noreferrer");
                  } else {
                    toast({
                      title: "Cannot open document",
                      description: "Server did not return a valid document URL.",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error("Error opening document:", error);
                  toast({
                    title: "Error",
                    description: "Failed to open document. Please try again.",
                    variant: "destructive",
                  });
                }
              }}
              disabled={!previewDoc?.fileUrl?.trim()}
              data-testid="button-open-document"
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Rejection Dialog */}
      <Dialog open={docRejectDialogOpen} onOpenChange={(open) => {
        setDocRejectDialogOpen(open);
        if (!open) {
          setDocRejectReason("");
          setSelectedDocForReject(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Reject Document</DialogTitle>
            <DialogDescription className="text-sm">
              Please provide a reason for rejecting this {selectedDocForReject ? getDocumentDisplayName(selectedDocForReject.documentType) : 'document'}. The carrier will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={docRejectReason}
                onChange={(e) => setDocRejectReason(e.target.value)}
                className="mt-2"
                data-testid="input-doc-reject-reason"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDocRejectDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDocReject}
              disabled={!docRejectReason.trim() || documentVerifyMutation.isPending}
              data-testid="button-confirm-doc-reject"
              className="w-full sm:w-auto"
            >
              Reject Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
