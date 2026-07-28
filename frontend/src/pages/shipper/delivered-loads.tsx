import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, Package, Truck, CheckCircle, Clock, FileText, 
  Navigation, Building, RefreshCw, Loader2, Eye, X, 
  Download, Calendar, Search, ArrowRight, Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CarrierRatingDialog } from "@/components/carrier-rating-dialog";
import { getDocumentUrl } from "@/lib/document-utils";
import { format } from "date-fns";

type ShipmentStage = "load_created" | "carrier_assigned" | "reached_pickup" | "loaded" | "in_transit" | "arrived_at_drop" | "delivered";

interface TimelineEvent {
  stage: ShipmentStage;
  completed: boolean;
  timestamp: string | null;
  location: string;
}

interface DeliveredShipment {
  id: string;
  loadId: string;
  carrierId: string;
  status: string;
  progress: number;
  currentStage: string;
  completedAt: string | null;
  createdAt: string;
  load: {
    id: string;
    shipperLoadNumber: number | null;
    adminReferenceNumber: number | null;
    pickupCity: string;
    pickupAddress: string;
    dropoffCity: string;
    dropoffAddress: string;
    materialType: string;
    weight: string;
    requiredTruckType: string;
    cargoType?: string;
    finalPrice?: string;
    adminFinalPrice?: string;
  } | null;
  carrier: {
    id: string;
    username: string;
    companyName: string;
    phone: string | null;
    carrierType: 'solo' | 'enterprise';
    tripsCompleted: number;
  } | null;
  driver: {
    name: string;
    phone: string | null;
  } | null;
  truck: {
    id: string;
    registrationNumber: string;
    truckType: string;
    capacity: number;
  } | null;
  documents: Array<{
    id: string;
    documentType: string;
    status: string;
    fileName: string;
    fileUrl: string | null;
  }>;
  timeline: TimelineEvent[];
}

const stageLabels: Record<ShipmentStage, string> = {
  load_created: "Load Created",
  carrier_assigned: "Carrier Assigned",
  reached_pickup: "Reached Pickup",
  loaded: "Loaded",
  in_transit: "In Transit",
  arrived_at_drop: "Arrived at Drop",
  delivered: "Delivered",
};

const stageIcons: Record<ShipmentStage, typeof MapPin> = {
  load_created: FileText,
  carrier_assigned: Truck,
  reached_pickup: Building,
  loaded: Package,
  in_transit: Navigation,
  arrived_at_drop: MapPin,
  delivered: CheckCircle,
};

const documentTypeToLabel: Record<string, string> = {
  lr_consignment: "LR / Consignment Note",
  eway_bill: "E-way Bill",
  loading_photos: "Loading Photos",
  pod: "Proof of Delivery (POD)",
  invoice: "Invoice",
  other: "Other Document",
};

function formatLoadId(shipperLoadNumber: number | null | undefined, adminReferenceNumber: number | null | undefined): string {
  if (adminReferenceNumber) {
    return `LD-${String(adminReferenceNumber).padStart(3, '0')}`;
  }
  if (shipperLoadNumber) {
    return `LD-${String(shipperLoadNumber).padStart(3, '0')}`;
  }
  return "LD-XXX";
}

function formatTruckType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DeliveredLoadsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ type: string; image: string } | null>(null);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [shipmentToRate, setShipmentToRate] = useState<DeliveredShipment | null>(null);
  const [ratedShipments, setRatedShipments] = useState<Set<string>>(new Set());

  const { data: shipments = [], isLoading, refetch, isFetching } = useQuery<DeliveredShipment[]>({
    queryKey: ['/api/shipments/tracking'],
    refetchInterval: 30000,
  });

  const deliveredShipments = shipments.filter(s => s.currentStage === "delivered");

  useEffect(() => {
    async function checkRatings() {
      const newRatedSet = new Set<string>();
      for (const shipment of deliveredShipments) {
        try {
          const res = await fetch(`/api/carrier-ratings/check/${shipment.id}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data.hasRated) {
              newRatedSet.add(shipment.id);
            }
          }
        } catch (e) {
          // Ignore errors for rating check
        }
      }
      setRatedShipments(newRatedSet);
    }
    if (deliveredShipments.length > 0) {
      checkRatings();
    }
  }, [deliveredShipments.length]);

  function openRatingDialog(shipment: DeliveredShipment) {
    setShipmentToRate(shipment);
    setRatingDialogOpen(true);
  }

  function handleRatingSubmitted() {
    if (shipmentToRate) {
      setRatedShipments(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.add(shipmentToRate.id);
        return newSet;
      });
    }
    setShipmentToRate(null);
  }
  
  const filteredShipments = deliveredShipments.filter(s => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const loadId = formatLoadId(s.load?.shipperLoadNumber, s.load?.adminReferenceNumber).toLowerCase();
    const route = `${s.load?.pickupCity || ""} ${s.load?.dropoffCity || ""}`.toLowerCase();
    const carrier = s.carrier?.companyName?.toLowerCase() || "";
    return loadId.includes(query) || route.includes(query) || carrier.includes(query);
  });

  const selectedShipment = filteredShipments.find(s => s.id === selectedShipmentId) || filteredShipments[0] || null;

  function openDocumentViewer(docLabel: string, docKey: string) {
    const doc = selectedShipment?.documents.find(d => d.documentType === docKey);
    if (doc && doc.fileUrl) {
      setSelectedDocument({ type: docLabel, image: doc.fileUrl });
      setDocumentViewerOpen(true);
    } else {
      toast({ 
        title: "Document Not Available", 
        description: doc ? "Document file is being processed" : "This document hasn't been uploaded yet"
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (deliveredShipments.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Delivered Loads</h1>
        <EmptyState
          icon={CheckCircle}
          title="No delivered loads yet"
          description="Once your shipments are delivered, they will appear here with complete delivery details."
        />
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col lg:h-[calc(100dvh-4rem)]">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold">Delivered Loads</h1>
          <p className="text-sm text-muted-foreground">View all completed deliveries and their details.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-delivered"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-[320px_1fr] lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        {/* Left panel — list */}
        <Card className="flex flex-col overflow-hidden lg:min-h-0">
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">Delivered ({filteredShipments.length})</CardTitle>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search loads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
                data-testid="input-search-delivered"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 lg:flex-1 lg:min-h-0">
            {/* lg: ScrollArea fills remaining height; below lg: fixed tall area */}
            <ScrollArea className="h-[60vh] lg:h-full">
              <div className="p-3 space-y-2">
                {filteredShipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className={`p-3 rounded-lg cursor-pointer hover-elevate ${
                      selectedShipment?.id === shipment.id 
                        ? "bg-primary/10 border border-primary/20" 
                        : "bg-muted/50"
                    }`}
                    onClick={() => setSelectedShipmentId(shipment.id)}
                    data-testid={`delivered-item-${shipment.id}`}
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatLoadId(shipment.load?.shipperLoadNumber, shipment.load?.adminReferenceNumber)}
                      </span>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Delivered
                      </Badge>
                    </div>
                    <p className="font-medium text-sm mb-1">
                      {shipment.load?.pickupCity || "Origin"} <ArrowRight className="inline h-3 w-3" /> {shipment.load?.dropoffCity || "Destination"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
                      <span>{shipment.carrier?.companyName || "Carrier"}</span>
                      {shipment.completedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(shipment.completedAt), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right panel — detail */}
        <Card className="flex flex-col overflow-hidden lg:min-h-0">
          {selectedShipment ? (
            <>
              <CardHeader className="pb-3 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedShipment.load?.pickupCity || "Origin"} to {selectedShipment.load?.dropoffCity || "Destination"}
                    </CardTitle>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                      <span className="font-medium">{selectedShipment.carrier?.companyName}</span>
                      {selectedShipment.truck && (
                        <span>
                          {formatTruckType(selectedShipment.truck.truckType)} - {selectedShipment.truck.registrationNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Delivered
                    </Badge>
                    {selectedShipment.completedAt && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(selectedShipment.completedAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 lg:flex-1 lg:min-h-0 overflow-hidden">
                <ScrollArea className="h-[70vh] lg:h-full">
                <div className="p-4 grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="font-semibold mb-4">Delivery Timeline</h3>
                    <div className="relative">
                      {selectedShipment.timeline.map((event, index) => {
                        const Icon = stageIcons[event.stage as ShipmentStage] || MapPin;
                        const isLast = index === selectedShipment.timeline.length - 1;
                        return (
                          <div key={event.stage} className="flex gap-4 pb-5 last:pb-0">
                            <div className="relative flex flex-col items-center">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                event.completed 
                                  ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              {!isLast && (
                                <div className={`w-0.5 flex-1 mt-2 ${
                                  event.completed ? "bg-green-200 dark:bg-green-800" : "bg-border"
                                }`} />
                              )}
                            </div>
                            <div className="flex-1 pt-1">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className={`font-medium text-sm ${!event.completed && "text-muted-foreground"}`}>
                                  {stageLabels[event.stage as ShipmentStage] || event.stage}
                                </p>
                                {event.completed && (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{event.location}</p>
                              {event.timestamp && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {format(new Date(event.timestamp), "MMM d 'at' h:mm a")}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-3">Load Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Load ID</span>
                          <span className="font-medium">{formatLoadId(selectedShipment.load?.shipperLoadNumber, selectedShipment.load?.adminReferenceNumber)}</span>
                        </div>
                        {selectedShipment.load?.cargoType && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Cargo Type</span>
                            <span className="font-medium capitalize">{selectedShipment.load.cargoType.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Weight</span>
                          <span className="font-medium">{selectedShipment.load?.weight || "N/A"} tons</span>
                        </div>
                        {(selectedShipment.load?.adminFinalPrice || selectedShipment.load?.finalPrice) && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-medium">Rs. {parseFloat(selectedShipment.load.adminFinalPrice || selectedShipment.load.finalPrice || "0").toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3">Carrier Details</h3>
                      <div className="space-y-2 text-sm">
                        {selectedShipment.carrier?.carrierType === 'solo' ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Driver</span>
                              <span className="font-medium">{selectedShipment.driver?.name || selectedShipment.carrier?.username || "N/A"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Trips Completed</span>
                              <span className="font-medium">{selectedShipment.carrier?.tripsCompleted || 0}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Company</span>
                              <span className="font-medium">{selectedShipment.carrier?.companyName || "N/A"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Driver</span>
                              <span className="font-medium">{selectedShipment.driver?.name || "N/A"}</span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Vehicle</span>
                          <span className="font-medium">{selectedShipment.truck ? formatTruckType(selectedShipment.truck.truckType) : "N/A"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Truck No.</span>
                          <span className="font-medium">{selectedShipment.truck?.registrationNumber || "N/A"}</span>
                        </div>
                      </div>
                      <div className="mt-4">
                        {ratedShipments.has(selectedShipment.id) ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span>You have rated this carrier</span>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            onClick={() => openRatingDialog(selectedShipment)}
                            data-testid="button-rate-carrier"
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Rate Carrier
                          </Button>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3">Documents</h3>
                      <div className="space-y-2">
                        {["lr_consignment", "eway_bill", "loading_photos", "pod"].map((docType) => {
                          const doc = selectedShipment.documents.find(d => d.documentType === docType);
                          const label = documentTypeToLabel[docType] || docType;
                          return (
                            <div key={docType} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {doc ? (
                                  <>
                                    <Badge variant={doc.status === 'verified' ? 'default' : 'secondary'} className="text-xs">
                                      {doc.status === 'verified' ? 'Verified' : 'Pending'}
                                    </Badge>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => openDocumentViewer(label, docType)}
                                      data-testid={`button-view-doc-${docType}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not uploaded</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a delivered load to view details</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <Dialog open={documentViewerOpen} onOpenChange={setDocumentViewerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.type}</DialogTitle>
            <DialogDescription>Document preview</DialogDescription>
          </DialogHeader>
          {selectedDocument?.image && (() => {
            const url = getDocumentUrl(selectedDocument.image);
            if (!url) return null;
            const isPdf = selectedDocument.image.toLowerCase().endsWith(".pdf");
            return (
              <div className="flex justify-center">
                {isPdf ? (
                  <iframe
                    src={url}
                    title={selectedDocument.type}
                    className="w-full max-h-[60vh] object-contain rounded-lg"
                  />
                ) : (
                  <img
                    src={url}
                    alt={selectedDocument.type}
                    className="max-h-[60vh] object-contain rounded-lg"
                  />
                )}
              </div>
            );
          })()}
          <div className="flex justify-end gap-2">
            {selectedDocument?.image && (
              <Button variant="outline" size="sm" asChild>
                {(() => {
                  const url = getDocumentUrl(selectedDocument.image);
                  if (!url) return null;
                  return (
                    <a href={url} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  );
                })()}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDocumentViewerOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {shipmentToRate && (
        <CarrierRatingDialog
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
          shipmentId={shipmentToRate.id}
          loadId={shipmentToRate.loadId}
          carrierId={shipmentToRate.carrierId}
          carrierName={
            shipmentToRate.carrier?.carrierType === 'solo' 
              ? (shipmentToRate.driver?.name || shipmentToRate.carrier?.username || "Carrier")
              : (shipmentToRate.carrier?.companyName || "Carrier")
          }
          carrierType={shipmentToRate.carrier?.carrierType === 'solo' ? 'solo' : 'fleet'}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}
    </div>
  );
}
