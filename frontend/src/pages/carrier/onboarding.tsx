import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Truck, User, FileText, CreditCard, Upload, Check, Clock, 
  AlertCircle, Loader2, Building2, Shield, IdCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DocumentUploadWithCamera } from "@/components/DocumentUploadWithCamera";
import { useAuth } from "@/lib/auth-context";

const aadhaarSchema = z
  .string()
  .length(12, "Aadhaar must be 12 digits")
  .regex(/^\d{12}$/, "Aadhaar must contain only numbers")
  .refine((v: string) => v[0] !== "0", "Aadhaar must not start with 0");

const panSchema = z
  .string()
  .length(10, "PAN must be 10 characters")
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN must be 5 letters, 4 digits, then 1 letter (e.g. XXXXX0000X)");

/** Indian license plate: e.g. MH-01-AB-1234 or MH01AB1234 — state(2) + district(2) + series(1-3 letters) + number(1-4 digits) */
const LICENSE_PLATE_REGEX = /^[A-Z]{2}-?\d{1,2}-?[A-Z]{1,3}-?\d{1,4}$/;
/** Chassis / VIN: exactly 17 alphanumeric characters (no I, O, Q per ISO 3779) */
const CHASSIS_VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;
/** IFSC: 4 letters + 0 + 6 alphanumeric, e.g. SBIN0001234 */
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const licensePlateField = z.string().min(1, "License plate is required").superRefine((val, ctx) => {
  const v = val.trim().toUpperCase();
  if (v && !LICENSE_PLATE_REGEX.test(v)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid format (e.g. MH-01-AB-1234 or MH01AB1234)" });
  }
});
const chassisField = z.string().min(1, "Chassis number is required").superRefine((val, ctx) => {
  const v = val.trim().toUpperCase();
  if (v && !CHASSIS_VIN_REGEX.test(v)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be exactly 17 alphanumeric characters (VIN)" });
  }
});
const ifscField = z.string().optional().superRefine((val, ctx) => {
  const v = (val ?? "").trim().toUpperCase();
  if (v && !IFSC_REGEX.test(v)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid IFSC (e.g. SBIN0001234)" });
  }
});

const soloFormSchema = z.object({
  carrierType: z.literal("solo"),
  aadhaarNumber: aadhaarSchema,
  driverLicenseNumber: z.string().min(1, "License number is required"),
  driverLicenseDob: z.string().optional(),
  panNumber: panSchema,
  permitType: z.enum(["national", "domestic"]),
  uniqueRegistrationNumber: z.string().optional(),
  chassisNumber: chassisField,
  licensePlateNumber: licensePlateField,
  businessAddress: z.string().min(1, "Business address is required"),
  businessLocality: z.string().min(1, "Locality is required"),
  aadhaarUrl: z.string().optional(),
  licenseUrl: z.string().optional(),
  panUrl: z.string().optional(),
  permitUrl: z.string().optional(),
  rcUrl: z.string().optional(),
  insuranceUrl: z.string().optional(),
  fitnessUrl: z.string().optional(),
  tdsDeclarationUrl: z.string().optional(),
  selfieUrl: z.string().optional(),
  msmeUdyamUrl: z.string().optional(),
  // Bank details
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode: ifscField,
  bankAccountHolderName: z.string().optional(),
  voidChequeUrl: z.string().optional(),
});

const fleetFormSchema = z.object({
  carrierType: z.literal("enterprise"),
  // Identity tab fields
  aadhaarNumber: aadhaarSchema,
  driverLicenseNumber: z.string().optional(),
  driverLicenseDob: z.string().optional(),
  panNumber: z.union([z.literal(""), panSchema]).optional(),
  gstinNumber: z.string().optional(),
  noGstinNumber: z.boolean().optional(),
  businessType: z.enum(["sole_proprietor", "registered_partnership", "non_registered_partnership", "other"]).optional(),
  cinNumber: z.string().optional(),
  partnerName: z.string().optional(),
  businessAddress: z.string().min(1, "Business address is required"),
  businessLocality: z.string().min(1, "Locality is required"),
  fleetSize: z.coerce.number().int().min(1),
  // Vehicle tab fields (for one truck)
  licensePlateNumber: licensePlateField,
  chassisNumber: chassisField,
  uniqueRegistrationNumber: z.string().optional(),
  permitType: z.enum(["national", "domestic"]),
  // Document URLs
  aadhaarUrl: z.string().optional(),
  licenseUrl: z.string().optional(),
  panUrl: z.string().optional(),
  gstinUrl: z.string().optional(),
  cinUrl: z.string().optional(),
  addressProofType: z.enum(["rent_agreement", "electricity_bill", "office_photo_with_board"]).optional(),
  addressProofUrl: z.string().optional(),
  selfieUrl: z.string().optional(),
  rcUrl: z.string().optional(),
  insuranceUrl: z.string().optional(),
  fitnessUrl: z.string().optional(),
  tdsDeclarationUrl: z.string().optional(),
  msmeUdyamUrl: z.string().optional(),
  // Bank details
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode: ifscField,
  bankAccountHolderName: z.string().optional(),
  voidChequeUrl: z.string().optional(),
});

const formSchema = z.discriminatedUnion("carrierType", [soloFormSchema, fleetFormSchema]);

type FormData = z.infer<typeof formSchema>;

interface OnboardingResponse {
  id: string;
  carrierId: string;
  status: string;
  carrierType: string;
  fleetSize: number;
  aadhaarNumber?: string;
  driverLicenseNumber?: string;
  permitType?: string;
  uniqueRegistrationNumber?: string;
  chassisNumber?: string;
  licensePlateNumber?: string;
  incorporationType?: string;
  businessType?: string;
  cinNumber?: string;
  partnerName?: string;
  businessRegistrationNumber?: string;
  businessAddress?: string;
  businessLocality?: string;
  panNumber?: string;
  gstinNumber?: string;
  tanNumber?: string;
  // Bank details
  bankName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankAccountHolderName?: string;
  rejectionReason?: string;
  notes?: string;
  documents: Array<{
    id: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
  }>;
}

export default function CarrierOnboarding() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("identity");
  const [carrierType, setCarrierType] = useState<"solo" | "enterprise">("solo");
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");
  const formInitializedRef = useRef<boolean>(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [licenseVerified, setLicenseVerified] = useState(false);
  const [isAadhaarVerifying, setIsAadhaarVerifying] = useState(false);
  const [isPanVerifying, setIsPanVerifying] = useState(false);
  const [isLicenseVerifying, setIsLicenseVerifying] = useState(false);
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [panError, setPanError] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [isAadhaarOcrRunning, setIsAadhaarOcrRunning] = useState(false);
  const [aadhaarOcrError, setAadhaarOcrError] = useState<string | null>(null);
  const activeAadhaarFormRef = useRef<typeof soloForm | typeof fleetForm | null>(null);
  const [isPanOcrRunning, setIsPanOcrRunning] = useState(false);
  const [panOcrError, setPanOcrError] = useState<string | null>(null);
  const activePanFormRef = useRef<typeof soloForm | typeof fleetForm | null>(null);
  const [isLicenseOcrRunning, setIsLicenseOcrRunning] = useState(false);
  const [licenseOcrError, setLicenseOcrError] = useState<string | null>(null);
  const activeLicenseFormRef = useRef<typeof soloForm | typeof fleetForm | null>(null);

  // Document-tab-specific verification states (independent from Identity tab)
  const [isAadhaarDocVerifying, setIsAadhaarDocVerifying] = useState(false);
  const [aadhaarDocVerified, setAadhaarDocVerified] = useState(false);
  const [aadhaarDocError, setAadhaarDocError] = useState<string | null>(null);
  const [isPanDocVerifying, setIsPanDocVerifying] = useState(false);
  const [panDocVerified, setPanDocVerified] = useState(false);
  const [panDocError, setPanDocError] = useState<string | null>(null);

  // RC verification states
  const [isRcVerifying, setIsRcVerifying] = useState(false);
  const [rcVerified, setRcVerified] = useState(false);
  const [rcError, setRcError] = useState<string | null>(null);
  const [rcOwnerName, setRcOwnerName] = useState<string | null>(null);
  const [isRcOcrRunning, setIsRcOcrRunning] = useState(false);
  const [rcOcrError, setRcOcrError] = useState<string | null>(null);
  const [isRcDocVerifying, setIsRcDocVerifying] = useState(false);
  const [rcDocVerified, setRcDocVerified] = useState(false);
  const [rcDocError, setRcDocError] = useState<string | null>(null);
  const [rcDocOwnerName, setRcDocOwnerName] = useState<string | null>(null);
  const activeRcFormRef = useRef<typeof soloForm | typeof fleetForm | null>(null);
  const drivingLicenseVerifyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: onboardingStatus, isLoading: isLoadingStatus } = useQuery<OnboardingResponse>({
    queryKey: ["/api/carrier/onboarding"],
  });

  const { data: kycConfig } = useQuery<{ surepassAllowProxy: boolean }>({
    queryKey: ["/api/kyc/config"],
  });

  const soloForm = useForm<z.infer<typeof soloFormSchema>>({
    resolver: zodResolver(soloFormSchema),
    mode: "onTouched",
    defaultValues: {
      carrierType: "solo",
      aadhaarNumber: "",
      driverLicenseNumber: "",
      driverLicenseDob: "",
      panNumber: "",
      permitType: "national",
      uniqueRegistrationNumber: "",
      chassisNumber: "",
      licensePlateNumber: "",
      businessAddress: "",
      businessLocality: "",
      aadhaarUrl: "",
      licenseUrl: "",
      panUrl: "",
      permitUrl: "",
      rcUrl: "",
      insuranceUrl: "",
      fitnessUrl: "",
      selfieUrl: "",
      msmeUdyamUrl: "",
      bankName: "",
      bankAccountNumber: "",
      bankIfscCode: "",
      bankAccountHolderName: "",
      voidChequeUrl: "",
    },
  });

  const fleetForm = useForm<z.infer<typeof fleetFormSchema>>({
    resolver: zodResolver(fleetFormSchema),
    mode: "onTouched",
    defaultValues: {
      carrierType: "enterprise",
      aadhaarNumber: "",
      driverLicenseNumber: "",
      driverLicenseDob: "",
      panNumber: "",
      gstinNumber: "",
      noGstinNumber: false,
      businessType: undefined,
      cinNumber: "",
      partnerName: "",
      businessAddress: "",
      businessLocality: "",
      fleetSize: 1,
      licensePlateNumber: "",
      chassisNumber: "",
      uniqueRegistrationNumber: "",
      permitType: "national",
      aadhaarUrl: "",
      licenseUrl: "",
      panUrl: "",
      gstinUrl: "",
      cinUrl: "",
      addressProofType: undefined,
      addressProofUrl: "",
      selfieUrl: "",
      rcUrl: "",
      insuranceUrl: "",
      fitnessUrl: "",
      msmeUdyamUrl: "",
      bankName: "",
      bankAccountNumber: "",
      bankIfscCode: "",
      bankAccountHolderName: "",
      voidChequeUrl: "",
    },
  });

  useEffect(() => {
    if (onboardingStatus) {
      const type = onboardingStatus.carrierType === "enterprise" ? "enterprise" : "solo";
      setCarrierType(type);
      
      if (formInitializedRef.current) {
        if (type === "solo") {
          const docFields: Partial<Record<string, string>> = {
            aadhaarUrl: onboardingStatus.documents.find(d => d.documentType === "aadhaar")?.fileUrl || "",
            licenseUrl: onboardingStatus.documents.find(d => d.documentType === "license")?.fileUrl || "",
            panUrl: onboardingStatus.documents.find(d => d.documentType === "pan")?.fileUrl || "",
            permitUrl: onboardingStatus.documents.find(d => d.documentType === "permit")?.fileUrl || "",
            rcUrl: onboardingStatus.documents.find(d => d.documentType === "rc")?.fileUrl || "",
            insuranceUrl: onboardingStatus.documents.find(d => d.documentType === "insurance")?.fileUrl || "",
            fitnessUrl: onboardingStatus.documents.find(d => d.documentType === "fitness")?.fileUrl || "",
            tdsDeclarationUrl: onboardingStatus.documents.find(d => d.documentType === "tds_declaration")?.fileUrl || "",
            selfieUrl: onboardingStatus.documents.find(d => d.documentType === "selfie")?.fileUrl || "",
            msmeUdyamUrl: onboardingStatus.documents.find(d => d.documentType === "msme_udyam" || d.documentType === "msme" || d.documentType === "udyam")?.fileUrl || "",
            voidChequeUrl: onboardingStatus.documents.find(d => d.documentType === "void_cheque")?.fileUrl || "",
          };
          for (const [key, val] of Object.entries(docFields)) {
            if (val) soloForm.setValue(key as any, val);
          }
        } else {
          const docFields: Partial<Record<string, string>> = {
            aadhaarUrl: onboardingStatus.documents.find(d => d.documentType === "aadhaar")?.fileUrl || "",
            licenseUrl: onboardingStatus.documents.find(d => d.documentType === "license")?.fileUrl || "",
            panUrl: onboardingStatus.documents.find(d => d.documentType === "pan")?.fileUrl || "",
            gstinUrl: onboardingStatus.documents.find(d => d.documentType === "gstin")?.fileUrl || "",
            cinUrl: onboardingStatus.documents.find(d => d.documentType === "cin")?.fileUrl || "",
            addressProofUrl: onboardingStatus.documents.find(d => d.documentType === "address_proof")?.fileUrl || "",
            selfieUrl: onboardingStatus.documents.find(d => d.documentType === "selfie")?.fileUrl || "",
            rcUrl: onboardingStatus.documents.find(d => d.documentType === "rc")?.fileUrl || "",
            insuranceUrl: onboardingStatus.documents.find(d => d.documentType === "insurance")?.fileUrl || "",
            fitnessUrl: onboardingStatus.documents.find(d => d.documentType === "fitness")?.fileUrl || "",
            tdsDeclarationUrl: onboardingStatus.documents.find(d => d.documentType === "tds_declaration")?.fileUrl || "",
            msmeUdyamUrl: onboardingStatus.documents.find(d => d.documentType === "msme_udyam" || d.documentType === "msme" || d.documentType === "udyam")?.fileUrl || "",
            voidChequeUrl: onboardingStatus.documents.find(d => d.documentType === "void_cheque")?.fileUrl || "",
          };
          for (const [key, val] of Object.entries(docFields)) {
            if (val) fleetForm.setValue(key as any, val);
          }
        }
        return;
      }
      
      formInitializedRef.current = true;

      if (type === "solo") {
        const formData = {
          carrierType: "solo" as const,
          aadhaarNumber: onboardingStatus.aadhaarNumber || "",
          driverLicenseNumber: onboardingStatus.driverLicenseNumber || "",
          driverLicenseDob: "",
          panNumber: onboardingStatus.panNumber || "",
          permitType: (onboardingStatus.permitType as "national" | "domestic") || "national",
          uniqueRegistrationNumber: onboardingStatus.uniqueRegistrationNumber || "",
          chassisNumber: onboardingStatus.chassisNumber || "",
          licensePlateNumber: onboardingStatus.licensePlateNumber || "",
          businessAddress: onboardingStatus.businessAddress || "",
          businessLocality: onboardingStatus.businessLocality || "",
          aadhaarUrl: onboardingStatus.documents.find(d => d.documentType === "aadhaar")?.fileUrl || "",
          licenseUrl: onboardingStatus.documents.find(d => d.documentType === "license")?.fileUrl || "",
          panUrl: onboardingStatus.documents.find(d => d.documentType === "pan")?.fileUrl || "",
          permitUrl: onboardingStatus.documents.find(d => d.documentType === "permit")?.fileUrl || "",
          rcUrl: onboardingStatus.documents.find(d => d.documentType === "rc")?.fileUrl || "",
          insuranceUrl: onboardingStatus.documents.find(d => d.documentType === "insurance")?.fileUrl || "",
          fitnessUrl: onboardingStatus.documents.find(d => d.documentType === "fitness")?.fileUrl || "",
          tdsDeclarationUrl: onboardingStatus.documents.find(d => d.documentType === "tds_declaration")?.fileUrl || "",
          selfieUrl: onboardingStatus.documents.find(d => d.documentType === "selfie")?.fileUrl || "",
          msmeUdyamUrl: onboardingStatus.documents.find(d => d.documentType === "msme_udyam" || d.documentType === "msme" || d.documentType === "udyam")?.fileUrl || "",
          bankName: onboardingStatus.bankName || "",
          bankAccountNumber: onboardingStatus.bankAccountNumber || "",
          bankIfscCode: onboardingStatus.bankIfscCode || "",
          bankAccountHolderName: onboardingStatus.bankAccountHolderName || "",
          voidChequeUrl: onboardingStatus.documents.find(d => d.documentType === "void_cheque")?.fileUrl || "",
        };
        soloForm.reset(formData);
        lastSavedDataRef.current = JSON.stringify(formData);
      } else {
        const formData = {
          carrierType: "enterprise" as const,
          aadhaarNumber: onboardingStatus.aadhaarNumber || "",
          driverLicenseNumber: onboardingStatus.driverLicenseNumber || "",
          driverLicenseDob: "",
          panNumber: onboardingStatus.panNumber || "",
          gstinNumber: onboardingStatus.gstinNumber || "",
          noGstinNumber: onboardingStatus.noGstinNumber || false,
          businessType: (onboardingStatus.businessType as "sole_proprietor" | "registered_partnership" | "non_registered_partnership" | "other") || undefined,
          cinNumber: onboardingStatus.cinNumber || "",
          partnerName: onboardingStatus.partnerName || "",
          businessAddress: onboardingStatus.businessAddress || "",
          businessLocality: onboardingStatus.businessLocality || "",
          fleetSize: onboardingStatus.fleetSize || 1,
          licensePlateNumber: onboardingStatus.licensePlateNumber || "",
          chassisNumber: onboardingStatus.chassisNumber || "",
          uniqueRegistrationNumber: onboardingStatus.uniqueRegistrationNumber || "",
          permitType: (onboardingStatus.permitType as "national" | "domestic") || "national",
          aadhaarUrl: onboardingStatus.documents.find(d => d.documentType === "aadhaar")?.fileUrl || "",
          licenseUrl: onboardingStatus.documents.find(d => d.documentType === "license")?.fileUrl || "",
          panUrl: onboardingStatus.documents.find(d => d.documentType === "pan")?.fileUrl || "",
          gstinUrl: onboardingStatus.documents.find(d => d.documentType === "gstin")?.fileUrl || "",
          cinUrl: onboardingStatus.documents.find(d => d.documentType === "cin")?.fileUrl || "",
          addressProofType: (onboardingStatus as any).addressProofType || undefined,
          addressProofUrl: onboardingStatus.documents.find(d => d.documentType === "address_proof")?.fileUrl || "",
          selfieUrl: onboardingStatus.documents.find(d => d.documentType === "selfie")?.fileUrl || "",
          rcUrl: onboardingStatus.documents.find(d => d.documentType === "rc")?.fileUrl || "",
          insuranceUrl: onboardingStatus.documents.find(d => d.documentType === "insurance")?.fileUrl || "",
          fitnessUrl: onboardingStatus.documents.find(d => d.documentType === "fitness")?.fileUrl || "",
          tdsDeclarationUrl: onboardingStatus.documents.find(d => d.documentType === "tds_declaration")?.fileUrl || "",
          msmeUdyamUrl: onboardingStatus.documents.find(d => d.documentType === "msme_udyam" || d.documentType === "msme" || d.documentType === "udyam")?.fileUrl || "",
          bankName: onboardingStatus.bankName || "",
          bankAccountNumber: onboardingStatus.bankAccountNumber || "",
          bankIfscCode: onboardingStatus.bankIfscCode || "",
          bankAccountHolderName: onboardingStatus.bankAccountHolderName || "",
          voidChequeUrl: onboardingStatus.documents.find(d => d.documentType === "void_cheque")?.fileUrl || "",
        };
        fleetForm.reset(formData);
        lastSavedDataRef.current = JSON.stringify(formData);
      }
    }
  }, [onboardingStatus, soloForm, fleetForm]);

  const autoSaveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", "/api/carrier/onboarding/draft", data);
      return res.json();
    },
    onSuccess: () => {
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    },
    onError: () => {
      setAutoSaveStatus("idle");
    },
  });

  const debouncedAutoSave = useCallback((data: Record<string, any>) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    const dataString = JSON.stringify(data);
    if (dataString === lastSavedDataRef.current) {
      return;
    }

    setAutoSaveStatus("saving");
    autoSaveTimeoutRef.current = setTimeout(() => {
      lastSavedDataRef.current = dataString;
      autoSaveMutation.mutate(data);
    }, 1500);
  }, [autoSaveMutation]);

  useEffect(() => {
    const editableStatuses = ["draft", "on_hold", "rejected"];
    if (!onboardingStatus?.status || !editableStatuses.includes(onboardingStatus.status)) return;
    
    let unsubscribe: () => void;
    
    if (carrierType === "solo") {
      const sub = soloForm.watch((data) => {
        debouncedAutoSave(data);
      });
      unsubscribe = sub.unsubscribe;
    } else {
      const sub = fleetForm.watch((data) => {
        debouncedAutoSave(data);
      });
      unsubscribe = sub.unsubscribe;
    }

    return () => {
      unsubscribe();
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [onboardingStatus?.status, carrierType, soloForm, fleetForm, debouncedAutoSave]);

  const uploadDocMutation = useMutation({
    mutationFn: async ({ documentType, fileUrl, fileName }: { documentType: string; fileUrl: string; fileName: string }) => {
      const res = await apiRequest("POST", "/api/carrier/verification/documents", {
        documentType,
        fileName,
        fileUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/onboarding"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: error.message,
      });
    },
  });

  type SurepassResponse<T = unknown> = {
    success?: boolean;
    status_code?: number;
    data?: T;
    message?: string | null;
    message_code?: string;
  };

  const verifyAadhaarNumber = async (value: string) => {
    const trimmed = value.replace(/\s+/g, "");
    setAadhaarVerified(false);
    setAadhaarError(null);

    if (!trimmed) return;

    // When proxy is enabled (or config not loaded), validate locally only — no Surepass API call
    const useLocalValidationOnly = kycConfig?.surepassAllowProxy !== false;
    if (useLocalValidationOnly) {
      if (trimmed.length !== 12 || !/^\d+$/.test(trimmed)) {
        setAadhaarError("Please enter a valid 12-digit Aadhaar number.");
        return;
      }
      if (trimmed.startsWith("0")) {
        setAadhaarError("Please enter a valid 12-digit Aadhaar number.");
        return;
      }
      setAadhaarVerified(true);
      setAadhaarError(null);
      return;
    }

    if (!trimmed || trimmed.length !== 12 || !/^\d{12}$/.test(trimmed) || trimmed.startsWith("0")) {
      setAadhaarError("Aadhaar is invalid.");
      return;
    }

    setIsAadhaarVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/aadhaar-validation", {
        aadhaar_number: trimmed,
        request_ref: "carrier_onboarding_aadhaar",
      });
      const payload = (await res.json()) as SurepassResponse;

      if (!res.ok || !payload.success) {
        setAadhaarVerified(false);
        setAadhaarError(
          payload.message || "Aadhaar could not be verified. Please check the number and try again.",
        );
        return;
      }

      setAadhaarVerified(true);
      setAadhaarError(null);
    } catch (error: any) {
      setAadhaarVerified(false);
      setAadhaarError("Aadhaar verification failed. Please try again.");
    } finally {
      setIsAadhaarVerifying(false);
    }
  };

  const handleAadhaarFile = useCallback(async (file: File) => {
    const form = activeAadhaarFormRef.current;
    if (!form) return;

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
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const ocrSource = await prepareFileForTesseract(file, {
        scale: isPdf ? 5.5 : 4,
        enhanceContrast: isPdf,
      });
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng");
      let ocrText: string;
      if (isPdf) {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });
        const { data: { text: t1 } } = await worker.recognize(ocrSource);
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.AUTO,
        });
        const { data: { text: t2 } } = await worker.recognize(ocrSource);
        ocrText = `${t1}\n${t2}`;
      } else {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });
        const { data: { text } } = await worker.recognize(ocrSource);
        ocrText = text;
      }
      await worker.terminate();

      const digits = extractAadhaarFromOcrThenPdf(ocrText, pdfText);

      if (digits && digits.length === 12) {
        // Auto-fill Identity tab field
        form.setValue("aadhaarNumber", digits, { shouldValidate: true, shouldDirty: true });
        toast({
          title: "Aadhaar Extracted",
          description: `Aadhaar number detected: XXXX XXXX ${digits.slice(8)}`,
          duration: 4000,
        });

        // Verify for Documents tab independently
        setIsAadhaarDocVerifying(true);
        try {
          const res = await apiRequest("POST", "/api/kyc/aadhaar-validation", {
            aadhaar_number: digits,
            request_ref: "carrier_onboarding_aadhaar_doc",
          });
          const payload = await res.json();
          if (!res.ok || !payload.success) {
            setAadhaarDocError(payload.message || "Aadhaar could not be verified.");
          } else {
            setAadhaarDocVerified(true);
          }
        } catch {
          setAadhaarDocError("Aadhaar verification failed. Will be reviewed by admin.");
        } finally {
          setIsAadhaarDocVerifying(false);
        }
      } else {
        setAadhaarOcrError("Aadhaar number could not be read. Please enter it manually.");
      }
    } catch (err) {
      console.error("Tesseract OCR error:", err);
      setAadhaarOcrError("Could not read document. Please enter Aadhaar number manually.");
    } finally {
      setIsAadhaarOcrRunning(false);
    }
  }, []);

  const handleAadhaarUploadAndOcr = (
    val: string,
    form: typeof soloForm | typeof fleetForm,
    uploadDocType: string,
  ) => {
    form.setValue("aadhaarUrl", val);
    handleDocumentUpload(uploadDocType, val);
    if (!val) {
      setAadhaarDocVerified(false);
      setAadhaarDocError(null);
      setAadhaarOcrError(null);
    }
  };

  const verifyPanNumber = async (value: string) => {
    const trimmed = value.replace(/\s+/g, "").toUpperCase();
    setPanVerified(false);
    setPanError(null);

    if (!trimmed) return;

    // When proxy is enabled (or config not loaded), validate locally only — no Surepass API call
    const useLocalValidationOnly = kycConfig?.surepassAllowProxy !== false;
    if (useLocalValidationOnly) {
      if (trimmed.length !== 10 || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(trimmed)) {
        setPanError("Please enter a valid 10-character PAN number.");
        return;
      }
      setPanVerified(true);
      setPanError(null);
      return;
    }

    if (!trimmed || trimmed.length !== 10) {
      setPanError("Please enter a valid 10-character PAN number (5 letters, 4 digits, 1 letter).");
      return;
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(trimmed)) {
      setPanError("PAN is invalid.");
      return;
    }

    setIsPanVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/pan-comprehensive", {
        pan_number: trimmed,
        request_ref: "carrier_onboarding_pan",
      });
      const body = await res.json();

      if (!res.ok || !body || body.success !== true) {
        setPanVerified(false);
        setPanError(
          body?.message || "PAN could not be verified. Please check the number and try again.",
        );
        return;
      }

      setPanVerified(true);
      setPanError(null);
    } catch (error: any) {
      setPanVerified(false);
      setPanError("Unclear document — will be verified by the admin.");
    } finally {
      setIsPanVerifying(false);
    }
  };

  const verifyDrivingLicenseNumber = async (licenseValue: string, dobValue: string) => {
    const license = licenseValue.replace(/\s+/g, "").toUpperCase();
    const dob = (dobValue || "").trim();
    setLicenseVerified(false);
    setLicenseError(null);

    if (!license) return;

    if (!dob) {
      setLicenseError("Date of birth is required to verify driving license.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setLicenseError("Use DOB format YYYY-MM-DD.");
      return;
    }

    const useLocalValidationOnly = kycConfig?.surepassAllowProxy !== false;
    if (useLocalValidationOnly) {
      if (license.length < 8) {
        setLicenseError("Please enter a valid driving license number.");
        return;
      }
      setLicenseVerified(true);
      setLicenseError(null);
      return;
    }

    setIsLicenseVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/driving-license", {
        id_number: license,
        dob,
        request_ref: "carrier_onboarding_driving_license",
      });
      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        setLicenseVerified(false);
        setLicenseError(payload?.message || "Driving license could not be verified. Please check details and try again.");
        return;
      }

      setLicenseVerified(true);
      setLicenseError(null);
    } catch {
      setLicenseVerified(false);
      setLicenseError("Driving license verification failed. Will be reviewed by admin.");
    } finally {
      setIsLicenseVerifying(false);
    }
  };

  const scheduleDrivingLicenseVerification = (licenseValue: string, dobValue: string) => {
    if (drivingLicenseVerifyTimeoutRef.current) {
      clearTimeout(drivingLicenseVerifyTimeoutRef.current);
    }
    const license = (licenseValue || "").trim();
    const dob = (dobValue || "").trim();
    if (!canEdit || !license || !dob) return;

    drivingLicenseVerifyTimeoutRef.current = setTimeout(() => {
      void verifyDrivingLicenseNumber(license, dob);
    }, 450);
  };

  const handlePanFile = useCallback(async (file: File) => {
    const form = activePanFormRef.current;
    if (!form) return;

    setIsPanOcrRunning(true);
    setPanOcrError(null);
    setPanDocVerified(false);
    setPanDocError(null);

    try {
      const { prepareFileForTesseract } = await import(
        "@/lib/prepare-file-for-tesseract"
      );
      const ocrSource = await prepareFileForTesseract(file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(ocrSource);
      await worker.terminate();

      // PAN format: AAAAA9999A (5 letters, 4 digits, 1 letter)
      const normalized = text.replace(/[\n\r]/g, " ").toUpperCase();

      // Pass 1: direct match
      let pan = normalized.match(/[A-Z]{5}[0-9]{4}[A-Z]/)?.[0] || "";

      // Pass 2: collapse whitespace and retry
      if (!pan) {
        const compact = normalized.replace(/\s+/g, "");
        pan = compact.match(/[A-Z]{5}[0-9]{4}[A-Z]/)?.[0] || "";
      }

      // Pass 3: fix common OCR misreads (O↔0, I↔1, S↔5, B↔8) then retry
      if (!pan) {
        const fixed = normalized
          .replace(/O/g, "0").replace(/I/g, "1").replace(/S/g, "5").replace(/B/g, "8")
          .replace(/\s+/g, "");
        const candidate = fixed.match(/[A-Z0-9]{10}/)?.[0] || "";
        if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(candidate)) pan = candidate;
      }

      if (pan.length === 10) {
        // Auto-fill Identity tab field
        form.setValue("panNumber", pan, { shouldValidate: true, shouldDirty: true });
        toast({
          title: "PAN Extracted",
          description: `PAN number detected: ${pan}`,
          duration: 4000,
        });

        // Verify for Documents tab independently
        setIsPanDocVerifying(true);
        try {
          const res = await apiRequest("POST", "/api/kyc/pan-comprehensive", {
            pan_number: pan,
            request_ref: "carrier_onboarding_pan_doc",
          });
          const body = await res.json();
          if (!res.ok || body?.success !== true) {
            setPanDocError(body?.message || "PAN could not be verified.");
          } else {
            setPanDocVerified(true);
          }
        } catch {
          setPanDocError("PAN verification failed. Will be reviewed by admin.");
        } finally {
          setIsPanDocVerifying(false);
        }
      } else {
        setPanOcrError("PAN number could not be read. Please enter it manually.");
      }
    } catch (err) {
      console.error("Tesseract PAN OCR error:", err);
      setPanOcrError("Could not read document. Please enter PAN number manually.");
    } finally {
      setIsPanOcrRunning(false);
    }
  }, []);

  const handlePanUploadAndOcr = (
    val: string,
    form: typeof soloForm | typeof fleetForm,
    uploadDocType: string,
  ) => {
    form.setValue("panUrl", val);
    handleDocumentUpload(uploadDocType, val);
    if (!val) {
      setPanDocVerified(false);
      setPanDocError(null);
      setPanOcrError(null);
    }
  };

  const handleLicenseFile = useCallback(async (file: File) => {
    const form = activeLicenseFormRef.current;
    if (!form) return;

    setIsLicenseOcrRunning(true);
    setLicenseOcrError(null);
    setLicenseVerified(false);
    setLicenseError(null);

    try {
      const { prepareFileForTesseract } = await import(
        "@/lib/prepare-file-for-tesseract"
      );
      const ocrSource = await prepareFileForTesseract(file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(ocrSource);
      await worker.terminate();

      const normalized = text.replace(/[\n\r]/g, " ").toUpperCase();
      const compact = normalized.replace(/[^A-Z0-9]/g, "");

      // Common Indian DL formats, including full 15-char pattern like UK0620130073251
      const dlCandidate =
        compact.match(/[A-Z]{2}\d{13}/)?.[0] ||
        compact.match(/[A-Z]{2}\d{2}\d{4}\d{7}/)?.[0] ||
        compact.match(/[A-Z]{2}\d{11,13}/)?.[0] ||
        "";

      // DOB parsing: prefer DOB-labeled dates and avoid DOI/DOE/validity dates.
      const toIsoDate = (raw: string): string | null => {
        const token = raw.replace(/[.]/g, "-").replace(/\//g, "-").trim();
        const ymd = token.match(/^((19|20)\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/);
        if (ymd) return `${ymd[1]}-${ymd[3]}-${ymd[4]}`;
        const dmy = token.match(/^([0-2]\d|3[01])-(0[1-9]|1[0-2])-((19|20)\d{2})$/);
        if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
        return null;
      };

      const extractLabeledDob = (source: string): string | null => {
        const patterns = [
          /(?:DATE\s*OF\s*BIRTH|D\.?\s*O\.?\s*B|DOB|BIRTH)\s*[:\-]?\s*((?:19|20)\d{2}[-\/.](?:0[1-9]|1[0-2])[-\/.](?:[0-2]\d|3[01]))/i,
          /(?:DATE\s*OF\s*BIRTH|D\.?\s*O\.?\s*B|DOB|BIRTH)\s*[:\-]?\s*((?:[0-2]\d|3[01])[-\/.](?:0[1-9]|1[0-2])[-\/.](?:19|20)\d{2})/i,
        ];
        for (const p of patterns) {
          const m = source.match(p);
          const iso = m?.[1] ? toIsoDate(m[1]) : null;
          if (iso) return iso;
        }
        return null;
      };

      const extractDobNearLabel = (source: string): string | null => {
        const tokenRegex = /((?:19|20)\d{2}[-\/.](?:0[1-9]|1[0-2])[-\/.](?:[0-2]\d|3[01])|(?:[0-2]\d|3[01])[-\/.](?:0[1-9]|1[0-2])[-\/.](?:19|20)\d{2})/g;
        let m: RegExpExecArray | null = null;
        while ((m = tokenRegex.exec(source)) !== null) {
          const start = Math.max(0, m.index - 30);
          const context = source.slice(start, m.index);
          if (/(DOI|DOE|ISSUE|VALID|EXPIRY|EXP|TRANSPORT_DOI|TRANSPORT_DOE)/i.test(context)) {
            continue;
          }
          if (/(DATE\s*OF\s*BIRTH|D\.?\s*O\.?\s*B|DOB|BIRTH)/i.test(context)) {
            const iso = toIsoDate(m[1]);
            if (iso) return iso;
          }
        }
        return null;
      };

      let dob = extractLabeledDob(normalized) || extractDobNearLabel(normalized) || "";

      if (!dlCandidate) {
        setLicenseOcrError("Driving license number could not be read. Please enter it manually.");
        return;
      }
      if (!dob) {
        setLicenseOcrError("DOB could not be read from license. Please enter DOB manually as YYYY-MM-DD.");
      }

      form.setValue("driverLicenseNumber", dlCandidate, { shouldValidate: true, shouldDirty: true });
      if (dob) {
        form.setValue("driverLicenseDob", dob, { shouldValidate: true, shouldDirty: true });
      }

      toast({
        title: "Driving License Extracted",
        description: dob
          ? `DL: ${dlCandidate}, DOB: ${dob}`
          : `DL: ${dlCandidate}. Enter DOB manually to verify.`,
        duration: 4000,
      });

      if (dob) {
        void verifyDrivingLicenseNumber(dlCandidate, dob);
      }
    } catch (err) {
      console.error("Tesseract driving license OCR error:", err);
      setLicenseOcrError("Could not read driving license. Please enter details manually.");
    } finally {
      setIsLicenseOcrRunning(false);
    }
  }, []);

  const verifyRcNumber = async (value: string) => {
    const rc = value.replace(/[\s\-]/g, "").toUpperCase();
    setRcVerified(false);
    setRcError(null);
    setRcOwnerName(null);

    if (!rc || rc.length < 5) return;

    setIsRcVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/rc-owner-history", {
        rc_number: rc,
        request_ref: "carrier_onboarding_rc",
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
  };

  const handleRcFile = useCallback(async (file: File) => {
    const form = activeRcFormRef.current;
    if (!form) return;

    setIsRcOcrRunning(true);
    setRcOcrError(null);
    setRcDocVerified(false);
    setRcDocError(null);
    setRcDocOwnerName(null);

    try {
      const { prepareFileForTesseract } = await import(
        "@/lib/prepare-file-for-tesseract"
      );
      const ocrSource = await prepareFileForTesseract(file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(ocrSource);
      await worker.terminate();

      // RC number format: XX##XX#### (e.g. UK06CB8676, MH01AB1234)
      // Also handles spaced/dashed variants: UK-06-CB-8676
      const normalized = text.replace(/[\n\r]/g, " ").toUpperCase();
      const compact = normalized.replace(/[\s\-]/g, "");

      const match = compact.match(/[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}/);
      const rc = match?.[0] || "";

      if (rc.length >= 8) {
        form.setValue("uniqueRegistrationNumber", rc, { shouldValidate: true, shouldDirty: true });
        toast({
          title: "RC Number Extracted",
          description: `Registration number detected: ${rc}`,
          duration: 4000,
        });

        // Verify for Documents tab independently
        setIsRcDocVerifying(true);
        try {
          const res = await apiRequest("POST", "/api/kyc/rc-owner-history", {
            rc_number: rc,
            request_ref: "carrier_onboarding_rc_doc",
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
      } else {
        setRcOcrError("RC number could not be read. Please enter it manually.");
      }
    } catch (err) {
      console.error("Tesseract RC OCR error:", err);
      setRcOcrError("Could not read document. Please enter RC number manually.");
    } finally {
      setIsRcOcrRunning(false);
    }
  }, []);

  const handleRcUploadAndOcr = (
    val: string,
    form: typeof soloForm | typeof fleetForm,
  ) => {
    form.setValue("rcUrl", val);
    handleDocumentUpload("rc", val);
    if (!val) {
      setRcDocVerified(false);
      setRcDocError(null);
      setRcDocOwnerName(null);
      setRcOcrError(null);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/carrier/onboarding/submit", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/onboarding"] });
      toast({
        title: t("carrierOnboarding.submitted"),
        description: t("carrierOnboarding.submittedDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: error.message,
      });
    },
  });

  const handleDocumentUpload = (documentType: string, value: string) => {
    if (!value) return;
    
    try {
      const parsed = JSON.parse(value);
      if (parsed.path) {
        uploadDocMutation.mutate({
          documentType,
          fileUrl: parsed.path,
          fileName: parsed.name || "Uploaded Document",
        });
      }
    } catch {
      // Legacy plain URL format
      uploadDocMutation.mutate({
        documentType,
        fileUrl: value,
        fileName: "Uploaded Document",
      });
    }
  };

  const handleSubmit = async () => {
    if (!consentChecked) {
      toast({
        variant: "destructive",
        title: "Consent Required",
        description: "Please accept the Data Processing Agreement before submitting.",
      });
      return;
    }
    // Cancel any pending debounced auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    
    // Validate form before submitting
    if (carrierType === "solo") {
      const values = soloForm.getValues();
      const missingFields: string[] = [];
      
      // Check Identity tab fields
      if (!values.aadhaarNumber || values.aadhaarNumber.length < 12) {
        missingFields.push("Aadhaar Number (Identity tab)");
      }
      if (!values.driverLicenseNumber) {
        missingFields.push("Driver License Number (Identity tab)");
      }
      if (!values.panNumber || values.panNumber.length < 10) {
        missingFields.push("PAN Number (Identity tab)");
      }
      if (!values.permitType) {
        missingFields.push("Permit Type (Vehicle tab)");
      }
      
      // Check Vehicle tab fields
      if (!values.licensePlateNumber) {
        missingFields.push("License Plate Number (Vehicle tab)");
      }
      if (!values.chassisNumber) {
        missingFields.push("Chassis Number (Vehicle tab)");
      }
      
      if (missingFields.length > 0) {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: "Fill all the required details"
        });
        // Navigate to the appropriate tab
        if (missingFields.some(f => f.includes("Identity"))) {
          setActiveTab("identity");
        } else if (missingFields.some(f => f.includes("Vehicle"))) {
          setActiveTab("vehicle");
        }
        return;
      }
      
      // Save form data immediately before submit
      try {
        setAutoSaveStatus("saving");
        await apiRequest("PATCH", "/api/carrier/onboarding/draft", values);
      } catch (error) {
        // Continue with submit even if save fails - server will validate
      }
    } else {
      const values = fleetForm.getValues();
      const missingFields: string[] = [];
      
      if (!values.aadhaarNumber || values.aadhaarNumber.length < 12) {
        missingFields.push("Aadhaar Number (Identity tab)");
      }
      if (!values.businessType) {
        missingFields.push("Business Type (Identity tab)");
      }
      if (values.businessType === "registered_partnership") {
        if (!values.noGstinNumber && !values.gstinNumber) {
          missingFields.push("GSTIN Number (Identity tab)");
        }
      }
      if (values.businessType === "non_registered_partnership") {
        if (!values.driverLicenseNumber) {
          missingFields.push("Partner Driver License Number (Identity tab)");
        }
        if (!values.panNumber || values.panNumber.length < 10) {
          missingFields.push("Partner PAN Number (Identity tab)");
        }
        if (!values.partnerName) {
          missingFields.push("Partner Name (Identity tab)");
        }
      }
      if (values.businessType === "other") {
        if (!values.cinNumber) {
          missingFields.push("CIN Number (Identity tab)");
        }
      }
      if (!values.businessAddress) {
        missingFields.push("Business Address (Identity tab)");
      }
      
      if (!values.licensePlateNumber) {
        missingFields.push("License Plate Number (Vehicle tab)");
      }
      if (!values.chassisNumber) {
        missingFields.push("Chassis Number (Vehicle tab)");
      }
      if (!values.permitType) {
        missingFields.push("Permit Type (Vehicle tab)");
      }
      
      if (missingFields.length > 0) {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: "Fill all the required details"
        });
        // Navigate to the appropriate tab
        if (missingFields.some(f => f.includes("Identity"))) {
          setActiveTab("identity");
        } else if (missingFields.some(f => f.includes("Vehicle"))) {
          setActiveTab("vehicle");
        }
        return;
      }
      
      // Save form data immediately before submit
      try {
        setAutoSaveStatus("saving");
        await apiRequest("PATCH", "/api/carrier/onboarding/draft", values);
      } catch (error) {
        // Continue with submit even if save fails - server will validate
      }
    }
    
    submitMutation.mutate();
  };

  const getStatusBadge = () => {
    const status = onboardingStatus?.status;
    if (!status || status === "draft") return null;
    
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { variant: "secondary", icon: Clock },
      under_review: { variant: "default", icon: Shield },
      approved: { variant: "default", icon: Check },
      rejected: { variant: "destructive", icon: AlertCircle },
      on_hold: { variant: "outline", icon: AlertCircle },
    };
    
    const config = variants[status] || { variant: "secondary" as const, icon: Clock };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {t(`carrierOnboarding.status.${status}`)}
      </Badge>
    );
  };

  const canEdit = !onboardingStatus?.status || ["draft", "on_hold", "rejected", "pending", "under_review"].includes(onboardingStatus.status);

  const requiresPanVerification =
    carrierType === "solo" ||
    (carrierType === "enterprise" && fleetForm.watch("businessType") === "non_registered_partnership");

  const currentAadhaar =
    carrierType === "solo" ? soloForm.watch("aadhaarNumber") : fleetForm.watch("aadhaarNumber");
  const currentPan =
    carrierType === "solo"
      ? soloForm.watch("panNumber")
      : fleetForm.watch("panNumber");



  if (isLoadingStatus) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (onboardingStatus?.status === "approved") {
    return (
      <div className="container max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">{t("carrierOnboarding.approved")}</CardTitle>
            <CardDescription>{t("carrierOnboarding.approvedDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setLocation("/carrier/loads")} data-testid="button-go-marketplace">
              {t("carrierOnboarding.goToMarketplace")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Removed the pending/under_review block - carriers can now edit while pending

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("carrierOnboarding.title")}</h1>
            <p className="text-muted-foreground mt-2">{t("carrierOnboarding.subtitle")}</p>
          </div>
          <div className="flex items-center gap-4">
            {getStatusBadge()}
            {autoSaveStatus === "saving" && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("common.saving")}
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                {t("common.saved")}
              </span>
            )}
          </div>
        </div>

        {(onboardingStatus?.status === "pending" || onboardingStatus?.status === "under_review") && (
          <Card className="mt-4 border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-700 dark:text-blue-300">{t("carrierOnboarding.pendingReview")}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{t("carrierOnboarding.pendingReviewDesc")} You can still make edits and resubmit.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {onboardingStatus?.status === "rejected" && onboardingStatus.rejectionReason && (
          <Card className="mt-4 border-destructive">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">{t("carrierOnboarding.rejectedReason")}</p>
                  <p className="text-sm text-muted-foreground">{onboardingStatus.rejectionReason}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    For assistance, please contact us at <a href="tel:+919876543210" className="text-primary font-medium underline">+91 98765 43210</a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {onboardingStatus?.status === "on_hold" && (
          <Card className="mt-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-700 dark:text-yellow-500">Your verification is on hold</p>
                  {onboardingStatus.notes ? (
                    <p className="text-sm mt-1">{onboardingStatus.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Please review and update your information below, then resubmit for review.</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    For assistance, please contact support at <a href="tel:+919876543210" className="text-primary font-medium underline">+91 98765 43210</a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {carrierType === "solo" ? (
              <>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("carrierOnboarding.soloOperator")}</h3>
                  <p className="text-sm text-muted-foreground">{t("carrierOnboarding.soloDesc")}</p>
                </div>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("carrierOnboarding.fleetCompany")}</h3>
                  <p className="text-sm text-muted-foreground">{t("carrierOnboarding.fleetDesc")}</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {carrierType === "solo" ? (
        <Form {...soloForm} key="solo-form">
          <form>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="w-full overflow-x-auto scrollbar-hide -mx-2 px-2">
                <TabsList className="inline-flex w-auto min-w-full">
                  <TabsTrigger value="identity" className="gap-2 flex-1 min-w-[120px]">
                    <IdCard className="h-4 w-4" />
                    {t("carrierOnboarding.identityTab")}
                  </TabsTrigger>
                  <TabsTrigger value="vehicle" className="gap-2 flex-1 min-w-[120px]">
                    <Truck className="h-4 w-4" />
                    {t("carrierOnboarding.vehicleTab")}
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="gap-2 flex-1 min-w-[120px]">
                    <CreditCard className="h-4 w-4" />
                    Bank Details
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="gap-2 flex-1 min-w-[120px]">
                    <FileText className="h-4 w-4" />
                    {t("carrierOnboarding.documentsTab")}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="identity">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("carrierOnboarding.personalInfo")}</CardTitle>
                    <CardDescription>{t("carrierOnboarding.personalInfoDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={soloForm.control}
                      name="aadhaarNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.aadhaarNumber")} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="XXXX XXXX XXXX"
                              maxLength={12}
                              disabled={!canEdit}
                              data-testid="input-aadhaar"
                              onChange={(e) => {
                                setAadhaarVerified(false);
                                setAadhaarError(null);
                                const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 12);
                                field.onChange(digitsOnly);
                              }}
                              onBlur={(e) => {
                                field.onBlur();
                                if (canEdit) {
                                  void verifyAadhaarNumber(e.target.value);
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                          {isAadhaarVerifying && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifying Aadhaar...
                            </p>
                          )}
                          {!isAadhaarVerifying && aadhaarVerified && !aadhaarError && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Aadhaar number verified successfully.
                            </p>
                          )}
                          {!isAadhaarVerifying && aadhaarError && (
                            <p className="text-xs text-red-600 mt-1">{aadhaarError}</p>
                          )}
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="driverLicenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.driverLicense")} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="DL-XXXXXXXXX"
                              disabled={!canEdit}
                              data-testid="input-license"
                              onChange={(e) => {
                                setLicenseVerified(false);
                                setLicenseError(null);
                                const nextLicense = e.target.value.toUpperCase();
                                field.onChange(nextLicense);
                                scheduleDrivingLicenseVerification(
                                  nextLicense,
                                  soloForm.getValues("driverLicenseDob") || "",
                                );
                              }}
                              onBlur={(e) => {
                                field.onBlur();
                                if (canEdit) {
                                  void verifyDrivingLicenseNumber(e.target.value, soloForm.getValues("driverLicenseDob") || "");
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                          {isLicenseVerifying && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifying driving license...
                            </p>
                          )}
                          {!isLicenseVerifying && licenseVerified && !licenseError && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Driving license verified successfully.
                            </p>
                          )}
                          {!isLicenseVerifying && licenseError && (
                            <p className="text-xs text-red-600 mt-1">{licenseError}</p>
                          )}
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="driverLicenseDob"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Holder DOB (for verification)</FormLabel>
                          <FormControl>
                            <Input
                              {...(() => { const { onChange: _o, ...rest } = field; return rest; })()}
                              type="text"
                              inputMode="numeric"
                              placeholder="YYYY-MM-DD"
                              disabled={!canEdit}
                              data-testid="input-license-dob"
                              onChange={(e) => {
                                const raw = e.target.value;
                                const digits = raw.replace(/\D/g, "").slice(0, 8);
                                let formatted = digits;
                                if (digits.length >= 5) {
                                  formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
                                } else if (digits.length >= 3) {
                                  formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
                                }
                                field.onChange(formatted);
                                scheduleDrivingLicenseVerification(
                                  soloForm.getValues("driverLicenseNumber") || "",
                                  formatted,
                                );
                              }}
                              onBlur={(e) => {
                                field.onBlur();
                                const license = soloForm.getValues("driverLicenseNumber") || "";
                                if (canEdit && license) {
                                  void verifyDrivingLicenseNumber(license, e.target.value);
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">Format: YYYY-MM-DD</p>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="panNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN Number *</FormLabel>
                          <FormControl>
                            <Input
                              {...(() => { const { onChange: _o, ...rest } = field; return rest; })()}
                              placeholder="XXXXX0000X"
                              maxLength={10}
                              disabled={!canEdit}
                              data-testid="input-solo-pan"
                              onChange={(e) => {
                                setPanVerified(false);
                                setPanError(null);
                                field.onChange(e.target.value.toUpperCase());
                              }}
                              onBlur={(e) => {
                                field.onBlur();
                                if (canEdit) {
                                  void verifyPanNumber(e.target.value);
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                          {isPanVerifying && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifying PAN...
                            </p>
                          )}
                          {!isPanVerifying && panVerified && !panError && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <Check className="h-3 w-3" /> PAN number verified successfully.
                            </p>
                          )}
                          {!isPanVerifying && panError && (
                            <p className="text-xs text-red-600 mt-1">{panError}</p>
                          )}
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="businessAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Address *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Registered office address" disabled={!canEdit} data-testid="input-solo-business-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="businessLocality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Locality / Area * <span className="text-muted-foreground font-normal">(e.g. Andheri West, Bandra)</span></FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="" disabled={!canEdit} data-testid="input-solo-business-locality" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vehicle">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("carrierOnboarding.vehicleInfo")}</CardTitle>
                    <CardDescription>{t("carrierOnboarding.vehicleInfoDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={soloForm.control}
                      name="licensePlateNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.licensePlate")} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="MH-01-AB-1234"
                              className="uppercase"
                              maxLength={13}
                              disabled={!canEdit}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              onBlur={() => { field.onBlur(); void soloForm.trigger("licensePlateNumber"); }}
                              data-testid="input-plate"
                            />
                          </FormControl>
                      <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="chassisNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.chassisNumber")} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="XXXXXXXXXXXXXXXXX"
                              className="uppercase"
                              maxLength={17}
                              disabled={!canEdit}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              onBlur={() => { field.onBlur(); void soloForm.trigger("chassisNumber"); }}
                              data-testid="input-chassis"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="uniqueRegistrationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.registrationNumber")}</FormLabel>
                          <FormControl>
                          <Input
                            {...field}
                            placeholder="RC number (e.g. MH01AB1234)"
                            disabled={!canEdit}
                            data-testid="input-reg-number"
                            onBlur={(e) => {
                              field.onBlur();
                              if (canEdit) void verifyRcNumber(e.target.value);
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
                    <FormField
                      control={soloForm.control}
                      name="permitType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.permitType")} *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                            <FormControl>
                              <SelectTrigger data-testid="select-permit-type">
                                <SelectValue placeholder="Select permit type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="national">{t("carrierOnboarding.nationalPermit")}</SelectItem>
                              <SelectItem value="domestic">{t("carrierOnboarding.domesticPermit")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bank">
                <Card>
                  <CardHeader>
                    <CardTitle>Bank Account Details</CardTitle>
                    <CardDescription>Enter your bank details for payment processing</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={soloForm.control}
                      name="bankAccountHolderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Holder Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Name as per bank records" disabled={!canEdit} data-testid="input-bank-holder-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name <span className="text-muted-foreground font-normal">(e.g. State Bank of India)</span></FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="" disabled={!canEdit} data-testid="input-bank-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="" disabled={!canEdit} data-testid="input-bank-account" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={soloForm.control}
                      name="bankIfscCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFSC Code <span className="text-muted-foreground font-normal">(e.g. SBIN0001234)</span></FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder=""
                              className="uppercase"
                              maxLength={11}
                              disabled={!canEdit}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              onBlur={() => { field.onBlur(); void soloForm.trigger("bankIfscCode"); }}
                              data-testid="input-bank-ifsc"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div>
                      <label className="text-sm font-medium mb-2 block">Void Cheque / Cancelled Cheque</label>
                      <DocumentUploadWithCamera
                        value={soloForm.watch("voidChequeUrl") || ""}
                        onChange={(val) => {
                          soloForm.setValue("voidChequeUrl", val);
                          handleDocumentUpload("void_cheque", val);
                        }}
                        disabled={!canEdit}
                        documentType="void_cheque"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("carrierOnboarding.requiredDocs")}</CardTitle>
                    <CardDescription>{t("carrierOnboarding.requiredDocsDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("carrierOnboarding.aadhaarCard")} *</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("aadhaarUrl") || ""}
                          onChange={(val) => handleAadhaarUploadAndOcr(val, soloForm, "aadhaar")}
                          onFile={(file) => { activeAadhaarFormRef.current = soloForm; handleAadhaarFile(file); }}
                          disabled={!canEdit}
                          documentType="aadhaar_card"
                        />
                        {isAadhaarOcrRunning && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Reading Aadhaar number from document…
                          </p>
                        )}
                        {!isAadhaarOcrRunning && isAadhaarDocVerifying && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Verifying Aadhaar…
                          </p>
                        )}
                        {!isAadhaarOcrRunning && !isAadhaarDocVerifying && aadhaarDocVerified && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Aadhaar verified successfully.
                          </p>
                        )}
                        {!isAadhaarOcrRunning && !isAadhaarDocVerifying && aadhaarDocError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {aadhaarDocError}
                          </p>
                        )}
                        {aadhaarOcrError && !isAadhaarOcrRunning && (
                          <p className="text-xs text-amber-600 mt-1">{aadhaarOcrError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("carrierOnboarding.driverLicenseDoc")} *</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("licenseUrl") || ""}
                          onChange={(val) => {
                            soloForm.setValue("licenseUrl", val);
                            handleDocumentUpload("license", val);
                            if (!val) {
                              setLicenseOcrError(null);
                              setLicenseVerified(false);
                              setLicenseError(null);
                            }
                          }}
                          onFile={(file) => { activeLicenseFormRef.current = soloForm; handleLicenseFile(file); }}
                          disabled={!canEdit}
                          documentType="driver_license"
                        />
                        {isLicenseOcrRunning && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Reading driving license details from document...
                          </p>
                        )}
                        {!isLicenseOcrRunning && isLicenseVerifying && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Verifying driving license...
                          </p>
                        )}
                        {!isLicenseOcrRunning && !isLicenseVerifying && licenseVerified && !licenseError && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Driving license verified successfully.
                          </p>
                        )}
                        {!isLicenseOcrRunning && !isLicenseVerifying && licenseError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {licenseError}
                          </p>
                        )}
                        {licenseOcrError && !isLicenseOcrRunning && (
                          <p className="text-xs text-amber-600 mt-1">{licenseOcrError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">PAN Card *</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("panUrl") || ""}
                          onChange={(val) => handlePanUploadAndOcr(val, soloForm, "pan")}
                          onFile={(file) => { activePanFormRef.current = soloForm; handlePanFile(file); }}
                          disabled={!canEdit}
                          documentType="pan_card"
                        />
                        {isPanOcrRunning && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Reading PAN number from document…
                          </p>
                        )}
                        {!isPanOcrRunning && isPanDocVerifying && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Verifying PAN…
                          </p>
                        )}
                        {!isPanOcrRunning && !isPanDocVerifying && panDocVerified && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Check className="h-3 w-3" /> PAN verified successfully.
                          </p>
                        )}
                        {!isPanOcrRunning && !isPanDocVerifying && panDocError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {panDocError}
                          </p>
                        )}
                        {panOcrError && !isPanOcrRunning && (
                          <p className="text-xs text-amber-600 mt-1">{panOcrError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("carrierOnboarding.permitDoc")} *</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("permitUrl") || ""}
                          onChange={(val) => {
                            soloForm.setValue("permitUrl", val);
                            handleDocumentUpload("permit", val);
                          }}
                          disabled={!canEdit}
                          documentType="permit"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("carrierOnboarding.rcDoc")} *</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("rcUrl") || ""}
                          onChange={(val) => handleRcUploadAndOcr(val, soloForm)}
                          onFile={(file) => { activeRcFormRef.current = soloForm; handleRcFile(file); }}
                          disabled={!canEdit}
                          documentType="registration_certificate"
                        />
                        {isRcOcrRunning && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Reading RC number from document…
                          </p>
                        )}
                        {!isRcOcrRunning && isRcDocVerifying && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Verifying RC…
                          </p>
                        )}
                        {!isRcOcrRunning && !isRcDocVerifying && rcDocVerified && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Check className="h-3 w-3" /> RC verified.{rcDocOwnerName ? ` Owner: ${rcDocOwnerName}` : ""}
                          </p>
                        )}
                        {!isRcOcrRunning && !isRcDocVerifying && rcDocError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {rcDocError}
                          </p>
                        )}
                        {rcOcrError && !isRcOcrRunning && (
                          <p className="text-xs text-amber-600 mt-1">{rcOcrError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("carrierOnboarding.insuranceDoc")} *</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("insuranceUrl") || ""}
                          onChange={(val) => {
                            soloForm.setValue("insuranceUrl", val);
                            handleDocumentUpload("insurance", val);
                          }}
                          disabled={!canEdit}
                          documentType="insurance_certificate"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("carrierOnboarding.fitnessDoc")} *</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("fitnessUrl") || ""}
                          onChange={(val) => {
                            soloForm.setValue("fitnessUrl", val);
                            handleDocumentUpload("fitness", val);
                          }}
                          disabled={!canEdit}
                          documentType="fitness_certificate"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">TDS Declaration (Optional)</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("tdsDeclarationUrl") || ""}
                          onChange={(val) => {
                            soloForm.setValue("tdsDeclarationUrl", val);
                            handleDocumentUpload("tds_declaration", val);
                          }}
                          disabled={!canEdit}
                          documentType="tds_declaration"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Selfie</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("selfieUrl") || ""}
                          onChange={(val) => {
                            soloForm.setValue("selfieUrl", val);
                            handleDocumentUpload("selfie", val);
                          }}
                          disabled={!canEdit}
                          documentType="selfie"
                          preferCamera={true}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">MSME / Udyam Certificate (If applicable)</label>
                        <DocumentUploadWithCamera
                          value={soloForm.watch("msmeUdyamUrl") || ""}
                          onChange={(val) => {
                            soloForm.setValue("msmeUdyamUrl", val);
                            handleDocumentUpload("msme_udyam", val);
                          }}
                          disabled={!canEdit}
                          documentType="msme_udyam"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab Navigation Footer */}
              {canEdit && (
                <div className="mt-6 space-y-3">
                  {activeTab === "documents" && (
                    <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/40">
                      <Checkbox
                        id="consent-check"
                        checked={consentChecked}
                        onCheckedChange={(v) => setConsentChecked(!!v)}
                        className="mt-0.5"
                      />
                      <label htmlFor="consent-check" className="text-sm leading-relaxed cursor-pointer select-none">
                        I have read and agree to the{" "}
                        <button
                          type="button"
                          className="text-primary underline font-medium"
                          onClick={() => setConsentModalOpen(true)}
                        >
                          Data Processing Consent
                        </button>{" "}
                        terms. I provide my free, informed, and unambiguous consent to the collection, processing, and sharing of my personal data by LoadPilot.
                      </label>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <Button
                      type="button"
                      variant="secondary" className="bg-gray-500 hover:bg-gray-600 text-white text-base px-6 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => {
                        const tabs = ["identity", "vehicle", "bank", "documents"];
                        const idx = tabs.indexOf(activeTab);
                        if (idx > 0) setActiveTab(tabs[idx - 1]);
                      }}
                      disabled={activeTab === "identity"}
                    >
                      Previous
                    </Button>
                    {activeTab !== "documents" ? (
                      <Button
                        type="button"
                        onClick={() => {
                          const tabs = ["identity", "vehicle", "bank", "documents"];
                          const idx = tabs.indexOf(activeTab);
                          if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1]);
                        }}
                      >
                        Next
                      </Button>
                    ) : (
                      (() => {
                        const soloDocChecks = [
                          { label: "Aadhaar Card", uploaded: !!soloForm.watch("aadhaarUrl"), verified: aadhaarDocVerified },
                          { label: "Driver License", uploaded: !!soloForm.watch("licenseUrl"), verified: licenseVerified },
                          { label: "PAN Card", uploaded: !!soloForm.watch("panUrl"), verified: panDocVerified },
                          { label: "RC", uploaded: !!soloForm.watch("rcUrl"), verified: rcDocVerified },
                        ];
                        const soloPending = soloDocChecks.filter(d => !d.uploaded || !d.verified);
                        const soloDocsReady = soloPending.length === 0;
                        return (
                          <div className="flex flex-col items-end gap-2">
                            {!soloDocsReady && (
                              <p className="text-xs text-amber-600 flex items-start gap-1 text-right">
                                <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                {soloPending.map(d =>
                                  !d.uploaded ? `Upload ${d.label}.` : `Verify ${d.label}.`
                                ).join(" ")}
                              </p>
                            )}
                            <Button
                              type="button"
                              onClick={handleSubmit}
                              disabled={submitMutation.isPending || isAadhaarVerifying || isPanVerifying || !consentChecked || !soloDocsReady}
                              data-testid="button-submit-onboarding"
                            >
                              {submitMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {t("common.submitting")}
                                </>
                              ) : (
                                <>
                                  <Upload className="mr-2 h-4 w-4" />
                                  {t("carrierOnboarding.submitForReview")}
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              )}
            </Tabs>
          </form>
        </Form>
      ) : (
        <Form {...fleetForm} key="fleet-form">
          <form>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="w-full overflow-x-auto scrollbar-hide -mx-2 px-2">
                <TabsList className="inline-flex w-auto min-w-full">
                  <TabsTrigger value="identity" className="gap-2 flex-1 min-w-[120px]">
                    <IdCard className="h-4 w-4" />
                    {t("carrierOnboarding.identityTab")}
                  </TabsTrigger>
                  <TabsTrigger value="vehicle" className="gap-2 flex-1 min-w-[120px]">
                    <Truck className="h-4 w-4" />
                    {t("carrierOnboarding.vehicleTab")}
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="gap-2 flex-1 min-w-[120px]">
                    <CreditCard className="h-4 w-4" />
                    Bank Details
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="gap-2 flex-1 min-w-[120px]">
                    <FileText className="h-4 w-4" />
                    {t("carrierOnboarding.documentsTab")}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="identity">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("carrierOnboarding.personalInfo")}</CardTitle>
                    <CardDescription>{t("carrierOnboarding.personalInfoDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={fleetForm.control}
                      name="businessType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={!canEdit}>
                            <FormControl>
                              <SelectTrigger data-testid="select-fleet-business-type">
                                <SelectValue placeholder="Select your business type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                              <SelectItem value="registered_partnership">Registered Partnership</SelectItem>
                              <SelectItem value="non_registered_partnership">Non-Registered Partnership</SelectItem>
                              <SelectItem value="other">Other (Pvt Ltd, LLP, etc.)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fleetForm.control}
                      name="aadhaarNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.aadhaarNumber")} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="XXXX XXXX XXXX"
                              maxLength={12}
                              disabled={!canEdit}
                              data-testid="input-fleet-aadhaar"
                              onChange={(e) => {
                                setAadhaarVerified(false);
                                setAadhaarError(null);
                                const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 12);
                                field.onChange(digitsOnly);
                              }}
                              onBlur={(e) => {
                                field.onBlur();
                                if (canEdit) {
                                  void verifyAadhaarNumber(e.target.value);
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                          {isAadhaarVerifying && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifying Aadhaar...
                            </p>
                          )}
                          {!isAadhaarVerifying && aadhaarVerified && !aadhaarError && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Aadhaar number verified successfully.
                            </p>
                          )}
                          {!isAadhaarVerifying && aadhaarError && (
                            <p className="text-xs text-red-600 mt-1">{aadhaarError}</p>
                          )}
                        </FormItem>
                      )}
                    />
                    {fleetForm.watch("businessType") === "registered_partnership" && (
                      <>
                        {!fleetForm.watch("noGstinNumber") && (
                          <FormField
                            control={fleetForm.control}
                            name="gstinNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>GSTIN Number *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="22XXXXX0000X1Z5" maxLength={15} disabled={!canEdit} data-testid="input-fleet-gstin" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                        )}
                        <FormField
                          control={fleetForm.control}
                          name="noGstinNumber"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    if (checked) {
                                      fleetForm.setValue("gstinNumber", "");
                                    }
                                  }}
                                  disabled={!canEdit}
                                  data-testid="checkbox-no-gstin"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="cursor-pointer">
                                  I do not have GSTIN Number
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    {fleetForm.watch("businessType") === "non_registered_partnership" && (
                      <>
                        <div className="border-t pt-4 mt-4">
                          <p className="text-sm font-medium mb-3">Partner Details (for one partner)</p>
                        </div>
                        <FormField
                          control={fleetForm.control}
                          name="partnerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Partner Full Name *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Full name of partner" disabled={!canEdit} data-testid="input-fleet-partner-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={fleetForm.control}
                          name="driverLicenseNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Partner Driver License Number *</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="DL-XXXXXXXXX"
                                  disabled={!canEdit}
                                  data-testid="input-fleet-license"
                                  onChange={(e) => {
                                    setLicenseVerified(false);
                                    setLicenseError(null);
                                    const nextLicense = e.target.value.toUpperCase();
                                    field.onChange(nextLicense);
                                    scheduleDrivingLicenseVerification(
                                      nextLicense,
                                      fleetForm.getValues("driverLicenseDob") || "",
                                    );
                                  }}
                                  onBlur={(e) => {
                                    field.onBlur();
                                    if (canEdit) {
                                      void verifyDrivingLicenseNumber(e.target.value, fleetForm.getValues("driverLicenseDob") || "");
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                              {isLicenseVerifying && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Verifying driving license...
                                </p>
                              )}
                              {!isLicenseVerifying && licenseVerified && !licenseError && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Driving license verified successfully.
                                </p>
                              )}
                              {!isLicenseVerifying && licenseError && (
                                <p className="text-xs text-red-600 mt-1">{licenseError}</p>
                              )}
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={fleetForm.control}
                          name="driverLicenseDob"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Partner DOB (for license verification)</FormLabel>
                              <FormControl>
                                <Input
                                  {...(() => { const { onChange: _o, ...rest } = field; return rest; })()}
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="YYYY-MM-DD"
                                  disabled={!canEdit}
                                  data-testid="input-fleet-license-dob"
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const digits = raw.replace(/\D/g, "").slice(0, 8);
                                    let formatted = digits;
                                    if (digits.length >= 5) {
                                      formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
                                    } else if (digits.length >= 3) {
                                      formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
                                    }
                                    field.onChange(formatted);
                                    scheduleDrivingLicenseVerification(
                                      fleetForm.getValues("driverLicenseNumber") || "",
                                      formatted,
                                    );
                                  }}
                                  onBlur={(e) => {
                                    field.onBlur();
                                    const license = fleetForm.getValues("driverLicenseNumber") || "";
                                    if (canEdit && license) {
                                      void verifyDrivingLicenseNumber(license, e.target.value);
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-muted-foreground">Format: YYYY-MM-DD</p>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={fleetForm.control}
                          name="panNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Partner PAN Number *</FormLabel>
                              <FormControl>
                            <Input
                              {...(() => { const { onChange: _o, ...rest } = field; return rest; })()}
                              placeholder="XXXXX0000X"
                              maxLength={10}
                              disabled={!canEdit}
                              data-testid="input-fleet-pan"
                              onChange={(e) => {
                                setPanVerified(false);
                                setPanError(null);
                                field.onChange(e.target.value.toUpperCase());
                              }}
                              onBlur={(e) => {
                                field.onBlur();
                                if (canEdit) {
                                  void verifyPanNumber(e.target.value);
                                }
                              }}
                            />
                              </FormControl>
                              <FormMessage />
                          {isPanVerifying && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifying PAN...
                            </p>
                          )}
                          {!isPanVerifying && panVerified && !panError && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <Check className="h-3 w-3" /> PAN number verified successfully.
                            </p>
                          )}
                          {!isPanVerifying && panError && (
                            <p className="text-xs text-red-600 mt-1">{panError}</p>
                          )}
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    {fleetForm.watch("businessType") === "other" && (
                      <FormField
                        control={fleetForm.control}
                        name="cinNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CIN Number *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="U12345MH2020PTC123456" disabled={!canEdit} data-testid="input-fleet-cin" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={fleetForm.control}
                      name="businessAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Address *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Registered office address" disabled={!canEdit} data-testid="input-fleet-business-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fleetForm.control}
                      name="businessLocality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Locality / Area * <span className="text-muted-foreground font-normal">(e.g. Andheri West, Bandra)</span></FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="" disabled={!canEdit} data-testid="input-fleet-business-locality" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fleetForm.control}
                      name="fleetSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fleet Size (Number of Trucks) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={1} 
                              placeholder="Number of trucks in your fleet"
                              {...field} 
                              value={field.value === 0 ? "" : field.value}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === "" ? "" : parseInt(val) || "");
                              }}
                              disabled={!canEdit} 
                              data-testid="input-fleet-size" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vehicle">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("carrierOnboarding.vehicleInfo")}</CardTitle>
                    <CardDescription>Provide details for one of your trucks</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={fleetForm.control}
                      name="licensePlateNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.licensePlate")} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="MH-01-AB-1234"
                              className="uppercase"
                              maxLength={13}
                              disabled={!canEdit}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              onBlur={() => { field.onBlur(); void fleetForm.trigger("licensePlateNumber"); }}
                              data-testid="input-fleet-plate"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fleetForm.control}
                      name="chassisNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.chassisNumber")} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="XXXXXXXXXXXXXXXXX"
                              className="uppercase"
                              maxLength={17}
                              disabled={!canEdit}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              onBlur={() => { field.onBlur(); void fleetForm.trigger("chassisNumber"); }}
                              data-testid="input-fleet-chassis"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fleetForm.control}
                      name="uniqueRegistrationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.registrationNumber")}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="RC number (e.g. MH01AB1234)"
                              disabled={!canEdit}
                              data-testid="input-fleet-reg-number"
                              onBlur={(e) => {
                                field.onBlur();
                                if (canEdit) void verifyRcNumber(e.target.value);
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
                    <FormField
                      control={fleetForm.control}
                      name="permitType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("carrierOnboarding.permitType")} *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                            <FormControl>
                              <SelectTrigger data-testid="select-fleet-permit-type">
                                <SelectValue placeholder="Select permit type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="national">{t("carrierOnboarding.nationalPermit")}</SelectItem>
                              <SelectItem value="domestic">{t("carrierOnboarding.domesticPermit")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bank">
                <Card>
                  <CardHeader>
                    <CardTitle>Bank Account Details</CardTitle>
                    <CardDescription>Enter your company bank details for payment processing</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={fleetForm.control}
                      name="bankAccountHolderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Holder Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Company name as per bank records" disabled={!canEdit} data-testid="input-fleet-bank-holder-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fleetForm.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name <span className="text-muted-foreground font-normal">(e.g. State Bank of India)</span></FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="" disabled={!canEdit} data-testid="input-fleet-bank-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fleetForm.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="" disabled={!canEdit} data-testid="input-fleet-bank-account" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fleetForm.control}
                      name="bankIfscCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFSC Code <span className="text-muted-foreground font-normal">(e.g. SBIN0001234)</span></FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder=""
                              className="uppercase"
                              maxLength={11}
                              disabled={!canEdit}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              onBlur={() => { field.onBlur(); void fleetForm.trigger("bankIfscCode"); }}
                              data-testid="input-fleet-bank-ifsc"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div>
                      <label className="text-sm font-medium mb-2 block">Void Cheque / Cancelled Cheque</label>
                      <DocumentUploadWithCamera
                        value={fleetForm.watch("voidChequeUrl") || ""}
                        onChange={(val) => {
                          fleetForm.setValue("voidChequeUrl", val);
                          handleDocumentUpload("void_cheque", val);
                        }}
                        disabled={!canEdit}
                        documentType="void_cheque"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("carrierOnboarding.requiredDocs")}</CardTitle>
                    <CardDescription>Upload your identity and vehicle documents for verification</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Aadhaar Card *</label>
                        <DocumentUploadWithCamera
                          value={fleetForm.watch("aadhaarUrl") || ""}
                          onChange={(val) => handleAadhaarUploadAndOcr(val, fleetForm, "aadhaar")}
                          onFile={(file) => { activeAadhaarFormRef.current = fleetForm; handleAadhaarFile(file); }}
                          disabled={!canEdit}
                          documentType="aadhaar"
                        />
                        {isAadhaarOcrRunning && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Reading Aadhaar number from document…
                          </p>
                        )}
                        {!isAadhaarOcrRunning && isAadhaarDocVerifying && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Verifying Aadhaar…
                          </p>
                        )}
                        {!isAadhaarOcrRunning && !isAadhaarDocVerifying && aadhaarDocVerified && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Aadhaar verified successfully.
                          </p>
                        )}
                        {!isAadhaarOcrRunning && !isAadhaarDocVerifying && aadhaarDocError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {aadhaarDocError}
                          </p>
                        )}
                        {aadhaarOcrError && !isAadhaarOcrRunning && (
                          <p className="text-xs text-amber-600 mt-1">{aadhaarOcrError}</p>
                        )}
                      </div>
                      {fleetForm.watch("businessType") === "registered_partnership" && !fleetForm.watch("noGstinNumber") && (
                        <div>
                          <label className="text-sm font-medium mb-2 block">GSTIN Certificate *</label>
                          <DocumentUploadWithCamera
                            value={fleetForm.watch("gstinUrl") || ""}
                            onChange={(val) => {
                              fleetForm.setValue("gstinUrl", val);
                              handleDocumentUpload("gstin", val);
                            }}
                            disabled={!canEdit}
                            documentType="gstin_certificate"
                          />
                        </div>
                      )}
                      {fleetForm.watch("businessType") === "non_registered_partnership" && (
                        <>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Partner Driver's License *</label>
                            <DocumentUploadWithCamera
                              value={fleetForm.watch("licenseUrl") || ""}
                              onChange={(val) => {
                                fleetForm.setValue("licenseUrl", val);
                                handleDocumentUpload("license", val);
                                if (!val) {
                                  setLicenseOcrError(null);
                                  setLicenseVerified(false);
                                  setLicenseError(null);
                                }
                              }}
                              onFile={(file) => { activeLicenseFormRef.current = fleetForm; handleLicenseFile(file); }}
                              disabled={!canEdit}
                              documentType="license"
                            />
                            {isLicenseOcrRunning && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Reading driving license details from document...
                              </p>
                            )}
                            {!isLicenseOcrRunning && isLicenseVerifying && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Verifying driving license...
                              </p>
                            )}
                            {!isLicenseOcrRunning && !isLicenseVerifying && licenseVerified && !licenseError && (
                              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <Check className="h-3 w-3" /> Driving license verified successfully.
                              </p>
                            )}
                            {!isLicenseOcrRunning && !isLicenseVerifying && licenseError && (
                              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {licenseError}
                              </p>
                            )}
                            {licenseOcrError && !isLicenseOcrRunning && (
                              <p className="text-xs text-amber-600 mt-1">{licenseOcrError}</p>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Partner PAN Card *</label>
                            <DocumentUploadWithCamera
                              value={fleetForm.watch("panUrl") || ""}
                              onChange={(val) => handlePanUploadAndOcr(val, fleetForm, "pan")}
                              onFile={(file) => { activePanFormRef.current = fleetForm; handlePanFile(file); }}
                              disabled={!canEdit}
                              documentType="pan_card"
                            />
                            {isPanOcrRunning && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Reading PAN number from document…
                              </p>
                            )}
                            {!isPanOcrRunning && isPanDocVerifying && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Verifying PAN…
                              </p>
                            )}
                            {!isPanOcrRunning && !isPanDocVerifying && panDocVerified && (
                              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <Check className="h-3 w-3" /> PAN verified successfully.
                              </p>
                            )}
                            {!isPanOcrRunning && !isPanDocVerifying && panDocError && (
                              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {panDocError}
                              </p>
                            )}
                            {panOcrError && !isPanOcrRunning && (
                              <p className="text-xs text-amber-600 mt-1">{panOcrError}</p>
                            )}
                          </div>
                        </>
                      )}
                      {fleetForm.watch("businessType") === "other" && (
                        <div>
                          <label className="text-sm font-medium mb-2 block">CIN Certificate *</label>
                          <DocumentUploadWithCamera
                            value={fleetForm.watch("cinUrl") || ""}
                            onChange={(val) => {
                              fleetForm.setValue("cinUrl", val);
                              handleDocumentUpload("cin", val);
                            }}
                            disabled={!canEdit}
                            documentType="cin"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium mb-2 block">TDS Declaration (Optional)</label>
                        <DocumentUploadWithCamera
                          value={fleetForm.watch("tdsDeclarationUrl") || ""}
                          onChange={(val) => {
                            fleetForm.setValue("tdsDeclarationUrl", val);
                            handleDocumentUpload("tds_declaration", val);
                          }}
                          disabled={!canEdit}
                          documentType="tds_declaration"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("onboarding.officePhoto")}</label>
                        <p className="text-sm text-red-600 font-medium mb-2">
                          {t("onboarding.officeSelfieNote")}
                        </p>
                        <DocumentUploadWithCamera
                          value={fleetForm.watch("addressProofUrl") || ""}
                          onChange={(val) => {
                            fleetForm.setValue("addressProofUrl", val);
                            handleDocumentUpload("address_proof", val);
                          }}
                          disabled={!canEdit}
                          documentType="address_proof"
                          preferCamera={true}
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t("onboarding.addressProofDesc")}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Selfie</label>
                        <DocumentUploadWithCamera
                          value={fleetForm.watch("selfieUrl") || ""}
                          onChange={(val) => {
                            fleetForm.setValue("selfieUrl", val);
                            handleDocumentUpload("selfie", val);
                          }}
                          disabled={!canEdit}
                          documentType="selfie"
                          preferCamera={true}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("carrierOnboarding.rcDoc")} *</label>
                        <DocumentUploadWithCamera
                          value={fleetForm.watch("rcUrl") || ""}
                          onChange={(val) => handleRcUploadAndOcr(val, fleetForm)}
                          onFile={(file) => { activeRcFormRef.current = fleetForm; handleRcFile(file); }}
                          disabled={!canEdit}
                          documentType="rc"
                        />
                        {isRcOcrRunning && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Reading RC number from document…
                          </p>
                        )}
                        {!isRcOcrRunning && isRcDocVerifying && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Verifying RC…
                          </p>
                        )}
                        {!isRcOcrRunning && !isRcDocVerifying && rcDocVerified && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Check className="h-3 w-3" /> RC verified.{rcDocOwnerName ? ` Owner: ${rcDocOwnerName}` : ""}
                          </p>
                        )}
                        {!isRcOcrRunning && !isRcDocVerifying && rcDocError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {rcDocError}
                          </p>
                        )}
                        {rcOcrError && !isRcOcrRunning && (
                          <p className="text-xs text-amber-600 mt-1">{rcOcrError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("carrierOnboarding.insuranceDoc")} *</label>
                        <DocumentUploadWithCamera
                          value={fleetForm.watch("insuranceUrl") || ""}
                          onChange={(val) => {
                            fleetForm.setValue("insuranceUrl", val);
                            handleDocumentUpload("insurance", val);
                          }}
                          disabled={!canEdit}
                          documentType="insurance"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("carrierOnboarding.fitnessDoc")} *</label>
                        <DocumentUploadWithCamera
                          value={fleetForm.watch("fitnessUrl") || ""}
                          onChange={(val) => {
                            fleetForm.setValue("fitnessUrl", val);
                            handleDocumentUpload("fitness", val);
                          }}
                          disabled={!canEdit}
                          documentType="fitness"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">MSME / Udyam Certificate (If applicable)</label>
                        <DocumentUploadWithCamera
                          value={fleetForm.watch("msmeUdyamUrl") || ""}
                          onChange={(val) => {
                            fleetForm.setValue("msmeUdyamUrl", val);
                            handleDocumentUpload("msme_udyam", val);
                          }}
                          disabled={!canEdit}
                          documentType="msme_udyam"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab Navigation Footer */}
              {canEdit && (
                <div className="mt-6 space-y-3">
                  {activeTab === "documents" && (
                    <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/40">
                      <Checkbox
                        id="consent-check"
                        checked={consentChecked}
                        onCheckedChange={(v) => setConsentChecked(!!v)}
                        className="mt-0.5"
                      />
                      <label htmlFor="consent-check" className="text-sm leading-relaxed cursor-pointer select-none">
                        I have read and agree to the{" "}
                        <button
                          type="button"
                          className="text-primary underline font-medium"
                          onClick={() => setConsentModalOpen(true)}
                        >
                          Data Processing Consent
                        </button>{" "}
                        terms. I provide my free, informed, and unambiguous consent to the collection, processing, and sharing of my personal data by LoadPilot.
                      </label>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <Button
                      type="button"
                      variant="secondary" className="bg-gray-500 hover:bg-gray-600 text-white text-base px-6 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => {
                        const tabs = ["identity", "vehicle", "bank", "documents"];
                        const idx = tabs.indexOf(activeTab);
                        if (idx > 0) setActiveTab(tabs[idx - 1]);
                      }}
                      disabled={activeTab === "identity"}
                    >
                      Previous
                    </Button>
                    {activeTab !== "documents" ? (
                      <Button
                        type="button"
                        onClick={() => {
                          const tabs = ["identity", "vehicle", "bank", "documents"];
                          const idx = tabs.indexOf(activeTab);
                          if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1]);
                        }}
                      >
                        Next
                      </Button>
                    ) : (
                      (() => {
                        const isNonRegPartnership = fleetForm.watch("businessType") === "non_registered_partnership";
                        const fleetDocChecks = [
                          { label: "Aadhaar Card", uploaded: !!fleetForm.watch("aadhaarUrl"), verified: aadhaarDocVerified },
                          ...(isNonRegPartnership ? [
                            { label: "Driver License", uploaded: !!fleetForm.watch("licenseUrl"), verified: licenseVerified },
                            { label: "PAN Card", uploaded: !!fleetForm.watch("panUrl"), verified: panDocVerified },
                          ] : []),
                          { label: "RC", uploaded: !!fleetForm.watch("rcUrl"), verified: rcDocVerified },
                        ];
                        const fleetPending = fleetDocChecks.filter(d => !d.uploaded || !d.verified);
                        const fleetDocsReady = fleetPending.length === 0;
                        return (
                          <div className="flex flex-col items-end gap-2">
                            {!fleetDocsReady && (
                              <p className="text-xs text-amber-600 flex items-start gap-1 text-right">
                                <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                {fleetPending.map(d =>
                                  !d.uploaded ? `Upload ${d.label}.` : `Verify ${d.label}.`
                                ).join(" ")}
                              </p>
                            )}
                            <Button
                              type="button"
                              onClick={handleSubmit}
                              disabled={submitMutation.isPending || isAadhaarVerifying || isPanVerifying || !consentChecked || !fleetDocsReady}
                              data-testid="button-submit-onboarding"
                            >
                              {submitMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {t("common.submitting")}
                                </>
                              ) : (
                                <>
                                  <Upload className="mr-2 h-4 w-4" />
                                  {t("carrierOnboarding.submitForReview")}
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              )}
            </Tabs>
          </form>
        </Form>
      )}

      {/* Consent Modal */}
      <Dialog open={consentModalOpen} onOpenChange={setConsentModalOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="flex flex-col h-[80vh]">
            <div className="p-6 border-b shrink-0">
              <DialogTitle>LOADPILOT DATA PROCESSING AGREEMENT</DialogTitle>
            </div>
            <div className="text-sm space-y-4 leading-relaxed text-muted-foreground overflow-y-auto flex-1 p-6">
            <div>
              <p className="font-semibold text-foreground">1. PREAMBLE</p>
              <p>This Data Sharing and Consent Agreement ("Agreement") sets out the terms governing the collection, processing, storage, and use of personal data by LoadPilot, a proprietary logistics technology platform owned and operated by Smart Serve Studios Inc. (hereinafter referred to as "LoadPilot" or the "Platform").</p>
              <p className="mt-1">By accessing, registering with, or otherwise using the Platform, the individual or entity providing personal data (the "Data Principal") acknowledges that they have been duly informed of the nature and purpose of such data processing and hereby provide their free, specific, informed, and unambiguous consent in accordance with the Digital Personal Data Protection Act, 2023.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">2. COLLECTION OF PERSONAL DATA</p>
              <p>LoadPilot collects personal data that is necessary and proportionate to the delivery of its services and the operation of its logistics ecosystem. Such data may include, without limitation:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Identity-related information, including government-issued identifiers</li>
                <li>Contact and communication details</li>
                <li>Business and operational information</li>
                <li>Financial and banking details required for settlement of transactions</li>
                <li>Vehicle, fleet, and shipment-related data</li>
                <li>Regulatory and compliance documentation</li>
                <li>Technical and system-generated data, including device information, IP address, and location data where relevant to service execution</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">3. PURPOSE OF PROCESSING</p>
              <p>Personal data shall be processed solely for lawful, specific, and clearly defined purposes, including:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Verification of identity and onboarding in compliance with applicable regulations</li>
                <li>Enabling participation in logistics transactions, including load creation, bidding, allocation, and execution</li>
                <li>Monitoring and tracking of shipments across the Platform</li>
                <li>Processing of payments, settlements, and related financial activities</li>
                <li>Ensuring regulatory compliance, fraud prevention, and risk management</li>
                <li>Facilitating communication necessary for operational continuity</li>
                <li>Conducting internal analytics, performance assessment, and system optimization</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">4. PROCESSING, SHARING, AND DISCLOSURE</p>
              <p>The Data Principal acknowledges that personal data may be processed through automated and system-driven mechanisms essential to the functioning of the Platform.</p>
              <p className="mt-1">Data may be shared, on a strictly need-to-know basis, with verified participants within the LoadPilot ecosystem, including shippers, carriers, fleet operators, financial institutions, and service providers, solely for the purpose of enabling logistics operations and associated services.</p>
              <p className="mt-1">Disclosure of personal data may also occur where mandated by law, regulatory authority, or judicial process.</p>
              <p className="mt-1">For the avoidance of doubt, any aggregated, anonymized, or system-generated data, including analytics, operational insights, and platform intelligence derived from usage of the Platform, shall remain the exclusive property of LoadPilot. No proprietary rights in such data are conferred upon the Data Principal.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">5. DATA RETENTION</p>
              <p>Personal data shall be retained only for such duration as is necessary to fulfill the purposes for which it was collected, including compliance with applicable legal, regulatory, and accounting obligations.</p>
              <p className="mt-1">LoadPilot reserves the right to retain data for longer periods where required for dispute resolution, enforcement of legal rights, fraud prevention, or audit requirements.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">6. DATA SECURITY</p>
              <p>LoadPilot implements appropriate technical and organizational safeguards to protect personal data against unauthorized access, disclosure, alteration, or destruction.</p>
              <p className="mt-1">These measures include, inter alia, secure data storage systems, controlled access protocols, encryption standards, and continuous monitoring mechanisms.</p>
              <p className="mt-1">While commercially reasonable efforts are undertaken to ensure data security, the Data Principal acknowledges that absolute security cannot be guaranteed.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">7. RIGHTS OF THE DATA PRINCIPAL</p>
              <p>Subject to applicable law, the Data Principal shall have the right to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Obtain access to their personal data</li>
                <li>Request correction or updating of inaccurate or incomplete data</li>
                <li>Request erasure of personal data, subject to legal and contractual limitations</li>
                <li>Withdraw consent for data processing at any time</li>
              </ul>
              <p className="mt-2">Such requests may be submitted through the designated channels provided by LoadPilot.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">8. WITHDRAWAL OF CONSENT</p>
              <p>The Data Principal may withdraw their consent at any time by submitting a formal request.</p>
              <p className="mt-1">However, it is expressly acknowledged that the withdrawal of consent may affect the ability of LoadPilot to provide its services and may result in suspension or termination of access to the Platform, including disruption of ongoing transactions or services that depend on such data processing.</p>
              <p className="mt-1">LoadPilot shall not be held responsible for any consequences arising from such withdrawal where processing of personal data is essential for service delivery.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">9. GRIEVANCE REDRESSAL</p>
              <p>In accordance with statutory requirements, LoadPilot has designated a Grievance Officer to address concerns relating to personal data.</p>
              <p className="mt-2 font-medium text-foreground">Grievance Officer<br />LoadPilot - Smart Serve Studios Inc.<br />Email: <a href="mailto:info@loadpilot.in" className="text-primary underline">info@loadpilot.in</a></p>
              <p className="mt-2">All grievances shall be addressed within the timelines prescribed under applicable law.</p>
            </div>
            <div className="border-t pt-4">
              <p className="font-semibold text-foreground">CONSENT CONFIRMATION</p>
              <p className="mt-2">By selecting the "I Agree" option, the Data Principal expressly confirms that they:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Have read and understood the terms of this Data Sharing and Consent Agreement;</li>
                <li>Provide their free, specific, informed, and unambiguous consent to the collection, processing, storage, and sharing of their personal data in accordance with the terms set forth herein; and</li>
                <li>Acknowledge that such consent is provided through an affirmative electronic action and shall be deemed valid and legally binding under applicable law.</li>
              </ul>
            </div>
          </div>
            <div className="flex justify-end p-4 border-t shrink-0 bg-background">
              <Button onClick={() => { setConsentChecked(true); setConsentModalOpen(false); }}>
                I Agree
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
