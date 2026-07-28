import { useState, useMemo } from "react";
import { 
  Truck, 
  MapPin, 
  Clock, 
  Star, 
  Filter, 
  ChevronDown,
  Package,
  Navigation,
  Phone,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Send
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMockData, type TruckMatchResult, type MockLoad } from "@/lib/mock-data-store";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface NearbyTrucksProps {
  load: MockLoad;
  onClose?: () => void;
}

type SortOption = "matchScore" | "distance" | "eta" | "rating";

export function NearbyTrucks({ load, onClose }: NearbyTrucksProps) {
  const { getNearbyTrucks, requestQuote, getTruckById } = useMockData();
  const { toast } = useToast();

  const [radiusKm, setRadiusKm] = useState(50);
  const [truckTypeFilter, setTruckTypeFilter] = useState<string>("all");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("matchScore");
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [requestingQuote, setRequestingQuote] = useState(false);
  const [hoveredTruckId, setHoveredTruckId] = useState<string | null>(null);

  const nearbyTrucks = useMemo(() => {
    const filters = {
      radiusKm,
      truckType: truckTypeFilter !== "all" ? truckTypeFilter : undefined,
      availableOnly,
      minRating: minRating > 0 ? minRating : undefined,
    };
    
    let trucks = getNearbyTrucks(load.pickup, load.type, load.weight, filters);
    
    switch (sortBy) {
      case "distance":
        trucks = [...trucks].sort((a, b) => a.distanceFromPickup - b.distanceFromPickup);
        break;
      case "eta":
        trucks = [...trucks].sort((a, b) => a.estimatedTimeToPickup - b.estimatedTimeToPickup);
        break;
      case "rating":
        trucks = [...trucks].sort((a, b) => b.reliabilityScore - a.reliabilityScore);
        break;
      default:
        break;
    }
    
    return trucks;
  }, [getNearbyTrucks, load, radiusKm, truckTypeFilter, availableOnly, minRating, sortBy]);

  const selectedTruckResult = selectedTruckId 
    ? nearbyTrucks.find(t => t.truckId === selectedTruckId) 
    : null;
  const selectedTruck = selectedTruckResult || (selectedTruckId ? getTruckById(selectedTruckId) : null);

  const handleRequestQuote = async (truckId: string) => {
    setRequestingQuote(true);
    try {
      requestQuote(truckId, load.loadId);
      toast({
        title: "Quote Requested",
        description: "The carrier will respond shortly. Check your Pending Bids.",
      });
      setSelectedTruckId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestingQuote(false);
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getAvailabilityBadge = (status: string) => {
    switch (status) {
      case "Available":
        return <Badge variant="default" className="bg-green-600">Available</Badge>;
      case "En Route":
        return <Badge variant="secondary">En Route</Badge>;
      case "Busy":
        return <Badge variant="outline">Busy</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Nearby Trucks
          </h2>
          <p className="text-sm text-muted-foreground">
            {nearbyTrucks.length} truck{nearbyTrucks.length !== 1 ? "s" : ""} found near {load.pickup}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-nearby">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between" data-testid="button-toggle-filters">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters & Sort
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Search Radius: {radiusKm} km</Label>
                  <Slider
                    value={[radiusKm]}
                    onValueChange={([value]) => setRadiusKm(value)}
                    min={5}
                    max={100}
                    step={5}
                    data-testid="slider-radius"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Truck Type</Label>
                  <Select value={truckTypeFilter} onValueChange={setTruckTypeFilter}>
                    <SelectTrigger data-testid="select-truck-type">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Dry Van">Dry Van</SelectItem>
                      <SelectItem value="Flatbed">Flatbed</SelectItem>
                      <SelectItem value="Refrigerated">Refrigerated</SelectItem>
                      <SelectItem value="Container">Container</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="32FT">32FT</SelectItem>
                      <SelectItem value="20FT">20FT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="matchScore">Highest Match Score</SelectItem>
                      <SelectItem value="distance">Nearest First</SelectItem>
                      <SelectItem value="eta">Earliest Pickup</SelectItem>
                      <SelectItem value="rating">Carrier Rating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Min Rating: {minRating > 0 ? minRating : "Any"}</Label>
                  <Slider
                    value={[minRating]}
                    onValueChange={([value]) => setMinRating(value)}
                    min={0}
                    max={95}
                    step={5}
                    data-testid="slider-rating"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="available-only"
                  checked={availableOnly}
                  onCheckedChange={setAvailableOnly}
                  data-testid="switch-available-only"
                />
                <Label htmlFor="available-only">Available trucks only</Label>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Map View
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div 
              className="relative bg-muted rounded-md h-[300px] overflow-hidden"
              data-testid="map-container"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <div 
                    className="absolute w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg z-10"
                    style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
                    title={`Pickup: ${load.pickup}`}
                  />
                  
                  {nearbyTrucks.map((truck, index) => {
                    const angle = (index / nearbyTrucks.length) * 2 * Math.PI;
                    const normalizedDistance = truck.distanceFromPickup / radiusKm;
                    const radius = normalizedDistance * 120;
                    const x = 50 + (Math.cos(angle) * radius * 0.8);
                    const y = 50 + (Math.sin(angle) * radius * 0.6);
                    
                    const isHovered = hoveredTruckId === truck.truckId;
                    const isSelected = selectedTruckId === truck.truckId;
                    
                    return (
                      <div
                        key={truck.truckId}
                        className={`absolute cursor-pointer transition-all duration-200 ${
                          isHovered || isSelected ? "scale-125 z-20" : "z-10"
                        }`}
                        style={{ 
                          top: `${y}%`, 
                          left: `${x}%`,
                          transform: "translate(-50%, -50%)"
                        }}
                        onClick={() => setSelectedTruckId(truck.truckId)}
                        onMouseEnter={() => setHoveredTruckId(truck.truckId)}
                        onMouseLeave={() => setHoveredTruckId(null)}
                        data-testid={`map-pin-${truck.truckId}`}
                      >
                        <div className={`
                          w-6 h-6 rounded-full flex items-center justify-center
                          ${truck.availabilityStatus === "Available" 
                            ? "bg-green-600" 
                            : truck.availabilityStatus === "En Route"
                            ? "bg-amber-500"
                            : "bg-gray-500"
                          }
                          ${isHovered || isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
                          shadow-md
                        `}>
                          <Truck className="h-3 w-3 text-white" />
                        </div>
                        {(isHovered || isSelected) && (
                          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-30">
                            {truck.carrierName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  <div 
                    className="absolute border-2 border-dashed border-primary/30 rounded-full"
                    style={{
                      top: "50%",
                      left: "50%",
                      width: "80%",
                      height: "60%",
                      transform: "translate(-50%, -50%)"
                    }}
                  />
                </div>
              </div>
              
              <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs">
                Radius: {radiusKm} km
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Truck List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[300px]">
              {nearbyTrucks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No trucks found nearby.</p>
                  <p className="text-sm text-muted-foreground">Expand your search radius or try again shortly.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setRadiusKm(Math.min(radiusKm + 20, 100))}
                    data-testid="button-expand-radius"
                  >
                    Increase Search Radius
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {nearbyTrucks.map((truck) => (
                    <div
                      key={truck.truckId}
                      className={`
                        p-3 rounded-md border cursor-pointer transition-colors
                        ${selectedTruckId === truck.truckId 
                          ? "border-primary bg-primary/5" 
                          : hoveredTruckId === truck.truckId
                          ? "border-muted-foreground/50 bg-muted/50"
                          : "border-border"
                        }
                      `}
                      onClick={() => setSelectedTruckId(truck.truckId)}
                      onMouseEnter={() => setHoveredTruckId(truck.truckId)}
                      onMouseLeave={() => setHoveredTruckId(null)}
                      data-testid={`truck-card-${truck.truckId}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{truck.carrierName}</span>
                            {getAvailabilityBadge(truck.availabilityStatus)}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {truck.truckType}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {truck.distanceFromPickup} km
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {truck.estimatedTimeToPickup} min
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${getMatchScoreColor(truck.matchScore)}`}>
                            {truck.matchScore}
                          </div>
                          <div className="text-xs text-muted-foreground">Match</div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Progress value={truck.matchScore} className="h-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTruck} onOpenChange={(open) => !open && setSelectedTruckId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Truck Profile
            </DialogTitle>
            <DialogDescription>
              Review truck details and request a quote
            </DialogDescription>
          </DialogHeader>
          
          {selectedTruck && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{selectedTruck.carrierName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedTruck.currentLocation}</p>
                </div>
                {getAvailabilityBadge(selectedTruck.availabilityStatus)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Truck Type</Label>
                  <p className="font-medium">{selectedTruck.truckType}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Capacity</Label>
                  <p className="font-medium">{selectedTruck.loadCapacity} tons</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Driver</Label>
                  <p className="font-medium">{selectedTruck.driverName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">License Plate</Label>
                  <p className="font-medium">{selectedTruck.licensePlate}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Reliability Score</Label>
                <div className="flex items-center gap-2">
                  <Progress value={selectedTruck.reliabilityScore} className="flex-1" />
                  <span className="font-bold text-lg">{selectedTruck.reliabilityScore}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-muted rounded-md">
                  <Navigation className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="font-medium text-sm">
                    {selectedTruckResult?.distanceFromPickup || "N/A"} km
                  </p>
                </div>
                <div className="p-2 bg-muted rounded-md">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">ETA</p>
                  <p className="font-medium text-sm">{selectedTruck.estimatedTimeToPickup} min</p>
                </div>
                <div className="p-2 bg-muted rounded-md">
                  <Star className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Match</p>
                  <p className={`font-bold text-sm ${getMatchScoreColor(selectedTruckResult?.matchScore || 0)}`}>
                    {selectedTruckResult?.matchScore || "N/A"}%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                <FileText className="h-4 w-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Documents Verified</p>
                  <p className="text-xs text-muted-foreground">Insurance, License, Registration</p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setSelectedTruckId(null)}
                  data-testid="button-cancel-profile"
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => handleRequestQuote(selectedTruck.truckId)}
                  disabled={requestingQuote || selectedTruck.availabilityStatus !== "Available"}
                  data-testid="button-request-quote"
                >
                  {requestingQuote ? (
                    "Requesting..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Request Quote
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NearbyTrucksSummary({ load }: { load: MockLoad }) {
  const { getNearbyTrucks } = useMockData();
  const trucks = getNearbyTrucks(load.pickup, load.type, load.weight, { radiusKm: 30, availableOnly: true });
  
  if (trucks.length === 0) return null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Truck className="h-4 w-4" />
      <span>{trucks.length} truck{trucks.length !== 1 ? "s" : ""} available nearby</span>
      {trucks[0] && (
        <Badge variant="outline" className="text-xs">
          Top match: {trucks[0].matchScore}%
        </Badge>
      )}
    </div>
  );
}
