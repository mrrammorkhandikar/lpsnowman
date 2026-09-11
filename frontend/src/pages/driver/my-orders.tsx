import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Package, MapPin, Calendar, Clock, ArrowRight,
  Loader2, RefreshCw, Truck, CheckCircle,
  ClipboardList, ChevronRight, User,
  Phone, Building2, Weight, FileText, Hash,
  CircleDot, Info
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/empty-state";
import type { Load } from "@shared/schema";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";

type OrderLoad = Load & {
  shipperName?: string;
  shipperPhone?: string | null;
  shipmentId?: string | null;
  shipmentStatus?: string | null;
  assignedBy?: string;
  assignedAt?: string | Date;
};

function alreadyInAddress(full: string | null | undefined, part: string | null | undefined): boolean {
  if (!full || !part) return false;
  const hay = full.toLowerCase();
  const needle = part.trim().toLowerCase();
  if (!needle) return true;
  if (hay.includes(needle)) return true;
  const aliases: Record<string, string[]> = {
    mh: ["maharashtra"],
    dl: ["delhi"],
    ka: ["karnataka"],
    tn: ["tamil nadu"],
    ts: ["telangana"],
    ap: ["andhra pradesh"],
    gj: ["gujarat"],
    rj: ["rajasthan"],
    up: ["uttar pradesh"],
    wb: ["west bengal"],
    mp: ["madhya pradesh"],
    hr: ["haryana"],
    pb: ["punjab"],
    kl: ["kerala"],
    or: ["odisha", "orissa"],
    br: ["bihar"],
  };
  return (aliases[needle] || []).some((alias) => hay.includes(alias));
}

function formatLoadId(load: OrderLoad): string {
  if (load.adminReferenceNumber) {
    return `LD-${load.adminReferenceNumber}`;
  }
  if (load.shipperLoadNumber) {
    return `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`;
  }
  return "---";
}

function formatShipmentId(uuid: string): string {
  const clean = uuid.replace(/-/g, "").toUpperCase();
  return `SH-${clean.slice(0, 8)}`;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  awarded: { label: "Assigned", variant: "default", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  invoice_created: { label: "Invoice Created", variant: "secondary", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  invoice_sent: { label: "Invoice Sent", variant: "secondary", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  invoice_acknowledged: { label: "Invoice Acknowledged", variant: "secondary", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  invoice_paid: { label: "Invoice Paid", variant: "default", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  in_transit: { label: "In Transit", variant: "default", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  delivered: { label: "Delivered", variant: "default", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  closed: { label: "Closed", variant: "secondary", className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
  cancelled: { label: "Cancelled", variant: "destructive", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function getStatusBadge(status: string | null | undefined) {
  const config = statusConfig[status || ""] || { label: status || "Unknown", className: "bg-gray-100 text-gray-700" };
  return (
    <Badge className={config.className} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}

function DetailRow({ icon: Icon, label, value, className }: { icon?: any; label: string; value: string | number | null | undefined; className?: string }) {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex items-start gap-3 py-2 ${className || ""}`}>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

function OrderDetailSheet({ order, open, onClose }: { order: OrderLoad | null; open: boolean; onClose: () => void }) {
  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0 overflow-hidden" data-testid="sheet-order-detail">
        <div className="flex flex-col h-full">
          <div className="bg-primary/5 border-b px-4 sm:px-6 py-4 sm:py-5">
            <SheetHeader className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg sm:text-xl font-bold" data-testid="text-detail-load-id">
                  {formatLoadId(order)}
                </SheetTitle>
              </div>
              <SheetDescription className="sr-only">Order details for {formatLoadId(order)}</SheetDescription>
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(order.status)}
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400">
                  Direct Assignment
                </Badge>
                {order.pickupId && (
                  <Badge variant="outline" className="font-mono text-xs">
                    Pickup ID: {order.pickupId}
                  </Badge>
                )}
              </div>
            </SheetHeader>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-4 sm:px-6 py-4 space-y-4 sm:space-y-5">

              <div className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Route Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <CircleDot className="h-4 w-4 text-green-500" />
                      <div className="w-px h-full bg-border min-h-[24px]" />
                    </div>
                    <div className="flex-1 pb-2 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pickup</p>
                      {order.pickupBusinessName && (
                        <p className="text-sm font-semibold break-words">{order.pickupBusinessName}</p>
                      )}
                      <p className="text-sm font-semibold break-words">{order.pickupCity || "---"}</p>
                      {order.pickupAddress && <p className="text-xs text-muted-foreground break-words">{order.pickupAddress}</p>}
                      {order.pickupLocality && !alreadyInAddress(order.pickupAddress, order.pickupLocality) && (
                        <p className="text-xs text-muted-foreground break-words">{order.pickupLocality}</p>
                      )}
                      {order.pickupState && !alreadyInAddress(order.pickupAddress, order.pickupState) && (
                        <p className="text-xs text-muted-foreground">{order.pickupState}</p>
                      )}
                      {order.pickupLandmark && !alreadyInAddress(order.pickupAddress, order.pickupLandmark) && (
                        <p className="text-xs text-muted-foreground italic break-words">Near: {order.pickupLandmark}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <MapPin className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Drop</p>
                      {order.dropoffBusinessName && (
                        <p className="text-sm font-semibold break-words">{order.dropoffBusinessName}</p>
                      )}
                      <p className="text-sm font-semibold break-words">{order.dropoffCity || "---"}</p>
                      {order.dropoffAddress && <p className="text-xs text-muted-foreground break-words">{order.dropoffAddress}</p>}
                      {order.dropoffLocality && !alreadyInAddress(order.dropoffAddress, order.dropoffLocality) && (
                        <p className="text-xs text-muted-foreground break-words">{order.dropoffLocality}</p>
                      )}
                      {order.dropoffState && !alreadyInAddress(order.dropoffAddress, order.dropoffState) && (
                        <p className="text-xs text-muted-foreground">{order.dropoffState}</p>
                      )}
                      {order.dropoffLandmark && !alreadyInAddress(order.dropoffAddress, order.dropoffLandmark) && (
                        <p className="text-xs text-muted-foreground italic break-words">Near: {order.dropoffLandmark}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Cargo Details</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <DetailRow icon={Weight} label="Weight" value={order.weight ? `${parseFloat(order.weight)} MT` : null} />
                  <DetailRow icon={Truck} label="Truck Type" value={order.requiredTruckType} />
                  <DetailRow icon={FileText} label="Goods" value={order.goodsToBeCarried} />
                  <DetailRow icon={Hash} label="Material Type" value={order.materialType} />
                </div>
                {order.specialNotes && (
                  <div className="mt-2 p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">Special Notes</p>
                    <p className="text-sm break-words">{order.specialNotes}</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Schedule</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {order.pickupDate && (
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup Date</p>
                      <p className="text-sm font-medium">{format(new Date(order.pickupDate), "dd MMM yyyy")}</p>
                    </div>
                  )}
                  {order.deliveryDate && (
                    <div>
                      <p className="text-xs text-muted-foreground">Delivery Date</p>
                      <p className="text-sm font-medium">{format(new Date(order.deliveryDate), "dd MMM yyyy")}</p>
                    </div>
                  )}
                  {order.assignedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Assigned On</p>
                      <p className="text-sm font-medium">{format(new Date(order.assignedAt), "dd MMM yyyy")}</p>
                    </div>
                  )}
                  {order.assignedBy && (
                    <div>
                      <p className="text-xs text-muted-foreground">Assigned By</p>
                      <p className="text-sm font-medium break-words">{order.assignedBy}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Shipper Info</h3>
                </div>
                <div className="space-y-1">
                  <DetailRow icon={Building2} label="Company" value={order.shipperName} />
                  <DetailRow icon={Phone} label="Phone" value={order.shipperPhone} />
                  {order.shipperContactName && (
                    <DetailRow icon={User} label="Contact Person" value={order.shipperContactName} />
                  )}
                </div>
              </div>

              {(order.receiverName || order.receiverPhone || order.receiverEmail) && (
                <div className="rounded-lg border bg-card p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Receiver Details</h3>
                  </div>
                  <div className="space-y-1">
                    <DetailRow icon={User} label="Name" value={order.receiverName} />
                    <DetailRow icon={Phone} label="Phone" value={order.receiverPhone} />
                    {order.receiverEmail && (
                      <DetailRow label="Email" value={order.receiverEmail} />
                    )}
                  </div>
                </div>
              )}

              {order.shipmentId && (
                <div className="rounded-lg border bg-card p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Shipment Info</h3>
                  </div>
                  <div className="space-y-1">
                    <DetailRow icon={Hash} label="Shipment ID" value={formatShipmentId(order.shipmentId)} />
                    {order.shipmentStatus && (
                      <div className="flex items-start gap-3 py-2">
                        <CircleDot className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Shipment Status</p>
                          {getStatusBadge(order.shipmentStatus)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function DriverMyOrdersPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderLoad | null>(null);

  const { data: orders = [], isLoading, isError, error, refetch } = useQuery<OrderLoad[]>({
    queryKey: ["/api/driver/my-orders"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/driver/my-orders");
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Unexpected response from orders API");
      }
      return data;
    },
  });

  const activeOrders = orders.filter(
    (o) => !["delivered", "closed", "cancelled"].includes(o.status || "")
  );
  const completedOrders = orders.filter(
    (o) => ["delivered", "closed"].includes(o.status || "")
  );
  const cancelledOrders = orders.filter(
    (o) => o.status === "cancelled"
  );

  const filteredOrders = activeTab === "active" ? activeOrders
    : activeTab === "completed" ? completedOrders
    : activeTab === "cancelled" ? cancelledOrders
    : orders;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-orders">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading your orders...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 p-6 max-w-[1600px] mx-auto" data-testid="orders-error">
        <EmptyState
          icon={Package}
          title="Could not load orders"
          description={error instanceof Error ? error.message : "Please try again."}
        />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto" data-testid="my-orders-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-page-title">My Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your assigned loads and shipments
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["/api/driver/my-orders"] });
            toast({ title: "Refreshed", description: "Orders list updated." });
          }}
          data-testid="button-refresh-orders"
          className="w-full sm:w-auto"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card data-testid="stat-total-orders">
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Orders</p>
                <p className="text-xl sm:text-2xl font-bold">{orders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-active-orders">
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Active</p>
                <p className="text-xl sm:text-2xl font-bold">{activeOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-completed-orders">
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Completed</p>
                <p className="text-xl sm:text-2xl font-bold">{completedOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0">
          <TabsList data-testid="tabs-order-filter" className="w-full sm:w-auto inline-flex min-w-max">
            <TabsTrigger value="all" data-testid="tab-all" className="flex-1 sm:flex-none text-xs sm:text-sm whitespace-nowrap">
              All ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active" className="flex-1 sm:flex-none text-xs sm:text-sm whitespace-nowrap">
              Active ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed" className="flex-1 sm:flex-none text-xs sm:text-sm whitespace-nowrap">
              Completed ({completedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="tab-cancelled" className="flex-1 sm:flex-none text-xs sm:text-sm whitespace-nowrap">
              Cancelled ({cancelledOrders.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No orders found"
              description={
                activeTab === "all"
                  ? "No loads have been directly assigned to you yet. Make sure you are logged in with the driver account that was selected during admin assignment."
                  : `No ${activeTab} orders to display.`
              }
            />
          ) : (
            <div className="space-y-3 pb-6">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onClick={() => setSelectedOrder(order)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <OrderDetailSheet
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}

function OrderCard({ order, onClick }: { order: OrderLoad; onClick: () => void }) {
  return (
    <Card
      className="hover:shadow-md transition-all cursor-pointer hover:border-primary/30 group"
      data-testid={`card-order-${order.id}`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4 md:p-5">
        <div className="space-y-3 sm:space-y-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base sm:text-lg" data-testid={`text-load-id-${order.id}`}>
                {formatLoadId(order)}
              </h3>
              {getStatusBadge(order.status)}
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400">
                Direct Assignment
              </Badge>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity shrink-0 self-start sm:mt-1" />
          </div>

          {/* Route Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium">Pickup</p>
                <p className="text-sm font-medium break-words">{order.pickupCity || order.pickupAddress || "---"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium">Drop</p>
                <p className="text-sm font-medium break-words">{order.dropoffCity || order.dropoffAddress || "---"}</p>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="flex flex-wrap gap-x-3 sm:gap-x-4 md:gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground">
            {order.shipperName && (
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[150px] sm:max-w-[200px]">{order.shipperName}</span>
              </span>
            )}
            {order.requiredTruckType && (
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <Truck className="h-3.5 w-3.5 shrink-0" />
                {order.requiredTruckType}
              </span>
            )}
            {order.weight && (
              <span className="whitespace-nowrap">{parseFloat(order.weight)} MT</span>
            )}
            {order.goodsToBeCarried && (
              <span className="truncate max-w-[120px] sm:max-w-[150px]">{order.goodsToBeCarried}</span>
            )}
          </div>

          {/* Bottom Section - Dates and Additional Info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
              {order.pickupDate && (
                <span className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  Pickup: {format(new Date(order.pickupDate), "dd MMM yyyy")}
                </span>
              )}
              {order.deliveryDate && (
                <span className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  Delivery: {format(new Date(order.deliveryDate), "dd MMM yyyy")}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {order.pickupId && (
                <Badge variant="outline" className="font-mono text-xs">
                  ID: {order.pickupId}
                </Badge>
              )}
              {order.assignedAt && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  <Clock className="h-3 w-3 shrink-0" />
                  {format(new Date(order.assignedAt), "dd MMM")}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}