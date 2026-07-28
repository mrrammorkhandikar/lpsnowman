import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { 
  Plus, Search, Filter, Package, LayoutGrid, List, MapPin, ArrowRight, 
  Clock, DollarSign, Truck, MoreHorizontal, Edit, Copy, Eye, Loader2, RotateCcw
} from "lucide-react";
import { connectMarketplace, disconnectMarketplace, onMarketplaceEvent } from "@/lib/marketplace-socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { useLoads, useBids, useTransitionLoadState, useCreateLoad } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-context";
import type { Load, Bid } from "@shared/schema";

function getStatusColor(status: string | null) {
  switch (status) {
    case "pending":
    case "priced":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "posted_to_carriers":
    case "open_for_bid":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "counter_received":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "awarded":
    case "invoice_created":
    case "invoice_sent":
    case "invoice_acknowledged":
    case "invoice_paid":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "in_transit": 
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
    case "delivered":
    case "closed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "unavailable":
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    default: 
      return "bg-muted text-muted-foreground";
  }
}

function formatStatus(status: string | null): string {
  if (!status) return "Unknown";
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(date: Date | string | null) {
  if (!date) return "TBD";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeAgo(date: Date | string | null) {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Format load ID for display - shipper sees LD-001, LD-002, etc. (same as admin portal)
function formatLoadId(load: { shipperLoadNumber?: number | null; id: string }): string {
  // Use global sequential shipperLoadNumber for consistent LD-XXX format across all portals
  if (load.shipperLoadNumber) {
    return `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`;
  }
  // Fallback to first 8 chars of UUID
  return load.id.slice(0, 8);
}

export default function ShipperLoadsPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [makeAvailableDialog, setMakeAvailableDialog] = useState<{ open: boolean; loadId: string | null }>({ open: false, loadId: null });

  const { data: allLoads, isLoading: loadsLoading } = useLoads();
  const { data: allBids } = useBids();
  const transitionLoad = useTransitionLoadState();
  const createLoad = useCreateLoad();

  const loads = (allLoads || []).filter((load: Load) => load.shipperId === user?.id);
  const bids = allBids || [];

  const getBidsForLoad = (loadId: string): Bid[] => {
    return bids.filter((bid: Bid) => bid.loadId === loadId);
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const status = params.get("status");
    if (status === "active") setStatusFilter("active");
    else if (status === "bidding") setStatusFilter("open_for_bid");
    else if (status) setStatusFilter(status);
  }, [searchParams]);

  useEffect(() => {
    if (user?.id && user?.role === "shipper") {
      connectMarketplace("shipper", user.id);
      
      const unsubLoadUpdate = onMarketplaceEvent("load_updated", (data) => {
        const eventType = data.event;
        let title = "Load Updated";
        let description = `Load ${data.load?.pickupCity || ""} → ${data.load?.dropoffCity || ""} has been updated to ${data.status}`;
        
        if (eventType === "bid_accepted") {
          title = "Carrier Assigned";
          description = `A carrier has been assigned to your load: ${data.load?.pickupCity || ""} → ${data.load?.dropoffCity || ""}`;
        } else if (eventType === "admin_edited") {
          title = "Admin Updated Load";
          description = `An administrator updated your load: ${data.load?.pickupCity || ""} → ${data.load?.dropoffCity || ""}`;
        }
        
        toast({ title, description });
        if (typeof window !== "undefined") {
          import("@/lib/queryClient").then(({ queryClient }) => {
            queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
          });
        }
      });

      return () => {
        unsubLoadUpdate();
        disconnectMarketplace();
      };
    }
  }, [user?.id, user?.role, toast]);

  const handleMakeAvailable = async (loadId: string) => {
    try {
      await transitionLoad.mutateAsync({ loadId, toStatus: 'pending' });
      toast({ title: "Load available", description: "The load has been made available again." });
      setMakeAvailableDialog({ open: false, loadId: null });
    } catch (error) {
      toast({ title: "Error", description: "Failed to make load available", variant: "destructive" });
    }
  };

  const handleDuplicate = async (loadId: string) => {
    const loadToDuplicate = loads.find((l: Load) => l.id === loadId);
    if (loadToDuplicate) {
      try {
        const newLoadData = {
          shipperId: loadToDuplicate.shipperId,
          pickupAddress: loadToDuplicate.pickupAddress,
          pickupCity: loadToDuplicate.pickupCity,
          pickupState: loadToDuplicate.pickupState,
          pickupPincode: loadToDuplicate.pickupPincode,
          dropoffAddress: loadToDuplicate.dropoffAddress,
          dropoffCity: loadToDuplicate.dropoffCity,
          dropoffState: loadToDuplicate.dropoffState,
          dropoffPincode: loadToDuplicate.dropoffPincode,
          materialType: loadToDuplicate.materialType,
          weight: loadToDuplicate.weight,
          truckType: loadToDuplicate.truckType,
          pickupDate: loadToDuplicate.pickupDate,
          specialInstructions: loadToDuplicate.specialInstructions,
        };
        await createLoad.mutateAsync(newLoadData);
        toast({ title: "Load duplicated", description: "A new load has been created." });
      } catch (error) {
        toast({ title: "Error", description: "Failed to duplicate load", variant: "destructive" });
      }
    }
  };

  const loadsWithBids = loads.map((load: Load) => ({
    ...load,
    bidCount: getBidsForLoad(load.id).length,
    loadBids: getBidsForLoad(load.id),
  }));

  const statusMappings: Record<string, string[]> = {
    active: ['pending', 'priced', 'posted_to_carriers', 'open_for_bid', 'counter_received', 'awarded', 'invoice_created', 'invoice_sent', 'invoice_acknowledged', 'invoice_paid'],
    pending: ['pending', 'priced'],
    open_for_bids: ['posted_to_carriers', 'open_for_bid', 'counter_received'],
    awarded: ['awarded'],
    invoice: ['invoice_created', 'invoice_sent', 'invoice_acknowledged', 'invoice_paid'],
    in_transit: ['in_transit'],
    delivered: ['delivered', 'closed'],
    cancelled: ['cancelled'],
    unavailable: ['unavailable'],
  };

  const filteredLoads = loadsWithBids.filter((load) => {
    let matchesStatus = true;
    if (statusFilter === "all") {
      matchesStatus = true;
    } else if (statusMappings[statusFilter]) {
      matchesStatus = statusMappings[statusFilter].includes(load.status || '');
    } else {
      matchesStatus = load.status === statusFilter;
    }
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (load.pickupCity?.toLowerCase() || '').includes(searchLower) ||
      (load.dropoffCity?.toLowerCase() || '').includes(searchLower) ||
      load.id.toLowerCase().includes(searchLower);
    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    all: loads.length,
    active: loads.filter((l: Load) => statusMappings.active.includes(l.status || '')).length,
    pending: loads.filter((l: Load) => statusMappings.pending.includes(l.status || '')).length,
    open_for_bids: loads.filter((l: Load) => statusMappings.open_for_bids.includes(l.status || '')).length,
    awarded: loads.filter((l: Load) => statusMappings.awarded.includes(l.status || '')).length,
    invoice: loads.filter((l: Load) => statusMappings.invoice.includes(l.status || '')).length,
    in_transit: loads.filter((l: Load) => statusMappings.in_transit.includes(l.status || '')).length,
    delivered: loads.filter((l: Load) => statusMappings.delivered.includes(l.status || '')).length,
    cancelled: loads.filter((l: Load) => statusMappings.cancelled.includes(l.status || '')).length,
    unavailable: loads.filter((l: Load) => statusMappings.unavailable.includes(l.status || '')).length,
  };

  if (loadsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">{t('dashboard.activeLoads')}</h1>
          <p className="text-muted-foreground">{t('shipper.loadOverview')}</p>
        </div>
        <Button onClick={() => navigate("/shipper/post-load")} data-testid="button-post-new-load">
          <Plus className="h-4 w-4 mr-2" />
          {t('loads.postNewLoad')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search') + '...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-loads"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')} ({statusCounts.all})</SelectItem>
            <SelectItem value="active">{t('common.active')} ({statusCounts.active})</SelectItem>
            <SelectItem value="pending">Pending ({statusCounts.pending})</SelectItem>
            <SelectItem value="open_for_bids">Open for Bids ({statusCounts.open_for_bids})</SelectItem>
            <SelectItem value="awarded">{t('loads.awarded')} ({statusCounts.awarded})</SelectItem>
            <SelectItem value="invoice">Invoice ({statusCounts.invoice})</SelectItem>
            <SelectItem value="in_transit">{t('loads.inTransit')} ({statusCounts.in_transit})</SelectItem>
            <SelectItem value="delivered">{t('loads.delivered')} ({statusCounts.delivered})</SelectItem>
            <SelectItem value="cancelled">{t('loads.cancelled')} ({statusCounts.cancelled})</SelectItem>
            <SelectItem value="unavailable">Unavailable ({statusCounts.unavailable})</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("table")}
            data-testid="button-view-table"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
            className="ml-1"
            data-testid="button-view-grid"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
        <div className="relative -mx-3 sm:-mx-4 md:mx-0">
          <div className="overflow-x-auto scrollbar-hide px-3 sm:px-4 md:px-0">
            <TabsList className="inline-flex h-10 w-max gap-1">
              <TabsTrigger value="all" className="gap-1.5 whitespace-nowrap shrink-0">
                {t('common.all')} <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-1.5 whitespace-nowrap shrink-0">
                {t('common.active')} <Badge variant="secondary" className="ml-1">{statusCounts.active}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5 whitespace-nowrap shrink-0">
                Pending <Badge variant="secondary" className="ml-1">{statusCounts.pending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="open_for_bids" className="gap-1.5 whitespace-nowrap shrink-0">
                Open for Bids <Badge variant="secondary" className="ml-1">{statusCounts.open_for_bids}</Badge>
              </TabsTrigger>
              <TabsTrigger value="awarded" className="gap-1.5 whitespace-nowrap shrink-0">
                {t('loads.awarded')} <Badge variant="secondary" className="ml-1">{statusCounts.awarded}</Badge>
              </TabsTrigger>
              <TabsTrigger value="invoice" className="gap-1.5 whitespace-nowrap shrink-0">
                Invoice <Badge variant="secondary" className="ml-1">{statusCounts.invoice}</Badge>
              </TabsTrigger>
              <TabsTrigger value="in_transit" className="gap-1.5 whitespace-nowrap shrink-0">
                {t('loads.inTransit')} <Badge variant="secondary" className="ml-1">{statusCounts.in_transit}</Badge>
              </TabsTrigger>
              <TabsTrigger value="delivered" className="gap-1.5 whitespace-nowrap shrink-0">
                {t('loads.delivered')} <Badge variant="secondary" className="ml-1">{statusCounts.delivered}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
      </Tabs>

      {filteredLoads.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('loads.noLoadsFound')}
          description={
            statusFilter === "all"
              ? t('shipper.noLoadsPosted')
              : `${t('loads.noLoadsFound')} - ${formatStatus(statusFilter)}`
          }
          actionLabel={t('shipper.postFirstLoad')}
          onAction={() => navigate("/shipper/post-load")}
        />
      ) : viewMode === "table" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('loads.loadId')}</TableHead>
                <TableHead>Pickup ID</TableHead>
                <TableHead>{t('loads.route')}</TableHead>
                <TableHead>{t('loads.weight')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.price')}</TableHead>
                <TableHead>{t('loads.pickupDate')}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoads.map((load) => (
                <TableRow 
                  key={load.id} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => navigate(`/shipper/loads/${load.id}`)}
                  data-testid={`row-load-${load.id}`}
                >
                  <TableCell className="font-mono text-sm">{formatLoadId(load)}</TableCell>
                  <TableCell className="text-sm">
                    {load.pickupId ? (
                      <Badge variant="outline" className="font-mono">{load.pickupId}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-green-500" />
                      <span className="truncate max-w-24">{load.pickupCity}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <MapPin className="h-3 w-3 text-red-500" />
                      <span className="truncate max-w-24">{load.dropoffCity}</span>
                    </div>
                  </TableCell>
                  <TableCell>{load.weight ? `${parseFloat(load.weight).toLocaleString()} tonnes` : 'N/A'}</TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(load.status)} no-default-hover-elevate no-default-active-elevate`}>
                      {formatStatus(load.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    Rs. {parseFloat(load.adminFinalPrice || load.finalPrice || '0').toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>{formatDate(load.pickupDate)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${load.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/shipper/loads/${load.id}`); }}>
                          <Eye className="h-4 w-4 mr-2" /> {t('common.details')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(load.id); }}>
                          <Copy className="h-4 w-4 mr-2" /> {t('common.duplicate') || 'Duplicate'}
                        </DropdownMenuItem>
                        {load.status === "unavailable" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); setMakeAvailableDialog({ open: true, loadId: load.id }); }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" /> Make Available
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLoads.map((load) => (
            <Card 
              key={load.id} 
              className="hover-elevate cursor-pointer"
              onClick={() => navigate(`/shipper/loads/${load.id}`)}
              data-testid={`card-load-${load.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <Badge className={`${getStatusColor(load.status)} no-default-hover-elevate no-default-active-elevate`}>
                    {formatStatus(load.status)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {load.bidCount > 0 && (
                      <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                        {load.bidCount} bids
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(load.id); }}>
                          <Copy className="h-4 w-4 mr-2" /> {t('common.duplicate') || 'Duplicate'}
                        </DropdownMenuItem>
                        {load.status === "unavailable" && (
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); setMakeAvailableDialog({ open: true, loadId: load.id }); }}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" /> Make Available
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{load.pickupCity}, {load.pickupState}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center pl-3">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex-1 h-px bg-border ml-2" />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 flex-shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{load.dropoffCity}, {load.dropoffState}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-sm flex-wrap">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    <span>{load.weight ? `${parseFloat(load.weight).toLocaleString()} tonnes` : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDate(load.pickupDate)}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-auto font-medium text-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>Rs. {parseFloat(load.adminFinalPrice || load.finalPrice || '0').toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={makeAvailableDialog.open} onOpenChange={(open) => setMakeAvailableDialog({ open, loadId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Load Available</DialogTitle>
            <DialogDescription>
              This will make the load available again for pricing and bidding. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMakeAvailableDialog({ open: false, loadId: null })}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={() => makeAvailableDialog.loadId && handleMakeAvailable(makeAvailableDialog.loadId)}
              disabled={transitionLoad.isPending}
            >
              {transitionLoad.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Make Available
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
