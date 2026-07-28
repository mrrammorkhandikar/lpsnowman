import { useState, useMemo, useEffect } from "react";
import { getDocumentUrl } from "@/lib/document-utils";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ChevronLeft,
  Package,
  User,
  Truck,
  MapPin,
  FileText,
  Clock,
  DollarSign,
  MessageSquare,
  Phone,
  Mail,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Edit,
  UserPlus,
  Download,
  Eye,
  EyeOff,
  Star,
  Navigation,
  Calendar,
  Weight,
  Ruler,
  Shield,
  BadgeCheck,
  CircleDot,
  Send,
  MoreHorizontal,
  Loader2,
  Calculator,
  TrendingUp,
  Receipt,
  Target,
  ChevronRight,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAdminData, type DetailedLoad, type AdminLoad, type AdminCarrier, type LoadBidRecord } from "@/lib/admin-data-store";
import { useBidsByLoad, type GroupedBidsResponse } from "@/lib/api-hooks";
import { format } from "date-fns";
import type { Load } from "@shared/schema";
import { indianStates, getCitiesByState } from "@shared/indian-locations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppDateTimePicker } from "@/components/ui/date-time-picker";
import { connectMarketplace, onMarketplaceEvent, disconnectMarketplace } from "@/lib/marketplace-socket";
import { useAuth } from "@/lib/auth-context";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";

// Commodity categories for goods selection
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
      { value: "chemicals_hazardous", label: "Chemicals (Hazardous)" },
      { value: "caustic_soda", label: "Caustic Soda" },
      { value: "petroleum_products", label: "Petroleum Products" },
      { value: "lng_lpg", label: "LNG / LPG" },
      { value: "bitumen", label: "Bitumen" },
      { value: "lubricants", label: "Lubricants / Oils" },
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
      { value: "hazardous", label: "Hazardous Materials" },
      { value: "perishables", label: "Perishables (Temperature Controlled)" },
      { value: "livestock", label: "Livestock" },
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
      { value: "waste", label: "Industrial Waste" },
      { value: "recyclables", label: "Recyclables" },
      { value: "other", label: "Other / Custom" },
    ],
  },
];

// Flatten all commodities for searching
const allCommodities = commodityCategories.flatMap(cat => 
  cat.items.map(item => ({ ...item, category: cat.category }))
);

// Get commodity label from value
function getCommodityLabel(value: string): string {
  for (const category of commodityCategories) {
    const item = category.items.find(i => i.value === value);
    if (item) return item.label;
  }
  return value;
}

// Searchable Commodity Combobox - uses Popover portal to render outside Sheet
function CommodityCombobox({ 
  value, 
  onChange,
  customValue,
  onCustomChange
}: { 
  value?: string; 
  onChange: (value: string) => void;
  customValue?: string;
  onCustomChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const selectedCommodity = value ? allCommodities.find(c => c.value === value) : null;
  const isCustomSelected = value === "other";

  // Filter commodities based on search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return commodityCategories;
    
    const searchLower = search.toLowerCase();
    return commodityCategories
      .map(category => ({
        ...category,
        items: category.items.filter(item => 
          item.label.toLowerCase().includes(searchLower) ||
          item.value.toLowerCase().includes(searchLower)
        )
      }))
      .filter(category => category.items.length > 0);
  }, [search]);

  // Get display text for the button
  const getDisplayText = () => {
    if (isCustomSelected && customValue) {
      return customValue;
    }
    if (selectedCommodity) {
      return selectedCommodity.label;
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            data-testid="select-goods-to-be-carried"
          >
            {getDisplayText() ? (
              <span className="truncate">{getDisplayText()}</span>
            ) : (
              <span className="text-muted-foreground">Select commodity type...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[350px] p-0" 
          align="start" 
          sideOffset={4}
          style={{ zIndex: 9999 }}
        >
          <div className="flex flex-col">
            <div className="flex items-center border-b px-3">
              <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                placeholder="Search commodities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="input-commodity-search"
              />
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {filteredCategories.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No commodity found.
                </div>
              ) : (
                filteredCategories.map((category) => (
                  <div key={category.category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                      {category.category}
                    </div>
                    {category.items.map((item) => (
                      <div
                        key={item.value}
                        className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${
                          value === item.value ? "bg-accent" : ""
                        }`}
                        onClick={() => {
                          onChange(item.value);
                          if (item.value !== "other") {
                            onCustomChange("");
                          }
                          setSearch("");
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            value === item.value ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {item.label}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Custom commodity input when "Other / Custom" is selected */}
      {isCustomSelected && (
        <Input
          placeholder="Enter your commodity type..."
          value={customValue || ""}
          onChange={(e) => onCustomChange(e.target.value)}
          className="mt-2"
          data-testid="input-custom-commodity"
        />
      )}
    </div>
  );
}

const formatCurrency = (amount: number) => {
  if (amount >= 100000) {
    return `Rs. ${(amount / 100000).toFixed(2)}L`;
  }
  return `Rs. ${amount.toLocaleString("en-IN")}`;
};

interface SafeUserDTO {
  id: string;
  username: string;
  email: string;
  company: string | null;
  phone: string | null;
  isVerified: boolean;
  role: string;
}

interface ShipmentDetails {
  id: string;
  status: string;
  truckId: string | null;
  driverId: string | null;
  truck?: {
    id: string;
    licensePlate: string;
    manufacturer: string | null;
    model: string | null;
    truckType: string | null;
    capacity: string | null;
    chassisNumber: string | null;
    registrationNumber: string | null;
  } | null;
  driver?: {
    id: string;
    username: string;
    phone: string | null;
    email: string;
  } | null;
}

interface CarrierOnboarding {
  carrierType: string | null;
  fleetSize: number | null;
}

type LoadWithRelations = Load & { 
  shipper?: SafeUserDTO | null; 
  assignedCarrier?: SafeUserDTO | null;
  shipmentDetails?: ShipmentDetails | null;
  carrierOnboarding?: CarrierOnboarding | null;
};

interface RecommendedCarrierTruck {
  id: string;
  truckType: string | null;
  registrationNumber: string | null;
  capacity: string | null;
  manufacturer: string | null;
  model: string | null;
}

interface RecommendedCarrier {
  carrierId: string;
  carrierName: string;
  carrierCompany: string | null;
  carrierPhone: string | null;
  carrierEmail: string | null;
  carrierType: string;
  score: number;
  matchReasons: string[];
  truckTypeMatch: boolean;
  capacityMatch: boolean;
  routeExperience: boolean;
  commodityExperience: boolean;
  shipperExperience: boolean;
  trucks: RecommendedCarrierTruck[];
  fleetSize: number | null;
  completedTrips: number;
  serviceZones: string[];
  operatingRegion: string | null;
}

type RealCarrier = {
  id: string;
  username: string;
  companyName: string | null;
  phone: string | null;
  isVerified: boolean | null;
  profile: {
    carrierType: string | null;
    totalDeliveries: number | null;
    fleetSize: number | null;
  } | null;
  bidCount: number;
};

function RecommendedCarriersSection({ loadId }: { loadId: string }) {
  const [selectedCarrier, setSelectedCarrier] = useState<RecommendedCarrier | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Try to get recommendations from API first
  const { data: apiRecommendations, isLoading: isApiLoading } = useQuery<RecommendedCarrier[]>({
    queryKey: ['/api/loads', loadId, 'recommended-carriers'],
    queryFn: async () => {
      const res = await fetch(`/api/loads/${loadId}/recommended-carriers`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch recommended carriers');
      return res.json();
    },
    enabled: !!loadId,
  });

  // Fallback: Get all carriers and load data for manual recommendations
  const { data: realCarriers = [] } = useQuery<RealCarrier[]>({
    queryKey: ["/api/admin/carriers"],
    enabled: !!loadId && (!apiRecommendations || apiRecommendations.length === 0),
  });

  const { data: apiLoad } = useQuery<LoadWithRelations>({
    queryKey: ["/api/loads", loadId],
    enabled: !!loadId && (!apiRecommendations || apiRecommendations.length === 0),
  });

  // Generate fallback recommendations when API fails
  const fallbackRecommendations = useMemo(() => {
    if (!apiLoad || !realCarriers.length) return [];
    
    const verifiedCarriers = realCarriers.filter(c => c.isVerified);
    
    return verifiedCarriers
      .map(carrier => {
        // Basic scoring logic - use correct property names
        const totalDeliveries = carrier.profile?.totalDeliveries || 0;
        const fleetSize = carrier.profile?.fleetSize || 0;
        const carrierType = carrier.profile?.carrierType?.toLowerCase() || '';
        const loadTruckType = apiLoad.requiredTruckType?.toLowerCase() || '';
        
        const matchReasons: string[] = [];

        // --- 100-point scoring system matching the UI breakdown ---
        // Truck Type Match: 30 pts
        const truckTypeMatch = !!loadTruckType && (
          (loadTruckType.includes('multi') && carrierType === 'fleet') ||
          (!loadTruckType.includes('multi') && carrierType === 'solo') ||
          carrierType === loadTruckType
        );
        if (truckTypeMatch) matchReasons.push('Truck type match');

        // Capacity Match: 25 pts
        const capacityMatch = carrierType === 'fleet' || fleetSize > 0;
        if (capacityMatch) matchReasons.push('Fleet capacity');

        // Route Experience: 20 pts
        const routeExperience = totalDeliveries > 0;
        if (routeExperience) matchReasons.push('Route experience');

        // Commodity Experience: 15 pts (simplified – same as route)
        const commodityExperience = totalDeliveries > 0;
        if (commodityExperience) matchReasons.push('Commodity experience');

        // Shipper Experience: 10 pts (using bidCount as proxy)
        const shipperExperience = carrier.bidCount > 0;
        if (shipperExperience) matchReasons.push('Active bidder');

        const score =
          (truckTypeMatch ? 30 : 0) +
          (capacityMatch ? 25 : 0) +
          (routeExperience ? 20 : 0) +
          (commodityExperience ? 15 : 0) +
          (shipperExperience ? 10 : 0);

        return {
          carrierId: carrier.id,
          carrierName: carrier.username,
          carrierCompany: carrier.companyName,
          carrierPhone: carrier.phone,
          carrierEmail: null, // Not available in RealCarrier
          carrierType: carrier.profile?.carrierType || 'Unknown',
          score, // 0–100 scale matching UI breakdown
          matchReasons,
          truckTypeMatch,
          capacityMatch,
          routeExperience,
          commodityExperience,
          shipperExperience,
          trucks: [], // Not available in fallback
          fleetSize,
          completedTrips: totalDeliveries,
          serviceZones: [], // Not available in RealCarrier
          operatingRegion: null, // Not available in RealCarrier
        };
      })
      .filter(carrier => carrier.score >= 20) // Only show decent matches (≥20/100)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10 recommendations
  }, [apiLoad, realCarriers]);

  const recommendations = apiRecommendations || fallbackRecommendations;
  const isLoading = isApiLoading || (!apiRecommendations && !apiLoad);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
            Recommended Carriers
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Finding best matches based on truck, route, and history...</CardDescription>
        </CardHeader>
        <CardContent className="py-6 sm:py-8 text-center px-4 sm:px-6">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
            Recommended Carriers
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">AI-powered carrier matching</CardDescription>
        </CardHeader>
        <CardContent className="py-6 sm:py-8 text-center px-4 sm:px-6">
          <Truck className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mx-auto mb-2 sm:mb-3" />
          <p className="text-sm sm:text-base text-muted-foreground">No matching carriers found based on current criteria</p>
          <p className="text-xs text-muted-foreground mt-1">Matches are based on truck type, capacity, route history, commodity experience, and shipper interactions</p>
        </CardContent>
      </Card>
    );
  }

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 50) return "secondary";
    return "outline";
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
          Recommended Carriers
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Top {recommendations.length} carriers matched by truck type, capacity, route history, commodity, and shipper experience
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="space-y-2 sm:space-y-3">
          {recommendations.map((carrier, idx) => (
            <div 
              key={carrier.carrierId} 
              className="flex flex-col sm:flex-row sm:items-start sm:justify-between p-3 sm:p-4 border rounded-lg hover-elevate cursor-pointer gap-3"
              data-testid={`recommended-carrier-${idx}`}
              onClick={() => {
                setSelectedCarrier(carrier);
                setDetailDialogOpen(true);
              }}
            >
              <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
                  #{idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="font-medium text-sm sm:text-base truncate">{carrier.carrierName}</span>
                    <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                      {carrier.carrierType === "solo" ? "Solo" : "Fleet"}
                    </Badge>
                  </div>
                  {carrier.carrierCompany && (
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{carrier.carrierCompany}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5 sm:mt-2">
                    {carrier.truckTypeMatch && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs bg-blue-50 dark:bg-blue-950">
                        <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        Truck Match
                      </Badge>
                    )}
                    {carrier.capacityMatch && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs bg-green-50 dark:bg-green-950">
                        <Weight className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        Capacity OK
                      </Badge>
                    )}
                    {carrier.routeExperience && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs bg-purple-50 dark:bg-purple-950">
                        <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        Route Exp
                      </Badge>
                    )}
                    {carrier.commodityExperience && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs bg-orange-50 dark:bg-orange-950">
                        <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        Commodity Exp
                      </Badge>
                    )}
                    {carrier.shipperExperience && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs bg-yellow-50 dark:bg-yellow-950">
                        <Building2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        Shipper Exp
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:text-right">
                <div>
                  <div className={`text-xl sm:text-2xl font-bold ${getScoreColor(carrier.score)}`}>
                    {carrier.score}
                  </div>
                  <Badge variant={getScoreBadgeVariant(carrier.score)} className="text-[10px] sm:text-xs">
                    Match Score
                  </Badge>
                </div>
                {carrier.carrierPhone && (
                  <p className="text-xs text-muted-foreground sm:mt-2 truncate max-w-[150px]">{carrier.carrierPhone}</p>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground sm:mt-1 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Carrier Match Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Carrier Match Details
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Detailed breakdown of how this carrier matches your load requirements
            </DialogDescription>
          </DialogHeader>
          
          {selectedCarrier && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pr-2 -mr-2">
            <div className="space-y-3 sm:space-y-4 pb-2">
              {/* Carrier Info */}
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="font-semibold text-base sm:text-lg truncate">{selectedCarrier.carrierName}</span>
                    <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                      {selectedCarrier.carrierType === "solo" ? "Solo Driver" : "Fleet Carrier"}
                    </Badge>
                  </div>
                  {selectedCarrier.carrierCompany && (
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedCarrier.carrierCompany}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl sm:text-3xl font-bold text-primary">{selectedCarrier.score}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Match Score</p>
                </div>
              </div>

              {/* Contact Details */}
              <div className="border rounded-lg p-3 sm:p-4">
                <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedCarrier.carrierPhone || "Not provided"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedCarrier.carrierEmail || "Not provided"}</span>
                  </div>
                  {selectedCarrier.carrierType !== "solo" && selectedCarrier.fleetSize && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <span>Fleet Size: {selectedCarrier.fleetSize} trucks</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <span>Completed Trips: {selectedCarrier.completedTrips}</span>
                  </div>
                </div>
              </div>

              {/* Service Zones */}
              <div className="border rounded-lg p-3 sm:p-4">
                <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Service Zones
                </h4>
                {selectedCarrier.operatingRegion && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm mb-2">
                    <Navigation className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">Operating Region: {selectedCarrier.operatingRegion}</span>
                  </div>
                )}
                {selectedCarrier.serviceZones && selectedCarrier.serviceZones.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedCarrier.serviceZones.map((zone, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] sm:text-xs">
                        {zone}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground">No service zones specified</p>
                )}
              </div>

              {/* Truck Details */}
              {selectedCarrier.trucks && selectedCarrier.trucks.length > 0 && (
                <div className="border rounded-lg p-3 sm:p-4">
                  <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                    <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {selectedCarrier.carrierType === "solo" ? "Truck Details" : `Fleet Vehicles (${selectedCarrier.trucks.length})`}
                  </h4>
                  <div className="space-y-2">
                    {selectedCarrier.trucks.slice(0, 3).map((truck, idx) => (
                      <div key={truck.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-muted/30 rounded text-xs sm:text-sm gap-1 sm:gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                            {truck.truckType || "Unknown"}
                          </Badge>
                          {truck.manufacturer && truck.model && (
                            <span className="text-muted-foreground truncate">{truck.manufacturer} {truck.model}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
                          {truck.registrationNumber && (
                            <span className="truncate">{truck.registrationNumber}</span>
                          )}
                          {truck.capacity && (
                            <span className="shrink-0">{truck.capacity} MT</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {selectedCarrier.trucks.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{selectedCarrier.trucks.length - 3} more vehicles
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Score Breakdown */}
              <div className="border rounded-lg p-3 sm:p-4">
                <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Score Breakdown (100 pts max)
                </h4>
                <div className="space-y-2 sm:space-y-3">
                  {/* Truck Type Match - 30 pts */}
                  <div className={`flex items-center justify-between p-2 rounded ${selectedCarrier.truckTypeMatch ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Truck className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${selectedCarrier.truckTypeMatch ? 'text-blue-600' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Truck Type Match</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${selectedCarrier.truckTypeMatch ? 'text-blue-600' : 'text-muted-foreground'}`}>
                        {selectedCarrier.truckTypeMatch ? '+30' : '0'} pts
                      </span>
                      {selectedCarrier.truckTypeMatch && <CheckCircle className="h-4 w-4 text-blue-600" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6 -mt-2">
                    Carrier has a truck type that matches load requirements
                  </p>

                  {/* Capacity Match - 25 pts */}
                  <div className={`flex items-center justify-between p-2 rounded ${selectedCarrier.capacityMatch ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2">
                      <Weight className={`h-4 w-4 ${selectedCarrier.capacityMatch ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Capacity Match</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${selectedCarrier.capacityMatch ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {selectedCarrier.capacityMatch ? '+25' : '0'} pts
                      </span>
                      {selectedCarrier.capacityMatch && <CheckCircle className="h-4 w-4 text-green-600" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6 -mt-2">
                    Carrier's truck capacity can handle the load weight
                  </p>

                  {/* Route Experience - 20 pts */}
                  <div className={`flex items-center justify-between p-2 rounded ${selectedCarrier.routeExperience ? 'bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2">
                      <MapPin className={`h-4 w-4 ${selectedCarrier.routeExperience ? 'text-purple-600' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Route Experience</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${selectedCarrier.routeExperience ? 'text-purple-600' : 'text-muted-foreground'}`}>
                        {selectedCarrier.routeExperience ? '+20' : '0'} pts
                      </span>
                      {selectedCarrier.routeExperience && <CheckCircle className="h-4 w-4 text-purple-600" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6 -mt-2">
                    Carrier has completed deliveries on similar routes before
                  </p>

                  {/* Commodity Experience - 15 pts */}
                  <div className={`flex items-center justify-between p-2 rounded ${selectedCarrier.commodityExperience ? 'bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2">
                      <Package className={`h-4 w-4 ${selectedCarrier.commodityExperience ? 'text-orange-600' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Commodity Experience</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${selectedCarrier.commodityExperience ? 'text-orange-600' : 'text-muted-foreground'}`}>
                        {selectedCarrier.commodityExperience ? '+15' : '0'} pts
                      </span>
                      {selectedCarrier.commodityExperience && <CheckCircle className="h-4 w-4 text-orange-600" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6 -mt-2">
                    Carrier has experience transporting similar materials
                  </p>

                  {/* Shipper Experience - 10 pts */}
                  <div className={`flex items-center justify-between p-2 rounded ${selectedCarrier.shipperExperience ? 'bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2">
                      <Building2 className={`h-4 w-4 ${selectedCarrier.shipperExperience ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Shipper Experience</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${selectedCarrier.shipperExperience ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                        {selectedCarrier.shipperExperience ? '+10' : '0'} pts
                      </span>
                      {selectedCarrier.shipperExperience && <CheckCircle className="h-4 w-4 text-yellow-600" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6 -mt-2">
                    Carrier has previously worked with this shipper
                  </p>
                </div>
              </div>

              {/* Total Score Summary */}
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                <span className="font-medium">Total Match Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary">{selectedCarrier.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100 pts</span>
                </div>
              </div>
            </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 pt-4">
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function AdminLoadDetailsPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ loadId: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { getDetailedLoad, updateLoadStatus, cancelLoad, assignCarrier, addAdminNote, approveDocument, rejectDocument, refreshFromShipperPortal } = useAdminData();

  type RealCarrier = {
    id: string;
    username: string;
    companyName: string | null;
    phone: string | null;
    isVerified: boolean | null;
    profile: {
      carrierType: string | null;
      totalDeliveries: number | null;
      fleetSize: number | null;
    } | null;
    bidCount: number;
  };

  const { data: realCarriers = [] } = useQuery<RealCarrier[]>({
    queryKey: ["/api/admin/carriers"],
  });

  const verifiedRealCarriers = useMemo(() => 
    realCarriers.filter(c => c.isVerified),
    [realCarriers]
  );

  const [activeTab, setActiveTab] = useState("overview");
  const [adminNote, setAdminNote] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<AdminLoad["status"]>("Active");
  const [selectedCarrierId, setSelectedCarrierId] = useState("");
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [customCommodity, setCustomCommodity] = useState("");
  
  // WebSocket connection for real-time updates from shipper edits
  useEffect(() => {
    if (user?.id && user?.role === "admin" && params.loadId) {
      connectMarketplace("admin", user.id);
      
      const unsubLoadUpdated = onMarketplaceEvent("load_updated", (data) => {
        // Check if this update is for the current load
        if (data.loadId === params.loadId || data.load?.id === params.loadId) {
          const eventType = data.event;
          let title = "Load Updated";
          let description = "This load has been updated";
          
          if (eventType === "load_edited") {
            title = "Shipper Edited Load";
            description = `The shipper has edited this load`;
          } else if (eventType === "load_available") {
            title = "Load Made Available";
            description = `This load is now available`;
          } else if (eventType === "load_unavailable") {
            title = "Load Made Unavailable";
            description = `This load is now unavailable`;
          }
          
          toast({ title, description });
          queryClient.invalidateQueries({ queryKey: ["/api/loads", params.loadId] });
          queryClient.invalidateQueries({ queryKey: ["/api/shipments/load", params.loadId] });
        }
      });
      
      return () => {
        unsubLoadUpdated();
        disconnectMarketplace();
      };
    }
  }, [user?.id, user?.role, params.loadId, toast]);
  
  // Helper functions for city-state auto-fill
  const getAllCities = () => {
    const cities: { name: string; stateName: string }[] = [];
    indianStates.forEach(state => {
      state.cities.forEach(city => {
        cities.push({ name: city.name, stateName: state.name });
      });
    });
    return cities;
  };
  
  const getCitiesForState = (stateName: string) => {
    const state = indianStates.find(s => s.name === stateName);
    return state?.cities || [];
  };
  
  const getStateForCity = (cityName: string) => {
    for (const state of indianStates) {
      if (state.cities.some(city => city.name === cityName)) {
        return state.name;
      }
    }
    return "";
  };
  
  const allCities = getAllCities();
  
  const loadId = params.loadId || "";
  
  const { data: apiLoad, isLoading: isApiLoading, error: apiError } = useQuery<LoadWithRelations>({
    queryKey: ["/api/loads", loadId],
    enabled: !!loadId,
  });

  // Fetch real bids from API for dual marketplace view
  const { data: apiBids } = useBidsByLoad(loadId);

  // Fetch documents for this load from the API (uses actual UUID, not display ID)
  const { data: apiLoadDocs = [], refetch: refetchLoadDocs } = useQuery<any[]>({
    queryKey: ["/api/loads", apiLoad?.id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/loads/${apiLoad!.id}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch load documents");
      return res.json();
    },
    enabled: !!apiLoad?.id,
  });

  // Fetch documents attached to the shipment (carrier trip docs, POD, LR, etc.)
  const { data: apiShipmentDocs = [], refetch: refetchShipmentDocs } = useQuery<any[]>({
    queryKey: ["/api/shipments", apiLoad?.shipmentDetails?.id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/shipments/${apiLoad!.shipmentDetails!.id}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch shipment documents");
      return res.json();
    },
    enabled: !!apiLoad?.shipmentDetails?.id,
  });

  // Merge and deduplicate load + shipment documents, mapped to the UI shape
  const allLoadDocuments = useMemo(() => {
    const merged: any[] = [...apiLoadDocs];
    apiShipmentDocs.forEach((doc: any) => {
      if (!merged.find((d) => d.id === doc.id)) merged.push(doc);
    });
    return merged.map((doc: any) => ({
      documentId: doc.id,
      name: doc.fileName,
      type: doc.documentType,
      uploadedBy: doc.userId === apiLoad?.shipperId
        ? (apiLoad?.shipperContactName || apiLoad?.shipperCompanyName || "Shipper")
        : doc.userId === apiLoad?.assignedCarrierId
          ? (apiLoad?.assignedCarrier?.username || "Carrier")
          : doc.userId,
      uploadedAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      fileUrl: doc.fileUrl,
      status: doc.isVerified === true ? "Approved" : doc.isVerified === false ? "Pending" : "Pending",
    }));
  }, [apiLoadDocs, apiShipmentDocs, apiLoad]);

  // Convert API bids to the LoadBidRecord format expected by the UI
  const apiBidsAsRecords = useMemo((): LoadBidRecord[] => {
    if (apiBids && apiBids.allBids && apiBids.allBids.length > 0) {
      return apiBids.allBids.map((bid: any) => ({
        bidId: bid.id,
        carrierId: bid.carrierId,
        carrierName: bid.carrier?.companyName || bid.carrier?.username || "Unknown Carrier",
        carrierType: (bid.carrierType || "enterprise") as "solo" | "enterprise",
        amount: parseFloat(bid.amount || "0"),
        status: (bid.status === "accepted" ? "Accepted" : 
                bid.status === "rejected" ? "Rejected" : 
                bid.status === "countered" ? "Countered" : "Pending") as LoadBidRecord["status"],
        submittedAt: bid.createdAt ? new Date(bid.createdAt) : new Date(),
        counterOffer: bid.counterAmount ? parseFloat(bid.counterAmount) : undefined,
        notes: bid.notes || undefined,
      }));
    }
    return [];
  }, [apiBids]);
  
  const detailedLoad = useMemo(() => {
    if (apiLoad) {
      // Use sequential shipperLoadNumber for consistent LD-XXX format across all portals
      const displayLoadId = `LD-${String(apiLoad.shipperLoadNumber || 0).padStart(3, '0')}`;
      return createDetailedLoadFromApi(apiLoad, displayLoadId);
    }
    return getDetailedLoad(loadId);
  }, [loadId, getDetailedLoad, apiLoad]);

  // Route distance: prefer `/api/distance/calculate` (road routing). Never show stored `loads.distance`.
  // While routing loads, show "Calculating…". If routing is unavailable, show a ~estimate from coords/cities only.
  const routeKmEstimate = computeRouteDistanceKmEstimate({
    pickupLat: apiLoad?.pickupLat,
    pickupLng: apiLoad?.pickupLng,
    dropoffLat: apiLoad?.dropoffLat,
    dropoffLng: apiLoad?.dropoffLng,
    pickupCity: apiLoad?.pickupCity ?? detailedLoad?.pickupCity,
    dropoffCity: apiLoad?.dropoffCity ?? detailedLoad?.dropoffCity,
  });

  const routeDistanceDisplayFallback = Number.isFinite(routeKmEstimate)
    ? `~${Math.round(routeKmEstimate)} km`
    : "N/A";

  const routeEtaStrFallback = (() => {
    if (Number.isFinite(routeKmEstimate)) {
      const hoursFromDistance = Math.ceil(routeKmEstimate / 50);
      return `${hoursFromDistance} hours`;
    }

    // Distance missing -> use schedule fallback.
    const pickupMs = apiLoad?.pickupDate ? new Date(apiLoad.pickupDate).getTime() : NaN;
    const deliveryMs = apiLoad?.deliveryDate ? new Date(apiLoad.deliveryDate).getTime() : NaN;
    const hoursFromSchedule =
      Number.isFinite(pickupMs) && Number.isFinite(deliveryMs)
        ? Math.ceil(Math.max(0, (deliveryMs - pickupMs) / 3600000))
        : NaN;

    return Number.isFinite(hoursFromSchedule) ? `${hoursFromSchedule} hours` : "N/A";
  })();

  const routePickupBusinessName = apiLoad?.pickupBusinessName ?? detailedLoad?.pickupBusinessName;
  const routePickupCity = apiLoad?.pickupCity ?? detailedLoad?.pickupCity;
  const routePickupPincode = apiLoad?.pickupPincode ?? detailedLoad?.pickupPincode;
  const routePickupLocality = apiLoad?.pickupLocality ?? detailedLoad?.pickupLocality;
  const routePickupAddress = apiLoad?.pickupAddress ?? detailedLoad?.pickupAddress;
  const routePickupLandmark = apiLoad?.pickupLandmark ?? detailedLoad?.pickupLandmark;

  const routeDropoffBusinessName = apiLoad?.dropoffBusinessName ?? detailedLoad?.dropoffBusinessName;
  const routeDropoffCity = apiLoad?.dropoffCity ?? detailedLoad?.dropoffCity;
  const routeDropoffPincode = apiLoad?.dropoffPincode ?? detailedLoad?.dropoffPincode;
  const routeDropoffLocality = apiLoad?.dropoffLocality ?? detailedLoad?.dropoffLocality;
  const routeDropoffAddress = apiLoad?.dropoffAddress ?? detailedLoad?.dropoffAddress;
  const routeDropoffLandmark = apiLoad?.dropoffLandmark ?? detailedLoad?.dropoffLandmark;

  type RouteMetricsResponse = {
    distance: number;
    duration: string;
    source?: string;
    originResolved?: string;
    destinationResolved?: string;
  };

  const routeOrigin = [apiLoad?.pickupAddress, apiLoad?.pickupLocality, apiLoad?.pickupCity, apiLoad?.pickupState, apiLoad?.pickupPincode]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(", ");
  const routeDestination = [apiLoad?.dropoffAddress, apiLoad?.dropoffLocality, apiLoad?.dropoffCity, apiLoad?.dropoffState, apiLoad?.dropoffPincode]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(", ");

  const {
    data: routeMetrics,
    isLoading: isRouteMetricsLoading,
  } = useQuery<RouteMetricsResponse>({
    queryKey: ["/api/distance/calculate", loadId, routeOrigin, routeDestination],
    enabled: routeOrigin.length >= 2 && routeDestination.length >= 2 && !!loadId,
    queryFn: async () => {
      const response = await fetch("/api/distance/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          origin: routeOrigin,
          destination: routeDestination,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Distance API failed (${response.status})`);
      }

      return response.json();
    },
  });

  function parseGoogleDurationToHours(duration: string): number | null {
    const d = duration.trim();

    const dayMatch = d.match(/(\d+)\s*day/);
    if (dayMatch) {
      const days = Number(dayMatch[1]);
      if (!Number.isFinite(days)) return null;
      // Keep parity with backend's `formatDuration()` assumption: 10 driving hours per day.
      return Math.ceil(days * 10);
    }

    const minsMatch = d.match(/(\d+)\s*mins?/);
    if (minsMatch) {
      const mins = Number(minsMatch[1]);
      if (!Number.isFinite(mins)) return null;
      return Math.ceil(mins / 60);
    }

    const hMatch = d.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/);
    if (hMatch) {
      const hours = Number(hMatch[1]);
      const mins = hMatch[2] != null ? Number(hMatch[2]) : 0;
      if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
      return Math.ceil(hours + mins / 60);
    }

    return null;
  }

  const routeMetricsEnabled =
    routeOrigin.length >= 2 && routeDestination.length >= 2 && !!loadId;

  const hasRoadDistance =
    routeMetrics != null &&
    Number.isFinite(routeMetrics.distance) &&
    routeMetrics.distance > 0;

  const routeDistanceDisplay = hasRoadDistance
    ? `${Math.round(routeMetrics!.distance)} km`
    : routeMetricsEnabled && isRouteMetricsLoading
      ? "Calculating…"
      : routeDistanceDisplayFallback;

  const routeEtaStr = (() => {
    if (routeMetrics?.duration) {
      const googleHours = parseGoogleDurationToHours(routeMetrics.duration);
      if (googleHours != null && Number.isFinite(googleHours) && googleHours >= 0) {
        return `${googleHours} hours`;
      }
    }
    if (routeMetricsEnabled && isRouteMetricsLoading) {
      return "Calculating…";
    }
    return routeEtaStrFallback;
  })();

  // Final bids array: prefer API bids, fallback to mock data
  const allBids = useMemo(() => {
    if (apiBidsAsRecords.length > 0) return apiBidsAsRecords;
    return detailedLoad?.bids || [];
  }, [apiBidsAsRecords, detailedLoad?.bids]);

  // Pre-computed filtered bid arrays for dual marketplace view
  const soloBidsFiltered = useMemo(() => allBids.filter(b => b.carrierType === "solo"), [allBids]);
  const enterpriseBidsFiltered = useMemo(() => allBids.filter(b => b.carrierType === "enterprise" || !b.carrierType), [allBids]);

  // Edit Load Form Schema
  const editLoadSchema = z.object({
    shipperContactName: z.string().optional(),
    shipperCompanyAddress: z.string().optional(),
    shipperPhone: z.string().optional(),
    pickupAddress: z.string().optional(),
    pickupLocality: z.string().optional(),
    pickupLandmark: z.string().optional(),
    pickupCity: z.string().min(1, "Pickup city is required"),
    pickupState: z.string().optional(),
    pickupPincode: z.string().optional(),
    dropoffAddress: z.string().optional(),
    dropoffLocality: z.string().optional(),
    dropoffLandmark: z.string().optional(),
    dropoffCity: z.string().min(1, "Dropoff city is required"),
    dropoffState: z.string().optional(),
    dropoffPincode: z.string().optional(),
    dropoffBusinessName: z.string().optional(),
    receiverName: z.string().min(1, "Receiver name is required"),
    receiverPhone: z.string().min(1, "Receiver phone is required"),
    receiverEmail: z.string().optional(),
    weight: z.string().optional(),
    goodsToBeCarried: z.string().optional(),
    specialNotes: z.string().optional(),
    pickupDate: z.string().optional(),
    deliveryDate: z.string().optional(),
  });
  
  type EditLoadFormData = z.infer<typeof editLoadSchema>;

  const editForm = useForm<EditLoadFormData>({
    resolver: zodResolver(editLoadSchema),
    defaultValues: {
      shipperContactName: "",
      shipperCompanyAddress: "",
      shipperPhone: "",
      pickupAddress: "",
      pickupLocality: "",
      pickupLandmark: "",
      pickupCity: "",
      pickupState: "",
      pickupPincode: "",
      dropoffAddress: "",
      dropoffLocality: "",
      dropoffLandmark: "",
      dropoffCity: "",
      dropoffState: "",
      dropoffPincode: "",
      dropoffBusinessName: "",
      receiverName: "",
      receiverPhone: "",
      receiverEmail: "",
      weight: "",
      goodsToBeCarried: "",
      specialNotes: "",
      pickupDate: "",
      deliveryDate: "",
    },
  });

  useEffect(() => {
    if (apiLoad && editSheetOpen) {
      // Extract city name from "City, State" format if needed
      const extractCityName = (cityValue: string | null) => {
        if (!cityValue) return "";
        const parts = cityValue.split(",");
        return parts[0].trim();
      };
      
      // Helper to normalize city names - case-insensitive match to predefined list
      const normalizeCity = (rawCity: string) => {
        if (!rawCity) return "";
        // Find matching city (case-insensitive) from indian locations
        for (const state of indianStates) {
          const cities = getCitiesByState(state.code) || [];
          const match = cities.find((c: { name: string }) => 
            c.name.toLowerCase() === rawCity.toLowerCase()
          );
          if (match) return match.name;
        }
        return rawCity;
      };
      
      // Helper to convert state code to full name
      const normalizeStateName = (stateValue: string | null) => {
        if (!stateValue) return "";
        // Check if it's already a full state name
        const directMatch = indianStates.find(s => s.name === stateValue);
        if (directMatch) return directMatch.name;
        // Check if it's a state code
        const codeMatch = indianStates.find(s => 
          s.code === stateValue || s.code === stateValue.toUpperCase()
        );
        if (codeMatch) return codeMatch.name;
        return stateValue;
      };
      
      // Try to find state from city if state is not set
      const findStateFromCity = (cityValue: string | null, existingState: string | null) => {
        // If we have an existing state, normalize it (convert code to name)
        if (existingState) return normalizeStateName(existingState);
        if (!cityValue) return "";
        
        const parts = cityValue.split(",");
        if (parts.length > 1) {
          const statePart = parts[1].trim();
          const matchedState = indianStates.find(s => 
            s.name === statePart || s.code === statePart || s.code === statePart.toUpperCase()
          );
          if (matchedState) return matchedState.name;
        }
        
        const cityName = parts[0].trim();
        return getStateForCity(cityName);
      };
      
      const rawPickupCity = extractCityName(apiLoad.pickupCity);
      const rawDropoffCity = extractCityName(apiLoad.dropoffCity);
      const pickupCityName = normalizeCity(rawPickupCity);
      const dropoffCityName = normalizeCity(rawDropoffCity);
      const pickupStateName = findStateFromCity(apiLoad.pickupCity, apiLoad.pickupState);
      const dropoffStateName = findStateFromCity(apiLoad.dropoffCity, apiLoad.dropoffState);
      
      console.log("[AdminEditLoad] Populating form with:", {
        originalPickupCity: apiLoad.pickupCity,
        originalPickupState: apiLoad.pickupState,
        rawPickupCity,
        normalizedPickupCity: pickupCityName,
        resolvedPickupState: pickupStateName,
        originalDropoffCity: apiLoad.dropoffCity,
        originalDropoffState: apiLoad.dropoffState,
        rawDropoffCity,
        normalizedDropoffCity: dropoffCityName,
        resolvedDropoffState: dropoffStateName,
      });
      
      // Convert goods label to value for the combobox
      const normalizeGoodsValue = (goods: string | null) => {
        if (!goods) return "";
        // First check if it's already a value
        const directMatch = allCommodities.find(c => c.value === goods);
        if (directMatch) return directMatch.value;
        // Check if it's a label and convert to value
        const labelMatch = allCommodities.find(c => 
          c.label.toLowerCase() === goods.toLowerCase()
        );
        if (labelMatch) return labelMatch.value;
        // If not found in list, it's a custom value
        setCustomCommodity(goods);
        return "other";
      };
      
      const goodsValue = normalizeGoodsValue(apiLoad.goodsToBeCarried);
      
      editForm.reset({
        shipperContactName: apiLoad.shipperContactName || "",
        shipperCompanyAddress: apiLoad.shipperCompanyAddress || "",
        shipperPhone: apiLoad.shipperPhone || "",
        pickupAddress: apiLoad.pickupAddress || "",
        pickupLocality: apiLoad.pickupLocality || "",
        pickupLandmark: apiLoad.pickupLandmark || "",
        pickupCity: pickupCityName,
        pickupState: pickupStateName,
        pickupPincode: apiLoad.pickupPincode || "",
        dropoffAddress: apiLoad.dropoffAddress || "",
        dropoffLocality: apiLoad.dropoffLocality || "",
        dropoffLandmark: apiLoad.dropoffLandmark || "",
        dropoffCity: dropoffCityName,
        dropoffState: dropoffStateName,
        dropoffPincode: apiLoad.dropoffPincode || "",
        dropoffBusinessName: apiLoad.dropoffBusinessName || "",
        receiverName: apiLoad.receiverName || "",
        receiverPhone: apiLoad.receiverPhone || "",
        receiverEmail: apiLoad.receiverEmail || "",
        weight: apiLoad.weight?.toString() || "",
        goodsToBeCarried: goodsValue,
        specialNotes: apiLoad.specialNotes || "",
        pickupDate: apiLoad.pickupDate ? new Date(apiLoad.pickupDate).toISOString() : "",
        deliveryDate: apiLoad.deliveryDate ? new Date(apiLoad.deliveryDate).toISOString() : "",
      });
    }
  }, [apiLoad, editSheetOpen, editForm]);

  const editMutation = useMutation({
    mutationFn: async (data: EditLoadFormData) => {
      const payload: Record<string, any> = {};
      
      // Only include fields that have values
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          payload[key] = value;
        }
      });
      
      // Format city with state for display
      if (data.pickupCity) {
        payload.pickupCity = data.pickupState ? `${data.pickupCity}, ${data.pickupState}` : data.pickupCity;
      }
      if (data.dropoffCity) {
        payload.dropoffCity = data.dropoffState ? `${data.dropoffCity}, ${data.dropoffState}` : data.dropoffCity;
      }
      
      // Convert goods value to label for storage, or use custom value
      // Update both materialType and goodsToBeCarried to keep them in sync
      if (data.goodsToBeCarried) {
        if (data.goodsToBeCarried === "other" && customCommodity) {
          payload.goodsToBeCarried = customCommodity;
          payload.materialType = customCommodity;
        } else {
          const goodsLabel = getCommodityLabel(data.goodsToBeCarried);
          payload.goodsToBeCarried = goodsLabel;
          payload.materialType = goodsLabel;
        }
      }
      
      return apiRequest("PATCH", `/api/loads/${loadId}`, payload);
    },
    onSuccess: () => {
      toast({ title: "Load updated", description: "The load details have been updated successfully." });
      // Invalidate ALL queries to ensure consistent view across all portals
      // This is the most reliable way to sync data immediately
      queryClient.invalidateQueries();
      setEditSheetOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditSubmit = (data: EditLoadFormData) => {
    editMutation.mutate(data);
  };

  // Mutation to toggle load availability
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ toStatus }: { toStatus: string }) => {
      return apiRequest("POST", `/api/loads/${loadId}/transition`, { 
        toStatus,
        reason: toStatus === 'unavailable' ? 'Marked unavailable by admin' : 'Restored to pending by admin'
      });
    },
    onSuccess: (_, variables) => {
      const isUnavailable = variables.toStatus === 'unavailable';
      toast({ 
        title: isUnavailable ? "Load marked unavailable" : "Load restored", 
        description: isUnavailable 
          ? "This load has been removed from the carrier marketplace." 
          : "This load has been restored to pending status. You can re-price and post it to carriers."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loads", loadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loads"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Handle availability toggle
  const handleToggleAvailability = () => {
    const currentStatus = apiLoad?.status;
    const toStatus = currentStatus === 'unavailable' ? 'pending' : 'unavailable';
    toggleAvailabilityMutation.mutate({ toStatus });
  };

  // Check if load can be marked unavailable (unassigned loads only, no carrier assigned)
  const canToggleAvailability = useMemo(() => {
    if (!apiLoad) return false;
    // Don't allow if a carrier has been assigned
    if (apiLoad.assignedCarrierId) return false;
    const unassignedStatuses = ['draft', 'pending', 'priced', 'posted_to_carriers', 'open_for_bid', 'counter_received', 'unavailable'];
    return unassignedStatuses.includes(apiLoad.status || '');
  }, [apiLoad]);

  const isCurrentlyUnavailable = apiLoad?.status === 'unavailable';
  
  function createDetailedLoadFromApi(load: LoadWithRelations, displayId: string): DetailedLoad {
    // Derive effective status from shipment (mirrors the list API's effectiveStatus logic exactly)
    let effectiveStatus = load.status;
    const sd = (load as any).shipmentDetails as { status?: string; endOtpVerified?: boolean; startOtpVerified?: boolean } | null;
    if (sd && load.assignedCarrierId && !["delivered", "closed", "in_transit"].includes(load.status || "")) {
      if (sd.endOtpVerified) {
        effectiveStatus = "delivered";
      } else if (sd.status === "in_transit" || sd.startOtpVerified) {
        effectiveStatus = "in_transit";
      }
    }

    const mapLoadStatus = (status: string | null): AdminLoad["status"] => {
      switch (status) {
        case "pending": return "Pending";
        case "submitted_to_admin": return "Pending";
        case "priced": return "Active";
        case "posted_to_carriers": return "Active";
        case "open_for_bid": return "Bidding";
        case "counter_received": return "Bidding";
        case "awarded": return "Assigned";
        case "invoice_created": return "Assigned";
        case "invoice_sent": return "Assigned";
        case "invoice_acknowledged": return "Assigned";
        case "invoice_approved": return "Assigned";
        case "invoice_negotiation": return "Assigned";
        case "invoice_paid": return "Assigned";
        case "in_transit": return "En Route";
        case "delivered": return "Delivered";
        case "closed": return "Delivered";
        case "cancelled": return "Cancelled";
        case "unavailable": return "Unavailable";
        default: return "Pending";
      }
    };
    
    return {
      loadId: displayId,
      shipperId: load.shipperId,
      shipperName: load.shipperCompanyName || load.shipperContactName || "Unknown Shipper",
      pickup: load.pickupCity,
      drop: load.dropoffCity,
      // Full pickup address details
      pickupAddress: load.pickupAddress || undefined,
      pickupLocality: load.pickupLocality || undefined,
      pickupLandmark: load.pickupLandmark || undefined,
      pickupBusinessName: load.pickupBusinessName || undefined,
      pickupCity: load.pickupCity || undefined,
      pickupPincode: load.pickupPincode || undefined,
      // Full dropoff address details
      dropoffAddress: load.dropoffAddress || undefined,
      dropoffLocality: load.dropoffLocality || undefined,
      dropoffLandmark: load.dropoffLandmark || undefined,
      dropoffBusinessName: load.dropoffBusinessName || undefined,
      dropoffCity: load.dropoffCity || undefined,
      dropoffPincode: load.dropoffPincode || undefined,
      weight: parseFloat(String(load.weight)) || 0,
      weightUnit: load.weightUnit || "kg",
      type: load.requiredTruckType || "Any",
      status: mapLoadStatus(effectiveStatus),
      assignedCarrier: null,
      carrierId: load.assignedCarrierId,
      createdDate: load.createdAt ? new Date(load.createdAt) : new Date(),
      eta: null,
      spending: parseFloat(String(load.adminFinalPrice || load.finalPrice || load.estimatedPrice || 0)),
      bidCount: 0,
      distance: parseFloat(String(load.distance || 0)),
      dimensions: "",
      priority: load.priority === "high" ? "High" : load.priority === "critical" ? "Critical" : "Normal",
      title: load.goodsToBeCarried,
      description: load.specialNotes || "",
      requiredTruckType: load.requiredTruckType,
      _originalId: load.id,
      shipperDetails: {
        shipperId: load.shipperId,
        name: load.shipperContactName || "Unknown",
        company: load.shipperCompanyName || "Unknown Company",
        phone: load.shipperPhone || "",
        email: load.shipper?.email || "",
        address: load.shipperCompanyAddress || "",
        isVerified: load.shipper?.isVerified || false,
        totalLoadsPosted: 0,
        rating: 4.5,
      },
      carrierDetails: load.assignedCarrier ? {
        carrierId: load.assignedCarrier.id,
        companyName: load.assignedCarrier.company || load.assignedCarrier.username,
        contactNumber: load.assignedCarrier.phone || "",
        verificationStatus: load.assignedCarrier.isVerified ? "verified" : "pending",
        rating: 4.5,
        fleetSize: 0,
      } : undefined,
      vehicleDetails: undefined,
      bids: [],
      negotiations: [],
      costBreakdown: {
        baseFreightCost: parseFloat(String(load.estimatedPrice || 0)),
        fuelSurcharge: 0,
        handlingFee: 0,
        platformFee: 0,
        totalCost: parseFloat(String(load.adminFinalPrice || load.finalPrice || load.estimatedPrice || 0)),
      },
      documents: [],
      activityLog: [],
      routeInfo: {
        pickupCoordinates: { lat: parseFloat(String(load.pickupLat || 0)), lng: parseFloat(String(load.pickupLng || 0)) },
        dropCoordinates: { lat: parseFloat(String(load.dropoffLat || 0)), lng: parseFloat(String(load.dropoffLng || 0)) },
        estimatedTime: "N/A",
        liveStatus: (() => {
          // Map directly from the badge status so route tab always matches
          const badgeStatus = mapLoadStatus(effectiveStatus);
          switch (badgeStatus) {
            case "Delivered":   return "Delivered" as const;
            case "En Route":    return "En Route" as const;
            case "Assigned":    return "At Pickup" as const;
            case "Bidding":     return "Pending Pickup" as const;
            default:            return "Pending Pickup" as const;
          }
        })(),
        checkpoints: [],
      },
    };
  }
  
  if (isApiLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Package className="h-16 w-16 text-muted-foreground mb-4 animate-pulse" />
        <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        <p className="text-muted-foreground">Fetching load details</p>
      </div>
    );
  }
  
  if (!detailedLoad) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Load Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested load could not be found.</p>
        <Button onClick={() => setLocation("/admin/loads")} data-testid="button-back-to-loads">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to All Loads
        </Button>
      </div>
    );
  }
  
  const load = detailedLoad;

  const handleUpdateStatus = () => {
    updateLoadStatus(loadId, selectedStatus);
    setIsStatusModalOpen(false);
    toast({
      title: "Status Updated",
      description: `Load status changed to ${selectedStatus}`,
    });
  };

  const handleReassignCarrier = async () => {
    const carrier = verifiedRealCarriers.find(c => c.id === selectedCarrierId);
    if (carrier) {
      try {
        const carrierPayout = apiLoad?.finalPrice || "0";
        const shipperGross = apiLoad?.adminFinalPrice || apiLoad?.adminSuggestedPrice || carrierPayout;

        await apiRequest("POST", "/api/admin/assign", {
          load_id: loadId,
          carrier_id: carrier.id,
          final_price: carrierPayout,
          gross_price: shipperGross,
        });

        queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loads", loadId] });
        queryClient.invalidateQueries({ queryKey: ["/api/carrier/my-orders"] });

        setIsReassignModalOpen(false);
        toast({
          title: "Carrier Assigned",
          description: `${carrier.companyName || carrier.username} has been assigned to this load`,
        });
      } catch (error: any) {
        toast({
          title: "Assignment Failed",
          description: error.message || "Could not assign carrier",
          variant: "destructive",
        });
      }
    }
  };

  const handleCancelLoad = async () => {
    const actualId = apiLoad?.id || loadId;
    try {
      await apiRequest("PATCH", `/api/loads/${actualId}`, { status: "cancelled" });
      cancelLoad(loadId);
      setIsCancelModalOpen(false);
      toast({
        title: "Load Cancelled",
        description: "This load has been cancelled",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loads", loadId] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel load";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleAddNote = () => {
    if (adminNote.trim()) {
      addAdminNote(loadId, adminNote);
      setAdminNote("");
      toast({
        title: "Note Added",
        description: "Admin note has been saved",
      });
    }
  };

  const handleSyncPortal = async () => {
    try {
      await refreshFromShipperPortal();
      toast({
        title: "Synced",
        description: "Data synchronized with Shipper Portal",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Sync failed";
      toast({
        title: "Sync failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      "Active":      "bg-cyan-600",
      "Bidding":     "bg-amber-600 text-white",
      "Assigned":    "bg-purple-600",
      "En Route":    "bg-blue-600",
      "Delivered":   "bg-green-600",
      "Cancelled":   "bg-red-600",
      "Pending":     "bg-gray-600",
      "Unavailable": "bg-slate-600",
    };
    const className = colorMap[status] ?? colorMap["Pending"];
    return <Badge className={className}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Critical": return <Badge variant="destructive">Critical</Badge>;
      case "High": return <Badge className="bg-amber-500 text-white">High Priority</Badge>;
      default: return <Badge variant="outline">Normal</Badge>;
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/admin/loads")}
            data-testid="button-back-to-loads"
            className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg md:text-2xl font-bold truncate" data-testid="text-load-id">{detailedLoad.loadId}</h1>
              {apiLoad?.pickupId && (
                <Badge variant="secondary" className="font-mono text-[10px] sm:text-xs shrink-0" data-testid="badge-pickup-id">
                  Pickup: {apiLoad.pickupId}
                </Badge>
              )}
              {getStatusBadge(detailedLoad.status)}
              {getPriorityBadge(detailedLoad.priority || "Normal")}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{detailedLoad.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button variant="outline" onClick={() => void handleSyncPortal()} data-testid="button-sync-portal" className="text-xs sm:text-sm h-8 sm:h-10">
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sync Portal</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="button-actions" className="text-xs sm:text-sm h-8 sm:h-10">
                Actions
                <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditSheetOpen(true)} data-testid="menu-edit-load">
                <Edit className="h-4 w-4 mr-2" />
                Edit Load
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsStatusModalOpen(true)} data-testid="menu-update-status">
                <RefreshCw className="h-4 w-4 mr-2" />
                Update Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsReassignModalOpen(true)} data-testid="menu-reassign-carrier">
                <UserPlus className="h-4 w-4 mr-2" />
                Reassign Carrier
              </DropdownMenuItem>
              {canToggleAvailability && (
                <DropdownMenuItem 
                  onClick={handleToggleAvailability}
                  disabled={toggleAvailabilityMutation.isPending}
                  data-testid="menu-toggle-availability"
                >
                  {isCurrentlyUnavailable ? (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Make Available
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Mark Unavailable
                    </>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setIsCancelModalOpen(true)} 
                className="text-destructive"
                data-testid="menu-cancel-load"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Load
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-4">
        <div className="relative -mx-3 sm:-mx-4 md:mx-0">
          <div className="overflow-x-auto scrollbar-hide px-3 sm:px-4 md:px-0">
            <TabsList className="inline-flex h-9 sm:h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full sm:min-w-0">
              <TabsTrigger value="overview" data-testid="tab-overview" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Overview</TabsTrigger>
              <TabsTrigger value="shipper" data-testid="tab-shipper" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Shipper</TabsTrigger>
              <TabsTrigger value="carrier" data-testid="tab-carrier" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Carrier</TabsTrigger>
              <TabsTrigger value="route" data-testid="tab-route" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Route</TabsTrigger>
              <TabsTrigger value="bids" data-testid="tab-bids" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Bids</TabsTrigger>
              <TabsTrigger value="costs" data-testid="tab-costs" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Costs</TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Documents</TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity" className="whitespace-nowrap shrink-0 text-xs sm:text-sm px-2 sm:px-3">Activity</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-3 sm:space-y-4">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                <CardTitle className="text-sm font-medium text-muted-foreground">Load Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium truncate ml-2">{detailedLoad.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium truncate ml-2">{detailedLoad.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{format(detailedLoad.createdDate, "dd MMM yyyy")}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Priority</span>
                  {getPriorityBadge(detailedLoad.priority || "Normal")}
                </div>
                {(apiLoad?.adminEmployeeCode || apiLoad?.adminEmployeeName) && (
                  <>
                    <div className="border-t pt-2 sm:pt-3 mt-2 sm:mt-3">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Posted by Admin</span>
                    </div>
                    {apiLoad?.adminEmployeeCode && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Employee Code</span>
                        <span className="font-medium">{apiLoad.adminEmployeeCode}</span>
                      </div>
                    )}
                    {apiLoad?.adminEmployeeName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Employee Name</span>
                        <span className="font-medium truncate ml-2">{apiLoad.adminEmployeeName}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                <CardTitle className="text-sm font-medium text-muted-foreground">Route Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-muted-foreground text-xs sm:text-sm">Pickup:</span>
                      {routePickupBusinessName && (
                        <div className="font-semibold text-primary text-sm truncate">{routePickupBusinessName}</div>
                      )}
                      <div className="font-medium text-sm">
                        {routePickupCity}
                        {routePickupPincode ? ` - ${routePickupPincode}` : ""}
                      </div>
                      {routePickupLocality && (
                        <div className="text-xs sm:text-sm text-muted-foreground truncate">{routePickupLocality}</div>
                      )}
                      {routePickupAddress && (
                        <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{routePickupAddress}</div>
                      )}
                      {routePickupLandmark && (
                        <div className="text-xs sm:text-sm text-muted-foreground truncate">Near: {routePickupLandmark}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                    <div>
                      <span className="text-muted-foreground text-sm">Dropoff:</span>
                      <div className="font-medium">
                        {routeDropoffCity}
                        {routeDropoffPincode ? ` - ${routeDropoffPincode}` : ""}
                      </div>
                      {routeDropoffBusinessName && (
                        <div className="text-sm font-medium">{routeDropoffBusinessName}</div>
                      )}
                      {routeDropoffLocality && (
                        <div className="text-sm text-muted-foreground">{routeDropoffLocality}</div>
                      )}
                      {routeDropoffAddress && (
                        <div className="text-sm text-muted-foreground">{routeDropoffAddress}</div>
                      )}
                      {routeDropoffLandmark && (
                        <div className="text-sm text-muted-foreground">Near: {routeDropoffLandmark}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Distance</span>
                  <span className="font-medium">{routeDistanceDisplay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ETA</span>
                  <span className="font-medium">{routeEtaStr}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Load Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Weight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Weight:</span>
                  <span className="font-medium">{detailedLoad.weight.toLocaleString()} {detailedLoad.weightUnit}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Dimensions:</span>
                  <span className="font-medium">{detailedLoad.dimensions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Truck Type</span>
                  <span className="font-medium">{detailedLoad.requiredTruckType}</span>
                </div>
              </CardContent>
            </Card>

            {/* Carrier Memo - Shows when carrier is assigned */}
            {(apiLoad?.assignedCarrier || apiLoad?.shipmentDetails) && (
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Carrier Memo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Carrier Name</span>
                    <span className="font-medium">{apiLoad?.assignedCarrier?.company || apiLoad?.assignedCarrier?.username || "Not assigned"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle Number</span>
                    <span className="font-medium font-mono">{apiLoad?.shipmentDetails?.truck?.licensePlate || "Not assigned"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Driver Name</span>
                    <span className="font-medium">{apiLoad?.shipmentDetails?.driver?.username || "Not assigned"}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {detailedLoad.description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{detailedLoad.description}</p>
                {detailedLoad.specialHandling && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-900">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Special Handling:</span>
                    </div>
                    <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">{detailedLoad.specialHandling}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Admin Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Textarea 
                  placeholder="Add a note about this load..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="flex-1"
                  data-testid="input-admin-note"
                />
                <Button onClick={handleAddNote} disabled={!adminNote.trim()} data-testid="button-add-note">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipper" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg truncate">{apiLoad?.shipperContactName || detailedLoad.shipperDetails.name}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm truncate">{apiLoad?.shipperCompanyName || detailedLoad.shipperDetails.company}</CardDescription>
                  </div>
                </div>
                {apiLoad?.shipper?.isVerified || detailedLoad.shipperDetails.isVerified ? (
                  <Badge className="bg-green-500 shrink-0 text-xs"><BadgeCheck className="h-3 w-3 mr-1" />Verified</Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-xs">Unverified</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-2 sm:gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{apiLoad?.shipperPhone || detailedLoad.shipperDetails.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{apiLoad?.shipper?.email || detailedLoad.shipperDetails.email}</span>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{apiLoad?.shipperCompanyAddress || detailedLoad.shipperDetails.address}</span>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Load ID</span>
                    <span className="font-medium font-mono" data-testid="text-shipper-load-id">
                      {`LD-${String(apiLoad?.shipperLoadNumber || 0).padStart(3, '0')}`}
                    </span>
                  </div>
                  {apiLoad?.pickupId && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Pickup ID</span>
                      <Badge variant="outline" className="font-mono text-xs" data-testid="text-pickup-id">
                        {apiLoad.pickupId}
                      </Badge>
                    </div>
                  )}
                  {apiLoad?.shipper?.isVerified !== undefined && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Shipper Status</span>
                      <Badge variant={apiLoad.shipper.isVerified ? "default" : "outline"} className="text-xs">
                        {apiLoad.shipper.isVerified ? "Verified" : "Pending"}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" data-testid="button-call-shipper" className="text-xs sm:text-sm h-8 sm:h-10 flex-1 sm:flex-none">
                  <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Call Shipper</span>
                  <span className="sm:hidden">Call</span>
                </Button>
                <Button variant="outline" data-testid="button-email-shipper" className="text-xs sm:text-sm h-8 sm:h-10 flex-1 sm:flex-none">
                  <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Email Shipper</span>
                  <span className="sm:hidden">Email</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const shipperId = apiLoad?.shipperId || apiLoad?.shipper?.id;
                    if (shipperId) {
                      setLocation(`/admin/users/${shipperId}`);
                    } else {
                      setLocation(`/admin/users`);
                    }
                  }} 
                  data-testid="button-view-profile"
                  className="text-xs sm:text-sm h-8 sm:h-10 flex-1 sm:flex-none"
                >
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">View Profile</span>
                  <span className="sm:hidden">Profile</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="carrier" className="space-y-3 sm:space-y-4">
          {(apiLoad?.assignedCarrier || detailedLoad.carrierDetails) ? (
            <>
              <Card>
                <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Truck className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle>{apiLoad?.assignedCarrier?.company || detailedLoad.carrierDetails?.companyName || "Assigned Carrier"}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          Assigned Carrier
                          {apiLoad?.carrierOnboarding?.carrierType && (
                            <Badge variant="outline" className="text-xs">
                              {apiLoad.carrierOnboarding.carrierType === "solo" ? "Solo Operator" : "Enterprise Fleet"}
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={(apiLoad?.assignedCarrier?.isVerified || detailedLoad.carrierDetails?.verificationStatus === "verified") ? "bg-green-500" : ""}>
                      {apiLoad?.assignedCarrier?.isVerified ? "verified" : (detailedLoad.carrierDetails?.verificationStatus || "pending")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{apiLoad?.assignedCarrier?.phone || detailedLoad.carrierDetails?.contactNumber || "Not available"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{apiLoad?.assignedCarrier?.email || "Not available"}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {apiLoad?.assignedCarrier?.username && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Contact Name</span>
                          <span className="font-medium">{apiLoad.assignedCarrier.username}</span>
                        </div>
                      )}
                      {(apiLoad?.carrierOnboarding?.fleetSize || detailedLoad.carrierDetails?.fleetSize) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fleet Size</span>
                          <span className="font-medium">{apiLoad?.carrierOnboarding?.fleetSize || detailedLoad.carrierDetails?.fleetSize} vehicles</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>


              {apiLoad?.shipmentDetails?.truck && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5 text-primary" />
                      Truck Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">License Plate</span>
                          <span className="font-medium font-mono">{apiLoad.shipmentDetails.truck.licensePlate}</span>
                        </div>
                        {apiLoad.shipmentDetails.truck.manufacturer && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Manufacturer</span>
                            <span className="font-medium">{apiLoad.shipmentDetails.truck.manufacturer}</span>
                          </div>
                        )}
                        {apiLoad.shipmentDetails.truck.model && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Model</span>
                            <span className="font-medium">{apiLoad.shipmentDetails.truck.model}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {apiLoad.shipmentDetails.truck.truckType && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Truck Type</span>
                            <span className="font-medium">{apiLoad.shipmentDetails.truck.truckType}</span>
                          </div>
                        )}
                        {apiLoad.shipmentDetails.truck.capacity && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Capacity</span>
                            <span className="font-medium">{apiLoad.shipmentDetails.truck.capacity} tons</span>
                          </div>
                        )}
                        {apiLoad.shipmentDetails.truck.registrationNumber && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Registration No.</span>
                            <span className="font-medium font-mono">{apiLoad.shipmentDetails.truck.registrationNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Only show Driver Details for enterprise/fleet carriers (not solo - they are already shown as the carrier) */}
              {apiLoad?.shipmentDetails?.driver && apiLoad?.carrierOnboarding?.carrierType !== "solo" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Driver Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Driver Name</span>
                          <span className="font-medium">{apiLoad.shipmentDetails.driver.username}</span>
                        </div>
                        {apiLoad.shipmentDetails.driver.phone && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Phone</span>
                            <span className="font-medium">{apiLoad.shipmentDetails.driver.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span className="font-medium">{apiLoad.shipmentDetails.driver.email}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!apiLoad?.shipmentDetails?.truck && !apiLoad?.shipmentDetails?.driver && detailedLoad.vehicleDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Assigned Vehicle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Truck Type</span>
                          <span className="font-medium">{detailedLoad.vehicleDetails.truckType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Vehicle Number</span>
                          <span className="font-medium font-mono">{detailedLoad.vehicleDetails.vehicleNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Capacity</span>
                          <span className="font-medium">{detailedLoad.vehicleDetails.capacity} tons</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Driver Name</span>
                          <span className="font-medium">{detailedLoad.vehicleDetails.driverName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Driver Phone</span>
                          <span className="font-medium">{detailedLoad.vehicleDetails.driverPhone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">License</span>
                          <span className="font-medium font-mono text-sm">{detailedLoad.vehicleDetails.driverLicense}</span>
                        </div>
                      </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="flex gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm text-muted-foreground">RC Status:</span>
                        <Badge variant={detailedLoad.vehicleDetails.rcStatus === "Valid" ? "default" : "destructive"}>
                          {detailedLoad.vehicleDetails.rcStatus}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm text-muted-foreground">Insurance:</span>
                        <Badge variant={detailedLoad.vehicleDetails.insuranceStatus === "Valid" ? "default" : "destructive"}>
                          {detailedLoad.vehicleDetails.insuranceStatus}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!apiLoad?.shipmentDetails?.truck && !apiLoad?.shipmentDetails?.driver && !detailedLoad.vehicleDetails && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No truck or driver assigned yet</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Carrier Assigned</h3>
                <p className="text-muted-foreground mb-4">This load has not been assigned to a carrier yet.</p>
                <Button onClick={() => setIsReassignModalOpen(true)} data-testid="button-assign-carrier">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Carrier
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Recommended Carriers Section */}
          <RecommendedCarriersSection loadId={loadId} />
        </TabsContent>

        <TabsContent value="route" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Route Tracking</CardTitle>
              <CardDescription>Live status and route information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Navigation className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Live Status</p>
                    <p className="text-sm text-muted-foreground">{detailedLoad.status}</p>
                  </div>
                </div>
                <Badge className="text-lg py-1 px-3">{routeEtaStr}</Badge>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                {detailedLoad.routeInfo.checkpoints.map((checkpoint, idx) => (
                  <div key={idx} className="relative flex items-start gap-4 pb-6 last:pb-0">
                    <div className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center ${
                      checkpoint.status === "passed" ? "bg-green-500 text-white" :
                      checkpoint.status === "current" ? "bg-primary text-primary-foreground animate-pulse" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {checkpoint.status === "passed" ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : checkpoint.status === "current" ? (
                        <CircleDot className="h-4 w-4" />
                      ) : (
                        <span className="text-xs">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-medium">{checkpoint.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {checkpoint.status === "passed" ? "Completed" : 
                         checkpoint.status === "current" ? "Current Location" : "Upcoming"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2 pt-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Distance</p>
                  <p className="text-2xl font-bold">{routeDistanceDisplay}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Estimated Time</p>
                  <p className="text-2xl font-bold">{routeEtaStr}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bids" className="space-y-3 sm:space-y-4">
          {/* Dual Marketplace Summary Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                <CardTitle className="text-sm font-medium">Total Bids</CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="text-xl sm:text-2xl font-bold" data-testid="text-total-bids">{allBids.length}</div>
                <p className="text-xs text-muted-foreground">From all carriers</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <CardTitle className="text-sm font-medium">Solo Driver Bids</CardTitle>
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700 text-xs">Solo</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="text-xl sm:text-2xl font-bold" data-testid="text-solo-bids">{soloBidsFiltered.length}</div>
                {soloBidsFiltered.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    Lowest: {formatCurrency(Math.min(...soloBidsFiltered.map(b => b.amount)))}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <CardTitle className="text-sm font-medium">Enterprise Bids</CardTitle>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700 text-xs">Enterprise</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="text-xl sm:text-2xl font-bold" data-testid="text-enterprise-bids">{enterpriseBidsFiltered.length}</div>
                {enterpriseBidsFiltered.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    Lowest: {formatCurrency(Math.min(...enterpriseBidsFiltered.map(b => b.amount)))}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Dual Marketplace Comparison View */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Solo Driver Marketplace */}
            <Card className="border-orange-200 dark:border-orange-800 min-w-0 overflow-hidden">
              <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                    <CardTitle className="text-base sm:text-lg">Solo Driver Marketplace</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700 text-[10px] sm:text-xs">
                    {soloBidsFiltered.length} bids
                  </Badge>
                </div>
                <CardDescription className="text-xs sm:text-sm">Owner-operators with single trucks</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                {soloBidsFiltered.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No solo driver bids yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="overflow-y-auto max-h-[250px]">
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Driver</TableHead>
                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Amount</TableHead>
                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Status</TableHead>
                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Submitted</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {soloBidsFiltered
                            .sort((a, b) => a.amount - b.amount)
                            .map((bid) => (
                              <TableRow 
                                key={bid.bidId} 
                                data-testid={`row-solo-bid-${bid.bidId}`}
                                className="cursor-pointer hover-elevate"
                                onClick={() => setLocation(`/admin/negotiations?bidId=${bid.bidId}`)}
                              >
                                <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">{bid.carrierName}</TableCell>
                                <TableCell className="font-semibold text-xs sm:text-sm whitespace-nowrap">{formatCurrency(bid.amount)}</TableCell>
                                <TableCell>
                                  <Badge className="text-[10px] sm:text-xs" variant={
                                    bid.status === "Accepted" ? "default" :
                                    bid.status === "Rejected" ? "destructive" :
                                    "outline"
                                  }>
                                    {bid.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs sm:text-sm whitespace-nowrap">{format(bid.submittedAt, "dd MMM, HH:mm")}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enterprise Carrier Marketplace */}
            <Card className="border-blue-200 dark:border-blue-800 min-w-0 overflow-hidden">
              <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    <CardTitle className="text-base sm:text-lg">Enterprise Marketplace</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700 text-[10px] sm:text-xs">
                    {enterpriseBidsFiltered.length} bids
                  </Badge>
                </div>
                <CardDescription className="text-xs sm:text-sm">Fleet operators with multiple trucks</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                {enterpriseBidsFiltered.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No enterprise bids yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="overflow-y-auto max-h-[250px]">
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Company</TableHead>
                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Amount</TableHead>
                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Status</TableHead>
                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Submitted</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enterpriseBidsFiltered
                            .sort((a, b) => a.amount - b.amount)
                            .map((bid) => (
                              <TableRow 
                                key={bid.bidId} 
                                data-testid={`row-enterprise-bid-${bid.bidId}`}
                                className="cursor-pointer hover-elevate"
                                onClick={() => setLocation(`/admin/negotiations?bidId=${bid.bidId}`)}
                              >
                                <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">{bid.carrierName}</TableCell>
                                <TableCell className="font-semibold text-xs sm:text-sm whitespace-nowrap">{formatCurrency(bid.amount)}</TableCell>
                                <TableCell>
                                  <Badge className="text-[10px] sm:text-xs" variant={
                                    bid.status === "Accepted" ? "default" :
                                    bid.status === "Rejected" ? "destructive" :
                                    "outline"
                                  }>
                                    {bid.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs sm:text-sm whitespace-nowrap">{format(bid.submittedAt, "dd MMM, HH:mm")}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Combined Bid History Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Bids - Combined View</CardTitle>
                  <CardDescription>Complete bid history from both marketplaces</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allBids.map((bid) => (
                    <TableRow 
                      key={bid.bidId} 
                      data-testid={`row-bid-${bid.bidId}`}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setLocation(`/admin/negotiations?bidId=${bid.bidId}`)}
                    >
                      <TableCell className="font-medium">{bid.carrierName}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={bid.carrierType === "solo" 
                            ? "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700" 
                            : "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700"
                          }
                          data-testid={`badge-carrier-type-${bid.bidId}`}
                        >
                          {bid.carrierType === "solo" ? "Solo" : "Enterprise"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(bid.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          bid.status === "Accepted" ? "default" :
                          bid.status === "Rejected" ? "destructive" :
                          "outline"
                        }>
                          {bid.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(bid.submittedAt, "dd MMM, HH:mm")}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{bid.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {detailedLoad.negotiations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Negotiation Chat Log</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    {detailedLoad.negotiations.map((msg) => (
                      <div key={msg.messageId} className={`flex ${msg.senderType === "shipper" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] p-3 rounded-lg ${
                          msg.senderType === "shipper" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted"
                        }`}>
                          <p className="text-xs font-medium mb-1 opacity-70">{msg.senderName}</p>
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-50 mt-1">{format(msg.timestamp, "HH:mm")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="costs" className="space-y-3 sm:space-y-4">
          {/* Shipper's Pricing Preference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Shipper's Pricing Preference
              </CardTitle>
              <CardDescription>Original pricing submitted by shipper</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground text-sm">Rate Type</span>
                    <p className="font-medium">
                      {apiLoad?.rateType === "fixed_price" ? "Fixed Price" : "Per Tonne Rate"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-sm">Shipper's Preferred Advance</span>
                    <p className="font-medium text-orange-600">{apiLoad?.advancePaymentPercent || 0}%</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {apiLoad?.rateType === "per_ton" && apiLoad?.shipperPricePerTon && (
                    <div>
                      <span className="text-muted-foreground text-sm">Shipper's Rate (Per Tonne)</span>
                      <p className="font-medium text-blue-600">{formatCurrency(parseFloat(apiLoad.shipperPricePerTon))} / tonne</p>
                    </div>
                  )}
                  {apiLoad?.rateType === "fixed_price" && apiLoad?.shipperFixedPrice && (
                    <div>
                      <span className="text-muted-foreground text-sm">Shipper's Fixed Price</span>
                      <p className="font-medium text-blue-600">{formatCurrency(parseFloat(apiLoad.shipperFixedPrice))}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground text-sm">Cargo Weight</span>
                    <p className="font-medium">{apiLoad?.weight || "N/A"} {apiLoad?.weightUnit || "MT"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Pricing */}
          {apiLoad?.adminFinalPrice && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Admin Pricing (Posted to Marketplace)
                </CardTitle>
                <CardDescription>Price set by admin for carrier marketplace</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <span className="text-muted-foreground text-sm">Gross Price (Invoice to Shipper)</span>
                      <p className="font-medium text-lg text-green-600">{formatCurrency(parseFloat(apiLoad.adminFinalPrice))}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">Carrier Advance</span>
                      <p className="font-medium">{apiLoad.carrierAdvancePercent || 0}%</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-muted-foreground text-sm">Post Mode</span>
                      <p className="font-medium capitalize">{apiLoad.adminPostMode || "Open"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">Allow Counter Bids</span>
                      <p className="font-medium">{apiLoad.allowCounterBids ? "Yes" : "No"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Carrier Bid/Negotiation */}
          {(() => {
            const acceptedBid = apiLoad?.bids?.find((b: any) => b.status === "accepted");
            if (!acceptedBid) return null;
            
            const bidAmount = parseFloat(acceptedBid.amount || "0");
            const counterAmount = acceptedBid.counterAmount ? parseFloat(acceptedBid.counterAmount) : null;
            const adminPrice = parseFloat(apiLoad?.adminFinalPrice || "0");
            const platformMargin = adminPrice - (counterAmount || bidAmount);
            const marginPercent = adminPrice > 0 ? ((platformMargin / adminPrice) * 100).toFixed(1) : "0";
            
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Carrier Bid & Negotiation
                  </CardTitle>
                  <CardDescription>Winning bid details from {acceptedBid.carrierType === "solo" ? "Solo Carrier" : "Enterprise Fleet"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <span className="text-muted-foreground text-sm">Initial Bid Amount</span>
                        <p className="font-medium">{formatCurrency(bidAmount)}</p>
                      </div>
                      {counterAmount && counterAmount !== bidAmount && (
                        <div>
                          <span className="text-muted-foreground text-sm">Counter/Negotiated Amount</span>
                          <p className="font-medium text-blue-600">{formatCurrency(counterAmount)}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground text-sm">Bid Type</span>
                        <p className="font-medium capitalize">{acceptedBid.bidType || "Direct"}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-muted-foreground text-sm">Final Carrier Payment</span>
                        <p className="font-medium text-lg text-green-600">{formatCurrency(counterAmount || bidAmount)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-sm">Carrier Advance ({apiLoad?.carrierAdvancePercent || 0}%)</span>
                        <p className="font-medium text-orange-600">
                          {formatCurrency((counterAmount || bidAmount) * (apiLoad?.carrierAdvancePercent || 0) / 100)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Financial Summary
              </CardTitle>
              <CardDescription>Overall cost breakdown for this shipment</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const acceptedBid = apiLoad?.bids?.find((b: any) => b.status === "accepted");
                const carrierPayment = acceptedBid ? parseFloat(acceptedBid.counterAmount || acceptedBid.amount || "0") : 0;
                const adminPrice = parseFloat(apiLoad?.adminFinalPrice || "0");
                const shipperPrice = apiLoad?.rateType === "fixed_price" 
                  ? parseFloat(apiLoad?.shipperFixedPrice || "0")
                  : parseFloat(apiLoad?.shipperPricePerTon || "0") * parseFloat(apiLoad?.weight || "0");
                const platformMargin = adminPrice - carrierPayment;
                const marginPercent = adminPrice > 0 ? ((platformMargin / adminPrice) * 100).toFixed(1) : "0";
                
                return (
                  <div className="space-y-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Shipper's Original Offer</span>
                      <span className="font-medium">{shipperPrice > 0 ? formatCurrency(shipperPrice) : "Not specified"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Admin Posted Price (Gross)</span>
                      <span className="font-medium">{adminPrice > 0 ? formatCurrency(adminPrice) : "Not priced yet"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Carrier Payment</span>
                      <span className="font-medium">{carrierPayment > 0 ? formatCurrency(carrierPayment) : "No accepted bid"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Platform Margin ({marginPercent}%)</span>
                      <span className="font-medium text-primary">{platformMargin > 0 ? formatCurrency(platformMargin) : "Rs. 0"}</span>
                    </div>
                    <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-3">
                      <span className="font-semibold">Invoice Total</span>
                      <span className="font-bold text-lg text-green-600">{adminPrice > 0 ? formatCurrency(adminPrice) : "Pending"}</span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>{allLoadDocuments.length} documents uploaded</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allLoadDocuments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLoadDocuments.map((doc) => (
                      <TableRow key={doc.documentId}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{doc.type}</Badge></TableCell>
                        <TableCell>{doc.uploadedBy}</TableCell>
                        <TableCell>{format(doc.uploadedAt, "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={
                            doc.status === "Approved" ? "default" :
                            doc.status === "Rejected" ? "destructive" :
                            "outline"
                          }>
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-view-doc-${doc.documentId}`}
                              onClick={() => {
                                const url = getDocumentUrl(doc.fileUrl);
                                if (url) window.open(url, "_blank");
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-download-doc-${doc.documentId}`}
                              onClick={() => {
                                const url = getDocumentUrl(doc.fileUrl);
                                if (url) {
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = doc.name || "document";
                                  a.click();
                                }
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Documents</h3>
                  <p className="text-muted-foreground">No documents have been uploaded for this load yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Complete audit trail for this load</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                {detailedLoad.activityLog.map((event, idx) => (
                  <div key={event.eventId} className="relative flex items-start gap-4 pb-6 last:pb-0">
                    <div className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center ${
                      event.type === "delivered" ? "bg-green-500 text-white" :
                      event.type === "carrier_assigned" ? "bg-blue-500 text-white" :
                      event.type === "created" ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-medium">{event.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{format(event.timestamp, "dd MMM yyyy, HH:mm")}</span>
                        {event.userName && (
                          <>
                            <span>by</span>
                            <span className="font-medium">{event.userName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Load Status</DialogTitle>
            <DialogDescription>Change the status of this load</DialogDescription>
          </DialogHeader>
          <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as AdminLoad["status"])}>
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Bidding">Bidding</SelectItem>
              <SelectItem value="Assigned">Assigned</SelectItem>
              <SelectItem value="En Route">En Route</SelectItem>
              <SelectItem value="Delivered">Delivered</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} data-testid="button-confirm-status">Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReassignModalOpen} onOpenChange={setIsReassignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Carrier</DialogTitle>
            <DialogDescription>Select a new carrier for this load</DialogDescription>
          </DialogHeader>
          <Select value={selectedCarrierId} onValueChange={setSelectedCarrierId}>
            <SelectTrigger data-testid="select-carrier">
              <SelectValue placeholder="Select a carrier" />
            </SelectTrigger>
            <SelectContent>
              {verifiedRealCarriers.map((carrier) => (
                <SelectItem key={carrier.id} value={carrier.id}>
                  <div className="flex items-center gap-2">
                    <span>{carrier.companyName || carrier.username}</span>
                    <Badge variant={carrier.profile?.carrierType === "solo" ? "secondary" : "outline"} className="text-[9px] px-1 py-0">
                      {carrier.profile?.carrierType === "solo" ? "Solo" : "Fleet"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">({carrier.profile?.totalDeliveries || 0} loads)</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReassignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleReassignCarrier} disabled={!selectedCarrierId} data-testid="button-confirm-reassign">
              Assign Carrier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Load</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this load? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Keep Load</Button>
            <Button variant="destructive" onClick={handleCancelLoad} data-testid="button-confirm-cancel">
              Cancel Load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Load Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent
          className="w-full sm:max-w-lg p-4 overflow-y-auto"
          data-testid="sheet-edit-load"
          onPointerDownOutside={(e) => {
            // Prevent Sheet from closing when clicking MUI DateTimePicker popup
            const target = e.target as HTMLElement;
            if (target.closest(".MuiPickersPopper-root") || target.closest(".MuiDateTimePickerToolbar-root") || target.closest(".MuiPickersLayout-root")) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest(".MuiPickersPopper-root") || target.closest(".MuiPickersLayout-root")) {
              e.preventDefault();
            }
          }}
        >
          <SheetHeader>
            <SheetTitle>Edit Load Details</SheetTitle>
            <SheetDescription>
              Update load information. Changes will sync across all portals.
            </SheetDescription>
          </SheetHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-6 mt-6">
              {/* Shipper Contact Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Shipper Contact</h4>
                <FormField
                  control={editForm.control}
                  name="shipperContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-shipper-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="shipperPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-shipper-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="shipperCompanyAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Address</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-shipper-company-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Pickup Location */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Pickup Location</h4>
                <FormField
                  control={editForm.control}
                  name="pickupAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-pickup-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="pickupLocality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Locality</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-pickup-locality" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="pickupLandmark"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Landmark</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-pickup-landmark" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="pickupCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            const state = getStateForCity(value);
                            if (state) {
                              editForm.setValue("pickupState", state);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-pickup-city">
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(editForm.watch("pickupState") 
                              ? getCitiesForState(editForm.watch("pickupState") || "")
                              : allCities
                            ).map((city) => (
                              <SelectItem 
                                key={typeof city === 'string' ? city : city.name} 
                                value={typeof city === 'string' ? city : city.name}
                              >
                                {typeof city === 'string' ? city : city.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="pickupState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Clear city if it doesn't belong to new state
                            const currentCity = editForm.getValues("pickupCity");
                            if (currentCity && getStateForCity(currentCity) !== value) {
                              editForm.setValue("pickupCity", "");
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-pickup-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {indianStates.map((state) => (
                              <SelectItem key={state.name} value={state.name}>
                                {state.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="pickupPincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-pickup-pincode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Dropoff Location */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Dropoff Location</h4>
                <FormField
                  control={editForm.control}
                  name="dropoffAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-dropoff-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="dropoffLocality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Locality</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-dropoff-locality" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="dropoffLandmark"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Landmark</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-dropoff-landmark" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="dropoffCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            const state = getStateForCity(value);
                            if (state) {
                              editForm.setValue("dropoffState", state);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-dropoff-city">
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(editForm.watch("dropoffState") 
                              ? getCitiesForState(editForm.watch("dropoffState") || "")
                              : allCities
                            ).map((city) => (
                              <SelectItem 
                                key={typeof city === 'string' ? city : city.name} 
                                value={typeof city === 'string' ? city : city.name}
                              >
                                {typeof city === 'string' ? city : city.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="dropoffState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Clear city if it doesn't belong to new state
                            const currentCity = editForm.getValues("dropoffCity");
                            if (currentCity && getStateForCity(currentCity) !== value) {
                              editForm.setValue("dropoffCity", "");
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-dropoff-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {indianStates.map((state) => (
                              <SelectItem key={state.name} value={state.name}>
                                {state.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="dropoffPincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-dropoff-pincode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="dropoffBusinessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-dropoff-business-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Receiver Details */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Receiver Details</h4>
                <FormField
                  control={editForm.control}
                  name="receiverName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-receiver-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="receiverPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-receiver-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="receiverEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" data-testid="input-receiver-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Cargo Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Cargo Information</h4>
                <FormField
                  control={editForm.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (tons)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" data-testid="input-weight" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="goodsToBeCarried"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Goods to be Carried</FormLabel>
                      <CommodityCombobox 
                        value={field.value}
                        onChange={field.onChange}
                        customValue={customCommodity}
                        onCustomChange={setCustomCommodity}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="specialNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-special-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Schedule */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Schedule</h4>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="pickupDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup Date</FormLabel>
                        <FormControl>
                          <AppDateTimePicker
                            value={field.value}
                            onChange={field.onChange}
                            insideOverlay
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="deliveryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Date</FormLabel>
                        <FormControl>
                          <AppDateTimePicker
                            value={field.value}
                            onChange={field.onChange}
                            insideOverlay
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditSheetOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editMutation.isPending} data-testid="button-save-edit">
                  {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}