import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  FileText,
  Eye,
  Download,
  User,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Package,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveDocumentDisplay } from "@/lib/document-utils";
import { DocumentPreviewPanel, getDocumentOpenUrl } from "@/components/document-preview-panel";
import type { Driver } from "@shared/schema";
import { differenceInDays } from "date-fns";

const documentTypeLabels: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  aadhar: "Aadhaar Card",
  pan: "PAN Card",
  pan_card: "PAN Card",
  license: "Driving License",
  driving_license: "Driving License",
  address_proof: "Address Proof",
  selfie: "Office Selfie",
  gst_certificate: "GST Certificate",
  bank_details: "Bank Details",
  cancelled_cheque: "Cancelled Cheque",
  rc: "RC Book",
  insurance: "Insurance Policy",
  fitness: "Fitness Certificate",
  permit: "Road Permit",
  puc: "PUC Certificate",
  truck_rc: "Truck RC",
  truck_insurance: "Truck Insurance",
  truck_fitness: "Truck Fitness",
  truck_permit: "Truck Permit",
  truck_puc: "Truck PUC",
  pod: "Proof of Delivery",
  lr: "Lorry Receipt",
  lr_consignment: "LR / Consignment Note",
  eway: "E-Way Bill",
  eway_bill: "E-Way Bill",
  loading_photos: "Loading Photos",
  invoice: "Invoice",
  weighment_slip: "Weighment Slip",
  other: "Other Document",
};

type DisplayDocument = {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  isVerified: boolean;
  fileSize?: number;
  createdAt?: string | Date;
  expiryDate?: string | Date | null;
};

function openDocumentPreview(
  doc: DisplayDocument,
  setSelectedDocument: (doc: DisplayDocument) => void,
  setDocumentPreviewOpen: (open: boolean) => void,
) {
  const resolved = resolveDocumentDisplay(doc.fileUrl, doc.fileName);
  setSelectedDocument({
    ...doc,
    fileUrl: resolved.storagePath,
    fileName: resolved.displayName,
    fileSize: doc.fileSize ?? resolved.fileSize,
  });
  setDocumentPreviewOpen(true);
}

type DriverDocumentsPayload = {
  driverDocuments: DisplayDocument[];
  loadDocuments: Record<string, { loadNum: string; status: string; docs: DisplayDocument[] }>;
};

export default function MyCarrierProfilePage() {
  const [, params] = useRoute("/admin/drivers/:driverId");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    driver: true,
    loads: true,
  });

  const toggleFolder = (folder: string) => {
    setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const driverId = params?.driverId;

  // Query backend API for driver data
  const { data: driver, isLoading } = useQuery<Driver>({
    queryKey: [`/api/admin/drivers/${driverId}`],
    enabled: !!driverId,
  });

  const { data: documentsData, isLoading: documentsLoading } = useQuery<DriverDocumentsPayload>({
    queryKey: [`/api/admin/drivers/${driverId}/documents`],
    enabled: !!driverId,
  });

  const getDaysUntilExpiry = (expiryDate: string | Date | null) => {
    if (!expiryDate) return null;
    return differenceInDays(new Date(expiryDate), new Date());
  };

  const getExpiryStatus = (daysRemaining: number | null) => {
    if (daysRemaining === null) return null;
    if (daysRemaining < 0) return { label: "Expired", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20" };
    if (daysRemaining <= 7) return { label: "Critical", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20" };
    if (daysRemaining <= 30) return { label: "Expiring Soon", color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-900/20" };
    return { label: "Valid", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20" };
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/admin/drivers")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Drivers
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Driver Not Found</h2>
            <p className="text-muted-foreground">The driver you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const licenseExpiryDays = driver.licenseExpiry ? getDaysUntilExpiry(driver.licenseExpiry) : null;
  const licenseStatus = getExpiryStatus(licenseExpiryDays);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/admin/drivers")}
            data-testid="button-back"
            className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate" data-testid="text-driver-name">
                {driver.name}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{driver.phone}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Phone</p>
                <p className="text-sm sm:text-base font-bold truncate">{driver.phone}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">License</p>
                <p className="text-sm sm:text-base font-bold truncate">{driver.licenseNumber || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg shrink-0 ${licenseStatus?.bgColor || "bg-gray-100"}`}>
                <Calendar className={`h-4 w-4 sm:h-5 sm:w-5 ${licenseStatus?.color || "text-gray-600"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">License Expiry</p>
                <p className="text-sm sm:text-base font-bold">
                  {driver.licenseExpiry 
                    ? format(new Date(driver.licenseExpiry), "MMM dd, yyyy")
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* License Expiry Alert */}
      {licenseExpiryDays !== null && licenseExpiryDays <= 30 && (
        <Card className={licenseExpiryDays < 0 ? "border-red-500" : "border-amber-500"}>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className={`h-5 w-5 shrink-0 ${licenseExpiryDays < 0 ? "text-red-600" : "text-amber-600"}`} />
              <div>
                <p className={`font-semibold ${licenseExpiryDays < 0 ? "text-red-600" : "text-amber-600"}`}>
                  {licenseExpiryDays < 0 
                    ? `License Expired ${Math.abs(licenseExpiryDays)} days ago`
                    : `License Expiring in ${licenseExpiryDays} days`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please renew the driving license to maintain compliance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-4">
        <TabsList className="inline-flex h-9 sm:h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="overview" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Overview</TabsTrigger>
          <TabsTrigger value="documents" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Driver Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{driver.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone Number</p>
                  <p className="font-medium">{driver.phone}</p>
                </div>
              </div>
              {driver.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{driver.email}</p>
                  </div>
                </div>
              )}
              {driver.licenseNumber && (
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">License Number</p>
                    <p className="font-medium">{driver.licenseNumber}</p>
                  </div>
                </div>
              )}
              {driver.aadhaarNumber && (
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Aadhaar Number</p>
                    <p className="font-medium">{driver.aadhaarNumber}</p>
                  </div>
                </div>
              )}
              {driver.licenseExpiry && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">License Expiry</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-medium">{format(new Date(driver.licenseExpiry), "MMM dd, yyyy")}</p>
                      {licenseStatus && (
                        <Badge className={`text-xs ${licenseStatus.bgColor} ${licenseStatus.color}`}>
                          {licenseStatus.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {driver.status && (
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className="mt-1">
                      {driver.status === "available" && "Available"}
                      {driver.status === "on_trip" && "On Trip"}
                      {driver.status === "inactive" && "Inactive"}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 sm:mt-6">
          {documentsLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-24 w-full mb-2" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ) : (() => {
            const driverDocs = documentsData?.driverDocuments ?? [];
            const loadDocsMap = documentsData?.loadDocuments ?? {};
            const loadEntries = Object.entries(loadDocsMap);

            const statusLabels: Record<string, string> = {
              delivered: "Delivered",
              in_transit: "In Transit",
              pickup_scheduled: "Pickup Scheduled",
              awarded: "Awarded",
              invoice_sent: "Invoice Sent",
              invoice_paid: "Invoice Paid",
              closed: "Closed",
            };

            const getStatusBadge = (status: string) => {
              const label = statusLabels[status] || status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
              return <Badge variant="outline" className="text-xs ml-2">{label}</Badge>;
            };

            const totalLoadDocs = loadEntries.reduce((sum, [, l]) => sum + l.docs.length, 0);

            const renderDocumentRow = (doc: DisplayDocument) => (
              <div key={doc.id} className="flex items-center justify-between py-2 px-3 border-b last:border-b-0">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`h-4 w-4 ${doc.isVerified ? "text-green-500" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-medium text-sm">{documentTypeLabels[doc.documentType] || doc.documentType || "Document"}</p>
                    <p className="text-xs text-muted-foreground">{doc.fileName || "Uploaded Document"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.isVerified ? (
                    <Badge variant="default" className="text-xs">Verified</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Pending</Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openDocumentPreview(doc, setSelectedDocument, setDocumentPreviewOpen)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );

            const renderFolders = () => (
              <>
                {/* Driver Documents Folder */}
                <Collapsible open={openFolders.driver} onOpenChange={() => toggleFolder("driver")}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover-elevate">
                    <div className="flex items-center gap-2">
                      {openFolders.driver ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {openFolders.driver ? <FolderOpen className="h-5 w-5 text-amber-500" /> : <Folder className="h-5 w-5 text-amber-500" />}
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Driver Documents</span>
                    </div>
                    <Badge variant="secondary">{driverDocs.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-6 mt-1 border-l-2 border-muted pl-4">
                    <div className="bg-muted/30 rounded-lg">
                      {driverDocs.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-3 px-3">No driver documents uploaded yet</p>
                      ) : (
                        driverDocs.map(doc => renderDocumentRow(doc))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Loads Folder */}
                <Collapsible open={openFolders.loads} onOpenChange={() => toggleFolder("loads")}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover-elevate">
                    <div className="flex items-center gap-2">
                      {openFolders.loads ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {openFolders.loads ? <FolderOpen className="h-5 w-5 text-amber-500" /> : <Folder className="h-5 w-5 text-amber-500" />}
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Loads</span>
                    </div>
                    <Badge variant="secondary">
                      {totalLoadDocs} docs in {loadEntries.length} load{loadEntries.length !== 1 ? "s" : ""}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-6 mt-1 border-l-2 border-muted pl-4 space-y-2">
                    {loadEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No load documents yet</p>
                    ) : (
                      loadEntries.map(([loadId, loadData]) => {
                      const isOpen = openFolders[loadId] || false;
                      return (
                        <Collapsible key={loadId} open={isOpen} onOpenChange={() => toggleFolder(loadId)}>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/30 hover-elevate">
                            <div className="flex items-center gap-2">
                              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <Folder className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">LD-{loadData.loadNum}</span>
                              {loadData.status && getStatusBadge(loadData.status)}
                            </div>
                            <Badge variant="outline" className="text-xs">{loadData.docs.length} doc{loadData.docs.length !== 1 ? "s" : ""}</Badge>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="ml-4 mt-1 border-l border-muted pl-3">
                            <div className="bg-background rounded-lg border">
                              {loadData.docs.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2 px-3">No documents for this load</p>
                              ) : (
                                loadData.docs.map(doc => renderDocumentRow(doc))
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            );

            return (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary" />
                    Document Folders
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Documents from the database for this driver</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Mobile */}
                  <div className="sm:hidden">
                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="space-y-3 pb-2 min-w-max px-2">
                        {renderFolders()}
                      </div>
                    </div>
                  </div>
                  {/* Desktop */}
                  <div className="hidden sm:block space-y-2">
                    {renderFolders()}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Document Preview Dialog */}
      <Dialog open={documentPreviewOpen} onOpenChange={setDocumentPreviewOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] mx-auto max-h-[90vh] flex flex-col overflow-hidden">
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

              <DocumentPreviewPanel document={selectedDocument} />

              <div className="flex-shrink-0 border-t pt-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">File Size</p>
                        <p className="font-medium">
                          {selectedDocument.fileSize
                            ? `${(selectedDocument.fileSize / 1024).toFixed(1)} KB`
                            : "Unknown"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <div className="mt-1">
                          {selectedDocument.isVerified ? (
                            <Badge variant="default">Verified</Badge>
                          ) : (
                            <Badge variant="secondary">Pending Review</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Uploaded</p>
                        <p className="font-medium">
                          {selectedDocument.createdAt ? format(new Date(selectedDocument.createdAt), "dd MMM yyyy") : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expiry Date</p>
                        <p className="font-medium">
                          {selectedDocument.expiryDate
                            ? format(new Date(selectedDocument.expiryDate), "dd MMM yyyy")
                            : "No expiry date"}
                        </p>
                      </div>
                    </div>
                  </div>
              </div>

              <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2">
                <div className="flex-1" />
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = getDocumentOpenUrl(selectedDocument);
                    if (url) window.open(url, "_blank");
                  }}
                  data-testid="button-download-document"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = getDocumentOpenUrl(selectedDocument);
                    if (url) window.open(url, "_blank");
                  }}
                  data-testid="button-view-full-document"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Full
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
