import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { 
  Search, Calendar, MapPin, Truck, User, Star, Clock, 
  CheckCircle, TrendingUp, Fuel, DollarSign, ArrowRight, Filter, X,
  AlertTriangle, FileCheck
} from "lucide-react";
import { deriveRegion } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { type CompletedTrip } from "@/lib/carrier-data-store";
import { useShipments, useLoads, useTrucks } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-context";
import { onMarketplaceEvent } from "@/lib/marketplace-socket";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, isAfter } from "date-fns";
import type { Shipment, Load, Driver, Truck as DbTruck } from "@shared/schema";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function convertShipmentToCompletedTrip(
  shipment: Shipment, 
  load: Load | undefined, 
  drivers: Driver[], 
  trucks: DbTruck[],
  soloCarrierName?: string
): CompletedTrip {
  const loadNum = (load as any)?.shipperLoadNumber || load?.adminReferenceNumber;
  const loadId = loadNum
    ? `LD-${String(loadNum).padStart(3, '0')}` 
    : `LD-${shipment.loadId.slice(0, 6)}`;
  
  const rate = load?.adminFinalPrice ? parseFloat(load.adminFinalPrice) : 50000;
  let distance = 0;
  if (load) {
    const k = computeRouteDistanceKmEstimate({
      pickupLat: load.pickupLat,
      pickupLng: load.pickupLng,
      dropoffLat: load.dropoffLat,
      dropoffLng: load.dropoffLng,
      pickupCity: load.pickupCity,
      dropoffCity: load.dropoffCity,
    });
    if (Number.isFinite(k)) {
      const r = Math.round(k);
      if (r >= 1) distance = r;
    }
  }
  
  const assignedDriver = shipment.driverId ? drivers.find(d => d.id === shipment.driverId) : null;
  const assignedTruck = shipment.truckId 
    ? trucks.find(t => t.id === shipment.truckId) 
    : trucks[0];
  
  return {
    tripId: `real-${shipment.id}`,
    loadId,
    route: `${load?.pickupCity || 'Origin'} to ${load?.dropoffCity || 'Destination'}`,
    distanceTraveled: distance,
    fuelUsed: Math.round(distance / 4),
    profitEarned: Math.round(rate * 0.2),
    tripTime: Math.round(distance / 50),
    onTimeDelivery: true,
    driverPerformanceRating: 4.5,
    truckPerformanceRating: 4.2,
    shipperRating: 4.8,
    completedAt: shipment.completedAt ? new Date(shipment.completedAt) : new Date(),
    physicalPodSubmittedAt: shipment.physicalPodSubmittedAt ? new Date(shipment.physicalPodSubmittedAt) : null,
    driverName: assignedDriver?.name || soloCarrierName || 'Unassigned',
    truckPlate: assignedTruck?.licensePlate || 'Unassigned',
    loadType: load?.requiredTruckType || 'General',
  };
}

function getPodCountdown(completedAt: Date, physicalPodSubmittedAt?: Date | null): { daysLeft: number; isExpired: boolean; isUrgent: boolean; isSubmitted: boolean; daysAfterDeadline: number } {
  const deadline = new Date(completedAt);
  deadline.setDate(deadline.getDate() + 15);
  const now = new Date();
  const msLeft = deadline.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  
  // Check if physical POD was submitted
  const isSubmitted = !!physicalPodSubmittedAt;
  
  // Calculate days after deadline if submitted after deadline
  let daysAfterDeadline = 0;
  if (isSubmitted && physicalPodSubmittedAt) {
    const submittedDate = new Date(physicalPodSubmittedAt);
    const msAfterDeadline = submittedDate.getTime() - deadline.getTime();
    daysAfterDeadline = Math.ceil(msAfterDeadline / (1000 * 60 * 60 * 24));
  }
  
  return {
    daysLeft,
    isExpired: daysLeft <= 0 && !isSubmitted,
    isUrgent: daysLeft > 0 && daysLeft <= 3 && !isSubmitted,
    isSubmitted,
    daysAfterDeadline: Math.max(0, daysAfterDeadline),
  };
}

export default function CarrierHistoryPage() {
  const { user, carrierType } = useAuth();
  const { toast } = useToast();
  const searchString = useSearch();
  const { data: allShipments = [], refetch: refetchShipments } = useShipments();
  const { data: allLoads = [] } = useLoads();
  const { data: allTrucks = [] } = useTrucks();
  
  const isEnterprise = carrierType === "enterprise";
  
  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
    enabled: isEnterprise,
  });
  
  // Get region filter from URL params
  const urlParams = new URLSearchParams(searchString);
  const regionFromUrl = urlParams.get('region') || "";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [loadTypeFilter, setLoadTypeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState(regionFromUrl);
  const [selectedTrip, setSelectedTrip] = useState<CompletedTrip | null>(null);
  
  // Update region filter when URL changes
  useEffect(() => {
    setRegionFilter(regionFromUrl);
  }, [regionFromUrl]);
  
  // Real-time updates when trips are completed
  useEffect(() => {
    const unsubCompleted = onMarketplaceEvent("trip_completed", () => {
      refetchShipments();
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
      toast({ title: "Trip Completed", description: "A new trip has been added to history" });
    });
    return () => { unsubCompleted(); };
  }, [refetchShipments, toast]);

  // Check if this is a solo carrier
  const isSoloCarrier = user?.carrierType === 'solo';

  // Convert real delivered shipments to completed trips
  // Also store the original load data for accurate region filtering
  const { completedTrips, tripsWithLoadData } = useMemo(() => {
    const myShipments = allShipments.filter((s: Shipment) => 
      s.carrierId === user?.id && s.status === 'delivered'
    );
    
    const tripsData: Array<{ trip: CompletedTrip; load: Load | undefined }> = myShipments.map((shipment: Shipment) => {
      const load = allLoads.find((l: Load) => l.id === shipment.loadId);
      return {
        trip: convertShipmentToCompletedTrip(
          shipment, load, drivers, allTrucks as DbTruck[],
          carrierType === "solo" ? (user?.username || user?.companyName || undefined) : undefined
        ),
        load
      };
    });
    
    return {
      completedTrips: tripsData.map(t => t.trip),
      tripsWithLoadData: tripsData
    };
  }, [allShipments, allLoads, allTrucks, drivers, user?.id, user?.username, user?.companyName, carrierType]);

  const filteredTrips = useMemo(() => {
    return tripsWithLoadData.filter(({ trip, load }) => {
      const matchesSearch =
        trip.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.tripId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.truckPlate.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesTime = true;
      const tripDate = new Date(trip.completedAt);
      const now = new Date();
      
      if (timeFilter === "week") {
        matchesTime = isAfter(tripDate, subMonths(now, 0.25));
      } else if (timeFilter === "month") {
        matchesTime = isAfter(tripDate, subMonths(now, 1));
      } else if (timeFilter === "quarter") {
        matchesTime = isAfter(tripDate, subMonths(now, 3));
      } else if (timeFilter === "year") {
        matchesTime = isAfter(tripDate, subMonths(now, 12));
      }
      
      const matchesLoadType = loadTypeFilter === "all" || trip.loadType === loadTypeFilter;
      
      // Region filter - check if region appears in pickup or destination
      let matchesRegion = true;
      if (regionFilter) {
        const filterLower = regionFilter.toLowerCase();
        // Use actual load data for more accurate region matching
        const pickupCity = (load as any)?.pickupCity || '';
        const dropoffCity = (load as any)?.dropoffCity || '';
        const pickupRegion = deriveRegion(pickupCity).toLowerCase();
        const dropoffRegion = deriveRegion(dropoffCity).toLowerCase();
        
        // Match if filter matches pickup region, dropoff region, or appears in either city
        matchesRegion = pickupRegion === filterLower || 
                        dropoffRegion === filterLower ||
                        pickupCity.toLowerCase().includes(filterLower) ||
                        dropoffCity.toLowerCase().includes(filterLower);
      }
      
      return matchesSearch && matchesTime && matchesLoadType && matchesRegion;
    }).map(({ trip }) => trip).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, [tripsWithLoadData, searchQuery, timeFilter, loadTypeFilter, regionFilter]);

  const loadTypes = useMemo(() => {
    const types = new Set(completedTrips.map(t => t.loadType));
    return Array.from(types);
  }, [completedTrips]);

  const stats = useMemo(() => {
    const total = filteredTrips.length;
    const totalRevenue = filteredTrips.reduce((sum, t) => sum + t.profitEarned, 0);
    const onTimeRate = filteredTrips.length > 0
      ? Math.round((filteredTrips.filter(t => t.onTimeDelivery).length / filteredTrips.length) * 100)
      : 0;
    const avgPerformance = filteredTrips.length > 0
      ? Math.round(filteredTrips.reduce((sum, t) => sum + t.driverPerformanceRating, 0) / filteredTrips.length)
      : 0;
    const totalDistance = filteredTrips.reduce((sum, t) => sum + t.distanceTraveled, 0);
    
    return { total, totalRevenue, onTimeRate, avgPerformance, totalDistance };
  }, [filteredTrips]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-history-title">Trip History</h1>
          <p className="text-sm sm:text-base text-muted-foreground truncate">
            {regionFilter 
              ? `${filteredTrips.length} trips in ${regionFilter}` 
              : `${completedTrips.length} completed trips`}
          </p>
        </div>
        {regionFilter && (
          <Badge 
            variant="secondary" 
            className="flex items-center gap-1 cursor-pointer self-start sm:self-auto text-xs sm:text-sm"
            onClick={() => {
              setRegionFilter("");
              window.history.replaceState({}, '', '/carrier/history');
            }}
            data-testid="badge-region-filter"
          >
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[150px]">{regionFilter}</span>
            <X className="h-3 w-3 ml-1" />
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Trips Shown"
          value={stats.total}
          icon={CheckCircle}
          subtitle="Matching filters"
          testId="stat-filtered-trips"
        />
        <StatCard
          title="On-Time Rate"
          value={`${stats.onTimeRate}%`}
          icon={Clock}
          subtitle="Delivery success"
          testId="stat-on-time"
        />
        <StatCard
          title="Avg Performance"
          value={stats.avgPerformance}
          icon={TrendingUp}
          subtitle="Driver score"
          testId="stat-avg-performance"
        />
        <StatCard
          title="Distance"
          value={`${(stats.totalDistance / 1000).toFixed(0)}K km`}
          icon={MapPin}
          subtitle="Total covered"
          testId="stat-total-distance"
        />
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by route, trip ID, driver, or truck..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-history"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-full sm:w-40" data-testid="select-time-filter">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={loadTypeFilter} onValueChange={setLoadTypeFilter}>
            <SelectTrigger className="w-full sm:w-40" data-testid="select-type-filter">
              <SelectValue placeholder="Load Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {loadTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredTrips.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No trips found"
          description="No completed trips match your current filters."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] sm:h-[500px] md:h-[600px]">
              <div className="divide-y">
                {filteredTrips.slice(0, 100).map((trip) => (
                  <div 
                    key={trip.tripId} 
                    className="p-3 sm:p-4 hover-elevate cursor-pointer"
                    onClick={() => setSelectedTrip(trip)}
                    data-testid={`trip-row-${trip.tripId}`}
                  >
                    <div className="flex flex-col gap-3 sm:gap-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <Badge variant={trip.onTimeDelivery ? "default" : "secondary"} className="text-xs">
                            {trip.onTimeDelivery ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> On Time</>
                            ) : (
                              <><Clock className="h-3 w-3 mr-1" /> Delayed</>
                            )}
                          </Badge>
                          <span className="text-xs sm:text-sm text-muted-foreground truncate">{trip.loadId}</span>
                          <Badge variant="outline" className="text-xs">{trip.loadType}</Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 fill-amber-500" />
                          <span className="font-medium text-sm">{trip.shipperRating.toFixed(1)}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm sm:text-base break-words">{trip.route}</span>
                          {trip.distanceTraveled > 0 && (
                            <span className="text-xs sm:text-sm text-muted-foreground ml-2">
                              ({trip.distanceTraveled} km)
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{trip.driverName}</span>
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{trip.truckPlate}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Fuel className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                          {trip.fuelUsed} L
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{format(new Date(trip.completedAt), "MMM d, yyyy")}</span>
                        </span>
                      </div>
                      {(() => {
                        const { daysLeft, isExpired, isUrgent, isSubmitted, daysAfterDeadline } = getPodCountdown(new Date(trip.completedAt), trip.physicalPodSubmittedAt);
                        
                        if (isSubmitted) {
                          const deadline = new Date(trip.completedAt);
                          deadline.setDate(deadline.getDate() + 15);
                          const submittedDate = new Date(trip.physicalPodSubmittedAt!);
                          const isBeforeDeadline = submittedDate <= deadline;
                          
                          return (
                            <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 w-fit">
                              <FileCheck className="h-3 w-3 flex-shrink-0" />
                              {isBeforeDeadline 
                                ? "POD Submitted successfully"
                                : `Physical Copy of POD Submitted successfully after ${daysAfterDeadline} day${daysAfterDeadline !== 1 ? "s" : ""} of deadline expiry`
                              }
                            </div>
                          );
                        }
                        
                        if (isExpired) {
                          return (
                            <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 w-fit">
                              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                              POD deadline expired
                            </div>
                          );
                        }
                        return (
                          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md w-fit border ${
                            isUrgent
                              ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                              : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                          }`}>
                            <FileCheck className="h-3 w-3 flex-shrink-0" />
                            POD upload: {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
        Showing {Math.min(filteredTrips.length, 100)} of {filteredTrips.length} trips
      </p>

      <Dialog open={!!selectedTrip} onOpenChange={() => setSelectedTrip(null)}>
        {selectedTrip && (
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Trip Details</DialogTitle>
              <DialogDescription className="text-sm">{selectedTrip.loadId}</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="font-medium text-sm sm:text-base break-words">{selectedTrip.route}</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4 space-y-2">
                    <h4 className="font-medium text-xs sm:text-sm">Trip Info</h4>
                    <div className="text-xs sm:text-sm space-y-1">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Load Type</span>
                        <span className="text-right truncate">{selectedTrip.loadType}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Distance</span>
                        <span>
                          {selectedTrip.distanceTraveled > 0
                            ? `${selectedTrip.distanceTraveled} km`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Duration</span>
                        <span>{selectedTrip.tripTime}h</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Fuel Used</span>
                        <span>{selectedTrip.fuelUsed} L</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4 space-y-2">
                    <h4 className="font-medium text-xs sm:text-sm">Performance</h4>
                    <div className="text-xs sm:text-sm space-y-1">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Driver</span>
                        <span>{selectedTrip.driverPerformanceRating}/100</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Truck</span>
                        <span>{selectedTrip.truckPerformanceRating}/100</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Shipper Rating</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          <span>{selectedTrip.shipperRating.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">On Time</span>
                        <span className={selectedTrip.onTimeDelivery ? "text-green-600" : "text-red-600"}>
                          {selectedTrip.onTimeDelivery ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="p-2.5 sm:p-3 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Driver</span>
                  </div>
                  <p className="font-medium truncate">{selectedTrip.driverName}</p>
                </div>
                <div className="p-2.5 sm:p-3 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Truck</span>
                  </div>
                  <p className="font-medium truncate">{selectedTrip.truckPlate}</p>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center break-words">
                Completed on {format(new Date(selectedTrip.completedAt), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
