import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";
import {
  Clock,
  MapPin,
  Package,
  Truck,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Building2,
  Send,
  Calculator,
  Users,
  Receipt,
  Gavel,
  Eye,
  RefreshCw,
  Scale,
  IndianRupee,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { PricingDrawer } from "@/components/admin/pricing-drawer";
import { MyFleetPricingDrawer } from "@/components/admin/my-fleet-pricing-drawer";
import { useAuth } from "@/lib/auth-context";
import { connectMarketplace, onMarketplaceEvent, disconnectMarketplace } from "@/lib/marketplace-socket";
import { queryClient } from "@/lib/queryClient";

// Comprehensive commodity categories for Indian freight logistics
const commodityCategories = [
  {
    category: "Agricultural & Food Products",
    items: [
      { value: "rice", label: "Rice / Paddy" },
      { value: "wheat", label: "Wheat" },
      { value: "pulses", label: "Pulses / Daal" },
      { value: "sugar", label: "Sugar" },
      { value: "jaggery", label: "Jaggery (Gud)" },
      { value: "tea", label: "Tea" },
      { value: "coffee", label: "Coffee" },
      { value: "spices", label: "Spices" },
      { value: "edible_oil", label: "Edible Oil" },
      { value: "fruits", label: "Fresh Fruits" },
      { value: "vegetables", label: "Fresh Vegetables" },
      { value: "onions_potatoes", label: "Onions / Potatoes" },
      { value: "cotton", label: "Cotton" },
      { value: "tobacco", label: "Tobacco" },
      { value: "jute", label: "Jute" },
      { value: "animal_feed", label: "Animal Feed / Fodder" },
      { value: "seeds", label: "Seeds" },
      { value: "fertilizer", label: "Fertilizer" },
      { value: "pesticides", label: "Pesticides / Insecticides" },
    ],
  },
  {
    category: "Construction Materials",
    items: [
      { value: "cement", label: "Cement Bags" },
      { value: "cement_bulk", label: "Cement (Bulk)" },
      { value: "sand", label: "Sand" },
      { value: "gravel", label: "Gravel / Stone Chips" },
      { value: "bricks", label: "Bricks" },
      { value: "tiles", label: "Tiles / Ceramics" },
      { value: "marble", label: "Marble / Granite" },
      { value: "steel_rods", label: "Steel Rods / TMT Bars" },
      { value: "steel_coils", label: "Steel Coils" },
      { value: "steel_plates", label: "Steel Plates / Sheets" },
      { value: "pipes", label: "Pipes (Steel/PVC)" },
      { value: "plywood", label: "Plywood / Timber" },
      { value: "glass", label: "Glass" },
      { value: "paint", label: "Paint / Coatings" },
      { value: "concrete_blocks", label: "Concrete Blocks" },
      { value: "gypsum", label: "Gypsum" },
    ],
  },
  {
    category: "Metals & Minerals",
    items: [
      { value: "iron_ore", label: "Iron Ore" },
      { value: "coal", label: "Coal" },
      { value: "limestone", label: "Limestone" },
      { value: "bauxite", label: "Bauxite" },
      { value: "copper", label: "Copper" },
      { value: "aluminium", label: "Aluminium" },
      { value: "zinc", label: "Zinc" },
      { value: "scrap_metal", label: "Scrap Metal" },
      { value: "manganese", label: "Manganese" },
      { value: "silica_sand", label: "Silica Sand" },
    ],
  },
  {
    category: "Chemicals & Petroleum",
    items: [
      { value: "chemicals_general", label: "Chemicals (General)" },
      { value: "chemicals_industrial", label: "Chemicals (Industrial)" },
      { value: "petroleum_products", label: "Petroleum Products" },
      { value: "lubricants", label: "Lubricants / Oils" },
      { value: "plastics_raw", label: "Plastics (Raw Material)" },
      { value: "rubber", label: "Rubber" },
    ],
  },
  {
    category: "Industrial & Manufacturing",
    items: [
      { value: "machinery", label: "Machinery / Equipment" },
      { value: "auto_parts", label: "Auto Parts / Components" },
      { value: "automobiles", label: "Automobiles / Vehicles" },
      { value: "textiles", label: "Textiles / Fabrics" },
      { value: "garments", label: "Garments / Apparel" },
      { value: "yarn", label: "Yarn / Thread" },
      { value: "leather", label: "Leather / Leather Goods" },
      { value: "paper", label: "Paper / Cardboard" },
      { value: "packaging", label: "Packaging Materials" },
      { value: "electrical", label: "Electrical Equipment" },
      { value: "electronics", label: "Electronics" },
    ],
  },
  {
    category: "Consumer Goods",
    items: [
      { value: "fmcg", label: "FMCG Products" },
      { value: "beverages", label: "Beverages" },
      { value: "dairy", label: "Dairy Products" },
      { value: "frozen_foods", label: "Frozen Foods" },
      { value: "packaged_foods", label: "Packaged Foods" },
      { value: "medicines", label: "Medicines / Pharmaceuticals" },
      { value: "cosmetics", label: "Cosmetics / Personal Care" },
      { value: "furniture", label: "Furniture" },
      { value: "appliances", label: "Home Appliances" },
      { value: "household", label: "Household Goods" },
    ],
  },
  {
    category: "Containers & Special Cargo",
    items: [
      { value: "container_20ft", label: "Container (20ft)" },
      { value: "container_40ft", label: "Container (40ft)" },
      { value: "odc_cargo", label: "ODC (Over Dimensional Cargo)" },
      { value: "project_cargo", label: "Project Cargo" },
      { value: "perishables", label: "Perishables (Temperature Controlled)" },
      { value: "empty_containers", label: "Empty Containers" },
    ],
  },
  {
    category: "Others",
    items: [
      { value: "e_commerce", label: "E-commerce Parcels" },
      { value: "courier", label: "Courier / Packages" },
      { value: "exhibition", label: "Exhibition Materials" },
      { value: "shifting", label: "Household Shifting" },
      { value: "other", label: "Other / Custom" },
    ],
  },
];

// Flatten all commodities for searching
const allCommodities = commodityCategories.flatMap(cat =>
  cat.items.map(item => ({ ...item, category: cat.category }))
);

// Helper function to format commodity value to display label
function formatCommodityLabel(value: string): string {
  if (!value) return "";

  const commodity = allCommodities.find(c => c.value === value);
  if (commodity) {
    return commodity.label;
  }

  // For custom entries (Other option) and unknown values, format to Title Case
  // Handle both underscore_case and regular text
  if (value.includes('_')) {
    return value
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } else {
    // For regular custom text, convert to title case
    return value
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
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
}

function getShipperPriceForLoad(load: RealLoad): number {
  if (load.adminFinalPrice) {
    const n = parseFloat(String(load.adminFinalPrice));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  if (load.shipperFixedPrice) {
    const n = parseFloat(String(load.shipperFixedPrice));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  if (load.shipperPricePerTon && load.weight) {
    const rate = parseFloat(String(load.shipperPricePerTon));
    const wt = typeof load.weight === "string" ? parseFloat(load.weight) : Number(load.weight);
    if (!Number.isNaN(rate) && !Number.isNaN(wt) && wt > 0) return Math.round(rate * wt);
  }
  return 0;
}

function resolveLoadDistance(load: RealLoad): number {
  if (load.distance && Number(load.distance) > 0) return Number(load.distance);
  const km = computeRouteDistanceKmEstimate({
    pickupCity: load.pickupCity,
    dropoffCity: load.dropoffCity,
    pickupLat: load.pickupLat,
    pickupLng: load.pickupLng,
    dropoffLat: load.dropoffLat,
    dropoffLng: load.dropoffLng,
  });
  return Number.isFinite(km) ? Math.round(km) : 0;
}

function resolveMyFleetPricing(load: RealLoad): RealLoad["myFleetPricing"] {
  if (load.myFleetPricing) return load.myFleetPricing;
  const pb = load.priceBreakdown;
  if (pb && (pb.type === "my_fleet" || pb.totalTripCost != null)) {
    return {
      totalTripCost: Number(pb.totalTripCost) || 0,
      costPerKm: Number(pb.costPerKm) || 0,
      profitMarginPercent: Number(pb.profitMarginPercent) || 0,
      netProfitLoss: Number(pb.netProfitLoss) || 0,
    };
  }
  return undefined;
}

interface RealLoad {
  id: string;
  pickupCity: string;
  dropoffCity: string;
  pickupAddress?: string;
  pickupLocality?: string;
  pickupLandmark?: string;
  pickupBusinessName?: string;
  dropoffAddress?: string;
  dropoffLocality?: string;
  dropoffLandmark?: string;
  dropoffBusinessName?: string;
  weight: number;
  weightUnit?: string;
  cargoDescription?: string;
  goodsToBeCarried?: string;
  materialType?: string;
  specialNotes?: string;
  shipperPricePerTon?: string | number;
  shipperFixedPrice?: string | number;
  rateType?: string;
  advancePaymentPercent?: number;
  requiredTruckType?: string;
  pickupDate?: string;
  deliveryDate?: string;
  status: string;
  shipperId: string;
  shipperName?: string;
  shipperEmail?: string;
  shipperCompanyName?: string;
  shipperContactName?: string;
  shipperCompanyAddress?: string;
  shipperPhone?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverEmail?: string;
  distance?: number;
  pickupLat?: string | null;
  pickupLng?: string | null;
  dropoffLat?: string | null;
  dropoffLng?: string | null;
  priority?: string;
  adminPrice?: number;
  adminFinalPrice?: string;
  finalPrice?: string;
  priceLockedAt?: string;
  submittedAt?: string;
  shipperLoadNumber?: number | null;
  adminReferenceNumber?: number | null;
  invoiceId?: string;
  assignedCarrierId?: string;
  awardedBidId?: string;
  pickupId?: string;
  allowCounterBids?: boolean;
  pricingType?: "marketplace" | "my_fleet";
  priceBreakdown?: {
    type?: string;
    totalTripCost?: number;
    costPerKm?: number;
    profitMarginPercent?: number;
    netProfitLoss?: number;
  } | null;
  myFleetPricing?: {
    totalTripCost: number;
    costPerKm: number;
    profitMarginPercent: number;
    netProfitLoss: number;
  };
}

// Format load ID for display - Admin sees LD-1001, LD-1002, etc.
function formatLoadId(load: { shipperLoadNumber?: number | null; adminReferenceNumber?: number | null; id: string }): string {
  // If admin has assigned a reference number, show that (e.g., LD-1001, LD-10023)
  if (load.adminReferenceNumber) {
    return `LD-${load.adminReferenceNumber}`;
  }
  // Otherwise show shipper's sequential number (e.g., LD-001)
  if (load.shipperLoadNumber) {
    return `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`;
  }
  // Fallback to first 8 chars of UUID
  return load.id.slice(0, 8).toUpperCase();
}

function getCanonicalStateDisplay(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string } {
  const stateMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    "draft": { label: "Draft", variant: "outline" },
    "pending": { label: "Pending Review", variant: "default", className: "bg-amber-500 text-white" },
    "priced": { label: "Priced - Ready to Post", variant: "secondary", className: "bg-blue-500 text-white" },
    "posted_to_carriers": { label: "Posted to Carriers", variant: "secondary", className: "bg-cyan-500 text-white" },
    "open_for_bid": { label: "Awaiting Bids", variant: "secondary", className: "bg-purple-500 text-white" },
    "counter_received": { label: "Negotiation", variant: "secondary", className: "bg-orange-500 text-white" },
    "awarded": { label: "Carrier Finalized", variant: "secondary", className: "bg-emerald-500 text-white" },
    "invoice_sent": { label: "Invoice Sent", variant: "secondary", className: "bg-indigo-500 text-white" },
    "invoice_approved": { label: "Invoice Approved", variant: "secondary", className: "bg-green-500 text-white" },
    "in_transit": { label: "In Transit", variant: "secondary", className: "bg-blue-600 text-white" },
    "delivered": { label: "Delivered", variant: "secondary", className: "bg-teal-500 text-white" },
    "closed": { label: "Completed", variant: "secondary", className: "bg-gray-500 text-white" },
    "cancelled": { label: "Cancelled", variant: "destructive" },
  };
  return stateMap[status.toLowerCase()] || { label: status, variant: "outline" };
}

function getAdminActionForState(status: string): { action: string; buttonLabel: string; icon?: string } | null {
  const actionMap: Record<string, { action: string; buttonLabel: string; icon?: string }> = {
    "pending": { action: "price", buttonLabel: "Price Load", icon: "calculator" },
    "priced": { action: "post_to_carriers", buttonLabel: "Post to Carriers", icon: "truck" },
    "posted_to_carriers": { action: "view_bids", buttonLabel: "View Bids", icon: "gavel" },
    "open_for_bid": { action: "view_bids", buttonLabel: "View Bids", icon: "gavel" },
    "counter_received": { action: "review_counter", buttonLabel: "Review Counter", icon: "gavel" },
    "awarded": { action: "send_invoice", buttonLabel: "Send Invoice", icon: "send" },
    "invoice_sent": { action: "view_invoice", buttonLabel: "View Invoice", icon: "receipt" },
    "invoice_approved": { action: "start_transit", buttonLabel: "Start Transit", icon: "truck" },
    "in_transit": { action: "track_shipment", buttonLabel: "Track Shipment", icon: "mappin" },
    "delivered": { action: "close_load", buttonLabel: "Close Load", icon: "check" },
  };
  return actionMap[status.toLowerCase()] || null;
}


export default function LoadQueuePage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedRealLoad, setSelectedRealLoad] = useState<RealLoad | null>(null);
  const [pricingDrawerOpen, setPricingDrawerOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsLoad, setDetailsLoad] = useState<RealLoad | null>(null);
  const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false);
  const [loadToSendInvoice, setLoadToSendInvoice] = useState<RealLoad | null>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [repriceDialogOpen, setRepriceDialogOpen] = useState(false);
  const [repriceLoad, setRepriceLoad] = useState<RealLoad | null>(null);
  const [repriceAllowCounter, setRepriceAllowCounter] = useState(true);
  const [repriceReason, setRepriceReason] = useState("");
  const [isRepricing, setIsRepricing] = useState(false);
  const [repriceUsePerTonRate, setRepriceUsePerTonRate] = useState(false);
  const [repriceRatePerTon, setRepriceRatePerTon] = useState(0);
  const [repriceTonnage, setRepriceTonnage] = useState<number>(0);
  const [myFleetDrawerOpen, setMyFleetDrawerOpen] = useState(false);
  const [myFleetLoad, setMyFleetLoad] = useState<RealLoad | null>(null);

  const [repriceGrossPrice, setRepriceGrossPrice] = useState(0);
  const [repricePlatformMargin, setRepricePlatformMargin] = useState(10);
  const [repriceAdvancePercent, setRepriceAdvancePercent] = useState(0);
  const [repriceSelectedTemplate, setRepriceSelectedTemplate] = useState<string>("");
  const [customCostPerKm, setCustomCostPerKm] = useState<Record<string, number>>({});
  const [customCostComments, setCustomCostComments] = useState<Record<string, string>>({});

  // Input string states for margin/payout (allows typing without being overwritten)
  const [repriceMarginInputStr, setRepriceMarginInputStr] = useState<string>("10");
  const [repricePayoutInputStr, setRepricePayoutInputStr] = useState<string>("0");
  const [repriceEditingField, setRepriceEditingField] = useState<'margin' | 'payout' | null>(null);

  // Reprice calculated values
  const repricePlatformEarnings = Math.round(repriceGrossPrice * (repricePlatformMargin / 100));
  const repriceCarrierPayout = repriceGrossPrice - repricePlatformEarnings;
  const repriceAdvanceAmount = Math.round(repriceCarrierPayout * (repriceAdvancePercent / 100));
  const repriceBalanceAmount = repriceCarrierPayout - repriceAdvanceAmount;

  // Sync payout display when margin changes (not when editing payout)
  useEffect(() => {
    if (repriceEditingField !== 'payout') {
      setRepricePayoutInputStr(repriceCarrierPayout.toString());
    }
  }, [repriceCarrierPayout, repriceEditingField]);

  // Sync margin display when it changes (not when editing margin manually)
  useEffect(() => {
    if (repriceEditingField !== 'margin') {
      setRepriceMarginInputStr(repricePlatformMargin.toString());
    }
  }, [repricePlatformMargin, repriceEditingField]);

  // Handle margin input change - instant update, syncs payout
  const handleRepriceMarginChange = (inputStr: string) => {
    setRepriceEditingField('margin');
    setRepriceMarginInputStr(inputStr);
    const val = parseInt(inputStr) || 0;
    const clamped = Math.min(50, Math.max(0, val));
    setRepricePlatformMargin(clamped);
  };

  // Handle carrier payout input - reverse calculation to update margin
  const handleRepricePayoutChange = (payoutStr: string) => {
    setRepriceEditingField('payout');
    setRepricePayoutInputStr(payoutStr);

    const payout = parseInt(payoutStr.replace(/\D/g, '')) || 0;
    if (repriceGrossPrice > 0 && payout > 0) {
      const newMargin = ((repriceGrossPrice - payout) / repriceGrossPrice) * 100;
      const roundedMargin = Math.round(newMargin * 100) / 100;
      const clampedMargin = Math.min(50, Math.max(0, roundedMargin));
      setRepricePlatformMargin(clampedMargin);
      setRepriceMarginInputStr(clampedMargin.toString());
    }
  };

  // On blur, reset editing field
  const handleRepriceInputBlur = () => {
    setRepriceEditingField(null);
  };

  const { user } = useAuth();

  const openLoadDetails = (load: RealLoad) => {
    setDetailsLoad(load);
    setDetailsDialogOpen(true);
  };

  const { data: realLoads = [], isLoading: isLoadingReal } = useQuery<RealLoad[]>({
    queryKey: ["/api/admin/queue"],
    refetchInterval: 30000,
  });

  const { data: realCarriersRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/carriers"],
  });

  const { data: adminDriversRaw = [] } = useQuery<Array<{
    id: string;
    name: string;
    phone: string;
    carrierId: string;
    assignedTruckId?: string | null;
    status?: string | null;
    isAvailable?: boolean;
  }>>({
    queryKey: ["/api/admin/drivers"],
  });

  const myFleetLoads = useMemo(
    () => realLoads.filter((l) => l.status === "pending" || l.status === "priced"),
    [realLoads],
  );

  const myFleetDriverOptions = useMemo<CarrierOption[]>(() => {
    return adminDriversRaw
      .filter((d) => d.status !== "inactive" && d.isAvailable !== false)
      .map((d) => ({
        id: d.id,
        name: d.name,
        rating: 0,
        trucks: d.assignedTruckId ? 1 : 0,
        zone: "",
        completedLoads: 0,
        carrierType: "enterprise" as const,
        phone: d.phone,
        carrierId: d.carrierId,
        assignedTruckId: d.assignedTruckId,
        isAvailable: d.isAvailable,
      }));
  }, [adminDriversRaw]);

  const realCarriers: CarrierOption[] = useMemo(() => {
    return realCarriersRaw
      .filter((c: any) => c.isVerified)
      .map((c: any) => ({
        id: c.id,
        name: c.companyName || c.username || "Unknown",
        rating: 0,
        trucks: 0,
        zone: "",
        completedLoads: c.bidCount || 0,
        carrierType: (c.profile?.carrierType === "solo" ? "solo" : c.profile?.carrierType === "enterprise" ? "enterprise" : "enterprise") as "enterprise" | "solo",
        phone: c.phone || undefined,
      }))
      .sort((a, b) => b.completedLoads - a.completedLoads);
  }, [realCarriersRaw]);

  // Pricing templates for reprice dialog
  interface PricingTemplate {
    id: string;
    name: string;
    markupPercent: string;
    fixedFee: string;
    platformRatePercent: string;
  }

  const { data: pricingTemplates = [] } = useQuery<PricingTemplate[]>({
    queryKey: ["/api/admin/pricing/templates"],
    enabled: repriceDialogOpen,
  });

  // WebSocket listener for real-time load submissions from shippers
  useEffect(() => {
    if (user?.id && user?.role === "admin") {
      connectMarketplace("admin", user.id);

      const unsubLoadSubmitted = onMarketplaceEvent("load_submitted", (data) => {
        toast({
          title: "New Load Submitted",
          description: `${data.load?.shipperName || "A shipper"} submitted a load from ${data.load?.pickupCity || ""} to ${data.load?.dropoffCity || ""}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/queue"] });
      });

      const unsubLoadUpdated = onMarketplaceEvent("load_updated", (data) => {
        const eventType = data.event;
        let title = "Load Updated";
        let description = `Load ${data.load?.pickupCity || ""} to ${data.load?.dropoffCity || ""} was updated`;

        if (eventType === "load_edited") {
          title = "Load Edited";
          description = `Shipper edited load: ${data.load?.pickupCity || ""} to ${data.load?.dropoffCity || ""}`;
        } else if (eventType === "load_available") {
          title = "Load Made Available";
          description = `Load ${data.load?.pickupCity || ""} to ${data.load?.dropoffCity || ""} is now available`;
        } else if (eventType === "load_unavailable") {
          title = "Load Made Unavailable";
          description = `Load ${data.load?.pickupCity || ""} to ${data.load?.dropoffCity || ""} marked unavailable`;
        }

        toast({ title, description });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/queue"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      });

      return () => {
        unsubLoadSubmitted();
        unsubLoadUpdated();
        disconnectMarketplace();
      };
    }
  }, [user?.id, user?.role, toast]);

  // Handle highlight query param from notifications - auto-open drawer for that load
  const [highlightHandled, setHighlightHandled] = useState(false);
  useEffect(() => {
    if (highlightHandled) return;
    const params = new URLSearchParams(searchString || "");
    const highlightId = params.get("highlight");
    if (!highlightId) return;

    // Wait for real loads to finish loading before attempting to match
    if (isLoadingReal) return;

    // Search in real loads (full ID, prefix match, or uppercase short ID comparison)
    const matchingLoad = realLoads.find(l =>
      l.id === highlightId ||
      l.id.startsWith(highlightId) ||
      l.id.slice(0, 8).toUpperCase() === highlightId.slice(0, 8).toUpperCase()
    );

    if (matchingLoad) {
      setSelectedRealLoad(matchingLoad);
      setPricingDrawerOpen(true);
      setHighlightHandled(true);
      // Clear query param after drawer opens
      setTimeout(() => navigate("/admin/load-queue", { replace: true }), 200);
    } else {
      // No matching load found after data loaded - clear param and mark handled
      setHighlightHandled(true);
      navigate("/admin/load-queue", { replace: true });
    }
  }, [searchString, realLoads, isLoadingReal, highlightHandled, navigate]);

  const convertRealToDrawerFormat = (load: RealLoad) => ({
    id: load.id,
    loadId: formatLoadId(load),
    pickupCity: load.pickupCity,
    dropoffCity: load.dropoffCity,
    weight: load.weight,
    weightUnit: load.weightUnit || "MT",
    requiredTruckType: load.requiredTruckType || "Standard",
    distance: (() => {
      const est = computeRouteDistanceKmEstimate({
        pickupLat: load.pickupLat,
        pickupLng: load.pickupLng,
        dropoffLat: load.dropoffLat,
        dropoffLng: load.dropoffLng,
        pickupCity: load.pickupCity,
        dropoffCity: load.dropoffCity,
      });
      return Number.isFinite(est) ? Math.round(est) : 0;
    })(),
    pickupDate: load.pickupDate,
    cargoDescription: load.cargoDescription,
    shipperId: load.shipperId,
    shipperName: load.shipperName,
    status: load.status,
    adminPrice: load.adminPrice,
    finalPrice: load.finalPrice,
    adminFinalPrice: load.adminFinalPrice,
    // Shipper's pricing preferences
    shipperPricePerTon: load.shipperPricePerTon,
    shipperFixedPrice: load.shipperFixedPrice,
    rateType: load.rateType,
    advancePaymentPercent: load.advancePaymentPercent,
  });

  const openRealLoadPricingDrawer = (load: RealLoad) => {
    setSelectedRealLoad(load);
    setPricingDrawerOpen(true);
  };

  // Open confirmation dialog before sending invoice to shipper
  const handleSendInvoiceToShipper = (load: RealLoad) => {
    setLoadToSendInvoice(load);
    setInvoiceConfirmOpen(true);
  };

  // Actually send the invoice after confirmation
  const confirmSendInvoice = async () => {
    if (!loadToSendInvoice) return;

    try {
      setIsSendingInvoice(true);

      let res;

      if (!loadToSendInvoice.invoiceId) {
        const shipperGross = loadToSendInvoice.adminFinalPrice || loadToSendInvoice.finalPrice || "0";
        console.log(`[LoadQueue] No invoice exists, generating and sending for load ${loadToSendInvoice.id} with amount ${shipperGross}`);
        res = await apiRequest('POST', '/api/admin/invoice/generate-and-send', {
          load_id: loadToSendInvoice.id,
          amount: shipperGross,
        });
      } else {
        console.log(`[LoadQueue] Sending existing invoice ${loadToSendInvoice.invoiceId} for load ${loadToSendInvoice.id}`);
        res = await apiRequest('POST', `/api/admin/invoices/${loadToSendInvoice.invoiceId}/send`);
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error(`[LoadQueue] Invoice send failed with status ${res.status}:`, errorData);
        toast({
          title: t('common.error'),
          description: errorData.error || `Failed to send invoice (${res.status})`,
          variant: "destructive",
        });
        return;
      }

      const invoiceData = await res.json();

      const isSent = invoiceData?.status === 'sent' || invoiceData?.success || invoiceData?.invoice?.status === 'sent';
      if (isSent) {
        console.log(`[LoadQueue] Invoice sent successfully:`, invoiceData);
        toast({
          title: t('invoices.sent'),
          description: `Invoice sent to shipper for ${formatLoadId(loadToSendInvoice)}`,
        });

        queryClient.invalidateQueries({ queryKey: ['/api/admin/loads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/queue'] });
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      } else {
        console.error(`[LoadQueue] Invoice send returned unexpected response:`, invoiceData);
        toast({
          title: t('common.error'),
          description: "Invoice may not have been sent properly. Please verify.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("[LoadQueue] Failed to send invoice:", error);
      toast({
        title: t('common.error'),
        description: error.message || "Failed to send invoice",
        variant: "destructive",
      });
    } finally {
      setIsSendingInvoice(false);
      setInvoiceConfirmOpen(false);
      setLoadToSendInvoice(null);
    }
  };

  const openRepriceDialog = (load: RealLoad) => {
    setRepriceLoad(load);
    setRepriceAllowCounter(load.allowCounterBids ?? true);
    setRepriceReason("");
    setRepriceSelectedTemplate("");

    // Initialize margin from existing load data if available, otherwise default to 10%
    const existingMargin = (load as any).platformRatePercent ? parseFloat((load as any).platformRatePercent.toString()) : 10;
    const clampedMargin = Math.max(0, Math.min(50, existingMargin));
    setRepricePlatformMargin(clampedMargin); // Clamp 0-50%
    setRepriceMarginInputStr(clampedMargin.toString());
    setRepriceEditingField(null);

    // Initialize advance percent from load data
    const existingAdvance = load.advancePaymentPercent ? parseFloat(load.advancePaymentPercent.toString()) : 0;
    setRepriceAdvancePercent(Math.max(0, Math.min(100, existingAdvance))); // Clamp 0-100%

    // Calculate weight in tons
    const weight = parseFloat(load.weight?.toString() || "0");
    const weightInTons = load.weightUnit === 'KG' ? weight / 1000 : weight;
    setRepriceTonnage(weightInTons > 0 ? weightInTons : 1);

    // Initialize calculator based on load's rate type
    const currentPrice = parseFloat(load.adminFinalPrice || load.finalPrice || "0");
    setRepriceGrossPrice(Math.max(0, currentPrice)); // Ensure non-negative

    // Initialize payout based on calculated values
    const initialPayout = Math.round(currentPrice * (1 - clampedMargin / 100));
    setRepricePayoutInputStr(initialPayout.toString());

    if (load.rateType === "per_ton" && load.shipperPricePerTon) {
      // Per ton rate mode
      setRepriceUsePerTonRate(true);
      const perTonRate = parseFloat(load.shipperPricePerTon?.toString() || "0");
      setRepriceRatePerTon(perTonRate > 0 ? perTonRate : Math.round(currentPrice / (weightInTons || 1)));
    } else {
      // Fixed price mode
      setRepriceUsePerTonRate(false);
      setRepriceRatePerTon(0);
    }

    setRepriceDialogOpen(true);
  };

  // Apply template to reprice dialog
  const applyRepriceTemplate = (templateId: string) => {
    setRepriceSelectedTemplate(templateId);
    if (templateId && pricingTemplates.length > 0) {
      const template = pricingTemplates.find((t) => t.id === templateId);
      if (template) {
        setRepricePlatformMargin(parseFloat(template.platformRatePercent) || 10);
      }
    }
  };

  const handleRepriceAndRepost = async () => {
    if (!repriceLoad || repriceGrossPrice <= 0) return;

    setIsRepricing(true);

    try {
      // NOTE: carrierPayout is computed server-side based on platformMarginPercent
      // We don't send it from client to prevent tampering
      const response = await apiRequest('POST', `/api/admin/loads/${repriceLoad.id}/reprice-repost`, {
        finalPrice: repriceGrossPrice.toString(), // Shipper's gross price (adminFinalPrice)
        platformMarginPercent: repricePlatformMargin,
        advancePaymentPercent: repriceAdvancePercent,
        postMode: 'open',
        allowCounterBids: repriceAllowCounter,
        reason: repriceReason || 'Repriced and reposted by admin',
      });

      if (response) {
        toast({
          title: "Load Repriced & Reposted",
          description: `Load ${formatLoadId(repriceLoad)} has been repriced to Rs. ${repriceGrossPrice.toLocaleString('en-IN')} and reposted to carriers.`,
        });

        queryClient.invalidateQueries({ queryKey: ['/api/admin/queue'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/loads'] });
        setRepriceDialogOpen(false);
        setRepriceLoad(null);
      }
    } catch (error: any) {
      console.error("Failed to reprice and repost:", error);
      toast({
        title: t('common.error'),
        description: error.message || "Failed to reprice and repost load",
        variant: "destructive",
      });
    } finally {
      setIsRepricing(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">{t('admin.loadQueue')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t('admin.loadQueueDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm sm:text-lg px-2 sm:px-3 py-1">
            {realLoads.length} {t('common.pending')}
          </Badge>
        </div>
      </div>

      {/* Invoice Sending - Compact grid of carrier finalized loads with invoices ready to send */}
      {(() => {
        const invoiceLoads = realLoads
          .filter(l => l.status === 'awarded' || l.status === 'invoice_created')
          .sort((a, b) => {
            const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
            const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
            return dateB - dateA;
          });
        if (invoiceLoads.length === 0) return null;
        return (
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Send className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                {t('admin.invoiceSending')} ({invoiceLoads.length})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('admin.invoiceSendingDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {invoiceLoads.map((load) => {
                  // For invoices, use adminFinalPrice (shipper total) first, not finalPrice (carrier negotiated)
                  const price = load.adminFinalPrice || load.shipperFixedPrice || load.adminPrice;
                  const priceNum = price ? (typeof price === 'string' ? parseFloat(price) : price) : 0;

                  return (
                    <div
                      key={load.id}
                      className="border rounded-lg p-2 sm:p-3 bg-card hover-elevate"
                      data-testid={`card-invoice-load-${load.id.slice(0, 8)}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-mono text-xs sm:text-sm font-medium">{formatLoadId(load)}</span>
                        <Badge variant="secondary" className={`text-[10px] sm:text-xs ${load.status === 'invoice_created' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
                          {load.status === 'invoice_created' ? 'Invoice Ready' : 'Awarded'}
                        </Badge>
                      </div>

                      <div className="space-y-1 mb-2 sm:mb-3">
                        <div className="flex items-center gap-1 text-xs sm:text-sm">
                          <MapPin className="h-3 w-3 text-green-500 shrink-0" />
                          <span className="truncate">{load.pickupCity}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs sm:text-sm">
                          <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                          <span className="truncate">{load.dropoffCity}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs sm:text-sm mb-2 sm:mb-3">
                        <span className="text-muted-foreground truncate">{load.shipperName || t('loads.shipper')}</span>
                        <span className="font-medium ml-2">{load.weight} {load.weightUnit || "MT"}</span>
                      </div>

                      <div className="border-t pt-2 mb-2 sm:mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] sm:text-xs text-muted-foreground">Shipper Price</span>
                          <span className="font-bold text-sm sm:text-base text-green-600 dark:text-green-400">
                            Rs. {priceNum.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs sm:text-sm h-8"
                          onClick={() => openLoadDetails(load)}
                          data-testid={`button-view-invoice-details-${load.id.slice(0, 8)}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {t('common.view')}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs sm:text-sm h-8"
                          onClick={() => handleSendInvoiceToShipper(load)}
                          data-testid={`button-send-invoice-${load.id.slice(0, 8)}`}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          {t('invoices.send')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Pricing & Posting Table - Loads with pending status */}
      {(() => {
        const pricingLoads = realLoads.filter(l => l.status === 'pending' || l.status === 'priced');
        if (pricingLoads.length === 0) return null;
        return (
          <Card className="border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                {t('admin.pricingAndPosting')} ({pricingLoads.length})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('admin.pricingAndPostingDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="h-[300px] overflow-auto">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">{t('loads.loadId')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('loads.route')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('loads.shipper')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('loads.cargo')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('admin.totalPrice')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('common.status')}</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pricingLoads.map((load) => {
                        const price = load.finalPrice || load.adminFinalPrice || load.adminPrice;
                        const priceNum = price ? (typeof price === 'string' ? parseFloat(price) : price) : 0;

                        return (
                          <TableRow key={load.id} data-testid={`row-pricing-load-${load.id.slice(0, 8)}`}>
                            <TableCell className="font-mono font-medium text-xs sm:text-sm">{formatLoadId(load)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 text-xs sm:text-sm">
                                  <MapPin className="h-3 w-3 text-green-500" />
                                  <span className="truncate max-w-[100px] sm:max-w-[120px]">{load.pickupCity}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs sm:text-sm">
                                  <MapPin className="h-3 w-3 text-red-500" />
                                  <span className="truncate max-w-[100px] sm:max-w-[120px]">{load.dropoffCity}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs sm:text-sm">{load.shipperName || t('common.unknown')}</span>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs sm:text-sm">
                                <span className="font-medium">{load.weight} {load.weightUnit || "MT"}</span>
                                {load.cargoDescription && (
                                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[80px] sm:max-w-[100px]">
                                    {load.cargoDescription}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {priceNum > 0 ? (
                                <span className="font-medium text-xs sm:text-sm text-green-600 dark:text-green-400">
                                  Rs. {priceNum.toLocaleString('en-IN')}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs sm:text-sm">{t('admin.notPriced')}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const stateDisplay = getCanonicalStateDisplay(load.status);
                                return (
                                  <Badge variant={stateDisplay.variant} className={`${stateDisplay.className} text-[10px] sm:text-xs`}>
                                    {load.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                                    {load.status === "priced" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    {stateDisplay.label}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={() => openLoadDetails(load)}
                                  data-testid={`button-view-pricing-details-${load.id.slice(0, 8)}`}
                                  title="View full details"
                                >
                                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs h-7 sm:h-8"
                                  onClick={() => openRealLoadPricingDrawer(load)}
                                  data-testid={`button-price-load-${load.id.slice(0, 8)}`}
                                >
                                  <Calculator className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  {t('admin.priceLoad')}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Pricing and Posting for My Fleet — assign to admin's own drivers/trucks */}
      {myFleetLoads.length > 0 && (
          <Card className="border-blue-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                Pricing and Posting for My Fleet ({myFleetLoads.length})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Price loads and assign them directly to your fleet drivers and trucks
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="h-[300px] overflow-auto">
                <div className="min-w-[900px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">{t('loads.loadId')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('loads.route')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('loads.shipper')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('loads.cargo')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">Shipper Price</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myFleetLoads.map((load) => {
                        const shipperPrice = getShipperPriceForLoad(load);
                        const cargoLabel = load.goodsToBeCarried || load.materialType || load.cargoDescription;

                        return (
                        <TableRow key={load.id} data-testid={`row-myfleet-load-${load.id.slice(0, 8)}`}>
                          <TableCell className="font-mono font-medium text-xs sm:text-sm">{formatLoadId(load)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-xs sm:text-sm">
                                <MapPin className="h-3 w-3 text-green-500" />
                                <span className="truncate max-w-[100px] sm:max-w-[120px]">{load.pickupCity}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs sm:text-sm">
                                <MapPin className="h-3 w-3 text-red-500" />
                                <span className="truncate max-w-[100px] sm:max-w-[120px]">{load.dropoffCity}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs sm:text-sm">
                              {load.shipperName || load.shipperCompanyName || t('common.unknown')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs sm:text-sm">
                              <span className="font-medium">{load.weight} {load.weightUnit || "MT"}</span>
                              {(load.requiredTruckType || cargoLabel) && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[120px]">
                                  {load.requiredTruckType || cargoLabel}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {shipperPrice > 0 ? (
                              <span className="font-medium text-xs sm:text-sm text-green-600 dark:text-green-400">
                                Rs. {shipperPrice.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs sm:text-sm">{t('admin.notPriced')}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 sm:h-8 sm:w-8"
                                onClick={() => openLoadDetails({
                                  ...load,
                                  pricingType: "my_fleet",
                                  distance: resolveLoadDistance(load),
                                  myFleetPricing: resolveMyFleetPricing(load),
                                })}
                                data-testid={`button-myfleet-details-${load.id.slice(0, 8)}`}
                                title="View full details"
                              >
                                <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <Button
                                size="sm"
                                className="text-xs h-7 sm:h-8"
                                onClick={() => {
                                  setMyFleetLoad({
                                    ...load,
                                    pricingType: "my_fleet",
                                    distance: resolveLoadDistance(load),
                                  });
                                  setMyFleetDrawerOpen(true);
                                }}
                                data-testid={`button-myfleet-pricing-${load.id.slice(0, 8)}`}
                              >
                                <Calculator className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                Set Pricing
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
      )}

      {/* Active Marketplace - Loads posted to carriers that can be repriced and reposted */}
      {(() => {
        const activeMarketplaceLoads = realLoads.filter(l =>
          l.status === 'posted_to_carriers' || l.status === 'open_for_bid' || l.status === 'counter_received'
        );
        if (activeMarketplaceLoads.length === 0) return null;
        return (
          <Card className="border-purple-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Gavel className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                Active Marketplace ({activeMarketplaceLoads.length})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Loads currently posted to carriers - you can reprice and repost if needed
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="h-[300px] overflow-auto">
                <div className="min-w-[900px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">{t('loads.loadId')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('loads.route')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('loads.shipper')}</TableHead>
                        <TableHead className="text-xs sm:text-sm">Current Price</TableHead>
                        <TableHead className="text-xs sm:text-sm">Carrier Payout</TableHead>
                        <TableHead className="text-xs sm:text-sm">{t('common.status')}</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeMarketplaceLoads.map((load) => {
                        const price = load.adminFinalPrice || load.finalPrice;
                        const priceNum = price ? (typeof price === 'string' ? parseFloat(price) : price) : 0;
                        const stateDisplay = getCanonicalStateDisplay(load.status);

                        return (
                          <TableRow key={load.id} data-testid={`row-active-load-${load.id.slice(0, 8)}`}>
                            <TableCell className="font-mono font-medium text-xs sm:text-sm">{formatLoadId(load)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 text-xs sm:text-sm">
                                  <MapPin className="h-3 w-3 text-green-500" />
                                  <span className="truncate max-w-[100px] sm:max-w-[120px]">{load.pickupCity}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs sm:text-sm">
                                  <MapPin className="h-3 w-3 text-red-500" />
                                  <span className="truncate max-w-[100px] sm:max-w-[120px]">{load.dropoffCity}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs sm:text-sm">{load.shipperName || t('common.unknown')}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-xs sm:text-sm text-green-600 dark:text-green-400">
                                Rs. {priceNum.toLocaleString('en-IN')}
                              </span>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const payoutNum = load.finalPrice ? parseFloat(load.finalPrice) : 0;
                                return payoutNum > 0 ? (
                                  <span className="font-medium text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                                    Rs. {payoutNum.toLocaleString('en-IN')}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={stateDisplay.variant} className={`${stateDisplay.className} text-[10px] sm:text-xs`}>
                                {stateDisplay.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={() => openLoadDetails(load)}
                                  data-testid={`button-view-active-details-${load.id.slice(0, 8)}`}
                                  title="View full details"
                                >
                                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 sm:h-8"
                                  onClick={() => navigate(`/admin/negotiations?load=${load.id}`)}
                                  data-testid={`button-view-bids-${load.id.slice(0, 8)}`}
                                >
                                  <Gavel className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  Bids
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs h-7 sm:h-8"
                                  onClick={() => openRepriceDialog(load)}
                                  data-testid={`button-reprice-load-${load.id.slice(0, 8)}`}
                                >
                                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  Reprice
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <PricingDrawer
        open={pricingDrawerOpen}
        onOpenChange={(open) => {
          setPricingDrawerOpen(open);
          if (!open) {
            setSelectedRealLoad(null);
          }
        }}
        load={selectedRealLoad ? convertRealToDrawerFormat(selectedRealLoad) : null}
        onSuccess={() => {
          setSelectedRealLoad(null);
        }}
        carriers={realCarriers}
      />

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
              Load Details - {detailsLoad ? formatLoadId(detailsLoad) : ''}
              {detailsLoad?.pricingType && (
                <Badge className={`text-xs ${detailsLoad.pricingType === "my_fleet" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                  {detailsLoad.pricingType === "my_fleet" ? "My Fleet" : "Marketplace"}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Complete shipper submission details
            </DialogDescription>
          </DialogHeader>

          {detailsLoad && (
            <div className="space-y-4 sm:space-y-6">
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Shipper Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Company Name</Label>
                      <p className="font-medium">{detailsLoad.shipperCompanyName || detailsLoad.shipperName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Contact Name</Label>
                      <p className="font-medium">{detailsLoad.shipperContactName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Company Address</Label>
                      <p className="font-medium">{detailsLoad.shipperCompanyAddress || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Phone</Label>
                      <p className="font-medium">{detailsLoad.shipperPhone || "N/A"}</p>
                    </div>
                    {detailsLoad.shipperEmail && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Email</Label>
                        <p className="font-medium">{detailsLoad.shipperEmail}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {(detailsLoad.receiverName || detailsLoad.receiverPhone) && (
                <Card>
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Receiver Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Receiver Name</Label>
                        <p className="font-medium">{detailsLoad.receiverName || "N/A"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Receiver Phone</Label>
                        <p className="font-medium">{detailsLoad.receiverPhone || "N/A"}</p>
                      </div>
                      {detailsLoad.receiverEmail && (
                        <div className="col-span-2">
                          <Label className="text-muted-foreground text-xs">Receiver Email</Label>
                          <p className="font-medium">{detailsLoad.receiverEmail}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Route Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:gap-4 text-xs sm:text-sm">
                  {/* Pickup Location */}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-[10px] sm:text-xs font-semibold uppercase tracking-wide">Pickup Location</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pl-2 border-l-2 border-green-500">
                      {detailsLoad.pickupBusinessName && (
                        <div className="col-span-2">
                          <Label className="text-muted-foreground text-xs">Business Name</Label>
                          <p className="font-medium text-primary">{detailsLoad.pickupBusinessName}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-muted-foreground text-xs">Street Address</Label>
                        <p className="font-medium">{detailsLoad.pickupAddress || "N/A"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">City, State</Label>
                        <p className="font-medium">{detailsLoad.pickupCity}</p>
                      </div>
                      {detailsLoad.pickupLocality && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Locality / Area</Label>
                          <p className="font-medium">{detailsLoad.pickupLocality}</p>
                        </div>
                      )}
                      {detailsLoad.pickupLandmark && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Landmark</Label>
                          <p className="font-medium">{detailsLoad.pickupLandmark}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dropoff Location */}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-[10px] sm:text-xs font-semibold uppercase tracking-wide">Dropoff Location</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pl-2 border-l-2 border-red-500">
                      {detailsLoad.dropoffBusinessName && (
                        <div className="col-span-2">
                          <Label className="text-muted-foreground text-xs">Business Name</Label>
                          <p className="font-medium">{detailsLoad.dropoffBusinessName}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-muted-foreground text-xs">Street Address</Label>
                        <p className="font-medium">{detailsLoad.dropoffAddress || "N/A"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">City, State</Label>
                        <p className="font-medium">{detailsLoad.dropoffCity}</p>
                      </div>
                      {detailsLoad.dropoffLocality && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Locality / Area</Label>
                          <p className="font-medium">{detailsLoad.dropoffLocality}</p>
                        </div>
                      )}
                      {detailsLoad.dropoffLandmark && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Landmark</Label>
                          <p className="font-medium">{detailsLoad.dropoffLandmark}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Cargo Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Weight</Label>
                      <p className="font-medium">{detailsLoad.weight} {detailsLoad.weightUnit || "MT"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Required Truck Type</Label>
                      <p className="font-medium">{detailsLoad.requiredTruckType || "Standard"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">Goods to be Carried</Label>
                      <p className="font-medium">
                        {detailsLoad.goodsToBeCarried
                          ? formatCommodityLabel(detailsLoad.goodsToBeCarried)
                          : detailsLoad.materialType
                            ? formatCommodityLabel(detailsLoad.materialType)
                            : detailsLoad.cargoDescription
                              ? detailsLoad.cargoDescription
                              : "N/A"}
                      </p>
                    </div>
                    {detailsLoad.specialNotes && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground text-xs">Special Notes</Label>
                        <p className="font-medium text-amber-600 dark:text-amber-400">{detailsLoad.specialNotes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Pickup Date</Label>
                      <p className="font-medium">
                        {detailsLoad.pickupDate
                          ? new Date(detailsLoad.pickupDate).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                          : "Not specified"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Delivery Date</Label>
                      <p className="font-medium">
                        {detailsLoad.deliveryDate
                          ? new Date(detailsLoad.deliveryDate).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                          : "Not specified"}
                      </p>
                    </div>
                    {detailsLoad.submittedAt && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground text-xs">Submitted At</Label>
                        <p className="font-medium text-muted-foreground">
                          {new Date(detailsLoad.submittedAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" />
                    Shipper's Pricing Preference
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Rate Type</Label>
                      <p className="font-medium">
                        {detailsLoad.rateType === "fixed_price" ? "Fixed Price" : "Per Tonne Rate"}
                      </p>
                    </div>
                    {detailsLoad.rateType === "fixed_price" && detailsLoad.shipperFixedPrice && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Shipper's Fixed Price</Label>
                        <p className="font-medium text-blue-600 dark:text-blue-400">
                          Rs. {Number(detailsLoad.shipperFixedPrice).toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}
                    {detailsLoad.rateType !== "fixed_price" && detailsLoad.shipperPricePerTon && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Shipper's Rate (Per Tonne)</Label>
                        <p className="font-medium text-blue-600 dark:text-blue-400">
                          Rs. {Number(detailsLoad.shipperPricePerTon).toLocaleString('en-IN')} / tonne
                        </p>
                      </div>
                    )}
                    {detailsLoad.advancePaymentPercent !== undefined && detailsLoad.advancePaymentPercent !== null && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Preferred Advance Payment</Label>
                        <p className="font-medium text-amber-600 dark:text-amber-400">
                          {detailsLoad.advancePaymentPercent}%
                        </p>
                      </div>
                    )}
                    {detailsLoad.adminPrice && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Admin Priced Amount</Label>
                        <p className="font-medium text-green-600 dark:text-green-400">
                          Rs. {Number(detailsLoad.adminPrice).toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}
                    {detailsLoad.adminFinalPrice && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Admin Set Price (Shipper Total)</Label>
                        <p className="font-medium text-primary">
                          Rs. {Number(detailsLoad.adminFinalPrice).toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}
                    {detailsLoad.finalPrice && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Carrier Payout (After Margin)</Label>
                        <p className="font-medium text-emerald-600 dark:text-emerald-400">
                          Rs. {Number(detailsLoad.finalPrice).toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}
                    {detailsLoad.adminFinalPrice && detailsLoad.finalPrice && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Platform Margin</Label>
                        <p className="font-medium text-orange-600 dark:text-orange-400">
                          Rs. {(Number(detailsLoad.adminFinalPrice) - Number(detailsLoad.finalPrice)).toLocaleString('en-IN')}
                          {' '}({((1 - Number(detailsLoad.finalPrice) / Number(detailsLoad.adminFinalPrice)) * 100).toFixed(0)}%)
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {detailsLoad.pricingType === "my_fleet" && detailsLoad.myFleetPricing && (
                <Card>
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      My Fleet Pricing Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Total Trip Cost</Label>
                        <p className="font-medium text-blue-600 dark:text-blue-400">
                          Rs. {detailsLoad.myFleetPricing.totalTripCost.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Cost Per KM</Label>
                        <p className="font-medium">
                          Rs. {detailsLoad.myFleetPricing.costPerKm.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Net Profit/Loss</Label>
                        <p className={`font-medium ${detailsLoad.myFleetPricing.netProfitLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          Rs. {detailsLoad.myFleetPricing.netProfitLoss.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Profit Margin %</Label>
                        <p className="font-medium">
                          {detailsLoad.myFleetPricing.profitMarginPercent.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}


              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Status: {getCanonicalStateDisplay(detailsLoad.status).label}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsDialogOpen(false)}
              data-testid="button-close-details-dialog"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Send Confirmation Dialog */}
      <AlertDialog open={invoiceConfirmOpen} onOpenChange={setInvoiceConfirmOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Send Invoice to Shipper?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs sm:text-sm">
              {loadToSendInvoice && (
                <>
                  <p>
                    You are about to send the invoice for load <span className="font-mono font-medium">{formatLoadId(loadToSendInvoice)}</span> to the shipper who originally posted this load.
                  </p>
                  <div className="bg-muted rounded-md p-2 sm:p-3 mt-2 space-y-1 text-xs sm:text-sm">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-muted-foreground">Shipper:</span>
                      <span className="font-medium">{loadToSendInvoice.shipperName || loadToSendInvoice.shipperCompanyName || 'Unknown'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-muted-foreground">Route:</span>
                      <span className="font-medium">{loadToSendInvoice.pickupCity} → {loadToSendInvoice.dropoffCity}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-muted-foreground">Rate Type:</span>
                      <span className="font-medium">{loadToSendInvoice.rateType === "fixed_price" ? "Fixed Price" : "Per Tonne"}</span>
                    </div>
                    {loadToSendInvoice.rateType === "per_ton" && loadToSendInvoice.shipperPricePerTon && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Shipper's Rate:</span>
                        <span className="font-medium text-blue-600">
                          Rs. {Number(loadToSendInvoice.shipperPricePerTon).toLocaleString('en-IN')} / tonne
                        </span>
                      </div>
                    )}
                    {loadToSendInvoice.rateType === "fixed_price" && loadToSendInvoice.shipperFixedPrice && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Shipper's Price:</span>
                        <span className="font-medium text-blue-600">
                          Rs. {Number(loadToSendInvoice.shipperFixedPrice).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    {loadToSendInvoice.finalPrice && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Carrier Payment:</span>
                        <span className="font-medium">
                          Rs. {Number(loadToSendInvoice.finalPrice).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    <Separator className="my-2" />
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="font-semibold">Invoice Amount:</span>
                      <span className="font-bold text-green-600">
                        Rs. {Number(loadToSendInvoice.adminFinalPrice || loadToSendInvoice.shipperFixedPrice || loadToSendInvoice.adminPrice || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm mt-2">
                    The shipper will receive a notification and can view/acknowledge the invoice.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSendingInvoice}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSendInvoice}
              disabled={isSendingInvoice}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-confirm-send-invoice"
            >
              {isSendingInvoice ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reprice and Repost Dialog */}
      <Dialog open={repriceDialogOpen} onOpenChange={setRepriceDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
              Reprice & Repost Load
            </DialogTitle>
            <DialogDescription className="text-[10px] sm:text-xs md:text-sm">
              Update the price and repost this load to carriers. Any existing pending bids will be rejected.
            </DialogDescription>
          </DialogHeader>

          {repriceLoad && (
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-2" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <div className="space-y-2 sm:space-y-3 md:space-y-4 pb-3 sm:pb-4">
                {/* Load Summary */}
                <Card>
                  <CardContent className="pt-3 sm:pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Load:</span>
                        <span className="font-mono font-medium">{formatLoadId(repriceLoad)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Truck className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span className="truncate">{repriceLoad.requiredTruckType || "Standard"}</span>
                      </div>
                      <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                        <span className="truncate">{repriceLoad.pickupCity}</span>
                        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                        <span className="truncate">{repriceLoad.dropoffCity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span>{repriceLoad.weight} {repriceLoad.weightUnit || "MT"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Current:</span>
                        <span className="font-medium text-amber-600">
                          Rs. {Number(repriceLoad.adminFinalPrice || repriceLoad.finalPrice || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Shipper's Pricing Preference */}
                {(repriceLoad.shipperFixedPrice || repriceLoad.shipperPricePerTon) && (
                  <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardContent className="pt-3 sm:pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600" />
                        <span className="font-medium text-xs sm:text-sm text-amber-700 dark:text-amber-400">Shipper's Pricing Preference</span>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px] sm:text-xs">
                          Pre-filled
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {repriceLoad.rateType === "per_ton" ? "Per Tonne Rate" : "Fixed Price"}
                        </span>
                        <span className="font-bold text-base sm:text-lg text-amber-700 dark:text-amber-400">
                          {repriceLoad.rateType === "per_ton" && repriceLoad.shipperPricePerTon
                            ? `Rs. ${parseFloat(repriceLoad.shipperPricePerTon.toString()).toLocaleString("en-IN")}/MT`
                            : repriceLoad.shipperFixedPrice
                              ? `Rs. ${parseFloat(repriceLoad.shipperFixedPrice.toString()).toLocaleString("en-IN")}`
                              : "-"
                          }
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                        The pricing fields below have been pre-filled with the shipper's preferences. You can adjust as needed.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Pricing Method */}
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                  <CardContent className="pt-3 sm:pt-4 space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2">
                      <Scale className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                      <span className="font-medium text-xs sm:text-sm">Pricing Method</span>
                    </div>

                    {/* Rate Type Toggle */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={!repriceUsePerTonRate ? "default" : "outline"}
                        className="w-full text-xs sm:text-sm h-8 sm:h-9"
                        onClick={() => {
                          setRepriceUsePerTonRate(false);
                          setRepriceRatePerTon(0);
                        }}
                        data-testid="button-reprice-rate-type-fixed"
                      >
                        <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Fixed Price
                      </Button>
                      <Button
                        type="button"
                        variant={repriceUsePerTonRate ? "default" : "outline"}
                        className="w-full text-xs sm:text-sm h-8 sm:h-9"
                        onClick={() => {
                          setRepriceUsePerTonRate(true);
                          // Calculate per-ton rate from current gross price if switching
                          if (repriceGrossPrice > 0 && repriceTonnage > 0) {
                            setRepriceRatePerTon(Math.round(repriceGrossPrice / repriceTonnage));
                          }
                        }}
                        data-testid="button-reprice-rate-type-per-ton"
                      >
                        <Scale className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Per Tonne Rate
                      </Button>
                    </div>

                    {/* Per Tonne Rate Calculator */}
                    {repriceUsePerTonRate && (
                      <div className="space-y-3 sm:space-y-4 pt-2 border-t">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Tonnage (MT)</Label>
                            <Input
                              type="number"
                              value={repriceTonnage || ""}
                              onChange={(e) => {
                                const newWeight = parseFloat(e.target.value) || 0;
                                setRepriceTonnage(newWeight);
                                // Recalculate total when tonnage changes
                                if (repriceRatePerTon > 0) {
                                  const newTotal = Math.round(repriceRatePerTon * newWeight);
                                  setRepriceGrossPrice(Math.max(0, newTotal));
                                }
                              }}
                              placeholder=""
                              className="text-base sm:text-lg font-medium"
                              data-testid="input-reprice-tonnage"
                            />
                            <p className="text-[10px] sm:text-xs text-muted-foreground">From load: {parseFloat(repriceLoad.weight?.toString() || "0")} {repriceLoad.weightUnit || "MT"}</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Rate Per Tonne (Rs.)</Label>
                            <Input
                              type="number"
                              value={repriceRatePerTon || ""}
                              onChange={(e) => {
                                const rate = parseInt(e.target.value) || 0;
                                setRepriceRatePerTon(rate);
                                // Recalculate total
                                const newTotal = Math.round(rate * repriceTonnage);
                                setRepriceGrossPrice(Math.max(0, newTotal));
                              }}
                              placeholder=""
                              className="text-base sm:text-lg font-medium"
                              data-testid="input-reprice-rate-per-ton"
                            />
                          </div>
                        </div>

                        {repriceRatePerTon > 0 && (
                          <div className="flex items-center justify-between p-2 sm:p-3 bg-primary/10 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Calculator className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                              <span className="text-xs sm:text-sm font-medium">Calculated Total</span>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] sm:text-xs text-muted-foreground">
                                {repriceTonnage} MT x Rs. {repriceRatePerTon.toLocaleString("en-IN")}
                              </p>
                              <p className="text-lg sm:text-xl font-bold text-primary" data-testid="text-reprice-calculated-total">
                                Rs. {Math.round(repriceRatePerTon * repriceTonnage).toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fixed Price Input */}
                    {!repriceUsePerTonRate && (
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs sm:text-sm">Enter Fixed Price (Rs.)</Label>
                        <div className="flex items-center gap-2">
                          <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                          <Input
                            type="number"
                            value={repriceGrossPrice || ""}
                            onChange={(e) => {
                              const newPrice = parseInt(e.target.value) || 0;
                              setRepriceGrossPrice(Math.max(0, newPrice)); // Ensure non-negative
                            }}
                            placeholder=""
                            className="text-base sm:text-lg font-medium"
                            data-testid="input-reprice-fixed-price"
                          />
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          This is the total amount the shipper will pay
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pricing Template Selection */}
                {pricingTemplates.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Pricing Template (Optional)</Label>
                    <Select value={repriceSelectedTemplate || "none"} onValueChange={(val) => applyRepriceTemplate(val === "none" ? "" : val)}>
                      <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm" data-testid="select-reprice-template">
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No template</SelectItem>
                        {pricingTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Total Price Summary */}
                <Card className="border-green-500">
                  <CardContent className="pt-3 sm:pt-4">
                    <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                      <div className="flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="font-medium text-xs sm:text-sm">Total Price</span>
                        <Badge variant="outline" className="text-[10px] sm:text-xs">
                          {repriceUsePerTonRate ? "Per Tonne" : "Fixed"}
                        </Badge>
                      </div>
                      <Input
                        type="number"
                        value={repriceGrossPrice}
                        onChange={(e) => setRepriceGrossPrice(parseInt(e.target.value) || 0)}
                        className="w-24 sm:w-28 md:w-32 text-right font-bold text-base sm:text-lg h-8 sm:h-9"
                        data-testid="input-reprice-gross-price"
                      />
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
                          inputMode="numeric"
                          value={repriceMarginInputStr}
                          onChange={(e) => handleRepriceMarginChange(e.target.value)}
                          onBlur={handleRepriceInputBlur}
                          className="w-14 sm:w-16 text-right text-sm h-8 sm:h-9"
                          data-testid="input-reprice-platform-margin"
                        />
                        <span className="text-xs sm:text-sm font-medium">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                      <span className="text-muted-foreground">Platform Earnings:</span>
                      <span className="font-medium text-primary">Rs. {repricePlatformEarnings.toLocaleString("en-IN")}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-xs sm:text-sm">Final Price (Carrier Payout):</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs sm:text-sm text-muted-foreground">Rs.</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={repricePayoutInputStr}
                          onChange={(e) => handleRepricePayoutChange(e.target.value)}
                          onBlur={handleRepriceInputBlur}
                          className="w-20 sm:w-24 md:w-28 text-right font-bold text-base sm:text-lg text-green-600 dark:text-green-400 h-8 sm:h-9"
                          data-testid="input-reprice-carrier-payout"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Carrier Advance Payment */}
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
                            variant={repriceAdvancePercent === percent ? "default" : "outline"}
                            size="sm"
                            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                            onClick={() => setRepriceAdvancePercent(percent)}
                            data-testid={`button-reprice-advance-${percent}`}
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
                          type="number"
                          value={repriceAdvancePercent}
                          onChange={(e) => setRepriceAdvancePercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-16 sm:w-20 text-right text-sm h-8 sm:h-9"
                          data-testid="input-reprice-advance-percent"
                        />
                        <span className="text-xs sm:text-sm font-medium">%</span>
                      </div>
                    </div>

                    {/* Payment Breakdown */}
                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                        <span className="text-muted-foreground">Advance (Upfront):</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          Rs. {repriceAdvanceAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                        <span className="text-muted-foreground">Balance (On Delivery):</span>
                        <span className="font-semibold">
                          Rs. {repriceBalanceAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                        <span className="font-medium">Total Carrier Payout:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          Rs. {repriceCarrierPayout.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      Advance is paid to carrier before pickup. Balance is paid after successful delivery.
                    </p>
                  </CardContent>
                </Card>


                {/* Allow Counter Bids */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="reprice-allow-counter"
                    checked={repriceAllowCounter}
                    onChange={(e) => setRepriceAllowCounter(e.target.checked)}
                    className="h-3 w-3 sm:h-4 sm:w-4 rounded border-gray-300"
                    data-testid="checkbox-allow-counter-bids"
                  />
                  <Label htmlFor="reprice-allow-counter" className="text-xs sm:text-sm font-normal">
                    Allow carriers to counter-bid
                  </Label>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reprice-reason" className="text-xs sm:text-sm">Reason (optional) <span className="text-muted-foreground font-normal text-[10px] sm:text-xs">(e.g. Market rate adjustment)</span></Label>
                  <Textarea
                    id="reprice-reason"
                    placeholder=""
                    value={repriceReason}
                    onChange={(e) => setRepriceReason(e.target.value)}
                    rows={2}
                    className="text-xs sm:text-sm"
                    data-testid="textarea-reprice-reason"
                  />
                </div>

                {repriceLoad.status === 'counter_received' && (
                  <div className="p-2 sm:p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                      This load has active counter-bids. Repricing will reject all pending bids.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-shrink-0 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-t">
            <Button
              variant="outline"
              onClick={() => setRepriceDialogOpen(false)}
              disabled={isRepricing}
              className="text-[10px] sm:text-xs md:text-sm h-8 sm:h-9"
              data-testid="button-cancel-reprice"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRepriceAndRepost}
              disabled={isRepricing || repriceGrossPrice <= 0}
              className="text-[10px] sm:text-xs md:text-sm h-8 sm:h-9"
              data-testid="button-confirm-reprice"
            >
              {isRepricing ? (
                <>
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                  Repricing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Reprice & Repost
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MyFleetPricingDrawer
        open={myFleetDrawerOpen}
        onOpenChange={setMyFleetDrawerOpen}
        load={myFleetLoad ? {
          id: myFleetLoad.id,
          loadId: formatLoadId(myFleetLoad),
          pickupCity: myFleetLoad.pickupCity,
          dropoffCity: myFleetLoad.dropoffCity,
          weight: myFleetLoad.weight,
          weightUnit: myFleetLoad.weightUnit,
          requiredTruckType: myFleetLoad.requiredTruckType || "",
          distance: resolveLoadDistance(myFleetLoad),
          pickupLat: myFleetLoad.pickupLat,
          pickupLng: myFleetLoad.pickupLng,
          dropoffLat: myFleetLoad.dropoffLat,
          dropoffLng: myFleetLoad.dropoffLng,
          cargoDescription: myFleetLoad.cargoDescription || myFleetLoad.goodsToBeCarried,
          adminFinalPrice: myFleetLoad.adminFinalPrice,
          status: myFleetLoad.status,
          shipperName: myFleetLoad.shipperName,
          shipperPricePerTon: myFleetLoad.shipperPricePerTon,
          shipperFixedPrice: myFleetLoad.shipperFixedPrice,
          rateType: myFleetLoad.rateType,
          advancePaymentPercent: myFleetLoad.advancePaymentPercent,
        } : null}
        carriers={myFleetDriverOptions}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/queue"] });
          toast({
            title: "Success",
            description: "My Fleet pricing saved successfully",
          });
        }}
      />
    </div>
  );
}
