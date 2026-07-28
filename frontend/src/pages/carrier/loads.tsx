import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { 
  Search, MapPin, LayoutGrid, List, Package, Star, 
  Truck, TrendingUp, ArrowRight, Building2, Calendar,
  Target, Timer, Sparkles, ShieldCheck, Lock, Unlock, Loader2, CheckCircle
} from "lucide-react";
import { connectMarketplace, onMarketplaceEvent, disconnectMarketplace } from "@/lib/marketplace-socket";
import { useAuth } from "@/lib/auth-context";
import { indianTruckTypes } from "@/shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";
import {
  buildCarrierRouteDestinationString,
  buildCarrierRouteOriginString,
} from "@/lib/carrier-route-strings";

interface CarrierLoad {
  id: string;
  origin: string;
  destination: string;
  // Full address details
  pickupAddress?: string | null;
  pickupLocality?: string | null;
  pickupLandmark?: string | null;
  pickupCity?: string | null;
  dropoffAddress?: string | null;
  dropoffLocality?: string | null;
  dropoffLandmark?: string | null;
  dropoffBusinessName?: string | null;
  dropoffCity?: string | null;
  loadType: string | null;
  weight: string | null;
  estimatedDistance: number | null;
  pickupState?: string | null;
  dropoffState?: string | null;
  pickupPincode?: string | null;
  dropoffPincode?: string | null;
  adminFinalPrice: string | null;
  finalPrice: string | null;
  allowCounterBids: boolean | null;
  shipperName: string | null;
  shipperId?: string | null;
  bidCount: number;
  myBid: any | null;
  postedByAdmin: boolean;
  priceFixed: boolean;
  createdAt: string;
  isSimulated?: boolean;
  pickupDate?: string | null;
  deliveryDate?: string | null;
  shipperLoadNumber?: number | null;
  adminReferenceNumber?: number | null;
  carrierAdvancePercent?: number | null;
  cargoDescription?: string | null;
  postedAt?: string | null;
}

interface ShipperRatingData {
  averageRating: number | null;
  totalRatings: number;
}

// Helper to get carrier display price (finalPrice = carrier payout price)
function getCarrierPrice(load: CarrierLoad): number {
  return parseFloat(load.finalPrice || load.adminFinalPrice || "0");
}

// Format load ID for display - shows LD-1001 (admin ref) or LD-023 (shipper seq)
function formatLoadId(load: { shipperLoadNumber?: number | null; adminReferenceNumber?: number | null; id: string }): string {
  if (load.adminReferenceNumber) {
    return `LD-${String(load.adminReferenceNumber).padStart(3, '0')}`;
  }
  if (load.shipperLoadNumber) {
    return `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`;
  }
  return load.id.slice(0, 8);
}

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

type ApiLoadDistanceFields = {
  pickupLat?: string | number | null;
  pickupLng?: string | number | null;
  dropoffLat?: string | number | null;
  dropoffLng?: string | number | null;
  pickupCity?: string | null;
  dropoffCity?: string | null;
};

function carrierKmEstimateOnly(load: ApiLoadDistanceFields): number | null {
  const km = computeRouteDistanceKmEstimate({
    pickupLat: load.pickupLat,
    pickupLng: load.pickupLng,
    dropoffLat: load.dropoffLat,
    dropoffLng: load.dropoffLng,
    pickupCity: load.pickupCity ?? undefined,
    dropoffCity: load.dropoffCity ?? undefined,
  });
  if (!Number.isFinite(km)) return null;
  const rounded = Math.round(km);
  return rounded >= 1 ? rounded : null;
}

function ShipperRatingBadge({ shipperId }: { shipperId: string | null | undefined }) {
  const { data: ratingData, isError } = useQuery<ShipperRatingData>({
    queryKey: [`/api/shipper/${shipperId}/rating`],
    enabled: !!shipperId,
    staleTime: 5 * 60 * 1000,
  });

  if (!shipperId || isError || !ratingData || ratingData.totalRatings === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-xs" data-testid={`shipper-rating-${shipperId}`}>
      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      <span className="font-medium">{ratingData.averageRating}</span>
      <span className="text-muted-foreground">({ratingData.totalRatings})</span>
    </span>
  );
}

function getMatchScoreBadge(score: number) {
  if (score >= 50) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 30) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

interface RecommendedLoadData {
  loadId: string;
  loadNumber: string;
  pickupCity: string;
  dropoffCity: string;
  weight: string;
  materialType: string | null;
  requiredTruckType: string | null;
  pickupDate: string | null;
  price: number | null;
  score: number;
  matchReasons: string[];
  truckTypeMatch: boolean;
  capacityMatch: boolean;
  routeMatch: boolean;
  commodityMatch: boolean;
  shipperMatch: boolean;
}

function calculateMatchScore(load: CarrierLoad, recommendations?: RecommendedLoadData[]): number {
  if (recommendations && recommendations.length > 0) {
    const rec = recommendations.find(r => r.loadId === load.id);
    if (rec) return rec.score;
  }
  return 0;
}

export default function CarrierLoadsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, carrierType } = useAuth();
  const isEnterprise = carrierType === "enterprise";
  const searchString = useSearch();
  const highlightLoadId = new URLSearchParams(searchString).get("highlight");
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [loadTypeFilter, setLoadTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"accept" | "bid">("accept");
  const [selectedLoad, setSelectedLoad] = useState<CarrierLoad | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoad, setDetailLoad] = useState<CarrierLoad | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  // Fetch trucks and drivers for enterprise carriers (with availability info)
  const { data: trucks = [], refetch: refetchTrucks } = useQuery<{ id: string; licensePlate: string; truckType: string; make?: string; model?: string; isAvailable?: boolean; unavailableReason?: string | null }[]>({
    queryKey: ["/api/trucks"],
    enabled: isEnterprise,
    staleTime: 0, // Always refetch for fresh availability data
  });

  const { data: drivers = [], refetch: refetchDrivers } = useQuery<{ id: string; name: string; phone?: string; licenseNumber?: string; isAvailable?: boolean; unavailableReason?: string | null }[]>({
    queryKey: ["/api/drivers"],
    enabled: isEnterprise,
    staleTime: 0, // Always refetch for fresh availability data
  });
  
  // Refetch trucks and drivers when bid dialog opens
  useEffect(() => {
    if (bidDialogOpen && isEnterprise) {
      refetchTrucks();
      refetchDrivers();
    }
  }, [bidDialogOpen, isEnterprise, refetchTrucks, refetchDrivers]);
  
  // Filter to only show available trucks and drivers in bid dialog
  const availableTrucks = trucks.filter(t => t.isAvailable !== false);
  const availableDrivers = drivers.filter(d => d.isAvailable !== false);

  useEffect(() => {
    if (user?.id && user?.role === "carrier") {
      connectMarketplace("carrier", user.id);
      
      const unsubscribe = onMarketplaceEvent("load_posted", (message) => {
        const load = message?.load || message;
        toast({
          title: t("carrier.newLoadAvailable"),
          description: `${load.pickupCity} ${t("common.to")} ${load.dropoffCity} - Rs. ${parseFloat(String(load.adminFinalPrice || load.price || load.finalPrice || 0)).toLocaleString("en-IN")}`,
        });
      });

      return () => {
        unsubscribe();
        disconnectMarketplace();
      };
    }
  }, [user?.id, user?.role, toast]);

  useEffect(() => {
    if (highlightLoadId) {
      setHighlightedId(highlightLoadId);
      setTimeout(() => {
        const element = document.querySelector(`[data-testid="load-card-${highlightLoadId}"]`) 
          || document.querySelector(`[data-testid="load-row-${highlightLoadId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 500);
      setTimeout(() => setHighlightedId(null), 5000);
    }
  }, [highlightLoadId]);

  // Raw API response type (before transformation)
  interface ApiLoad {
    id: string;
    pickupCity: string;
    dropoffCity: string;
    // Full address details
    pickupAddress: string | null;
    pickupLocality: string | null;
    pickupLandmark: string | null;
    dropoffAddress: string | null;
    dropoffLocality: string | null;
    dropoffLandmark: string | null;
    dropoffBusinessName: string | null;
    requiredTruckType: string | null;
    weight: string | null;
    distance: number | null;
    pickupLat?: string | null;
    pickupLng?: string | null;
    dropoffLat?: string | null;
    dropoffLng?: string | null;
    pickupState?: string | null;
    dropoffState?: string | null;
    pickupPincode?: string | null;
    dropoffPincode?: string | null;
    adminFinalPrice: string | null;
    finalPrice: string | null;
    allowCounterBids: boolean | null;
    shipperName: string | null;
    shipperId: string | null;
    bidCount: number;
    myBid: any | null;
    postedByAdmin: boolean;
    priceFixed: boolean;
    createdAt: string;
    postedAt: string | null;
    pickupDate: string | null;
    deliveryDate: string | null;
    carrierAdvancePercent: number | null;
    cargoDescription: string | null;
    goodsToBeCarried: string | null;
    shipperLoadNumber: number | null;
    adminReferenceNumber: number | null;
  }

  const { data: rawApiLoads = [], isLoading, error } = useQuery<ApiLoad[]>({
    queryKey: ['/api/carrier/loads'],
  });

  // Fetch carrier's trucks for matching
  const { data: carrierTrucks = [] } = useQuery<{ id: string; truckType: string; capacity?: number }[]>({
    queryKey: ["/api/trucks"],
  });

  // Fetch carrier's past shipments for route matching
  const { data: pastShipments = [] } = useQuery<{ loadId: string; load?: { pickupCity?: string; dropoffCity?: string; materialType?: string; goodsToBeCarried?: string } }[]>({
    queryKey: ["/api/shipments"],
  });

  // Calculate match scores based on carrier's profile
  const calculateLoadMatchScore = (
    load: CarrierLoad,
    effectiveDistanceKm: number | null | undefined,
  ): { score: number; reasons: string[]; matches: { truckTypeMatch: boolean; capacityMatch: boolean; routeMatch: boolean; commodityMatch: boolean; shipperMatch: boolean } } => {
    let score = 0;
    const reasons: string[] = [];
    const matches = {
      truckTypeMatch: false,
      capacityMatch: false,
      routeMatch: false,
      commodityMatch: false,
      shipperMatch: false,
    };

    const loadWeightNum = load.weight ? parseFloat(load.weight) : 0;

    // Get carrier's max capacity from trucks
    // For enterprise: use carrierTrucks from API (has capacity field)
    // For solo: use indianTruckTypes capacityMax based on truckType
    let carrierMaxCapacity = 0;

    if (isEnterprise && carrierTrucks.length > 0) {
      carrierMaxCapacity = Math.max(...carrierTrucks.map(truck => {
        const truckDef = indianTruckTypes.find(t => t.value === truck.truckType);
        return truck.capacity || truckDef?.capacityMax || 0;
      }), 0);
    }

    // Truck type match (30 points) - only if carrier has a truck of matching type
    if (isEnterprise && load.loadType && carrierTrucks.length > 0) {
      const hasTruckType = carrierTrucks.some(truck =>
        truck.truckType?.toLowerCase() === load.loadType?.toLowerCase()
      );
      if (hasTruckType) {
        score += 30;
        reasons.push("Truck type matches your fleet");
        matches.truckTypeMatch = true;
      }
    }

    // Capacity match (25 points) - weight must fit within carrier's truck capacity
    if (loadWeightNum > 0) {
      let capacityOk = false;
      if (carrierTrucks.length > 0) {
        // Check if any truck can handle this weight
        capacityOk = carrierTrucks.some(truck => {
          const truckDef = indianTruckTypes.find(t => t.value === truck.truckType);
          const cap = truck.capacity || truckDef?.capacityMax || 0;
          return cap >= loadWeightNum;
        });
      } else {
        // No truck data yet — give benefit of doubt for reasonable weights
        capacityOk = loadWeightNum <= 25;
      }
      if (capacityOk) {
        score += 25;
        reasons.push("Weight within your truck capacity");
        matches.capacityMatch = true;
      }
    }

    // Route match (20 points) - check if carrier has done similar routes
    if (pastShipments.length > 0) {
      const hasRouteExperience = pastShipments.some(shipment => 
        shipment.load?.pickupCity?.toLowerCase() === load.origin?.toLowerCase() ||
        shipment.load?.dropoffCity?.toLowerCase() === load.destination?.toLowerCase()
      );
      if (hasRouteExperience) {
        score += 20;
        reasons.push("You've handled similar routes");
        matches.routeMatch = true;
      }
    }

    // Commodity match (15 points) - check if carrier has handled similar cargo
    if (load.cargoDescription && pastShipments.length > 0) {
      const hasCommodityExperience = pastShipments.some(shipment => {
        const pastCargo = (shipment.load?.materialType || shipment.load?.goodsToBeCarried || "").toLowerCase();
        const currentCargo = load.cargoDescription?.toLowerCase() || "";
        return pastCargo && currentCargo && pastCargo.includes(currentCargo.split(" ")[0]);
      });
      if (hasCommodityExperience) {
        score += 15;
        reasons.push("Similar cargo experience");
        matches.commodityMatch = true;
      }
    }

    // Shipper match (10 points) - if carrier has worked with this shipper before
    if (load.shipperId && pastShipments.length > 0) {
      // This would need shipper tracking in shipments, adding placeholder logic
      score += 10;
      reasons.push("Preferred shipper");
      matches.shipperMatch = true;
    }

    // Distance bonus (10 points) - prefer shorter distances
    if (effectiveDistanceKm != null && effectiveDistanceKm > 0 && effectiveDistanceKm < 500) {
      score += 10;
      reasons.push("Short distance route");
    }

    // Admin posted bonus (5 points) - admin loads are verified
    if (load.postedByAdmin) {
      score += 5;
      reasons.push("Verified by admin");
    }

    return { score, reasons, matches };
  };

  // Transform API data to match CarrierLoad interface
  const apiLoads: CarrierLoad[] = useMemo(() => {
    return rawApiLoads.map(load => ({
      id: load.id,
      origin: load.pickupCity || "Unknown",
      destination: load.dropoffCity || "Unknown",
      // Full address details
      pickupAddress: load.pickupAddress,
      pickupLocality: load.pickupLocality,
      pickupLandmark: load.pickupLandmark,
      pickupCity: load.pickupCity,
      dropoffAddress: load.dropoffAddress,
      dropoffLocality: load.dropoffLocality,
      dropoffLandmark: load.dropoffLandmark,
      dropoffBusinessName: load.dropoffBusinessName,
      dropoffCity: load.dropoffCity,
      loadType: load.requiredTruckType,
      weight: load.weight,
      estimatedDistance: carrierKmEstimateOnly(load),
      pickupState: load.pickupState ?? null,
      dropoffState: load.dropoffState ?? null,
      pickupPincode: load.pickupPincode ?? null,
      dropoffPincode: load.dropoffPincode ?? null,
      adminFinalPrice: load.adminFinalPrice,
      finalPrice: load.finalPrice,
      allowCounterBids: load.allowCounterBids,
      shipperName: load.shipperName,
      shipperId: load.shipperId,
      bidCount: load.bidCount || 0,
      myBid: load.myBid,
      postedByAdmin: load.postedByAdmin ?? true,
      priceFixed: load.priceFixed ?? false,
      createdAt: load.postedAt || load.createdAt,
      pickupDate: load.pickupDate,
      deliveryDate: load.deliveryDate,
      carrierAdvancePercent: load.carrierAdvancePercent,
      cargoDescription: load.goodsToBeCarried || load.cargoDescription,
      postedAt: load.postedAt,
      shipperLoadNumber: load.shipperLoadNumber,
      adminReferenceNumber: load.adminReferenceNumber,
    }));
  }, [rawApiLoads]);

  const loads = useMemo(() => {
    return apiLoads;
  }, [apiLoads]);

  type RouteMetricsResponse = { distance: number; duration: string };

  const loadRouteQueries = useQueries({
    queries: loads.map((load) => {
      const origin = buildCarrierRouteOriginString(load);
      const dest = buildCarrierRouteDestinationString(load);
      return {
        queryKey: ["/api/distance/calculate", load.id, origin, dest] as const,
        queryFn: async (): Promise<RouteMetricsResponse> => {
          const response = await fetch("/api/distance/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ origin, destination: dest }),
          });
          if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(errorData.error || `Distance API failed (${response.status})`);
          }
          return response.json();
        },
        enabled: origin.length >= 2 && dest.length >= 2,
        staleTime: 86_400_000,
      };
    }),
  });

  const loadDistanceUiById = new Map<string, { text: string | null; pending: boolean }>();
  loads.forEach((load, i) => {
    const q = loadRouteQueries[i];
    const r = q?.data?.distance;
    if (r != null && Number.isFinite(r) && r > 0) {
      loadDistanceUiById.set(load.id, { text: `${Math.round(r)} km`, pending: false });
      return;
    }
    if (load.estimatedDistance != null && load.estimatedDistance > 0) {
      const pending = !!(q?.isPending && !q?.data);
      loadDistanceUiById.set(load.id, { text: `~${load.estimatedDistance} km`, pending });
      return;
    }
    if (q?.isPending && !q?.data) {
      loadDistanceUiById.set(load.id, { text: null, pending: true });
      return;
    }
    loadDistanceUiById.set(load.id, { text: null, pending: false });
  });

  const detailDistanceLabel =
    detailDialogOpen && detailLoad
      ? (() => {
          const ui = loadDistanceUiById.get(detailLoad.id);
          if (ui?.pending && !ui?.text) return "Calculating…";
          return ui?.text ?? null;
        })()
      : null;

  const bidMutation = useMutation({
    mutationFn: async (data: { load_id: string; amount: number; bid_type: string; truck_id?: string; driver_id?: string }) => {
      return apiRequest('POST', '/api/bids/submit', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/carrier/loads'] });
      // Reset truck/driver selection after successful bid
      setSelectedTruckId("");
      setSelectedDriverId("");
    },
  });

  // Direct accept mutation for fixed-price loads - creates invoice and shipment immediately
  const acceptDirectMutation = useMutation({
    mutationFn: async (data: { load_id: string; truck_id?: string; driver_id?: string }) => {
      return apiRequest('POST', `/api/loads/${data.load_id}/accept-direct`, {
        truck_id: data.truck_id,
        driver_id: data.driver_id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/carrier/loads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/carrier/shipments'] });
      setSelectedTruckId("");
      setSelectedDriverId("");
    },
  });

  const loadsWithScores = useMemo(() => {
    return loads.map((load, idx) => {
      const q = loadRouteQueries[idx];
      const r = q?.data?.distance;
      const effectiveRouteKm =
        r != null && Number.isFinite(r) && r > 0
          ? Math.round(r)
          : load.estimatedDistance ?? null;
      const matchResult = calculateLoadMatchScore(load, effectiveRouteKm);
      return {
        ...load,
        effectiveRouteKm,
        matchScore: matchResult.score,
        matchReasons: matchResult.reasons,
        truckTypeMatch: matchResult.matches.truckTypeMatch,
        capacityMatch: matchResult.matches.capacityMatch,
        routeMatch: matchResult.matches.routeMatch,
        commodityMatch: matchResult.matches.commodityMatch,
        shipperMatch: matchResult.matches.shipperMatch,
        myBid: load.myBid,
      };
    });
  }, [loads, loadRouteQueries, carrierTrucks, pastShipments, isEnterprise]);

  const filteredAndSortedLoads = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let filtered = loadsWithScores.filter((load) => {
      const matchesSearch = !query ||
        (load.origin ?? "").toLowerCase().includes(query) ||
        (load.destination ?? "").toLowerCase().includes(query) ||
        (load.shipperName ?? "").toLowerCase().includes(query) ||
        (load.id ?? "").toLowerCase().includes(query);
      
      const eff = load.effectiveRouteKm;
      const matchesDistance =
        distanceFilter === "all" ||
        (eff != null &&
          eff > 0 &&
          ((distanceFilter === "short" && eff < 500) ||
            (distanceFilter === "medium" && eff >= 500 && eff < 1000) ||
            (distanceFilter === "long" && eff >= 1000)));
      
      const matchesLoadType = loadTypeFilter === "all" || load.loadType === loadTypeFilter;
      return matchesSearch && matchesDistance && matchesLoadType;
    });

    switch (sortBy) {
      case "match":
        filtered.sort((a, b) => b.matchScore - a.matchScore);
        break;
      case "rate":
        filtered.sort((a, b) => getCarrierPrice(b) - getCarrierPrice(a));
        break;
      case "distance":
        filtered.sort((a, b) => {
          const da = a.effectiveRouteKm ?? Number.POSITIVE_INFINITY;
          const db = b.effectiveRouteKm ?? Number.POSITIVE_INFINITY;
          return da - db;
        });
        break;
      case "newest":
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return filtered;
  }, [loadsWithScores, searchQuery, distanceFilter, loadTypeFilter, sortBy]);

  const loadTypes = useMemo(() => {
    const types = new Set(loads.map(l => l.loadType).filter(Boolean));
    return Array.from(types) as string[];
  }, [loads]);

  const stats = useMemo(() => {
    const total = loads.length;
    const highMatch = loadsWithScores.filter(l => l.matchScore >= 50).length;
    const avgRate = loads.length > 0
      ? Math.round(loads.reduce((sum, l) => sum + getCarrierPrice(l), 0) / loads.length)
      : 0;
    const fixedPriceLoads = loads.filter(l => l.priceFixed).length;
    
    return { total, highMatch, avgRate, fixedPriceLoads };
  }, [loads, loadsWithScores]);

  const handleBid = (load: CarrierLoad & { matchScore: number }) => {
    setSelectedLoad(load);
    const price = getCarrierPrice(load);
    setBidAmount(price.toString());
    setSelectedTruckId("");
    setSelectedDriverId("");
    setBidDialogOpen(true);
  };

  const handleAccept = async () => {
    if (!selectedLoad) return;
    const price = getCarrierPrice(selectedLoad);

    try {
      // Use direct accept for accepting at listed price - creates invoice and shipment immediately
      await acceptDirectMutation.mutateAsync({
        load_id: selectedLoad.id,
        ...(isEnterprise && selectedTruckId && { truck_id: selectedTruckId }),
        ...(isEnterprise && selectedDriverId && { driver_id: selectedDriverId }),
      });
      
      toast({
        title: t("carrier.loadAccepted"),
        description: `Load accepted at ${formatCurrency(price)}. Shipment created and ready for pickup.`,
      });
      setBidDialogOpen(false);
      setBidAmount("");
      setSelectedLoad(null);
    } catch (err: any) {
      toast({
        title: t("carrier.failedToAccept"),
        description: err.message || t("carrier.couldNotAcceptLoad"),
        variant: "destructive",
      });
    }
  };

  // Direct accept from card button - for solo carriers or when no truck/driver selection needed
  const handleDirectAccept = async (load: CarrierLoad & { matchScore: number }) => {
    const price = getCarrierPrice(load);

    // For enterprise carriers, open dialog to select truck/driver
    if (isEnterprise) {
      setSelectedLoad(load);
      setBidAmount(price.toString());
      setSelectedTruckId("");
      setSelectedDriverId("");
      setDialogMode("accept");
      setBidDialogOpen(true);
      return;
    }
    
    try {
      await acceptDirectMutation.mutateAsync({
        load_id: load.id,
      });
      
      toast({
        title: t("carrier.loadAccepted"),
        description: `Load accepted at ${formatCurrency(price)}. Shipment created and ready for pickup.`,
      });
    } catch (err: any) {
      toast({
        title: t("carrier.failedToAccept"),
        description: err.message || t("carrier.couldNotAcceptLoad"),
        variant: "destructive",
      });
    }
  };

  // Open bid dialog for placing a counter bid
  const handlePlaceBid = (load: CarrierLoad & { matchScore: number }) => {
    setSelectedLoad(load);
    const price = getCarrierPrice(load);
    setBidAmount(price.toString());
    setSelectedTruckId("");
    setSelectedDriverId("");
    setDialogMode("bid");
    setBidDialogOpen(true);
  };

  const submitBid = async () => {
    if (!bidAmount || !selectedLoad) return;
    
    const amount = parseInt(bidAmount);
    const carrierPrice = getCarrierPrice(selectedLoad);
    const isCounterBid = !selectedLoad.priceFixed && amount !== carrierPrice;

    try {
      await bidMutation.mutateAsync({
        load_id: selectedLoad.id,
        amount,
        bid_type: isCounterBid ? 'counter' : 'carrier_bid',
        ...(isEnterprise && selectedTruckId && { truck_id: selectedTruckId }),
        ...(isEnterprise && selectedDriverId && { driver_id: selectedDriverId }),
      });
      
      toast({
        title: isCounterBid ? t("bids.counterSubmitted") : t("bids.bidPlacedSuccessfully"),
        description: isCounterBid
          ? t("bids.counterSubmittedDesc", { amount: formatCurrency(amount) })
          : t("bids.bidSubmittedDesc", { amount: formatCurrency(amount) }),
      });
      setBidDialogOpen(false);
      setBidAmount("");
      setSelectedLoad(null);
    } catch (err: any) {
      toast({
        title: t("bids.failedToSubmitBid"),
        description: err.message || t("bids.couldNotSubmitBid"),
        variant: "destructive",
      });
    }
  };

  const topRecommendations = filteredAndSortedLoads
    .filter(l => l.matchScore >= 50)
    .slice(0, 6);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("carrier.smartLoadMatching")}</h1>
            <p className="text-muted-foreground">{t("common.loading")}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <EmptyState
          icon={Package}
          title={t("carrier.failedToLoadLoads")}
          description={t("carrier.errorLoadingLoads")}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-loads-title">{t("carrier.smartLoadMatching")}</h1>
          <p className="text-sm text-muted-foreground">{t("carrier.findAndBidLoads", { count: loads.length })}</p>
        </div>
      </div>
      
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("carrier.availableLoads")}
          value={stats.total}
          icon={Package}
          subtitle={t("carrier.currentlyPosted")}
          testId="stat-total-loads"
        />
        <StatCard
          title={t("carrier.highMatch")}
          value={stats.highMatch}
          icon={Target}
          subtitle="50+ match score"
          testId="stat-high-match"
        />
        <StatCard
          title={t("carrier.avgRate")}
          value={formatCurrency(stats.avgRate)}
          icon={TrendingUp}
          subtitle={t("carrier.perLoad")}
          testId="stat-avg-rate"
        />
        <StatCard
          title={t("carrier.fixedPrice")}
          value={stats.fixedPriceLoads}
          icon={Lock}
          subtitle={t("carrier.acceptInstantly")}
          testId="stat-fixed"
        />
      </div>

      {topRecommendations.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              {t("carrier.recommendedForFleet")}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Matched based on your truck, route history, and experience</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {topRecommendations.map((load) => (
                <Card 
                  key={load.id} 
                  className="hover-elevate cursor-pointer" 
                  data-testid={`rec-load-${load.id}`}
                  onClick={() => {
                    setDetailLoad(load);
                    setDetailDialogOpen(true);
                  }}
                >
                  <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <Badge className={`${getMatchScoreBadge(load.matchScore)} no-default-hover-elevate no-default-active-elevate text-xs`}>
                          <Target className="h-3 w-3 mr-1" />
                          {load.matchScore} pts
                        </Badge>
                        {load.postedByAdmin && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 no-default-hover-elevate no-default-active-elevate text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatLoadId(load)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs sm:text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{load.origin}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="font-medium truncate">{load.destination}</span>
                    </div>
                    {/* Match reason badges */}
                    <div className="flex flex-wrap gap-1">
                      {(load as any).truckTypeMatch && (
                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 no-default-hover-elevate no-default-active-elevate">
                          <Truck className="h-2.5 w-2.5 mr-1" />
                          Truck
                        </Badge>
                      )}
                      {(load as any).capacityMatch && (
                        <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 no-default-hover-elevate no-default-active-elevate">
                          <Package className="h-2.5 w-2.5 mr-1" />
                          Capacity
                        </Badge>
                      )}
                      {(load as any).routeMatch && (
                        <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950 no-default-hover-elevate no-default-active-elevate">
                          <MapPin className="h-2.5 w-2.5 mr-1" />
                          Route
                        </Badge>
                      )}
                      {(load as any).commodityMatch && (
                        <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950 no-default-hover-elevate no-default-active-elevate">
                          <Package className="h-2.5 w-2.5 mr-1" />
                          Cargo
                        </Badge>
                      )}
                      {(load as any).shipperMatch && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950 no-default-hover-elevate no-default-active-elevate">
                          <Building2 className="h-2.5 w-2.5 mr-1" />
                          Shipper
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-base sm:text-lg font-bold">{formatCurrency(getCarrierPrice(load))}</span>
                      <div className="flex gap-1">
                        {load.myBid ? (
                          <Button size="sm" disabled data-testid={`button-bid-rec-${load.id}`} className="text-xs">
                            Bid Placed
                          </Button>
                        ) : (
                          <>
                            <Button 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); handleDirectAccept(load); }} 
                              data-testid={`button-accept-rec-${load.id}`}
                              className="text-xs"
                            >
                              Accept
                            </Button>
                            {!load.priceFixed && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); handlePlaceBid(load); }} 
                                data-testid={`button-bid-rec-${load.id}`}
                                className="text-xs"
                              >
                                Bid
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("carrier.searchLoadsPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-loads"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <Select value={distanceFilter} onValueChange={setDistanceFilter}>
            <SelectTrigger className="w-full sm:w-36" data-testid="select-distance-filter">
              <SelectValue placeholder={t("loads.distance")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("carrier.allDistances")}</SelectItem>
              <SelectItem value="short">{t("carrier.under500km")}</SelectItem>
              <SelectItem value="medium">{t("carrier.500to1000km")}</SelectItem>
              <SelectItem value="long">{t("carrier.over1000km")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={loadTypeFilter} onValueChange={setLoadTypeFilter}>
            <SelectTrigger className="w-full sm:w-36" data-testid="select-type-filter">
              <SelectValue placeholder={t("loads.loadType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("carrier.allTypes")}</SelectItem>
              {loadTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-36" data-testid="select-sort">
              <SelectValue placeholder={t("common.sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match">{t("carrier.bestMatch")}</SelectItem>
              <SelectItem value="rate">{t("carrier.highestRate")}</SelectItem>
              <SelectItem value="distance">{t("carrier.shortest")}</SelectItem>
              <SelectItem value="newest">{t("carrier.newest")}</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="grid" data-testid="button-view-grid">
                <LayoutGrid className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list" data-testid="button-view-list">
                <List className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {filteredAndSortedLoads.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("loads.noLoadsFound")}
          description={loads.length === 0 
            ? t("carrier.noLoadsPostedYet")
            : t("carrier.noLoadsMatchFilters")
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedLoads.map((load) => (
            <Card 
              key={load.id} 
              className={`hover-elevate cursor-pointer ${highlightedId === load.id ? "ring-2 ring-primary ring-offset-2 animate-pulse" : ""}`} 
              data-testid={`load-card-${load.id}`}
              onClick={() => {
                setDetailLoad(load);
                setDetailDialogOpen(true);
              }}
            >
              <CardContent className="p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <Badge className={`${getMatchScoreBadge(load.matchScore)} no-default-hover-elevate no-default-active-elevate text-xs`}>
                      <Target className="h-3 w-3 mr-1" />
                      {load.matchScore}% {t("carrier.match")}
                    </Badge>
                    {load.postedByAdmin && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 no-default-hover-elevate no-default-active-elevate text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Posted by Admin
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatLoadId(load)}</span>
                </div>
                
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm break-words">{load.origin}</div>
                      {load.pickupLocality && (
                        <div className="text-xs text-muted-foreground break-words">{load.pickupLocality}</div>
                      )}
                      {load.pickupLandmark && (
                        <div className="text-xs text-muted-foreground break-words">Near: {load.pickupLandmark}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm break-words">{load.destination}</div>
                      {load.dropoffBusinessName && (
                        <div className="text-xs font-medium break-words">{load.dropoffBusinessName}</div>
                      )}
                      {load.dropoffLocality && (
                        <div className="text-xs text-muted-foreground break-words">{load.dropoffLocality}</div>
                      )}
                      {load.dropoffLandmark && (
                        <div className="text-xs text-muted-foreground break-words">Near: {load.dropoffLandmark}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {load.loadType && <Badge variant="outline" className="text-xs">{load.loadType}</Badge>}
                  {load.weight && <Badge variant="outline" className="text-xs">{load.weight} Tons</Badge>}
                  {(() => {
                    const ui = loadDistanceUiById.get(load.id);
                    if (ui?.text) {
                      return (
                        <Badge variant="outline" className="text-xs">{ui.text}</Badge>
                      );
                    }
                    if (ui?.pending) {
                      return (
                        <Badge variant="outline" className="text-xs">…</Badge>
                      );
                    }
                    return null;
                  })()}
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${load.priceFixed 
                      ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400" 
                      : "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                    }`}
                  >
                    {load.priceFixed ? (
                      <><Lock className="h-3 w-3 mr-1" />Fixed Price</>
                    ) : (
                      <><Unlock className="h-3 w-3 mr-1" />Negotiable</>
                    )}
                  </Badge>
                </div>
                
                                
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 border-t gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Price</p>
                    <p className="text-lg sm:text-xl font-bold">{formatCurrency(getCarrierPrice(load))}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {load.myBid ? (
                      <Button disabled data-testid={`button-bid-${load.id}`} size="sm" className="text-xs">
                        Bid Placed
                      </Button>
                    ) : (
                      <>
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDirectAccept(load);
                          }} 
                          data-testid={`button-accept-${load.id}`}
                          size="sm"
                          className="text-xs"
                        >
                          Accept
                        </Button>
                        {!load.priceFixed && (
                          <Button 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlaceBid(load);
                            }} 
                            data-testid={`button-bid-${load.id}`}
                            size="sm"
                            className="text-xs"
                          >
                            Place Bid
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {load.myBid && (
                  <div className="text-xs text-muted-foreground">
                    <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                      Your bid: {formatCurrency(parseFloat(load.myBid.counterAmount || load.myBid.amount))}
                      {load.myBid.status === "countered" && " (Countered)"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {filteredAndSortedLoads.map((load) => (
                  <div key={load.id} className={`p-4 hover-elevate ${highlightedId === load.id ? "ring-2 ring-primary ring-offset-2 animate-pulse" : ""}`} data-testid={`load-row-${load.id}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className={`${getMatchScoreBadge(load.matchScore)} no-default-hover-elevate no-default-active-elevate`}>
                            <Target className="h-3 w-3 mr-1" />
                            {load.matchScore}%
                          </Badge>
                          <span className="text-sm text-muted-foreground">{formatLoadId(load)}</span>
                          {load.loadType && <Badge variant="outline">{load.loadType}</Badge>}
                          {load.myBid && (
                            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                              Bid placed
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{load.origin}</span>
                          <ArrowRight className="h-4 w-4" />
                          <span className="font-medium">{load.destination}</span>
                          {(() => {
                            const ui = loadDistanceUiById.get(load.id);
                            if (ui?.text) {
                              return (
                                <span className="text-sm text-muted-foreground">({ui.text})</span>
                              );
                            }
                            if (ui?.pending) {
                              return (
                                <span className="text-sm text-muted-foreground">(…)</span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                                    {load.weight && (
                            <span className="flex items-center gap-1">
                              <Package className="h-4 w-4" />
                              {load.weight} Tons
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Rate</p>
                          <p className="text-xl font-bold">{formatCurrency(getCarrierPrice(load))}</p>
                        </div>
                        <div className="flex gap-2">
                          {load.myBid ? (
                            <Button disabled data-testid={`button-bid-list-${load.id}`}>
                              Placed
                            </Button>
                          ) : (
                            <>
                              <Button 
                                onClick={() => handleDirectAccept(load)} 
                                data-testid={`button-accept-list-${load.id}`}
                              >
                                Accept
                              </Button>
                              {!load.priceFixed && (
                                <Button 
                                  variant="outline"
                                  onClick={() => handlePlaceBid(load)} 
                                  data-testid={`button-bid-list-${load.id}`}
                                >
                                  Bid
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Load Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md md:max-w-lg p-0 !gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Load Details</DialogTitle>
            <DialogDescription>Details for load {detailLoad ? formatLoadId(detailLoad) : ''}</DialogDescription>
          </DialogHeader>
          
          {detailLoad && (
            <div className="flex flex-col max-h-[85vh] sm:max-h-[70vh]">
              <div className="overflow-y-auto flex-1">
              <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <Badge className={`${getMatchScoreBadge((detailLoad as any).matchScore || 80)} no-default-hover-elevate no-default-active-elevate text-xs`}>
                      <Target className="h-3 w-3 mr-1" />
                      {(detailLoad as any).matchScore || 80}% Match
                    </Badge>
                    {detailLoad.priceFixed ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate text-xs">
                        <Lock className="h-3 w-3 mr-1" />Fixed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate text-xs">
                        <Unlock className="h-3 w-3 mr-1" />Negotiable
                      </Badge>
                    )}
                    {detailLoad.postedByAdmin && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 no-default-hover-elevate no-default-active-elevate text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />Admin
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs sm:text-sm font-mono text-muted-foreground whitespace-nowrap">{formatLoadId(detailLoad)}</span>
                </div>

                <div className="relative pl-4 sm:pl-5 space-y-1">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px border-l-2 border-dashed border-muted-foreground/30" />
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="absolute left-0 mt-1 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                    <div className="ml-2 sm:ml-3 min-w-0 flex-1">
                      <div className="font-semibold text-sm break-words">{detailLoad.origin}</div>
                      {detailLoad.pickupAddress && <div className="text-xs text-muted-foreground break-words">{detailLoad.pickupAddress}</div>}
                      {detailLoad.pickupLocality && <div className="text-xs text-muted-foreground break-words">{detailLoad.pickupLocality}</div>}
                      {detailLoad.pickupLandmark && <div className="text-xs text-muted-foreground break-words">Near: {detailLoad.pickupLandmark}</div>}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3 pt-3">
                    <div className="absolute left-0 mt-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                    <div className="ml-2 sm:ml-3 min-w-0 flex-1">
                      <div className="font-semibold text-sm break-words">{detailLoad.destination}</div>
                      {detailLoad.dropoffBusinessName && <div className="text-xs font-medium break-words">{detailLoad.dropoffBusinessName}</div>}
                      {detailLoad.dropoffAddress && <div className="text-xs text-muted-foreground break-words">{detailLoad.dropoffAddress}</div>}
                      {detailLoad.dropoffLocality && <div className="text-xs text-muted-foreground break-words">{detailLoad.dropoffLocality}</div>}
                      {detailLoad.dropoffLandmark && <div className="text-xs text-muted-foreground break-words">Near: {detailLoad.dropoffLandmark}</div>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {detailLoad.loadType && (
                    <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5 shrink-0" />{detailLoad.loadType}</span>
                  )}
                  {detailLoad.weight && (
                    <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5 shrink-0" />{detailLoad.weight} Tons</span>
                  )}
                  {detailDistanceLabel && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {detailDistanceLabel}
                    </span>
                  )}
                  {detailLoad.cargoDescription && (
                    <span className="flex items-center gap-1 break-words"><Package className="h-3.5 w-3.5 shrink-0" />{detailLoad.cargoDescription}</span>
                  )}
                  {detailLoad.postedAt && (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {new Date(detailLoad.postedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>

                {/* Shipper Details */}
                {detailLoad.shipperName && (
                  <div className="border rounded-lg p-3 space-y-1.5 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shipper</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{detailLoad.shipperName}</span>
                      </div>
                      <ShipperRatingBadge shipperId={detailLoad.shipperId} />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t px-4 sm:px-5 py-3 sm:py-4 bg-muted/30 space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Price</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">{formatCurrency(getCarrierPrice(detailLoad))}</span>
                </div>

                {(detailLoad.carrierAdvancePercent !== null && detailLoad.carrierAdvancePercent !== undefined && detailLoad.carrierAdvancePercent > 0) && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-md bg-background">
                      <p className="text-xs text-muted-foreground">Advance</p>
                      <p className="font-semibold text-sm text-green-600 dark:text-green-400">{detailLoad.carrierAdvancePercent}%</p>
                    </div>
                    <div className="p-2 rounded-md bg-background">
                      <p className="text-xs text-muted-foreground">Upfront</p>
                      <p className="font-semibold text-xs sm:text-sm text-green-600 dark:text-green-400">
                        {formatCurrency(Math.round(getCarrierPrice(detailLoad) * (detailLoad.carrierAdvancePercent / 100)))}
                      </p>
                    </div>
                    <div className="p-2 rounded-md bg-background">
                      <p className="text-xs text-muted-foreground">On Delivery</p>
                      <p className="font-semibold text-xs sm:text-sm">
                        {formatCurrency(Math.round(getCarrierPrice(detailLoad) * (1 - detailLoad.carrierAdvancePercent / 100)))}
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground leading-snug">*Final price reflects a one-time TDS deduction if TDS declaration was not provided at the time of registration.</p>
              </div>

              {((detailLoad as any).matchScore > 0) && (
                <div className="border-t px-4 sm:px-5 py-3 sm:py-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Why This Load Matches</span>
                    <Badge variant="secondary" className="ml-auto no-default-hover-elevate no-default-active-elevate text-xs">
                      {(detailLoad as any).matchScore} pts
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(detailLoad as any).truckTypeMatch && (
                      <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate">
                        <Truck className="h-3 w-3" />Truck Match +30
                      </Badge>
                    )}
                    {(detailLoad as any).capacityMatch && (
                      <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate">
                        <Package className="h-3 w-3" />Capacity +25
                      </Badge>
                    )}
                    {(detailLoad as any).routeMatch && (
                      <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate">
                        <MapPin className="h-3 w-3" />Route Exp +20
                      </Badge>
                    )}
                    {(detailLoad as any).commodityMatch && (
                      <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate">
                        <Package className="h-3 w-3" />Commodity +15
                      </Badge>
                    )}
                    {(detailLoad as any).shipperMatch && (
                      <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate">
                        <Building2 className="h-3 w-3" />Shipper Exp +10
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              </div>
              <div className="border-t px-4 sm:px-5 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 flex-shrink-0">
                {detailLoad?.myBid ? (
                  <Button disabled data-testid="button-bid-from-detail" size="sm" className="text-xs">
                    Bid Placed
                  </Button>
                ) : (
                  <>
                    {!detailLoad?.priceFixed && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setDetailDialogOpen(false);
                          if (detailLoad) handlePlaceBid(detailLoad as any);
                        }}
                        data-testid="button-bid-from-detail"
                        size="sm"
                        className="text-xs"
                      >
                        Place Bid
                      </Button>
                    )}
                    <Button 
                      onClick={() => {
                        setDetailDialogOpen(false);
                        if (detailLoad) handleDirectAccept(detailLoad as any);
                      }}
                      data-testid="button-accept-from-detail"
                      size="sm"
                      className="text-xs"
                    >
                      Accept Load
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {dialogMode === "accept" ? "Accept Load" : "Place Bid"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {dialogMode === "accept" 
                ? "Confirm acceptance at the carrier payout price"
                : "Submit your counter-offer for this load"
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedLoad && (
            <div className="space-y-3 sm:space-y-4 py-2">
              {/* Compact Load Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <MapPin className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="font-medium">{selectedLoad.origin}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <MapPin className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="font-medium">{selectedLoad.destination}</span>
                </div>
                <span className="text-muted-foreground text-xs">{formatLoadId(selectedLoad)}</span>
              </div>
              
              {/* Mode Toggle for negotiable loads */}
              {!selectedLoad.priceFixed && (
                <Tabs value={dialogMode} onValueChange={(v) => setDialogMode(v as "accept" | "bid")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="accept" data-testid="tab-accept" className="text-xs sm:text-sm">
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Accept
                    </TabsTrigger>
                    <TabsTrigger value="bid" data-testid="tab-bid" className="text-xs sm:text-sm">
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Place Bid
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              
              {/* Accept Mode View */}
              {dialogMode === "accept" && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-muted-foreground">Your Payout</span>
                      <span className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(getCarrierPrice(selectedLoad))}
                      </span>
                    </div>
                  </div>
                  
                  {/* Truck/Driver Selection for Enterprise */}
                  {isEnterprise && (
                    <div className="space-y-2 sm:space-y-3">
                      <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
                        <SelectTrigger data-testid="select-truck" className="text-xs sm:text-sm">
                          <Truck className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Select Truck *" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTrucks.length === 0 ? (
                            <div className="p-2 text-xs sm:text-sm text-muted-foreground text-center">
                              No available trucks
                            </div>
                          ) : (
                            availableTrucks.map((truck) => (
                              <SelectItem key={truck.id} value={truck.id} className="text-xs sm:text-sm">
                                {truck.licensePlate} - {truck.truckType}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      
                      <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                        <SelectTrigger data-testid="select-driver" className="text-xs sm:text-sm">
                          <SelectValue placeholder="Assign Driver" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned" className="text-xs sm:text-sm">Assign Later</SelectItem>
                          {availableDrivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id} className="text-xs sm:text-sm">
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <Button 
                    className="w-full text-xs sm:text-sm"
                    onClick={handleAccept}
                    disabled={acceptDirectMutation.isPending || (isEnterprise && !selectedTruckId)}
                    data-testid="button-accept-load"
                    size="sm"
                  >
                    {acceptDirectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Accept at {formatCurrency(getCarrierPrice(selectedLoad))}
                  </Button>
                  {isEnterprise && !selectedTruckId && (
                    <p className="text-xs text-destructive text-center">
                      Please select a truck to accept this load.
                    </p>
                  )}
                </div>
              )}
              
              {/* Bid Mode View */}
              {dialogMode === "bid" && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <span className="text-xs sm:text-sm text-muted-foreground">Admin Price</span>
                      <span className="text-base sm:text-lg font-medium">{formatCurrency(getCarrierPrice(selectedLoad))}</span>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium">Your Bid Amount</label>
                      <Input
                        type="number"
                        placeholder=""
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        className="text-base sm:text-lg font-medium"
                        data-testid="input-bid-amount"
                      />
                    </div>
                  </div>
                  
                  {/* Truck/Driver Selection for Enterprise */}
                  {isEnterprise && (
                    <div className="space-y-2 sm:space-y-3">
                      <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
                        <SelectTrigger data-testid="select-truck-bid" className="text-xs sm:text-sm">
                          <Truck className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Select Truck *" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTrucks.length === 0 ? (
                            <div className="p-2 text-xs sm:text-sm text-muted-foreground text-center">
                              No available trucks
                            </div>
                          ) : (
                            availableTrucks.map((truck) => (
                              <SelectItem key={truck.id} value={truck.id} className="text-xs sm:text-sm">
                                {truck.licensePlate} - {truck.truckType}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      
                      <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                        <SelectTrigger data-testid="select-driver-bid" className="text-xs sm:text-sm">
                          <SelectValue placeholder="Assign Driver" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned" className="text-xs sm:text-sm">Assign Later</SelectItem>
                          {availableDrivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id} className="text-xs sm:text-sm">
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <Button 
                    className="w-full text-xs sm:text-sm"
                    onClick={submitBid}
                    disabled={!bidAmount || bidMutation.isPending || (isEnterprise && !selectedTruckId)}
                    data-testid="button-place-bid"
                    size="sm"
                  >
                    {bidMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Submit Bid at {bidAmount ? formatCurrency(parseInt(bidAmount)) : "..."}
                  </Button>
                  {isEnterprise && !selectedTruckId && (
                    <p className="text-xs text-destructive text-center">
                      Please select a truck to place a bid.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidDialogOpen(false)} data-testid="button-cancel-bid" size="sm" className="text-xs sm:text-sm">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
