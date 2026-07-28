import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Building2, User, Phone, Mail, MapPin, FileText,
  Upload, Check, Clock, AlertCircle, ChevronRight, Loader2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { indianStates } from "@shared/indian-locations";
import { DocumentUploadWithCamera } from "@/components/DocumentUploadWithCamera";

// Helper function to parse address and extract state/city/pincode
function parseAddressForDropdowns(address: string): { state: string; city: string; pincode: string } {
  const result = { state: "", city: "", pincode: "" };
  if (!address) return result;
  
  // Normalize the address for matching
  const normalizedAddress = address.toLowerCase().trim();
  
  // Extract pincode (6 digit number)
  const pincodeMatch = address.match(/\b(\d{6})\b/);
  if (pincodeMatch) {
    result.pincode = pincodeMatch[1];
  }
  
  // Try to find matching state from indianStates list
  for (const stateData of indianStates) {
    const stateName = stateData.name.toLowerCase();
    // Check if state name appears in the address
    if (normalizedAddress.includes(stateName)) {
      result.state = stateData.name;
      
      // Now try to find a matching city within this state
      for (const cityData of stateData.cities) {
        const cityName = cityData.name.toLowerCase();
        if (normalizedAddress.includes(cityName)) {
          result.city = cityData.name;
          break;
        }
      }
      break;
    }
  }
  
  // If no state found, try matching by city first (might help identify state)
  if (!result.state) {
    for (const stateData of indianStates) {
      for (const cityData of stateData.cities) {
        const cityName = cityData.name.toLowerCase();
        if (normalizedAddress.includes(cityName)) {
          result.state = stateData.name;
          result.city = cityData.name;
          break;
        }
      }
      if (result.state) break;
    }
  }
  
  return result;
}

/** 15-char GSTIN: state (2) + PAN (10) + entity (1) + Z + check (1), e.g. 22ABCDE1234F1Z5 */
const GSTIN_FORMAT_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** 21-char CIN, e.g. U12345MH2020PTC123456 */
const CIN_FORMAT_REGEX = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

/** Indian mobile: optional +91 / leading 0; validates 10 digits starting 6–9 */
function parseIndianMobileDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(-10);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(-10);
  if (digits.length === 10) return digits;
  return "";
}

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

const onboardingFormSchema = z.object({
  shipperRole: z.enum(["shipper", "transporter"]).default("shipper"),
  legalCompanyName: z.string().min(1, "Company name is required"),
  tradeName: z.string().optional(),
  businessType: z.enum(["proprietorship", "partnership", "pvt_ltd", "public_ltd", "llp"]),
  incorporationDate: z.string().optional(),
  cinNumber: z.string().optional().superRefine((val, ctx) => {
    const v = (val ?? "").trim().toUpperCase();
    if (v && !CIN_FORMAT_REGEX.test(v)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid CIN format (e.g. U12345MH2020PTC123456)",
      });
    }
  }),
  panNumber: z.string().min(10).max(10, "PAN must be 10 characters"),
  gstinNumber: z.string().optional().superRefine((val, ctx) => {
    const v = (val ?? "").trim().toUpperCase();
    if (v && !GSTIN_FORMAT_REGEX.test(v)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid GSTIN format (e.g. 22ABCDE1234F1Z5)",
      });
    }
  }),
  registeredAddress: z.string().min(1, "Address is required"),
  registeredLocality: z.string().min(1, "Locality is required"),
  registeredCity: z.string().min(1, "City is required"),
  registeredCityCustom: z.string().optional(),
  registeredState: z.string().min(1, "State is required"),
  registeredCountry: z.string().min(1, "Country is required"),
  registeredPincode: z.string().min(6).max(6, "Pincode must be 6 digits"),
  operatingRegions: z.array(z.string()).optional(),
  primaryCommodities: z.array(z.string()).optional(),
  estimatedMonthlyLoads: z.number().int().min(0).optional(),
  avgLoadValueInr: z.string().optional(),
  contactPersonName: z.string().min(1, "Contact name is required"),
  contactPersonDesignation: z.string().optional(),
  contactPersonPhone: z.string().min(1, "Phone is required").superRefine((val, ctx) => {
    const digits = parseIndianMobileDigits(val.trim());
    if (!INDIAN_MOBILE_REGEX.test(digits)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid 10-digit Indian mobile number",
      });
    }
  }),
  contactPersonEmail: z
    .string()
    .min(1, "Email is required")
    .trim()
    .email("Enter a valid email address"),
  gstCertificateUrl: z.string().optional(),
  noGstCertificate: z.boolean().default(false),
  alternativeDocumentType: z.string().optional(),
  alternativeAuthorizationUrl: z.string().optional(),
  panCardUrl: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  aadhaarCardUrl: z.string().optional(),
  incorporationCertificateUrl: z.string().optional(),
  businessAddressProofType: z.enum(["rent_agreement", "electricity_bill", "office_photo_with_board"]).optional(),
  businessAddressProofUrl: z.string().optional(),
  selfieUrl: z.string().optional(),
  msmeUdyamUrl: z.string().optional(),
  lrCopyUrl: z.string().optional(),
  tradeReference1Company: z.string().optional(),
  tradeReference1Contact: z.string().optional(),
  tradeReference1Phone: z.string().optional().superRefine((val, ctx) => {
    const v = (val ?? "").trim();
    if (v && !INDIAN_MOBILE_REGEX.test(parseIndianMobileDigits(v))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid 10-digit mobile number or leave blank",
      });
    }
  }),
  tradeReference2Company: z.string().optional(),
  tradeReference2Contact: z.string().optional(),
  tradeReference2Phone: z.string().optional().superRefine((val, ctx) => {
    const v = (val ?? "").trim();
    if (v && !INDIAN_MOBILE_REGEX.test(parseIndianMobileDigits(v))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid 10-digit mobile number or leave blank",
      });
    }
  }),
  referralSource: z.string().optional(),
  referralSalesPersonName: z.string().optional(),
});

type OnboardingFormData = z.infer<typeof onboardingFormSchema>;

type SurepassResponse<T = unknown> = {
  success?: boolean;
  status_code?: number;
  data?: T;
  message?: string | null;
  message_code?: string;
};

export default function ShipperOnboarding() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("business");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showFullForm, setShowFullForm] = useState(false);
  const [isVerifyingKyc, setIsVerifyingKyc] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");

  const { data: onboardingStatus, isLoading: isLoadingStatus } = useQuery<any>({
    queryKey: ["/api/shipper/onboarding"],
  });

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingFormSchema),
    mode: "onTouched",
    defaultValues: {
      shipperRole: "shipper",
      legalCompanyName: "",
      tradeName: "",
      businessType: "pvt_ltd",
      panNumber: "",
      gstinNumber: "",
      cinNumber: "",
      incorporationDate: "",
      registeredAddress: "",
      registeredLocality: "",
      registeredCity: "",
      registeredCityCustom: "",
      registeredState: "",
      registeredCountry: "India",
      registeredPincode: "",
      operatingRegions: [],
      primaryCommodities: [],
      estimatedMonthlyLoads: undefined,
      avgLoadValueInr: "",
      contactPersonName: "",
      contactPersonDesignation: "",
      contactPersonPhone: "",
      contactPersonEmail: "",
      gstCertificateUrl: "",
      noGstCertificate: false,
      alternativeDocumentType: "",
      alternativeAuthorizationUrl: "",
      panCardUrl: "",
      aadhaarNumber: "",
      aadhaarCardUrl: "",
      incorporationCertificateUrl: "",
      businessAddressProofType: undefined,
      businessAddressProofUrl: "",
      selfieUrl: "",
      msmeUdyamUrl: "",
      lrCopyUrl: "",
      tradeReference1Company: "",
      tradeReference1Contact: "",
      tradeReference1Phone: "",
      tradeReference2Company: "",
      tradeReference2Contact: "",
      tradeReference2Phone: "",
      referralSource: "",
      referralSalesPersonName: "",
    },
  });

  // Pre-populate form with existing data (draft, pending, under_review, on_hold, rejected)
  useEffect(() => {
    if (onboardingStatus && (onboardingStatus.status === "draft" || onboardingStatus.status === "pending" || onboardingStatus.status === "under_review" || onboardingStatus.status === "on_hold" || onboardingStatus.status === "rejected")) {
      // Get the address to use (from onboarding or user)
      const addressToUse = onboardingStatus.registeredAddress || user?.companyAddress || "";
      
      // Parse address to extract state/city/pincode if not already set in onboarding
      let parsedState = onboardingStatus.registeredState || "";
      let parsedCity = onboardingStatus.registeredCity || "";
      let parsedPincode = onboardingStatus.registeredPincode || "";
      
      // If state is empty but we have an address, try to parse it
      if (!parsedState && addressToUse) {
        const parsed = parseAddressForDropdowns(addressToUse);
        if (parsed.state) parsedState = parsed.state;
        if (parsed.city && !parsedCity) parsedCity = parsed.city;
        if (parsed.pincode && !parsedPincode) parsedPincode = parsed.pincode;
      }
      
      // Fallback to user's defaultPickupCity if city still empty
      if (!parsedCity && user?.defaultPickupCity) {
        parsedCity = user.defaultPickupCity;
      }
      
      const draftData: Partial<OnboardingFormData> = {
        shipperRole: onboardingStatus.shipperRole || "shipper",
        legalCompanyName: onboardingStatus.legalCompanyName || user?.companyName || "",
        tradeName: onboardingStatus.tradeName || "",
        businessType: onboardingStatus.businessType || "pvt_ltd",
        panNumber: onboardingStatus.panNumber || "",
        gstinNumber: onboardingStatus.gstinNumber || "",
        cinNumber: onboardingStatus.cinNumber || "",
        incorporationDate: onboardingStatus.incorporationDate ? onboardingStatus.incorporationDate.split('T')[0] : "",
        registeredAddress: addressToUse,
        registeredLocality: onboardingStatus.registeredLocality || "",
        registeredCity: parsedCity,
        registeredCityCustom: onboardingStatus.registeredCityCustom || "",
        registeredState: parsedState,
        registeredCountry: onboardingStatus.registeredCountry || "India",
        registeredPincode: parsedPincode,
        operatingRegions: onboardingStatus.operatingRegions || [],
        primaryCommodities: onboardingStatus.primaryCommodities || [],
        estimatedMonthlyLoads: onboardingStatus.estimatedMonthlyLoads || undefined,
        avgLoadValueInr: onboardingStatus.avgLoadValueInr || "",
        contactPersonName: onboardingStatus.contactPersonName || "",
        contactPersonDesignation: onboardingStatus.contactPersonDesignation || "",
        contactPersonPhone: onboardingStatus.contactPersonPhone || user?.phone || "",
        contactPersonEmail: onboardingStatus.contactPersonEmail || user?.email || "",
        gstCertificateUrl: onboardingStatus.gstCertificateUrl || "",
        noGstCertificate: onboardingStatus.noGstCertificate || false,
        alternativeDocumentType: onboardingStatus.alternativeDocumentType || "",
        alternativeAuthorizationUrl: onboardingStatus.alternativeAuthorizationUrl || "",
        panCardUrl: onboardingStatus.panCardUrl || "",
        aadhaarNumber: onboardingStatus.aadhaarNumber || "",
        aadhaarCardUrl: onboardingStatus.aadhaarCardUrl || "",
        incorporationCertificateUrl: onboardingStatus.incorporationCertificateUrl || "",
        businessAddressProofType: onboardingStatus.businessAddressProofType || undefined,
        businessAddressProofUrl: onboardingStatus.businessAddressProofUrl || "",
        selfieUrl: onboardingStatus.selfieUrl || "",
        msmeUdyamUrl: onboardingStatus.msmeUrl || onboardingStatus.udyamUrl || "",
        lrCopyUrl: onboardingStatus.lrCopyUrl || "",
        tradeReference1Company: onboardingStatus.tradeReference1Company || "",
        tradeReference1Contact: onboardingStatus.tradeReference1Contact || "",
        tradeReference1Phone: onboardingStatus.tradeReference1Phone || "",
        tradeReference2Company: onboardingStatus.tradeReference2Company || "",
        tradeReference2Contact: onboardingStatus.tradeReference2Contact || "",
        tradeReference2Phone: onboardingStatus.tradeReference2Phone || "",
        referralSource: onboardingStatus.referralSource || "",
        referralSalesPersonName: onboardingStatus.referralSalesPersonName || "",
      };

      form.reset(draftData);
      lastSavedDataRef.current = JSON.stringify(draftData);
    }
  }, [onboardingStatus, form, user]);

  // Pre-populate from user data when NO onboarding status exists yet (new users)
  useEffect(() => {
    if (!onboardingStatus && user) {
      const initialData: Partial<OnboardingFormData> = {};
      
      if (user.companyName) {
        initialData.legalCompanyName = user.companyName;
      }
      if (user.companyAddress) {
        initialData.registeredAddress = user.companyAddress;
        
        // Parse address to extract state/city/pincode for dropdowns
        const parsed = parseAddressForDropdowns(user.companyAddress);
        if (parsed.state) {
          initialData.registeredState = parsed.state;
        }
        if (parsed.city) {
          initialData.registeredCity = parsed.city;
        }
        if (parsed.pincode) {
          initialData.registeredPincode = parsed.pincode;
        }
      }
      if (user.defaultPickupCity && !initialData.registeredCity) {
        initialData.registeredCity = user.defaultPickupCity;
      }
      if (user.phone) {
        initialData.contactPersonPhone = user.phone;
      }
      if (user.email) {
        initialData.contactPersonEmail = user.email;
      }
      
      if (Object.keys(initialData).length > 0) {
        Object.entries(initialData).forEach(([key, value]) => {
          form.setValue(key as keyof OnboardingFormData, value as string);
        });
      }
    }
  }, [onboardingStatus, user, form]);

  // Auto-save mutation for drafts
  const autoSaveMutation = useMutation({
    mutationFn: async (data: Partial<OnboardingFormData>) => {
      const res = await apiRequest("PATCH", "/api/shipper/onboarding/draft", data);
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

  // Debounced auto-save function
  const debouncedAutoSave = useCallback((data: Partial<OnboardingFormData>) => {
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

  // Watch form changes for auto-save (only for draft status)
  useEffect(() => {
    if (onboardingStatus?.status !== "draft") return;

    const subscription = form.watch((data) => {
      debouncedAutoSave(data as Partial<OnboardingFormData>);
    });

    return () => {
      subscription.unsubscribe();
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [form, onboardingStatus?.status, debouncedAutoSave]);

  const submitMutation = useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      const res = await apiRequest("POST", "/api/shipper/onboarding", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("onboarding.submitSuccess"),
        description: t("onboarding.submitSuccessDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipper/onboarding"] });
    },
    onError: (error: any) => {
      toast({
        title: t("onboarding.submitError"),
        description: error.message || t("onboarding.submitErrorDesc"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<OnboardingFormData>) => {
      const res = await apiRequest("PUT", "/api/shipper/onboarding", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("onboarding.updateSuccess"),
        description: t("onboarding.updateSuccessDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipper/onboarding"] });
    },
    onError: (error: any) => {
      toast({
        title: t("onboarding.updateError"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyKycBeforeSubmit = async (data: OnboardingFormData) => {
    const panNumber = data.panNumber.trim();
    const gstinNumber = data.gstinNumber?.trim();
    const email = data.contactPersonEmail.trim();

    setIsVerifyingKyc(true);
    try {
      console.log("KYC verification started", { panNumber, gstinNumber, email });
      // PAN comprehensive is mandatory gate
      try {
        console.log("KYC PAN: calling /api/kyc/pan-comprehensive");
        const res = await apiRequest("POST", "/api/kyc/pan-comprehensive", {
          pan_number: panNumber,
        });
        const body = await res.json();
        console.log("Surepass PAN comprehensive response:", body);
        if (!body || body.success !== true) {
          toast({
            title: "PAN verification failed",
            description: "Please check your PAN number and try again.",
            variant: "destructive",
          });
          return false;
        }
      } catch (error: any) {
        console.error("KYC PAN error:", error);
        toast({
          title: "PAN verification failed",
          description: "PAN could not be verified with Surepass. Please try again or contact support.",
          variant: "destructive",
        });
        return false;
      }

      // GSTIN is optional, but if provided it must pass verification
      if (gstinNumber) {
        try {
          console.log("KYC GSTIN: calling /api/kyc/gstin");
          const res = await apiRequest("POST", "/api/kyc/gstin", {
            gstin_number: gstinNumber,
          });
          const body = await res.json();
          console.log("Surepass GSTIN response:", body);
          const gstData = body?.data || {};
          const status = typeof gstData.gstin_status === "string" ? gstData.gstin_status.toLowerCase() : "";
          const isGstinValid =
            body?.success === true &&
            status.includes("active");

          if (!isGstinValid) {
            toast({
              title: "GSTIN verification failed",
              description: "Please check your GST number or submit without it.",
              variant: "destructive",
            });
            return false;
          }
        } catch (error: any) {
          console.error("KYC GSTIN error:", error);
          toast({
            title: "GSTIN verification failed",
            description: "GSTIN could not be verified with Surepass. Please try again or remove the GSTIN.",
            variant: "destructive",
          });
          return false;
        }
      }

      // Email check is mandatory gate
      try {
        console.log("KYC Email: calling /api/kyc/email-check");
        const res = await apiRequest("POST", "/api/kyc/email-check", {
          email,
        });
        const body = await res.json();
        console.log("Surepass email-check response:", body);
        const emailData = body?.data || {};
        const emailStatus = typeof emailData.status === "string" ? emailData.status.toLowerCase() : "";
        const isEmailValid =
          body?.success === true &&
          emailData.deliverable === true &&
          emailStatus === "deliverable";

        if (!isEmailValid) {
          toast({
            title: "Email verification failed",
            description: "Please check the email address and try again.",
            variant: "destructive",
          });
          return false;
        }
      } catch (error: any) {
        console.error("KYC Email error:", error);
        toast({
          title: "Email verification failed",
          description: "Email could not be verified with Surepass. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } finally {
      setIsVerifyingKyc(false);
    }
  };

  const onSubmit = async (data: OnboardingFormData) => {
  //  const okToSubmit = await verifyKycBeforeSubmit(data);
  //  if (!okToSubmit) {
 //     return;
 //   }

    if (onboardingStatus && (onboardingStatus.status === "on_hold" || onboardingStatus.status === "rejected")) {
      updateMutation.mutate(data);
    } else {
      submitMutation.mutate(data);
    }
  };

  // Helper to determine which tab has the first error
  const getTabWithError = (errors: any): string | null => {
    const businessFields = ["legalCompanyName", "tradeName", "businessType", "incorporationDate", "cinNumber", "panNumber", "gstinNumber", "aadhaarNumber", "registeredAddress", "registeredLocality", "registeredCity", "registeredCityCustom", "registeredState", "registeredCountry", "registeredPincode", "operatingRegions", "primaryCommodities", "estimatedMonthlyLoads", "avgLoadValueInr"];
    const contactFields = ["contactPersonName", "contactPersonDesignation", "contactPersonPhone", "contactPersonEmail", "tradeReference1Company", "tradeReference1Contact", "tradeReference1Phone", "tradeReference2Company", "tradeReference2Contact", "tradeReference2Phone"];
    const documentFields = ["gstCertificateUrl", "noGstCertificate", "alternativeDocumentType", "alternativeAuthorizationUrl", "panCardUrl", "aadhaarCardUrl", "incorporationCertificateUrl", "businessAddressProofUrl", "selfieUrl", "msmeUdyamUrl"];

    const errorKeys = Object.keys(errors);
    if (errorKeys.some(key => businessFields.includes(key))) return "business";
    if (errorKeys.some(key => contactFields.includes(key))) return "contact";
    if (errorKeys.some(key => documentFields.includes(key))) return "documents";
    return null;
  };

  const onInvalid = (errors: any) => {
    const errorMessages = Object.entries(errors)
      .map(([field, error]: [string, any]) => `${field}: ${error?.message || "Invalid"}`)
      .slice(0, 3)
      .join(", ");
    
    toast({
      title: t("onboarding.validationError") || "Please fix the errors",
      description: "Fill all the required details",
      variant: "destructive",
    });

    // Navigate to the tab with the first error
    const tabWithError = getTabWithError(errors);
    if (tabWithError) {
      setActiveTab(tabWithError);
    }
  };

  if (isLoadingStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" />{t("onboarding.statusDraft")}</Badge>;
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{t("onboarding.statusPending")}</Badge>;
      case "under_review":
        return <Badge className="bg-blue-500 gap-1"><Loader2 className="h-3 w-3 animate-spin" />{t("onboarding.statusUnderReview")}</Badge>;
      case "approved":
        return <Badge className="bg-green-500 gap-1"><Check className="h-3 w-3" />{t("onboarding.statusApproved")}</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" />{t("onboarding.statusRejected")}</Badge>;
      case "on_hold":
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />{t("onboarding.statusOnHold")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Render auto-save indicator
  const renderAutoSaveIndicator = () => {
    if (onboardingStatus?.status !== "draft") return null;
    
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="auto-save-indicator">
        {autoSaveStatus === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{t("postLoad.autoSaving")}</span>
          </>
        )}
        {autoSaveStatus === "saved" && (
          <>
            <Check className="h-3 w-3 text-green-500" />
            <span className="text-green-600 dark:text-green-400">{t("postLoad.autoSaved")}</span>
          </>
        )}
      </div>
    );
  };

  if (onboardingStatus && (onboardingStatus.status === "pending" || onboardingStatus.status === "under_review" || onboardingStatus.status === "approved") && !showFullForm) {
    return (
      <div className="container mx-auto py-3 sm:py-6 px-4 max-w-4xl">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="truncate">{t("onboarding.title")}</span>
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm">{t("onboarding.statusDescription")}</CardDescription>
              </div>
              <div className="self-start sm:self-auto">
                {getStatusBadge(onboardingStatus.status)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">{t("onboarding.companyName")}</p>
                <p className="font-medium text-sm sm:text-base break-words">{onboardingStatus.legalCompanyName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">{t("onboarding.gstin")}</p>
                <p className="font-medium text-sm sm:text-base break-all">{onboardingStatus.gstinNumber || "-"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">{t("onboarding.submittedAt")}</p>
                <p className="font-medium text-sm sm:text-base">{new Date(onboardingStatus.submittedAt).toLocaleDateString()}</p>
              </div>
              {onboardingStatus.status === "approved" && (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">{t("onboarding.approvedAt")}</p>
                  <p className="font-medium text-sm sm:text-base">{new Date(onboardingStatus.reviewedAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {onboardingStatus.status === "approved" && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
                <div className="flex items-start sm:items-center gap-2 text-green-700 dark:text-green-300">
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <p className="font-medium text-sm sm:text-base">{t("onboarding.approvedMessage")}</p>
                </div>
                <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-1 ml-6 sm:ml-7">
                  {t("onboarding.approvedDescription")}
                </p>
                <Button
                  className="mt-3 sm:mt-4 w-full sm:w-auto"
                  onClick={() => setLocation("/shipper/post-load")}
                  data-testid="button-post-first-load"
                >
                  {t("onboarding.postFirstLoad")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {onboardingStatus.status === "pending" && (
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4">
                <div className="flex items-start sm:items-center gap-2 text-amber-700 dark:text-amber-300">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <p className="font-medium text-sm sm:text-base">{t("onboarding.pendingMessage")}</p>
                </div>
                <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 mt-1 ml-6 sm:ml-7">
                  {t("onboarding.pendingDescription")}
                </p>
              </div>
            )}

            {onboardingStatus.status === "under_review" && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                <div className="flex items-start sm:items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5 sm:mt-0 animate-spin" />
                  <p className="font-medium text-sm sm:text-base">{t("onboarding.underReviewMessage")}</p>
                </div>
                <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mt-1 ml-6 sm:ml-7">
                  {t("onboarding.underReviewDescription")}
                </p>
              </div>
            )}

            {(onboardingStatus.status === "pending" || onboardingStatus.status === "under_review") && (
              <Button
                variant="outline"
                onClick={() => setShowFullForm(true)}
                data-testid="button-view-full-application"
                className="w-full text-sm sm:text-base"
              >
                <FileText className="h-4 w-4 mr-2" />
                {t("onboarding.viewFullApplication")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (onboardingStatus && (onboardingStatus.status === "on_hold" || onboardingStatus.status === "rejected")) {
    return (
      <div className="container mx-auto py-3 sm:py-6 px-4 max-w-4xl space-y-4 sm:space-y-6">
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{t("onboarding.actionRequired")}</span>
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm">
                  {onboardingStatus.status === "rejected" 
                    ? t("onboarding.rejectedDescription")
                    : t("onboarding.onHoldDescription")}
                </CardDescription>
              </div>
              <div className="self-start sm:self-auto">
                {getStatusBadge(onboardingStatus.status)}
              </div>
            </div>
          </CardHeader>
          {onboardingStatus.decisionNote && (
            <CardContent className="p-4 sm:p-6">
              <div className="bg-muted rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm font-medium mb-1">{t("onboarding.adminNote")}</p>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">{onboardingStatus.decisionNote}</p>
              </div>
            </CardContent>
          )}
        </Card>

        <OnboardingFormComponent 
          form={form} 
          onSubmit={onSubmit} 
          onInvalid={onInvalid}
          isSubmitting={updateMutation.isPending || isVerifyingKyc}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isUpdate={true}
        />
      </div>
    );
  }

  // For draft status, show form with auto-save
  const isDraft = onboardingStatus?.status === "draft";
  const isPendingOrUnderReview = onboardingStatus?.status === "pending" || onboardingStatus?.status === "under_review";

  return (
    <div className="container mx-auto py-3 sm:py-6 px-4 max-w-4xl space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
            <span className="truncate">{t("onboarding.title")}</span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {renderAutoSaveIndicator()}
            {isDraft && getStatusBadge("draft")}
            {isPendingOrUnderReview && getStatusBadge(onboardingStatus?.status)}
          </div>
        </div>
        <p className="text-muted-foreground text-sm sm:text-base">
          {isDraft ? t("onboarding.continueDraftDesc") : t("onboarding.subtitle")}
        </p>
      </div>

      {showFullForm && isPendingOrUnderReview && (
        <Button
          variant="outline"
          onClick={() => setShowFullForm(false)}
          data-testid="button-back-to-summary"
          className="w-full sm:w-auto text-sm sm:text-base"
        >
          <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
          {t("onboarding.backToSummary")}
        </Button>
      )}

      <OnboardingFormComponent 
        form={form} 
        onSubmit={onSubmit} 
        onInvalid={onInvalid}
        isSubmitting={submitMutation.isPending || isVerifyingKyc}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isUpdate={false}
      />
    </div>
  );
}

interface OnboardingFormProps {
  form: ReturnType<typeof useForm<OnboardingFormData>>;
  onSubmit: (data: OnboardingFormData) => void;
  onInvalid: (errors: any) => void;
  isSubmitting: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isUpdate: boolean;
}

function OnboardingFormComponent({ form, onSubmit, onInvalid, isSubmitting, activeTab, setActiveTab, isUpdate }: OnboardingFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [isPanVerifying, setIsPanVerifying] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [panError, setPanError] = useState<string | null>(null);
  const [isPanOcrRunning, setIsPanOcrRunning] = useState(false);
  const [panOcrError, setPanOcrError] = useState<string | null>(null);

  const { data: kycConfig } = useQuery<{ surepassAllowProxy: boolean }>({
    queryKey: ["/api/kyc/config"],
  });

  const handlePanCardFile = useCallback(
    async (file: File) => {
      setIsPanOcrRunning(true);
      setPanOcrError(null);
      try {
        const { prepareFileForTesseract } = await import(
          "@/lib/prepare-file-for-tesseract"
        );
        const ocrSource = await prepareFileForTesseract(file);
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const {
          data: { text },
        } = await worker.recognize(ocrSource);
        await worker.terminate();

        const normalized = text.replace(/[\n\r]/g, " ").toUpperCase();

        // Pass 1: direct PAN pattern
        let pan = normalized.match(/[A-Z]{5}[0-9]{4}[A-Z]/)?.[0] || "";

        // Pass 2: collapse whitespace and retry
        if (!pan) {
          const compact = normalized.replace(/\s+/g, "");
          pan = compact.match(/[A-Z]{5}[0-9]{4}[A-Z]/)?.[0] || "";
        }

        // Pass 3: fix common OCR misreads and retry
        if (!pan) {
          const fixed = normalized
            .replace(/O/g, "0")
            .replace(/I/g, "1")
            .replace(/S/g, "5")
            .replace(/B/g, "8")
            .replace(/\s+/g, "");
          const candidate = fixed.match(/[A-Z0-9]{10}/)?.[0] || "";
          if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(candidate)) pan = candidate;
        }

        if (pan.length === 10) {
          form.setValue("panNumber", pan, { shouldValidate: true, shouldDirty: true });
          toast({
            title: "PAN Extracted",
            description: `PAN number detected: ${pan}`,
            duration: 4000,
          });

          // Trigger existing PAN verification flow
          if (!isPanVerifying) {
            void verifyPanNumber();
          }
        } else {
          setPanOcrError("PAN number could not be read. Please enter it manually.");
        }
      } catch (err) {
        console.error("Tesseract PAN OCR error (shipper):", err);
        setPanOcrError("Could not read document. Please enter PAN number manually.");
      } finally {
        setIsPanOcrRunning(false);
      }
    },
    [form, toast, isPanVerifying],
  );

  const verifyPanNumber = async () => {
    const rawPan = form.getValues("panNumber") || "";
    const trimmed = rawPan.replace(/\s+/g, "").toUpperCase();

    setPanVerified(false);
    setPanError(null);

    if (!trimmed) {
      setPanError("Please enter a PAN number.");
      return;
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

    // When proxy is enabled (or config not loaded), validate locally only — no Surepass API call
    const useLocalValidationOnly = kycConfig?.surepassAllowProxy !== false;
    if (useLocalValidationOnly) {
      if (!panRegex.test(trimmed)) {
        setPanError("Fill the correct PAN number.");
        return;
      }
      form.setValue("panNumber", trimmed);
      setPanVerified(true);
      return;
    }

    if (!panRegex.test(trimmed)) {
      setPanError("Please enter a valid 10-character PAN (5 letters, 4 digits, 1 letter).");
      return;
    }

    setIsPanVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/pan-comprehensive", {
        pan_number: trimmed,
        request_ref: "shipper_onboarding_pan",
      });
      const payload = (await res.json()) as SurepassResponse;

      if (!payload?.success) {
        setPanVerified(false);
        setPanError(
          payload?.message || "PAN could not be verified. Please check the number and try again.",
        );
        return;
      }

      form.setValue("panNumber", trimmed);
      setPanVerified(true);
      setPanError(null);
    } catch (error: any) {
      setPanVerified(false);
      setPanError("PAN verification failed. Please try again.");
    } finally {
      setIsPanVerifying(false);
    }
  };

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="grid grid-cols-3 w-full h-auto">
            <TabsTrigger value="business" className="gap-1 text-xs sm:text-sm py-2 sm:py-2.5" data-testid="tab-business">
              <Building2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden xs:inline truncate">{t("onboarding.tabBusiness")}</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="gap-1 text-xs sm:text-sm py-2 sm:py-2.5" data-testid="tab-contact">
              <User className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden xs:inline truncate">{t("onboarding.tabContact")}</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1 text-xs sm:text-sm py-2 sm:py-2.5" data-testid="tab-documents">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden xs:inline truncate">{t("onboarding.tabDocuments")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">{t("onboarding.businessDetails")}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{t("onboarding.businessDetailsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                {/* I am a - Shipper/Transporter dropdown */}
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="shipperRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">I am a</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-shipper-role" className="text-sm">
                              <SelectValue placeholder="Select your role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="shipper">Shipper</SelectItem>
                            <SelectItem value="transporter">Transporter</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          Select whether you are a Shipper or Transporter
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="legalCompanyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.legalCompanyName")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t("onboarding.legalCompanyNamePlaceholder")} 
                            {...field} 
                            data-testid="input-legal-company-name"
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tradeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.tradeName")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t("onboarding.tradeNamePlaceholder")} 
                            {...field} 
                            data-testid="input-trade-name"
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

              

                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.businessType")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-business-type" className="text-sm">
                              <SelectValue placeholder={t("onboarding.selectBusinessType")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="proprietorship">{t("onboarding.proprietorship")}</SelectItem>
                            <SelectItem value="partnership">{t("onboarding.partnership")}</SelectItem>
                            <SelectItem value="pvt_ltd">{t("onboarding.pvtLtd")}</SelectItem>
                            <SelectItem value="public_ltd">{t("onboarding.publicLtd")}</SelectItem>
                            <SelectItem value="llp">{t("onboarding.llp")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="incorporationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.incorporationDate")} <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            data-testid="input-incorporation-date"
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch("businessType") === "proprietorship" && (
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="aadhaarNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Aadhaar Number <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter 12-digit Aadhaar number"
                              maxLength={12}
                              data-testid="input-aadhaar-number"
                              className="text-sm"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">Your 12-digit Aadhaar number for identity verification</FormDescription>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="panNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.pan")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ABCDE1234F" 
                            className="uppercase text-sm"
                            maxLength={10}
                            {...field} 
                            onChange={(e) => {
                              setPanVerified(false);
                              setPanError(null);
                              field.onChange(e.target.value.toUpperCase());
                            }}
                            onBlur={(e) => {
                              field.onBlur();
                              const value = e.target.value.toUpperCase();
                              if (value.length === 10 && !isPanVerifying) {
                                void verifyPanNumber();
                              }
                            }}
                            data-testid="input-pan-number"
                          />
                        </FormControl>
                        {!isPanVerifying && panVerified && !panError && (
                          <p className="text-xs text-green-600 mt-1">PAN verified successfully.</p>
                        )}
                        {!isPanVerifying && panError && (
                          <p className="text-xs text-red-600 mt-1">{panError}</p>
                        )}
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gstinNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.gstin")} <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="22ABCDE1234F1Z5" 
                            className="uppercase text-sm"
                            maxLength={15}
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            onBlur={(e) => {
                              field.onBlur();
                              void form.trigger("gstinNumber");
                            }}
                            data-testid="input-gstin"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cinNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.cin")} <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="U12345MH2020PTC123456" 
                            className="uppercase text-sm"
                            maxLength={21}
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            onBlur={(e) => {
                              field.onBlur();
                              void form.trigger("cinNumber");
                            }}
                            data-testid="input-cin"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <h4 className="font-medium text-sm sm:text-base">{t("onboarding.registeredAddress")}</h4>
                  <FormField
                    control={form.control}
                    name="registeredAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.addressLine")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t("onboarding.addressPlaceholder")} 
                            {...field} 
                            data-testid="input-address"
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="registeredLocality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Locality / Area <span className="text-muted-foreground font-normal">(e.g. Andheri West, Bandra)</span></FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="" 
                            {...field} 
                            data-testid="input-locality"
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="registeredState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{t("onboarding.state")}</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("registeredCity", "");
                              form.setValue("registeredCityCustom", "");
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-state" className="text-sm">
                                <SelectValue placeholder={t("onboarding.selectState")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {indianStates.map((state) => (
                                <SelectItem key={state.code} value={state.name}>
                                  {state.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="registeredCity"
                      render={({ field }) => {
                        const selectedState = form.watch("registeredState");
                        const stateData = indianStates.find(s => s.name === selectedState);
                        const cities = stateData?.cities || [];
                        
                        return (
                          <FormItem>
                            <FormLabel className="text-sm">{t("onboarding.city")}</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value);
                                if (value !== "other") {
                                  form.setValue("registeredCityCustom", "");
                                }
                              }} 
                              value={field.value}
                              disabled={!selectedState}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-city" className="text-sm">
                                  <SelectValue placeholder={selectedState ? t("onboarding.selectCity") : t("onboarding.selectStateFirst")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {cities.map((city) => (
                                  <SelectItem key={city.name} value={city.name}>
                                    {city.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="other">Other / Custom</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                  
                  {form.watch("registeredCity") === "other" && (
                    <FormField
                      control={form.control}
                      name="registeredCityCustom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Custom City Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="" 
                              {...field} 
                              data-testid="input-city-custom"
                              className="text-sm"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="registeredCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Country</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-country" className="text-sm">
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="India">India</SelectItem>
                              <SelectItem value="Nepal">Nepal</SelectItem>
                              <SelectItem value="Bangladesh">Bangladesh</SelectItem>
                              <SelectItem value="Sri Lanka">Sri Lanka</SelectItem>
                              <SelectItem value="Bhutan">Bhutan</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="registeredPincode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{t("onboarding.pincode")}</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="400001" 
                              maxLength={6}
                              {...field} 
                              data-testid="input-pincode"
                              className="text-sm"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                  <Button type="button" onClick={() => setActiveTab("contact")} data-testid="button-next-contact" className="w-full sm:w-auto text-sm sm:text-base">
                    {t("onboarding.next")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">{t("onboarding.contactDetails")}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{t("onboarding.contactDetailsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contactPersonName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("onboarding.contactName")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t("onboarding.contactNamePlaceholder")} 
                            {...field} 
                            data-testid="input-contact-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactPersonDesignation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("onboarding.designation")}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t("onboarding.designationPlaceholder")} 
                            {...field} 
                            data-testid="input-designation"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contactPersonPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("onboarding.phone")}</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 bg-muted border border-r-0 rounded-l-md text-muted-foreground">
                              +91
                            </span>
                            <Input 
                              placeholder="9876543210" 
                              className="rounded-l-none"
                              maxLength={15}
                              inputMode="numeric"
                              {...field} 
                              onBlur={(e) => {
                                field.onBlur();
                                void form.trigger("contactPersonPhone");
                              }}
                              data-testid="input-phone"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactPersonEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("onboarding.email")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder="contact@company.com" 
                            {...field} 
                            onBlur={(e) => {
                              field.onBlur();
                              void form.trigger("contactPersonEmail");
                            }}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">{t("onboarding.tradeReferences")} <span className="text-muted-foreground font-normal">(Optional)</span></h4>
                  <p className="text-sm text-muted-foreground">{t("onboarding.tradeReferencesDesc")}</p>
                  
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="tradeReference1Company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("onboarding.reference1Company")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("onboarding.companyNamePlaceholder")} {...field} data-testid="input-ref1-company" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tradeReference1Contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("onboarding.reference1Contact")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("onboarding.contactNamePlaceholder")} {...field} data-testid="input-ref1-contact" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tradeReference1Phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("onboarding.reference1Phone")}</FormLabel>
                          <FormControl>
                            <Input placeholder="9876543210" maxLength={15} {...field} onBlur={() => { field.onBlur(); void form.trigger("tradeReference1Phone"); }} data-testid="input-ref1-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="tradeReference2Company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("onboarding.reference2Company")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("onboarding.companyNamePlaceholder")} {...field} data-testid="input-ref2-company" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tradeReference2Contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("onboarding.reference2Contact")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("onboarding.contactNamePlaceholder")} {...field} data-testid="input-ref2-contact" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tradeReference2Phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("onboarding.reference2Phone")}</FormLabel>
                          <FormControl>
                            <Input placeholder="9876543210" maxLength={15} {...field} onBlur={() => { field.onBlur(); void form.trigger("tradeReference2Phone"); }} data-testid="input-ref2-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <h4 className="font-medium text-sm sm:text-base">How did you hear about us?</h4>
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="referralSource"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referral Source</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-referral-source">
                                <SelectValue placeholder="Select how you found us" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="google">Google</SelectItem>
                              <SelectItem value="app_store">App Store</SelectItem>
                              <SelectItem value="linkedin">LinkedIn</SelectItem>
                              <SelectItem value="sales_person">Sales Person Reference</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    {form.watch("referralSource") === "sales_person" && (
                      <FormField
                        control={form.control}
                        name="referralSalesPersonName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Employee Code</FormLabel>
                            <FormControl>
                              <Input placeholder="" {...field} data-testid="input-employee-code" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 sm:gap-4">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("business")} data-testid="button-back-business" className="w-full sm:w-auto text-sm sm:text-base">
                    {t("onboarding.back")}
                  </Button>
                  <Button type="button" onClick={() => setActiveTab("documents")} data-testid="button-next-documents" className="w-full sm:w-auto text-sm sm:text-base">
                    {t("onboarding.next")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">{t("onboarding.complianceDocuments")}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{t("onboarding.complianceDocumentsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="gstCertificateUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.gstCertificate")}</FormLabel>
                        <FormControl>
                          <DocumentUploadWithCamera
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder={t("onboarding.noFileSelected")}
                            testId="upload-gst-certificate"
                            documentType="gst_certificate"
                            disabled={form.watch("noGstCertificate")}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">{t("onboarding.gstCertificateDesc")}</FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="noGstCertificate"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-2 sm:space-x-3 space-y-0 rounded-md border p-3 sm:p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (!checked) {
                                form.setValue("alternativeDocumentType", "");
                                form.setValue("alternativeAuthorizationUrl", "");
                              }
                            }}
                            data-testid="checkbox-no-gst"
                            className="mt-0.5"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none flex-1 min-w-0">
                          <FormLabel className="cursor-pointer text-xs sm:text-sm">
                            I do not have GST Registration Certificate
                          </FormLabel>
                          <FormDescription className="text-xs">
                            Check this if you don't have GST and want to upload an alternative document
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                
                {form.watch("noGstCertificate") && (
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 p-3 sm:p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
                    <FormField
                      control={form.control}
                      name="alternativeDocumentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alternative Document Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-alternative-doc-type">
                                <SelectValue placeholder="Select document type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="msme_certificate">MSME / Udyam Certificate</SelectItem>
                              <SelectItem value="shop_establishment">Shop & Establishment License</SelectItem>
                              <SelectItem value="trade_license">Trade License</SelectItem>
                              <SelectItem value="iec_certificate">IEC Certificate (Import/Export)</SelectItem>
                              <SelectItem value="fssai_license">FSSAI License</SelectItem>
                              <SelectItem value="other_govt_auth">Other Government Authorization</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>Select the type of authorization document you have</FormDescription>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="alternativeAuthorizationUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Upload Document</FormLabel>
                          <FormControl>
                            <DocumentUploadWithCamera
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder={t("onboarding.noFileSelected")}
                              testId="upload-alternative-authorization"
                              documentType="alternative_authorization"
                              disabled={!form.watch("alternativeDocumentType")}
                            />
                          </FormControl>
                          <FormDescription>Upload the selected authorization document</FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="panCardUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.panCard")}</FormLabel>
                        <FormControl>
                          <DocumentUploadWithCamera
                            value={field.value || ""}
                            onChange={(val) => {
                              field.onChange(val);
                              if (!val) {
                                setPanOcrError(null);
                              }
                            }}
                            placeholder={t("onboarding.noFileSelected")}
                            testId="upload-pan-card"
                            documentType="pan_card"
                            onFile={handlePanCardFile}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">{t("onboarding.panCardDesc")}</FormDescription>
                        {isPanOcrRunning && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Reading PAN number from document…
                          </p>
                        )}
                        {!isPanOcrRunning && panOcrError && (
                          <p className="text-xs text-amber-600 mt-1">{panOcrError}</p>
                        )}
                        {!isPanVerifying && panVerified && !panError && !panOcrError && (
                          <p className="text-xs text-green-600 mt-1">PAN verified successfully.</p>
                        )}
                        {!isPanVerifying && panError && (
                          <p className="text-xs text-red-600 mt-1">{panError}</p>
                        )}
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch("businessType") === "proprietorship" && (
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="aadhaarCardUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Aadhaar Card Upload <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <DocumentUploadWithCamera
                              value={field.value || ""}
                              onChange={field.onChange}
                              placeholder="Upload Aadhaar card"
                              testId="upload-aadhaar-card"
                              documentType="aadhaar_card"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">Upload front side of your Aadhaar card</FormDescription>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="incorporationCertificateUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.incorporationCertificate")} <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <DocumentUploadWithCamera
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder={t("onboarding.noFileSelected")}
                            testId="upload-incorporation-certificate"
                            documentType="incorporation_certificate"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">{t("onboarding.incorporationCertificateDesc")}</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="businessAddressProofUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{t("onboarding.officePhoto")}</FormLabel>
                        <p className="text-xs sm:text-sm text-red-600 font-medium mb-2">
                          {t("onboarding.officeSelfieNote")}
                        </p>
                        <FormControl>
                          <DocumentUploadWithCamera
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder={t("onboarding.noFileSelected")}
                            testId="upload-address-proof"
                            documentType="address_proof"
                            preferCamera={true}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">{t("onboarding.addressProofDesc")}</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="selfieUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Selfie</FormLabel>
                        <FormControl>
                          <DocumentUploadWithCamera
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder={t("onboarding.noFileSelected")}
                            testId="upload-selfie"
                            documentType="selfie"
                            preferCamera={true}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* LR Copy - Mandatory for Transporters */}
                {form.watch("shipperRole") === "transporter" && (
                  <div className="p-3 sm:p-4 rounded-lg border border-dashed border-primary/50 bg-primary/5">
                    <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Transporter Documents</h4>
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="lrCopyUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">LR Copy <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <DocumentUploadWithCamera
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder="No file selected"
                                testId="upload-lr-copy"
                                documentType="lr_copy"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Upload a copy of your Lorry Receipt (LR) - mandatory for Transporters
                            </FormDescription>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {/* Consent Checkbox */}
                  <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/40">
                    <Checkbox
                      id="shipper-consent-check"
                      checked={consentChecked}
                      onCheckedChange={(v) => setConsentChecked(!!v)}
                      className="mt-0.5"
                    />
                    <label htmlFor="shipper-consent-check" className="text-sm leading-relaxed cursor-pointer select-none">
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

                  {(() => {
                    const panCardUploaded = !!form.watch("panCardUrl");
                    const panReady = panCardUploaded && panVerified;
                    return (
                      <>
                        {!panReady && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                            {!panCardUploaded
                              ? "Please upload your PAN card before submitting."
                              : "PAN card must be verified before submitting."}
                          </p>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 sm:gap-4">
                          <Button type="button" variant="outline" onClick={() => setActiveTab("contact")} data-testid="button-back-contact" className="w-full sm:w-auto text-sm sm:text-base">
                            {t("onboarding.back")}
                          </Button>
                          <Button type="submit" disabled={isSubmitting || !consentChecked || !panCardUploaded || !panVerified} data-testid="button-submit-onboarding" className="w-full sm:w-auto text-sm sm:text-base">
                            {isSubmitting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {t("onboarding.submitting")}
                              </>
                            ) : (
                              <>
                                {isUpdate ? t("onboarding.resubmit") : t("onboarding.submit")}
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </Form>

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
    </>
  );
}
