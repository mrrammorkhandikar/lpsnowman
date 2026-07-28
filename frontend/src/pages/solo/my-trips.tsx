import { useState } from "react";
import { 
  MapPin, ArrowRight, IndianRupee, Clock, Calendar,
  Truck, Package, Navigation, CheckCircle2, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface Trip {
  id: string;
  loadId: string;
  status: string;
  currentLocation: string | null;
  startedAt: string | null;
  completedAt: string | null;
  load?: {
    pickupCity: string;
    pickupAddress: string;
    dropoffCity: string;
    dropoffAddress: string;
    weight: string;
    finalPrice: string;
    pickupDate: string | null;
    deliveryDate: string | null;
  };
}

export default function SoloMyTrips() {
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  const { data: tripsData, isLoading } = useQuery<Trip[]>({
    queryKey: ["/api/shipments"],
  });

  const trips = tripsData || [];
  
  const filteredTrips = trips.filter((trip) => {
    if (activeTab === "active") {
      return ["pickup_scheduled", "picked_up", "in_transit", "at_checkpoint", "out_for_delivery"].includes(trip.status);
    }
    return trip.status === "delivered";
  });

  const formatPrice = (price: string | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-IN").format(parseFloat(price));
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      pickup_scheduled: { label: "Pickup Scheduled", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      picked_up: { label: "Picked Up", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
      in_transit: { label: "In Transit", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
      at_checkpoint: { label: "At Checkpoint", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
      out_for_delivery: { label: "Out for Delivery", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
      delivered: { label: "Delivered", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    };
    return labels[status] || { label: status, color: "bg-muted text-muted-foreground" };
  };

  const activeCount = trips.filter(t => 
    ["pickup_scheduled", "picked_up", "in_transit", "at_checkpoint", "out_for_delivery"].includes(t.status)
  ).length;
  const completedCount = trips.filter(t => t.status === "delivered").length;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b bg-card sticky top-0 z-10">
        <h1 className="text-xl font-bold mb-3" data-testid="text-page-title">My Trips</h1>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1" data-testid="tab-active">
              Active ({activeCount})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1" data-testid="tab-completed">
              Completed ({completedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-24 w-full" />
              </Card>
            ))
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No {activeTab} trips</p>
              <p className="text-sm">
                {activeTab === "active" 
                  ? "Accept a load to start a trip"
                  : "Your completed deliveries will appear here"}
              </p>
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const statusInfo = getStatusLabel(trip.status);
              return (
                <Card key={trip.id} className="overflow-hidden" data-testid={`card-trip-${trip.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <Badge className={statusInfo.color}>
                        {trip.status === "in_transit" && <Navigation className="h-3 w-3 mr-1" />}
                        {trip.status === "delivered" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {statusInfo.label}
                      </Badge>
                      {trip.load?.finalPrice && (
                        <div className="flex items-center gap-1 font-bold">
                          <IndianRupee className="h-4 w-4" />
                          {formatPrice(trip.load.finalPrice)}
                        </div>
                      )}
                    </div>

                    {trip.load && (
                      <>
                        <div className="flex items-center gap-4 mb-3 flex-wrap">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            <span className="text-muted-foreground">Pickup:</span>
                            <span className="font-medium">
                              {trip.load.pickupDate
                                ? format(new Date(trip.load.pickupDate), "MMM d, yyyy")
                                : "Not scheduled"}
                            </span>
                          </div>
                          {trip.load.deliveryDate && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Delivery:</span>
                              <span className="font-medium">
                                {format(new Date(trip.load.deliveryDate), "MMM d, yyyy")}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="font-medium text-sm">{trip.load.pickupCity}</div>
                              <div className="text-xs text-muted-foreground">{trip.load.pickupAddress}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="font-medium text-sm">{trip.load.dropoffCity}</div>
                              <div className="text-xs text-muted-foreground">{trip.load.dropoffAddress}</div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {trip.currentLocation && activeTab === "active" && (
                      <div className="mt-3 p-2 bg-muted rounded-md flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-primary" />
                        <span className="text-sm">{trip.currentLocation}</span>
                      </div>
                    )}

                    {activeTab === "active" && (
                      <Button className="w-full mt-3" data-testid={`button-update-${trip.id}`}>
                        Update Status
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
