import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Truck as TruckIcon, Package, MapPin, Clock, CheckCircle, RefreshCw, ArrowRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { OtpTripActions } from "@/components/otp-trip-actions";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Shipment, Load } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";

function formatLoadId(load?: { adminReferenceNumber?: number | null; shipperLoadNumber?: number | null }): string {
  if (load?.adminReferenceNumber) {
    return `LD-${load.adminReferenceNumber}`;
  }
  if (load?.shipperLoadNumber) {
    return `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`;
  }
  return "—";
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

function formatCommodityLabel(value: string | null | undefined): string {
  if (!value) return "General";
  return commodityCodeToLabel[value] || value;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  assigned: { label: "Assigned", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0" },
  pickup_scheduled: { label: "Pickup Scheduled", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0" },
  picked_up: { label: "Picked Up", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0" },
  in_transit: { label: "In Transit", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0" },
  at_checkpoint: { label: "At Checkpoint", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0" },
  out_for_delivery: { label: "Out for Delivery", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0" },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0" },
};

interface ShipmentWithLoad extends Shipment {
  load?: Load;
}

// Dummy data for fallback when API is not available
const DUMMY_SHIPMENTS: ShipmentWithLoad[] = [
  {
    id: "dummy-ship-1",
    loadId: "dummy-load-1",
    carrierId: "driver-1",
    status: "in_transit",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    startOtpVerified: true,
    startOtpRequested: false,
    completedAt: null,
    load: {
      id: "dummy-load-1",
      pickupCity: "Mumbai",
      dropoffCity: "Delhi",
      pickupAddress: "Port Authority, Mumbai",
      dropoffAddress: "Industrial Area, Delhi",
      pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      goodsToBeCarried: "Electronics",
      weight: "18",
      adminReferenceNumber: 1,
      status: "in_transit",
    } as Load,
  } as ShipmentWithLoad,
  {
    id: "dummy-ship-2",
    loadId: "dummy-load-2",
    carrierId: "driver-1",
    status: "delivered",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    startOtpVerified: true,
    startOtpRequested: false,
    completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    load: {
      id: "dummy-load-2",
      pickupCity: "Bangalore",
      dropoffCity: "Chennai",
      pickupAddress: "Warehouse Complex, Bangalore",
      dropoffAddress: "Port Terminal, Chennai",
      pickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      goodsToBeCarried: "Textiles",
      weight: "25",
      adminReferenceNumber: 2,
      status: "delivered",
    } as Load,
  } as ShipmentWithLoad,
  {
    id: "dummy-ship-3",
    loadId: "dummy-load-3",
    carrierId: "driver-1",
    status: "picked_up",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    startOtpVerified: false,
    startOtpRequested: true,
    completedAt: null,
    load: {
      id: "dummy-load-3",
      pickupCity: "Pune",
      dropoffCity: "Hyderabad",
      pickupAddress: "Industrial Park, Pune",
      dropoffAddress: "Distribution Center, Hyderabad",
      pickupDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      goodsToBeCarried: "Machinery",
      weight: "20",
      adminReferenceNumber: 3,
      status: "picked_up",
    } as Load,
  } as ShipmentWithLoad,
];

export default function DriverShipmentsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [emptyRunComment, setEmptyRunComment] = useState("");

  const { data: shipments = [], isLoading: shipmentsLoading, refetch } = useQuery<ShipmentWithLoad[]>({
    queryKey: ["/api/driver/shipments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/driver/shipments");
      return response.json();
    },
  });

  const activeShipments = shipments.filter(s => s.status !== "delivered" && s.status !== "cancelled");
  const completedShipments = shipments.filter(s => s.status === "delivered" || s.status === "cancelled");
  
  const selectedShipment = shipments.find(s => s.id === selectedShipmentId) || activeShipments[0];

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/driver/shipments"] });
    toast({ title: "Refreshed", description: "Shipments list updated." });
  };

  if (shipmentsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (shipments.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">My Shipments</h1>
        <EmptyState
          icon={Package}
          title="No shipments yet"
          description="Your assigned shipments will appear here"
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-shipments-title">My Shipments</h1>
          <p className="text-muted-foreground">
            Active: {activeShipments.length}, Completed: {completedShipments.length}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh-shipments">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("shipments.title")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="active">
              <TabsList className="mx-3 mb-2">
                <TabsTrigger value="active" data-testid="tab-active-shipments">
                  {t("common.active")} ({activeShipments.length})
                </TabsTrigger>
                <TabsTrigger value="completed" data-testid="tab-completed-shipments">
                  {t("common.completed")} ({completedShipments.length})
                </TabsTrigger>
              </TabsList>
              <ScrollArea className="h-[calc(100vh-350px)]">
                <TabsContent value="active" className="m-0 px-3 pb-3">
                  {activeShipments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <TruckIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t("carrier.noActiveShipments")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeShipments.map(shipment => (
                        <div
                          key={shipment.id}
                          className={`p-4 rounded-lg cursor-pointer hover-elevate ${
                            selectedShipment?.id === shipment.id 
                              ? "bg-primary/10 border border-primary/20" 
                              : "bg-muted/50"
                          }`}
                          onClick={() => setSelectedShipmentId(shipment.id)}
                          data-testid={`shipment-card-${shipment.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">{formatLoadId(shipment.load)}</span>
                            <Badge variant="secondary" className={`${statusConfig[shipment.status || "assigned"]?.color || statusConfig.assigned.color} text-xs no-default-hover-elevate no-default-active-elevate`}>
                              {statusConfig[shipment.status || "assigned"]?.label || "Assigned"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm mb-2">
                            <span className="truncate max-w-[80px]">{shipment.load?.pickupCity || "—"}</span>
                            <ArrowRight className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[80px]">{shipment.load?.dropoffCity || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {shipment.startOtpVerified ? (
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <CheckCircle className="h-3 w-3" />
                                {t("carrier.started")}
                              </span>
                            ) : shipment.startOtpRequested ? (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Clock className="h-3 w-3" />
                                {t("carrier.otpPending")}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {t("carrier.awaitingStart")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="completed" className="m-0 px-3 pb-3">
                  {completedShipments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t("carrier.noCompletedShipments")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {completedShipments.map(shipment => (
                        <div
                          key={shipment.id}
                          className={`p-4 rounded-lg cursor-pointer hover-elevate ${
                            selectedShipment?.id === shipment.id 
                              ? "bg-primary/10 border border-primary/20" 
                              : "bg-muted/50"
                          }`}
                          onClick={() => setSelectedShipmentId(shipment.id)}
                          data-testid={`shipment-card-${shipment.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">{formatLoadId(shipment.load)}</span>
                            <Badge variant="secondary" className={`${statusConfig[shipment.status || "delivered"]?.color} text-xs no-default-hover-elevate no-default-active-elevate`}>
                              {statusConfig[shipment.status || "delivered"]?.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="truncate max-w-[80px]">{shipment.load?.pickupCity || "—"}</span>
                            <ArrowRight className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[80px]">{shipment.load?.dropoffCity || "—"}</span>
                          </div>
                          {shipment.completedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {format(new Date(shipment.completedAt), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {selectedShipment ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-lg">
                        {selectedShipment.load?.pickupCity || "—"} → {selectedShipment.load?.dropoffCity || "—"}
                      </CardTitle>
                      <CardDescription>
                        Load {formatLoadId(selectedShipment.load)}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className={`${statusConfig[selectedShipment.status || "assigned"]?.color} no-default-hover-elevate no-default-active-elevate`}>
                      {statusConfig[selectedShipment.status || "assigned"]?.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("shipments.pickupLocation")}</p>
                      <p className="font-medium flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-green-600" />
                        {selectedShipment.load?.pickupCity || "—"}
                      </p>
                      {selectedShipment.load?.pickupAddress && (
                        <p className="text-sm text-muted-foreground">{selectedShipment.load.pickupAddress}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("shipments.deliveryLocation")}</p>
                      <p className="font-medium flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-red-600" />
                        {selectedShipment.load?.dropoffCity || "—"}
                      </p>
                      {selectedShipment.load?.dropoffAddress && (
                        <p className="text-sm text-muted-foreground">{selectedShipment.load.dropoffAddress}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("loads.pickupDate")}</p>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-primary" />
                        {selectedShipment.load?.pickupDate 
                          ? format(new Date(selectedShipment.load.pickupDate), "MMM d, yyyy")
                          : "Not scheduled"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("loads.deliveryDate")}</p>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {selectedShipment.load?.deliveryDate 
                          ? format(new Date(selectedShipment.load.deliveryDate), "MMM d, yyyy")
                          : "Not scheduled"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("loads.cargo")}</p>
                      <p className="font-medium">{formatCommodityLabel(selectedShipment.load?.goodsToBeCarried || selectedShipment.load?.materialType)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("loads.weight")}</p>
                      <p className="font-medium">{selectedShipment.load?.weight || "—"} tonnes</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("common.date")}</p>
                      <p className="font-medium">
                        {selectedShipment.createdAt 
                          ? formatDistanceToNow(new Date(selectedShipment.createdAt), { addSuffix: true })
                          : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <OtpTripActions 
                shipment={selectedShipment} 
                loadStatus={selectedShipment.load?.status || undefined}
                onStateChange={handleRefresh}
                shipmentDocuments={[]}
              />

              {(selectedShipment.status === "delivered" || selectedShipment.status === "cancelled") && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Empty Run</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reason for Empty Run</label>
                      <Textarea
                        placeholder="Add any comments about the empty run request, route preferences, or special instructions..."
                        value={emptyRunComment}
                        onChange={(e) => setEmptyRunComment(e.target.value)}
                        className="min-h-[100px] resize-none"
                        data-testid="textarea-empty-run-comment"
                      />
                      <p className="text-xs text-muted-foreground">
                        {emptyRunComment.length}/500 characters
                      </p>
                    </div>
                    <Button 
                      className="w-full"
                      onClick={() => {
                        toast({ 
                          title: "Empty Run Request", 
                          description: `Request submitted for ${formatLoadId(selectedShipment.load)}${emptyRunComment ? " with comments" : ""}` 
                        });
                        setEmptyRunComment("");
                      }}
                      data-testid={`button-empty-run-request-${selectedShipment.id}`}
                    >
                      <TruckIcon className="h-4 w-4 mr-2" />
                      Request for Empty Run
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a shipment to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
