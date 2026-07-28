import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  MapPin, Package, Truck, ArrowRight, IndianRupee, 
  Clock, Lock, Unlock, Loader2, RefreshCw, ChevronRight,
  Sparkles, Route, Box, Users, Target, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";

interface RecommendedLoadData {
  loadId: string;
  score: number;
  matchReasons: string[];
  truckTypeMatch: boolean;
  capacityMatch: boolean;
  routeMatch: boolean;
  commodityMatch: boolean;
  shipperMatch: boolean;
}

interface LoadCard {
  id: string;
  origin: string;
  destination: string;
  loadType: string | null;
  truckType: string | null;
  weight: string | null;
  distance: number | null;
  estimatedDistance: number | null;
  finalPrice: string | null;
  allowCounterBids: boolean | null;
  allowBids: boolean;
  shipperName: string | null;
  bidCount: number;
  myBid: any | null;
  postedByAdmin: boolean;
  priceFixed: boolean;
  createdAt: string;
  loadNumber: string | null;
  material: string | null;
}

export default function SoloLoadFeed() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedLoad, setSelectedLoad] = useState<LoadCard | null>(null);
  const [showBidDialog, setShowBidDialog] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoad, setDetailLoad] = useState<LoadCard | null>(null);
  const [detailLoadScore, setDetailLoadScore] = useState<RecommendedLoadData | null>(null);

  const { data: loadsData, isLoading, refetch, isRefetching } = useQuery<LoadCard[]>({
    queryKey: ["/api/carrier/available-loads"],
  });

  const handleRefreshLoads = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/carrier/available-loads"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/carrier/recommended-loads"] });
      const r = await refetch();
      if (r.error) {
        throw r.error instanceof Error ? r.error : new Error(String(r.error));
      }
      const n = r.data?.length ?? 0;
      toast({
        title: "Loads updated",
        description: `${n} available load${n === 1 ? "" : "s"} loaded.`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not refresh.";
      toast({
        title: "Refresh failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  // Fetch AI-powered load recommendations
  const { data: recommendations = [] } = useQuery<RecommendedLoadData[]>({
    queryKey: ['/api/carrier/recommended-loads'],
    staleTime: 60000,
  });

  // Create a lookup map for recommendation data
  const recommendationMap = useMemo(() => {
    const map = new Map<string, RecommendedLoadData>();
    recommendations.forEach(rec => map.set(rec.loadId, rec));
    return map;
  }, [recommendations]);

  // Get high-match loads (50+ points)
  const highMatchLoads = useMemo(() => {
    return recommendations.filter(r => r.score >= 50).slice(0, 4);
  }, [recommendations]);

  const submitBidMutation = useMutation({
    mutationFn: async (data: { load_id: string; amount: string; bid_type: string; notes?: string }) => {
      return apiRequest("POST", "/api/bids/submit", { ...data, carrier_type: "solo" });
    },
    onSuccess: () => {
      toast({ title: "Success", description: isAccepting ? "Load accepted!" : "Counter-bid submitted!" });
      setShowBidDialog(false);
      setSelectedLoad(null);
      setBidAmount("");
      setBidNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/available-loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to submit bid", 
        variant: "destructive" 
      });
    },
  });

  const handleAcceptPrice = (load: LoadCard) => {
    setSelectedLoad(load);
    setIsAccepting(true);
    submitBidMutation.mutate({
      load_id: load.id,
      amount: load.finalPrice || "0",
      bid_type: "admin_posted_acceptance",
    });
  };

  const handleCounterBid = (load: LoadCard) => {
    setSelectedLoad(load);
    setIsAccepting(false);
    setBidAmount(load.finalPrice || "");
    setShowBidDialog(true);
  };

  const submitCounter = () => {
    if (!selectedLoad || !bidAmount) return;
    submitBidMutation.mutate({
      load_id: selectedLoad.id,
      amount: bidAmount,
      bid_type: "counter",
      notes: bidNotes || undefined,
    });
  };

  const formatPrice = (price: string | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-IN").format(parseFloat(price));
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffHrs > 24) return `${Math.floor(diffHrs / 24)}d ago`;
    if (diffHrs > 0) return `${diffHrs}h ago`;
    return `${diffMins}m ago`;
  };

  const getMatchScore = (loadId: string): number => {
    const rec = recommendationMap.get(loadId);
    return rec ? rec.score : 0;
  };

  const getMatchData = (loadId: string): RecommendedLoadData | undefined => {
    return recommendationMap.get(loadId);
  };

  const loads = useMemo(() => {
    return (loadsData || []).map((l) => {
      const raw = l as LoadCard & {
        pickupLat?: string | null;
        pickupLng?: string | null;
        dropoffLat?: string | null;
        dropoffLng?: string | null;
        pickupCity?: string | null;
        dropoffCity?: string | null;
      };
      const km = computeRouteDistanceKmEstimate({
        pickupLat: raw.pickupLat,
        pickupLng: raw.pickupLng,
        dropoffLat: raw.dropoffLat,
        dropoffLng: raw.dropoffLng,
        pickupCity: raw.pickupCity ?? raw.origin,
        dropoffCity: raw.dropoffCity ?? raw.destination,
      });
      const rounded = Number.isFinite(km) ? Math.round(km) : null;
      const estimatedDistance = rounded != null && rounded >= 1 ? rounded : null;
      return { ...l, estimatedDistance, distance: null };
    });
  }, [loadsData]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Available Loads</h1>
          <p className="text-sm text-muted-foreground">{loads.length} loads near you</p>
        </div>
        <Button 
          type="button"
          variant="ghost" 
          size="icon" 
          onClick={() => void handleRefreshLoads()}
          disabled={isRefetching}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-5 w-5 ${isRefetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* Recommended Loads Section */}
          {highMatchLoads.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Recommended for You</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Matched based on your truck, route history, and experience
              </p>
              <div className="grid grid-cols-2 gap-2">
                {highMatchLoads.map((rec) => {
                  const load = loads.find(l => l.id === rec.loadId);
                  if (!load) return null;
                  return (
                    <Card 
                      key={rec.loadId} 
                      className="p-3 bg-primary/5 border-primary/20 hover-elevate cursor-pointer"
                      onClick={() => {
                        setDetailLoad(load);
                        setDetailLoadScore(rec);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-1 mb-2">
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary no-default-hover-elevate no-default-active-elevate">
                          <Target className="h-3 w-3 mr-1" />
                          {rec.score} pts
                        </Badge>
                        {rec.truckTypeMatch && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
                            <Truck className="h-3 w-3 mr-0.5" /> Truck
                          </Badge>
                        )}
                        {rec.capacityMatch && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
                            <Package className="h-3 w-3 mr-0.5" /> Capacity
                          </Badge>
                        )}
                        {rec.routeMatch && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
                            <Route className="h-3 w-3 mr-0.5" /> Route
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {load.origin} <ArrowRight className="inline h-3 w-3" /> {load.destination}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-primary font-bold text-sm">
                          Rs. {formatPrice(load.finalPrice)}
                        </span>
                        <Button 
                          size="sm" 
                          className="h-7 text-xs" 
                          onClick={(e) => { e.stopPropagation(); handleAcceptPrice(load); }}
                        >
                          Accept
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))
          ) : loads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No loads available</p>
              <p className="text-sm">Check back later for new opportunities</p>
            </div>
          ) : (
            loads.map((load) => {
              const matchScore = getMatchScore(load.id);
              const matchData = getMatchData(load.id);
              return (
              <Card 
                key={load.id} 
                className="overflow-hidden hover-elevate"
                data-testid={`card-load-${load.id}`}
              >
                <CardContent className="p-0">
                  <div className="p-4">
                    {/* Match Score and Badges Row */}
                    {matchScore > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <Badge variant="secondary" className={`text-xs ${matchScore >= 50 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {matchScore}% Match
                        </Badge>
                        {matchData?.truckTypeMatch && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            <Truck className="h-3 w-3 mr-0.5" /> Truck
                          </Badge>
                        )}
                        {matchData?.capacityMatch && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            <Package className="h-3 w-3 mr-0.5" /> Capacity
                          </Badge>
                        )}
                        {matchData?.routeMatch && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            <Route className="h-3 w-3 mr-0.5" /> Route
                          </Badge>
                        )}
                        {matchData?.commodityMatch && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            <Box className="h-3 w-3 mr-0.5" /> Cargo
                          </Badge>
                        )}
                        {matchData?.shipperMatch && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            <Users className="h-3 w-3 mr-0.5" /> Shipper
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{load.origin}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-1.5 mb-1">
                          <div className="w-0.5 h-4 bg-border" />
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{load.destination}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-lg font-bold text-primary">
                          <IndianRupee className="h-4 w-4" />
                          {formatPrice(load.finalPrice)}
                        </div>
                        <div className="flex items-center gap-1 justify-end text-xs text-muted-foreground">
                          {load.priceFixed ? (
                            <>
                              <Lock className="h-3 w-3" />
                              <span>Fixed</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3 w-3" />
                              <span>Negotiable</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      {load.loadType && (
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          <span>{load.loadType}</span>
                        </div>
                      )}
                      {load.weight && (
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          <span>{load.weight} MT</span>
                        </div>
                      )}
                      {load.estimatedDistance != null && load.estimatedDistance > 0 && (
                        <span>~{load.estimatedDistance} km</span>
                      )}
                      <div className="flex items-center gap-1 ml-auto">
                        <Clock className="h-3 w-3" />
                        <span>{getTimeAgo(load.createdAt)}</span>
                      </div>
                    </div>

                    {load.myBid ? (
                      <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <span className="text-sm">
                          Your bid: <span className="font-semibold">Rs. {formatPrice(load.myBid.counterAmount || load.myBid.amount)}</span>
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {load.myBid.status === "pending" ? "Pending" : load.myBid.status === "countered" ? "Countered" : load.myBid.status}
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1"
                          onClick={() => handleAcceptPrice(load)}
                          disabled={submitBidMutation.isPending && selectedLoad?.id === load.id}
                          data-testid={`button-accept-${load.id}`}
                        >
                          {submitBidMutation.isPending && selectedLoad?.id === load.id && isAccepting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Accept Price
                        </Button>
                        {load.allowCounterBids && !load.priceFixed && (
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => handleCounterBid(load)}
                            data-testid={`button-counter-${load.id}`}
                          >
                            Counter Bid
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Load Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Load Details
            </DialogTitle>
            <DialogDescription>
              Complete information about this load
            </DialogDescription>
          </DialogHeader>
          
          {detailLoad && (
            <div className="space-y-4 py-4">
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${(detailLoadScore?.score || 0) >= 75 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : (detailLoadScore?.score || 0) >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'} no-default-hover-elevate no-default-active-elevate`}>
                        <Target className="h-3 w-3 mr-1" />
                        {detailLoadScore?.score || 0} pts
                      </Badge>
                      {!detailLoad.allowBids ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate">
                          <Lock className="h-3 w-3 mr-1" />
                          Fixed Price
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate">
                          <Unlock className="h-3 w-3 mr-1" />
                          Negotiable
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-mono text-muted-foreground">{detailLoad.loadNumber}</span>
                  </div>
                  
                  {/* Route Details */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{detailLoad.origin}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{detailLoad.destination}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {detailLoad.truckType && (
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium">{detailLoad.truckType}</span>
                      </div>
                    )}
                    {detailLoad.weight && (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Weight:</span>
                        <span className="font-medium">{detailLoad.weight} Tons</span>
                      </div>
                    )}
                    {detailLoad.estimatedDistance != null && detailLoad.estimatedDistance > 0 && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Distance:</span>
                        <span className="font-medium">~{detailLoad.estimatedDistance} km</span>
                      </div>
                    )}
                    {detailLoad.material && (
                      <div className="flex items-center gap-2 col-span-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Commodity:</span>
                        <span className="font-medium">{detailLoad.material}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Price & Payment Information */}
              <Card className="border-primary/30">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Price</span>
                    <span className="text-xl font-bold text-primary">Rs. {formatPrice(detailLoad.finalPrice)}</span>
                  </div>
                </CardContent>
              </Card>
              
              {/* Why This Load Matches Section */}
              <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-blue-700 dark:text-blue-400">Why This Load Matches</span>
                    <Badge className={`ml-auto ${(detailLoadScore?.score || 0) >= 75 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : (detailLoadScore?.score || 0) >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'} no-default-hover-elevate no-default-active-elevate`}>
                      {detailLoadScore?.score || 0} pts
                    </Badge>
                  </div>
                  
                  <div className="grid gap-2">
                    {detailLoadScore?.truckTypeMatch && (
                      <div className="flex items-start gap-3 p-2 bg-white dark:bg-background rounded-md border border-blue-200 dark:border-blue-800">
                        <Truck className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">Truck Type Match</div>
                          <div className="text-xs text-muted-foreground">
                            Your truck type matches the required type: {detailLoad.truckType || 'Any'}
                          </div>
                        </div>
                        <Badge variant="outline" className="ml-auto text-xs bg-blue-100 dark:bg-blue-900/30 no-default-hover-elevate no-default-active-elevate">+30 pts</Badge>
                      </div>
                    )}
                    
                    {detailLoadScore?.capacityMatch && (
                      <div className="flex items-start gap-3 p-2 bg-white dark:bg-background rounded-md border border-green-200 dark:border-green-800">
                        <Package className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">Capacity Match</div>
                          <div className="text-xs text-muted-foreground">
                            Your truck can carry this load: {detailLoad.weight || 'Not specified'} tons
                          </div>
                        </div>
                        <Badge variant="outline" className="ml-auto text-xs bg-green-100 dark:bg-green-900/30 no-default-hover-elevate no-default-active-elevate">+25 pts</Badge>
                      </div>
                    )}
                    
                    {detailLoadScore?.routeMatch && (
                      <div className="flex items-start gap-3 p-2 bg-white dark:bg-background rounded-md border border-purple-200 dark:border-purple-800">
                        <MapPin className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">Route Experience</div>
                          <div className="text-xs text-muted-foreground">
                            You've completed shipments on this route: {detailLoad.origin} to {detailLoad.destination}
                          </div>
                        </div>
                        <Badge variant="outline" className="ml-auto text-xs bg-purple-100 dark:bg-purple-900/30 no-default-hover-elevate no-default-active-elevate">+20 pts</Badge>
                      </div>
                    )}
                    
                    {detailLoadScore?.commodityMatch && (
                      <div className="flex items-start gap-3 p-2 bg-white dark:bg-background rounded-md border border-orange-200 dark:border-orange-800">
                        <Package className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">Commodity Experience</div>
                          <div className="text-xs text-muted-foreground">
                            You've carried similar materials before: {detailLoad.material || 'General cargo'}
                          </div>
                        </div>
                        <Badge variant="outline" className="ml-auto text-xs bg-orange-100 dark:bg-orange-900/30 no-default-hover-elevate no-default-active-elevate">+15 pts</Badge>
                      </div>
                    )}
                    
                    {detailLoadScore?.shipperMatch && (
                      <div className="flex items-start gap-3 p-2 bg-white dark:bg-background rounded-md border border-yellow-200 dark:border-yellow-800">
                        <Building2 className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">Shipper Experience</div>
                          <div className="text-xs text-muted-foreground">
                            You've worked with this shipper before
                          </div>
                        </div>
                        <Badge variant="outline" className="ml-auto text-xs bg-yellow-100 dark:bg-yellow-900/30 no-default-hover-elevate no-default-active-elevate">+10 pts</Badge>
                      </div>
                    )}
                    
                    {!detailLoadScore?.truckTypeMatch && !detailLoadScore?.capacityMatch && !detailLoadScore?.routeMatch && !detailLoadScore?.commodityMatch && !detailLoadScore?.shipperMatch && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">No specific matching criteria found. Build your history by completing loads to get better recommendations.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)} data-testid="button-close-detail">
              Close
            </Button>
            {detailLoad && (
              <>
                <Button 
                  onClick={() => {
                    setDetailDialogOpen(false);
                    if (detailLoad) {
                      handleAcceptPrice(detailLoad);
                    }
                  }}
                  disabled={submitBidMutation.isPending}
                  data-testid="button-accept-from-detail"
                >
                  Accept Load
                </Button>
                {detailLoad.allowBids && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      if (detailLoad) {
                        handleCounterBid(detailLoad);
                      }
                    }}
                    data-testid="button-bid-from-detail"
                  >
                    Place Bid
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBidDialog} onOpenChange={setShowBidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Counter Bid</DialogTitle>
            <DialogDescription>
              {selectedLoad && (
                <span>
                  {selectedLoad.origin} <ArrowRight className="inline h-3 w-3" /> {selectedLoad.destination}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Total Price</label>
              <div className="text-lg font-bold text-muted-foreground">
                Rs. {formatPrice(selectedLoad?.finalPrice || null)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Your Offer (Rs.)</label>
              <Input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder=""
                data-testid="input-bid-amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
              <Textarea
                value={bidNotes}
                onChange={(e) => setBidNotes(e.target.value)}
                placeholder="Add any notes for admin..."
                className="resize-none"
                rows={3}
                data-testid="input-bid-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBidDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={submitCounter}
              disabled={!bidAmount || submitBidMutation.isPending}
              data-testid="button-submit-counter"
            >
              {submitBidMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Submit Counter Bid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
