import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Truck, MapPin, Package, FileText, ArrowRight, Upload, X, Loader2, Shield, Check, AlertCircle, ChevronsUpDown, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { indianTruckManufacturers, getModelsByManufacturer } from "@shared/indian-truck-data";
import { sortedIndianStates, getCitiesByState } from "@shared/indian-locations";

const truckFormSchema = z.object({
  truckType: z.string().min(1, "Truck type is required"),
  licensePlate: z.string().min(1, "License plate is required"),
  capacity: z.string().min(1, "Capacity is required"),
  capacityUnit: z.string().default("tons"),
  currentLocationState: z.string().min(1, "State is required"),
  currentLocationCity: z.string().min(1, "City is required"),
  isAvailable: z.boolean().default(false),
  manufacturerId: z.string().min(1, "Manufacturer is required"),
  model: z.string().min(1, "Model is required"),
  year: z.string().min(1, "Year is required"),
  registrationNumber: z.string().optional(),
  chassisNumber: z.string().optional(),
  bodyType: z.string().optional(),
  permitType: z.enum(["national", "domestic"]).optional(),
});

type TruckFormData = z.infer<typeof truckFormSchema>;

import { indianTruckTypes, truckCategories } from "@shared/schema";

const truckTypesByCategory = truckCategories.reduce((acc, category) => {
  acc[category] = indianTruckTypes.filter(t => t.category === category);
  return acc;
}, {} as Record<string, typeof indianTruckTypes[number][]>);

const categoryLabels: Record<string, string> = {
  open: "Open Body (6-40 Ton)",
  container: "Container (7-28 Ton)",
  lcv: "LCV (0.75-6.5 Ton)",
  mini_pickup: "Mini/Pickup (0.5-2 Ton)",
  trailer: "Trailer (25-40 Ton)",
  tipper: "Tipper (16-28 Ton)",
  tanker: "Tanker (10-35 Ton)",
  dumper: "Dumper (16-35 Ton)",
  bulker: "Bulker (25-36 Ton)",
};

interface DocumentFile {
  file: File;
  name: string;
  type: string;
}

export default function AddTruckPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { carrierType } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const rcInputRef = useRef<HTMLInputElement>(null);
  const insuranceInputRef = useRef<HTMLInputElement>(null);
  const fitnessInputRef = useRef<HTMLInputElement>(null);
  const permitInputRef = useRef<HTMLInputElement>(null);
  const pucInputRef = useRef<HTMLInputElement>(null);
  const isSoloCarrier = carrierType === "solo";
  const [truckTypeOpen, setTruckTypeOpen] = useState(false);
  const [isRcVerifying, setIsRcVerifying] = useState(false);
  const [rcVerified, setRcVerified] = useState(false);
  const [rcError, setRcError] = useState<string | null>(null);
  const [rcOwnerName, setRcOwnerName] = useState<string | null>(null);
  /** OCR + API verify for uploaded RC document (separate from manual registration field) */
  const [isRcOcrRunning, setIsRcOcrRunning] = useState(false);
  const [rcOcrError, setRcOcrError] = useState<string | null>(null);
  const [isRcDocVerifying, setIsRcDocVerifying] = useState(false);
  const [rcDocVerified, setRcDocVerified] = useState(false);
  const [rcDocError, setRcDocError] = useState<string | null>(null);
  const [rcDocOwnerName, setRcDocOwnerName] = useState<string | null>(null);
  /** Ignore stale OCR/API results when user picks another file quickly or resizes. */
  const rcOcrSessionRef = useRef(0);

  const verifyRcNumber = useCallback(async (value: string) => {
    const rc = value.replace(/[\s\-]/g, "").toUpperCase();
    setRcVerified(false);
    setRcError(null);
    setRcOwnerName(null);
    if (!rc || rc.length < 5) return;

    setIsRcVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/rc-owner-history", {
        rc_number: rc,
        request_ref: "add_truck_rc",
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setRcError(body?.message || "RC could not be verified. Please check and try again.");
        return;
      }
      setRcVerified(true);
      setRcOwnerName(body.data?.current_owner_name || null);
      setRcError(null);
    } catch {
      setRcError("RC verification failed. Will be reviewed by admin.");
    } finally {
      setIsRcVerifying(false);
    }
  }, []);

  // Create a flat list of all truck types with category info for searching
  const allTruckTypes = useMemo(() => {
    return indianTruckTypes.map(type => ({
      ...type,
      categoryLabel: categoryLabels[type.category] || type.category,
    }));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setDocuments(prev => [...prev.filter(d => d.type !== docType), { file, name: file.name, type: docType }]);
    }
    e.target.value = "";
  };

  const removeDocument = (docType: string) => {
    setDocuments((prev) => prev.filter((d) => d.type !== docType));
    if (docType === "rc") {
      rcOcrSessionRef.current += 1;
      setIsRcOcrRunning(false);
      setRcOcrError(null);
      setIsRcDocVerifying(false);
      setRcDocVerified(false);
      setRcDocError(null);
      setRcDocOwnerName(null);
    }
  };
  
  const getDocumentByType = (docType: string) => {
    return documents.find(d => d.type === docType);
  };

  // Fetch carrier onboarding data to auto-populate for solo carriers
  interface OnboardingResponse {
    id: string;
    carrierId: string;
    status: string;
    carrierType: string;
    licensePlateNumber?: string;
    chassisNumber?: string;
    uniqueRegistrationNumber?: string;
    permitType?: string;
  }
  
  const { data: onboardingData } = useQuery<OnboardingResponse>({
    queryKey: ["/api/carrier/onboarding"],
    enabled: isSoloCarrier,
  });

  const form = useForm<TruckFormData>({
    resolver: zodResolver(truckFormSchema),
    defaultValues: {
      truckType: "",
      licensePlate: "",
      capacity: "",
      capacityUnit: "tons",
      currentLocationState: "",
      currentLocationCity: "",
      isAvailable: false,
      manufacturerId: "",
      model: "",
      year: "",
      registrationNumber: "",
      chassisNumber: "",
      bodyType: "",
      permitType: undefined,
    },
  });

  const verifyRcFromRegistrationNumber = useCallback(async () => {
    const raw = form.getValues("registrationNumber") || "";
    const rc = raw.replace(/[\s\-]/g, "").toUpperCase();
    if (!rc || rc.length < 5) {
      toast({
        title: "Enter RC number",
        description: "Add a Registration Number (RC) to verify.",
        variant: "destructive",
      });
      return;
    }

    // Cancel any in-flight OCR session updates so UI isn't overwritten.
    rcOcrSessionRef.current += 1;
    setIsRcOcrRunning(false);
    setRcOcrError(null);
    setRcDocVerified(false);
    setRcDocError(null);
    setRcDocOwnerName(null);

    setIsRcDocVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/rc-owner-history", {
        rc_number: rc,
        request_ref: "add_truck_rc_manual",
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setRcDocError(body?.message || "RC could not be verified.");
      } else {
        setRcDocVerified(true);
        setRcDocOwnerName(body.data?.current_owner_name || null);
      }
    } catch {
      setRcDocError("RC verification failed. Will be reviewed by admin.");
    } finally {
      setIsRcDocVerifying(false);
    }
  }, [form, toast]);

  const runRcUploadVerification = useCallback(
    async (file: File) => {
      const session = ++rcOcrSessionRef.current;
      const isCurrent = () => rcOcrSessionRef.current === session;

      setIsRcOcrRunning(true);
      setRcOcrError(null);
      setRcDocVerified(false);
      setRcDocError(null);
      setRcDocOwnerName(null);

      let rcForVerify = "";

      try {
        // Keep this flow aligned with carrier/onboarding for consistent OCR behavior.
        const { prepareFileForTesseract } = await import("@/lib/prepare-file-for-tesseract");
        const ocrSource = await prepareFileForTesseract(file);
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const {
          data: { text },
        } = await worker.recognize(ocrSource);
        await worker.terminate();

        if (!isCurrent()) return;

        const normalized = text.replace(/[\n\r]/g, " ").toUpperCase();
        const compact = normalized.replace(/[\s\-]/g, "");
        const match = compact.match(/[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}/);
        rcForVerify = match?.[0] || "";

        if (rcForVerify.length < 8) {
          setRcOcrError("RC number could not be read. Enter it manually on the vehicle details card.");
          return;
        }

        form.setValue("registrationNumber", rcForVerify, { shouldValidate: true, shouldDirty: true });
        toast({
          title: "RC number extracted",
          description: `Registration number: ${rcForVerify}`,
          duration: 4000,
        });
      } catch (err) {
        if (!isCurrent()) return;
        console.error("RC OCR error:", err);
        setRcOcrError("Could not read document. Enter RC number manually.");
        return;
      } finally {
        if (isCurrent()) setIsRcOcrRunning(false);
      }

      if (!rcForVerify || !isCurrent()) return;

      // Ensure UI transitions away from OCR state before API verify.
      setIsRcOcrRunning(false);
      setIsRcDocVerifying(true);
      try {
        const res = await apiRequest("POST", "/api/kyc/rc-owner-history", {
          rc_number: rcForVerify,
          request_ref: "add_truck_rc_doc",
        });
        const body = await res.json();
        if (!isCurrent()) return;
        if (!res.ok || !body.success) {
          setRcDocError(body?.message || "RC could not be verified.");
        } else {
          setRcDocVerified(true);
          setRcDocOwnerName(body.data?.current_owner_name || null);
        }
      } catch {
        if (isCurrent()) {
          setRcDocError("RC verification failed. Will be reviewed by admin.");
        }
      } finally {
        if (isCurrent()) setIsRcDocVerifying(false);
      }
    },
    [form, toast],
  );

  const handleRcFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const file = files?.[0];
    e.target.value = "";
    if (!file) return;
    setDocuments((prev) => [...prev.filter((d) => d.type !== "rc"), { file, name: file.name, type: "rc" }]);
    void runRcUploadVerification(file);
  };

  // Auto-populate form from onboarding data for solo carriers
  useEffect(() => {
    // Only auto-populate if this is a solo carrier and onboarding data is for solo type
    if (isSoloCarrier && onboardingData && onboardingData.carrierType === "solo") {
      if (onboardingData.licensePlateNumber) {
        form.setValue("licensePlate", onboardingData.licensePlateNumber);
      }
      if (onboardingData.chassisNumber) {
        form.setValue("chassisNumber", onboardingData.chassisNumber);
      }
      if (onboardingData.uniqueRegistrationNumber) {
        form.setValue("registrationNumber", onboardingData.uniqueRegistrationNumber);
      }
      if (onboardingData.permitType === "national" || onboardingData.permitType === "domestic") {
        form.setValue("permitType", onboardingData.permitType);
      }
    }
  }, [isSoloCarrier, onboardingData, form]);

  // Watch the form values for cascading dropdowns
  const manufacturerId = form.watch("manufacturerId");
  const currentLocationState = form.watch("currentLocationState");
  const availableModels = manufacturerId ? getModelsByManufacturer(manufacturerId) : [];
  const availableCities = currentLocationState ? getCitiesByState(currentLocationState) : [];

  const handleSubmit = async (data: TruckFormData) => {
    setIsLoading(true);
    const stateName = sortedIndianStates.find(s => s.code === data.currentLocationState)?.name || data.currentLocationState;
    const currentLocation = `${data.currentLocationCity}, ${stateName}`;
    const manufacturer = indianTruckManufacturers.find(m => m.id === data.manufacturerId);
    try {
      const response = await fetch("/api/admin/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          truckType: data.truckType,
          licensePlate: data.licensePlate,
          capacity: Number(data.capacity),
          capacityUnit: data.capacityUnit,
          currentLocation: currentLocation,
          city: data.currentLocationCity,
          isAvailable: data.isAvailable,
          make: manufacturer?.name || data.manufacturerId,
          model: data.model,
          year: data.year ? Number(data.year) : undefined,
          registrationNumber: data.registrationNumber || undefined,
          chassisNumber: data.chassisNumber || undefined,
          bodyType: data.bodyType || undefined,
          permitType: data.permitType || undefined,
        }),
      });

      if (response.ok) {
        const truck = await response.json();
        
        // Upload documents if any
        if (documents.length > 0) {
          const docTypeLabels: Record<string, string> = {
            rc: "Registration Certificate",
            insurance: "Insurance",
            fitness: "Fitness Certificate",
            permit: "Permit",
            puc: "PUC Certificate",
          };
          for (const doc of documents) {
            try {
              const reader = new FileReader();
              await new Promise<void>((resolve, reject) => {
                reader.onload = async () => {
                  const fileUrl = reader.result as string;
                  // Format filename with truck number as title
                  const docLabel = docTypeLabels[doc.type] || doc.type.toUpperCase();
                  const formattedFileName = `${data.licensePlate} - ${docLabel}`;
                  const docVerified =
                    doc.type === "rc" ? rcDocVerified || rcVerified : false;
                  await fetch("/api/admin/documents", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      documentType: doc.type,
                      fileName: formattedFileName,
                      fileUrl: fileUrl,
                      fileSize: doc.file.size,
                      expiryDate: null,
                      truckId: truck.id,
                      isVerified: docVerified,
                    }),
                  });
                  resolve();
                };
                reader.onerror = reject;
                reader.readAsDataURL(doc.file);
              });
            } catch (docError) {
              console.error("Failed to upload document:", docError);
            }
          }
        }
        
        // Invalidate trucks and documents queries for real-time update
        queryClient.invalidateQueries({ queryKey: ["/api/admin/trucks"] });
        
        toast({ title: "Truck added!", description: "The truck has been added to the fleet." });
        navigate("/admin/fleet");
      } else {
        toast({ title: "Error", description: "Failed to add truck. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Add New Truck</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Register a new vehicle to your fleet.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Vehicle Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="manufacturerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manufacturer</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("model", "");
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-manufacturer">
                            <SelectValue placeholder="Select manufacturer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {indianTruckManufacturers.map((manufacturer) => (
                            <SelectItem key={manufacturer.id} value={manufacturer.id}>
                              {manufacturer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!manufacturerId}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-model">
                            <SelectValue placeholder={manufacturerId ? "Select model" : "Select manufacturer first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {availableModels.map((model) => (
                            <SelectItem key={model.name} value={model.name}>
                              {model.name} ({model.capacityRange})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Year of Manufacture</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2023" min="1990" max={new Date().getFullYear()} {...field} data-testid="input-year" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="truckType"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm">Truck Type</FormLabel>
                      <Popover open={truckTypeOpen} onOpenChange={setTruckTypeOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={truckTypeOpen}
                              className={cn(
                                "w-full justify-between font-normal text-sm",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="select-truck-type"
                            >
                              <span className="truncate">{field.value
                                ? allTruckTypes.find((type) => type.value === field.value)?.label
                                : "Select truck type"}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search truck type..." />
                            <CommandList className="max-h-[300px]">
                              <CommandEmpty>No truck type found.</CommandEmpty>
                              {truckCategories.map((category) => (
                                <CommandGroup key={category} heading={categoryLabels[category]}>
                                  {truckTypesByCategory[category]?.map((type) => (
                                    <CommandItem
                                      key={type.value}
                                      value={`${type.label} ${categoryLabels[category]}`}
                                      onSelect={() => {
                                        field.onChange(type.value);
                                        setTruckTypeOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === type.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {type.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">License Plate</FormLabel>
                      <FormControl>
                        <Input placeholder="MH-01-AB-1234" {...field} data-testid="input-license-plate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Registration Number (RC)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="RC number (e.g. MH01AB1234)"
                          {...field}
                          data-testid="input-registration-number"
                          onChange={(e) => {
                            setRcVerified(false);
                            setRcError(null);
                            setRcOwnerName(null);
                            field.onChange(e);
                          }}
                          onBlur={(e) => {
                            field.onBlur();
                            void verifyRcNumber(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                      {isRcVerifying && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Verifying RC…
                        </p>
                      )}
                      {!isRcVerifying && rcVerified && !rcError && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <Check className="h-3 w-3" /> RC verified.{rcOwnerName ? ` Owner: ${rcOwnerName}` : ""}
                        </p>
                      )}
                      {!isRcVerifying && rcError && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {rcError}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="chassisNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Chassis Number <span className="text-xs text-muted-foreground font-normal">(e.g. MAT123456789012345)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} data-testid="input-chassis-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bodyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Body Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-body-type">
                            <SelectValue placeholder="Select body type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="open">Open Body</SelectItem>
                          <SelectItem value="closed">Closed Body</SelectItem>
                          <SelectItem value="container">Container</SelectItem>
                          <SelectItem value="flatbed">Flatbed</SelectItem>
                          <SelectItem value="tanker">Tanker</SelectItem>
                          <SelectItem value="tipper">Tipper</SelectItem>
                          <SelectItem value="trailer">Trailer</SelectItem>
                          <SelectItem value="refrigerated">Refrigerated</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="permitType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4" />
                      Permit Type
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-permit-type">
                          <SelectValue placeholder="Select permit type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="national">National Permit (All India)</SelectItem>
                        <SelectItem value="domestic">State Permit</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Load Capacity</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input 
                          type="number" 
                          placeholder="25" 
                          {...field} 
                          data-testid="input-capacity" 
                          className="flex-1"
                        />
                        <Select
                          defaultValue="tons"
                          onValueChange={(value) => form.setValue("capacityUnit", value)}
                        >
                          <SelectTrigger className="w-20 sm:w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tons">tons</SelectItem>
                            <SelectItem value="lbs">lbs</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location & Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <FormField
                control={form.control}
                name="isAvailable"
                render={({ field }) => (
                  <FormItem className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 sm:p-4 gap-3">
                    <div className="flex-1">
                      <FormLabel className="text-sm sm:text-base">Available for loads</FormLabel>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Mark this truck as available to receive load recommendations
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-available"
                        className="shrink-0"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="currentLocationState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">State</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("currentLocationCity", "");
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {sortedIndianStates.map((state) => (
                            <SelectItem key={state.code} value={state.code}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentLocationCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">City</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!currentLocationState}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-city">
                            <SelectValue placeholder={currentLocationState ? "Select city" : "Select state first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {availableCities.map((city) => (
                            <SelectItem key={city.name} value={city.name}>
                              {city.name} {city.isMetro && "(Metro)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents <span className="text-red-500">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {/* Hidden file inputs for each document type */}
              <input
                ref={rcInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                className="hidden"
                onChange={handleRcFileSelect}
                data-testid="input-rc-upload"
              />
              <input
                ref={insuranceInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "insurance")}
                data-testid="input-insurance-upload"
              />
              <input
                ref={fitnessInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "fitness")}
                data-testid="input-fitness-upload"
              />
              <input
                ref={permitInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "permit")}
                data-testid="input-permit-upload"
              />
              <input
                ref={pucInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "puc")}
                data-testid="input-puc-upload"
              />

              {/* RC Document — status uses aria-live so mobile/desktop readers see phase changes */}
              <div className="space-y-2" aria-live="polite">
                <Label className="text-xs sm:text-sm font-medium">RC (Registration Certificate)</Label>
                {getDocumentByType("rc") ? (
                  <div className="flex items-center justify-between gap-2 p-2 sm:p-3 border rounded-md bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-xs sm:text-sm truncate">{getDocumentByType("rc")?.name}</span>
                      <Badge variant="secondary" className="flex-shrink-0 text-xs">Uploaded</Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeDocument("rc")}
                      data-testid="button-remove-rc"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => rcInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4 text-center hover-elevate cursor-pointer"
                    data-testid="dropzone-rc"
                  >
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Tap to upload RC (PDF, JPG, PNG). HEIC may not work in-browser—use JPG if stuck.
                    </p>
                  </div>
                )}
                {isRcOcrRunning && !isRcDocVerifying && !rcDocVerified && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    Reading RC number from document…
                  </p>
                )}
                {!isRcOcrRunning && rcOcrError && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {rcOcrError}
                  </p>
                )}
                {!isRcOcrRunning && isRcDocVerifying && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    Verifying RC…
                  </p>
                )}
                {!isRcOcrRunning && !isRcDocVerifying && rcDocVerified && !rcDocError && getDocumentByType("rc") && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3 shrink-0" />
                    RC verified from document.{rcDocOwnerName ? ` Owner: ${rcDocOwnerName}` : ""}
                  </p>
                )}
                {!isRcOcrRunning && !isRcDocVerifying && rcDocError && getDocumentByType("rc") && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {rcDocError}
                  </p>
                )}
              </div>

              {/* Insurance Document */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Insurance Certificate</Label>
                {getDocumentByType("insurance") ? (
                  <div className="flex items-center justify-between gap-2 p-2 sm:p-3 border rounded-md bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-xs sm:text-sm truncate">{getDocumentByType("insurance")?.name}</span>
                      <Badge variant="secondary" className="flex-shrink-0 text-xs">Uploaded</Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeDocument("insurance")}
                      data-testid="button-remove-insurance"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => insuranceInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4 text-center hover-elevate cursor-pointer"
                    data-testid="dropzone-insurance"
                  >
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Click to upload Insurance (PDF, JPG, PNG)</p>
                  </div>
                )}
              </div>

              {/* Fitness Certificate */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Fitness Certificate</Label>
                {getDocumentByType("fitness") ? (
                  <div className="flex items-center justify-between gap-2 p-2 sm:p-3 border rounded-md bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-xs sm:text-sm truncate">{getDocumentByType("fitness")?.name}</span>
                      <Badge variant="secondary" className="flex-shrink-0 text-xs">Uploaded</Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeDocument("fitness")}
                      data-testid="button-remove-fitness"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fitnessInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4 text-center hover-elevate cursor-pointer"
                    data-testid="dropzone-fitness"
                  >
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Click to upload Fitness Certificate (PDF, JPG, PNG)</p>
                  </div>
                )}
              </div>

              {/* Permit Document */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Permit Document</Label>
                {getDocumentByType("permit") ? (
                  <div className="flex items-center justify-between gap-2 p-2 sm:p-3 border rounded-md bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-xs sm:text-sm truncate">{getDocumentByType("permit")?.name}</span>
                      <Badge variant="secondary" className="flex-shrink-0 text-xs">Uploaded</Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeDocument("permit")}
                      data-testid="button-remove-permit"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => permitInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4 text-center hover-elevate cursor-pointer"
                    data-testid="dropzone-permit"
                  >
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Click to upload Permit (PDF, JPG, PNG)</p>
                  </div>
                )}
              </div>

              {/* PUC Certificate */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">PUC Certificate</Label>
                {getDocumentByType("puc") ? (
                  <div className="flex items-center justify-between gap-2 p-2 sm:p-3 border rounded-md bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-xs sm:text-sm truncate">{getDocumentByType("puc")?.name}</span>
                      <Badge variant="secondary" className="flex-shrink-0 text-xs">Uploaded</Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeDocument("puc")}
                      data-testid="button-remove-puc"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => pucInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4 text-center hover-elevate cursor-pointer"
                    data-testid="dropzone-puc"
                  >
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Click to upload PUC Certificate (PDF, JPG, PNG)</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {(() => {
            const rcUploaded = !!getDocumentByType("rc");
            const rcReady = rcUploaded && rcDocVerified;
            return (
              <>
                {!rcReady && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {!rcUploaded
                      ? "Please upload the RC (Registration Certificate) before adding the truck."
                      : "RC must be verified before adding the truck."}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full text-sm sm:text-base"
                  disabled={isLoading || !rcUploaded || !rcDocVerified}
                  data-testid="button-add-truck"
                >
                  {isLoading ? "Adding..." : "Add Truck to Fleet"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            );
          })()}
        </form>
      </Form>
    </div>
  );
}
