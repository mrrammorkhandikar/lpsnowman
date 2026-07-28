import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpload } from "@/hooks/use-upload";
import { 
  Truck, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Calendar,
  MapPin,
  Package,
  Clock,
  Upload,
  Plus,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Pencil
} from "lucide-react";
import { useLocation } from "wouter";
import { format, differenceInDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { indianTruckTypes } from "@shared/schema";
import { indianTruckManufacturers, getModelsByManufacturer, TruckManufacturer } from "@shared/indian-truck-data";
import { indianStates } from "@shared/indian-locations";

interface DocumentAlert {
  documentId: string;
  documentType: string;
  fileName: string;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
  isExpired: boolean;
}

interface TruckData {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity: number;
  capacityUnit: string;
  isAvailable: boolean;
  currentLocation: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  city: string | null;
  registrationDate: string | null;
}

interface TruckDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  expiryDate: string | null;
  isVerified: boolean;
}

const documentTypeLabels: Record<string, string> = {
  rc: "Registration Certificate (RC)",
  insurance: "Vehicle Insurance",
  fitness: "Fitness Certificate",
  license: "Driving License",
  puc: "PUC Certificate",
  permit: "Road Permit",
  other: "Other Document",
};

const getExpiryBadge = (expiryDate: string | null) => {
  if (!expiryDate) return null;
  
  const days = differenceInDays(new Date(expiryDate), new Date());
  
  if (days < 0) {
    return <Badge variant="destructive">Expired</Badge>;
  } else if (days <= 7) {
    return <Badge variant="destructive">Expires in {days} days</Badge>;
  } else if (days <= 30) {
    return <Badge className="bg-amber-500 text-white">Expires in {days} days</Badge>;
  } else {
    return <Badge variant="secondary">Valid until {format(new Date(expiryDate), "dd MMM yyyy")}</Badge>;
  }
};

// Sorted manufacturers for dropdown
const sortedManufacturers = [...indianTruckManufacturers].sort((a, b) => a.name.localeCompare(b.name));

// Generate year options from 2000 to current year
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: currentYear - 1999 }, (_, i) => currentYear - i);

// Sorted states for dropdown
const sortedStates = [...indianStates].sort((a, b) => a.name.localeCompare(b.name));

export default function MyTruckPage() {
  const { user, carrierType } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    licensePlate: "",
    truckType: "",
    capacity: "",
    capacityUnit: "tons",
    locationState: "",
    locationCity: "",
    manufacturerId: "",
    model: "",
    year: "",
    city: "",
    registrationDate: ""
  });
  const [selectedDocType, setSelectedDocType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docExpiryDate, setDocExpiryDate] = useState("");
  const { uploadFile, isUploading: isStorageUploading } = useUpload({
    onError: (err) => {
      console.error("Upload error:", err);
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get cities for selected location state
  const availableLocationCities = editForm.locationState 
    ? sortedStates.find(s => s.code === editForm.locationState)?.cities || []
    : [];

  // Get available models based on selected manufacturer
  const availableModels = editForm.manufacturerId 
    ? getModelsByManufacturer(editForm.manufacturerId) 
    : [];

  const { data, isLoading, error, refetch } = useQuery<{
    truck: TruckData | null;
    documents: TruckDocument[];
    documentAlerts: DocumentAlert[];
  }>({
    queryKey: ["/api/carrier/solo/truck"],
    enabled: !!user && user.role === "carrier" && carrierType === "solo",
  });

  const updateTruckMutation = useMutation({
    mutationFn: async (truckData: Partial<TruckData> & { truckId: string }) => {
      const { truckId, ...rest } = truckData;
      return apiRequest("PATCH", `/api/carrier/truck/${truckId}`, rest);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/solo/truck"] });
      setEditDialogOpen(false);
      toast({ title: "Truck Updated", description: "Your truck information has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update truck info.", variant: "destructive" });
    }
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (docData: { documentType: string; fileName: string; fileUrl: string; fileSize: number; expiryDate: string | null; truckId: string }) => {
      return apiRequest("POST", "/api/carrier/documents", docData);
    },
    onSuccess: () => {
      toast({ title: "Document Uploaded", description: "Document has been uploaded successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/solo/truck"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents/expiring"] });
      setSelectedDocType("");
      setSelectedFile(null);
      setDocExpiryDate("");
    },
    onError: () => {
      toast({ title: "Upload Failed", description: "Failed to upload document. Please try again.", variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      return apiRequest("DELETE", `/api/carrier/documents/${docId}`);
    },
    onSuccess: () => {
      toast({ title: "Document Deleted", description: "Document has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/solo/truck"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents/expiring"] });
    },
    onError: () => {
      toast({ title: "Delete Failed", description: "Failed to delete document.", variant: "destructive" });
    },
  });

  const handleDocUpload = async () => {
    const { truck } = data || {};
    if (!truck || !selectedDocType || !selectedFile) {
      toast({ title: "Missing Info", description: "Please select document type and file.", variant: "destructive" });
      return;
    }
    const response = await uploadFile(selectedFile);
    if (!response) return;
    uploadDocMutation.mutate({
      documentType: selectedDocType,
      fileName: selectedFile.name,
      fileUrl: response.objectPath,
      fileSize: selectedFile.size,
      expiryDate: docExpiryDate || null,
      truckId: truck.id,
    });
  };

  const openEditDialog = (truck: TruckData) => {
    // Find manufacturer ID from saved make name
    const manufacturer = indianTruckManufacturers.find((m: TruckManufacturer) => m.name === truck.make);
    
    // Parse location from "City, State" format
    let locationState = "";
    let locationCity = "";
    const currentLoc = truck.currentLocation || "";
    if (currentLoc.includes(",")) {
      const [city, stateName] = currentLoc.split(",").map(s => s.trim());
      const foundState = sortedStates.find(s => s.name === stateName);
      if (foundState) {
        locationState = foundState.code;
        locationCity = city;
      }
    }
    
    setEditForm({
      licensePlate: truck.licensePlate || "",
      truckType: truck.truckType || "",
      capacity: String(truck.capacity || ""),
      capacityUnit: truck.capacityUnit || "tons",
      locationState,
      locationCity,
      manufacturerId: manufacturer?.id || "",
      model: truck.model || "",
      year: truck.year ? String(truck.year) : "",
      city: truck.city || "",
      registrationDate: truck.registrationDate ? truck.registrationDate.split("T")[0] : ""
    });
    setEditDialogOpen(true);
  };

  const handleSaveTruck = () => {
    const { truck } = data || {};
    if (!truck) return;
    
    // Convert manufacturerId to make name for backend
    const manufacturer = indianTruckManufacturers.find((m: TruckManufacturer) => m.id === editForm.manufacturerId);
    
    // Build current location from state and city
    let currentLocation: string | null = null;
    if (editForm.locationState && editForm.locationCity) {
      const stateName = sortedStates.find(s => s.code === editForm.locationState)?.name || "";
      currentLocation = `${editForm.locationCity}, ${stateName}`;
    }
    
    updateTruckMutation.mutate({
      truckId: truck.id,
      licensePlate: editForm.licensePlate,
      truckType: editForm.truckType,
      capacity: parseInt(editForm.capacity) || 0,
      capacityUnit: editForm.capacityUnit,
      currentLocation,
      make: manufacturer?.name || null,
      model: editForm.model || null,
      year: editForm.year ? parseInt(editForm.year) : null,
      city: editForm.city || null,
      registrationDate: editForm.registrationDate || null
    });
  };

  if (carrierType === undefined) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" data-testid="skeleton-title" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" data-testid="skeleton-card-1" />
          <Skeleton className="h-64" data-testid="skeleton-card-2" />
        </div>
      </div>
    );
  }

  if (carrierType !== "solo") {
    return (
      <div className="p-6">
        <Alert data-testid="alert-access-restricted">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>This page is only available for solo carriers.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" data-testid="skeleton-title" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" data-testid="skeleton-card-1" />
          <Skeleton className="h-64" data-testid="skeleton-card-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load truck information. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { truck, documents, documentAlerts } = data || { truck: null, documents: [], documentAlerts: [] };

  if (!truck) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">My Truck</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Truck Registered</h3>
            <p className="text-muted-foreground text-center mb-4">
              Register your truck to start accepting loads
            </p>
            <Button onClick={() => navigate("/carrier/add-truck")} data-testid="button-add-truck">
              <Plus className="h-4 w-4 mr-2" />
              Add Your Truck
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiredCount = documentAlerts.filter(a => a.isExpired).length;
  const expiringSoonCount = documentAlerts.filter(a => !a.isExpired).length;

  // Determine compliance status: green, amber, or red
  const getComplianceStatus = () => {
    if (expiredCount > 0) {
      return {
        status: "red" as const,
        icon: ShieldX,
        title: "Compliance Blocked",
        description: "You cannot bid on loads or start trips until expired documents are renewed.",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
      };
    } else if (expiringSoonCount > 0) {
      return {
        status: "amber" as const,
        icon: ShieldAlert,
        title: "Documents Expiring Soon",
        description: "Some documents will expire soon. Renew them to avoid bidding restrictions.",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
      };
    } else {
      return {
        status: "green" as const,
        icon: ShieldCheck,
        title: "Fully Compliant",
        description: "All your documents are valid. You can bid on loads and start trips.",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
      };
    }
  };

  const compliance = getComplianceStatus();
  const ComplianceIcon = compliance.icon;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">My Truck</h1>
        <Button variant="outline" onClick={() => navigate("/carrier/my-documents")} data-testid="button-manage-documents" className="w-full sm:w-auto">
          <FileText className="h-4 w-4 mr-2" />
          Manage Documents
        </Button>
      </div>

      {/* Compliance Status Indicator */}
      <Card className={`border ${compliance.bgColor}`} data-testid="card-compliance-status">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 py-3 sm:py-4">
          <div className={`p-2 sm:p-3 rounded-full shrink-0 ${compliance.status === 'red' ? 'bg-red-100 dark:bg-red-900' : compliance.status === 'amber' ? 'bg-amber-100 dark:bg-amber-900' : 'bg-green-100 dark:bg-green-900'}`}>
            <ComplianceIcon className={`h-6 w-6 sm:h-8 sm:w-8 ${compliance.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm sm:text-base ${compliance.color}`} data-testid="text-compliance-title">
              {compliance.title}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground" data-testid="text-compliance-description">
              {compliance.description}
            </p>
          </div>
          {compliance.status !== "green" && (
            <Button 
              variant={compliance.status === "red" ? "destructive" : "outline"}
              onClick={() => navigate("/carrier/my-documents")}
              data-testid="button-fix-compliance"
              size="sm"
              className="w-full sm:w-auto shrink-0"
            >
              {compliance.status === "red" ? "Fix Now" : "Review Documents"}
            </Button>
          )}
        </CardContent>
      </Card>

      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <Alert variant={expiredCount > 0 ? "destructive" : "default"} className={expiredCount === 0 ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : ""}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {expiredCount > 0 ? "Documents Expired!" : "Documents Expiring Soon"}
          </AlertTitle>
          <AlertDescription>
            {expiredCount > 0 && `${expiredCount} document(s) have expired. `}
            {expiringSoonCount > 0 && `${expiringSoonCount} document(s) are expiring within 30 days.`}
            <Button 
              variant="ghost" 
              className="p-0 h-auto ml-2 underline" 
              onClick={() => navigate("/carrier/my-documents")}
              data-testid="link-view-alerts"
            >
              View details
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="truncate">Vehicle Details</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Your registered truck information</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openEditDialog(truck)}
              data-testid="button-edit-truck"
              className="w-full sm:w-auto shrink-0"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">License Plate</p>
                <p className="font-semibold text-sm sm:text-base truncate" data-testid="text-license-plate">{truck.licensePlate}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Truck Type</p>
                <p className="font-medium text-sm sm:text-base truncate" data-testid="text-truck-type">
                  {indianTruckTypes.find(t => t.value === truck.truckType)?.label || truck.truckType}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Capacity</p>
                <p className="font-medium text-sm sm:text-base" data-testid="text-capacity">{truck.capacity} {truck.capacityUnit}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
                <Badge variant={truck.isAvailable ? "default" : "secondary"} data-testid="badge-status" className="text-xs">
                  {truck.isAvailable ? "Available" : "On Trip"}
                </Badge>
              </div>
              {truck.make && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Make</p>
                  <p className="font-medium text-sm sm:text-base truncate" data-testid="text-make">{truck.make}</p>
                </div>
              )}
              {truck.model && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Model</p>
                  <p className="font-medium text-sm sm:text-base truncate" data-testid="text-model">{truck.model}</p>
                </div>
              )}
              {truck.year && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Year</p>
                  <p className="font-medium text-sm sm:text-base" data-testid="text-year">{truck.year}</p>
                </div>
              )}
              {truck.city && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">City</p>
                  <p className="font-medium text-sm sm:text-base truncate" data-testid="text-city">{truck.city}</p>
                </div>
              )}
              {truck.registrationDate && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Reg. Date</p>
                  <p className="font-medium text-sm sm:text-base" data-testid="text-reg-date">
                    {format(new Date(truck.registrationDate), "dd MMM yyyy")}
                  </p>
                </div>
              )}
            </div>
            {truck.currentLocation && (
              <div className="pt-3 sm:pt-4 border-t">
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                  Current Location
                </p>
                <p className="font-medium text-sm sm:text-base">{truck.currentLocation}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              Document Status
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Track your compliance documents</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="flex flex-col items-center py-6 sm:py-8">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-4">No documents uploaded</p>
                <Button variant="outline" onClick={() => navigate("/carrier/my-documents")} data-testid="button-upload-docs" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Documents
                </Button>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-2 sm:p-3 rounded-lg border gap-2"
                    data-testid={`card-document-${doc.id}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      {doc.isVerified ? (
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs sm:text-sm truncate">
                          {documentTypeLabels[doc.documentType] || doc.documentType}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {getExpiryBadge(doc.expiryDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {documentAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 text-base sm:text-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              Document Alerts
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Documents requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 sm:space-y-3">
              {documentAlerts.map((alert) => (
                <div 
                  key={alert.documentId}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-lg border gap-3 ${
                    alert.isExpired ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"
                  }`}
                  data-testid={`alert-document-${alert.documentId}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {alert.isExpired ? (
                      <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">
                        {documentTypeLabels[alert.documentType] || alert.documentType}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {alert.isExpired 
                          ? `Expired ${Math.abs(alert.daysUntilExpiry || 0)} days ago` 
                          : `Expires in ${alert.daysUntilExpiry} days`}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant={alert.isExpired ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => navigate("/carrier/my-documents")}
                    data-testid={`button-renew-${alert.documentId}`}
                    className="w-full sm:w-auto shrink-0"
                  >
                    {alert.isExpired ? "Renew Now" : "Update"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Truck Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Edit Truck Information</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Update your truck details below</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Truck Details</TabsTrigger>
              <TabsTrigger value="documents" className="flex-1">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
          <div className="space-y-3 sm:space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="licensePlate" className="text-sm">License Plate / Truck Number</Label>
                <Input 
                  id="licensePlate"
                  value={editForm.licensePlate}
                  onChange={(e) => setEditForm({...editForm, licensePlate: e.target.value})}
                  placeholder="MH 12 AB 1234"
                  data-testid="input-license-plate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="truckType" className="text-sm">Truck Type</Label>
                <Select 
                  value={editForm.truckType} 
                  onValueChange={(val) => setEditForm({...editForm, truckType: val})}
                >
                  <SelectTrigger data-testid="select-truck-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {indianTruckTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="make" className="text-sm">Make / Manufacturer</Label>
                <Select 
                  value={editForm.manufacturerId} 
                  onValueChange={(val) => setEditForm({...editForm, manufacturerId: val, model: ""})}
                >
                  <SelectTrigger data-testid="select-make">
                    <SelectValue placeholder="Select make" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedManufacturers.map((mfr) => (
                      <SelectItem key={mfr.id} value={mfr.id}>{mfr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model" className="text-sm">Model</Label>
                <Select 
                  value={editForm.model} 
                  onValueChange={(val) => setEditForm({...editForm, model: val})}
                  disabled={!editForm.manufacturerId}
                >
                  <SelectTrigger data-testid="select-model">
                    <SelectValue placeholder={editForm.manufacturerId ? "Select model" : "Select make first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        {model.name} ({model.capacityRange})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="year" className="text-sm">Year of Manufacture</Label>
                <Select 
                  value={editForm.year} 
                  onValueChange={(val) => setEditForm({...editForm, year: val})}
                >
                  <SelectTrigger data-testid="select-year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity" className="text-sm">Capacity (tons) <span className="text-xs text-muted-foreground font-normal">(e.g. 22)</span></Label>
                <Input 
                  id="capacity"
                  type="number"
                  value={editForm.capacity}
                  onChange={(e) => setEditForm({...editForm, capacity: e.target.value})}
                  placeholder=""
                  data-testid="input-capacity"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm">Registration City <span className="text-xs text-muted-foreground font-normal">(e.g. Ludhiana)</span></Label>
                <Input 
                  id="city"
                  value={editForm.city}
                  onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                  placeholder=""
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationDate" className="text-sm">Registration Date</Label>
                <Input 
                  id="registrationDate"
                  type="date"
                  value={editForm.registrationDate}
                  onChange={(e) => setEditForm({...editForm, registrationDate: e.target.value})}
                  data-testid="input-registration-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Current Location</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Select 
                  value={editForm.locationState} 
                  onValueChange={(val) => setEditForm({...editForm, locationState: val, locationCity: ""})}
                >
                  <SelectTrigger data-testid="select-location-state">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedStates.map((state) => (
                      <SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={editForm.locationCity} 
                  onValueChange={(val) => setEditForm({...editForm, locationCity: val})}
                  disabled={!editForm.locationState}
                >
                  <SelectTrigger data-testid="select-location-city">
                    <SelectValue placeholder={editForm.locationState ? "Select city" : "Select state first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLocationCities.map((city) => (
                      <SelectItem key={city.name} value={city.name}>
                        {city.name}{city.isMetro && " (Metro)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTruck} 
              disabled={updateTruckMutation.isPending}
              data-testid="button-save-truck"
            >
              {updateTruckMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
            </TabsContent>

            <TabsContent value="documents">
              <div className="space-y-4 py-4">
                {/* Existing documents */}
                {documents && documents.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Uploaded Documents</Label>
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg border gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {doc.isVerified ? (
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{documentTypeLabels[doc.documentType] || doc.documentType}</p>
                            <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {getExpiryBadge(doc.expiryDate)}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteDocMutation.mutate(doc.id)}
                            disabled={deleteDocMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload new document */}
                <div className="space-y-3 border-t pt-3">
                  <Label className="text-sm font-medium">Upload New Document</Label>
                  <div className="space-y-2">
                    <Label htmlFor="docType" className="text-xs">Document Type</Label>
                    <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(documentTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docExpiry" className="text-xs">Expiry Date (optional)</Label>
                    <Input
                      id="docExpiry"
                      type="date"
                      value={docExpiryDate}
                      onChange={(e) => setDocExpiryDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docFile" className="text-xs">File</Label>
                    <Input
                      id="docFile"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleDocUpload}
                    disabled={!selectedDocType || !selectedFile || isStorageUploading || uploadDocMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isStorageUploading || uploadDocMutation.isPending ? "Uploading..." : "Upload Document"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
