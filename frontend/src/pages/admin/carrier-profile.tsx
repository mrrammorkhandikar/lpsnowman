import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { onMarketplaceEvent } from "@/lib/marketplace-socket";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Star,
  ShieldCheck,
  ShieldX,
  Truck,
  FileText,
  Package,
  Clock,
  RefreshCw,
  Calendar,
  Activity,
  Eye,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  User,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getDocumentUrl } from "@/lib/document-utils";

interface CarrierProfile {
  userId: string;
  carrierType: string;
  fleetSize: number;
  serviceZones: string[];
  reliabilityScore: string;
  communicationScore: string;
  onTimeScore: string;
  totalDeliveries: number;
  badgeLevel: string;
  rating: string;
  bio?: string;
}

interface CarrierData {
  id: string;
  username: string;
  email: string;
  companyName: string;
  phone?: string;
  isVerified: boolean;
  createdAt: string;
  userNumber?: number;
  profile: CarrierProfile;
  bids: any[];
  bidCount: number;
  documents: any[];
  documentCount: number;
  trucks: any[];
  truckCount: number;
  verification?: any;
  assignedLoads: any[];
}

function formatRupees(amount: number): string {
  if (amount >= 10000000) {
    return `Rs. ${(amount / 10000000).toFixed(2)} Cr`;
  } else if (amount >= 100000) {
    return `Rs. ${(amount / 100000).toFixed(2)} L`;
  } else {
    return `Rs. ${amount.toLocaleString("en-IN")}`;
  }
}

export default function CarrierProfilePage() {
  const [, params] = useRoute("/admin/carriers/:carrierId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const carrierId = params?.carrierId;

  const { data: carrier, isLoading, refetch } = useQuery<CarrierData>({
    queryKey: ["/api/admin/carriers", carrierId],
    enabled: !!carrierId,
  });

  // Listen for real-time document uploads from this carrier
  useEffect(() => {
    if (!carrierId) return;

    const unsubscribe = onMarketplaceEvent("carrier_document_uploaded", (data: any) => {
      if (data.carrierId === carrierId) {
        refetch();
        toast({
          title: "New Document Uploaded",
          description: `${data.carrierName || 'Carrier'} uploaded a new ${data.documentType} document. Please review for verification.`,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [carrierId, refetch, toast]);

  const verifyMutation = useMutation({
    mutationFn: async (isVerified: boolean) => {
      return apiRequest("PATCH", `/api/admin/carriers/${carrierId}/verify`, { isVerified });
    },
    onSuccess: () => {
      refetch();
      // Sync data across portal
      queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      toast({ title: "Carrier Updated", description: "Carrier verification status changed" });
    },
  });

  const documentVerifyMutation = useMutation({
    mutationFn: async ({ documentId, isVerified }: { documentId: string; isVerified: boolean }) => {
      return apiRequest("PATCH", `/api/admin/documents/${documentId}/verify`, { isVerified });
    },
    onSuccess: (_, { isVerified }) => {
      refetch();
      setDocumentPreviewOpen(false);
      setSelectedDocument(null);
      toast({ 
        title: isVerified ? "Document Verified" : "Document Rejected",
        description: isVerified ? "The document has been approved." : "The document has been rejected."
      });
    },
    onError: () => {
      toast({ 
        title: "Error",
        description: "Failed to update document status",
        variant: "destructive"
      });
    },
  });

  const documentTypeLabels: Record<string, string> = {
    // Official/Identity Documents
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
    // Vehicle Documents
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
    // Shipment Documents
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

  // Document category definitions
  const driverDocTypes = ['aadhaar', 'aadhar', 'license', 'driving_license', 'selfie'];
  const vehicleDocTypes = ['rc', 'insurance', 'fitness', 'permit', 'puc', 'truck_rc', 'truck_insurance', 'truck_fitness', 'truck_permit', 'truck_puc'];

  // Categorize documents into folders matching carrier portal structure
  const categorizeDocuments = (docs: any[]) => {
    const truck: any[] = [];
    const driver: any[] = [];
    const loadDocs: Record<string, any[]> = {};

    docs.forEach(doc => {
      const docType = doc.documentType || doc.type || '';
      
      // Truck/Vehicle documents (source: 'truck' or vehicle doc types)
      if (doc.source === 'truck' || vehicleDocTypes.includes(docType)) {
        truck.push(doc);
      }
      // Documents with loadId go to load folders
      else if (doc.loadId) {
        if (!loadDocs[doc.loadId]) {
          loadDocs[doc.loadId] = [];
        }
        loadDocs[doc.loadId].push(doc);
      }
      // Driver identity documents
      else if (driverDocTypes.includes(docType)) {
        driver.push(doc);
      }
      // Default remaining to driver folder
      else {
        driver.push(doc);
      }
    });

    return { truck, driver, loadDocs };
  };

  // State for collapsible folders
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    truck: true,
    driver: true,
    loads: true,
  });

  const toggleFolder = (folder: string) => {
    setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const handleSync = () => {
    refetch();
    toast({ title: "Data Synced", description: "Carrier data refreshed from database" });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!carrier) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/admin/carriers")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Carriers
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Carrier Not Found</h2>
            <p className="text-muted-foreground">The carrier you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = carrier.profile;
  const rating = parseFloat(profile?.rating || "0");
  const reliabilityScore = parseFloat(profile?.reliabilityScore || "0");
  const communicationScore = parseFloat(profile?.communicationScore || "0");
  const onTimeScore = parseFloat(profile?.onTimeScore || "0");

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/admin/carriers")}
            data-testid="button-back"
            className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate" data-testid="text-carrier-name">
                {carrier.companyName || carrier.username}
              </h1>
              <Badge 
                variant={carrier.isVerified ? "default" : "secondary"}
                className={`text-xs shrink-0 ${carrier.isVerified ? "bg-green-500/10 text-green-600 border-green-200" : ""}`}
              >
                {carrier.isVerified ? (
                  <>
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Verified
                  </>
                ) : (
                  <>
                    <ShieldX className="h-3 w-3 mr-1" />
                    Unverified
                  </>
                )}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{carrier.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={handleSync} className="text-xs sm:text-sm h-8 sm:h-9">
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sync</span>
          </Button>
          {!carrier.isVerified ? (
            <Button 
              size="sm" 
              onClick={() => verifyMutation.mutate(true)}
              disabled={verifyMutation.isPending}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Verify Carrier</span>
              <span className="sm:hidden">Verify</span>
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => verifyMutation.mutate(false)}
              disabled={verifyMutation.isPending}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              <ShieldX className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Revoke Verification</span>
              <span className="sm:hidden">Revoke</span>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30 shrink-0">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Rating</p>
                <p className="text-xl sm:text-2xl font-bold">{rating.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Fleet Size</p>
                <p className="text-xl sm:text-2xl font-bold">{profile?.fleetSize || carrier.truckCount || 1}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Deliveries</p>
                <p className="text-xl sm:text-2xl font-bold">{profile?.totalDeliveries || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Active Bids</p>
                <p className="text-xl sm:text-2xl font-bold">{carrier.bidCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-4">
        <div className="relative -mx-3 sm:-mx-4 md:mx-0">
          <div className="overflow-x-auto scrollbar-hide px-3 sm:px-4 md:px-0">
            <TabsList className="inline-flex h-9 sm:h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full sm:min-w-0">
              <TabsTrigger value="overview" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Overview</TabsTrigger>
              <TabsTrigger value="fleet" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Fleet ({carrier.truckCount})</TabsTrigger>
              <TabsTrigger value="bids" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Bids ({carrier.bidCount})</TabsTrigger>
              <TabsTrigger value="documents" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Documents ({carrier.documentCount})</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
            {/* Solo Driver: Driver Info / Enterprise: Company Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {profile?.carrierType === "solo" ? "Driver Information" : "Company Information"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile?.carrierType === "solo" ? (
                  <>
                    {/* Solo Driver - Show driver name and truck info */}
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Driver Name</p>
                        <p className="font-medium">{carrier.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Truck Number</p>
                        <p className="font-medium">
                          {carrier.trucks && carrier.trucks.length > 0 
                            ? carrier.trucks[0].licensePlate || "Not registered"
                            : "No truck registered"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Driver ID</p>
                        <p className="font-medium text-xs font-mono">
                          {carrier.userNumber
                            ? `USR-${String(carrier.userNumber).padStart(3, '0')}`
                            : carrier.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Enterprise Carrier - Show company info */}
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Company Name</p>
                        <p className="font-medium">{carrier.companyName || "Not specified"}</p>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{carrier.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{carrier.phone || "Not specified"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                    <p className="font-medium">
                      {carrier.createdAt ? format(new Date(carrier.createdAt), "MMM dd, yyyy") : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Zones */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Zones</CardTitle>
              </CardHeader>
              <CardContent>
                {profile?.serviceZones && profile.serviceZones.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.serviceZones.map((zone: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        <MapPin className="h-3 w-3 mr-1" />
                        {zone}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No service zones specified</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Scores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Reliability</span>
                  <span>{reliabilityScore}%</span>
                </div>
                <Progress value={reliabilityScore} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Communication</span>
                  <span>{communicationScore}%</span>
                </div>
                <Progress value={communicationScore} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>On-Time Delivery</span>
                  <span>{onTimeScore}%</span>
                </div>
                <Progress value={onTimeScore} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fleet" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fleet Details</CardTitle>
            </CardHeader>
            <CardContent>
              {carrier.trucks && carrier.trucks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carrier.trucks.map((truck: any) => (
                      <TableRow key={truck.id}>
                        <TableCell className="font-medium">{truck.licensePlate || truck.vehicleNumber || "Not specified"}</TableCell>
                        <TableCell>{truck.vehicleType || truck.type || "Not specified"}</TableCell>
                        <TableCell>{truck.capacity ? `${truck.capacity} tons` : "Not specified"}</TableCell>
                        <TableCell>
                          <Badge variant={truck.isActive ? "default" : "secondary"}>
                            {truck.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trucks registered yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bids" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bid History</CardTitle>
            </CardHeader>
            <CardContent>
              {carrier.bids && carrier.bids.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Load ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carrier.bids.slice(0, 20).map((bid: any) => {
                      const load = carrier.assignedLoads?.find((l: any) => l.id === bid.loadId);
                      const formattedLoadId = load?.adminReferenceNumber
                        ? `LD-${load.adminReferenceNumber}`
                        : load?.shipperLoadNumber
                        ? `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`
                        : bid.loadId.slice(0, 8).toUpperCase();
                      return (
                      <TableRow key={bid.id}>
                        <TableCell className="font-mono text-sm">{formattedLoadId}</TableCell>
                        <TableCell>{formatRupees(bid.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={bid.status === "accepted" ? "default" : "secondary"}>
                            {bid.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {bid.createdAt ? format(new Date(bid.createdAt), "MMM dd, yyyy") : "N/A"}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No bids placed yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 sm:mt-6">
          {carrier.documents && carrier.documents.length > 0 ? (
            (() => {
              const { truck, driver, loadDocs } = categorizeDocuments(carrier.documents);
              const loadIds = Object.keys(loadDocs);
              const totalLoadDocs = loadIds.reduce((sum, id) => sum + loadDocs[id].length, 0);
              
              const renderDocumentRow = (doc: any, showVerify: boolean = false) => (
                <div key={doc.id} className="flex items-center justify-between py-2 px-3 border-b last:border-b-0" data-testid={`row-doc-${doc.id}`}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={`h-4 w-4 ${doc.isVerified ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-medium text-sm">{documentTypeLabels[doc.documentType] || doc.documentType || 'Document'}</p>
                      <p className="text-xs text-muted-foreground">{doc.fileName || 'Uploaded Document'}</p>
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
                      onClick={() => {
                        setSelectedDocument(doc);
                        setDocumentPreviewOpen(true);
                      }}
                      data-testid={`button-view-doc-${doc.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {showVerify && !doc.isVerified && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => documentVerifyMutation.mutate({ documentId: doc.id, isVerified: true })}
                          disabled={documentVerifyMutation.isPending}
                          data-testid={`button-approve-doc-${doc.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => documentVerifyMutation.mutate({ documentId: doc.id, isVerified: false })}
                          disabled={documentVerifyMutation.isPending}
                          data-testid={`button-reject-doc-${doc.id}`}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );

              return (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Folder className="h-5 w-5 text-primary" />
                      Document Folders
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Organize your documents by category</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Mobile: Vertical layout with horizontal scroll, Desktop: Normal layout */}
                    <div className="sm:hidden">
                      <div className="overflow-x-auto scrollbar-hide">
                        <div className="space-y-3 pb-2 min-w-max px-2">
                          {/* Truck Documents Folder */}
                          <Collapsible open={openFolders.truck} onOpenChange={() => toggleFolder('truck')}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover-elevate" data-testid="folder-truck-documents">
                              <div className="flex items-center gap-2">
                                {openFolders.truck ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                {openFolders.truck ? <FolderOpen className="h-5 w-5 text-amber-500" /> : <Folder className="h-5 w-5 text-amber-500" />}
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Truck Documents</span>
                              </div>
                              <Badge variant="secondary">{truck.length}</Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="ml-6 mt-1 border-l-2 border-muted pl-4">
                              {truck.length > 0 ? (
                                <div className="bg-muted/30 rounded-lg">
                                  {truck.map(doc => renderDocumentRow(doc, true))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground py-2">No truck documents</p>
                              )}
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Driver Documents Folder */}
                          <Collapsible open={openFolders.driver} onOpenChange={() => toggleFolder('driver')}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover-elevate" data-testid="folder-driver-documents">
                              <div className="flex items-center gap-2">
                                {openFolders.driver ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                {openFolders.driver ? <FolderOpen className="h-5 w-5 text-amber-500" /> : <Folder className="h-5 w-5 text-amber-500" />}
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Driver Documents</span>
                              </div>
                              <Badge variant="secondary">{driver.length}</Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="ml-6 mt-1 border-l-2 border-muted pl-4">
                              {driver.length > 0 ? (
                                <div className="bg-muted/30 rounded-lg">
                                  {driver.map(doc => renderDocumentRow(doc, true))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground py-2">No driver documents</p>
                              )}
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Loads Folder */}
                          {(() => {
                            // Build load info map from assignedLoads
                            const loadInfoMap: Record<string, { loadNumber: number; status: string }> = {};
                            if (carrier.assignedLoads) {
                              carrier.assignedLoads.forEach((load: any) => {
                                loadInfoMap[load.id] = {
                                  loadNumber: load.shipperLoadNumber || load.adminReferenceNumber || 0,
                                  status: load.status || 'unknown',
                                };
                              });
                            }
                            
                            // Sort load IDs by load number descending
                            const sortedLoadIds = [...loadIds].sort((a, b) => {
                              const numA = loadInfoMap[a]?.loadNumber || 0;
                              const numB = loadInfoMap[b]?.loadNumber || 0;
                              return numB - numA;
                            });

                            const getStatusBadge = (status: string) => {
                              const statusLabels: Record<string, string> = {
                                delivered: "Delivered",
                                in_transit: "In Transit",
                                pickup_scheduled: "Pickup Scheduled",
                                awarded: "Awarded",
                                invoice_sent: "Invoice Sent",
                                invoice_paid: "Invoice Paid",
                                closed: "Closed",
                              };
                              const label = statusLabels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return <Badge variant="outline" className="text-xs ml-2">{label}</Badge>;
                            };

                            return (
                              <Collapsible open={openFolders.loads} onOpenChange={() => toggleFolder('loads')}>
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover-elevate" data-testid="folder-loads">
                                  <div className="flex items-center gap-2">
                                    {openFolders.loads ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    {openFolders.loads ? <FolderOpen className="h-5 w-5 text-amber-500" /> : <Folder className="h-5 w-5 text-amber-500" />}
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Loads</span>
                                  </div>
                                  <Badge variant="secondary">{totalLoadDocs} docs in {loadIds.length} loads</Badge>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="ml-6 mt-1 border-l-2 border-muted pl-4 space-y-2">
                                  {sortedLoadIds.length > 0 ? (
                                    sortedLoadIds.map(loadId => {
                                      const docs = loadDocs[loadId];
                                      const loadInfo = loadInfoMap[loadId];
                                      const loadNum = loadInfo?.loadNumber || 0;
                                      const loadStatus = loadInfo?.status || '';
                                      const isOpen = openFolders[`load-${loadId}`] || false;
                                      return (
                                        <Collapsible key={loadId} open={isOpen} onOpenChange={() => toggleFolder(`load-${loadId}`)}>
                                          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/30 hover-elevate" data-testid={`folder-load-${loadId}`}>
                                            <div className="flex items-center gap-2">
                                              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                              <Folder className="h-4 w-4 text-blue-500" />
                                              <span className="text-sm font-medium">LD-{String(loadNum).padStart(3, '0')}</span>
                                              {loadStatus && getStatusBadge(loadStatus)}
                                            </div>
                                            <Badge variant="outline" className="text-xs">{docs.length} doc{docs.length !== 1 ? 's' : ''}</Badge>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="ml-4 mt-1 border-l border-muted pl-3">
                                            <div className="bg-background rounded-lg border">
                                              {docs.map(doc => renderDocumentRow(doc, false))}
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      );
                                    })
                                  ) : (
                                    <p className="text-sm text-muted-foreground py-2">No load documents</p>
                                  )}
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Desktop: Normal vertical layout */}
                    <div className="hidden sm:block space-y-2">
                      {/* Truck Documents Folder */}
                      <Collapsible open={openFolders.truck} onOpenChange={() => toggleFolder('truck')}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover-elevate" data-testid="folder-truck-documents">
                          <div className="flex items-center gap-2">
                            {openFolders.truck ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {openFolders.truck ? <FolderOpen className="h-5 w-5 text-amber-500" /> : <Folder className="h-5 w-5 text-amber-500" />}
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Truck Documents</span>
                          </div>
                          <Badge variant="secondary">{truck.length}</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="ml-6 mt-1 border-l-2 border-muted pl-4">
                          {truck.length > 0 ? (
                            <div className="bg-muted/30 rounded-lg">
                              {truck.map(doc => renderDocumentRow(doc, true))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">No truck documents</p>
                          )}
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Driver Documents Folder */}
                      <Collapsible open={openFolders.driver} onOpenChange={() => toggleFolder('driver')}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover-elevate" data-testid="folder-driver-documents">
                          <div className="flex items-center gap-2">
                            {openFolders.driver ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {openFolders.driver ? <FolderOpen className="h-5 w-5 text-amber-500" /> : <Folder className="h-5 w-5 text-amber-500" />}
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Driver Documents</span>
                          </div>
                          <Badge variant="secondary">{driver.length}</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="ml-6 mt-1 border-l-2 border-muted pl-4">
                          {driver.length > 0 ? (
                            <div className="bg-muted/30 rounded-lg">
                              {driver.map(doc => renderDocumentRow(doc, true))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">No driver documents</p>
                          )}
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Loads Folder */}
                      {(() => {
                        // Build load info map from assignedLoads
                        const loadInfoMap: Record<string, { loadNumber: number; status: string }> = {};
                        if (carrier.assignedLoads) {
                          carrier.assignedLoads.forEach((load: any) => {
                            loadInfoMap[load.id] = {
                              loadNumber: load.shipperLoadNumber || load.adminReferenceNumber || 0,
                              status: load.status || 'unknown',
                            };
                          });
                        }
                        
                        // Sort load IDs by load number descending
                        const sortedLoadIds = [...loadIds].sort((a, b) => {
                          const numA = loadInfoMap[a]?.loadNumber || 0;
                          const numB = loadInfoMap[b]?.loadNumber || 0;
                          return numB - numA;
                        });

                        const getStatusBadge = (status: string) => {
                          const statusLabels: Record<string, string> = {
                            delivered: "Delivered",
                            in_transit: "In Transit",
                            pickup_scheduled: "Pickup Scheduled",
                            awarded: "Awarded",
                            invoice_sent: "Invoice Sent",
                            invoice_paid: "Invoice Paid",
                            closed: "Closed",
                          };
                          const label = statusLabels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                          return <Badge variant="outline" className="text-xs ml-2">{label}</Badge>;
                        };

                        return (
                          <Collapsible open={openFolders.loads} onOpenChange={() => toggleFolder('loads')}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover-elevate" data-testid="folder-loads">
                              <div className="flex items-center gap-2">
                                {openFolders.loads ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                {openFolders.loads ? <FolderOpen className="h-5 w-5 text-amber-500" /> : <Folder className="h-5 w-5 text-amber-500" />}
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Loads</span>
                              </div>
                              <Badge variant="secondary">{totalLoadDocs} docs in {loadIds.length} loads</Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="ml-6 mt-1 border-l-2 border-muted pl-4 space-y-2">
                              {sortedLoadIds.length > 0 ? (
                                sortedLoadIds.map(loadId => {
                                  const docs = loadDocs[loadId];
                                  const loadInfo = loadInfoMap[loadId];
                                  const loadNum = loadInfo?.loadNumber || 0;
                                  const loadStatus = loadInfo?.status || '';
                                  const isOpen = openFolders[`load-${loadId}`] || false;
                                  return (
                                    <Collapsible key={loadId} open={isOpen} onOpenChange={() => toggleFolder(`load-${loadId}`)}>
                                      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/30 hover-elevate" data-testid={`folder-load-${loadId}`}>
                                        <div className="flex items-center gap-2">
                                          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                          <Folder className="h-4 w-4 text-blue-500" />
                                          <span className="text-sm font-medium">LD-{String(loadNum).padStart(3, '0')}</span>
                                          {loadStatus && getStatusBadge(loadStatus)}
                                        </div>
                                        <Badge variant="outline" className="text-xs">{docs.length} doc{docs.length !== 1 ? 's' : ''}</Badge>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="ml-4 mt-1 border-l border-muted pl-3">
                                        <div className="bg-background rounded-lg border">
                                          {docs.map(doc => renderDocumentRow(doc, false))}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  );
                                })
                              ) : (
                                <p className="text-sm text-muted-foreground py-2">No load documents</p>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              );
            })()
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents uploaded yet</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Document Preview Dialog */}
      <Dialog open={documentPreviewOpen} onOpenChange={setDocumentPreviewOpen}>
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

              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Document Preview Section - Takes available space */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  <div className="w-full h-full rounded-lg border bg-muted/30">
                    <div className="h-full min-h-[300px]">
                      {(() => {
                        const fileUrl = selectedDocument.fileUrl || "";
                        if (!fileUrl) {
                          return (
                            <div className="text-center text-muted-foreground p-4">
                              <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">Document Preview</p>
                              <p className="text-xs">{selectedDocument.fileName}</p>
                            </div>
                          );
                        }
                        const lowerUrl = fileUrl.toLowerCase();
                        const fromNameRaw = (selectedDocument.fileName.split(".").pop() || "").toLowerCase();
                        const fromName = fromNameRaw.length <= 5 ? fromNameRaw : "";
                        const fromUrl = (lowerUrl.split("?")[0].split("/").pop() || "").split(".").pop() || "";
                        const ext = fromName || fromUrl;
                        const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif"];
                        const isPdf = ext === "pdf" || lowerUrl.endsWith(".pdf");
                        const isImage =
                          imageExts.includes(ext) ||
                          lowerUrl.endsWith(".png") ||
                          lowerUrl.endsWith(".jpg") ||
                          lowerUrl.endsWith(".jpeg") ||
                          lowerUrl.endsWith(".heic") ||
                          lowerUrl.endsWith(".heif") ||
                          lowerUrl.startsWith("data:image/") ||
                          lowerUrl.includes("/assets/generated_images/");

                        // Always route /objects/... through the backend origin in prod.
                        const previewUrl = getDocumentUrl(fileUrl) || "";

                        if (isPdf) {
                          return (
                            <div className="w-full h-full">
                              <iframe
                                src={previewUrl}
                                title={selectedDocument.fileName}
                                className="w-full h-full border-0 bg-white"
                                data-testid="document-preview-pdf"
                              />
                            </div>
                          );
                        }

                        if (isImage) {
                          return (
                            <div className="w-full h-full flex items-center justify-center">
                              <img
                                src={previewUrl}
                                alt={selectedDocument.fileName}
                                className="max-w-full max-h-full object-contain"
                                data-testid="img-document-preview"
                              />
                            </div>
                          );
                        }

                        return (
                          <div className="text-center text-muted-foreground p-4">
                            <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Document Preview</p>
                            <p className="text-xs">{selectedDocument.fileName}</p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Document Information Section - Fixed at bottom */}
                <div className="flex-shrink-0 border-t pt-4 mt-4">
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
              </div>

              <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2">
                {!selectedDocument.isVerified && (
                  <>
                    <Button 
                      variant="destructive" 
                      onClick={() => documentVerifyMutation.mutate({ documentId: selectedDocument.id, isVerified: false })}
                      disabled={documentVerifyMutation.isPending}
                      data-testid="button-reject-document-dialog"
                    >
                      {documentVerifyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Reject
                    </Button>
                    <Button 
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => documentVerifyMutation.mutate({ documentId: selectedDocument.id, isVerified: true })}
                      disabled={documentVerifyMutation.isPending}
                      data-testid="button-approve-document-dialog"
                    >
                      {documentVerifyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Verify
                    </Button>
                  </>
                )}
                <div className="flex-1" />
                <Button
                  variant="outline"
                  onClick={() => {
                        const fileUrl = selectedDocument.fileUrl || "";
                        const url = getDocumentUrl(fileUrl);
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
                        const fileUrl = selectedDocument.fileUrl || "";
                        const url = getDocumentUrl(fileUrl);
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
