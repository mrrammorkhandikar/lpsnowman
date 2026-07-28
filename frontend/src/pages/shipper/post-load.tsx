import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MapPin, Package, Calendar, Truck, Save, ArrowRight, Sparkles, Info, Clock, CheckCircle2, Send, Building2, ChevronRight, X, Container, Droplet, Check, ChevronsUpDown, Search, AlertCircle, Loader2, FileText, Phone, Eye, MessageCircle, Share2 } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppDateTimePicker } from "@/components/ui/date-time-picker";
import { useAuth } from "@/lib/auth-context";

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
function parseIndianMobile(input: string): string {
  const d = input.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(-10);
  if (d.length === 11 && d.startsWith("0")) return d.slice(-10);
  if (d.length === 10) return d;
  return "";
}

const loadFormSchema = z.object({
  shipperCompanyName: z.string().optional(),
  shipperContactName: z.string().optional(),
  shipperCompanyAddress: z.string().optional(),
  shipperPhone: z.string().optional().superRefine((val, ctx) => {
    const v = (val ?? "").trim();
    if (v && !INDIAN_MOBILE_REGEX.test(parseIndianMobile(v))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 10-digit Indian mobile number" });
    }
  }),
  pickupAddress: z.string().optional(),
  pickupLocality: z.string().optional(),
  pickupLandmark: z.string().optional(),
  pickupBusinessName: z.string().optional(),
  pickupState: z.string().optional(),
  pickupCity: z.string().optional(),
  pickupCityCustom: z.string().optional(),
  pickupPincode: z.string().optional(),
  dropoffAddress: z.string().optional(),
  dropoffLocality: z.string().optional(),
  dropoffLandmark: z.string().optional(),
  dropoffBusinessName: z.string().optional(),
  dropoffState: z.string().optional(),
  dropoffCity: z.string().optional(),
  dropoffCityCustom: z.string().optional(),
  dropoffPincode: z.string().optional(),
  receiverName: z.string().optional(),
  receiverPhone: z.string().optional().superRefine((val, ctx) => {
    const v = (val ?? "").trim();
    if (v && !INDIAN_MOBILE_REGEX.test(parseIndianMobile(v))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 10-digit Indian mobile number" });
    }
  }),
  receiverEmail: z.string().optional().superRefine((val, ctx) => {
    const v = (val ?? "").trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid email address" });
    }
  }),
  weight: z.string().optional(),
  weightUnit: z.string().default("tons"),
  goodsToBeCarried: z.string().optional(),
  specialNotes: z.string().optional(),
  rateType: z.enum(["per_ton", "fixed_price"]).default("fixed_price"),
  shipperPricePerTon: z.string().optional(),
  shipperFixedPrice: z.string().optional(),
  advancePaymentPercent: z.string().optional(),
  requiredTruckType: z.string().optional(),
  pickupDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  isTemplate: z.boolean().default(false),
  templateName: z.string().optional(),
  preferredCarriers: z.boolean().default(false),
}).refine((data) => {
  if (data.pickupCity === "__other__") {
    return data.pickupCityCustom && data.pickupCityCustom.trim() !== "";
  }
  return true;
}, {
  message: "Please enter the city name",
  path: ["pickupCityCustom"],
}).refine((data) => {
  if (data.dropoffCity === "__other__") {
    return data.dropoffCityCustom && data.dropoffCityCustom.trim() !== "";
  }
  return true;
}, {
  message: "Please enter the city name",
  path: ["dropoffCityCustom"],
});

type LoadFormData = z.infer<typeof loadFormSchema>;

import { indianTruckTypes, truckBodyCategories } from "@shared/schema";
import { indianStates } from "@shared/indian-locations";

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
      { value: "chemicals_hazardous", label: "Chemicals (Hazardous)" },
      { value: "caustic_soda", label: "Caustic Soda" },
      { value: "chlorine", label: "Chlorine" },
      { value: "calcium_carbonate", label: "Calcium Carbonate" },
      { value: "acids", label: "Acids" },
      { value: "sulphuric_acid", label: "Sulphuric Acid" },
      { value: "hydrochloric_acid", label: "Hydrochloric Acid" },
      { value: "nitric_acid", label: "Nitric Acid" },
      { value: "solvents", label: "Solvents" },
      { value: "resins", label: "Resins / Polymers" },
      { value: "plastics_raw", label: "Plastics (Raw Material)" },
      { value: "rubber", label: "Rubber" },
      { value: "petroleum_products", label: "Petroleum Products" },
      { value: "lng_lpg", label: "LNG / LPG" },
      { value: "bitumen", label: "Bitumen" },
      { value: "lubricants", label: "Lubricants / Oils" },
      { value: "crude_oil", label: "Crude Oil" },
      { value: "diesel", label: "Diesel" },
      { value: "petrol", label: "Petrol / Gasoline" },
      { value: "kerosene", label: "Kerosene" },
      { value: "furnace_oil", label: "Furnace Oil" },
      { value: "naphtha", label: "Naphtha" },
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
      { value: "cables_wires", label: "Cables / Wires" },
      { value: "batteries", label: "Batteries" },
      { value: "solar_panels", label: "Solar Panels" },
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

// Get commodity label from value
function getCommodityLabel(value: string): string {
  for (const category of commodityCategories) {
    const item = category.items.find(i => i.value === value);
    if (item) return item.label;
  }
  return value;
}

// Flatten all commodities for searching
const allCommodities = commodityCategories.flatMap(cat => 
  cat.items.map(item => ({ ...item, category: cat.category }))
);

// Searchable Commodity Combobox Component with custom input support
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
  
  const selectedCommodity = value ? allCommodities.find(c => c.label === value || c.value === value) : null;
  const isCustomSelected = value === "other";

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
      <Popover open={open} onOpenChange={setOpen}>
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
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command
            filter={(value, search) => {
              if (value.toLowerCase().startsWith(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput placeholder="Type to search commodities..." />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>No commodity found.</CommandEmpty>
              {commodityCategories.map((category) => (
                <CommandGroup key={category.category} heading={category.category}>
                  {category.items.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={item.label}
                      onSelect={() => {
                        onChange(item.value === "other" ? "other" : item.label);
                        if (item.value !== "other") {
                          onCustomChange("");
                        }
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          value === item.label || (item.value === "other" && value === "other") ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
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

const truckTypesByCategory = truckBodyCategories.reduce((acc, category) => {
  acc[category.id] = indianTruckTypes.filter(t => t.category === category.id);
  return acc;
}, {} as Record<string, typeof indianTruckTypes[number][]>);

function getTruckLabel(value: string): string {
  const truck = indianTruckTypes.find(t => t.value === value);
  return truck?.label || value;
}

function getTruckCategoryInfo(truckValue: string) {
  const truck = indianTruckTypes.find(t => t.value === truckValue);
  if (!truck) return null;
  return truckBodyCategories.find(c => c.id === truck.category);
}

function TruckTypeSelector({ 
  value, 
  onChange, 
  suggestedTruck 
}: { 
  value?: string; 
  onChange: (value: string) => void;
  suggestedTruck?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const handleTruckSelect = (truckValue: string) => {
    onChange(truckValue);
    setIsOpen(false);
    setSelectedCategory(null);
  };

  const handleBack = () => {
    setSelectedCategory(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedCategory(null);
  };

  const selectedTruck = value ? indianTruckTypes.find(t => t.value === value) : null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between h-9 font-normal"
        onClick={() => setIsOpen(true)}
        data-testid="select-truck-type"
      >
        {selectedTruck ? (
          <span className="flex items-center gap-2 truncate">
            <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{selectedTruck.label}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Select truck type</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Button>

      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          {!selectedCategory ? (
            <>
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Choose a Body Type</SheetTitle>
                <SheetDescription>What type of truck do you require?</SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-120px)]">
                <div className="p-2">
                  {truckBodyCategories.map((category) => {
                    const trucksInCategory = truckTypesByCategory[category.id] || [];
                    if (trucksInCategory.length === 0) return null;
                    
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className="w-full flex items-center gap-4 p-4 hover-elevate active-elevate-2 rounded-md text-left"
                        onClick={() => handleCategorySelect(category.id)}
                        data-testid={`category-${category.id}`}
                      >
                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                          {category.id === "container" ? (
                            <Container className="h-6 w-6 text-muted-foreground" />
                          ) : category.id === "tanker" ? (
                            <Droplet className="h-6 w-6 text-muted-foreground" />
                          ) : (
                            <Truck className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{category.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {category.tonnageRange}, {category.description}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              <SheetHeader className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    data-testid="button-back-category"
                  >
                    <ArrowRight className="h-4 w-4 rotate-180" />
                  </Button>
                  <div>
                    <SheetTitle>
                      {truckBodyCategories.find(c => c.id === selectedCategory)?.name}
                    </SheetTitle>
                    <SheetDescription>Select a specific truck configuration</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-120px)]">
                <div className="p-2 space-y-1">
                  {truckTypesByCategory[selectedCategory]?.map((truck) => (
                    <button
                      key={truck.value}
                      type="button"
                      className={`w-full flex items-center justify-between gap-3 p-4 rounded-md text-left hover-elevate active-elevate-2 ${
                        value === truck.value ? "bg-primary/10 border border-primary" : ""
                      }`}
                      onClick={() => handleTruckSelect(truck.value)}
                      data-testid={`truck-${truck.value}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{truck.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {truck.capacityMin}-{truck.capacityMax} tons
                        </div>
                      </div>
                      {value === truck.value && (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

const savedTemplates = [
  { id: "t1", name: "Mumbai to Delhi Regular", pickup: "Mumbai, MH", dropoff: "Delhi, DL" },
  { id: "t2", name: "Bangalore Distribution Route", pickup: "Bangalore, KA", dropoff: "Chennai, TN" },
];

function calculateDistance(from: string, to: string): number {
  const fromCity = from.split(",")[0].trim();
  const toCity = to.split(",")[0].trim();
  const km = computeRouteDistanceKmEstimate({ pickupCity: fromCity, dropoffCity: toCity });
  return Number.isFinite(km) ? Math.round(km) : 0;
}

function suggestTruckType(weight: number, description: string): string {
  const desc = description.toLowerCase();

  // Step 1: Determine preferred category from goods description
  let preferredCategory: string | null = null;

  if (desc.includes("frozen") || desc.includes("cold") || desc.includes("perishable") ||
      desc.includes("dairy") || desc.includes("ice cream") || desc.includes("medicine") ||
      desc.includes("pharma") || desc.includes("refrigerat")) {
    preferredCategory = "container";
  } else if (desc.includes("oil") || desc.includes("fuel") || desc.includes("petrol") ||
             desc.includes("diesel") || desc.includes("chemical") || desc.includes("acid") ||
             desc.includes("liquid") || desc.includes("water") || desc.includes("milk")) {
    preferredCategory = "tanker";
  } else if (desc.includes("cement") || desc.includes("fly ash") || desc.includes("powder") ||
             desc.includes("grain") || desc.includes("wheat") || desc.includes("rice") ||
             desc.includes("flour") || desc.includes("bulk")) {
    preferredCategory = "bulker";
  } else if (desc.includes("sand") || desc.includes("gravel") || desc.includes("stone") ||
             desc.includes("coal") || desc.includes("ore") || desc.includes("soil") ||
             desc.includes("debris") || desc.includes("aggregate") || desc.includes("murram")) {
    preferredCategory = "dumper";
  } else if (desc.includes("machine") || desc.includes("equipment") || desc.includes("vehicle") ||
             desc.includes("heavy") || desc.includes("jcb") || desc.includes("tractor") ||
             desc.includes("excavator") || desc.includes("crane")) {
    preferredCategory = "trailer";
  } else if (desc.includes("garment") || desc.includes("cloth") || desc.includes("textile") ||
             desc.includes("electronics") || desc.includes("furniture") || desc.includes("fmcg") ||
             desc.includes("packaged") || desc.includes("carton") || desc.includes("box")) {
    preferredCategory = "closed";
  } else if (weight <= 2) {
    preferredCategory = "mini_pickup";
  } else if (weight <= 6.5) {
    preferredCategory = "lcv";
  } else {
    preferredCategory = "open";
  }

  // Step 2: Within preferred category, find smallest truck whose capacityMax >= weight
  const categoryTrucks = indianTruckTypes
    .filter(t => t.category === preferredCategory)
    .sort((a, b) => a.capacityMax - b.capacityMax);

  const match = categoryTrucks.find(t => t.capacityMax >= weight);
  if (match) return match.value;

  // Step 3: Fallback — search across all categories for smallest capable truck
  const allSorted = [...indianTruckTypes].sort((a, b) => a.capacityMax - b.capacityMax);
  const fallback = allSorted.find(t => t.capacityMax >= weight);
  return fallback?.value ?? "open_18_wheeler";
}

export default function PostLoadPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedLoadId, setSubmittedLoadId] = useState<string | null>(null);
  const [submittedLoadNumber, setSubmittedLoadNumber] = useState<number | null>(null);
  const [submittedLoadDetails, setSubmittedLoadDetails] = useState<{
    pickupCity: string;
    pickupState: string;
    dropoffCity: string;
    dropoffState: string;
    weight: string;
    goods: string;
    truckType: string;
    pickupDate: string;
    specialNotes: string;
    rateType: string;
    pricePerTon: string;
    fixedPrice: string;
  } | null>(null);
  const [customCommodity, setCustomCommodity] = useState("");
  const [estimation, setEstimation] = useState<{
    distance: number;
    suggestedTruck: string;
    nearbyTrucks: number;
    aiInsight?: string | null;
    basedOnMarketData?: boolean;
    confidence?: number;
    suggestionSource?: string;
  } | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [isLoadingAiSuggestion, setIsLoadingAiSuggestion] = useState(false);

  // Check shipper onboarding status - only verified shippers can post loads
  // Poll every 5 seconds when status is pending/under_review to detect approval in real-time
  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = useQuery<any>({
    queryKey: ["/api/shipper/onboarding"],
    enabled: user?.role === "shipper",
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll frequently when waiting for approval
      if (status === "pending" || status === "under_review") {
        return 5000; // Poll every 5 seconds
      }
      return false; // Stop polling once approved/rejected
    },
  });

  // Show approval celebration dialog when shipper has been approved
  useEffect(() => {
    if (onboardingStatus?.status === "approved" && user?.id) {
      const seenKey = `approval_seen_${user.id}`;
      const hasSeen = localStorage.getItem(seenKey);
      if (!hasSeen) {
        setShowApprovalDialog(true);
        localStorage.setItem(seenKey, "true");
      }
    }
  }, [onboardingStatus?.status, user?.id]);

  // Fetch saved addresses for quick selection (same records as admin saves — keyed by shipper UUID)
  const shipperCanPostLoads =
    user?.role === "shipper" && onboardingStatus?.status === "approved";

  const { data: savedPickupAddressesRaw } = useQuery<any[]>({
    queryKey: ["/api/shipper/saved-addresses", "pickup"],
    enabled: shipperCanPostLoads,
  });

  const { data: savedDropoffAddressesRaw } = useQuery<any[]>({
    queryKey: ["/api/shipper/saved-addresses", "dropoff"],
    enabled: shipperCanPostLoads,
  });

  const savedPickupAddresses = Array.isArray(savedPickupAddressesRaw)
    ? savedPickupAddressesRaw
    : [];
  const savedDropoffAddresses = Array.isArray(savedDropoffAddressesRaw)
    ? savedDropoffAddressesRaw
    : [];

  // State for tracking if user wants to save new addresses
  const [savePickupAddress, setSavePickupAddress] = useState(false);
  const [saveDropoffAddress, setSaveDropoffAddress] = useState(false);
  const [pickupAddressLabel, setPickupAddressLabel] = useState("");
  const [dropoffAddressLabel, setDropoffAddressLabel] = useState("");
  const [savedPickupPickerOpen, setSavedPickupPickerOpen] = useState(false);
  const [savedDropoffPickerOpen, setSavedDropoffPickerOpen] = useState(false);
  const [savedAddressDeleteTarget, setSavedAddressDeleteTarget] = useState<{
    addressType: "pickup" | "dropoff";
    row: any;
  } | null>(null);
  const [isDeletingSavedAddress, setIsDeletingSavedAddress] = useState(false);

  // Pending city values to set after state updates and cities list recalculates
  const pendingPickupCityRef = useRef<string | null>(null);
  const pendingDropoffCityRef = useRef<string | null>(null);

  // Handle selecting a saved pickup address
  const handleSelectPickupAddress = (address: any) => {
    if (address) {
      form.setValue("pickupBusinessName", address.businessName || "");
      form.setValue("pickupAddress", address.address || "");
      form.setValue("pickupLocality", address.locality || "");
      form.setValue("pickupLandmark", address.landmark || "");
      form.setValue("pickupPincode", address.pincode || "");
      pendingPickupCityRef.current = address.city || "";
      form.setValue("pickupState", address.state || "", { shouldDirty: true, shouldValidate: true });
      apiRequest("POST", `/api/shipper/saved-addresses/${address.id}/use`).catch(() => {});
    }
  };

  // Handle selecting a saved dropoff address
  const handleSelectDropoffAddress = (address: any) => {
    if (address) {
      form.setValue("dropoffBusinessName", address.businessName || "");
      form.setValue("dropoffAddress", address.address || "");
      form.setValue("dropoffLocality", address.locality || "");
      form.setValue("dropoffLandmark", address.landmark || "");
      form.setValue("dropoffPincode", address.pincode || "");
      form.setValue("receiverName", address.contactName || "");
      form.setValue("receiverPhone", address.contactPhone || "");
      form.setValue("receiverEmail", address.contactEmail || "");
      pendingDropoffCityRef.current = address.city || "";
      form.setValue("dropoffState", address.state || "", { shouldDirty: true, shouldValidate: true });
      apiRequest("POST", `/api/shipper/saved-addresses/${address.id}/use`).catch(() => {});
    }
  };

  const confirmDeleteSavedAddress = async () => {
    if (!savedAddressDeleteTarget) return;
    setIsDeletingSavedAddress(true);
    try {
      await apiRequest("DELETE", `/api/shipper/saved-addresses/${savedAddressDeleteTarget.row.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/shipper/saved-addresses", "pickup"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipper/saved-addresses", "dropoff"] });
      const label =
        savedAddressDeleteTarget.row.label ||
        savedAddressDeleteTarget.row.businessName ||
        savedAddressDeleteTarget.row.city ||
        "Address";
      toast({
        title: "Saved address removed",
        description: `"${label}" was removed. You can save it again when you post a load.`,
      });
      setSavedAddressDeleteTarget(null);
    } catch {
      toast({
        title: "Could not remove address",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingSavedAddress(false);
    }
  };

  const form = useForm<LoadFormData>({
    resolver: zodResolver(loadFormSchema),
    mode: "onTouched",
    defaultValues: {
      shipperCompanyName: "",
      shipperContactName: "",
      shipperCompanyAddress: "",
      shipperPhone: "",
      pickupAddress: "",
      pickupLocality: "",
      pickupLandmark: "",
      pickupBusinessName: "",
      pickupState: "",
      pickupCity: "",
      pickupCityCustom: "",
      pickupPincode: "",
      dropoffAddress: "",
      dropoffLocality: "",
      dropoffLandmark: "",
      dropoffBusinessName: "",
      dropoffState: "",
      dropoffCity: "",
      dropoffCityCustom: "",
      dropoffPincode: "",
      receiverName: "",
      receiverPhone: "",
      receiverEmail: "",
      weight: "",
      weightUnit: "tons",
      goodsToBeCarried: "",
      specialNotes: "",
      rateType: "fixed_price",
      shipperPricePerTon: "",
      shipperFixedPrice: "",
      advancePaymentPercent: "",
      requiredTruckType: "",
      pickupDate: "",
      deliveryDate: "",
      isTemplate: false,
      templateName: "",
      preferredCarriers: false,
    },
  });

  const watchedFields = form.watch(["pickupState", "pickupCity", "dropoffState", "dropoffCity", "weight", "weightUnit", "goodsToBeCarried", "requiredTruckType"]);
  const [pickupState, pickupCity, dropoffState, dropoffCity, weight, weightUnit, goodsDescription, truckType] = watchedFields;
  
  // Helper to find state code for a given city name
  const getStateCodeForCity = (cityName: string): string | null => {
    for (const state of indianStates) {
      if (state.cities.some(c => c.name.toLowerCase() === cityName.toLowerCase())) {
        return state.code;
      }
    }
    return null;
  };
  
  // Get cities for selected states
  const pickupCities = useMemo(() => {
    if (!pickupState) return [];
    const state = indianStates.find(s => s.code === pickupState);
    return state?.cities || [];
  }, [pickupState]);
  
  const dropoffCities = useMemo(() => {
    if (!dropoffState) return [];
    const state = indianStates.find(s => s.code === dropoffState);
    return state?.cities || [];
  }, [dropoffState]);

  useEffect(() => {
    if (pendingPickupCityRef.current && pickupCities.length > 0) {
      const city = pendingPickupCityRef.current;
      pendingPickupCityRef.current = null;
      
      // Check if city exists in the list
      const cityExists = pickupCities.some(c => c.name.toLowerCase() === city.toLowerCase());
      
      if (cityExists) {
        // Find the exact match with proper casing
        const matchedCity = pickupCities.find(c => c.name.toLowerCase() === city.toLowerCase());
        form.setValue("pickupCity", matchedCity?.name || city, { shouldDirty: true, shouldValidate: true });
      } else {
        // City not in list - select "Other" and put city in custom field
        form.setValue("pickupCity", "__other__", { shouldDirty: true, shouldValidate: true });
        form.setValue("pickupCityCustom", city, { shouldDirty: true, shouldValidate: true });
      }
    }
  }, [pickupCities, form]);

  useEffect(() => {
    if (pendingDropoffCityRef.current && dropoffCities.length > 0) {
      const city = pendingDropoffCityRef.current;
      pendingDropoffCityRef.current = null;
      
      // Check if city exists in the list
      const cityExists = dropoffCities.some(c => c.name.toLowerCase() === city.toLowerCase());
      
      if (cityExists) {
        // Find the exact match with proper casing
        const matchedCity = dropoffCities.find(c => c.name.toLowerCase() === city.toLowerCase());
        form.setValue("dropoffCity", matchedCity?.name || city, { shouldDirty: true, shouldValidate: true });
      } else {
        // City not in list - select "Other" and put city in custom field
        form.setValue("dropoffCity", "__other__", { shouldDirty: true, shouldValidate: true });
        form.setValue("dropoffCityCustom", city, { shouldDirty: true, shouldValidate: true });
      }
    }
  }, [dropoffCities, form]);

  // Auto-populate shipper details from user profile and onboarding data
  useEffect(() => {
    if (user) {
      // Shipper details - auto-populate from user profile
      if (user.companyName) {
        form.setValue("shipperCompanyName", user.companyName);
      }
      if (user.phone) {
        form.setValue("shipperPhone", user.phone);
      }
      // Company address - use user's address if available
      const userAny = user as any;
      if (userAny.companyAddress) {
        form.setValue("shipperCompanyAddress", userAny.companyAddress);
      }
      // Pickup location - use user's default pickup address if available
      if (userAny.defaultPickupAddress) {
        form.setValue("pickupAddress", userAny.defaultPickupAddress);
      }
      if (userAny.defaultPickupCity) {
        form.setValue("pickupCity", userAny.defaultPickupCity);
      }
      if (userAny.defaultPickupLocality) {
        form.setValue("pickupLocality", userAny.defaultPickupLocality);
      }
      if (userAny.defaultPickupLandmark) {
        form.setValue("pickupLandmark", userAny.defaultPickupLandmark);
      }
    }
    
    // Auto-populate from onboarding data (verification form details)
    if (onboardingStatus && onboardingStatus.status === "approved") {
      // Build company address from onboarding registered address
      const address = onboardingStatus.registered_address || onboardingStatus.registeredAddress;
      const locality = onboardingStatus.registered_locality || onboardingStatus.registeredLocality;
      const city = onboardingStatus.registered_city || onboardingStatus.registeredCity;
      const state = onboardingStatus.registered_state || onboardingStatus.registeredState;
      const pincode = onboardingStatus.registered_pincode || onboardingStatus.registeredPincode;
      
      if (address && !form.getValues("shipperCompanyAddress")) {
        const addressParts = [address, locality, city, state, pincode].filter(Boolean);
        form.setValue("shipperCompanyAddress", addressParts.join(", "));
      }
    }
  }, [user, onboardingStatus, form]);

  // State for distance loading
  const [isLoadingDistance, setIsLoadingDistance] = useState(false);
  
  // Show truck suggestion immediately when weight is entered (doesn't require cities)
  // Only show when no truck type is selected (user hasn't made a choice yet)
  useEffect(() => {
    // Clear suggestion if no weight
    if (!weight) {
      setEstimation(null);
      return;
    }
    
    // Convert weight to tons for truck suggestion (if in kg, divide by 1000)
    const weightInTons = weightUnit === "kg" ? Number(weight) / 1000 : Number(weight);
    const localSuggestion = suggestTruckType(weightInTons, goodsDescription || "");
    const nearbyTrucks = Math.floor(Math.random() * 15) + 3;
    
    // Set immediate local suggestion with 0 distance (will update when cities are provided)
    setEstimation(prev => ({ 
      distance: prev?.distance || 0, 
      suggestedTruck: localSuggestion, 
      nearbyTrucks 
    }));
    
    // Only fetch AI suggestion if no truck type is manually selected
    if (!truckType) {
      const fetchAiSuggestion = async () => {
        setIsLoadingAiSuggestion(true);
        try {
          const response = await fetch("/api/loads/suggest-truck", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              weight,
              weightUnit,
              commodityType: goodsDescription || "",
              goodsDescription: goodsDescription === "other" ? customCommodity : (goodsDescription || ""),
              pickupCity,
              dropoffCity,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setEstimation(prev => ({
              distance: prev?.distance || 0,
              suggestedTruck: localSuggestion, // always use our local logic, not API
              nearbyTrucks: prev?.nearbyTrucks || nearbyTrucks,
              aiInsight: data.aiInsight,
              basedOnMarketData: data.basedOnMarketData,
              confidence: data.confidence,
              suggestionSource: data.suggestionSource,
            }));
          }
        } catch (error) {
          console.error("Failed to fetch AI suggestion:", error);
        } finally {
          setIsLoadingAiSuggestion(false);
        }
      };
      
      // Debounce the AI fetch
      const timeoutId = setTimeout(fetchAiSuggestion, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [weight, weightUnit, goodsDescription, customCommodity, truckType, pickupCity, dropoffCity]);

  // Fetch accurate road distance from Google Maps API when cities change
  useEffect(() => {
    if (!pickupCity || !dropoffCity || pickupCity === "__other__" || dropoffCity === "__other__") {
      return;
    }
    
    // Get the actual city values (handle custom cities)
    const originCity = pickupCity;
    const destCity = dropoffCity;
    
    // Add state to city for better accuracy
    const pickupState = form.getValues("pickupState");
    const dropoffState = form.getValues("dropoffState");
    
    const origin = pickupState ? `${originCity}, ${pickupState}` : originCity;
    const destination = dropoffState ? `${destCity}, ${dropoffState}` : destCity;
    
    const fetchDistance = async () => {
      setIsLoadingDistance(true);
      try {
        const response = await fetch("/api/distance/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ origin, destination }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.distance && data.source !== "unavailable") {
            console.log(`[Distance] OSRM: ${origin} -> ${destination} = ${data.distance} km`);
            setEstimation(prev => ({
              distance: data.distance,
              suggestedTruck: prev?.suggestedTruck || "",
              nearbyTrucks: prev?.nearbyTrucks || 0,
              aiInsight: prev?.aiInsight,
              basedOnMarketData: prev?.basedOnMarketData,
            }));
            return; // Success, exit early
          }
        }
        
        // Fallback to local calculation if API failed or unavailable
        console.log("[Distance] API unavailable or failed, using local fallback");
        const fallbackDistance = calculateDistance(originCity, destCity);
        setEstimation(prev => ({
          distance: fallbackDistance,
          suggestedTruck: prev?.suggestedTruck || "",
          nearbyTrucks: prev?.nearbyTrucks || 0,
          aiInsight: prev?.aiInsight,
          basedOnMarketData: prev?.basedOnMarketData,
        }));
      } catch (error) {
        console.error("Failed to fetch distance:", error);
        // Fallback to local calculation on error
        const fallbackDistance = calculateDistance(originCity, destCity);
        setEstimation(prev => ({
          distance: fallbackDistance,
          suggestedTruck: prev?.suggestedTruck || "",
          nearbyTrucks: prev?.nearbyTrucks || 0,
          aiInsight: prev?.aiInsight,
          basedOnMarketData: prev?.basedOnMarketData,
        }));
      } finally {
        setIsLoadingDistance(false);
      }
    };
    
    // Debounce the distance fetch
    const timeoutId = setTimeout(fetchDistance, 300);
    return () => clearTimeout(timeoutId);
  }, [pickupCity, dropoffCity, form]);

  const updateEstimation = () => {
  };

  const applyTemplate = (templateId: string) => {
    const template = savedTemplates.find((t) => t.id === templateId);
    if (template) {
      form.setValue("pickupCity", template.pickup);
      form.setValue("dropoffCity", template.dropoff);
      toast({ title: "Template applied", description: `Loaded "${template.name}" template.` });
    }
  };

  const handleSubmit = async (data: LoadFormData) => {
    setIsLoading(true);
    
    try {
      const truckType = data.requiredTruckType || estimation?.suggestedTruck || "Dry Van";
      
      // Use custom commodity value when "other" is selected
      const finalGoodsDescription = data.goodsToBeCarried === "other" && customCommodity
        ? customCommodity
        : data.goodsToBeCarried || "";
      
      // Use custom city values when "__other__" is selected
      const finalPickupCity = data.pickupCity === "__other__" && data.pickupCityCustom
        ? data.pickupCityCustom
        : data.pickupCity;
      const finalDropoffCity = data.dropoffCity === "__other__" && data.dropoffCityCustom
        ? data.dropoffCityCustom
        : data.dropoffCity;
      
      const response = await apiRequest("POST", "/api/loads/submit", {
        shipperCompanyName: data.shipperCompanyName,
        shipperContactName: data.shipperContactName,
        shipperCompanyAddress: data.shipperCompanyAddress,
        shipperPhone: data.shipperPhone,
        pickupAddress: data.pickupAddress,
        pickupLocality: data.pickupLocality || null,
        pickupLandmark: data.pickupLandmark || null,
        pickupBusinessName: data.pickupBusinessName || null,
        pickupCity: finalPickupCity,
        pickupState: data.pickupState?.trim() || null,
        pickupPincode: data.pickupPincode?.trim() || null,
        dropoffAddress: data.dropoffAddress,
        dropoffLocality: data.dropoffLocality || null,
        dropoffLandmark: data.dropoffLandmark || null,
        dropoffBusinessName: data.dropoffBusinessName || null,
        dropoffCity: finalDropoffCity,
        dropoffState: data.dropoffState?.trim() || null,
        dropoffPincode: data.dropoffPincode?.trim() || null,
        receiverName: data.receiverName,
        receiverPhone: data.receiverPhone,
        receiverEmail: data.receiverEmail || null,
        weight: data.weight,
        goodsToBeCarried: finalGoodsDescription,
        specialNotes: data.specialNotes || "",
        rateType: data.rateType,
        shipperPricePerTon: data.rateType === "per_ton" ? (data.shipperPricePerTon?.replace(/,/g, '') || null) : null,
        shipperFixedPrice: data.rateType === "fixed_price" ? (data.shipperFixedPrice?.replace(/,/g, '') || null) : null,
        advancePaymentPercent: data.advancePaymentPercent ? parseInt(data.advancePaymentPercent) : null,
        requiredTruckType: truckType,
        pickupDate: data.pickupDate,
        deliveryDate: data.deliveryDate || null,
      });
      
      const result = await response.json();

      setSubmittedLoadId(result.load_id);
      setSubmittedLoadNumber(result.load_number);
      const pickupStateName = indianStates.find(s => s.code === data.pickupState)?.name || data.pickupState || '';
      const dropoffStateName = indianStates.find(s => s.code === data.dropoffState)?.name || data.dropoffState || '';
      setSubmittedLoadDetails({
        pickupCity: finalPickupCity || '',
        pickupState: pickupStateName,
        dropoffCity: finalDropoffCity || '',
        dropoffState: dropoffStateName,
        weight: data.weight || '',
        goods: finalGoodsDescription,
        truckType: truckType || '',
        pickupDate: data.pickupDate || '',
        specialNotes: data.specialNotes || '',
        rateType: data.rateType,
        pricePerTon: data.shipperPricePerTon || '',
        fixedPrice: data.shipperFixedPrice || '',
      });
      setSubmitted(true);
      
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });

      // Save pickup address if checkbox was checked
      if (savePickupAddress) {
        try {
          await apiRequest("POST", "/api/shipper/saved-addresses", {
            addressType: "pickup",
            label: pickupAddressLabel || data.pickupBusinessName || `${finalPickupCity} Address`,
            businessName: data.pickupBusinessName || null,
            address: data.pickupAddress || null,
            locality: data.pickupLocality || null,
            landmark: data.pickupLandmark || null,
            city: finalPickupCity,
            state: data.pickupState,
            pincode: data.pickupPincode || null,
            isActive: true,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/shipper/saved-addresses", "pickup"] });
          queryClient.invalidateQueries({ queryKey: ["/api/shipper/saved-addresses", "dropoff"] });
        } catch (err: any) {
          const msg = err?.message || "";
          const limitHit = msg.includes("maximum of 10");
          toast({
            title: limitHit ? "Address limit reached" : "Could not save pickup address",
            description: limitHit
              ? "You already have 10 saved pickup addresses. Delete one to save a new one."
              : "The load was submitted but the pickup address could not be saved.",
            variant: "destructive",
          });
        }
      }

      // Save dropoff address if checkbox was checked
      if (saveDropoffAddress) {
        try {
          await apiRequest("POST", "/api/shipper/saved-addresses", {
            addressType: "dropoff",
            label: dropoffAddressLabel || data.dropoffBusinessName || `${finalDropoffCity} Address`,
            businessName: data.dropoffBusinessName || null,
            address: data.dropoffAddress || null,
            locality: data.dropoffLocality || null,
            landmark: data.dropoffLandmark || null,
            city: finalDropoffCity,
            state: data.dropoffState,
            pincode: data.dropoffPincode || null,
            contactName: data.receiverName || null,
            contactPhone: data.receiverPhone || null,
            contactEmail: data.receiverEmail || null,
            isActive: true,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/shipper/saved-addresses", "pickup"] });
          queryClient.invalidateQueries({ queryKey: ["/api/shipper/saved-addresses", "dropoff"] });
        } catch (err: any) {
          const msg = err?.message || "";
          const limitHit = msg.includes("maximum of 10");
          toast({
            title: limitHit ? "Address limit reached" : "Could not save dropoff address",
            description: limitHit
              ? "You already have 10 saved dropoff addresses. Delete one to save a new one."
              : "The load was submitted but the dropoff address could not be saved.",
            variant: "destructive",
          });
        }
      }

      toast({ 
        title: "Load Submitted for Review", 
        description: `Your load has been submitted. Our team will evaluate and price it shortly.` 
      });
      
    } catch (error: any) {
      console.error("Submit load error:", error);
      toast({ 
        title: "Error", 
        description: error?.message || "Something went wrong submitting your load.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Gate: Only verified shippers can post loads
  if (isLoadingOnboarding) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if shipper has not completed onboarding or is not approved
  const isApproved = onboardingStatus?.status === "approved";
  const hasSubmittedOnboarding = !!onboardingStatus;
  const isDraft = onboardingStatus?.status === "draft";
  const isOnHold = onboardingStatus?.status === "on_hold";
  const isRejected = onboardingStatus?.status === "rejected";
  const isPending = onboardingStatus?.status === "pending" || onboardingStatus?.status === "under_review";
  
  // Check if draft is empty (new shipper who hasn't started) vs has data (continuing)
  // The API returns snake_case fields from database, so check legal_company_name
  const isEmptyDraft = isDraft && (
    !onboardingStatus?.legal_company_name && 
    !onboardingStatus?.pan_number && 
    !onboardingStatus?.contact_person_name
  );

  if (!isApproved && user?.role === "shipper") {
    // Determine title and description based on status
    let title = t("postLoad.onboardingRequired");
    let description = t("postLoad.completeOnboardingDesc");
    let iconBgColor = "bg-amber-100 dark:bg-amber-900/30";
    let iconColor = "text-amber-600 dark:text-amber-400";
    
    if (isOnHold) {
      title = t("postLoad.onHoldTitle");
      description = t("postLoad.onHoldDesc");
      iconBgColor = "bg-orange-100 dark:bg-orange-900/30";
      iconColor = "text-orange-600 dark:text-orange-400";
    } else if (isRejected) {
      title = t("postLoad.rejectedTitle");
      description = t("postLoad.rejectedDesc");
      iconBgColor = "bg-red-100 dark:bg-red-900/30";
      iconColor = "text-red-600 dark:text-red-400";
    } else if (isPending) {
      description = t("postLoad.onboardingPendingDesc", { status: onboardingStatus?.status?.replace(/_/g, " ") });
    }

    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader className="text-center p-4 sm:p-6">
            <div className={`mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full ${iconBgColor} flex items-center justify-center mb-3 sm:mb-4`}>
              <AlertCircle className={`h-6 w-6 sm:h-8 sm:w-8 ${iconColor}`} />
            </div>
            <CardTitle className="text-lg sm:text-xl" data-testid="text-onboarding-required">
              {title}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            {(isOnHold || isRejected) ? (
              <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-base">{t("postLoad.contactUs")}</p>
                    <p className="text-xs sm:text-sm text-primary font-semibold">{t("postLoad.contactPhone")}</p>
                  </div>
                </div>
                {onboardingStatus?.decisionNote && (
                  <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded bg-background border">
                    <p className="text-xs sm:text-sm text-muted-foreground">{onboardingStatus.decisionNote}</p>
                  </div>
                )}
              </div>
            ) : isPending ? (
              <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-base">{t("postLoad.applicationStatus")}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground capitalize">{onboardingStatus?.status?.replace(/_/g, " ")}</p>
                  </div>
                </div>
                {onboardingStatus?.decisionNote && (
                  <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded bg-background border">
                    <p className="text-xs sm:text-sm text-muted-foreground">{onboardingStatus.decisionNote}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 sm:p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2 sm:gap-3">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-blue-700 dark:text-blue-300 text-xs sm:text-sm">
                      {t("postLoad.whyOnboarding")}
                    </p>
                    <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {t("postLoad.whyOnboardingDesc")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:gap-3">
              {isDraft && isEmptyDraft && (
                <Button onClick={() => navigate("/shipper/onboarding")} className="w-full text-sm sm:text-base" data-testid="button-start-application">
                  <FileText className="h-4 w-4 mr-2" />
                  {t("postLoad.startApplication")}
                </Button>
              )}
              {isDraft && !isEmptyDraft && (
                <Button onClick={() => navigate("/shipper/onboarding")} className="w-full text-sm sm:text-base" data-testid="button-continue-onboarding">
                  <FileText className="h-4 w-4 mr-2" />
                  {t("postLoad.continueOnboarding")}
                </Button>
              )}
              {(isOnHold || isRejected) && (
                <Button onClick={() => navigate("/shipper/onboarding")} className="w-full text-sm sm:text-base" data-testid="button-update-onboarding">
                  <FileText className="h-4 w-4 mr-2" />
                  {t("postLoad.updateOnboarding")}
                </Button>
              )}
              {isPending && (
                <Button onClick={() => navigate("/shipper/onboarding")} className="w-full text-sm sm:text-base" data-testid="button-view-application">
                  <Eye className="h-4 w-4 mr-2" />
                  {t("postLoad.viewApplication")}
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/shipper")} data-testid="button-back-dashboard" className="w-full text-sm sm:text-base">
                {t("common.backToDashboard")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader className="text-center p-4 sm:p-6">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3 sm:mb-4">
              <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-lg sm:text-xl" data-testid="text-submission-success">Load Submitted Successfully</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Your load has been submitted for admin review. You'll be notified once it's posted to carriers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">Load Number</p>
              <p className="font-mono font-semibold text-base sm:text-lg">LD-{String(submittedLoadNumber).padStart(3, '0')}</p>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-semibold text-xs sm:text-sm">Status Timeline</h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm">Submitted</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Just now</p>
                  </div>
                </div>
                <div className="ml-2.5 sm:ml-3 border-l-2 border-dashed border-muted h-3 sm:h-4" />
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0 animate-pulse">
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm">Pending Admin Review</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Our team is evaluating and pricing your load</p>
                  </div>
                </div>
                <div className="ml-2.5 sm:ml-3 border-l-2 border-dashed border-muted h-3 sm:h-4" />
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Send className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm text-muted-foreground">Posted to Carriers</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Waiting for admin to post</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2 sm:gap-3">
                <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium text-blue-700 dark:text-blue-300 text-xs sm:text-sm">What happens next?</p>
                  <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Our logistics team will review your load details, determine the optimal pricing based on current market conditions, and post it to verified carriers. You'll receive a notification once your load is live.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button onClick={() => navigate("/shipper/loads")} className="flex-1 text-sm sm:text-base" data-testid="button-view-loads">
                View My Loads
              </Button>
              <Button variant="outline" onClick={() => { setSubmitted(false); form.reset(); }} data-testid="button-post-another" className="flex-1 text-sm sm:text-base">
                Post Another Load
              </Button>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 flex items-center gap-2">
                <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
                Share Load Details
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const loadNum = `LD-${String(submittedLoadNumber).padStart(3, '0')}`;
                    const pickupDate = submittedLoadDetails?.pickupDate 
                      ? new Date(submittedLoadDetails.pickupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '';
                    const truckLabel = submittedLoadDetails?.truckType 
                      ? submittedLoadDetails.truckType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                      : '';
                    let message = `*New Load Available*\n\n`;
                    message += `*Load #:* ${loadNum}\n`;
                    message += `---\n`;
                    message += `*From:* ${submittedLoadDetails?.pickupCity || ''}, ${submittedLoadDetails?.pickupState || ''}\n`;
                    message += `*To:* ${submittedLoadDetails?.dropoffCity || ''}, ${submittedLoadDetails?.dropoffState || ''}\n`;
                    message += `---\n`;
                    message += `*Weight:* ${submittedLoadDetails?.weight || ''} Tons\n`;
                    message += `*Cargo:* ${submittedLoadDetails?.goods || ''}\n`;
                    if (truckLabel) message += `*Truck:* ${truckLabel}\n`;
                    message += `*Pricing:* Contact for rates\n`;
                    if (pickupDate) message += `*Pickup:* ${pickupDate}\n`;
                    if (submittedLoadDetails?.specialNotes) message += `*Notes:* ${submittedLoadDetails.specialNotes}\n`;
                    message += `\n*View & Bid:* https://loadpilot.in\n`;
                    message += `_Sign up as a carrier to access the marketplace_`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                  }}
                  data-testid="button-share-whatsapp"
                >
                  <SiWhatsapp className="h-4 w-4 mr-2 text-green-500" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const loadNum = `LD-${String(submittedLoadNumber).padStart(3, '0')}`;
                    const pickupDate = submittedLoadDetails?.pickupDate 
                      ? new Date(submittedLoadDetails.pickupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : '';
                    const truckLabel = submittedLoadDetails?.truckType 
                      ? submittedLoadDetails.truckType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                      : '';
                    let message = `New Load Available!\n`;
                    message += `Load #: ${loadNum}\n`;
                    message += `From: ${submittedLoadDetails?.pickupCity || ''}, ${submittedLoadDetails?.pickupState || ''}\n`;
                    message += `To: ${submittedLoadDetails?.dropoffCity || ''}, ${submittedLoadDetails?.dropoffState || ''}\n`;
                    message += `Weight: ${submittedLoadDetails?.weight || ''} Tons\n`;
                    message += `Cargo: ${submittedLoadDetails?.goods || ''}\n`;
                    if (truckLabel) message += `Truck: ${truckLabel}\n`;
                    message += `Pricing: Contact for rates\n`;
                    if (pickupDate) message += `Pickup: ${pickupDate}\n`;
                    message += `\nView & Bid: https://loadpilot.in`;
                    window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank');
                  }}
                  data-testid="button-share-sms"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Text Message
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full overflow-x-hidden">
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-xl text-center" data-testid="text-approval-title">
              {t("postLoad.approvalCongrats")}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t("postLoad.approvalMessage")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button 
              onClick={() => setShowApprovalDialog(false)} 
              className="w-full"
              data-testid="button-continue-application"
            >
              {t("postLoad.continueToApplication")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-4 sm:mb-6 px-1">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Submit New Load</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Fill in the details below. We will evaluate and price your load - you'll be notified when it's posted.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start flex-1 w-full">
        <div className="flex-1 space-y-4 sm:space-y-6 min-w-0 w-full max-w-full">
          {savedTemplates.length > 0 && (
            <Card className="w-full">
              <CardHeader className="pb-3 p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-base">Saved Templates</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Quickly fill in details from your saved routes</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-wrap gap-2">
                  {savedTemplates.map((template) => (
                    <Button
                      key={template.id}
                      variant="outline"
                      size="sm"
                      onClick={() => applyTemplate(template.id)}
                      data-testid={`button-template-${template.id}`}
                      className="text-xs sm:text-sm"
                    >
                      {template.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6 w-full">
              <Card className="w-full overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span>Shipper Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="shipperCompanyName"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className="text-sm">Company Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-shipper-company-name" className="text-sm w-full" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shipperContactName"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className="text-sm">Contact Person Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-shipper-contact-name" className="text-sm w-full" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="shipperCompanyAddress"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className="text-sm">Company Address</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-shipper-company-address" className="text-sm w-full" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shipperPhone"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className="text-sm">Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            inputMode="numeric"
                            maxLength={15}
                            onBlur={() => { field.onBlur(); void form.trigger("shipperPhone"); }}
                            data-testid="input-shipper-phone"
                            className="text-sm w-full"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="w-full overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Pickup Location</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  {/* Saved Pickup Addresses Selector */}
                  {savedPickupAddresses.length > 0 && (
                    <div className="space-y-2">
                      <FormLabel className="text-sm">Select from Saved Addresses</FormLabel>
                      <Popover open={savedPickupPickerOpen} onOpenChange={setSavedPickupPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={savedPickupPickerOpen}
                            className="w-full justify-between font-normal h-auto min-h-10 py-2 text-left"
                            data-testid="select-saved-pickup-address"
                          >
                            <span className="truncate text-muted-foreground">Choose a saved pickup address</span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-1 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)]" align="start">
                          <ul className="max-h-[min(280px,40vh)] overflow-y-auto py-0.5">
                            {savedPickupAddresses.map((addr: any) => (
                              <li key={addr.id} className="flex items-stretch rounded-md hover:bg-accent">
                                <button
                                  type="button"
                                  className="flex-1 text-left px-3 py-2 text-sm min-w-0 rounded-l-md"
                                  onClick={() => {
                                    handleSelectPickupAddress(addr);
                                    setSavedPickupPickerOpen(false);
                                  }}
                                >
                                  <span className="font-medium block truncate">
                                    {addr.label || addr.businessName || "Unnamed Address"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {addr.city}, {addr.state}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className="shrink-0 w-11 flex items-center justify-center rounded-r-md border-l border-border bg-destructive/10 text-destructive hover:bg-destructive/20"
                                  aria-label="Remove saved pickup address"
                                  title="Remove saved address"
                                  data-testid={`button-delete-saved-pickup-${addr.id}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSavedPickupPickerOpen(false);
                                    setSavedAddressDeleteTarget({ addressType: "pickup", row: addr });
                                  }}
                                >
                                  <X className="h-4 w-4" strokeWidth={2.5} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">Or enter a new address below</p>
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="pickupBusinessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name <span className="text-muted-foreground font-normal">(e.g. ABC Warehouse)</span></FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-pickup-business-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pickupAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value || ""}
                            onChange={field.onChange}
                            onAddressSelect={(address) => {
                              const streetValue = address.streetAddress || address.formattedAddress;
                              form.setValue("pickupAddress", streetValue, { shouldDirty: true, shouldValidate: true });
                              if (address.state) {
                                const matchingState = indianStates.find(s => 
                                  s.name.toLowerCase() === address.state.toLowerCase() ||
                                  s.code.toLowerCase() === address.state.toLowerCase()
                                );
                                if (matchingState) {
                                  form.setValue("pickupState", matchingState.code, { shouldDirty: true, shouldValidate: true });
                                }
                              }
                              if (address.city) {
                                pendingPickupCityRef.current = address.city;
                              }
                              if (address.postalCode) {
                                form.setValue("pickupPincode", address.postalCode, { shouldDirty: true, shouldValidate: true });
                              }
                            }}
                            placeholder="Search for pickup address"
                            data-testid="input-pickup-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="pickupLocality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Locality / Area</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-pickup-locality" className="text-sm" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pickupLandmark"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Landmark (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-pickup-landmark" className="text-sm" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="pickupState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <Select 
                            onValueChange={(val) => {
                              const prevCity = form.getValues("pickupCity");
                              const prevCustomCity = form.getValues("pickupCityCustom");
                              field.onChange(val);
                              form.setValue("pickupCity", "");
                              // If there was a city set, check if it exists in the new state
                              const cityToCheck = prevCity && prevCity !== "__other__" ? prevCity : prevCustomCity;
                              if (cityToCheck) {
                                const newStateCities = indianStates.find(s => s.code === val)?.cities || [];
                                const match = newStateCities.find(c => c.name.toLowerCase() === cityToCheck.toLowerCase());
                                if (match) {
                                  setTimeout(() => form.setValue("pickupCity", match.name, { shouldDirty: true }), 0);
                                }
                              }
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-pickup-state">
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
                      control={form.control}
                      name="pickupCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <Select 
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val !== "__other__") {
                                form.setValue("pickupCityCustom", "");
                                // Auto-update state if city is selected and state doesn't match
                                const correctState = getStateCodeForCity(val);
                                if (correctState && correctState !== pickupState) {
                                  form.setValue("pickupState", correctState, { shouldDirty: true });
                                }
                              }
                            }} 
                            value={field.value}
                            disabled={!pickupState}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-pickup-city">
                                <SelectValue placeholder={pickupState ? "Select city" : "Select state first"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <ScrollArea className="h-[300px]">
                                {pickupCities.map((city) => (
                                  <SelectItem key={city.name} value={city.name}>
                                    {city.name} {city.isMetro && <Badge variant="secondary" className="ml-2 text-xs">Metro</Badge>}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__other__" className="text-muted-foreground">
                                  Other (Enter manually)
                                </SelectItem>
                              </ScrollArea>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {form.watch("pickupCity") === "__other__" && (
                    <FormField
                      control={form.control}
                      name="pickupCityCustom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Enter City Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-pickup-city-custom" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="pickupPincode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pincode</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter pincode" {...field} data-testid="input-pickup-pincode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Save Pickup Address Checkbox */}
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <input 
                      type="checkbox" 
                      id="save-pickup-address" 
                      checked={savePickupAddress}
                      onChange={(e) => setSavePickupAddress(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                      data-testid="checkbox-save-pickup-address"
                    />
                    <label htmlFor="save-pickup-address" className="text-sm text-muted-foreground cursor-pointer">
                      Save this pickup address for future use
                    </label>
                  </div>
                  {savePickupAddress && (
                    <div className="mt-2">
                      <label className="text-sm text-muted-foreground mb-1 block">Address Label <span className="font-normal">(e.g. Mumbai Warehouse)</span></label>
                      <Input 
                        placeholder="" 
                        value={pickupAddressLabel}
                        onChange={(e) => setPickupAddressLabel(e.target.value)}
                        data-testid="input-pickup-address-label"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="w-full overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span>Dropoff Location</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  {/* Saved Dropoff Addresses Selector */}
                  {savedDropoffAddresses.length > 0 && (
                    <div className="space-y-2">
                      <FormLabel className="text-sm">Select from Saved Addresses</FormLabel>
                      <Popover open={savedDropoffPickerOpen} onOpenChange={setSavedDropoffPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={savedDropoffPickerOpen}
                            className="w-full justify-between font-normal h-auto min-h-10 py-2 text-left"
                            data-testid="select-saved-dropoff-address"
                          >
                            <span className="truncate text-muted-foreground">Choose a saved dropoff address</span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-1 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)]" align="start">
                          <ul className="max-h-[min(280px,40vh)] overflow-y-auto py-0.5">
                            {savedDropoffAddresses.map((addr: any) => (
                              <li key={addr.id} className="flex items-stretch rounded-md hover:bg-accent">
                                <button
                                  type="button"
                                  className="flex-1 text-left px-3 py-2 text-sm min-w-0 rounded-l-md"
                                  onClick={() => {
                                    handleSelectDropoffAddress(addr);
                                    setSavedDropoffPickerOpen(false);
                                  }}
                                >
                                  <span className="font-medium block truncate">
                                    {addr.label || addr.businessName || "Unnamed Address"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {addr.city}, {addr.state}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className="shrink-0 w-11 flex items-center justify-center rounded-r-md border-l border-border bg-destructive/10 text-destructive hover:bg-destructive/20"
                                  aria-label="Remove saved dropoff address"
                                  title="Remove saved address"
                                  data-testid={`button-delete-saved-dropoff-${addr.id}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSavedDropoffPickerOpen(false);
                                    setSavedAddressDeleteTarget({ addressType: "dropoff", row: addr });
                                  }}
                                >
                                  <X className="h-4 w-4" strokeWidth={2.5} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">Or enter a new address below</p>
                    </div>
                  )}
                  <FormField
                    control={form.control}
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
                  <FormField
                    control={form.control}
                    name="dropoffAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value || ""}
                            onChange={field.onChange}
                            onAddressSelect={(address) => {
                              const streetValue = address.streetAddress || address.formattedAddress;
                              form.setValue("dropoffAddress", streetValue, { shouldDirty: true, shouldValidate: true });
                              if (address.state) {
                                const matchingState = indianStates.find(s => 
                                  s.name.toLowerCase() === address.state.toLowerCase() ||
                                  s.code.toLowerCase() === address.state.toLowerCase()
                                );
                                if (matchingState) {
                                  form.setValue("dropoffState", matchingState.code, { shouldDirty: true, shouldValidate: true });
                                }
                              }
                              if (address.city) {
                                pendingDropoffCityRef.current = address.city;
                              }
                              if (address.postalCode) {
                                form.setValue("dropoffPincode", address.postalCode, { shouldDirty: true, shouldValidate: true });
                              }
                            }}
                            placeholder="Search for dropoff address"
                            data-testid="input-dropoff-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="dropoffLocality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Locality / Area</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-dropoff-locality" className="text-sm" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dropoffLandmark"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Landmark (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-dropoff-landmark" className="text-sm" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="dropoffState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <Select 
                            onValueChange={(val) => {
                              const prevCity = form.getValues("dropoffCity");
                              const prevCustomCity = form.getValues("dropoffCityCustom");
                              field.onChange(val);
                              form.setValue("dropoffCity", "");
                              // If there was a city set, check if it exists in the new state
                              const cityToCheck = prevCity && prevCity !== "__other__" ? prevCity : prevCustomCity;
                              if (cityToCheck) {
                                const newStateCities = indianStates.find(s => s.code === val)?.cities || [];
                                const match = newStateCities.find(c => c.name.toLowerCase() === cityToCheck.toLowerCase());
                                if (match) {
                                  setTimeout(() => form.setValue("dropoffCity", match.name, { shouldDirty: true }), 0);
                                }
                              }
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-dropoff-state">
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
                      control={form.control}
                      name="dropoffCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <Select 
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val !== "__other__") {
                                form.setValue("dropoffCityCustom", "");
                                // Auto-update state if city is selected and state doesn't match
                                const correctState = getStateCodeForCity(val);
                                if (correctState && correctState !== dropoffState) {
                                  form.setValue("dropoffState", correctState, { shouldDirty: true });
                                }
                              }
                            }} 
                            value={field.value}
                            disabled={!dropoffState}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-dropoff-city">
                                <SelectValue placeholder={dropoffState ? "Select city" : "Select state first"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <ScrollArea className="h-[300px]">
                                {dropoffCities.map((city) => (
                                  <SelectItem key={city.name} value={city.name}>
                                    {city.name} {city.isMetro && <Badge variant="secondary" className="ml-2 text-xs">Metro</Badge>}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__other__" className="text-muted-foreground">
                                  Other (Enter manually)
                                </SelectItem>
                              </ScrollArea>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {form.watch("dropoffCity") === "__other__" && (
                    <FormField
                      control={form.control}
                      name="dropoffCityCustom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Enter City Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-dropoff-city-custom" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="dropoffPincode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pincode</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter pincode" {...field} data-testid="input-dropoff-pincode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Save Dropoff Address Checkbox */}
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <input 
                      type="checkbox" 
                      id="save-dropoff-address" 
                      checked={saveDropoffAddress}
                      onChange={(e) => setSaveDropoffAddress(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                      data-testid="checkbox-save-dropoff-address"
                    />
                    <label htmlFor="save-dropoff-address" className="text-sm text-muted-foreground cursor-pointer">
                      Save this dropoff address for future use
                    </label>
                  </div>
                  {saveDropoffAddress && (
                    <div className="mt-2">
                      <label className="text-sm text-muted-foreground mb-1 block">Address Label <span className="font-normal">(e.g. Delhi Distribution Center)</span></label>
                      <Input 
                        placeholder="" 
                        value={dropoffAddressLabel}
                        onChange={(e) => setDropoffAddressLabel(e.target.value)}
                        data-testid="input-dropoff-address-label"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="w-full overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <span>Receiver Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="receiverName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receiver Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-receiver-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="receiverPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receiver Phone</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              inputMode="numeric"
                              maxLength={15}
                              onBlur={() => { field.onBlur(); void form.trigger("receiverPhone"); }}
                              data-testid="input-receiver-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="receiverEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receiver Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            {...field}
                            onBlur={() => { field.onBlur(); void form.trigger("receiverEmail"); }}
                            data-testid="input-receiver-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="w-full overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Package className="h-4 w-4 flex-shrink-0" />
                    <span>Cargo Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input 
                                type="number" 
                                {...field}
                                onBlur={(e) => { field.onBlur(); updateEstimation(); }}
                                data-testid="input-weight"
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <Select
                                defaultValue="tons"
                                onValueChange={(value) => form.setValue("weightUnit", value)}
                              >
                                <SelectTrigger className="w-24">
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
                      control={form.control}
                      name="requiredTruckType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Truck Type</FormLabel>
                          <FormControl>
                            <TruckTypeSelector
                              value={field.value}
                              onChange={(value) => { field.onChange(value); updateEstimation(); }}
                              suggestedTruck={estimation?.suggestedTruck}
                            />
                          </FormControl>
                          {estimation?.suggestedTruck && !field.value && (
                            <div className="space-y-1.5 mt-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                              <FormDescription className="flex items-center gap-2 text-primary font-medium">
                                {isLoadingAiSuggestion ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5" />
                                )}
                                <span>
                                  {estimation.suggestionSource === "ai_ml" 
                                    ? "AI/ML Recommended" 
                                    : estimation.basedOnMarketData 
                                      ? "Market Trend Based" 
                                      : "Suggested"}: {getTruckLabel(estimation.suggestedTruck)}
                                </span>
                                {estimation.confidence && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
                                    {estimation.confidence}% match
                                  </Badge>
                                )}
                              </FormDescription>
                              {estimation.aiInsight && (
                                <p className="text-xs text-muted-foreground pl-6 italic">
                                  {estimation.aiInsight}
                                </p>
                              )}
                              {estimation.basedOnMarketData && !estimation.aiInsight && (
                                <p className="text-xs text-muted-foreground pl-6">
                                  Based on weight, commodity type, and market trends for similar loads
                                </p>
                              )}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="goodsToBeCarried"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Goods to be Carried</FormLabel>
                        <CommodityCombobox 
                          value={field.value}
                          onChange={(value) => { field.onChange(value); updateEstimation(); }}
                          customValue={customCommodity}
                          onCustomChange={setCustomCommodity}
                        />
                        <FormDescription className="text-xs">
                          Type to search or select the type of goods you need to transport
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="specialNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            data-testid="input-special-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="w-full overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 flex-shrink-0" />
                    <span>Your Pricing Preference</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  <FormField
                    control={form.control}
                    name="rateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-rate-type">
                              <SelectValue placeholder="Select rate type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="per_ton">Per Tonne Rate</SelectItem>
                            <SelectItem value="fixed_price">Fixed Price</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          Choose whether you want to pay per tonne or a fixed price for the entire load
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className={form.watch("rateType") === "per_ton" ? "" : "hidden"}>
                    <FormField
                      control={form.control}
                      name="shipperPricePerTon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price per Tonne <span className="text-muted-foreground font-normal">(e.g. 1,50,000)</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">Rs.</span>
                              <Input
                                type="text"
                                inputMode="numeric"
                                className="pl-10"
                                placeholder=""
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9,]/g, '');
                                  field.onChange(value);
                                }}
                                data-testid="input-price-per-ton"
                              />
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs">
                            This helps our team understand your budget expectations
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className={form.watch("rateType") === "fixed_price" ? "" : "hidden"}>
                    <FormField
                      control={form.control}
                      name="shipperFixedPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fixed Price <span className="text-muted-foreground font-normal">(e.g. 1,50,000)</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">Rs.</span>
                              <Input
                                type="text"
                                inputMode="numeric"
                                className="pl-10"
                                placeholder=""
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9,]/g, '');
                                  field.onChange(value);
                                }}
                                data-testid="input-fixed-price"
                              />
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs">
                            Total amount for the entire load
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="advancePaymentPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Advance Payment Percentage</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, '');
                                const numValue = parseInt(value);
                                if (value === '' || (numValue >= 0 && numValue <= 100)) {
                                  field.onChange(value);
                                }
                              }}
                              data-testid="input-advance-percent"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">%</span>
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs">
                          Percentage of total price you prefer to pay as advance
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="w-full overflow-hidden">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>Schedule</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="pickupDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pickup Date</FormLabel>
                          <FormControl>
                            <AppDateTimePicker
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deliveryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Date</FormLabel>
                          <FormControl>
                            <AppDateTimePicker
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <Button type="submit" className="flex-1 w-full sm:w-auto text-sm sm:text-base" disabled={isLoading} data-testid="button-submit-load">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit for Admin Review
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" className="w-full sm:w-auto text-sm sm:text-base" data-testid="button-save-template">
                  <Save className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Save as Template</span>
                  <span className="sm:hidden">Save Template</span>
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <div className="hidden lg:block w-80 shrink-0">
          <Card className="sticky top-6">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span>How It Works</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                  We handle the pricing for you
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Our logistics experts will evaluate your load and determine the optimal market rate. You'll be notified once your load is priced and posted to verified carriers.
                </p>
              </div>

              {estimation && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated Distance</span>
                    {isLoadingDistance ? (
                      <span className="text-sm text-muted-foreground animate-pulse">Calculating...</span>
                    ) : estimation.distance > 0 ? (
                      <span className="font-semibold">{estimation.distance.toLocaleString()} km</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Enter locations</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Suggested Truck</span>
                    <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                      {getTruckLabel(estimation.suggestedTruck)}
                    </Badge>
                  </div>
                </div>
              )}

              {estimation && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Truck className="h-4 w-4" />
                    <span className="font-medium">{estimation.nearbyTrucks} trucks available</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    Ready in your region
                  </p>
                </div>
              )}

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>Competitive market-based pricing</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>Verified and rated carriers only</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>Full tracking and documentation</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={!!savedAddressDeleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeletingSavedAddress) setSavedAddressDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove saved address?</AlertDialogTitle>
            <AlertDialogDescription>
              {savedAddressDeleteTarget
                ? `This will remove "${savedAddressDeleteTarget.row.label || savedAddressDeleteTarget.row.businessName || savedAddressDeleteTarget.row.city || "this address"}" from your saved ${savedAddressDeleteTarget.addressType} addresses. You can add it again later when posting a load.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSavedAddress}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingSavedAddress}
              onClick={() => void confirmDeleteSavedAddress()}
              data-testid="button-confirm-delete-saved-address"
            >
              {isDeletingSavedAddress ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
