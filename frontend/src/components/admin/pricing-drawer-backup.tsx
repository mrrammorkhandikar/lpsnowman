import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { calculateFromMargin, calculateFromPayout } from "@shared/pricing";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Truck,
  MapPin,
  Package,
  Users,
  Send,
  Sparkles,
  IndianRupee,
  ChevronRight,
  Loader2,
  BarChart3,
  Receipt,
  FileText,
  CheckCircle,
  Scale,
  Search,
  DollarSign,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface LoadData {
  id: string;
  loadId?: string;
  pickupCity: string;
  dropoffCity: string;
  weight: number | string;
  weightUnit?: string;
  requiredTruckType: string;
  distance?: number | string;
  pickupDate?: string | Date;
  shipperId?: string;
  shipperName?: string;
  status?: string;
  cargoDescription?: string;
  adminPrice?: number;
  finalPrice?: string;
  adminFinalPrice?: string;
  // Shipper's requested pricing
  shipperPricePerTon?: string | number | null;
  shipperFixedPrice?: string | number | null;
  rateType?: string | null; // "per_ton" or "fixed_price"
  advancePaymentPercent?: number | null; // Shipper's preferred advance payment percentage
}

interface CarrierOption {
  id: string;
  name: string;
  rating: number;
  trucks: number;
  zone: string;
  completedLoads: number;
  carrierType: "enterprise" | "solo";
  phone?: string;
}

interface PricingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: LoadData | null;
  onSuccess?: () => void;
  carriers?: CarrierOption[];
}

interface PricingSuggestion {
  load_id: string;
  suggested_price: number;
  breakdown: {
    baseAmount: number;
    fuelSurcharge: number;
    handlingFee: number;
    seasonalMultiplier: number;
    regionMultiplier: number;
  };
  params: {
    distanceKm: number;
    weightTons: number;
    loadType: string;
    baseRatePerKm: number;
    region: string;
  };
  confidence_score: number;
  comparable_loads: Array<{
    id: string;
    route: string;
    distance: number;
    finalPrice: string;
  }>;
  risk_flags: string[];
  platform_rate_percent: number;
}

interface PricingTemplate {
  id: string;
  name: string;
  description?: string;
  markupPercent: string;
  fixedFee: string;
  fuelSurchargePercent: string;
  platformRatePercent: string;
}

const formatRupees = (amount: number): string => {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
};

export function PricingDrawer({
  open,
  onOpenChange,
  load,
  onSuccess,
  carriers = [],
}: PricingDrawerProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  // Pricing state
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  const [grossPrice, setGrossPrice] = useState(0); // Total price before margin deduction (what shipper pays)
  const [markupPercent, setMarkupPercent] = useState(0);
  const [fixedFee, setFixedFee] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [platformMarginPercent, setPlatformMarginPercent] = useState(10);
  const [advancePaymentPercent, setAdvancePaymentPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  
  // Per-ton pricing state
  const [usePerTonRate, setUsePerTonRate] = useState(false);
  const [ratePerTon, setRatePerTon] = useState(0);
  const savedRatePerTon = useRef(0);
  const [customTonnage, setCustomTonnage] = useState<number | null>(null);

  // Posting options
  const [postMode, setPostMode] = useState<"open" | "invite" | "assign">("open");
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [assignedCarrier, setAssignedCarrier] = useState("");
  const [drawerCarrierSearch, setDrawerCarrierSearch] = useState("");
  const [allowCounterBids, setAllowCounterBids] = useState(true);

  // Pricing intelligence data
  const [breakdown, setBreakdown] = useState<PricingSuggestion["breakdown"] | null>(null);
  const [params, setParams] = useState<PricingSuggestion["params"] | null>(null);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [pricingId, setPricingId] = useState<string | null>(null);

  // Custom cost per km
  const [customCostPerKm, setCustomCostPerKm] = useState<Record<string, number>>({});
  const [customCostComments, setCustomCostComments] = useState<Record<string, string>>({});

  // Determine if load is in "Carrier Finalized" state (awarded) - ready for invoice
  const isCarrierFinalized = load?.status === "awarded";
  
  // Get the invoice price for shipper - use adminFinalPrice (shipper's gross price)
  // NOT finalPrice which is carrier payout after platform margin deduction
  const bidPrice = useMemo(() => {
    // For shipper invoices, use adminFinalPrice (shipper's gross price)
    const price = load?.adminFinalPrice || load?.adminPrice;
    if (price) {
      return typeof price === 'string' ? parseFloat(price) : price;
    }
    return 0;
  }, [load]);

  // Fetch templates
  const { data: templates = [] } = useQuery<PricingTemplate[]>({
    queryKey: ["/api/admin/pricing/templates"],
    enabled: open && !isCarrierFinalized,
  });

  // Simple direct calculation - no complex state management
  // Platform margin amount = grossPrice * (marginPercent / 100)
  const platformMargin = Math.round(grossPrice * (platformMarginPercent / 100));
  
  // Carrier payout = grossPrice - platform margin  
  const calculatedPayout = grossPrice - platformMargin;
  const finalPrice = calculatedPayout;
  const carrierPayout = finalPrice;
  
  // Local string states for inputs (allows typing without being overwritten)
  const [marginInputStr, setMarginInputStr] = useState<string>(platformMarginPercent.toString());
  const [payoutInputStr, setPayoutInputStr] = useState<string>(calculatedPayout.toString());
  
  // Track which field the user is actively editing
  const [editingField, setEditingField] = useState<'margin' | 'payout' | null>(null);
  
  // Sync payout display when margin changes OR on initial load (not when editing payout)
  useEffect(() => {
    if (editingField !== 'payout') {
      setPayoutInputStr(calculatedPayout.toString());
    }
  }, [calculatedPayout]);
  
  // When editing payout, DON'T let margin changes affect the input (prevents overwrite while typing)
  
  // Handle margin input - instant update, syncs payout
  const handleMarginChange = (inputStr: string) => {
    setEditingField('margin');
    setMarginInputStr(inputStr);
    const val = parseFloat(inputStr) || 0;
    const clamped = Math.min(50, Math.max(0, val));
    if (!isNaN(parseFloat(inputStr)) || inputStr === '' || inputStr.endsWith('.')) {
      setPlatformMarginPercent(clamped);
    }
  };
  
  // Handle carrier payout input - instant reverse calculation to update margin
  const handlePayoutChange = (payoutStr: string) => {
    setEditingField('payout');
    setPayoutInputStr(payoutStr);
    
    // Immediately calculate and update margin
    const payout = parseInt(payoutStr.replace(/\D/g, '')) || 0;
    if (grossPrice > 0 && payout > 0) {
      const newMargin = ((grossPrice - payout) / grossPrice) * 100;
      const roundedMargin = Math.round(newMargin * 100) / 100; // 2 decimal places
      const clampedMargin = Math.min(50, Math.max(0, roundedMargin));
      setPlatformMarginPercent(clampedMargin);
      setMarginInputStr(clampedMargin.toString());
    }
  };
  
  // On blur, reset editing field
  const handlePayoutBlur = () => {
    setEditingField(null);
  };
  
  const handleMarginBlur = () => {
    setEditingField(null);
  };

  const priceDeviation = useMemo(() => {
    if (suggestedPrice === 0) return 0;
    return ((grossPrice - suggestedPrice) / suggestedPrice) * 100;
  }, [grossPrice, suggestedPrice]);

  const requiresApproval = useMemo(() => {
    return Math.abs(priceDeviation) > 15;
  }, [priceDeviation]);

  // Get weight in tons, converting from KG if needed
  const loadWeightInTons = useMemo(() => {
    const w = parseFloat(load?.weight?.toString() || "0");
    if (w <= 0) return 1;
    // Convert KG to MT if weight unit is KG
    if (load?.weightUnit === 'KG') {
      return Math.round((w / 1000) * 100) / 100; // Round to 2 decimal places
    }
    return w; // Already in MT
  }, [load?.weight, load?.weightUnit]);

  // Use custom tonnage if set, otherwise use load weight
  const weightInTons = customTonnage !== null ? customTonnage : loadWeightInTons;

  // Calculated price from per-ton rate
  const calculatedFromPerTon = useMemo(() => {
    return Math.round(ratePerTon * weightInTons);
  }, [ratePerTon, weightInTons]);

  // Suggested per-ton rate based on suggested price
  const suggestedPerTonRate = useMemo(() => {
    if (weightInTons <= 0 || suggestedPrice <= 0) return 0;
    return Math.round(suggestedPrice / weightInTons);
  }, [suggestedPrice, weightInTons]);

  // Reset per-ton state when drawer closes or load changes
  useEffect(() => {
    if (!open) {
      // Reset when drawer closes
      setUsePerTonRate(false);
      setRatePerTon(0);
      setCustomTonnage(null);
      setMarginInputStr("10");
      setPlatformMarginPercent(10);
    }
  }, [open]);

  // Reset per-ton state when load changes
  useEffect(() => {
    setUsePerTonRate(false);
    setRatePerTon(0);
    setCustomTonnage(null);
  }, [load?.id]);

  // Auto-populate pricing from shipper's requested rate
  useEffect(() => {
    if (open && load && !isCarrierFinalized) {
      // Check if shipper provided pricing
      const shipperRate = load.rateType;
      const shipperPerTon = load.shipperPricePerTon;
      const shipperFixed = load.shipperFixedPrice;
      const shipperAdvance = load.advancePaymentPercent;
      
      // Auto-populate advance payment percentage if provided
      if (shipperAdvance !== null && shipperAdvance !== undefined && shipperAdvance > 0) {
        setAdvancePaymentPercent(shipperAdvance);
      }
      
      if (shipperRate === "per_ton" && shipperPerTon) {
        // Shipper provided per-ton rate
        const perTonValue = typeof shipperPerTon === 'string' ? parseFloat(shipperPerTon) : shipperPerTon;
        if (perTonValue > 0) {
          savedRatePerTon.current = perTonValue;
          setUsePerTonRate(true);
          setRatePerTon(perTonValue);
          // Calculate gross price from per-ton rate
          const calculatedPrice = Math.round(perTonValue * loadWeightInTons);
          setGrossPrice(calculatedPrice);
        }
      } else if (shipperRate === "fixed_price" && shipperFixed) {
        // Shipper provided fixed price - explicitly set Fixed Price mode
        const fixedValue = typeof shipperFixed === 'string' ? parseFloat(shipperFixed) : shipperFixed;
        if (fixedValue > 0) {
          setUsePerTonRate(false);
          setGrossPrice(Math.round(fixedValue));
          // Still store per-ton equivalent for if user switches
          if (loadWeightInTons > 0) savedRatePerTon.current = Math.round(fixedValue / loadWeightInTons);
        }
      } else if (shipperFixed) {
        // Fallback: Shipper provided fixed price without explicit rateType
        const fixedValue = typeof shipperFixed === 'string' ? parseFloat(shipperFixed) : shipperFixed;
        if (fixedValue > 0) {
          setUsePerTonRate(false);
          setGrossPrice(Math.round(fixedValue));
          if (loadWeightInTons > 0) savedRatePerTon.current = Math.round(fixedValue / loadWeightInTons);
        }
      }
    }
  }, [open, load?.id, load?.rateType, load?.shipperPricePerTon, load?.shipperFixedPrice, load?.advancePaymentPercent, isCarrierFinalized, loadWeightInTons]);

  // Fetch suggested price when load changes (only for non-finalized loads)
  useEffect(() => {
    if (open && load?.id && !isCarrierFinalized) {
      fetchSuggestedPrice();
    }
  }, [open, load?.id, isCarrierFinalized]);

  // Update gross price when adjustments change (only when not using per-ton rate and no shipper price)
  useEffect(() => {
    // Don't auto-adjust if shipper provided their own pricing
    const hasShipperPrice = (load?.rateType === "fixed_price" && load?.shipperFixedPrice) || 
                            (load?.rateType === "per_ton" && load?.shipperPricePerTon);
    
    if (!usePerTonRate && suggestedPrice > 0 && !hasShipperPrice) {
      const adjusted = suggestedPrice * (1 + markupPercent / 100) + fixedFee - discountAmount;
      setGrossPrice(Math.round(Math.max(0, adjusted)));
    }
  }, [suggestedPrice, markupPercent, fixedFee, discountAmount, usePerTonRate, load?.rateType, load?.shipperFixedPrice, load?.shipperPricePerTon]);

  // Update gross price when per-ton rate changes
  useEffect(() => {
    if (usePerTonRate && ratePerTon > 0) {
      setGrossPrice(calculatedFromPerTon);
    }
  }, [usePerTonRate, ratePerTon, calculatedFromPerTon]);

  // Apply template
  useEffect(() => {
    if (selectedTemplate && templates.length > 0) {
      const template = templates.find((t) => t.id === selectedTemplate);
      if (template) {
        setMarkupPercent(parseFloat(template.markupPercent) || 0);
        setFixedFee(parseFloat(template.fixedFee) || 0);
        setPlatformMarginPercent(parseFloat(template.platformRatePercent) || 10);
      }
    }
  }, [selectedTemplate, templates]);

  const fetchSuggestedPrice = async () => {
    if (!load?.id) return;
    setIsLoading(true);
    
    // Check if shipper already provided pricing - don't overwrite with suggestions
    const hasShipperPrice = (load.rateType === "fixed_price" && load.shipperFixedPrice) || 
                            (load.rateType === "per_ton" && load.shipperPricePerTon);
    
    try {
      const response = await apiRequest("POST", "/api/admin/pricing/suggest", {
        load_id: load.id,
        distance: load.distance,
        weight: load.weight,
        loadType: load.requiredTruckType,
        pickupCity: load.pickupCity,
      });
      const data: PricingSuggestion = await response.json();

      setSuggestedPrice(data.suggested_price);
      // Only set gross price if shipper didn't provide their own price
      if (!hasShipperPrice) {
        setGrossPrice(data.suggested_price);
      }
      setBreakdown(data.breakdown);
      setParams(data.params);
      setConfidenceScore(data.confidence_score);
      setPlatformMarginPercent(data.platform_rate_percent);
    } catch (error) {
      console.error("Failed to fetch suggested price:", error);
      const parsedStored = parseFloat(load.distance?.toString() || "");
      const fromEstimate = computeRouteDistanceKmEstimate({
        pickupCity: load.pickupCity,
        dropoffCity: load.dropoffCity,
      });
      const distanceKm =
        Number.isFinite(parsedStored) && parsedStored > 0
          ? parsedStored
          : Number.isFinite(fromEstimate)
            ? fromEstimate
            : 0;
      const weight = parseFloat(load.weight?.toString() || "10");
      if (distanceKm > 0) {
        const basePrice = distanceKm * 45 * (1 + Math.max(0, weight - 5) * 0.02);
        const estimated = Math.round(basePrice * 1.2 + 500);
        setSuggestedPrice(estimated);
        if (!hasShipperPrice) {
          setGrossPrice(estimated);
        }
      } else {
        setSuggestedPrice(0);
        if (!hasShipperPrice) {
          setGrossPrice(0);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!load?.id || bidPrice <= 0) return;
    setIsSending(true);
    
    try {
      // Generate and send invoice in one API call
      const response = await apiRequest("POST", "/api/admin/invoice/generate-and-send", {
        load_id: load.id,
        amount: bidPrice,
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Invoice Sent",
          description: `Invoice for ${formatRupees(bidPrice)} has been generated and sent to the shipper.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/queue"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send invoice";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const validatePricing = (): string | null => {
    if (grossPrice <= 0) {
      return "Total price must be greater than zero.";
    }
    if (postMode === "invite" && selectedCarriers.length === 0) {
      return "Please select at least one carrier to invite.";
    }
    if (platformMarginPercent < 0 || platformMarginPercent > 50) {
      return "Platform margin must be between 0% and 50%.";
    }
    return null;
  };

  const handleLockAndPost = async () => {
    if (!load?.id) return;

    const validationError = validatePricing();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    if (postMode === "assign" && !assignedCarrier) {
      toast({
        title: "Validation Error",
        description: "Please select a carrier to assign this load to.",
        variant: "destructive",
      });
      return;
    }

    setIsLocking(true);
    
    const isMockLoad = typeof load.id === 'string' && load.id.startsWith("LD-");
    
    if (isMockLoad) {
      setTimeout(() => {
        toast({
          title: "Load Posted Successfully",
          description: `Load has been priced at ${formatRupees(grossPrice)} and posted to carriers.`,
        });
        onSuccess?.();
        onOpenChange(false);
        setIsLocking(false);
      }, 500);
      return;
    }
    
    try {
      if (postMode === "assign") {
        const saveResponse = await apiRequest("POST", "/api/admin/pricing/save", {
          load_id: load.id,
          suggested_price: suggestedPrice,
          gross_price: grossPrice,
          final_price: grossPrice,
          carrier_payout: finalPrice,
          markup_percent: markupPercent,
          fixed_fee: fixedFee,
          discount_amount: discountAmount,
          platform_margin_percent: platformMarginPercent,
          advance_payment_percent: advancePaymentPercent,
          notes,
          template_id: selectedTemplate || null,
        });
        await saveResponse.json();

        await apiRequest("POST", "/api/admin/assign", {
          load_id: load.id,
          carrier_id: assignedCarrier,
          final_price: finalPrice.toString(),
          gross_price: grossPrice.toString(),
        });

        const selectedCarrierName = carriers.find(c => c.id === assignedCarrier)?.name || "carrier";
        toast({
          title: "Load Assigned Successfully",
          description: `Load assigned to ${selectedCarrierName}. Carrier payout: ${formatRupees(finalPrice)}.`,
        });
      } else {
        const saveResponse = await apiRequest("POST", "/api/admin/pricing/save", {
          load_id: load.id,
          suggested_price: suggestedPrice,
          gross_price: grossPrice,
          final_price: grossPrice,
          carrier_payout: finalPrice,
          markup_percent: markupPercent,
          fixed_fee: fixedFee,
          discount_amount: discountAmount,
          platform_margin_percent: platformMarginPercent,
          advance_payment_percent: advancePaymentPercent,
          notes,
          template_id: selectedTemplate || null,
        });
        const saveData = await saveResponse.json();
        const currentPricingId = saveData.pricing?.id || pricingId;

        if (!currentPricingId) {
          throw new Error("Failed to create pricing record");
        }

        await apiRequest("POST", "/api/admin/pricing/lock", {
          pricing_id: currentPricingId,
          final_price: grossPrice,
          carrier_payout: finalPrice,
          post_mode: postMode,
          invite_carrier_ids: postMode === "invite" ? selectedCarriers : [],
          allow_counter_bids: allowCounterBids,
          advance_payment_percent: advancePaymentPercent,
          notes,
        });

        toast({
          title: "Load Posted Successfully",
          description: `Load has been priced at ${formatRupees(grossPrice)} and posted to carriers.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/available-loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? (error.message.includes(':') ? error.message.split(':').slice(1).join(':').trim() : error.message)
        : "Failed to process load";
      toast({
        title: "Failed to Process Load",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLocking(false);
    }
  };

  const toggleCarrier = (carrierId: string) => {
    setSelectedCarriers((prev) =>
      prev.includes(carrierId)
        ? prev.filter((id) => id !== carrierId)
        : [...prev, carrierId]
    );
  };

  const drawerFilteredCarriers = useMemo(() => {
    if (!drawerCarrierSearch.trim()) return carriers;
    const q = drawerCarrierSearch.toLowerCase();
    return carriers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        c.carrierType.toLowerCase().includes(q)
    );
  }, [carriers, drawerCarrierSearch]);

  if (!load) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[550px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            {isCarrierFinalized ? (
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            ) : (
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            )}
            <SheetTitle className="text-base sm:text-lg" data-testid="text-drawer-title">
              {isCarrierFinalized ? "Send Invoice to Shipper" : "Price & Post Load"}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs sm:text-sm">
            {isCarrierFinalized 
              ? "Generate and send invoice for the finalized bid"
              : "Set pricing and post to carrier marketplace"
            }
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Load Summary Card */}
            <Card>
              <CardContent className="pt-3 sm:pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Load:</span>
                    <span className="font-mono font-medium" data-testid="text-load-id">
                      {load.loadId || load.id?.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    <span className="truncate">{load.requiredTruckType || "Standard"}</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                    <span className="truncate">{load.pickupCity}</span>
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                    <span className="truncate">{load.dropoffCity}</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                    <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    <span>{load.weight} {load.weightUnit || "MT"}</span>
                    {load.cargoDescription && (
                      <>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-muted-foreground truncate">{load.cargoDescription}</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 1: Invoice Section (for Carrier Finalized loads) */}
            {isCarrierFinalized && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <h3 className="font-semibold text-sm sm:text-base">Invoice Details</h3>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px] sm:text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Carrier Finalized
                  </Badge>
                </div>

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-3 sm:pt-4 space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Shipper:</span>
                      <span className="font-medium truncate ml-2">{load.shipperName || "Unknown"}</span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        <span className="font-medium text-sm sm:text-base">Bid Amount</span>
                      </div>
                      <span className="text-xl sm:text-2xl font-bold text-primary" data-testid="text-bid-amount">
                        {formatRupees(bidPrice)}
                      </span>
                    </div>

                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground">
                      <p>Invoice will be automatically generated with:</p>
                      <ul className="mt-2 space-y-1 list-disc list-inside">
                        <li>Load details and route information</li>
                        <li>Agreed bid amount: {formatRupees(bidPrice)}</li>
                        <li>Payment terms and due date</li>
                      </ul>
                    </div>

                    <Button 
                      className="w-full text-sm sm:text-base h-10 sm:h-11" 
                      onClick={handleSendInvoice}
                      disabled={isSending || bidPrice <= 0}
                      data-testid="button-send-invoice"
                    >
                      {isSending ? (
                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      )}
                      Send Invoice to Shipper
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* SECTION 2: Carrier Posting Section (for loads needing pricing) */}
            {!isCarrierFinalized && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <h3 className="font-semibold text-sm sm:text-base">Post to Carrier Marketplace</h3>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-8 sm:py-12">
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Shipper Requested Price Indicator */}
                    {(load.shipperFixedPrice || load.shipperPricePerTon || load.advancePaymentPercent) && (
                      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                        <CardContent className="pt-3 sm:pt-4">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600" />
                            <span className="font-medium text-xs sm:text-sm text-amber-700 dark:text-amber-400">Shipper's Pricing Preference</span>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px] sm:text-xs">
                              Pre-filled
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {(load.shipperFixedPrice || load.shipperPricePerTon) && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs sm:text-sm text-muted-foreground">
                                  {load.rateType === "per_ton" ? "Per Tonne Rate" : "Fixed Price"}
                                </span>
                                <span className="font-bold text-base sm:text-lg text-amber-700 dark:text-amber-400" data-testid="text-shipper-requested-price">
                                  {load.rateType === "per_ton" && load.shipperPricePerTon
                                    ? `Rs. ${parseFloat(load.shipperPricePerTon.toString()).toLocaleString("en-IN")}/MT`
                                    : load.shipperFixedPrice
                                      ? formatRupees(parseFloat(load.shipperFixedPrice.toString()))
                                      : "-"
                                  }
                                </span>
                              </div>
                            )}
                            {load.advancePaymentPercent && load.advancePaymentPercent > 0 && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs sm:text-sm text-muted-foreground">Preferred Advance</span>
                                <span className="font-bold text-base sm:text-lg text-amber-700 dark:text-amber-400" data-testid="text-shipper-advance">
                                  {load.advancePaymentPercent}%
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                            The pricing fields below have been pre-filled with the shipper's preferences. You can adjust as needed.
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Template Selection */}
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Pricing Template (Optional)</Label>
                      <Select value={selectedTemplate || "none"} onValueChange={(val) => setSelectedTemplate(val === "none" ? "" : val)}>
                        <SelectTrigger className="h-9 text-xs sm:text-sm" data-testid="select-template">
                          <SelectValue placeholder="Select a template..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No template</SelectItem>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Rate Type Selection */}
                    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                      <CardContent className="pt-3 sm:pt-4 space-y-3 sm:space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Scale className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                            <span className="font-medium text-xs sm:text-sm">Pricing Method</span>
                          </div>
                        </div>
                        
                        {/* Rate Type Toggle */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={!usePerTonRate ? "default" : "outline"}
                            className="w-full text-xs sm:text-sm h-8 sm:h-9"
                            onClick={() => {
                              // Save current rate before switching to fixed
                              if (ratePerTon > 0) savedRatePerTon.current = ratePerTon;
                              setUsePerTonRate(false);
                              setRatePerTon(0);
                            }}
                            data-testid="button-rate-type-fixed"
                          >
                            <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            Fixed Price
                          </Button>
                          <Button
                            type="button"
                            variant={usePerTonRate ? "default" : "outline"}
                            className="w-full text-xs sm:text-sm h-8 sm:h-9"
                            onClick={() => {
                              setUsePerTonRate(true);
                              // Restore saved DB rate
                              setRatePerTon(savedRatePerTon.current);
                            }}
                            data-testid="button-rate-type-per-ton"
                          >
                            <Scale className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            Per Tonne Rate
                          </Button>
                        </div>
                        
                        {/* Per Tonne Rate Calculator - Only shown when usePerTonRate is true */}
                        {usePerTonRate && (
                          <div className="space-y-3 sm:space-y-4 pt-2 border-t">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs sm:text-sm">Tonnage (MT)</Label>
                                <Input
                                  type="number"
                                  value={customTonnage !== null ? customTonnage : loadWeightInTons}
                                  onChange={(e) => {
                                    const newWeight = parseFloat(e.target.value) || 0;
                                    setCustomTonnage(newWeight);
                                  }}
                                  placeholder="Enter tonnage"
                                  className="text-base sm:text-lg font-medium h-9 sm:h-10"
                                  data-testid="input-tonnage"
                                />
                                {customTonnage === null && (
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">From load: {loadWeightInTons} MT</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs sm:text-sm">Rate Per Tonne (Rs.)</Label>
                                <Input
                                  type="number"
                                  value={ratePerTon || ""}
                                  onChange={(e) => {
                                    const rate = parseInt(e.target.value) || 0;
                                    setRatePerTon(rate);
                                    savedRatePerTon.current = rate;
                                  }}
                                  placeholder="e.g. 2000"
                                  className="text-base sm:text-lg font-medium h-9 sm:h-10"
                                  data-testid="input-rate-per-ton"
                                />
                              </div>
                            </div>
                            
                            {ratePerTon > 0 && (
                              <div className="flex items-center justify-between p-2 sm:p-3 bg-primary/10 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Calculator className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                                  <span className="text-xs sm:text-sm font-medium">Calculated Total</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                                    {weightInTons} MT x Rs. {ratePerTon.toLocaleString("en-IN")}
                                  </p>
                                  <p className="text-lg sm:text-xl font-bold text-primary" data-testid="text-calculated-total">
                                    {formatRupees(calculatedFromPerTon)}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Fixed Price Input - Only shown when usePerTonRate is false */}
                        {!usePerTonRate && (
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs sm:text-sm">Enter Fixed Price (Rs.)</Label>
                            <div className="flex items-center gap-2">
                              <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              <Input
                                type="number"
                                value={grossPrice || ""}
                                onChange={(e) => setGrossPrice(parseInt(e.target.value) || 0)}
                                placeholder="e.g. 50000"
                                className="text-base sm:text-lg font-medium h-9 sm:h-10"
                                data-testid="input-fixed-price"
                              />
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              This is the total amount the shipper will pay
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Separator />

                    {/* Total Price Summary (Shipper pays) */}
                    <Card className="border-green-500">
                      <CardContent className="pt-3 sm:pt-4">
                        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                          <div className="flex items-center gap-2">
                            <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span className="font-medium text-sm sm:text-base">Total Price</span>
                            <Badge variant="outline" className="text-[10px] sm:text-xs">
                              {usePerTonRate ? "Per Tonne" : "Fixed"}
                            </Badge>
                          </div>
                          {usePerTonRate ? (
                            <span className="text-lg sm:text-xl font-bold" data-testid="text-total-price">
                              {formatRupees(grossPrice)}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              value={grossPrice}
                              onChange={(e) => setGrossPrice(parseInt(e.target.value) || 0)}
                              className="w-28 sm:w-32 text-right font-bold text-base sm:text-lg h-9 sm:h-10"
                              data-testid="input-gross-price"
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Margin & Final Price */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                          <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                          Margin & Final Price
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 sm:space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs sm:text-sm">Platform Margin</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={marginInputStr}
                              onChange={(e) => handleMarginChange(e.target.value)}
                              onBlur={handleMarginBlur}
                              className="w-14 sm:w-16 text-right text-sm h-8 sm:h-9"
                              data-testid="input-platform-margin"
                            />
                            <span className="text-xs sm:text-sm font-medium">%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                          <span className="text-muted-foreground">Platform Earnings:</span>
                          <span className="font-medium text-primary">{formatRupees(platformMargin)}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-xs sm:text-sm">Final Price (Carrier Payout):</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs sm:text-sm text-muted-foreground">Rs.</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={payoutInputStr}
                              onChange={(e) => handlePayoutChange(e.target.value)}
                              onBlur={handlePayoutBlur}
                              className="w-24 sm:w-28 text-right font-bold text-base sm:text-lg text-green-600 dark:text-green-400 h-8 sm:h-9"
                              data-testid="input-carrier-payout"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Advance Payment Percentage - Enhanced */}
                    <Card className="border-2 border-green-200 dark:border-green-900">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                          <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                          Carrier Advance Payment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 sm:space-y-4">
                        {/* Quick Select Buttons */}
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm text-muted-foreground">Quick Select</Label>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {[0, 50, 75, 90, 100].map((percent) => (
                              <Button
                                key={percent}
                                type="button"
                                variant={advancePaymentPercent === percent ? "default" : "outline"}
                                size="sm"
                                className="text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                                onClick={() => setAdvancePaymentPercent(percent)}
                                data-testid={`button-advance-${percent}`}
                              >
                                {percent === 0 ? "No Advance" : `${percent}%`}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Input */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Label className="text-xs sm:text-sm">Custom:</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={advancePaymentPercent}
                              onChange={(e) => {
                                const val = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                                setAdvancePaymentPercent(Math.min(100, Math.max(0, val)));
                              }}
                              className="w-16 sm:w-20 text-right text-sm h-8 sm:h-9"
                              data-testid="input-advance-payment"
                            />
                            <span className="text-xs sm:text-sm font-medium">%</span>
                          </div>
                        </div>

                        {/* Payment Breakdown */}
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="text-muted-foreground">Advance (Upfront):</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {formatRupees(Math.round(finalPrice * (advancePaymentPercent / 100)))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="text-muted-foreground">Balance (On Delivery):</span>
                            <span className="font-semibold">
                              {formatRupees(Math.round(finalPrice * ((100 - advancePaymentPercent) / 100)))}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <span className="font-medium">Total Carrier Payout:</span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {formatRupees(finalPrice)}
                            </span>
                          </div>
                        </div>

                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Advance is paid to carrier before pickup. Balance is paid after successful delivery.
                        </p>
                      </CardContent>
                    </Card>

                    {/* Carrier Expenses Section */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                          <Truck className="h-3 w-3 sm:h-4 sm:w-4" />
                          Carrier Expenses
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 sm:space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <span className="text-xs sm:text-sm text-muted-foreground">Fuel</span>
                            <span className="text-xs sm:text-sm font-medium">Rs. 5000</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <span className="text-xs sm:text-sm text-muted-foreground">Tolls</span>
                            <span className="text-xs sm:text-sm font-medium">Rs. 2300</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <span className="text-xs sm:text-sm text-muted-foreground">Driver Pay</span>
                            <span className="text-xs sm:text-sm font-medium">Rs. 8000</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <span className="text-xs sm:text-sm text-muted-foreground">Maintenance</span>
                            <span className="text-xs sm:text-sm font-medium">Rs. 4500</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <span className="text-xs sm:text-sm text-muted-foreground">Miscellaneous</span>
                            <span className="text-xs sm:text-sm font-medium">Rs. 2500</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-medium">Total Expenses</span>
                            <span className="text-xs sm:text-sm font-bold">Rs. 22300</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Cost Per KM Section */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                          <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
                          Cost Per KM
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 sm:space-y-3">
                        {(() => {
                          const totalExpenses = 22300;
                          const distance = 600;
                          const baseCostPerKm = totalExpenses / distance;
                          const customAddition = customCostPerKm[load?.id || ""] || 0;
                          const finalCostPerKm = baseCostPerKm + customAddition;
                          
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                <span className="text-xs sm:text-sm text-muted-foreground">Total Expenses</span>
                                <span className="text-xs sm:text-sm font-medium">Rs. {totalExpenses.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                <span className="text-xs sm:text-sm text-muted-foreground">Distance</span>
                                <span className="text-xs sm:text-sm font-medium">{distance} KM</span>
                              </div>
                              <div className="pt-2 border-t">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs sm:text-sm font-medium">Base Cost Per KM</span>
                                  <span className="text-xs sm:text-sm font-bold text-primary">Rs. {baseCostPerKm.toFixed(2)}</span>
                                </div>
                              </div>
                              <div className="space-y-2 pt-2 border-t">
                                <label className="text-xs font-medium text-muted-foreground">Custom Cost Addition (Optional)</label>
                                <Input
                                  type="number"
                                  placeholder="Enter additional cost per km"
                                  value={customCostPerKm[load?.id || ""] || ""}
                                  onChange={(e) => {
                                    const value = e.target.value ? parseFloat(e.target.value) : 0;
                                    setCustomCostPerKm({
                                      ...customCostPerKm,
                                      [load?.id || ""]: value
                                    });
                                  }}
                                  className="h-9 text-xs sm:text-sm"
                                />
                                <Textarea
                                  placeholder="Add reason or notes for this custom cost addition..."
                                  value={customCostComments[load?.id || ""] || ""}
                                  onChange={(e) => {
                                    setCustomCostComments({
                                      ...customCostComments,
                                      [load?.id || ""]: e.target.value
                                    });
                                  }}
                                  className="min-h-[80px] resize-none text-xs sm:text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                  {(customCostComments[load?.id || ""] || "").length}/300 characters
                                </p>
                              </div>
                              <div className="pt-2 border-t bg-green-50 dark:bg-green-950/20 p-2 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs sm:text-sm font-medium">Final Cost Per KM</span>
                                  <span className="text-xs sm:text-sm font-bold text-green-700 dark:text-green-400">Rs. {finalCostPerKm.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>

                    <Separator />

                    {/* Posting Options */}
                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Posting Options
                      </h4>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="post-open"
                            checked={postMode === "open"}
                            onCheckedChange={() => setPostMode("open")}
                            data-testid="checkbox-post-open"
                          />
                          <Label htmlFor="post-open" className="flex-1 cursor-pointer">
                            <span className="font-medium">Open to All Carriers</span>
                            <p className="text-sm text-muted-foreground">
                              All verified carriers can view and bid
                            </p>
                          </Label>
                        </div>

                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="post-assign"
                            checked={postMode === "assign"}
                            onCheckedChange={() => setPostMode("assign")}
                            data-testid="checkbox-post-assign"
                          />
                          <Label htmlFor="post-assign" className="flex-1 cursor-pointer">
                            <span className="font-medium">Direct Assign</span>
                            <p className="text-sm text-muted-foreground">
                              Assign directly to a carrier, bypassing marketplace
                            </p>
                          </Label>
                        </div>

                        {postMode === "assign" && carriers.length > 0 && (
                          <div className="ml-7 space-y-2">
                            <Select value={assignedCarrier} onValueChange={setAssignedCarrier}>
                              <SelectTrigger data-testid="select-drawer-assign-carrier">
                                <SelectValue placeholder="Select carrier to assign" />
                              </SelectTrigger>
                              <SelectContent>
                                {carriers.map((carrier) => (
                                  <SelectItem key={carrier.id} value={carrier.id}>
                                    <span className="flex items-center gap-2">
                                      {carrier.name}
                                      <Badge variant={carrier.carrierType === "solo" ? "secondary" : "outline"} className="text-[9px] px-1 py-0">
                                        {carrier.carrierType === "solo" ? "Solo" : "Fleet"}
                                      </Badge>
                                      <span className="text-muted-foreground text-xs">({carrier.completedLoads} loads)</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {assignedCarrier && (
                              <p className="text-xs text-blue-600">
                                Load will be directly assigned to {carriers.find(c => c.id === assignedCarrier)?.name}. It will appear in their My Orders page.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {postMode !== "assign" && (
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="allow-counter"
                            checked={allowCounterBids}
                            onCheckedChange={(checked) => setAllowCounterBids(checked === true)}
                            data-testid="checkbox-allow-counter"
                          />
                          <Label htmlFor="allow-counter" className="cursor-pointer">
                            Allow carriers to submit counter-offers
                          </Label>
                        </div>
                      )}
                    </div>

                    {/* Post Button */}
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleLockAndPost}
                      disabled={isLocking || grossPrice <= 0}
                      data-testid="button-lock-post"
                    >
                      {isLocking ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Price & Post to Carriers
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}