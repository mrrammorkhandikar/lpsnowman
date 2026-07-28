import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { connectMarketplace, disconnectMarketplace, onMarketplaceEvent } from "@/lib/marketplace-socket";
import { useAuth } from "@/lib/auth-context";
import type { Load, FinanceReview } from "@shared/schema";
import { 
  Package, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Copy,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  MapPin,
  Truck,
  Weight,
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Receipt,
  Users,
  Loader2,
  Gavel,
  Navigation,
  Building2,
  FileCheck,
  PauseCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAdminData, type AdminLoad, type AdminCarrier } from "@/lib/admin-data-store";
import { shipmentPayoutSummary } from "@/lib/finance-payout-utils";
import { format } from "date-fns";

type LoadWithBidCount = Load & { bidCount?: number; assignedCarrierName?: string | null };

function mapLoadStatus(status: string | null): AdminLoad["status"] {
  switch (status) {
    case "pending": return "Pending";
    case "submitted_to_admin": return "Pending";
    case "priced": return "Active";
    case "posted_to_carriers": return "Active";
    case "open_for_bid": return "Bidding";
    case "counter_received": return "Bidding";
    case "awarded": return "Assigned";
    case "invoice_created": return "Assigned";
    case "invoice_sent": return "Assigned";
    case "invoice_acknowledged": return "Assigned";
    case "invoice_approved": return "Assigned";
    case "invoice_negotiation": return "Assigned";
    case "invoice_paid": return "Assigned";
    case "in_transit": return "En Route";
    case "delivered": return "Delivered";
    case "closed": return "Delivered";
    case "cancelled": return "Cancelled";
    case "unavailable": return "Unavailable";
    default: return "Pending";
  }
}

function transformLoadToAdminLoad(load: LoadWithBidCount, financeReview?: FinanceReview | null): AdminLoad {
  // Use sequential shipperLoadNumber for consistent LD-XXX format across all portals
  // If shipperLoadNumber is missing (legacy data), use short ID as fallback
  const loadId = load.shipperLoadNumber 
    ? `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`
    : `LD-${load.id.slice(0, 6).toUpperCase()}`;

  // Use the same calculation as the finance dashboard — shipmentPayoutSummary
  // financeReview is enriched by the backend with completedAt, physicalPodSubmittedAt,
  // and settlementDeductions so all deductions (TDS + POD penalty) are correct.
  const enrichedReview = financeReview as (FinanceReview & {
    physicalPodSubmittedAt?: string | null;
    completedAt?: string | null;
    settlementDeductions?: number | null;
  }) | null | undefined;

  const summary = shipmentPayoutSummary({
    settlement: enrichedReview
      ? { grossAmount: undefined, deductions: enrichedReview.settlementDeductions ?? undefined }
      : null,
    load: {
      finalPrice: load.finalPrice ?? null,
      carrierAdvancePercent: load.carrierAdvancePercent ?? null,
      advancePaymentPercent: load.advancePaymentPercent ?? null,
    },
    completedAt: enrichedReview?.completedAt ?? null,
    physicalPodSubmittedAt: enrichedReview?.physicalPodSubmittedAt ?? null,
    financeReview: financeReview
      ? {
          advancePaymentReleasedAt: financeReview.advancePaymentReleasedAt
            ? String(financeReview.advancePaymentReleasedAt)
            : null,
          paymentStatus: financeReview.paymentStatus ?? "not_released",
        }
      : null,
  });

  return {
    loadId,
    pickupId: load.pickupId ?? null,
    shipperId: load.shipperId ?? null,
    shipperName: load.shipperCompanyName || load.shipperContactName || "Unknown Shipper",
    pickup: load.pickupCity ?? null,
    drop: load.dropoffCity ?? null,
    weight: parseFloat(String(load.weight)) || 0,
    weightUnit: load.weightUnit ?? "kg",
    type: load.requiredTruckType ?? "Any",
    status: mapLoadStatus(load.status),
    assignedCarrier: load.assignedCarrierName ?? null,
    carrierId: load.assignedCarrierId ?? null,
    createdDate: load.createdAt ? new Date(load.createdAt) : new Date(),
    eta: null,
    spending: parseFloat(String(load.adminFinalPrice || load.finalPrice || load.estimatedPrice || 0)),
    bidCount: load.bidCount || 0,
    distance: parseFloat(String(load.distance || 0)),
    dimensions: "" as string,
    priority: load.priority === "high" ? "High" : load.priority === "critical" ? "Critical" : "Normal",
    title: load.goodsToBeCarried ?? undefined,
    description: load.specialNotes ?? undefined,
    requiredTruckType: load.requiredTruckType ?? undefined,
    advancePaid: financeReview?.advancePaymentReleasedAt ? summary.advanceAmount : 0,
    remainingCarrierPayout: summary.totalAmountToBePaid,
    _originalId: load.id,
  };
}


export default function AdminLoadsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { updateLoad, updateLoadStatus, addActivity } = useAdminData();
  
  const { user } = useAuth();

  const { data: apiLoads = [], isLoading: isLoadingLoads, refetch: refetchLoads } = useQuery<LoadWithBidCount[]>({
    queryKey: ['/api/loads'],
  });

  type RealCarrier = {
    id: string;
    username: string;
    companyName: string | null;
    phone: string | null;
    isVerified: boolean | null;
    profile: {
      carrierType: string | null;
      totalDeliveries: number | null;
      fleetSize: number | null;
    } | null;
    bidCount: number;
  };

  const { data: realCarriers = [] } = useQuery<RealCarrier[]>({
    queryKey: ["/api/admin/carriers"],
  });

  const verifiedRealCarriers = useMemo(() => 
    realCarriers.filter(c => c.isVerified),
    [realCarriers]
  );

  const { data: financeReviews = [] } = useQuery<FinanceReview[]>({
    queryKey: ['/api/finance/reviews/all'],
    enabled: user?.role === "admin",
  });

  const financeReviewsByLoadId = useMemo(() => {
    const map: Record<string, FinanceReview> = {};
    financeReviews.forEach((r) => {
      if (r.loadId) map[r.loadId] = r;
    });
    return map;
  }, [financeReviews]);
  
  const loads: AdminLoad[] = useMemo(() => {
    return apiLoads.map(load => transformLoadToAdminLoad(load, financeReviewsByLoadId[load.id]));
  }, [apiLoads, financeReviewsByLoadId]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof AdminLoad>("createdDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLoad, setSelectedLoad] = useState<AdminLoad | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [formData, setFormData] = useState({
    pickup: "",
    drop: "",
    weight: "",
    type: "Open - 10 Wheeler",
    status: "Active" as AdminLoad["status"],
  });
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const itemsPerPage = 10;

  const getRecommendedCarriers = useMemo(() => {
    if (!selectedLoad) return [];
    
    return verifiedRealCarriers
      .filter(carrier => {
        // Basic recommendation logic based on carrier profile and load requirements
        const carrierType = carrier.profile?.carrierType?.toLowerCase();
        const truckType = selectedLoad.type?.toLowerCase();
        const fleetSize = carrier.profile?.fleetSize || 0;
        const totalDeliveries = carrier.profile?.totalDeliveries || 0;
        
        // Recommend based on experience and capacity
        const hasExperience = totalDeliveries >= 5;
        const hasCapacity = carrierType === 'fleet' || fleetSize >= 1;
        
        // Route matching (simplified - could be enhanced with actual route data)
        const pickupCity = selectedLoad.pickup?.toLowerCase();
        const dropCity = selectedLoad.drop?.toLowerCase();
        const carrierName = (carrier.companyName || carrier.username || '').toLowerCase();
        
        // Basic matching logic
        let score = 0;
        if (hasExperience) score += 2;
        if (hasCapacity) score += 1;
        if (totalDeliveries >= 20) score += 1;
        if (carrierType === 'fleet' && truckType.includes('multi')) score += 1;
        if (carrierType === 'solo' && !truckType.includes('multi')) score += 1;
        
        return score >= 2; // Only show carriers with decent matching score
      })
      .sort((a, b) => {
        // Sort by experience (total deliveries) and then by company name
        const aDeliveries = a.profile?.totalDeliveries || 0;
        const bDeliveries = b.profile?.totalDeliveries || 0;
        if (aDeliveries !== bDeliveries) {
          return bDeliveries - aDeliveries; // Most experienced first
        }
        return (a.companyName || a.username || '').localeCompare(b.companyName || b.username || '');
      });
  }, [selectedLoad, verifiedRealCarriers]);

  const getOtherCarriers = useMemo(() => {
    if (!selectedLoad) return verifiedRealCarriers;
    
    const recommendedIds = new Set(getRecommendedCarriers.map(c => c.id));
    return verifiedRealCarriers.filter(carrier => !recommendedIds.has(carrier.id));
  }, [selectedLoad, verifiedRealCarriers, getRecommendedCarriers]);

  useEffect(() => {
    if (user?.id && user?.role === "admin") {
      connectMarketplace("admin", user.id);
      
      const unsubLoadPosted = onMarketplaceEvent("load_posted", (data) => {
        toast({
          title: "New Load Posted",
          description: `Load ${data.load?.pickupCity || ""} → ${data.load?.dropoffCity || ""} submitted by shipper`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
      });
      
      const unsubLoadSubmitted = onMarketplaceEvent("load_submitted", (data) => {
        toast({
          title: "New Load Submitted",
          description: `${data.shipperName || "Shipper"} submitted load: ${data.pickupCity || ""} → ${data.dropoffCity || ""}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
      });
      
      const unsubLoadUpdate = onMarketplaceEvent("load_updated", (data) => {
        toast({
          title: "Load Updated",
          description: `Load ${data.load?.pickupCity || ""} → ${data.load?.dropoffCity || ""} status changed to ${data.status}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/bids'] });
      });

      const unsubBidReceived = onMarketplaceEvent("bid_received", (data) => {
        toast({
          title: "New Bid Received",
          description: `Carrier submitted a bid for Rs. ${parseFloat(data.bid?.amount || "0").toLocaleString("en-IN")}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
      });

      return () => {
        unsubLoadPosted();
        unsubLoadSubmitted();
        unsubLoadUpdate();
        unsubBidReceived();
        disconnectMarketplace();
      };
    }
  }, [user?.id, user?.role, toast]);

  const filteredLoads = useMemo(() => {
    let result = [...loads];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(load => 
        load.loadId?.toLowerCase().includes(query) ||
        load.pickupId?.toLowerCase().includes(query) ||
        load.pickup?.toLowerCase().includes(query) ||
        load.drop?.toLowerCase().includes(query) ||
        load.shipperName?.toLowerCase().includes(query) ||
        load.assignedCarrier?.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== "all") {
      result = result.filter(load => load.status === statusFilter);
    }
    
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const direction = sortDirection === "asc" ? 1 : -1;
      
      if (aVal instanceof Date && bVal instanceof Date) {
        return (aVal.getTime() - bVal.getTime()) * direction;
      }
      
      const aStr = String(aVal || "");
      const bStr = String(bVal || "");
      if (aStr < bStr) return -1 * direction;
      if (aStr > bStr) return 1 * direction;
      return 0;
    });
    
    return result;
  }, [loads, searchQuery, statusFilter, sortField, sortDirection]);

  const paginatedLoads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLoads.slice(start, start + itemsPerPage);
  }, [filteredLoads, currentPage]);

  const totalPages = Math.ceil(filteredLoads.length / itemsPerPage);

  const handleSort = (field: keyof AdminLoad) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleDuplicateLoad = (load: AdminLoad) => {
    toast({
      title: "Load Duplicated",
      description: `Created a copy of load ${load.loadId}`,
    });
    addActivity({
      type: "load",
      message: `Load ${load.loadId} duplicated`,
      entityId: load.loadId,
      severity: "info",
    });
  };

  const handleDeleteLoad = async () => {
    if (selectedLoad) {
      try {
        await apiRequest("PATCH", `/api/loads/${selectedLoad._originalId}`, { status: "cancelled" });
        updateLoadStatus(selectedLoad.loadId, "Cancelled");
        toast({
          title: "Load Cancelled",
          description: `Load ${selectedLoad.loadId} has been cancelled`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to cancel load";
        toast({ title: "Error", description: message, variant: "destructive" });
      }
      setIsDeleteModalOpen(false);
      setSelectedLoad(null);
    }
  };

  const handleUpdateLoad = () => {
    if (selectedLoad) {
      updateLoad(selectedLoad.loadId, {
        pickup: formData.pickup,
        drop: formData.drop,
        weight: parseInt(formData.weight) || selectedLoad.weight,
        type: formData.type,
        status: formData.status,
      });
      
      toast({
        title: "Load Updated",
        description: `Load ${selectedLoad.loadId} has been updated`,
      });
      setIsEditModalOpen(false);
      setSelectedLoad(null);
    }
  };

  const handleAssignCarrier = async () => {
    if (selectedLoad && selectedCarrierId) {
      const carrier = verifiedRealCarriers.find(c => c.id === selectedCarrierId);
      if (carrier) {
        try {
          const apiLoad = apiLoads.find(l => l.id === selectedLoad.loadId);
          const carrierPayout = apiLoad?.finalPrice || "0";
          const shipperGross = apiLoad?.adminFinalPrice || apiLoad?.adminSuggestedPrice || carrierPayout;

          await apiRequest("POST", "/api/admin/assign", {
            load_id: selectedLoad.loadId,
            carrier_id: carrier.id,
            final_price: carrierPayout,
            gross_price: shipperGross,
          });

          queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
          queryClient.invalidateQueries({ queryKey: ["/api/carrier/my-orders"] });

          toast({
            title: "Carrier Assigned",
            description: `${carrier.companyName || carrier.username} assigned to this load`,
          });
        } catch (error: any) {
          toast({
            title: "Assignment Failed",
            description: error.message || "Could not assign carrier",
            variant: "destructive",
          });
        }
      }
      setIsAssignModalOpen(false);
      setSelectedLoad(null);
      setSelectedCarrierId("");
    }
  };

  const handleStatusChange = async (newStatus: AdminLoad["status"]) => {
    if (selectedLoad) {
      // Map AdminLoad display status back to DB status
      const dbStatusMap: Record<AdminLoad["status"], string> = {
        "Pending": "pending",
        "Active": "priced",
        "Bidding": "open_for_bid",
        "Assigned": "awarded",
        "En Route": "in_transit",
        "Delivered": "delivered",
        "Cancelled": "cancelled",
        "Unavailable": "unavailable",
      };
      try {
        await apiRequest("PATCH", `/api/loads/${selectedLoad._originalId}`, { status: dbStatusMap[newStatus] });
        updateLoadStatus(selectedLoad.loadId, newStatus);
        toast({
          title: "Status Updated",
          description: `Load ${selectedLoad.loadId} is now ${newStatus}`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update status";
        toast({ title: "Error", description: message, variant: "destructive" });
      }
      setIsStatusModalOpen(false);
      setSelectedLoad(null);
    }
  };

  const handlePushToCarriers = async () => {
    if (!selectedLoad) return;
    
    setIsPushing(true);
    try {
      updateLoadStatus(selectedLoad.loadId, "Bidding");
      addActivity({
        type: "load",
        message: `Load ${selectedLoad.loadId} pushed to carrier marketplace`,
        entityId: selectedLoad.loadId,
        severity: "success",
      });
      
      toast({
        title: "Load Pushed to Carriers",
        description: `Load ${selectedLoad.loadId} is now available for carriers to bid`,
      });
      setIsPushModalOpen(false);
      setSelectedLoad(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to push load to carriers",
        variant: "destructive",
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleSendInvoice = async (load: AdminLoad) => {
    setIsSendingInvoice(true);
    try {
      addActivity({
        type: "transaction",
        message: `Invoice sent to ${load.shipperName} for load ${load.loadId}`,
        entityId: load.loadId,
        severity: "success",
      });
      
      toast({
        title: "Invoice Sent",
        description: `Invoice for load ${load.loadId} sent to ${load.shipperName}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invoice",
        variant: "destructive",
      });
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const openEditModal = (load: AdminLoad) => {
    setSelectedLoad(load);
    setFormData({
      pickup: load.pickup || "",
      drop: load.drop || "",
      weight: load.weight?.toString() || "",
      type: load.type || "Open - 10 Wheeler",
      status: load.status,
    });
    setIsEditModalOpen(true);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Delivered": return "bg-green-600";
      case "En Route": return "bg-blue-600";
      case "Assigned": return "bg-purple-600";
      case "Bidding": return "bg-amber-600";
      case "Active": return "bg-cyan-600";
      case "Cancelled": return "bg-red-600";
      case "Pending": return "bg-gray-600";
      case "Unavailable": return "bg-slate-600";
      default: return "";
    }
  };

  const formatCurrency = (value: number) => {
    return `Rs. ${value.toLocaleString("en-IN")}`;
  };

  const handleSyncFromPortal = async () => {
    try {
      const result = await refetchLoads();
      if (result.error) {
        throw result.error instanceof Error ? result.error : new Error(String(result.error));
      }
      const n = result.data?.length ?? 0;
      toast({
        title: "Loads refreshed",
        description: `Loaded ${n} load${n === 1 ? "" : "s"} from the server.`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not refresh loads.";
      toast({
        title: "Refresh failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  // Calculate status counts for tabs
  const statusCounts = useMemo(() => {
    return {
      all: loads.length,
      Pending: loads.filter(l => l.status === "Pending").length,
      Active: loads.filter(l => l.status === "Active").length,
      Bidding: loads.filter(l => l.status === "Bidding").length,
      Assigned: loads.filter(l => l.status === "Assigned").length,
      "En Route": loads.filter(l => l.status === "En Route").length,
      Delivered: loads.filter(l => l.status === "Delivered").length,
      Cancelled: loads.filter(l => l.status === "Cancelled").length,
      Unavailable: loads.filter(l => l.status === "Unavailable").length,
    };
  }, [loads]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/admin")}
              data-testid="button-back-to-dashboard"
              className="shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold truncate">Loads Management</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10 truncate">Manage all platform loads ({loads.length} total)</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => void handleSyncFromPortal()} 
          disabled={isLoadingLoads}
          data-testid="button-sync-loads"
          className="shrink-0"
        >
          {isLoadingLoads ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync from Portal
        </Button>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total</p>
                <p className="text-lg sm:text-xl font-bold">{loads.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Active</p>
                <p className="text-lg sm:text-xl font-bold">{loads.filter(l => ["Active", "Bidding"].includes(l.status)).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">In Transit</p>
                <p className="text-lg sm:text-xl font-bold">{loads.filter(l => l.status === "En Route").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Delivered</p>
                <p className="text-lg sm:text-xl font-bold">{loads.filter(l => l.status === "Delivered").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Revenue</p>
                <p className="text-lg sm:text-xl font-bold">Rs. {(loads.reduce((sum, l) => sum + l.spending, 0) / 100000).toFixed(1)}L</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Tabs */}
      <div className="relative overflow-hidden">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
          <TabsList className="w-full justify-start h-auto bg-transparent p-0 overflow-x-auto scrollbar-hide flex-nowrap">
            <TabsTrigger 
              value="all" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap shrink-0 text-xs sm:text-sm"
              data-testid="tab-all"
            >
              All ({statusCounts.all})
            </TabsTrigger>
            <TabsTrigger 
              value="Pending" 
              className="data-[state=active]:bg-gray-600 data-[state=active]:text-white whitespace-nowrap shrink-0 text-xs sm:text-sm"
              data-testid="tab-pending"
            >
              Pending ({statusCounts.Pending})
            </TabsTrigger>
            <TabsTrigger 
              value="Active" 
              className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white whitespace-nowrap shrink-0 text-xs sm:text-sm"
              data-testid="tab-active"
            >
              Active ({statusCounts.Active})
            </TabsTrigger>
            <TabsTrigger 
              value="Bidding" 
              className="data-[state=active]:bg-amber-600 data-[state=active]:text-white whitespace-nowrap shrink-0 text-xs sm:text-sm"
              data-testid="tab-bidding"
            >
              Bidding ({statusCounts.Bidding})
            </TabsTrigger>
            <TabsTrigger 
              value="Assigned" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white whitespace-nowrap shrink-0 text-xs sm:text-sm"
              data-testid="tab-assigned"
            >
              Assigned ({statusCounts.Assigned})
            </TabsTrigger>
            <TabsTrigger 
              value="En Route" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap shrink-0 text-xs sm:text-sm"
              data-testid="tab-in-transit"
            >
              In Transit ({statusCounts["En Route"]})
            </TabsTrigger>
            <TabsTrigger 
              value="Delivered" 
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white whitespace-nowrap shrink-0 text-xs sm:text-sm"
              data-testid="tab-delivered"
            >
              Delivered ({statusCounts.Delivered})
            </TabsTrigger>
            <TabsTrigger 
              value="Cancelled" 
              className="data-[state=active]:bg-red-600 data-[state=active]:text-white whitespace-nowrap shrink-0 text-xs sm:text-sm"
              data-testid="tab-cancelled"
            >
              Cancelled ({statusCounts.Cancelled})
            </TabsTrigger>
            <TabsTrigger 
              value="Unavailable" 
              className="data-[state=active]:bg-slate-600 data-[state=active]:text-white whitespace-nowrap shrink-0 text-xs sm:text-sm"
              data-testid="tab-unavailable"
            >
              Unavailable ({statusCounts.Unavailable})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Load ID, Pickup ID, route, shipper, or carrier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-loads"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 -ml-3"
                      onClick={() => handleSort("loadId")}
                      data-testid="button-sort-id"
                    >
                      Load ID
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[80px]">Pickup ID</TableHead>
                  <TableHead>Shipper</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 -ml-3"
                      onClick={() => handleSort("status")}
                      data-testid="button-sort-status"
                    >
                      Status
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 -ml-3"
                      onClick={() => handleSort("spending")}
                      data-testid="button-sort-price"
                    >
                      Shipper Price
                    </Button>
                  </TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Carrier Advance</TableHead>
                  <TableHead>Carrier Remaining Payout</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLoads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No loads found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLoads.map((load) => (
                    <TableRow 
                      key={load.loadId} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => setLocation(`/admin/loads/${load._originalId || load.loadId}`)}
                      data-testid={`row-load-${load.loadId}`}
                    >
                      <TableCell className="font-mono font-medium" data-testid={`text-load-id-${load.loadId}`}>
                        {load.loadId}
                      </TableCell>
                      <TableCell className="font-mono text-xs" data-testid={`text-pickup-id-${load.loadId}`}>
                        {load.pickupId ? (
                          <Badge variant="outline" className="font-mono">
                            {load.pickupId}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium" data-testid={`text-shipper-${load.loadId}`}>
                            {load.shipperName}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {format(load.createdDate, "MMM d, yyyy")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" data-testid={`text-route-${load.loadId}`}>
                          <MapPin className="h-3 w-3 text-green-500" />
                          <span className="text-sm">{load.pickup}</span>
                          <span className="text-muted-foreground">-</span>
                          <MapPin className="h-3 w-3 text-red-500" />
                          <span className="text-sm">{load.drop}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`${getStatusBadgeColor(load.status)} cursor-pointer`} 
                          data-testid={`badge-status-${load.loadId}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLoad(load);
                            setIsStatusModalOpen(true);
                          }}
                        >
                          {load.status}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-price-${load.loadId}`}>
                        <div className="text-sm font-medium">{formatCurrency(load.spending)}</div>
                        {load.bidCount > 0 && (
                          <div className="text-xs text-muted-foreground">{load.bidCount} bids</div>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-carrier-${load.loadId}`}>
                        {load.assignedCarrier ? (
                          <span className="text-sm">{load.assignedCarrier}</span>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLoad(load);
                              setIsAssignModalOpen(true);
                            }}
                          >
                            <UserPlus className="h-3 w-3 mr-1" />
                            Assign
                          </Button>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-advance-${load.loadId}`}>
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {formatCurrency(load.advancePaid || 0)}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-remaining-${load.loadId}`}>
                        <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                          {formatCurrency(load.remainingCarrierPayout || 0)}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-review-${load.loadId}`}>
                        {(() => {
                          const review = financeReviewsByLoadId[load._originalId || ""];
                          if (!review) {
                            return (
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">-</Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">POD-Pending</Badge>
                              </div>
                            );
                          }
                          const statusConfig: Record<string, { label: string; className: string }> = {
                            pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
                            approved: { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
                            on_hold: { label: "On Hold", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
                            rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
                          };
                          const paymentConfig: Record<string, { label: string; className: string }> = {
                            not_released: { label: "Not Released", className: "bg-muted text-muted-foreground" },
                            processing: { label: "Processing", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
                            released: { label: "Released", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
                          };
                          const podConfig: Record<string, { label: string; className: string }> = {
                            pending: { label: "POD-Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
                            submitted: { label: "POD-Submit", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
                          };
                          const s = statusConfig[review.status] || statusConfig.pending;
                          const p = paymentConfig[review.paymentStatus || "not_released"] || paymentConfig.not_released;
                          const podStatus = (review as any).physicalPodSubmittedAt ? "submitted" : "pending";
                          const pod = podConfig[podStatus];
                          return (
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${s.className}`}>{s.label}</Badge>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${p.className}`}>{p.label}</Badge>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pod.className}`}>{pod.label}</Badge>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" data-testid={`button-load-actions-${load.loadId}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(load);
                            }} data-testid={`menu-edit-${load.loadId}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Load
                            </DropdownMenuItem>
                            {/* Cross-links for workflow connectivity */}
                            {(load.status === "Bidding" || load.status === "Active") && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/admin/negotiations?load=${load._originalId || load.loadId}`);
                              }} data-testid={`menu-view-bids-${load.loadId}`}>
                                <Gavel className="h-4 w-4 mr-2" />
                                View Bids
                              </DropdownMenuItem>
                            )}
                            {load.status === "En Route" && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setLocation("/admin/tracking");
                              }} data-testid={`menu-track-${load.loadId}`}>
                                <Navigation className="h-4 w-4 mr-2" />
                                Live Tracking
                              </DropdownMenuItem>
                            )}
                            {/* Profile links for workflow connectivity */}
                            {load.shipperId && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/admin/users?userId=${load.shipperId}&role=shipper`);
                              }} data-testid={`menu-view-shipper-${load.loadId}`}>
                                <Building2 className="h-4 w-4 mr-2" />
                                View Shipper
                              </DropdownMenuItem>
                            )}
                            {load.carrierId && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/admin/carriers/${load.carrierId}`);
                              }} data-testid={`menu-view-carrier-${load.loadId}`}>
                                <Truck className="h-4 w-4 mr-2" />
                                View Carrier
                              </DropdownMenuItem>
                            )}
                            {!load.assignedCarrier && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLoad(load);
                                setIsAssignModalOpen(true);
                              }} data-testid={`menu-assign-${load.loadId}`}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Assign Carrier
                              </DropdownMenuItem>
                            )}
                            {!load.assignedCarrier && load.status !== "Bidding" && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLoad(load);
                                setIsPushModalOpen(true);
                              }} data-testid={`menu-push-${load.loadId}`}>
                                <Users className="h-4 w-4 mr-2" />
                                Push to Carriers
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleSendInvoice(load);
                            }} data-testid={`menu-invoice-${load.loadId}`}>
                              <Receipt className="h-4 w-4 mr-2" />
                              Send Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLoad(load);
                              setIsStatusModalOpen(true);
                            }}>
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Change Status
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateLoad(load);
                            }} data-testid={`menu-duplicate-${load.loadId}`}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(load.status === "Pending" || load.status === "Active") && (
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLoad(load);
                                setIsDeleteModalOpen(true);
                              }}
                              data-testid={`menu-delete-${load.loadId}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Cancel Load
                            </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredLoads.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left" data-testid="text-pagination-info">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLoads.length)} of {filteredLoads.length} loads
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs sm:text-sm px-2 whitespace-nowrap">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open) { setIsEditModalOpen(false); setSelectedLoad(null); } }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Load</DialogTitle>
            <DialogDescription>Update load information. Changes sync to Shipper Portal.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pickup Location</Label>
                <Input 
                  value={formData.pickup}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickup: e.target.value }))}
                  data-testid="input-pickup" 
                />
              </div>
              <div className="space-y-2">
                <Label>Drop Location</Label>
                <Input 
                  value={formData.drop}
                  onChange={(e) => setFormData(prev => ({ ...prev, drop: e.target.value }))}
                  data-testid="input-drop" 
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight (lbs)</Label>
                <Input 
                  type="number" 
                  value={formData.weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                  data-testid="input-weight" 
                />
              </div>
              <div className="space-y-2">
                <Label>Truck Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger data-testid="select-truck-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open - 10 Wheeler">Open - 10 Wheeler</SelectItem>
                    <SelectItem value="Open - 14 Wheeler">Open - 14 Wheeler</SelectItem>
                    <SelectItem value="Open - 16 Wheeler">Open - 16 Wheeler</SelectItem>
                    <SelectItem value="Open - 18 Wheeler">Open - 18 Wheeler</SelectItem>
                    <SelectItem value="Container - 20 Ft">Container - 20 Ft</SelectItem>
                    <SelectItem value="Container - 32 Ft">Container - 32 Ft</SelectItem>
                    <SelectItem value="Container - 40 Ft">Container - 40 Ft</SelectItem>
                    <SelectItem value="Trailer - 40 Ft">Trailer - 40 Ft</SelectItem>
                    <SelectItem value="LCV - Tata Ace">LCV - Tata Ace</SelectItem>
                    <SelectItem value="Tanker - Oil/Fuel">Tanker - Oil/Fuel</SelectItem>
                    <SelectItem value="Tipper - 10 Wheeler">Tipper - 10 Wheeler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as AdminLoad["status"] }))}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Bidding">Bidding</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="En Route">In Transit</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setSelectedLoad(null); }} data-testid="button-cancel-edit" className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleUpdateLoad} data-testid="button-save-load" className="w-full sm:w-auto">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignModalOpen} onOpenChange={(open) => { if (!open) { setIsAssignModalOpen(false); setSelectedLoad(null); setSelectedCarrierId(""); } }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Carrier</DialogTitle>
            <DialogDescription>
              Select a verified carrier to assign to load {selectedLoad?.loadId}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>Select Carrier</Label>
              <Select value={selectedCarrierId} onValueChange={setSelectedCarrierId}>
                <SelectTrigger data-testid="select-carrier">
                  <SelectValue placeholder="Choose a carrier..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Recommended Carriers Section */}
                  {getRecommendedCarriers.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        ⭐ Recommended Carriers
                      </div>
                      {getRecommendedCarriers.map((carrier) => (
                        <SelectItem key={carrier.id} value={carrier.id}>
                          <div className="flex items-center gap-2">
                            <span>{carrier.companyName || carrier.username}</span>
                            <Badge variant={carrier.profile?.carrierType === "solo" ? "secondary" : "outline"} className="text-[9px] px-1 py-0">
                              {carrier.profile?.carrierType === "solo" ? "Solo" : "Fleet"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">({carrier.profile?.totalDeliveries || 0} loads)</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-green-600 border-green-400">
                              Recommended
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Other Carriers Section */}
                  {getOtherCarriers.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        📍 Other Verified Carriers
                      </div>
                      {getOtherCarriers.map((carrier) => (
                        <SelectItem key={carrier.id} value={carrier.id}>
                          <div className="flex items-center gap-2">
                            <span>{carrier.companyName || carrier.username}</span>
                            <Badge variant={carrier.profile?.carrierType === "solo" ? "secondary" : "outline"} className="text-[9px] px-1 py-0">
                              {carrier.profile?.carrierType === "solo" ? "Solo" : "Fleet"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">({carrier.profile?.totalDeliveries || 0} loads)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* No carriers available */}
                  {getRecommendedCarriers.length === 0 && getOtherCarriers.length === 0 && (
                    <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                      No verified carriers available
                    </div>
                  )}
                </SelectContent>
              </Select>
              
              {/* Recommendation info */}
              {getRecommendedCarriers.length > 0 && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    ⭐ Recommended carriers are matched based on experience, capacity, and load requirements
                  </p>
                </div>
              )}
            </div>
            {selectedCarrierId && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                {(() => {
                  const allCarriers = [...getRecommendedCarriers, ...getOtherCarriers];
                  const carrier = allCarriers.find(c => c.id === selectedCarrierId);
                  return carrier ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">{carrier.profile?.carrierType === "solo" ? "Solo Driver" : "Fleet Carrier"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium">{carrier.phone || "---"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Completed Loads</span>
                        <span className="font-medium">{carrier.profile?.totalDeliveries || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fleet Size</span>
                        <span className="font-medium">{carrier.profile?.fleetSize || "---"}</span>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsAssignModalOpen(false); setSelectedLoad(null); setSelectedCarrierId(""); }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleAssignCarrier} disabled={!selectedCarrierId} data-testid="button-confirm-assign" className="w-full sm:w-auto">
              Assign Carrier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusModalOpen} onOpenChange={(open) => { if (!open) { setIsStatusModalOpen(false); setSelectedLoad(null); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Load Status</DialogTitle>
            <DialogDescription>
              Update status for load {selectedLoad?.loadId}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {(["Pending", "Active", "Bidding", "Assigned", "En Route", "Delivered", "Cancelled"] as AdminLoad["status"][]).map((status) => (
              <Button
                key={status}
                variant={selectedLoad?.status === status ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => handleStatusChange(status)}
              >
                <Badge className={`${getStatusBadgeColor(status)} mr-2`}>{status}</Badge>
                {status === selectedLoad?.status && "(Current)"}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cancel Load</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel load {selectedLoad?.loadId}? This will update the status to Cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} data-testid="button-cancel-delete" className="w-full sm:w-auto">
              Keep Load
            </Button>
            <Button variant="destructive" onClick={handleDeleteLoad} data-testid="button-confirm-delete" className="w-full sm:w-auto">
              Cancel Load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPushModalOpen} onOpenChange={(open) => { if (!open) { setIsPushModalOpen(false); setSelectedLoad(null); } }}>
        <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Push Load to Carriers
            </DialogTitle>
            <DialogDescription>
              Make load {selectedLoad?.loadId} available to all carriers for bidding.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedLoad && (
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Route</span>
                  <span className="font-medium truncate ml-2">{selectedLoad.pickup} - {selectedLoad.drop}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipper</span>
                  <span className="font-medium truncate ml-2">{selectedLoad.shipperName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">{formatCurrency(selectedLoad.spending)}</span>
                </div>
              </div>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              Once pushed, carriers will be able to view and bid on this load in their marketplace.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsPushModalOpen(false); setSelectedLoad(null); }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handlePushToCarriers} disabled={isPushing} data-testid="button-confirm-push" className="w-full sm:w-auto">
              {isPushing ? "Pushing..." : "Push to Carriers"}
              <Send className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
