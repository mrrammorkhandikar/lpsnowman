import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Package, Calendar, Truck, ArrowRight, Sparkles, Info, Clock, CheckCircle2, Send, Building2, ChevronRight, Container, Droplet, Check, ChevronsUpDown, Loader2, Phone, DollarSign, Users, ClipboardList, User, X, Search, Calculator, TrendingUp, IndianRupee, Percent, BarChart3, Scale } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppDateTimePicker } from "@/components/ui/date-time-picker";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useAdminData } from "@/lib/admin-data-store";
import { indianTruckTypes, truckBodyCategories } from "@shared/schema";
import { indianStates } from "@shared/indian-locations";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const ratePerKmByType: Record<string, number> = {
  "17 ft": 38,
  "19 ft": 40,
  "20 ft": 42,
  "22 ft": 45,
  "24 ft": 48,
  "28 ft SXL": 52,
  "28 ft MXL": 55,
  "32 ft SXL": 58,
  "32 ft MXL": 62,
  "Open Truck": 45,
  "Trailer 20ft": 65,
  "Trailer 40ft": 75,
  "Container 20ft": 60,
  "Container 40ft": 70,
  "Taurus 14T": 55,
  "Taurus 16T": 58,
  "Taurus 21T": 62,
  "TATA Ace": 25,
  "Bolero Pickup": 28,
};

function estimateDistance(pickup: string, drop: string): number {
  const distanceMap: Record<string, number> = {
    "mumbai_delhi": 1400, "delhi_mumbai": 1400,
    "bangalore_chennai": 350, "chennai_bangalore": 350,
    "bengaluru_chennai": 350, "chennai_bengaluru": 350,
    "kolkata_delhi": 1500, "delhi_kolkata": 1500,
    "mumbai_chennai": 1340, "chennai_mumbai": 1340,
    "bangalore_hyderabad": 570, "hyderabad_bangalore": 570,
    "bengaluru_hyderabad": 570, "hyderabad_bengaluru": 570,
    "delhi_jaipur": 280, "jaipur_delhi": 280,
    "mumbai_pune": 150, "pune_mumbai": 150,
    "bhiwandi_ahmedabad": 530, "ahmedabad_bhiwandi": 530,
    "ahmedabad_mumbai": 524, "mumbai_ahmedabad": 524,
    "ludhiana_jaipur": 580, "jaipur_ludhiana": 580,
    "kolkata_guwahati": 980, "guwahati_kolkata": 980,
    "delhi_ludhiana": 310, "ludhiana_delhi": 310,
    "chennai_hyderabad": 625, "hyderabad_chennai": 625,
    "surat_mumbai": 284, "mumbai_surat": 284,
    "ahmedabad_surat": 265, "surat_ahmedabad": 265,
    "nagpur_mumbai": 840, "mumbai_nagpur": 840,
    "indore_mumbai": 585, "mumbai_indore": 585,
  };
  const key = `${pickup.toLowerCase().split(",")[0].trim()}_${drop.toLowerCase().split(",")[0].trim()}`;
  return distanceMap[key] || Math.floor(400 + Math.random() * 1200);
}

function calculatePricingBreakdown(pickupCity: string, dropoffCity: string, weight: number, truckType: string) {
  const distanceKm = estimateDistance(pickupCity, dropoffCity);
  const baseRate = ratePerKmByType[truckType] || 45;
  let baseAmount = distanceKm * baseRate;
  if (weight > 5) {
    baseAmount *= (1 + (weight - 5) * 0.02);
  }
  const fuelSurcharge = Math.round(baseAmount * 0.12);
  const platformFee = Math.round(baseAmount * 0.08);
  const handlingFee = 500;
  const suggestedPrice = Math.round(baseAmount + fuelSurcharge + platformFee + handlingFee);
  return {
    suggestedPrice,
    breakdown: {
      baseAmount: Math.round(baseAmount),
      fuelSurcharge,
      platformFee,
      handlingFee,
    },
    params: {
      distanceKm,
      weightTons: weight,
      baseRatePerKm: baseRate,
    },
  };
}

// Admin load form schema - includes admin pricing fields
const adminLoadFormSchema = z.object({
  shipperCompanyName: z.string().min(2, "Company name is required"),
  shipperContactName: z.string().min(2, "Contact name is required"),
  shipperCompanyAddress: z.string().min(5, "Company address is required"),
  shipperPhone: z.string().min(10, "Valid phone number is required"),
  pickupAddress: z.string().min(5, "Pickup address is required"),
  pickupLocality: z.string().optional(),
  pickupLandmark: z.string().optional(),
  pickupBusinessName: z.string().min(2, "Business name is required"),
  pickupState: z.string().min(1, "Pickup state is required"),
  pickupCity: z.string().min(2, "Pickup city is required"),
  pickupCityCustom: z.string().optional(),
  pickupPincode: z.string().optional(),
  dropoffAddress: z.string().min(5, "Dropoff address is required"),
  dropoffLocality: z.string().optional(),
  dropoffLandmark: z.string().optional(),
  dropoffBusinessName: z.string().optional(),
  dropoffState: z.string().min(1, "Dropoff state is required"),
  dropoffCity: z.string().min(2, "Dropoff city is required"),
  dropoffCityCustom: z.string().optional(),
  dropoffPincode: z.string().optional(),
  receiverName: z.string().min(2, "Receiver name is required"),
  receiverPhone: z.string().min(10, "Valid receiver phone number is required"),
  receiverEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  weight: z.string().min(1, "Weight is required"),
  weightUnit: z.string().default("tons"),
  goodsToBeCarried: z.string().min(2, "Please specify goods to be carried"),
  specialNotes: z.string().optional(),
  rateType: z.enum(["per_ton", "fixed_price"]).default("fixed_price"),
  shipperPricePerTon: z.string().optional(),
  shipperFixedPrice: z.string().optional(),
  advancePaymentPercent: z.string().optional(),
  requiredTruckType: z.string().optional(),
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().optional(),
  // Admin pricing fields
  postImmediately: z.boolean().default(false),
  adminGrossPrice: z.string().optional(),
  platformMargin: z.string().optional(),
  carrierAdvancePercent: z.string().optional(),
  // Admin employee details (who is filling the form)
  adminEmployeeCode: z.string().optional(),
  adminEmployeeName: z.string().optional(),
}).refine((data) => {
  if (data.rateType === "per_ton") {
    return data.shipperPricePerTon && data.shipperPricePerTon.trim() !== "";
  }
  return true;
}, {
  message: "Price per tonne is required",
  path: ["shipperPricePerTon"],
}).refine((data) => {
  if (data.rateType === "fixed_price") {
    return data.shipperFixedPrice && data.shipperFixedPrice.trim() !== "";
  }
  return true;
}, {
  message: "Fixed price is required",
  path: ["shipperFixedPrice"],
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

type AdminLoadFormData = z.infer<typeof adminLoadFormSchema>;

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

// Searchable Commodity Combobox Component
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
  
  const selectedCommodity = value ? allCommodities.find(c => c.value === value) : null;
  const isCustomSelected = value === "other";

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
            data-testid="admin-select-goods-to-be-carried"
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
                        onChange(item.value);
                        if (item.value !== "other") {
                          onCustomChange("");
                        }
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          value === item.value ? "opacity-100" : "opacity-0"
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
      
      {isCustomSelected && (
        <Input
          placeholder="Enter your commodity type..."
          value={customValue || ""}
          onChange={(e) => onCustomChange(e.target.value)}
          className="mt-2"
          data-testid="admin-input-custom-commodity"
        />
      )}
    </div>
  );
}

const truckTypesByCategory = truckBodyCategories.reduce((acc, category) => {
  acc[category.id] = indianTruckTypes.filter(t => t.category === category.id);
  return acc;
}, {} as Record<string, typeof indianTruckTypes[number][]>);

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
        data-testid="admin-select-truck-type"
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
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          {!selectedCategory ? (
            <>
              <SheetHeader className="p-4 sm:p-6 border-b shrink-0">
                <SheetTitle className="text-base sm:text-lg">Choose a Body Type</SheetTitle>
                <SheetDescription className="text-xs sm:text-sm">What type of truck is required?</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-3 sm:p-4 space-y-2">
                  {truckBodyCategories.map((category) => {
                    const trucksInCategory = truckTypesByCategory[category.id] || [];
                    if (trucksInCategory.length === 0) return null;
                    
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover-elevate active-elevate-2 rounded-md text-left"
                        onClick={() => handleCategorySelect(category.id)}
                        data-testid={`admin-category-${category.id}`}
                      >
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                          {category.id === "container" ? (
                            <Container className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                          ) : category.id === "tanker" ? (
                            <Droplet className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                          ) : (
                            <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm sm:text-base truncate">{category.name}</div>
                          <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                            {category.tonnageRange}, {category.description}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              <SheetHeader className="p-4 sm:p-6 border-b shrink-0">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    data-testid="admin-button-back-category"
                    className="shrink-0"
                  >
                    <ArrowRight className="h-4 w-4 rotate-180" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-base sm:text-lg truncate">
                      {truckBodyCategories.find(c => c.id === selectedCategory)?.name}
                    </SheetTitle>
                    <SheetDescription className="text-xs sm:text-sm">Select a specific truck configuration</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-3 sm:p-4 space-y-2">
                  {truckTypesByCategory[selectedCategory]?.map((truck) => (
                    <button
                      key={truck.value}
                      type="button"
                      className={`w-full flex items-center justify-between gap-3 p-3 sm:p-4 rounded-md text-left hover-elevate active-elevate-2 ${
                        value === truck.value ? "bg-primary/10 border border-primary" : ""
                      }`}
                      onClick={() => handleTruckSelect(truck.value)}
                      data-testid={`admin-truck-${truck.value}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm sm:text-base truncate">{truck.label}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
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

function suggestTruckType(weight: number, description: string): string {
  const desc = description.toLowerCase();

  // Step 1: Determine preferred category from goods description
  let preferredCategory: string | null = null;

  if (desc.includes("frozen") || desc.includes("cold") || desc.includes("perishable") ||
      desc.includes("dairy") || desc.includes("ice cream") || desc.includes("medicine") ||
      desc.includes("pharma") || desc.includes("refrigerat")) {
    preferredCategory = "container"; // reefer/container for cold chain
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
    preferredCategory = "open"; // default for general goods
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

export default function AdminPostLoadPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { refetchUsers } = useAdminData();
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
    postImmediately: boolean;
  } | null>(null);
  const [customCommodity, setCustomCommodity] = useState("");
  const [estimation, setEstimation] = useState<{
    distance: number;
    suggestedTruck: string;
    nearbyTrucks: number;
  } | null>(null);
  const [selectedShipperId, setSelectedShipperId] = useState<string | null>(null);
  const [shipperSearchOpen, setShipperSearchOpen] = useState(false);
  const [shipperSearchQuery, setShipperSearchQuery] = useState("");
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

  // Type for shipper from API
  type ShipperOption = {
    id: string;
    username: string;
    email: string;
    companyName: string | null;
    companyAddress: string | null;
    phone: string | null;
    isVerified: boolean | null;
  };

  // Fetch all shippers for the dropdown
  const { data: allShippers = [], isLoading: shippersLoading } = useQuery<ShipperOption[]>({
    queryKey: ['/api/admin/shippers/verified'],
  });

  // Filter shippers based on search query
  const filteredShippers = allShippers.filter((shipper) => {
    if (!shipperSearchQuery.trim()) return true;
    const searchLower = shipperSearchQuery.toLowerCase();
    return (
      (shipper.companyName?.toLowerCase().includes(searchLower)) ||
      (shipper.username?.toLowerCase().includes(searchLower)) ||
      (shipper.email?.toLowerCase().includes(searchLower)) ||
      (shipper.phone?.toLowerCase().includes(searchLower))
    );
  });

  // Click outside to close shipper dropdown
  const shipperDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shipperDropdownRef.current && !shipperDropdownRef.current.contains(event.target as Node)) {
        setShipperSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: savedPickupAddressesRaw } = useQuery<any[]>({
    queryKey: [`/api/admin/saved-addresses/${selectedShipperId}/pickup`],
    enabled: !!selectedShipperId,
  });
  const { data: savedDropoffAddressesRaw } = useQuery<any[]>({
    queryKey: [`/api/admin/saved-addresses/${selectedShipperId}/dropoff`],
    enabled: !!selectedShipperId,
  });
  const savedPickupAddresses = Array.isArray(savedPickupAddressesRaw)
    ? savedPickupAddressesRaw
    : [];
  const savedDropoffAddresses = Array.isArray(savedDropoffAddressesRaw)
    ? savedDropoffAddressesRaw
    : [];

  const form = useForm<AdminLoadFormData>({
    resolver: zodResolver(adminLoadFormSchema),
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
      postImmediately: false,
      adminGrossPrice: "",
      platformMargin: "10",
      carrierAdvancePercent: "30",
      adminEmployeeCode: "",
      adminEmployeeName: "",
    },
  });

  const watchedFields = form.watch(["pickupState", "pickupCity", "dropoffState", "dropoffCity", "weight", "weightUnit", "goodsToBeCarried", "requiredTruckType"]);
  const [pickupState, pickupCity, dropoffState, dropoffCity, weight, weightUnit, goodsDescription, truckType] = watchedFields;
  
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

  const handleSelectPickupAddress = (address: any) => {
    if (address) {
      form.setValue("pickupBusinessName", address.businessName || "");
      form.setValue("pickupAddress", address.address || "");
      form.setValue("pickupLocality", address.locality || "");
      form.setValue("pickupLandmark", address.landmark || "");
      form.setValue("pickupPincode", address.pincode || "");
      apiRequest("POST", `/api/admin/saved-addresses/${address.id}/use`).catch(() => {});
      
      // Set state first
      if (address.state) {
        form.setValue("pickupState", address.state || "", { shouldDirty: true, shouldValidate: true });
        
        // After state is set, set city
        setTimeout(() => {
          if (address.city) {
            const matchingState = indianStates.find(s => s.code === address.state);
            if (matchingState) {
              const stateCities = matchingState.cities || [];
              const matchingCity = stateCities.find(c => c.name === address.city);
              
              if (matchingCity) {
                form.setValue("pickupCity", address.city, { shouldDirty: true, shouldValidate: true });
              } else {
                // City not in list, use "Other" option
                form.setValue("pickupCity", "__other__", { shouldDirty: true, shouldValidate: true });
                form.setValue("pickupCityCustom", address.city, { shouldDirty: true, shouldValidate: true });
              }
            }
          }
        }, 100);
      }
    }
  };

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
      apiRequest("POST", `/api/admin/saved-addresses/${address.id}/use`).catch(() => {});
      
      // Set state first
      if (address.state) {
        form.setValue("dropoffState", address.state || "", { shouldDirty: true, shouldValidate: true });
        
        // After state is set, set city
        setTimeout(() => {
          if (address.city) {
            const matchingState = indianStates.find(s => s.code === address.state);
            if (matchingState) {
              const stateCities = matchingState.cities || [];
              const matchingCity = stateCities.find(c => c.name === address.city);
              
              if (matchingCity) {
                form.setValue("dropoffCity", address.city, { shouldDirty: true, shouldValidate: true });
              } else {
                // City not in list, use "Other" option
                form.setValue("dropoffCity", "__other__", { shouldDirty: true, shouldValidate: true });
                form.setValue("dropoffCityCustom", address.city, { shouldDirty: true, shouldValidate: true });
              }
            }
          }
        }, 100);
      }
    }
  };

  const confirmDeleteSavedAddress = async () => {
    if (!savedAddressDeleteTarget || !selectedShipperId) return;
    setIsDeletingSavedAddress(true);
    try {
      const addrId = savedAddressDeleteTarget.row?.id;
      await apiRequest("POST", "/api/admin/remove-saved-address", {
        id: typeof addrId === "number" ? addrId : parseInt(String(addrId), 10),
        shipperId: String(selectedShipperId),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/saved-addresses/${selectedShipperId}/pickup`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/saved-addresses/${selectedShipperId}/dropoff`] });
      const label =
        savedAddressDeleteTarget.row.label ||
        savedAddressDeleteTarget.row.businessName ||
        savedAddressDeleteTarget.row.city ||
        "Address";
      toast({
        title: "Saved address removed",
        description: `"${label}" was removed for this shipper.`,
      });
      setSavedAddressDeleteTarget(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const stale =
        msg.includes("ADDRESS_NOT_FOUND") ||
        (msg.startsWith("404:") && msg.includes("Address not found"));
      if (stale && selectedShipperId) {
        queryClient.invalidateQueries({ queryKey: [`/api/admin/saved-addresses/${selectedShipperId}/pickup`] });
        queryClient.invalidateQueries({ queryKey: [`/api/admin/saved-addresses/${selectedShipperId}/dropoff`] });
      }
      toast({
        title: "Could not remove address",
        description: stale
          ? "That saved address no longer exists (your list was outdated). Saved addresses were refreshed."
          : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingSavedAddress(false);
    }
  };

  // Show truck suggestion when weight is entered
  useEffect(() => {
    if (!weight) {
      setEstimation(null);
      return;
    }
    
    const weightInTons = weightUnit === "kg" ? Number(weight) / 1000 : Number(weight);
    const localSuggestion = suggestTruckType(weightInTons, goodsDescription || "");
    const nearbyTrucks = Math.floor(Math.random() * 15) + 3;
    
    setEstimation(prev => ({ 
      distance: prev?.distance || 0, 
      suggestedTruck: localSuggestion, 
      nearbyTrucks 
    }));
  }, [weight, weightUnit, goodsDescription]);

  const postImmediately = form.watch("postImmediately");
  const watchedRateType = form.watch("rateType");
  const watchedShipperFixedPrice = form.watch("shipperFixedPrice");
  const watchedShipperPricePerTon = form.watch("shipperPricePerTon");
  const watchedAdvancePaymentPercent = form.watch("advancePaymentPercent");
  const prevShipperValuesRef = useRef({ rateType: "", fixedPrice: "", perTon: "", advance: "" });

  useEffect(() => {
    if (!postImmediately) return;

    const prev = prevShipperValuesRef.current;
    const currentFixed = watchedShipperFixedPrice || "";
    const currentPerTon = watchedShipperPricePerTon || "";
    const currentAdvance = watchedAdvancePaymentPercent || "";
    const currentRateType = watchedRateType || "fixed_price";

    if (currentRateType === "fixed_price" && currentFixed && currentFixed !== prev.fixedPrice) {
      const val = parseFloat(currentFixed.replace(/,/g, ""));
      if (val > 0) form.setValue("adminGrossPrice", Math.round(val).toString());
    }

    if (currentRateType === "per_ton" && currentPerTon && currentPerTon !== prev.perTon) {
      const val = parseFloat(currentPerTon.replace(/,/g, ""));
      if (val > 0) form.setValue("adminGrossPrice", Math.round(val).toString());
    }

    if (currentAdvance && currentAdvance !== prev.advance) {
      const adv = parseInt(currentAdvance);
      if (adv >= 0 && adv <= 100) form.setValue("carrierAdvancePercent", adv.toString());
    }

    prevShipperValuesRef.current = {
      rateType: currentRateType,
      fixedPrice: currentFixed,
      perTon: currentPerTon,
      advance: currentAdvance,
    };
  }, [postImmediately, watchedRateType, watchedShipperFixedPrice, watchedShipperPricePerTon, watchedAdvancePaymentPercent]);

  const handleSubmit = async (data: AdminLoadFormData) => {
    setIsLoading(true);
    
    try {
      const truckType = data.requiredTruckType || estimation?.suggestedTruck || "Dry Van";
      
      const finalGoodsDescription = data.goodsToBeCarried === "other" && customCommodity
        ? customCommodity
        : data.goodsToBeCarried || "";
      
      const finalPickupCity = data.pickupCity === "__other__" && data.pickupCityCustom
        ? data.pickupCityCustom
        : data.pickupCity;
      const finalDropoffCity = data.dropoffCity === "__other__" && data.dropoffCityCustom
        ? data.dropoffCityCustom
        : data.dropoffCity;
      
      // Submit load via admin endpoint
      const response = await apiRequest("POST", "/api/admin/loads/create", {
        existingShipperId: selectedShipperId,
        shipperCompanyName: data.shipperCompanyName,
        shipperContactName: data.shipperContactName,
        shipperCompanyAddress: data.shipperCompanyAddress,
        shipperPhone: data.shipperPhone,
        pickupAddress: data.pickupAddress,
        pickupLocality: data.pickupLocality || null,
        pickupLandmark: data.pickupLandmark || null,
        pickupBusinessName: data.pickupBusinessName || null,
        pickupCity: finalPickupCity,
        pickupState: data.pickupState,
        pickupPincode: data.pickupPincode?.trim() || null,
        dropoffAddress: data.dropoffAddress,
        dropoffLocality: data.dropoffLocality || null,
        dropoffLandmark: data.dropoffLandmark || null,
        dropoffBusinessName: data.dropoffBusinessName || null,
        dropoffCity: finalDropoffCity,
        dropoffState: data.dropoffState,
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
        // Admin-specific fields
        postImmediately: data.postImmediately,
        adminGrossPrice: data.adminGrossPrice ? (() => {
          const rawPrice = parseFloat(data.adminGrossPrice.replace(/,/g, ''));
          if (data.rateType === "per_ton" && rawPrice > 0) {
            const wt = parseFloat(data.weight || "0");
            if (wt > 0) return Math.round(rawPrice * wt).toString();
          }
          return data.adminGrossPrice.replace(/,/g, '');
        })() : null,
        platformMargin: data.platformMargin || null,
        carrierAdvancePercent: data.carrierAdvancePercent || null,
        // Admin employee info
        adminEmployeeCode: data.adminEmployeeCode || null,
        adminEmployeeName: data.adminEmployeeName || null,
      });
      
      const result = await response.json();

      if (savePickupAddress && selectedShipperId) {
        try {
          await apiRequest("POST", "/api/admin/saved-addresses", {
            shipperId: selectedShipperId,
            addressType: "pickup",
            label: pickupAddressLabel || data.pickupBusinessName || `${finalPickupCity} Address`,
            businessName: data.pickupBusinessName || null,
            address: data.pickupAddress || null,
            locality: data.pickupLocality || null,
            landmark: data.pickupLandmark || null,
            city: finalPickupCity,
            state: data.pickupState,
            pincode: data.pickupPincode?.trim() || null,
            isActive: true,
          });
          queryClient.invalidateQueries({ queryKey: [`/api/admin/saved-addresses/${selectedShipperId}/pickup`] });
        } catch (err: any) {
          const msg = err?.message || "";
          const limitHit = msg.includes("10 saved pickup");
          toast({
            title: limitHit ? "Address limit reached" : "Could not save pickup address",
            description: limitHit
              ? "This shipper already has 10 saved pickup addresses. Delete one to add more."
              : "The load was submitted but the pickup address could not be saved.",
            variant: "destructive",
          });
        }
      }

      if (saveDropoffAddress && selectedShipperId) {
        try {
          await apiRequest("POST", "/api/admin/saved-addresses", {
            shipperId: selectedShipperId,
            addressType: "dropoff",
            label: dropoffAddressLabel || data.dropoffBusinessName || `${finalDropoffCity} Address`,
            businessName: data.dropoffBusinessName || null,
            address: data.dropoffAddress || null,
            locality: data.dropoffLocality || null,
            landmark: data.dropoffLandmark || null,
            city: finalDropoffCity,
            state: data.dropoffState,
            pincode: data.dropoffPincode?.trim() || null,
            contactName: data.receiverName || null,
            contactPhone: data.receiverPhone || null,
            contactEmail: data.receiverEmail || null,
            isActive: true,
          });
          queryClient.invalidateQueries({ queryKey: [`/api/admin/saved-addresses/${selectedShipperId}/dropoff`] });
        } catch (err: any) {
          const msg = err?.message || "";
          const limitHit = msg.includes("10 saved dropoff");
          toast({
            title: limitHit ? "Address limit reached" : "Could not save dropoff address",
            description: limitHit
              ? "This shipper already has 10 saved dropoff addresses. Delete one to add more."
              : "The load was submitted but the dropoff address could not be saved.",
            variant: "destructive",
          });
        }
      }

      setSubmittedLoadId(result.load_id);
      setSubmittedLoadNumber(result.load_number);
      const pickupStateName = indianStates.find(s => s.code === data.pickupState)?.name || data.pickupState;
      const dropoffStateName = indianStates.find(s => s.code === data.dropoffState)?.name || data.dropoffState;
      setSubmittedLoadDetails({
        pickupCity: finalPickupCity,
        pickupState: pickupStateName,
        dropoffCity: finalDropoffCity,
        dropoffState: dropoffStateName,
        weight: data.weight,
        goods: finalGoodsDescription,
        truckType: truckType || '',
        pickupDate: data.pickupDate,
        specialNotes: data.specialNotes || '',
        rateType: data.rateType,
        pricePerTon: data.shipperPricePerTon || '',
        fixedPrice: data.shipperFixedPrice || '',
        postImmediately: data.postImmediately,
      });
      setSubmitted(true);
      
      // Invalidate all load-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/loads'] });

      // Compose toast message based on what happened
      let toastDescription = data.postImmediately 
        ? `Load LD-${String(result.load_number).padStart(3, '0')} has been posted to the marketplace.`
        : `Load LD-${String(result.load_number).padStart(3, '0')} has been added to the pricing queue.`;
      
      // Add note about new shipper creation if applicable
      if (result.new_shipper_created) {
        toastDescription += ` A new shipper account was automatically created for ${data.shipperContactName}.`;
        void refetchUsers();
        queryClient.invalidateQueries({ queryKey: ['/api/admin/onboarding-requests'] });
      }
      
      toast({ 
        title: data.postImmediately ? "Load Posted to Carriers" : "Load Created Successfully", 
        description: toastDescription
      });
      
    } catch (error: any) {
      console.error("Submit load error:", error);
      toast({ 
        title: "Error", 
        description: error?.message || "Something went wrong creating the load.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader className="text-center px-4 sm:px-6">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3 sm:mb-4">
              <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-lg sm:text-xl" data-testid="text-admin-submission-success">
              Load Created Successfully
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {submittedLoadDetails?.postImmediately 
                ? "The load has been posted to carriers and is now live on the marketplace."
                : "The load has been added to the pricing queue. You can price and post it from the Load Queue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
            <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">Load Number</p>
              <p className="font-mono font-semibold text-base sm:text-lg">LD-{String(submittedLoadNumber).padStart(3, '0')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div>
                <p className="text-muted-foreground">From</p>
                <p className="font-medium break-words">{submittedLoadDetails?.pickupCity}, {submittedLoadDetails?.pickupState}</p>
              </div>
              <div>
                <p className="text-muted-foreground">To</p>
                <p className="font-medium break-words">{submittedLoadDetails?.dropoffCity}, {submittedLoadDetails?.dropoffState}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Weight</p>
                <p className="font-medium">{submittedLoadDetails?.weight} Tons</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cargo</p>
                <p className="font-medium break-words">{submittedLoadDetails?.goods ? formatCommodityLabel(submittedLoadDetails.goods) : ''}</p>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-semibold text-xs sm:text-sm">Status</h3>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${submittedLoadDetails?.postImmediately ? 'bg-green-500' : 'bg-amber-500'}`}>
                  {submittedLoadDetails?.postImmediately ? (
                    <Send className="h-4 w-4 text-white" />
                  ) : (
                    <Clock className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs sm:text-sm truncate">
                    {submittedLoadDetails?.postImmediately ? "Posted to Carriers" : "Pending Pricing"}
                  </p>
                  <p className="text-xs text-muted-foreground break-words">
                    {submittedLoadDetails?.postImmediately 
                      ? "Carriers can now view and bid on this load"
                      : "Go to Load Queue to price and post this load"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {submittedLoadDetails?.postImmediately ? (
                <Button onClick={() => navigate("/admin/loads")} className="flex-1 w-full sm:w-auto" data-testid="button-view-all-loads">
                  View All Loads
                </Button>
              ) : (
                <Button onClick={() => navigate("/admin/queue")} className="flex-1 w-full sm:w-auto" data-testid="button-go-to-queue">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Go to Load Queue
                </Button>
              )}
              <Button variant="outline" onClick={() => { setSubmitted(false); form.reset(); }} data-testid="button-post-another-admin" className="w-full sm:w-auto">
                Create Another Load
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 w-full flex flex-col">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-admin-post-load-title">Post a Load</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Create a new load on behalf of a shipper. The load will be added to all loads and available for pricing in the queue.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start flex-1">
        <div className="flex-1 space-y-4 sm:space-y-6 min-w-0 w-full">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">
              {/* Admin Details Card */}
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">Admin Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  <p className="text-xs sm:text-sm text-muted-foreground">Your employee information (shown in load details)</p>
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="adminEmployeeCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee Code</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. EMP001" {...field} data-testid="admin-input-employee-code" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="adminEmployeeName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name" {...field} data-testid="admin-input-employee-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Shipper Details Card */}
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="truncate">Shipper Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  {/* Shipper Selector - Autocomplete Input */}
                  <div className="space-y-2">
                    <FormLabel>Select Existing Shipper</FormLabel>
                    <div className="relative" ref={shipperDropdownRef}>
                      <Input
                        placeholder="Type to search verified shippers..."
                        value={shipperSearchQuery}
                        onChange={(e) => {
                          setShipperSearchQuery(e.target.value);
                          setShipperSearchOpen(true);
                          if (e.target.value === "") {
                            setSelectedShipperId(null);
                          }
                        }}
                        onFocus={() => setShipperSearchOpen(true)}
                        className="pr-10"
                        data-testid="input-search-shipper"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {shippersLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {selectedShipperId && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setSelectedShipperId(null);
                              setShipperSearchQuery("");
                              form.setValue("shipperCompanyName", "");
                              form.setValue("shipperContactName", "");
                              form.setValue("shipperCompanyAddress", "");
                              form.setValue("shipperPhone", "");
                            }}
                            data-testid="button-clear-shipper"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      {/* Dropdown Results */}
                      {shipperSearchOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                          {shippersLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Loading shippers...
                            </div>
                          ) : (
                            <>
                              <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                                Verified Shippers ({filteredShippers.length})
                              </div>
                              {filteredShippers.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                  No shippers match "{shipperSearchQuery}"
                                </div>
                              ) : (
                                filteredShippers.map((shipper) => (
                                  <div
                                    key={shipper.id}
                                    className={`px-3 py-2 cursor-pointer hover-elevate flex items-center gap-2 ${
                                      selectedShipperId === shipper.id ? "bg-accent" : ""
                                    }`}
                                    onClick={() => {
                                      setSelectedShipperId(shipper.id);
                                      setShipperSearchQuery(shipper.companyName || shipper.username);
                                      form.setValue("shipperCompanyName", shipper.companyName || "");
                                      form.setValue("shipperContactName", shipper.username || "");
                                      form.setValue("shipperCompanyAddress", shipper.companyAddress || "");
                                      form.setValue("shipperPhone", shipper.phone || "");
                                      setShipperSearchOpen(false);
                                    }}
                                    data-testid={`dropdown-shipper-${shipper.id}`}
                                  >
                                    <Check
                                      className={`h-4 w-4 ${
                                        selectedShipperId === shipper.id ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    <div className="flex flex-col flex-1 min-w-0">
                                      <span className="font-medium truncate">{shipper.companyName || shipper.username}</span>
                                      <span className="text-xs text-muted-foreground truncate">
                                        {shipper.username} | {shipper.email} {shipper.phone && `| ${shipper.phone}`}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                              <div
                                className="px-3 py-2 cursor-pointer hover-elevate flex items-center gap-2 border-t text-muted-foreground"
                                onClick={() => {
                                  setSelectedShipperId(null);
                                  setShipperSearchQuery("");
                                  setShipperSearchOpen(false);
                                }}
                                data-testid="dropdown-shipper-manual"
                              >
                                <User className="h-4 w-4" />
                                <span className="text-sm">Enter shipper details manually</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedShipperId && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" />
                        Load will be attributed to this shipper and visible in their portal
                      </p>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        {selectedShipperId ? "Shipper Info (auto-filled)" : "Or enter shipper details manually"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="shipperCompanyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Company Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="admin-input-shipper-company-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shipperContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Contact Person Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="admin-input-shipper-contact-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="shipperCompanyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Address</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="admin-input-shipper-company-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shipperPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="admin-input-shipper-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Pickup Location Card */}
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="truncate">Pickup Location</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
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
                            data-testid="admin-select-saved-pickup-address"
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
                                  data-testid={`admin-button-delete-saved-pickup-${addr.id}`}
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
                        <FormLabel>Business / Factory Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. ABC Manufacturing" {...field} data-testid="admin-input-pickup-business-name" />
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
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value || ""}
                            onChange={field.onChange}
                            onAddressSelect={(address) => {
                              const streetValue = address.streetAddress || address.formattedAddress;
                              form.setValue("pickupAddress", streetValue, { shouldDirty: true, shouldValidate: true });
                              
                              // Set state first
                              if (address.state) {
                                const matchingState = indianStates.find(s => 
                                  s.name.toLowerCase() === address.state.toLowerCase() ||
                                  s.code.toLowerCase() === address.state.toLowerCase()
                                );
                                if (matchingState) {
                                  form.setValue("pickupState", matchingState.code, { shouldDirty: true, shouldValidate: true });
                                  
                                  // After state is set, set city
                                  if (address.city) {
                                    setTimeout(() => {
                                      const stateCities = matchingState.cities || [];
                                      const matchingCity = stateCities.find(c => 
                                        c.name.toLowerCase() === address.city.toLowerCase()
                                      );
                                      
                                      if (matchingCity) {
                                        form.setValue("pickupCity", matchingCity.name, { shouldDirty: true, shouldValidate: true });
                                      } else {
                                        // City not in list, use "Other" option
                                        form.setValue("pickupCity", "__other__", { shouldDirty: true, shouldValidate: true });
                                        form.setValue("pickupCityCustom", address.city, { shouldDirty: true, shouldValidate: true });
                                      }
                                    }, 100);
                                  }
                                }
                              }
                              
                              if (address.postalCode) {
                                form.setValue("pickupPincode", address.postalCode, { shouldDirty: true, shouldValidate: true });
                              }
                            }}
                            placeholder="Search for pickup address"
                            data-testid="admin-input-pickup-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="pickupLocality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Locality / Area</FormLabel>
                          <FormControl>
                            <Input placeholder="Locality name" {...field} data-testid="admin-input-pickup-locality" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pickupLandmark"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Landmark (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Near..." {...field} data-testid="admin-input-pickup-landmark" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="pickupState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("pickupCity", "");
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="admin-select-pickup-state">
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {indianStates.map((state) => (
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
                      name="pickupCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!pickupState}>
                            <FormControl>
                              <SelectTrigger data-testid="admin-select-pickup-city">
                                <SelectValue placeholder="Select city" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {pickupCities.map((city) => (
                                <SelectItem key={city.name} value={city.name}>
                                  {city.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="__other__">Other (Enter manually)</SelectItem>
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
                            <Input placeholder="Enter city name" {...field} data-testid="admin-input-pickup-city-custom" />
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
                          <Input placeholder="6-digit pincode" {...field} data-testid="admin-input-pickup-pincode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <input 
                      type="checkbox" 
                      id="admin-save-pickup-address" 
                      checked={savePickupAddress}
                      onChange={(e) => setSavePickupAddress(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                      data-testid="admin-checkbox-save-pickup-address"
                    />
                    <label htmlFor="admin-save-pickup-address" className="text-sm text-muted-foreground cursor-pointer">
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
                        data-testid="admin-input-pickup-address-label"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dropoff Location Card */}
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="truncate">Dropoff Location</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
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
                            data-testid="admin-select-saved-dropoff-address"
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
                                  data-testid={`admin-button-delete-saved-dropoff-${addr.id}`}
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
                          <Input placeholder="Receiver business name" {...field} data-testid="admin-input-dropoff-business-name" />
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
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value || ""}
                            onChange={field.onChange}
                            onAddressSelect={(address) => {
                              const streetValue = address.streetAddress || address.formattedAddress;
                              form.setValue("dropoffAddress", streetValue, { shouldDirty: true, shouldValidate: true });
                              
                              // Set state first
                              if (address.state) {
                                const matchingState = indianStates.find(s => 
                                  s.name.toLowerCase() === address.state.toLowerCase() ||
                                  s.code.toLowerCase() === address.state.toLowerCase()
                                );
                                if (matchingState) {
                                  form.setValue("dropoffState", matchingState.code, { shouldDirty: true, shouldValidate: true });
                                  
                                  // After state is set, set city
                                  if (address.city) {
                                    setTimeout(() => {
                                      const stateCities = matchingState.cities || [];
                                      const matchingCity = stateCities.find(c => 
                                        c.name.toLowerCase() === address.city.toLowerCase()
                                      );
                                      
                                      if (matchingCity) {
                                        form.setValue("dropoffCity", matchingCity.name, { shouldDirty: true, shouldValidate: true });
                                      } else {
                                        // City not in list, use "Other" option
                                        form.setValue("dropoffCity", "__other__", { shouldDirty: true, shouldValidate: true });
                                        form.setValue("dropoffCityCustom", address.city, { shouldDirty: true, shouldValidate: true });
                                      }
                                    }, 100);
                                  }
                                }
                              }
                              
                              if (address.postalCode) {
                                form.setValue("dropoffPincode", address.postalCode, { shouldDirty: true, shouldValidate: true });
                              }
                            }}
                            placeholder="Search for dropoff address"
                            data-testid="admin-input-dropoff-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="dropoffLocality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Locality / Area</FormLabel>
                          <FormControl>
                            <Input placeholder="Locality name" {...field} data-testid="admin-input-dropoff-locality" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dropoffLandmark"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Landmark (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Near..." {...field} data-testid="admin-input-dropoff-landmark" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="dropoffState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("dropoffCity", "");
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="admin-select-dropoff-state">
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {indianStates.map((state) => (
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
                      name="dropoffCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!dropoffState}>
                            <FormControl>
                              <SelectTrigger data-testid="admin-select-dropoff-city">
                                <SelectValue placeholder="Select city" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {dropoffCities.map((city) => (
                                <SelectItem key={city.name} value={city.name}>
                                  {city.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="__other__">Other (Enter manually)</SelectItem>
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
                            <Input placeholder="Enter city name" {...field} data-testid="admin-input-dropoff-city-custom" />
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
                          <Input placeholder="6-digit pincode" {...field} data-testid="admin-input-dropoff-pincode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <input 
                      type="checkbox" 
                      id="admin-save-dropoff-address" 
                      checked={saveDropoffAddress}
                      onChange={(e) => setSaveDropoffAddress(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                      data-testid="admin-checkbox-save-dropoff-address"
                    />
                    <label htmlFor="admin-save-dropoff-address" className="text-sm text-muted-foreground cursor-pointer">
                      Save this dropoff address for future use
                    </label>
                  </div>
                  {saveDropoffAddress && (
                    <div className="mt-2">
                      <label className="text-sm text-muted-foreground mb-1 block">Address Label <span className="font-normal">(e.g. Delhi Warehouse)</span></label>
                      <Input 
                        placeholder="" 
                        value={dropoffAddressLabel}
                        onChange={(e) => setDropoffAddressLabel(e.target.value)}
                        data-testid="admin-input-dropoff-address-label"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Receiver Details Card */}
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-500 shrink-0" />
                    <span className="truncate">Receiver Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="receiverName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receiver Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Full name" {...field} data-testid="admin-input-receiver-name" />
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
                            <Input placeholder="10-digit number" {...field} data-testid="admin-input-receiver-phone" />
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
                          <Input type="email" placeholder="email@example.com" {...field} data-testid="admin-input-receiver-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Cargo Details Card */}
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-500 shrink-0" />
                    <span className="truncate">Cargo Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Enter weight" {...field} data-testid="admin-input-weight" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="weightUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="admin-select-weight-unit">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="tons">Tons</SelectItem>
                              <SelectItem value="kg">Kilograms</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="goodsToBeCarried"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goods to be Carried</FormLabel>
                        <FormControl>
                          <CommodityCombobox
                            value={field.value}
                            onChange={field.onChange}
                            customValue={customCommodity}
                            onCustomChange={setCustomCommodity}
                          />
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
                        <FormLabel>Required Truck Type</FormLabel>
                        <FormControl>
                          <TruckTypeSelector
                            value={field.value}
                            onChange={field.onChange}
                            suggestedTruck={estimation?.suggestedTruck}
                          />
                        </FormControl>
                        {estimation?.suggestedTruck && !field.value && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span>Suggested: {indianTruckTypes.find(t => t.value === estimation.suggestedTruck)?.label || estimation.suggestedTruck}</span>
                          </div>
                        )}
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
                            placeholder="Any special handling requirements, loading/unloading instructions, etc."
                            {...field}
                            data-testid="admin-input-special-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Schedule Card */}
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-teal-500 shrink-0" />
                    <span className="truncate">Schedule</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
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
                          <FormLabel>Expected Delivery Date</FormLabel>
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

              {/* Pricing Card */}
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="truncate">Shipper Pricing</span>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Set the shipper's quoted price</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  <FormField
                    control={form.control}
                    name="rateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="admin-select-rate-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="fixed_price">Fixed Price</SelectItem>
                            <SelectItem value="per_ton">Per Ton</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("rateType") === "fixed_price" && (
                    <FormField
                      control={form.control}
                      name="shipperFixedPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fixed Price (INR)</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              placeholder="e.g. 50,000" 
                              {...field} 
                              data-testid="admin-input-shipper-fixed-price"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {form.watch("rateType") === "per_ton" && (
                    <FormField
                      control={form.control}
                      name="shipperPricePerTon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price Per Ton (INR)</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              placeholder="e.g. 2,500" 
                              {...field}
                              data-testid="admin-input-shipper-price-per-ton"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="advancePaymentPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Advance Payment %</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g. 30" 
                            min="0" 
                            max="100"
                            {...field}
                            data-testid="admin-input-advance-payment"
                          />
                        </FormControl>
                        <FormDescription>
                          Percentage of total to be paid upfront
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Admin Options Card - Pricing Calculator */}
              {/* <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">Admin Options</span>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Configure how the load should be processed</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6">
                  <FormField
                    control={form.control}
                    name="postImmediately"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Post Immediately</FormLabel>
                          <FormDescription>
                            Skip the pricing queue and post directly to carriers
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                            data-testid="admin-checkbox-post-immediately"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("postImmediately") && (() => {
                    const pickupCity = form.watch("pickupCity") || "";
                    const dropoffCity = form.watch("dropoffCity") || "";
                    const weight = parseFloat(form.watch("weight") || "0");
                    const truckType = form.watch("requiredTruckType") || "";
                    const shipperRateType = form.watch("rateType") || "fixed_price";
                    const shipperFixedPrice = form.watch("shipperFixedPrice") || "";
                    const shipperPricePerTon = form.watch("shipperPricePerTon") || "";
                    const shipperAdvance = form.watch("advancePaymentPercent") || "";
                    const grossPriceRaw = form.watch("adminGrossPrice") || "";
                    const grossPrice = parseFloat(grossPriceRaw.replace(/,/g, "")) || 0;
                    const marginPercent = parseFloat(form.watch("platformMargin") || "10");
                    const advancePercent = parseFloat(form.watch("carrierAdvancePercent") || "30");

                    const hasRoute = pickupCity && dropoffCity;
                    const pricing = hasRoute
                      ? calculatePricingBreakdown(pickupCity, dropoffCity, weight, truckType)
                      : null;

                    const effectiveTotalPrice = shipperRateType === "per_ton" && grossPrice > 0 && weight > 0
                      ? Math.round(grossPrice * weight)
                      : grossPrice;
                    const platformEarning = effectiveTotalPrice > 0 ? Math.round(effectiveTotalPrice * (marginPercent / 100)) : 0;
                    const carrierPayout = effectiveTotalPrice > 0 ? effectiveTotalPrice - platformEarning : 0;
                    const carrierAdvance = effectiveTotalPrice > 0 ? Math.round(carrierPayout * (advancePercent / 100)) : 0;
                    const carrierBalance = carrierPayout - carrierAdvance;

                    const shipperHasPrice = (shipperRateType === "fixed_price" && shipperFixedPrice) ||
                      (shipperRateType === "per_ton" && shipperPricePerTon);

                    const autoPopulatePrice = () => {
                      if (shipperRateType === "fixed_price" && shipperFixedPrice) {
                        const val = parseFloat(shipperFixedPrice.replace(/,/g, ""));
                        if (val > 0) form.setValue("adminGrossPrice", Math.round(val).toString());
                      } else if (shipperRateType === "per_ton" && shipperPricePerTon) {
                        const perTon = parseFloat(shipperPricePerTon.replace(/,/g, ""));
                        if (perTon > 0) form.setValue("adminGrossPrice", Math.round(perTon).toString());
                      }
                    };

                    const autoPopulateAdvance = () => {
                      if (shipperAdvance) {
                        const adv = parseInt(shipperAdvance);
                        if (adv >= 0 && adv <= 100) form.setValue("carrierAdvancePercent", adv.toString());
                      }
                    };

                    return (
                      <div className="space-y-4">
                        {(shipperHasPrice || shipperAdvance) && (
                          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                            <CardContent className="pt-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4 text-amber-600" />
                                <span className="font-medium text-amber-700 dark:text-amber-400">Shipper's Pricing Preference</span>
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">
                                  From Form
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                {shipperHasPrice && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">
                                      {shipperRateType === "per_ton" ? "Per Tonne Rate" : "Fixed Price"}
                                    </span>
                                    <span className="font-bold text-lg text-amber-700 dark:text-amber-400" data-testid="text-shipper-price">
                                      {shipperRateType === "per_ton" && shipperPricePerTon
                                        ? `Rs. ${parseFloat(shipperPricePerTon.replace(/,/g, "")).toLocaleString("en-IN")}/MT`
                                        : shipperFixedPrice
                                          ? `Rs. ${parseFloat(shipperFixedPrice.replace(/,/g, "")).toLocaleString("en-IN")}`
                                          : "-"
                                      }
                                    </span>
                                  </div>
                                )}
                                {shipperAdvance && parseInt(shipperAdvance) > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Preferred Advance</span>
                                    <span className="font-bold text-lg text-amber-700 dark:text-amber-400" data-testid="text-shipper-advance">
                                      {shipperAdvance}%
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 mt-3">
                                {shipperHasPrice && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={autoPopulatePrice}
                                    data-testid="button-use-shipper-price"
                                  >
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Use Shipper Price
                                  </Button>
                                )}
                                {shipperAdvance && parseInt(shipperAdvance) > 0 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={autoPopulateAdvance}
                                    data-testid="button-use-shipper-advance"
                                  >
                                    <Percent className="h-3 w-3 mr-1" />
                                    Use Shipper Advance
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {pricing && (
                          <Card>
                            <CardContent className="pt-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <Calculator className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-sm">Price Estimation</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between" data-testid="calc-base-amount">
                                  <span className="text-muted-foreground">
                                    Distance ({pricing.params.distanceKm} km x Rs. {pricing.params.baseRatePerKm})
                                  </span>
                                  <span>Rs. {pricing.breakdown.baseAmount.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex justify-between" data-testid="calc-fuel-surcharge">
                                  <span className="text-muted-foreground">Fuel Surcharge (12%)</span>
                                  <span>Rs. {pricing.breakdown.fuelSurcharge.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex justify-between" data-testid="calc-platform-fee">
                                  <span className="text-muted-foreground">Platform Fee (8%)</span>
                                  <span>Rs. {pricing.breakdown.platformFee.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex justify-between" data-testid="calc-handling-fee">
                                  <span className="text-muted-foreground">Handling Fee</span>
                                  <span>Rs. {pricing.breakdown.handlingFee.toLocaleString("en-IN")}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-semibold" data-testid="calc-suggested-price">
                                  <span>Suggested Price</span>
                                  <span className="text-primary">
                                    Rs. {pricing.suggestedPrice.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() =>
                                  form.setValue("adminGrossPrice", pricing.suggestedPrice.toString())
                                }
                                data-testid="button-use-suggested-price"
                              >
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Use Suggested Price
                              </Button>
                            </CardContent>
                          </Card>
                        )}

                        {!pricing && (
                          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center" data-testid="calc-empty-state">
                            <Calculator className="h-5 w-5 mx-auto mb-2 opacity-50" />
                            Fill in pickup city, dropoff city, weight, and truck type above to see the price estimation
                          </div>
                        )}

                        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                          <CardContent className="pt-4 space-y-4">
                            <div className="flex items-center gap-2">
                              <Scale className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">Pricing Method</span>
                              {shipperHasPrice && (
                                <Badge variant="secondary" className="text-xs">
                                  Shipper choose: {shipperRateType === "per_ton" ? "Per Tonne" : "Fixed"}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                variant={shipperRateType === "fixed_price" ? "default" : "outline"}
                                className="w-full text-xs sm:text-sm"
                                onClick={() => form.setValue("rateType", "fixed_price")}
                                data-testid="button-rate-type-fixed"
                              >
                                <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
                                <span className="truncate">Fixed Price</span>
                              </Button>
                              <Button
                                type="button"
                                variant={shipperRateType === "per_ton" ? "default" : "outline"}
                                className="w-full text-xs sm:text-sm"
                                onClick={() => form.setValue("rateType", "per_ton")}
                                data-testid="button-rate-type-per-ton"
                              >
                                <Scale className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
                                <span className="truncate">Per Tonne</span>
                              </Button>
                            </div>
                            <div className="space-y-2 pt-2 border-t">
                              {shipperRateType === "fixed_price" ? (
                                <FormField
                                  control={form.control}
                                  name="adminGrossPrice"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Enter Fixed Price (Rs.)</FormLabel>
                                      <div className="flex items-center gap-2">
                                        <IndianRupee className="h-5 w-5 text-muted-foreground shrink-0" />
                                        <FormControl>
                                          <Input
                                            type="text"
                                            placeholder="e.g. 50000"
                                            className="text-lg font-medium"
                                            {...field}
                                            data-testid="admin-input-gross-price"
                                          />
                                        </FormControl>
                                      </div>
                                      <FormDescription>
                                        This is the total amount the shipper will pay
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              ) : (
                                <div className="space-y-3">
                                  <FormField
                                    control={form.control}
                                    name="adminGrossPrice"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Per Tonne Rate (Rs./MT)</FormLabel>
                                        <div className="flex items-center gap-2">
                                          <IndianRupee className="h-5 w-5 text-muted-foreground shrink-0" />
                                          <FormControl>
                                            <Input
                                              type="text"
                                              placeholder="e.g. 2500"
                                              className="text-lg font-medium"
                                              {...field}
                                              data-testid="admin-input-gross-price"
                                            />
                                          </FormControl>
                                          <span className="text-sm text-muted-foreground shrink-0">/MT</span>
                                        </div>
                                        <FormDescription>
                                          Rate per metric tonne -- total = rate x weight ({weight > 0 ? `${weight} MT` : "enter weight above"})
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  {grossPrice > 0 && weight > 0 && (
                                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-2 text-sm flex justify-between items-center">
                                      <span className="text-muted-foreground">Calculated Total ({grossPrice.toLocaleString("en-IN")} x {weight} MT):</span>
                                      <span className="font-bold text-primary" data-testid="text-per-ton-total">
                                        Rs. {Math.round(grossPrice * weight).toLocaleString("en-IN")}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-green-500">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <IndianRupee className="h-5 w-5" />
                                <span className="font-medium">Total Price</span>
                                <Badge variant="outline" className="text-xs">
                                  {shipperRateType === "per_ton" ? "Per Tonne" : "Fixed"}
                                </Badge>
                              </div>
                              <span className="text-xl font-bold" data-testid="text-total-price">
                                {shipperRateType === "per_ton" && grossPrice > 0 && weight > 0
                                  ? `Rs. ${Math.round(grossPrice * weight).toLocaleString("en-IN")}`
                                  : grossPrice > 0
                                    ? `Rs. ${grossPrice.toLocaleString("en-IN")}`
                                    : "Rs. 0"
                                }
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              Margin & Final Price
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                              <FormField
                                control={form.control}
                                name="platformMargin"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between w-full">
                                    <FormLabel className="text-sm shrink-0">Platform Margin</FormLabel>
                                    <div className="flex items-center gap-2">
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="0"
                                          max="50"
                                          className="w-16 text-right"
                                          {...field}
                                          data-testid="admin-input-platform-margin"
                                        />
                                      </FormControl>
                                      <span className="text-sm font-medium">%</span>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Platform Earnings:</span>
                              <span className="font-medium text-primary" data-testid="calc-platform-earning">
                                Rs. {platformEarning.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Final Price (Carrier Payout):</span>
                              <span className="font-bold text-lg text-green-600 dark:text-green-400" data-testid="calc-carrier-payout">
                                Rs. {carrierPayout.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-green-200 dark:border-green-900">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <IndianRupee className="h-5 w-5 text-green-600" />
                              Carrier Advance Payment
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <span className="text-sm text-muted-foreground">Quick Select</span>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {[0, 50, 75, 90, 100].map((pct) => (
                                  <Button
                                    key={pct}
                                    type="button"
                                    variant={parseInt(form.watch("carrierAdvancePercent") || "30") === pct ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => form.setValue("carrierAdvancePercent", pct.toString())}
                                    data-testid={`button-advance-${pct}`}
                                    className="w-full"
                                  >
                                    {pct === 0 ? "No Adv" : `${pct}%`}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            <FormField
                              control={form.control}
                              name="carrierAdvancePercent"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-3">
                                  <FormLabel className="text-sm shrink-0">Custom:</FormLabel>
                                  <div className="flex items-center gap-2">
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-20 text-right"
                                        {...field}
                                        data-testid="admin-input-carrier-advance"
                                      />
                                    </FormControl>
                                    <span className="text-sm font-medium">%</span>
                                  </div>
                                </FormItem>
                              )}
                            />
                            {effectiveTotalPrice > 0 && (
                              <div className="bg-muted/50 rounded-md p-3 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Advance (Upfront):</span>
                                  <span className="font-semibold text-green-600 dark:text-green-400" data-testid="calc-carrier-advance">
                                    Rs. {carrierAdvance.toLocaleString("en-IN")}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Balance (On Delivery):</span>
                                  <span className="font-semibold" data-testid="calc-carrier-balance">
                                    Rs. {carrierBalance.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card> */}

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  className="flex-1 w-full sm:w-auto"
                  disabled={isLoading}
                  data-testid="admin-button-submit-load"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span className="truncate">Creating Load...</span>
                    </>
                  ) : form.watch("postImmediately") ? (
                    <>
                      <Send className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">Create & Post to Carriers</span>
                    </>
                  ) : (
                    <>
                      <ClipboardList className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">Create & Add to Queue</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin")}
                  data-testid="admin-button-cancel"
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
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
                ? `This will remove "${savedAddressDeleteTarget.row.label || savedAddressDeleteTarget.row.businessName || savedAddressDeleteTarget.row.city || "this address"}" from this shipper's saved ${savedAddressDeleteTarget.addressType} addresses.`
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
              data-testid="admin-button-confirm-delete-saved-address"
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