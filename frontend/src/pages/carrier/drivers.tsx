import { useCallback, useState } from "react";
import { 
  User, Phone, AlertTriangle, Plus, Search, Calendar, 
  Trash2, Pencil, Loader2, CheckCircle, XCircle, Truck, FileText, CreditCard, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentUploadWithCamera } from "@/components/DocumentUploadWithCamera";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Driver } from "@shared/schema";
import { format, differenceInDays } from "date-fns";

type CarrierDriver = Driver & {
  canDelete?: boolean;
  deleteBlockReason?: string | null;
  hasTripHistory?: boolean;
};

const driverFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone must be at least 10 digits"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional(),
  licenseImageUrl: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  aadhaarImageUrl: z.string().optional(),
  status: z.enum(["available", "on_trip", "inactive"]).default("available"),
});

type DriverFormData = z.infer<typeof driverFormSchema>;

function getStatusBadge(status: string) {
  switch (status) {
    case "available":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "on_trip":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "inactive":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "available":
      return "Available";
    case "on_trip":
      return "On Trip";
    case "inactive":
      return "Inactive";
    default:
      return status;
  }
}

export default function CarrierDriversPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<CarrierDriver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<CarrierDriver | null>(null);

  const { data: drivers = [], isLoading } = useQuery<CarrierDriver[]>({
    queryKey: ["/api/drivers"],
  });

  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      licenseNumber: "",
      licenseExpiry: "",
      licenseImageUrl: "",
      aadhaarNumber: "",
      aadhaarImageUrl: "",
      status: "available",
    },
  });

  const [isAadhaarVerifying, setIsAadhaarVerifying] = useState(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [isAadhaarOcrRunning, setIsAadhaarOcrRunning] = useState(false);
  const [aadhaarOcrError, setAadhaarOcrError] = useState<string | null>(null);
  const [isAadhaarDocVerifying, setIsAadhaarDocVerifying] = useState(false);
  const [aadhaarDocVerified, setAadhaarDocVerified] = useState(false);
  const [aadhaarDocError, setAadhaarDocError] = useState<string | null>(null);

  const [isLicenseVerifying, setIsLicenseVerifying] = useState(false);
  const [licenseVerified, setLicenseVerified] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [isLicenseOcrRunning, setIsLicenseOcrRunning] = useState(false);
  const [licenseOcrError, setLicenseOcrError] = useState<string | null>(null);

  const { data: kycConfig } = useQuery<{ surepassAllowProxy: boolean }>({
    queryKey: ["/api/kyc/config"],
  });

  const verifyAadhaarNumber = useCallback(async (value: string) => {
    const trimmed = value.replace(/\s+/g, "");
    setAadhaarVerified(false);
    setAadhaarError(null);
    if (!trimmed) return;

    const useLocalValidationOnly = kycConfig?.surepassAllowProxy !== false;
    if (useLocalValidationOnly) {
      if (trimmed.length !== 12 || !/^\d+$/.test(trimmed) || trimmed.startsWith("0")) {
        setAadhaarError("Please enter a valid 12-digit Aadhaar number.");
        return;
      }
      setAadhaarVerified(true);
      return;
    }

    if (!/^\d{12}$/.test(trimmed) || trimmed.startsWith("0")) {
      setAadhaarError("Aadhaar is invalid.");
      return;
    }

    setIsAadhaarVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/aadhaar-validation", {
        aadhaar_number: trimmed,
        request_ref: "carrier_driver_aadhaar",
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        setAadhaarError(payload?.message || "Aadhaar could not be verified.");
        return;
      }
      setAadhaarVerified(true);
    } catch {
      setAadhaarError("Aadhaar verification failed. Please try again.");
    } finally {
      setIsAadhaarVerifying(false);
    }
  }, [kycConfig?.surepassAllowProxy]);

  const verifyDrivingLicenseNumber = useCallback(async (licenseValue: string, dobValue: string) => {
    const license = licenseValue.replace(/\s+/g, "").toUpperCase();
    const dob = (dobValue || "").trim();
    setLicenseVerified(false);
    setLicenseError(null);
    if (!license) return;
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setLicenseError("DOB could not be read from document. License will be reviewed by admin.");
      return;
    }

    const useLocalValidationOnly = kycConfig?.surepassAllowProxy !== false;
    if (useLocalValidationOnly) {
      if (license.length < 8) {
        setLicenseError("Please enter a valid driving license number.");
        return;
      }
      setLicenseVerified(true);
      return;
    }

    setIsLicenseVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/driving-license", {
        id_number: license,
        dob,
        request_ref: "carrier_driver_driving_license",
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        setLicenseError(payload?.message || "Driving license could not be verified.");
        return;
      }
      setLicenseVerified(true);
    } catch {
      setLicenseError("Driving license verification failed. Will be reviewed by admin.");
    } finally {
      setIsLicenseVerifying(false);
    }
  }, [kycConfig?.surepassAllowProxy]);

  const handleAadhaarFile = useCallback(async (file: File) => {
    setIsAadhaarOcrRunning(true);
    setAadhaarOcrError(null);
    setAadhaarDocVerified(false);
    setAadhaarDocError(null);
    try {
      const { extractPdfFirstPageText, prepareFileForTesseract } = await import(
        "@/lib/prepare-file-for-tesseract"
      );
      const { extractAadhaarFromOcrThenPdf } = await import(
        "@/lib/extract-aadhaar-from-text"
      );
      const pdfText = await extractPdfFirstPageText(file);
      const ocrSource = await prepareFileForTesseract(file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(ocrSource);
      await worker.terminate();

      const digits = extractAadhaarFromOcrThenPdf(text, pdfText);
      if (!digits || digits.length !== 12) {
        setAadhaarOcrError("Aadhaar number could not be read. Please enter it manually.");
        return;
      }

      form.setValue("aadhaarNumber", digits, { shouldValidate: true, shouldDirty: true });
      toast({
        title: "Aadhaar extracted",
        description: `Aadhaar: XXXX XXXX ${digits.slice(8)}`,
      });

      setIsAadhaarDocVerifying(true);
      try {
        const res = await apiRequest("POST", "/api/kyc/aadhaar-validation", {
          aadhaar_number: digits,
          request_ref: "carrier_driver_aadhaar_doc",
        });
        const payload = await res.json();
        if (!res.ok || !payload?.success) {
          setAadhaarDocError(payload?.message || "Aadhaar could not be verified.");
        } else {
          setAadhaarDocVerified(true);
        }
      } catch {
        setAadhaarDocError("Aadhaar verification failed. Will be reviewed by admin.");
      } finally {
        setIsAadhaarDocVerifying(false);
      }
    } catch (err) {
      console.error("Aadhaar OCR error:", err);
      setAadhaarOcrError("Could not read document. Please enter Aadhaar number manually.");
    } finally {
      setIsAadhaarOcrRunning(false);
    }
  }, [form, toast]);

  const handleLicenseFile = useCallback(async (file: File) => {
    setIsLicenseOcrRunning(true);
    setLicenseOcrError(null);
    setLicenseVerified(false);
    setLicenseError(null);
    try {
      const { prepareFileForTesseract } = await import("@/lib/prepare-file-for-tesseract");
      const ocrSource = await prepareFileForTesseract(file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(ocrSource);
      await worker.terminate();

      const normalized = text.replace(/[\n\r]/g, " ").toUpperCase();
      const compact = normalized.replace(/\s+/g, "");
      const dl =
        compact.match(/[A-Z]{2}\d{2}\d{11}/)?.[0] ||
        compact.match(/[A-Z]{2}\d{13}/)?.[0] ||
        compact.match(/[A-Z]{2}\d{2}[A-Z0-9]{8,14}/)?.[0] ||
        "";

      const toIsoDate = (raw: string): string | null => {
        const token = raw.replace(/[.]/g, "-").replace(/\//g, "-").trim();
        const ymd = token.match(/^((19|20)\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/);
        if (ymd) return `${ymd[1]}-${ymd[3]}-${ymd[4]}`;
        const dmy = token.match(/^([0-2]\d|3[01])-(0[1-9]|1[0-2])-((19|20)\d{2})$/);
        if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
        return null;
      };

      const dobMatch =
        normalized.match(/(?:DOB|DATE\s*OF\s*BIRTH)[^\d]*((?:[0-2]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:19|20)\d{2})/i)?.[1] ||
        normalized.match(/(?:DOB|DATE\s*OF\s*BIRTH)[^\d]*((?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:[0-2]\d|3[01]))/i)?.[1] ||
        "";
      const dob = dobMatch ? toIsoDate(dobMatch) || "" : "";

      if (!dl) {
        setLicenseOcrError("Driving license number could not be read. Please enter it manually.");
        return;
      }

      form.setValue("licenseNumber", dl, { shouldValidate: true, shouldDirty: true });
      toast({
        title: "License extracted",
        description: dob ? `DL: ${dl}, DOB: ${dob}` : `DL: ${dl}. DOB not detected.`,
      });

      if (dob) {
        await verifyDrivingLicenseNumber(dl, dob);
      }
    } catch (err) {
      console.error("License OCR error:", err);
      setLicenseOcrError("Could not read license image. Please enter number manually.");
    } finally {
      setIsLicenseOcrRunning(false);
    }
  }, [form, toast, verifyDrivingLicenseNumber]);

  const createDriverMutation = useMutation({
    mutationFn: async (data: DriverFormData) => {
      return apiRequest("POST", "/api/drivers", {
        ...data,
        licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry).toISOString() : null,
        email: data.email || null,
        licenseImageUrl: data.licenseImageUrl || null,
        aadhaarNumber: data.aadhaarNumber || null,
        aadhaarImageUrl: data.aadhaarImageUrl || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Driver added successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents/expiring"] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add driver", variant: "destructive" });
    },
  });

  const updateDriverMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DriverFormData> }) => {
      return apiRequest("PATCH", `/api/drivers/${id}`, {
        ...data,
        licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry).toISOString() : undefined,
        licenseImageUrl: data.licenseImageUrl || null,
        aadhaarNumber: data.aadhaarNumber || null,
        aadhaarImageUrl: data.aadhaarImageUrl || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Driver updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents/expiring"] });
      setEditingDriver(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update driver", variant: "destructive" });
    },
  });

  const deleteDriverMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/drivers/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Driver removed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setDeletingDriver(null);
    },
    onError: async (error: Error) => {
      const message = error.message.includes(":")
        ? error.message.split(": ").slice(1).join(": ") || "Failed to remove driver"
        : "Failed to remove driver";
      toast({ title: "Cannot remove driver", description: message, variant: "destructive" });
    },
  });

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone.includes(searchQuery) ||
      (driver.licenseNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || driver.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: drivers.length,
    available: drivers.filter(d => d.status === "available").length,
    onTrip: drivers.filter(d => d.status === "on_trip").length,
    inactive: drivers.filter(d => d.status === "inactive").length,
  };

  const expiredLicenses = drivers.filter(d => {
    if (!d.licenseExpiry) return false;
    const daysUntilExpiry = differenceInDays(new Date(d.licenseExpiry), new Date());
    return daysUntilExpiry < 0;
  });

  const expiringLicenses = drivers.filter(d => {
    if (!d.licenseExpiry) return false;
    const daysUntilExpiry = differenceInDays(new Date(d.licenseExpiry), new Date());
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  });

  const getDaysUntilExpiry = (expiryDate: string | Date) => {
    return differenceInDays(new Date(expiryDate), new Date());
  };

  const getExpiryUrgency = (daysRemaining: number) => {
    if (daysRemaining < 0) return { color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20", borderColor: "border-red-500", label: "Expired" };
    if (daysRemaining <= 7) return { color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20", borderColor: "border-red-500", label: "Critical" };
    if (daysRemaining <= 15) return { color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-900/20", borderColor: "border-amber-500", label: "Warning" };
    return { color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-900/20", borderColor: "border-amber-500", label: "Expiring Soon" };
  };

  const handleOpenAddDialog = () => {
    form.reset({
      name: "",
      phone: "",
      email: "",
      licenseNumber: "",
      licenseExpiry: "",
      licenseImageUrl: "",
      aadhaarNumber: "",
      aadhaarImageUrl: "",
      status: "available",
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (driver: CarrierDriver) => {
    form.reset({
      name: driver.name,
      phone: driver.phone,
      email: driver.email || "",
      licenseNumber: driver.licenseNumber || "",
      licenseExpiry: driver.licenseExpiry ? format(new Date(driver.licenseExpiry), "yyyy-MM-dd") : "",
      licenseImageUrl: driver.licenseImageUrl || "",
      aadhaarNumber: driver.aadhaarNumber || "",
      aadhaarImageUrl: driver.aadhaarImageUrl || "",
      status: (driver.status as "available" | "on_trip" | "inactive") || "available",
    });
    setEditingDriver(driver);
  };

  const onSubmit = (data: DriverFormData) => {
    if (editingDriver) {
      updateDriverMutation.mutate({ id: editingDriver.id, data });
    } else {
      createDriverMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-drivers-title">Driver Management</h1>
          <p className="text-muted-foreground">Manage your team of {drivers.length} drivers</p>
        </div>
        <Button onClick={handleOpenAddDialog} data-testid="button-add-driver">
          <Plus className="h-4 w-4 mr-2" />
          Add Driver
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Drivers"
          value={stats.total}
          icon={User}
          subtitle="In your team"
          testId="stat-total-drivers"
        />
        <StatCard
          title="Available"
          value={stats.available}
          icon={CheckCircle}
          subtitle="Ready for dispatch"
          testId="stat-available-drivers"
        />
        <StatCard
          title="On Trip"
          value={stats.onTrip}
          icon={Truck}
          subtitle="Currently driving"
          testId="stat-on-trip-drivers"
        />
        <StatCard
          title="Inactive"
          value={stats.inactive}
          icon={XCircle}
          subtitle="Off duty"
          testId="stat-inactive-drivers"
        />
      </div>

      {(expiredLicenses.length > 0 || expiringLicenses.length > 0) && (
        <Card className={expiredLicenses.length > 0 ? "border-red-500" : "border-amber-500"}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-base flex items-center gap-2 ${expiredLicenses.length > 0 ? "text-red-600" : "text-amber-600"}`}>
              <AlertTriangle className="h-5 w-5" />
              License Expiry Alerts ({expiredLicenses.length + expiringLicenses.length})
            </CardTitle>
            <CardDescription>
              {expiredLicenses.length > 0 
                ? `${expiredLicenses.length} driver(s) have expired licenses requiring immediate attention`
                : "Please review and renew licenses before they expire"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {expiredLicenses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  Expired Licenses ({expiredLicenses.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {expiredLicenses.map(driver => {
                    const daysExpired = Math.abs(getDaysUntilExpiry(driver.licenseExpiry!));
                    return (
                      <Badge 
                        key={driver.id} 
                        variant="destructive"
                        className="no-default-hover-elevate no-default-active-elevate"
                      >
                        {driver.name} - Expired {daysExpired} {daysExpired === 1 ? "day" : "days"} ago
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            {expiringLicenses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Expiring Soon ({expiringLicenses.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {expiringLicenses.map(driver => {
                    const daysRemaining = getDaysUntilExpiry(driver.licenseExpiry!);
                    const urgency = getExpiryUrgency(daysRemaining);
                    return (
                      <Badge 
                        key={driver.id} 
                        variant="outline" 
                        className={`${urgency.borderColor} ${urgency.color} no-default-hover-elevate no-default-active-elevate`}
                      >
                        {driver.name} - {daysRemaining === 0 ? "Expires today" : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or license..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-driver-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="on_trip">On Trip</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredDrivers.length === 0 ? (
        <EmptyState
          icon={User}
          title={drivers.length === 0 ? "No drivers yet" : "No drivers found"}
          description={drivers.length === 0 
            ? "Add your first driver to start managing your team."
            : "Try adjusting your search or filter criteria."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDrivers.map((driver) => (
            <Card key={driver.id} className="hover-elevate" data-testid={`driver-card-${driver.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{driver.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {driver.phone}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={`${getStatusBadge(driver.status || "available")} no-default-hover-elevate no-default-active-elevate`}>
                    {getStatusLabel(driver.status || "available")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {driver.licenseNumber && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">License:</span>
                    <span>{driver.licenseNumber}</span>
                  </div>
                )}
                {driver.licenseExpiry && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Expires: {format(new Date(driver.licenseExpiry), "MMM d, yyyy")}</span>
                  </div>
                )}
                {driver.aadhaarNumber && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    <span>Aadhaar: {driver.aadhaarNumber}</span>
                  </div>
                )}
                {driver.email && (
                  <div className="text-sm text-muted-foreground truncate">
                    {driver.email}
                  </div>
                )}
                {(driver.licenseImageUrl || driver.aadhaarImageUrl) && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {driver.licenseImageUrl && (
                      <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                        <FileText className="h-3 w-3 mr-1" />
                        License Doc
                      </Badge>
                    )}
                    {driver.aadhaarImageUrl && (
                      <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                        <FileText className="h-3 w-3 mr-1" />
                        Aadhaar Doc
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleOpenEditDialog(driver)}
                    data-testid={`button-edit-driver-${driver.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  {driver.canDelete !== false ? (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeletingDriver(driver)}
                      data-testid={`button-delete-driver-${driver.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  ) : (
                    <span
                      className="text-xs text-muted-foreground self-center px-1"
                      title={driver.deleteBlockReason || undefined}
                    >
                      Trip history — use Inactive
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddDialogOpen || !!editingDriver} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingDriver(null);
          form.reset();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
            <DialogTitle className="text-base sm:text-lg">{editingDriver ? "Edit Driver" : "Add New Driver"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {editingDriver ? "Update driver information and documents" : "Add a new driver to your team with their documents"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Driver name" {...field} data-testid="input-driver-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone number" {...field} data-testid="input-driver-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email address" type="email" {...field} data-testid="input-driver-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="DL-1234567890"
                        {...field}
                        data-testid="input-driver-license"
                      />
                    </FormControl>
                    <FormMessage />
                    {isLicenseVerifying && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Verifying license...
                      </p>
                    )}
                    {!isLicenseVerifying && licenseVerified && !licenseError && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Driving license verified.
                      </p>
                    )}
                    {!isLicenseVerifying && licenseError && (
                      <p className="text-xs text-amber-600 mt-1">{licenseError}</p>
                    )}
                    {!isLicenseVerifying && licenseOcrError && (
                      <p className="text-xs text-amber-600 mt-1">{licenseOcrError}</p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licenseExpiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Expiry Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-driver-license-expiry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licenseImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Image</FormLabel>
                    <FormControl>
                      <DocumentUploadWithCamera
                        value={field.value || ""}
                        onChange={(val) => {
                          field.onChange(val);
                          if (!val) {
                            setLicenseVerified(false);
                            setLicenseError(null);
                            setLicenseOcrError(null);
                          }
                        }}
                        onFile={(file) => {
                          void handleLicenseFile(file);
                        }}
                        placeholder="Upload or capture license image"
                        documentType="driver_license"
                        testId="upload-driver-license-image"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aadhaarNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aadhaar Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="1234-5678-9012"
                        {...field}
                        data-testid="input-driver-aadhaar"
                        onBlur={(e) => {
                          field.onBlur();
                          void verifyAadhaarNumber(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    {isAadhaarVerifying && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Verifying Aadhaar...
                      </p>
                    )}
                    {!isAadhaarVerifying && aadhaarVerified && !aadhaarError && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Aadhaar verified.
                      </p>
                    )}
                    {!isAadhaarVerifying && aadhaarError && (
                      <p className="text-xs text-amber-600 mt-1">{aadhaarError}</p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="aadhaarImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aadhaar Card Image</FormLabel>
                    <FormControl>
                      <DocumentUploadWithCamera
                        value={field.value || ""}
                        onChange={(val) => {
                          field.onChange(val);
                          if (!val) {
                            setAadhaarDocVerified(false);
                            setAadhaarDocError(null);
                            setAadhaarOcrError(null);
                          }
                        }}
                        onFile={(file) => {
                          void handleAadhaarFile(file);
                        }}
                        placeholder="Upload or capture Aadhaar card"
                        documentType="driver_aadhaar"
                        testId="upload-driver-aadhaar-image"
                      />
                    </FormControl>
                    <FormMessage />
                    {isAadhaarOcrRunning && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Reading Aadhaar from document...
                      </p>
                    )}
                    {!isAadhaarOcrRunning && aadhaarOcrError && (
                      <p className="text-xs text-amber-600 mt-1">{aadhaarOcrError}</p>
                    )}
                    {!isAadhaarOcrRunning && isAadhaarDocVerifying && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Verifying Aadhaar...
                      </p>
                    )}
                    {!isAadhaarOcrRunning && !isAadhaarDocVerifying && aadhaarDocVerified && !aadhaarDocError && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Aadhaar verified from document.
                      </p>
                    )}
                    {!isAadhaarOcrRunning && !isAadhaarDocVerifying && aadhaarDocError && (
                      <p className="text-xs text-amber-600 mt-1">{aadhaarDocError}</p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-driver-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="on_trip">On Trip</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
              <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t shrink-0 flex-col gap-2">
                {(() => {
                  const licenseUploaded = !!form.watch("licenseImageUrl");
                  const aadhaarUploaded = !!form.watch("aadhaarImageUrl");
                  const pending = [
                    !licenseUploaded && "Upload Driving License image.",
                    licenseUploaded && !licenseVerified && "Driving License must be verified.",
                    !aadhaarUploaded && "Upload Aadhaar Card image.",
                    aadhaarUploaded && !aadhaarDocVerified && "Aadhaar Card must be verified.",
                  ].filter(Boolean) as string[];
                  const docsReady = pending.length === 0;
                  return (
                    <>
                      {!docsReady && (
                        <p className="text-xs text-amber-600 flex items-start gap-1 w-full">
                          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          {pending.join(" ")}
                        </p>
                      )}
                      <div className="flex flex-row gap-2 w-full sm:w-auto sm:ml-auto">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          onClick={() => {
                            setIsAddDialogOpen(false);
                            setEditingDriver(null);
                            form.reset();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 sm:flex-none"
                          disabled={createDriverMutation.isPending || updateDriverMutation.isPending || !docsReady}
                          data-testid="button-submit-driver"
                        >
                          {(createDriverMutation.isPending || updateDriverMutation.isPending) && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          {editingDriver ? "Update Driver" : "Add Driver"}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingDriver} onOpenChange={(open) => !open && setDeletingDriver(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Driver</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {deletingDriver?.name} from your team? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDriver(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingDriver && deleteDriverMutation.mutate(deletingDriver.id)}
              disabled={deleteDriverMutation.isPending}
              data-testid="button-confirm-delete-driver"
            >
              {deleteDriverMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove Driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
