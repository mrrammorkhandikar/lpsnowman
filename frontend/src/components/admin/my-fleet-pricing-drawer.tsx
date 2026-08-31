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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LoadData {
  id: string;
  loadId?: string;
  pickupCity: string;
  dropoffCity: string;
  weight: number | string;
  weightUnit?: string;
  requiredTruckType: string;
  distance?: number | string;
  pickupLat?: string | number | null;
  pickupLng?: string | number | null;
  dropoffLat?: string | number | null;
  dropoffLng?: string | number | null;
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
  carrierId?: string;
  assignedTruckId?: string | null;
  isAvailable?: boolean;
}

interface MyFleetPricingDrawerProps {
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

function getShipperGrossPrice(load: LoadData | null, weightInTons: number): number {
  if (!load) return 0;
  if (load.adminFinalPrice) {
    const n = parseFloat(String(load.adminFinalPrice));
    if (!Number.isNaN(n) && n > 0) return Math.round(n);
  }
  if (load.shipperFixedPrice) {
    const n = parseFloat(String(load.shipperFixedPrice));
    if (!Number.isNaN(n) && n > 0) return Math.round(n);
  }
  if (load.shipperPricePerTon && weightInTons > 0) {
    const rate = parseFloat(String(load.shipperPricePerTon));
    if (!Number.isNaN(rate) && rate > 0) return Math.round(rate * weightInTons);
  }
  return 0;
}

function hasShipperProvidedPricing(load: LoadData | null, weightInTons: number): boolean {
  return getShipperGrossPrice(load, weightInTons) > 0;
}

export function MyFleetPricingDrawer({
  open,
  onOpenChange,
  load,
  onSuccess,
  carriers = [],
}: MyFleetPricingDrawerProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  // Pricing state (from pricing-drawer)
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  const [grossPrice, setGrossPrice] = useState(0); // Total price before margin deduction (what shipper pays)
  const [markupPercent, setMarkupPercent] = useState(0);
  const [fixedFee, setFixedFee] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [platformMarginPercent, setPlatformMarginPercent] = useState(10);
  const [advancePaymentPercent, setAdvancePaymentPercent] = useState(0);
  const [pricingNotes, setPricingNotes] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  
  // Per-ton pricing state
  const [usePerTonRate, setUsePerTonRate] = useState(false);
  const [ratePerTon, setRatePerTon] = useState(0);
  const savedRatePerTon = useRef(0);
  const [customTonnage, setCustomTonnage] = useState<number | null>(null);

  // Posting options
  const [postMode, setPostMode] = useState<"open" | "invite" | "assign">("assign");
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [assignedCarrier, setAssignedCarrier] = useState("");
  const [assignedTruck, setAssignedTruck] = useState("");
  const [drawerCarrierSearch, setDrawerCarrierSearch] = useState("");
  const [allowCounterBids, setAllowCounterBids] = useState(true);

  interface FleetTruckOption {
    id: string;
    licensePlate: string;
    truckType: string;
    make?: string;
    model?: string;
    isAvailable?: boolean;
    carrierId?: string | null;
  }

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

  const { data: fleetTrucks = [] } = useQuery<FleetTruckOption[]>({
    queryKey: ["/api/admin/trucks"],
    enabled: open && !isCarrierFinalized,
  });

  // Only drivers/trucks not on an active trip
  const assignableDrivers = useMemo(() => {
    const source = carriers && carriers.length > 0 ? carriers : [];
    return source.filter((d) => d.isAvailable !== false);
  }, [carriers]);

  const assignableTrucks = useMemo(() => {
    const available = fleetTrucks.filter((t) => t.isAvailable !== false);
    const selectedDriver = assignableDrivers.find((d) => d.id === assignedCarrier);
    if (selectedDriver?.carrierId) {
      const matching = available.filter(
        (t) => !t.carrierId || t.carrierId === selectedDriver.carrierId,
      );
      if (matching.length > 0) return matching;
    }
    const fleetCarrierIds = new Set(
      assignableDrivers.map((d) => d.carrierId).filter((id): id is string => Boolean(id)),
    );
    if (fleetCarrierIds.size > 0) {
      const fleetOnly = available.filter((t) => t.carrierId && fleetCarrierIds.has(t.carrierId));
      if (fleetOnly.length > 0) return fleetOnly;
    }
    return available;
  }, [fleetTrucks, assignableDrivers, assignedCarrier]);
  
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
      setAssignedCarrier("");
      setAssignedTruck("");
    }
  }, [open]);

  const handleDriverChange = (driverId: string) => {
    setAssignedCarrier(driverId);
    const driver = assignableDrivers.find((d) => d.id === driverId);
    setAssignedTruck(driver?.assignedTruckId || "");
  };

  // Reset per-ton state when load changes
  useEffect(() => {
    setUsePerTonRate(false);
    setRatePerTon(0);
    setCustomTonnage(null);
    setUserHasSetPrice(false);
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
      } else {
        const shipperGross = getShipperGrossPrice(load, loadWeightInTons);
        if (shipperGross > 0) {
          setUsePerTonRate(false);
          setGrossPrice(shipperGross);
          if (loadWeightInTons > 0) savedRatePerTon.current = Math.round(shipperGross / loadWeightInTons);
        }
      }
    }
  }, [open, load?.id, load?.rateType, load?.shipperPricePerTon, load?.shipperFixedPrice, load?.adminFinalPrice, load?.advancePaymentPercent, isCarrierFinalized, loadWeightInTons]);

  // Fetch suggested price when load changes (only for non-finalized loads)
  useEffect(() => {
    if (open && load?.id && !isCarrierFinalized) {
      fetchSuggestedPrice();
    }
  }, [open, load?.id, isCarrierFinalized]);

  // Update gross price when adjustments change (only when not using per-ton rate and no shipper price)
  // BUT: Don't auto-adjust if user has manually set a price
  const [userHasSetPrice, setUserHasSetPrice] = useState(false);

  useEffect(() => {
    // Don't auto-adjust if shipper provided their own pricing
    const hasShipperPrice = hasShipperProvidedPricing(load, loadWeightInTons);
    
    if (!usePerTonRate && suggestedPrice > 0 && !hasShipperPrice && !userHasSetPrice) {
      const adjusted = suggestedPrice * (1 + markupPercent / 100) + fixedFee - discountAmount;
      setGrossPrice(Math.round(Math.max(0, adjusted)));
    }
  }, [suggestedPrice, markupPercent, fixedFee, discountAmount, usePerTonRate, load, loadWeightInTons, userHasSetPrice]);

  // Update gross price when per-ton rate changes
  useEffect(() => {
    if (usePerTonRate && ratePerTon > 0) {
      setGrossPrice(calculatedFromPerTon);
    }
  }, [usePerTonRate, ratePerTon, calculatedFromPerTon, weightInTons]);

  // When switching modes, update the rate to match current gross price
  useEffect(() => {
    if (!usePerTonRate && ratePerTon > 0 && weightInTons > 0 && grossPrice > 0) {
      // When switching to fixed price, update the rate to match the current gross price
      // This ensures that if user edited the price in per-tonne mode, it's preserved
      const currentRate = Math.round(grossPrice / weightInTons);
      if (ratePerTon !== currentRate) {
        setRatePerTon(currentRate);
      }
    }
  }, [usePerTonRate]);

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
    const hasShipperPrice = hasShipperProvidedPricing(load, loadWeightInTons);
    
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
        if (typeof data.platform_rate_percent === "number") {
          setPlatformMarginPercent(data.platform_rate_percent);
          setMarginInputStr(String(data.platform_rate_percent));
        }
      }
      setBreakdown(data.breakdown);
      setParams(data.params);
      setConfidenceScore(data.confidence_score);
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
        description: "Please select a driver to assign this load to.",
        variant: "destructive",
      });
      return;
    }

    if (postMode === "assign" && !assignedTruck) {
      toast({
        title: "Validation Error",
        description: "Please select a truck to assign this load to.",
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
          suggested_price: suggestedPrice || grossPrice,
          gross_price: grossPrice,
          final_price: grossPrice,
          carrier_payout: finalPrice,
          markup_percent: markupPercent,
          fixed_fee: fixedFee,
          discount_amount: discountAmount,
          platform_margin_percent: platformMarginPercent,
          advance_payment_percent: advancePaymentPercent,
          notes: pricingNotes || notes || null,
          template_id: selectedTemplate || null,
          price_breakdown: buildFleetPriceBreakdown(),
        });
        await saveResponse.json();

        const selectedDriver = assignableDrivers.find((c) => c.id === assignedCarrier);

        await apiRequest("POST", "/api/admin/assign", {
          load_id: load.id,
          carrier_id: selectedDriver?.carrierId,
          driver_id: assignedCarrier,
          truck_id: assignedTruck,
          final_price: finalPrice.toString(),
          gross_price: grossPrice.toString(),
          price_breakdown: buildFleetPriceBreakdown(),
        });

        const selectedDriverName = assignableDrivers.find(c => c.id === assignedCarrier)?.name || "driver";
        const selectedTruckLabel = assignableTrucks.find(t => t.id === assignedTruck);
        const truckLabel = selectedTruckLabel
          ? `${selectedTruckLabel.licensePlate} (${selectedTruckLabel.truckType})`
          : "selected truck";
        toast({
          title: "Load Assigned Successfully",
          description: `Load assigned to ${selectedDriverName} with truck ${truckLabel}. Payout: ${formatRupees(finalPrice)}.`,
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
          notes: pricingNotes,
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
          notes: pricingNotes,
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
      queryClient.invalidateQueries({ queryKey: ["/api/driver/my-orders"] });
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
    if (!drawerCarrierSearch.trim()) return assignableDrivers;
    const q = drawerCarrierSearch.toLowerCase();
    return assignableDrivers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        c.carrierType.toLowerCase().includes(q)
    );
  }, [assignableDrivers, drawerCarrierSearch]);

  // Clear selection if driver/truck became unavailable
  useEffect(() => {
    if (!open) return;
    if (assignedCarrier && !assignableDrivers.some((d) => d.id === assignedCarrier)) {
      setAssignedCarrier("");
      setAssignedTruck("");
    } else if (assignedTruck && !assignableTrucks.some((t) => t.id === assignedTruck)) {
      setAssignedTruck("");
    }
  }, [open, assignableDrivers, assignableTrucks, assignedCarrier, assignedTruck]);

  // My Fleet cost inputs
  const [distance, setDistance] = useState<number>(0);
  const [monthlySalary, setMonthlySalary] = useState<number>(0);
  const [tripsPerMonth, setTripsPerMonth] = useState<number>(0);
  const [fuel, setFuel] = useState<number>(0);
  const [tolls, setTolls] = useState<number>(0);
  const [maintenance, setMaintenance] = useState<number>(0);
  const [miscellaneous, setMiscellaneous] = useState<number>(0);
  const [monthlyDepreciation, setMonthlyDepreciation] = useState<number>(0);
  const [monthlyOverhead, setMonthlyOverhead] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const proratedSalaryPerTrip = tripsPerMonth > 0 ? monthlySalary / tripsPerMonth : 0;
  const proratedPerTrip = tripsPerMonth > 0
    ? (monthlyDepreciation + monthlyOverhead) / tripsPerMonth
    : 0;
  const totalTripCost =
    proratedSalaryPerTrip + fuel + tolls + maintenance + miscellaneous + proratedPerTrip;
  const costPerKm = distance > 0 ? totalTripCost / distance : 0;
  const netProfitLoss = grossPrice - totalTripCost;
  const profitMarginPercent = grossPrice > 0 ? (netProfitLoss / grossPrice) * 100 : 0;

  const buildFleetPriceBreakdown = useCallback(() => ({
    type: "my_fleet" as const,
    distance,
    monthlySalary,
    tripsPerMonth,
    proratedSalaryPerTrip,
    fuel,
    tolls,
    maintenance,
    miscellaneous,
    monthlyDepreciation,
    monthlyOverhead,
    proratedPerTrip,
    totalTripCost,
    costPerKm,
    shipperPrice: grossPrice,
    profitMarginPercent,
    netProfitLoss,
    notes,
  }), [
    distance, monthlySalary, tripsPerMonth, proratedSalaryPerTrip, fuel, tolls,
    maintenance, miscellaneous, monthlyDepreciation, monthlyOverhead, proratedPerTrip,
    totalTripCost, costPerKm, grossPrice, profitMarginPercent, netProfitLoss, notes,
  ]);

  useEffect(() => {
    if (!open) {
      setDistance(0);
      setMonthlySalary(0);
      setTripsPerMonth(0);
      setFuel(0);
      setTolls(0);
      setMaintenance(0);
      setMiscellaneous(0);
      setMonthlyDepreciation(0);
      setMonthlyOverhead(0);
      setNotes("");
      return;
    }
    if (!load) return;
    const parsed = parseFloat(String(load.distance ?? ""));
    if (Number.isFinite(parsed) && parsed > 0) {
      setDistance(parsed);
      return;
    }
    const estimated = computeRouteDistanceKmEstimate({
      pickupCity: load.pickupCity,
      dropoffCity: load.dropoffCity,
      pickupLat: load.pickupLat,
      pickupLng: load.pickupLng,
      dropoffLat: load.dropoffLat,
      dropoffLng: load.dropoffLng,
    });
    setDistance(Number.isFinite(estimated) && estimated > 0 ? Math.round(estimated) : 0);
  }, [open, load?.id, load?.distance, load?.pickupCity, load?.dropoffCity]);

  if (!load) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[550px] h-[100dvh] max-h-[100dvh] p-0 flex flex-col overflow-hidden">
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
              : "Set pricing and assign to driver"
            }
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* PRICING DRAWER UI - TOP SECTION */}
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
                  <h3 className="font-semibold text-sm sm:text-base">My Fleet Pricing</h3>
                  {isLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

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
                              setUsePerTonRate(false);
                              // When switching to fixed price, keep current gross price
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
                              // When switching to per-ton, calculate rate from current gross price
                              if (grossPrice > 0 && weightInTons > 0) {
                                const calculatedRate = Math.round(grossPrice / weightInTons);
                                setRatePerTon(calculatedRate);
                              }
                            }}
                            data-testid="button-rate-type-per-ton"
                          >
                            <Scale className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            Per Tonne Rate
                          </Button>
                        </div>
                        
                        {/* Per Tonne Rate Calculator */}
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
                                    // Sync: Update gross price based on rate × new tonnage
                                    if (ratePerTon > 0 && newWeight > 0) {
                                      const newPrice = Math.round(ratePerTon * newWeight);
                                      setGrossPrice(newPrice);
                                    }
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
                                    setUserHasSetPrice(true);
                                    // Sync: Update gross price based on new rate × tonnage
                                    if (rate > 0 && weightInTons > 0) {
                                      const newPrice = Math.round(rate * weightInTons);
                                      setGrossPrice(newPrice);
                                    }
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
                        
                        {/* Fixed Price Input */}
                        {!usePerTonRate && (
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs sm:text-sm">Enter Fixed Price (Rs.)</Label>
                            <div className="flex items-center gap-2">
                              <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              <Input
                                type="number"
                                value={grossPrice || ""}
                                onChange={(e) => {
                                  const price = parseInt(e.target.value) || 0;
                                  setGrossPrice(price);
                                  setUserHasSetPrice(true);
                                  // Sync: Calculate and update per-ton rate for reference
                                  if (price > 0 && weightInTons > 0) {
                                    const calculatedRate = Math.round(price / weightInTons);
                                    setRatePerTon(calculatedRate);
                                  }
                                }}
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

                    {/* Total Price Summary */}
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
                              onChange={(e) => {
                                setGrossPrice(parseInt(e.target.value) || 0);
                                setUserHasSetPrice(true);
                              }}
                              className="w-28 sm:w-32 text-right font-bold text-base sm:text-lg h-9 sm:h-10"
                              data-testid="input-gross-price"
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
              </div>
            )}

            {!isCarrierFinalized && (
            <div className="space-y-4">
              <Separator />

              {/* Distance Input */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Trip Distance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="distance">Distance (KM)</Label>
                    <Input
                      id="distance"
                      type="number"
                      placeholder="Enter distance in kilometers"
                      value={distance || ""}
                      onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
                      className="text-base font-medium"
                    />
                    {distance > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Total distance for this trip: <span className="font-semibold">{distance} KM</span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Driver Cost */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Driver Cost (Prorated Per Trip)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="monthlySalary">Monthly Salary</Label>
                      <Input
                        id="monthlySalary"
                        type="number"
                        placeholder="0"
                        value={monthlySalary || ""}
                        onChange={(e) => setMonthlySalary(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="tripsPerMonth">Trips Per Month</Label>
                      <Input
                        id="tripsPerMonth"
                        type="number"
                        placeholder="0"
                        value={tripsPerMonth || ""}
                        onChange={(e) => setTripsPerMonth(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Prorated Salary Per Trip:</span>
                      <span className="font-medium">Rs. {proratedSalaryPerTrip.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trip Allowances */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Trip Allowances</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="fuel">Fuel</Label>
                      <Input
                        id="fuel"
                        type="number"
                        placeholder="0"
                        value={fuel || ""}
                        onChange={(e) => setFuel(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="tolls">Tolls</Label>
                      <Input
                        id="tolls"
                        type="number"
                        placeholder="0"
                        value={tolls || ""}
                        onChange={(e) => setTolls(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maintenance">Maintenance</Label>
                      <Input
                        id="maintenance"
                        type="number"
                        placeholder="0"
                        value={maintenance || ""}
                        onChange={(e) => setMaintenance(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="miscellaneous">Miscellaneous</Label>
                      <Input
                        id="miscellaneous"
                        type="number"
                        placeholder="0"
                        value={miscellaneous || ""}
                        onChange={(e) => setMiscellaneous(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Overhead and Depreciation */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Overhead and Depreciation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="monthlyDepreciation">Monthly Depreciation</Label>
                      <Input
                        id="monthlyDepreciation"
                        type="number"
                        placeholder="0"
                        value={monthlyDepreciation || ""}
                        onChange={(e) => setMonthlyDepreciation(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthlyOverhead">Monthly Overhead</Label>
                      <Input
                        id="monthlyOverhead"
                        type="number"
                        placeholder="0"
                        value={monthlyOverhead || ""}
                        onChange={(e) => setMonthlyOverhead(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Prorated Per Trip:</span>
                      <span className="font-medium">Rs. {proratedPerTrip.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4" /> Cost Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">Prorated Salary:</span>
                      <span className="font-medium">Rs. {proratedSalaryPerTrip.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">Fuel:</span>
                      <span className="font-medium">Rs. {fuel.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">Tolls:</span>
                      <span className="font-medium">Rs. {tolls.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">Maintenance:</span>
                      <span className="font-medium">Rs. {maintenance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">Miscellaneous:</span>
                      <span className="font-medium">Rs. {miscellaneous.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">Overhead & Depreciation:</span>
                      <span className="font-medium">Rs. {proratedPerTrip.toFixed(2)}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-between p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <span className="font-semibold">Total Trip Cost:</span>
                    <span className="font-bold text-blue-700 dark:text-blue-400">
                      Rs. {totalTripCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <span className="font-semibold">Cost Per KM:</span>
                    <span className="font-bold text-green-700 dark:text-green-400">
                      Rs. {costPerKm.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Pricing */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Pricing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="shipperPrice">Shipper Price</Label>
                    <Input
                      id="shipperPrice"
                      type="number"
                      placeholder="0"
                      value={grossPrice || ""}
                      onChange={(e) => {
                        setGrossPrice(parseFloat(e.target.value) || 0);
                        setUserHasSetPrice(true);
                      }}
                    />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">Total Own Fleet Cost:</span>
                      <span className="font-medium">Rs. {totalTripCost.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between p-2 rounded-lg ${netProfitLoss >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                      <span className="text-muted-foreground">Net Profit/Loss:</span>
                      <span className={`font-bold ${netProfitLoss >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                        Rs. {netProfitLoss.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <span className="text-muted-foreground">Profit Margin %:</span>
                      <span className="font-bold text-blue-700 dark:text-blue-400">
                        {profitMarginPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Posting Options — My Fleet direct assign */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assign Driver & Truck
                </h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Driver</Label>
                    <Select value={assignedCarrier || undefined} onValueChange={handleDriverChange}>
                      <SelectTrigger data-testid="select-drawer-assign-driver">
                        <SelectValue placeholder="Select driver to assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableDrivers.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            No available drivers (all on active trips)
                          </SelectItem>
                        ) : (
                        assignableDrivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{driver.name}</span>
                              <Badge variant={driver.carrierType === "solo" ? "secondary" : "outline"} className="text-[9px] px-1 py-0">
                                {driver.carrierType === "solo" ? "Solo" : "Fleet"}
                              </Badge>
                              <span className="text-muted-foreground text-xs">({driver.completedLoads} loads)</span>
                              {driver.rating > 0 && (
                                <span className="text-muted-foreground text-xs">⭐ {driver.rating}</span>
                              )}
                            </span>
                          </SelectItem>
                        ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Truck</Label>
                    <Select value={assignedTruck || undefined} onValueChange={setAssignedTruck}>
                      <SelectTrigger data-testid="select-drawer-assign-truck">
                        <Truck className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Select truck to assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableTrucks.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            {fleetTrucks.length === 0
                              ? "No trucks in fleet"
                              : "No available trucks (all on active trips)"}
                          </SelectItem>
                        ) : (
                          assignableTrucks.map((truck) => (
                            <SelectItem key={truck.id} value={truck.id}>
                              <span className="flex items-center gap-2">
                                <span className="font-medium">{truck.licensePlate}</span>
                                <span className="text-muted-foreground text-xs">{truck.truckType}</span>
                                {truck.make && (
                                  <span className="text-muted-foreground text-xs">
                                    {truck.make}{truck.model ? ` ${truck.model}` : ""}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {assignedCarrier && assignedTruck && (
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-900/30">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        ✓ Load will be directly assigned to{" "}
                        <span className="font-semibold">{assignableDrivers.find(c => c.id === assignedCarrier)?.name}</span>
                        {" "}with truck{" "}
                        <span className="font-semibold">
                          {assignableTrucks.find(t => t.id === assignedTruck)?.licensePlate || "selected"}
                        </span>
                        . It will appear in their My Orders page.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {!isCarrierFinalized && (
          <div className="flex-shrink-0 border-t bg-background px-4 sm:px-6 py-3 flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLockAndPost}
              disabled={isLocking || !assignedCarrier || !assignedTruck || grossPrice <= 0}
              className="flex-1"
              data-testid="button-save-assign-fleet"
            >
              {isLocking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Save & Assign"
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
