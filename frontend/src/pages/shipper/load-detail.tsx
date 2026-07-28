import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { connectMarketplace, disconnectMarketplace, onMarketplaceEvent } from "@/lib/marketplace-socket";
import { useAuth } from "@/lib/auth-context";
import { 
  ChevronLeft, MapPin, Calendar, 
  Users, Copy, X, CheckCircle, AlertCircle, Star, FileText, Loader2,
  Building2, User as UserIcon, Phone, IndianRupee, Package, Truck, StickyNote,
  Mail, Landmark, Navigation, Percent, Receipt, EyeOff, MessageCircle, Pencil, Save, Sparkles,
  Check, ChevronsUpDown
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppDateTimePicker } from "@/components/ui/date-time-picker";import type { Load, Shipment, User } from "@shared/schema";
import { indianStates } from "@shared/indian-locations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const editLoadSchema = z.object({
  shipperCompanyName: z.string().optional(),
  shipperContactName: z.string().optional(),
  shipperCompanyAddress: z.string().optional(),
  shipperPhone: z.string().optional(),
  pickupBusinessName: z.string().optional(),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  pickupLocality: z.string().optional(),
  pickupLandmark: z.string().optional(),
  pickupCity: z.string().min(1, "Pickup city is required"),
  pickupState: z.string().optional(),
  pickupPincode: z.string().optional(),
  dropoffBusinessName: z.string().optional(),
  dropoffAddress: z.string().min(1, "Dropoff address is required"),
  dropoffLocality: z.string().optional(),
  dropoffLandmark: z.string().optional(),
  dropoffCity: z.string().min(1, "Dropoff city is required"),
  dropoffState: z.string().optional(),
  dropoffPincode: z.string().optional(),
  receiverName: z.string().min(1, "Receiver name is required"),
  receiverPhone: z.string().min(1, "Receiver phone is required"),
  receiverEmail: z.string().optional(),
  weight: z.string().optional(),
  weightUnit: z.string().default("tons"),
  requiredTruckType: z.string().optional(),
  goodsToBeCarried: z.string().optional(),
  specialNotes: z.string().optional(),
  pickupDate: z.string().optional(),
  deliveryDate: z.string().optional(),
});

type EditLoadFormData = z.infer<typeof editLoadSchema>;

function getStatusColor(status: string | null) {
  switch (status) {
    case "pending": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "priced": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "posted_to_carriers": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "open_for_bid": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "counter_received": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "awarded": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "invoice_created":
    case "invoice_sent":
    case "invoice_acknowledged":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "invoice_paid": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "in_transit": return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
    case "delivered": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "closed": return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    case "cancelled": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "unavailable": return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case "pending": return "Pending Admin Review";
    case "priced": return "Priced";
    case "posted_to_carriers": return "Posted to Carriers";
    case "open_for_bid": return "Open for Bidding";
    case "counter_received": return "Negotiation Active";
    case "awarded": return "Carrier Finalized";
    case "invoice_created": return "Invoice Created";
    case "invoice_sent": return "Invoice Sent";
    case "invoice_acknowledged": return "Invoice Acknowledged";
    case "invoice_paid": return "Paid";
    case "in_transit": return "In Transit";
    case "delivered": return "Delivered";
    case "closed": return "Completed";
    case "cancelled": return "Cancelled";
    case "unavailable": return "Unavailable";
    default: return status || "Unknown";
  }
}

function formatDate(date: Date | string | null) {
  if (!date) return "TBD";
  return new Date(date).toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTimeAgo(date: Date | string | null) {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const commodityCodeToLabel: Record<string, string> = {
  rice: "Rice / Paddy", wheat: "Wheat", pulses: "Pulses / Daal", sugar: "Sugar",
  jaggery: "Jaggery (Gud)", spices: "Spices", tea: "Tea", coffee: "Coffee",
  edible_oil: "Edible Oil", fruits: "Fruits", vegetables: "Vegetables",
  dairy: "Dairy Products", frozen_food: "Frozen Food", beverages: "Beverages",
  packaged_food: "Packaged Food", animal_feed: "Animal Feed",
  cement: "Cement", steel: "Steel / TMT Bars", bricks: "Bricks / Blocks",
  sand: "Sand / Gravel", marble: "Marble / Granite", tiles: "Tiles / Ceramics",
  timber: "Timber / Plywood", glass: "Glass Sheets", pipes: "Pipes (PVC/Metal)",
  paint: "Paints / Coatings", rods: "Iron Rods",
  cotton: "Cotton / Yarn", fabric: "Fabric / Textiles", garments: "Garments / Apparel",
  jute: "Jute Products", silk: "Silk / Synthetic",
  chemicals: "Industrial Chemicals", fertilizers: "Fertilizers", pesticides: "Pesticides",
  petroleum: "Petroleum Products", lubricants: "Lubricants", polymers: "Polymers / Plastics",
  rubber: "Rubber / Tyres", acids: "Acids / Alkalis",
  electronics: "Electronics", furniture: "Furniture", appliances: "Home Appliances",
  fmcg: "FMCG Products", auto_parts: "Auto Parts", machinery: "Industrial Machinery",
  paper: "Paper / Stationery", pharma: "Pharmaceuticals", cosmetics: "Cosmetics",
  coal: "Coal / Coke", iron_ore: "Iron Ore", limestone: "Limestone", bauxite: "Bauxite",
  gypsum: "Gypsum", mica: "Mica", manganese: "Manganese",
  cattle: "Cattle / Livestock", poultry: "Poultry", fish: "Fish / Seafood",
  flowers: "Flowers / Plants", seeds: "Seeds / Saplings",
  household: "Household Goods", personal: "Personal Effects",
  exhibition: "Exhibition Materials", temple: "Temple / Religious Items",
  ecommerce: "E-commerce Parcels", other: "Other",
};

// Convert UTC date to local datetime string for datetime-local input (YYYY-MM-DDTHH:mm)
function toLocalDatetimeString(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatCommodityLabel(value: string | null | undefined): string {
  if (!value) return "";
  return commodityCodeToLabel[value] || value;
}

// Commodity categories for the combobox
const commodityCategories = [
  { category: "Agricultural & Food Products", items: [
    { value: "rice", label: "Rice / Paddy" }, { value: "wheat", label: "Wheat" },
    { value: "pulses", label: "Pulses / Daal" }, { value: "sugar", label: "Sugar" },
    { value: "jaggery", label: "Jaggery (Gud)" }, { value: "spices", label: "Spices" },
    { value: "tea", label: "Tea" }, { value: "coffee", label: "Coffee" },
    { value: "edible_oil", label: "Edible Oil" }, { value: "fruits", label: "Fruits" },
    { value: "vegetables", label: "Vegetables" }, { value: "dairy", label: "Dairy Products" },
    { value: "frozen_food", label: "Frozen Food" }, { value: "beverages", label: "Beverages" },
    { value: "packaged_food", label: "Packaged Food" }, { value: "animal_feed", label: "Animal Feed" },
  ]},
  { category: "Construction Materials", items: [
    { value: "cement", label: "Cement" }, { value: "steel", label: "Steel / TMT Bars" },
    { value: "bricks", label: "Bricks / Blocks" }, { value: "sand", label: "Sand / Gravel" },
    { value: "marble", label: "Marble / Granite" }, { value: "tiles", label: "Tiles / Ceramics" },
    { value: "timber", label: "Timber / Plywood" }, { value: "glass", label: "Glass Sheets" },
    { value: "pipes", label: "Pipes (PVC/Metal)" }, { value: "paint", label: "Paints / Coatings" },
    { value: "rods", label: "Iron Rods" },
  ]},
  { category: "Textiles & Apparel", items: [
    { value: "cotton", label: "Cotton / Yarn" }, { value: "fabric", label: "Fabric / Textiles" },
    { value: "garments", label: "Garments / Apparel" }, { value: "jute", label: "Jute Products" },
    { value: "silk", label: "Silk / Synthetic" },
  ]},
  { category: "Chemicals & Industrial", items: [
    { value: "chemicals", label: "Industrial Chemicals" }, { value: "fertilizers", label: "Fertilizers" },
    { value: "pesticides", label: "Pesticides" }, { value: "petroleum", label: "Petroleum Products" },
    { value: "lubricants", label: "Lubricants" }, { value: "polymers", label: "Polymers / Plastics" },
    { value: "rubber", label: "Rubber / Tyres" }, { value: "acids", label: "Acids / Alkalis" },
  ]},
  { category: "Consumer & General Goods", items: [
    { value: "electronics", label: "Electronics" }, { value: "furniture", label: "Furniture" },
    { value: "appliances", label: "Home Appliances" }, { value: "fmcg", label: "FMCG Products" },
    { value: "auto_parts", label: "Auto Parts" }, { value: "machinery", label: "Industrial Machinery" },
    { value: "paper", label: "Paper / Stationery" }, { value: "pharma", label: "Pharmaceuticals" },
    { value: "cosmetics", label: "Cosmetics" },
  ]},
  { category: "Mining & Minerals", items: [
    { value: "coal", label: "Coal / Coke" }, { value: "iron_ore", label: "Iron Ore" },
    { value: "limestone", label: "Limestone" }, { value: "bauxite", label: "Bauxite" },
    { value: "gypsum", label: "Gypsum" }, { value: "mica", label: "Mica" },
    { value: "manganese", label: "Manganese" },
  ]},
  { category: "Livestock & Perishables", items: [
    { value: "cattle", label: "Cattle / Livestock" }, { value: "poultry", label: "Poultry" },
    { value: "fish", label: "Fish / Seafood" }, { value: "flowers", label: "Flowers / Plants" },
    { value: "seeds", label: "Seeds / Saplings" },
  ]},
  { category: "Household & Miscellaneous", items: [
    { value: "household", label: "Household Goods" }, { value: "personal", label: "Personal Effects" },
    { value: "exhibition", label: "Exhibition Materials" }, { value: "temple", label: "Temple / Religious Items" },
    { value: "ecommerce", label: "E-commerce Parcels" }, { value: "other", label: "Other / Custom" },
  ]},
];

const allCommodities = commodityCategories.flatMap(cat => cat.items.map(item => ({ ...item, category: cat.category })));

function normalizeGoodsValue(goods: string | null | undefined): { code: string; custom: string } {
  if (!goods) return { code: "", custom: "" };
  const directMatch = allCommodities.find(c => c.value === goods);
  if (directMatch) return { code: directMatch.value, custom: "" };
  const labelMatch = allCommodities.find(c => c.label.toLowerCase() === goods.toLowerCase());
  if (labelMatch) return { code: labelMatch.value, custom: "" };
  // Not in list — treat as custom
  return { code: "other", custom: goods };
}

function CommodityCombobox({
  value, onChange, customValue, onCustomChange
}: {
  value?: string; onChange: (value: string) => void;
  customValue?: string; onCustomChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedCommodity = value ? (allCommodities.find(c => c.value === value) || allCommodities.find(c => c.label.toLowerCase() === value.toLowerCase())) : null;
  const isCustomSelected = value === "other" || (!selectedCommodity && !!value);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return commodityCategories;
    const searchLower = search.toLowerCase();
    return commodityCategories
      .map(cat => ({ ...cat, items: cat.items.filter(item => item.label.toLowerCase().includes(searchLower) || item.value.toLowerCase().includes(searchLower)) }))
      .filter(cat => cat.items.length > 0);
  }, [search]);

  const displayText = isCustomSelected ? (customValue || value || null) : (selectedCommodity?.label ?? null);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal" data-testid="select-goods-to-be-carried">
            {displayText ? <span className="truncate">{displayText}</span> : <span className="text-muted-foreground">Select commodity type...</span>}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start" sideOffset={4} style={{ zIndex: 9999 }}>
          <div className="flex flex-col">
            <div className="flex items-center border-b px-3">
              <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input placeholder="Search commodities..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {filteredCategories.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No commodity found.</div>
              ) : filteredCategories.map((cat) => (
                <div key={cat.category}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">{cat.category}</div>
                  {cat.items.map((item) => (
                    <div key={item.value}
                      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${(value === item.value || value === item.label) ? "bg-accent" : ""}`}
                      onClick={() => { onChange(item.value); if (item.value !== "other") onCustomChange(""); setSearch(""); setOpen(false); }}>
                      <Check className={`mr-2 h-4 w-4 ${(value === item.value || value === item.label) ? "opacity-100" : "opacity-0"}`} />
                      {item.label}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {isCustomSelected && (
        <Input placeholder="Enter your commodity type..." value={customValue || ""} onChange={(e) => onCustomChange(e.target.value)} className="mt-2" data-testid="input-custom-commodity" />
      )}
    </div>
  );
}

// Format load ID for display - shows LD-1001 (admin ref) or LD-023 (shipper seq)
function formatLoadId(load: { shipperLoadNumber?: number | null; adminReferenceNumber?: number | null; id: string }): string {
  if (load.adminReferenceNumber) {
    return `LD-${load.adminReferenceNumber}`;
  }
  if (load.shipperLoadNumber) {
    return `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`;
  }
  return load.id.slice(0, 8);
}

type LoadWithCarrier = Load & { assignedCarrier?: User | null };

// Extended shipment type with carrier, truck, and driver details for Carrier Memo
type ShipmentWithDetails = Shipment & {
  carrier?: {
    id: string;
    company: string | null;
    username: string | null;
    phone: string | null;
    email: string | null;
    isVerified: boolean | null;
    carrierType: string | null;
  } | null;
  truck?: {
    id: string;
    licensePlate: string | null;
    manufacturer: string | null;
    model: string | null;
    truckType: string | null;
    capacity: string | null;
  } | null;
  driver?: {
    id: string;
    username: string | null;
    phone: string | null;
    licenseNumber: string | null;
  } | null;
};

export default function LoadDetailPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [unavailableDialog, setUnavailableDialog] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editCustomCommodity, setEditCustomCommodity] = useState("");
  const [editCustomPickupCity, setEditCustomPickupCity] = useState("");
  const [editCustomDropoffCity, setEditCustomDropoffCity] = useState("");
  
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
  
  const getCitiesForState = (stateNameOrCode: string) => {
    const state = indianStates.find(s => s.name === stateNameOrCode || s.code === stateNameOrCode);
    return state?.cities || [];
  };
  
  const getStateForCity = (cityName: string) => {
    const normalizedCityName = cityName.toLowerCase().trim();
    for (const state of indianStates) {
      if (state.cities.some(city => city.name.toLowerCase() === normalizedCityName)) {
        return state.name;
      }
    }
    return "";
  };
  
  // Helper to find the correct city name from the predefined list (case-insensitive)
  const normalizeCity = (cityName: string) => {
    const normalizedInput = cityName.toLowerCase().trim();
    for (const state of indianStates) {
      const matchingCity = state.cities.find(c => c.name.toLowerCase() === normalizedInput);
      if (matchingCity) {
        return matchingCity.name; // Return the properly-cased name from the list
      }
    }
    return cityName; // Return as-is if not found
  };
  
  const allCities = getAllCities();

  const { data: load, isLoading, error } = useQuery<LoadWithCarrier>({
    queryKey: ["/api/loads", params.id],
    enabled: !!params.id,
  });

  const { data: shipment } = useQuery<ShipmentWithDetails>({
    queryKey: ["/api/shipments/load", params.id],
    enabled: !!params.id,
  });

  const editForm = useForm<EditLoadFormData>({
    resolver: zodResolver(editLoadSchema),
    defaultValues: {
      shipperCompanyName: "",
      shipperContactName: "",
      shipperCompanyAddress: "",
      shipperPhone: "",
      pickupBusinessName: "",
      pickupAddress: "",
      pickupLocality: "",
      pickupLandmark: "",
      pickupCity: "",
      pickupState: "",
      pickupPincode: "",
      dropoffBusinessName: "",
      dropoffAddress: "",
      dropoffLocality: "",
      dropoffLandmark: "",
      dropoffCity: "",
      dropoffState: "",
      dropoffPincode: "",
      receiverName: "",
      receiverPhone: "",
      receiverEmail: "",
      weight: "",
      weightUnit: "tons",
      requiredTruckType: "",
      goodsToBeCarried: "",
      specialNotes: "",
      pickupDate: "",
      deliveryDate: "",
    },
  });

  useEffect(() => {
    if (load && editSheetOpen) {
      // Extract city name from "City, State" format if needed
      const extractCityName = (cityValue: string | null) => {
        if (!cityValue) return "";
        // If city is in "City, State" format, extract just the city
        const parts = cityValue.split(",");
        return parts[0].trim();
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
        
        // First check if city is in "City, State" or "City,State" format
        const parts = cityValue.split(",");
        if (parts.length > 1) {
          const statePart = parts[1].trim();
          // Check if statePart matches any state name or code
          const matchedState = indianStates.find(s => 
            s.name === statePart || s.code === statePart || s.code === statePart.toUpperCase()
          );
          if (matchedState) return matchedState.name;
        }
        
        // Otherwise try to find state from city name
        const cityName = parts[0].trim();
        return getStateForCity(cityName);
      };
      
      const rawPickupCity = extractCityName(load.pickupCity);
      const rawDropoffCity = extractCityName(load.dropoffCity);
      // Normalize city names to match the predefined list (for Select component matching)
      const pickupCityName = normalizeCity(rawPickupCity);
      const dropoffCityName = normalizeCity(rawDropoffCity);
      const pickupStateName = findStateFromCity(load.pickupCity, load.pickupState);
      const dropoffStateName = findStateFromCity(load.dropoffCity, load.dropoffState);
      
      console.log("[EditLoad] Populating form with:", {
        originalPickupCity: load.pickupCity,
        originalPickupState: load.pickupState,
        rawPickupCity,
        normalizedPickupCity: pickupCityName,
        resolvedPickupState: pickupStateName,
        originalDropoffCity: load.dropoffCity,
        originalDropoffState: load.dropoffState,
        rawDropoffCity,
        normalizedDropoffCity: dropoffCityName,
        resolvedDropoffState: dropoffStateName,
      });
      
      const stateNameToCode = (name: string) => indianStates.find(s => s.name === name || s.code === name)?.code || name;
      
      editForm.reset({
        shipperCompanyName: (load as any).shipperCompanyName || "",
        shipperContactName: load.shipperContactName || "",
        shipperCompanyAddress: load.shipperCompanyAddress || "",
        shipperPhone: load.shipperPhone || "",
        pickupBusinessName: (load as any).pickupBusinessName || "",
        pickupAddress: load.pickupAddress || "",
        pickupLocality: load.pickupLocality || "",
        pickupLandmark: load.pickupLandmark || "",
        pickupCity: pickupCityName,
        pickupState: stateNameToCode(pickupStateName),
        pickupPincode: load.pickupPincode || "",
        dropoffBusinessName: load.dropoffBusinessName || "",
        dropoffAddress: load.dropoffAddress || "",
        dropoffLocality: load.dropoffLocality || "",
        dropoffLandmark: load.dropoffLandmark || "",
        dropoffCity: dropoffCityName,
        dropoffState: stateNameToCode(dropoffStateName),
        dropoffPincode: load.dropoffPincode || "",
        receiverName: load.receiverName || "",
        receiverPhone: load.receiverPhone || "",
        receiverEmail: load.receiverEmail || "",
        weight: load.weight?.toString() || "",
        weightUnit: "tons",
        requiredTruckType: load.requiredTruckType || "",
        goodsToBeCarried: load.goodsToBeCarried || load.materialType || "",
        specialNotes: load.specialNotes || "",
        pickupDate: load.pickupDate ? new Date(load.pickupDate).toISOString() : "",
        deliveryDate: load.deliveryDate ? new Date(load.deliveryDate).toISOString() : "",
      });
      // If value is not in known list, treat as custom
      const normalized = normalizeGoodsValue(load.goodsToBeCarried);
      setEditCustomCommodity(normalized.custom);
    }
  }, [load, editSheetOpen]);

  const editMutation = useMutation({
    mutationFn: async (data: EditLoadFormData) => {
      const payload: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (value === "" || value === null || value === undefined) {
          continue;
        }
        if (key === "weight" && typeof value === "string") {
          const numVal = parseFloat(value);
          if (!isNaN(numVal)) {
            payload[key] = numVal;
          }
        } else if ((key === "pickupDate" || key === "deliveryDate") && typeof value === "string") {
          const dateVal = new Date(value);
          if (!isNaN(dateVal.getTime())) {
            payload[key] = dateVal.toISOString();
          }
        } else {
          payload[key] = value;
        }
      }
      
      return apiRequest("PATCH", `/api/loads/${params.id}`, payload);
    },
    onSuccess: () => {
      toast({ title: "Load Updated", description: "Your changes have been saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loads", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loads", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments/load", params.id] });
      setEditSheetOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditSubmit = (data: EditLoadFormData) => {
    if (data.goodsToBeCarried) {
      if (data.goodsToBeCarried === "other" && editCustomCommodity) {
        data = { ...data, goodsToBeCarried: editCustomCommodity };
      } else {
        // Convert code to label if it's a known code, otherwise keep as-is (already a label or custom)
        const label = formatCommodityLabel(data.goodsToBeCarried);
        data = { ...data, goodsToBeCarried: label };
      }
    }
    if (data.pickupCity === "other" && editCustomPickupCity) {
      data = { ...data, pickupCity: editCustomPickupCity };
    }
    if (data.dropoffCity === "other" && editCustomDropoffCity) {
      data = { ...data, dropoffCity: editCustomDropoffCity };
    }
    editMutation.mutate(data);
  };

  useEffect(() => {
    if (user?.id && user?.role === "shipper" && params.id) {
      connectMarketplace("shipper", user.id);
      
      const unsubLoadUpdate = onMarketplaceEvent("load_updated", (data) => {
        if (data.loadId === params.id || data.load?.id === params.id) {
          const eventType = data.event;
          let title = "Load Updated";
          let description = `Your load status has been updated to: ${data.status}`;
          
          if (eventType === "admin_edited") {
            title = "Admin Updated Load";
            description = "An administrator has updated your load details";
          } else if (eventType === "bid_accepted") {
            title = "Carrier Assigned";
            description = "A carrier has been assigned to your load";
          }
          
          toast({ title, description });
          queryClient.invalidateQueries({ queryKey: ["/api/loads", params.id] });
          queryClient.invalidateQueries({ queryKey: ["/api/shipments/load", params.id] });
        }
      });

      return () => {
        unsubLoadUpdate();
        disconnectMarketplace();
      };
    }
  }, [user?.id, user?.role, params.id, toast]);

  const unavailableMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/loads/${params.id}`, { status: "unavailable" });
    },
    onSuccess: () => {
      toast({ title: "Load marked unavailable", description: "The load is now hidden from admins and carriers." });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      setUnavailableDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleMakeUnavailable = () => {
    unavailableMutation.mutate();
  };

  const handleDuplicate = () => {
    toast({ title: "Coming Soon", description: "Load duplication feature is in development." });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !load) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Load not found</h2>
          <p className="text-muted-foreground mb-4">The load you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/shipper/loads")} data-testid="button-back-to-loads">Back to Loads</Button>
        </div>
      </div>
    );
  }

  const canMakeUnavailable = !["cancelled", "delivered", "closed", "in_transit", "awarded", "invoice_created", "invoice_sent", "invoice_acknowledged", "invoice_paid", "unavailable"].includes(load.status || "");
  const isFinalized = ["awarded", "invoice_created", "invoice_sent", "invoice_acknowledged", "invoice_paid", "in_transit", "delivered", "closed"].includes(load.status || "");
  const canEdit = !["cancelled", "delivered", "closed", "in_transit", "unavailable"].includes(load.status || "");

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header Section - Responsive */}
      <div className="mb-4 sm:mb-6">
        {/* Back Button and Title Row */}
        <div className="flex items-start gap-3 mb-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/shipper/loads")} data-testid="button-back" className="shrink-0 mt-1">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl sm:text-2xl font-bold break-words" data-testid="text-load-id">Load #{formatLoadId(load)}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${getStatusColor(load.status)} no-default-hover-elevate no-default-active-elevate w-fit`}>
                  {getStatusLabel(load.status)}
                </Badge>
                <span className="text-muted-foreground text-xs sm:text-sm">
                  Created {formatTimeAgo(load.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons Row - Full Width on Mobile */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {canEdit && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setEditSheetOpen(true)}
              data-testid="button-edit-load"
              className="flex-1 sm:flex-none min-w-[80px]"
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const loadNum = formatLoadId(load);
              const pickupDate = load.pickupDate 
                ? new Date(load.pickupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '';
              const truckLabel = load.requiredTruckType 
                ? load.requiredTruckType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                : '';
              let message = `*Load Available*\n\n`;
              message += `*Load #:* ${loadNum}\n`;
              message += `---\n`;
              message += `*From:* ${load.pickupCity}\n`;
              message += `*To:* ${load.dropoffCity}\n`;
              message += `---\n`;
              if (load.weight) message += `*Weight:* ${load.weight} Tons\n`;
              if (load.goodsToBeCarried) message += `*Cargo:* ${load.goodsToBeCarried}\n`;
              if (truckLabel) message += `*Truck:* ${truckLabel}\n`;
              if (pickupDate) message += `*Pickup:* ${pickupDate}\n`;
              if (load.specialNotes) message += `*Notes:* ${load.specialNotes}\n`;
              message += `\n*View & Bid:* https://loadpilot.in`;
              window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
            }}
            data-testid="button-share-whatsapp"
            className="flex-1 sm:flex-none min-w-[100px]"
          >
            <SiWhatsapp className="h-4 w-4 mr-1.5 text-green-500" />
            WhatsApp
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const loadNum = formatLoadId(load);
              const pickupDate = load.pickupDate 
                ? new Date(load.pickupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '';
              const truckLabel = load.requiredTruckType 
                ? load.requiredTruckType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                : '';
              let message = `Load Available\n`;
              message += `Load #: ${loadNum}\n`;
              message += `From: ${load.pickupCity}\n`;
              message += `To: ${load.dropoffCity}\n`;
              if (load.weight) message += `Weight: ${load.weight} Tons\n`;
              if (load.goodsToBeCarried) message += `Cargo: ${load.goodsToBeCarried}\n`;
              if (truckLabel) message += `Truck: ${truckLabel}\n`;
              if (pickupDate) message += `Pickup: ${pickupDate}\n`;
              if (load.specialNotes) message += `Notes: ${load.specialNotes}\n`;
              message += `\nView & Bid: https://loadpilot.in`;
              window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank');
            }}
            data-testid="button-share-sms"
            className="flex-1 sm:flex-none min-w-[80px]"
          >
            <MessageCircle className="h-4 w-4 mr-1.5" />
            SMS
          </Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate} data-testid="button-duplicate" className="hidden lg:flex">
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </Button>
          {canMakeUnavailable && (
            <Button variant="outline" size="sm" onClick={() => setUnavailableDialog(true)} data-testid="button-make-unavailable" className="hidden lg:flex">
              <EyeOff className="h-4 w-4 mr-2" />
              Make Unavailable
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Grid - Responsive */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Route Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="w-0.5 h-12 sm:h-16 bg-border my-2" />
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <div className="flex-1 space-y-6 sm:space-y-8 min-w-0">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">PICKUP</p>
                    <p className="font-semibold text-sm sm:text-base break-words" data-testid="text-pickup">
                      {load.pickupBusinessName ? `${load.pickupBusinessName}, ` : ''}{load.pickupAddress}{load.pickupLocality ? `, ${load.pickupLocality}` : ''}, {load.pickupCity}{load.pickupPincode ? ` - ${load.pickupPincode}` : ''}
                    </p>
                    {load.pickupLandmark && (
                      <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Landmark className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                        <span className="break-words">Landmark: {load.pickupLandmark}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                        <span className="break-words">{formatDate(load.pickupDate)}</span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">DELIVERY</p>
                    <p className="font-semibold text-sm sm:text-base break-words" data-testid="text-drop">
                      {load.dropoffBusinessName ? `${load.dropoffBusinessName}, ` : ''}{load.dropoffAddress}{load.dropoffLocality ? `, ${load.dropoffLocality}` : ''}, {load.dropoffCity}{load.dropoffPincode ? ` - ${load.dropoffPincode}` : ''}
                    </p>
                    {load.dropoffLandmark && (
                      <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Landmark className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                        <span className="break-words">Landmark: {load.dropoffLandmark}</span>
                      </p>
                    )}
                    {load.deliveryDate && (
                      <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                          <span className="break-words">Est. Delivery: {formatDate(load.deliveryDate)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(load.shipperCompanyName || load.shipperContactName || load.shipperCompanyAddress || load.shipperPhone) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  Shipper Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {load.shipperCompanyName && (
                    <div className="flex items-start gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Company Name</p>
                        <p className="font-medium text-sm sm:text-base break-words" data-testid="text-company-name">{load.shipperCompanyName}</p>
                      </div>
                    </div>
                  )}
                  {load.shipperContactName && (
                    <div className="flex items-start gap-3">
                      <UserIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Contact Person</p>
                        <p className="font-medium text-sm sm:text-base break-words" data-testid="text-contact-name">{load.shipperContactName}</p>
                      </div>
                    </div>
                  )}
                  {load.shipperCompanyAddress && (
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Company Address</p>
                        <p className="font-medium text-sm sm:text-base break-words" data-testid="text-company-address">{load.shipperCompanyAddress}</p>
                      </div>
                    </div>
                  )}
                  {load.shipperPhone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Phone Number</p>
                        <p className="font-medium text-sm sm:text-base break-words" data-testid="text-phone">{load.shipperPhone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {(load.receiverName || load.receiverPhone || load.receiverEmail) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <UserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  Receiver Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {load.receiverName && (
                    <div className="flex items-start gap-3">
                      <UserIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Receiver Name</p>
                        <p className="font-medium text-sm sm:text-base break-words" data-testid="text-receiver-name">{load.receiverName}</p>
                      </div>
                    </div>
                  )}
                  {load.receiverPhone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Receiver Phone</p>
                        <p className="font-medium text-sm sm:text-base break-words" data-testid="text-receiver-phone">{load.receiverPhone}</p>
                      </div>
                    </div>
                  )}
                  {load.receiverEmail && (
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Receiver Email</p>
                        <p className="font-medium text-sm sm:text-base break-all" data-testid="text-receiver-email">{load.receiverEmail}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {(load.goodsToBeCarried || load.specialNotes || load.shipperPricePerTon || load.shipperFixedPrice || load.advancePaymentPercent) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                  Cargo & Pricing Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {load.goodsToBeCarried && (
                  <div className="flex items-start gap-3">
                    <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Goods to be Carried</p>
                      <p className="font-medium text-sm sm:text-base break-words" data-testid="text-goods">{formatCommodityLabel(load.goodsToBeCarried)}</p>
                    </div>
                  </div>
                )}
                {load.rateType && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <Receipt className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Rate Type</p>
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate mt-1">
                          {load.rateType === "per_ton" ? "Per Ton" : "Fixed Price"}
                        </Badge>
                      </div>
                    </div>
                  </>
                )}
                {load.shipperPricePerTon && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <IndianRupee className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Your Suggested Price per Ton</p>
                        <p className="font-medium text-base sm:text-lg break-words" data-testid="text-price-per-ton">
                          Rs. {parseFloat(load.shipperPricePerTon).toLocaleString("en-IN")} /ton
                        </p>
                        {load.weight && (
                          <p className="text-xs sm:text-sm text-muted-foreground break-words">
                            Estimated total: Rs. {(parseFloat(load.shipperPricePerTon) * parseFloat(load.weight)).toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
                {load.shipperFixedPrice && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <IndianRupee className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Your Suggested Fixed Price</p>
                        <p className="font-medium text-base sm:text-lg break-words" data-testid="text-fixed-price">
                          Rs. {parseFloat(load.shipperFixedPrice).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </>
                )}
                {load.advancePaymentPercent && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <Percent className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Advance Payment</p>
                        <p className="font-medium text-sm sm:text-base" data-testid="text-advance-payment">
                          {load.advancePaymentPercent}%
                        </p>
                      </div>
                    </div>
                  </>
                )}
                {load.specialNotes && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Special Instructions / Notes</p>
                        <p className="font-medium text-sm sm:text-base break-words" data-testid="text-special-notes">{load.specialNotes}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base sm:text-lg">Carrier Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              {isFinalized && shipment ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b">
                    <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base">Carrier Assigned</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">A carrier has been finalized for this load</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 sm:space-y-3">
                    {/* Carrier Organization */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
                        <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span>Carrier</span>
                      </span>
                      <span className="font-medium text-right text-xs sm:text-sm break-words">
                        {shipment.carrier?.company || shipment.carrier?.username || "Not specified"}
                      </span>
                    </div>
                    
                    {/* Driver Name */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
                        <UserIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span>Driver</span>
                      </span>
                      <span className="font-medium text-right text-xs sm:text-sm break-words">
                        {shipment.driver?.username || shipment.carrier?.username || "Not assigned"}
                      </span>
                    </div>
                    
                    {/* Truck Details */}
                    {shipment.truck && (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
                            <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                            <span>Vehicle</span>
                          </span>
                          <span className="font-medium text-right text-xs sm:text-sm break-words">
                            {shipment.truck.manufacturer} {shipment.truck.model}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground text-xs sm:text-sm">Vehicle Number</span>
                          <Badge variant="outline" className="font-mono no-default-hover-elevate no-default-active-elevate text-xs">
                            {shipment.truck.licensePlate || "N/A"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground text-xs sm:text-sm">Truck Type</span>
                          <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                            {shipment.truck.truckType || "Standard"}
                          </Badge>
                        </div>
                      </>
                    )}
                    
                    {/* Pickup Date */}
                    <div className="flex items-center justify-between gap-3 pt-2 border-t">
                      <span className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span>Pickup Date</span>
                      </span>
                      <span className="font-medium text-xs sm:text-sm">
                        {load.pickupDate ? format(new Date(load.pickupDate), "dd MMM yyyy") : "Not scheduled"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : isFinalized ? (
                <div className="text-center py-4">
                  <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-green-600 dark:text-green-400 mb-3" />
                  <p className="font-medium text-sm sm:text-base">Carrier Assigned</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">A carrier has been finalized for this load</p>
                  <p className="text-xs text-muted-foreground mt-2">Loading carrier details...</p>
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8">
                  <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium text-sm sm:text-base">Admin-Managed Selection</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md mx-auto px-4">
                    Our logistics team is reviewing carrier bids and will select the best carrier for your load. 
                    You'll be notified when a carrier is assigned.
                  </p>
                  <Badge variant="outline" className="mt-4 text-xs">In Review</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Load Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-xs sm:text-sm">Weight</span>
                <span className="font-medium text-xs sm:text-sm">{parseFloat(load.weight || "0").toLocaleString()} {load.weightUnit}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-xs sm:text-sm">Truck Type</span>
                <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">
                  {load.requiredTruckType || "Any"}
                </Badge>
              </div>
              {load.adminFinalPrice && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs sm:text-sm">Final Price</span>
                    <span className="font-semibold text-base sm:text-lg text-green-600 dark:text-green-400">
                      Rs. {parseFloat(load.adminFinalPrice).toLocaleString("en-IN")}
                    </span>
                  </div>
                </>
              )}
              {load.cargoDescription && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground text-xs sm:text-sm">Cargo Description</span>
                    <p className="mt-1 text-xs sm:text-sm break-words">{load.cargoDescription}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {load.assignedCarrierId && isFinalized && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Assigned Carrier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base sm:text-lg shrink-0">
                    C
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm sm:text-base" data-testid="text-carrier">Carrier Assigned</p>
                    <div className="flex items-center gap-1 text-xs sm:text-sm text-amber-500">
                      <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current shrink-0" />
                      Verified Carrier
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Carrier Memo - Shows carrier, truck, driver summary when shipment exists */}
          {shipment && (
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">Carrier Memo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground text-xs sm:text-sm">Carrier Type</span>
                  <span className="font-medium text-xs sm:text-sm text-right break-words" data-testid="text-carrier-name">
                    {shipment.carrier?.carrierType === 'solo'
                      ? 'Solo Driver'
                      : shipment.carrier?.carrierType === 'enterprise'
                      ? 'Fleet Owner'
                      : shipment.carrier?.company || shipment.carrier?.username || "Not assigned"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground text-xs sm:text-sm">Vehicle Number</span>
                  <span className="font-medium font-mono text-xs sm:text-sm break-all" data-testid="text-vehicle-number">
                    {shipment.truck?.licensePlate || "Not assigned"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground text-xs sm:text-sm">Driver Name</span>
                  <span className="font-medium text-xs sm:text-sm text-right break-words" data-testid="text-driver-name">
                    {shipment.driver?.username || "Not assigned"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {shipment && (
        <div className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Shipment Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
                <p className="font-medium text-sm sm:text-base">Shipment Active</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Status: {shipment.status}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!shipment && !isFinalized && (
        <div className="mt-4 sm:mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-40" />
                <p className="text-xs sm:text-sm">Documents become available after carrier assignment</p>
                <p className="text-xs mt-1 px-4">Once a carrier is assigned, you can upload and manage shipment documents here</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={unavailableDialog} onOpenChange={setUnavailableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Load Unavailable</DialogTitle>
            <DialogDescription>
              This will hide the load from admins and carriers. You can make it available again later by submitting it for review.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnavailableDialog(false)}>
              Keep Available
            </Button>
            <Button 
              onClick={handleMakeUnavailable} 
              disabled={unavailableMutation.isPending}
              data-testid="button-confirm-unavailable"
            >
              {unavailableMutation.isPending ? "Processing..." : "Make Unavailable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={editSheetOpen} onOpenChange={(open) => {
        setEditSheetOpen(open);
        if (!open) {
          setEditCustomPickupCity("");
          setEditCustomDropoffCity("");
        }
      }}>
        <SheetContent
          className="w-full sm:max-w-xl overflow-hidden p-0 flex flex-col"
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest(".MuiPickersPopper-root") || target.closest(".MuiPickersLayout-root")) {
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
          <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
              Edit Load Details
            </SheetTitle>
            <SheetDescription className="text-xs sm:text-sm">
              Update the load information below. Changes will sync across all portals.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 sm:space-y-6 px-4 sm:px-6 py-3 sm:py-4">

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                      Shipper Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                      <FormField
                        control={editForm.control}
                        name="shipperCompanyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs sm:text-sm">Company Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-shipper-company-name" className="text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="shipperContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs sm:text-sm">Contact Person Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-shipper-contact" className="text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="shipperCompanyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Company Address</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-shipper-address" className="text-sm" />
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
                          <FormLabel className="text-xs sm:text-sm">Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-shipper-phone" className="text-sm" />
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
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                      Pickup Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    <FormField
                      control={editForm.control}
                      name="pickupBusinessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-pickup-business-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="pickupAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-pickup-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={editForm.control}
                        name="pickupLocality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Locality / Area</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-pickup-locality" />
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
                            <FormLabel>Landmark (optional)</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-pickup-landmark" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={editForm.control}
                        name="pickupState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <Select 
                              onValueChange={(val) => {
                                field.onChange(val);
                                editForm.setValue("pickupCity", "");
                              }} 
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-pickup-state">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <ScrollArea className="h-[300px]">
                                  {indianStates.map((state) => (
                                    <SelectItem key={state.code} value={state.code}>
                                      {state.name}
                                    </SelectItem>
                                  ))}
                                </ScrollArea>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="pickupCity"
                        render={({ field }) => {
                          const selectedState = editForm.watch("pickupState");
                          const pickupCities = selectedState ? getCitiesForState(selectedState) : [];
                          const isOther = field.value === "other";
                          return (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <Select 
                                onValueChange={(val) => {
                                  field.onChange(val);
                                  if (val !== "other") setEditCustomPickupCity("");
                                }} 
                                value={field.value}
                                disabled={!selectedState}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-edit-pickup-city">
                                    <SelectValue placeholder={selectedState ? "Select city" : "Select state first"}>
                                      {isOther ? (editCustomPickupCity || "Other") : field.value}
                                    </SelectValue>
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <ScrollArea className="h-[300px]">
                                    {pickupCities.map((city) => (
                                      <SelectItem key={city.name} value={city.name}>
                                        {city.name}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value="other">Other</SelectItem>
                                  </ScrollArea>
                                </SelectContent>
                              </Select>
                              {isOther && (
                                <Input
                                  placeholder="Enter city name"
                                  value={editCustomPickupCity}
                                  onChange={(e) => setEditCustomPickupCity(e.target.value)}
                                  data-testid="input-edit-pickup-city-custom"
                                  className="mt-2"
                                />
                              )}
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="pickupPincode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pincode</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter pincode" {...field} data-testid="input-edit-pickup-pincode" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-red-500" />
                      Dropoff Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="dropoffBusinessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-dropoff-business" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="dropoffAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-dropoff-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={editForm.control}
                        name="dropoffLocality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Locality / Area</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-dropoff-locality" />
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
                            <FormLabel>Landmark (optional)</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-dropoff-landmark" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={editForm.control}
                        name="dropoffState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <Select 
                              onValueChange={(val) => {
                                field.onChange(val);
                                editForm.setValue("dropoffCity", "");
                              }} 
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-dropoff-state">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <ScrollArea className="h-[300px]">
                                  {indianStates.map((state) => (
                                    <SelectItem key={state.code} value={state.code}>
                                      {state.name}
                                    </SelectItem>
                                  ))}
                                </ScrollArea>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="dropoffCity"
                        render={({ field }) => {
                          const selectedState = editForm.watch("dropoffState");
                          const dropoffCities = selectedState ? getCitiesForState(selectedState) : [];
                          const isOther = field.value === "other";
                          return (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <Select 
                                onValueChange={(val) => {
                                  field.onChange(val);
                                  if (val !== "other") setEditCustomDropoffCity("");
                                }} 
                                value={field.value}
                                disabled={!selectedState}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-edit-dropoff-city">
                                    <SelectValue placeholder={selectedState ? "Select city" : "Select state first"}>
                                      {isOther ? (editCustomDropoffCity || "Other") : field.value}
                                    </SelectValue>
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <ScrollArea className="h-[300px]">
                                    {dropoffCities.map((city) => (
                                      <SelectItem key={city.name} value={city.name}>
                                        {city.name}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value="other">Other</SelectItem>
                                  </ScrollArea>
                                </SelectContent>
                              </Select>
                              {isOther && (
                                <Input
                                  placeholder="Enter city name"
                                  value={editCustomDropoffCity}
                                  onChange={(e) => setEditCustomDropoffCity(e.target.value)}
                                  data-testid="input-edit-dropoff-city-custom"
                                  className="mt-2"
                                />
                              )}
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="dropoffPincode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pincode</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter pincode" {...field} data-testid="input-edit-dropoff-pincode" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-purple-500" />
                      Receiver Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={editForm.control}
                        name="receiverName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receiver Full Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-receiver-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="receiverPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receiver Phone</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-receiver-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="receiverEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receiver Email (Optional)</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-edit-receiver-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Cargo Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={editForm.control}
                        name="weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weight</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input 
                                  type="number" 
                                  {...field}
                                  data-testid="input-edit-weight"
                                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Select
                                  defaultValue="tons"
                                  onValueChange={(value) => editForm.setValue("weightUnit", value)}
                                >
                                  <SelectTrigger className="w-24" data-testid="select-edit-weight-unit">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="tons">tons</SelectItem>
                                    <SelectItem value="kg">kg</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="goodsToBeCarried"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Goods Description</FormLabel>
                            <FormControl>
                              <CommodityCombobox
                                value={field.value}
                                onChange={field.onChange}
                                customValue={editCustomCommodity}
                                onCustomChange={setEditCustomCommodity}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="specialNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special Notes</FormLabel>
                          <FormControl>
                            <Textarea className="resize-none" {...field} data-testid="input-edit-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
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
                  </CardContent>
                </Card>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t sticky bottom-0 bg-background pb-4">
                  <Button type="button" variant="outline" onClick={() => setEditSheetOpen(false)} data-testid="button-cancel-edit" className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editMutation.isPending} data-testid="button-save-edit" className="w-full sm:w-auto">
                    {editMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
