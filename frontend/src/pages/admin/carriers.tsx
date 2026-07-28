import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { 
  Truck, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Star,
  MapPin,
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface ApiCarrier {
  id: string;
  username: string;
  email: string;
  role: string;
  companyName: string | null;
  phone: string | null;
  isVerified: boolean;
  createdAt: string;
  serviceZones?: string[];
  profile?: {
    fleetSize?: number;
    rating?: number | string;
    serviceZones?: string[];
    totalDeliveries?: number;
    badgeLevel?: string;
    carrierType?: string;
  };
  bidCount?: number;
  documentCount?: number;
}

export default function AdminCarriersPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSyncCarriers = async () => {
    try {
      const result = await refetch();
      if (result.error) {
        throw result.error instanceof Error ? result.error : new Error(String(result.error));
      }
      const n = result.data?.length ?? 0;
      toast({
        title: "Carriers updated",
        description: `Directory refreshed (${n} record${n === 1 ? "" : "s"}).`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not refresh carriers.";
      toast({
        title: t("common.error"),
        description: message,
        variant: "destructive",
      });
    }
  };
  
  // Fetch carriers from real API
  const { data: apiCarriers = [], isLoading, refetch } = useQuery<ApiCarrier[]>({
    queryKey: ["/api/admin/carriers"],
  });
  
  // Fetch verification counts
  const { data: verifications = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/verifications"],
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [carrierTypeFilter, setCarrierTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCarrier, setSelectedCarrier] = useState<ApiCarrier | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
    fleetSize: "",
    serviceZones: "",
  });
  const itemsPerPage = 10;

  // Show ALL carriers (verified and unverified) for better workflow visibility
  const allCarriers = useMemo(() => apiCarriers, [apiCarriers]);
  
  const verifiedCount = useMemo(() => {
    return apiCarriers.filter(c => c.isVerified === true).length;
  }, [apiCarriers]);
  
  const unverifiedCount = useMemo(() => {
    return apiCarriers.filter(c => c.isVerified !== true).length;
  }, [apiCarriers]);

  const pendingCount = useMemo(() => {
    return verifications.filter((v: any) => v.status === "pending").length;
  }, [verifications]);

  const filteredCarriers = useMemo(() => {
    let result = [...allCarriers];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(carrier => 
        carrier.companyName?.toLowerCase().includes(query) ||
        carrier.email?.toLowerCase().includes(query) ||
        carrier.serviceZones?.some(z => z.toLowerCase().includes(query))
      );
    }
    
    // Filter by carrier type (solo vs enterprise)
    if (carrierTypeFilter !== "all") {
      result = result.filter(carrier => {
        const type = carrier.profile?.carrierType || "enterprise";
        return type === carrierTypeFilter;
      });
    }
    
    result.sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
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
  }, [allCarriers, searchQuery, carrierTypeFilter, sortField, sortDirection]);

  const paginatedCarriers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCarriers.slice(start, start + itemsPerPage);
  }, [filteredCarriers, currentPage]);

  const totalPages = Math.ceil(filteredCarriers.length / itemsPerPage);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleUpdateCarrier = async () => {
    if (selectedCarrier) {
      try {
        await apiRequest("PATCH", `/api/admin/carriers/${selectedCarrier.id}`, {
          companyName: formData.companyName,
          email: formData.email,
          phone: formData.phone,
        });
        
        toast({
          title: "Carrier Updated",
          description: `${formData.companyName} has been updated`,
        });
        // Sync data across portal
        queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
        setIsEditModalOpen(false);
        setSelectedCarrier(null);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: "Failed to update carrier",
        });
      }
    }
  };

  const handleVerifyCarrier = async () => {
    if (selectedCarrier) {
      try {
        await apiRequest("PATCH", `/api/admin/carriers/${selectedCarrier.id}/verify`, { isVerified: true });
        toast({
          title: "Carrier Verified",
          description: `${selectedCarrier.companyName} is now verified`,
        });
        // Sync data across portal
        queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
        setIsVerifyModalOpen(false);
        setSelectedCarrier(null);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: "Failed to verify carrier",
        });
      }
    }
  };

  const handleRejectCarrier = async () => {
    if (selectedCarrier) {
      try {
        await apiRequest("PATCH", `/api/admin/carriers/${selectedCarrier.id}/verify`, { isVerified: false });
        toast({
          title: "Carrier Unverified",
          description: `${selectedCarrier.companyName} verification removed`,
        });
        // Sync data across portal
        queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
        setIsRejectModalOpen(false);
        setSelectedCarrier(null);
        setRejectReason("");
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Action Failed",
          description: "Failed to update carrier verification",
        });
      }
    }
  };

  const openEditModal = (carrier: ApiCarrier) => {
    setSelectedCarrier(carrier);
    setFormData({
      companyName: carrier.companyName || "",
      email: carrier.email || "",
      phone: carrier.phone || "",
      fleetSize: carrier.profile?.fleetSize?.toString() || "",
      serviceZones: carrier.serviceZones?.join(", ") || "",
    });
    setIsEditModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified": return <Badge className="bg-green-600"><ShieldCheck className="h-3 w-3 mr-1" />Verified</Badge>;
      case "pending": return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "rejected": return <Badge variant="destructive"><ShieldX className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "expired": return <Badge variant="outline"><ShieldAlert className="h-3 w-3 mr-1" />Expired</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActivityBadge = (level: string) => {
    switch (level) {
      case "high": return <Badge className="bg-green-600">High</Badge>;
      case "medium": return <Badge variant="secondary">Medium</Badge>;
      case "low": return <Badge variant="outline">Low</Badge>;
      default: return <Badge variant="outline">{level}</Badge>;
    }
  };

  const pendingVerifications = pendingCount;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/admin")}
              data-testid="button-back-to-dashboard"
              className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate">{t('admin.carrierDirectory')}</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground ml-10 truncate">{allCarriers.length} carriers ({verifiedCount} verified, {unverifiedCount} pending)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {pendingCount > 0 && (
            <Button onClick={() => setLocation("/admin/verification")} data-testid="button-view-pending" className="text-xs sm:text-sm h-8 sm:h-10">
              <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">{pendingCount} {t('admin.pendingVerification')}</span>
              <span className="sm:hidden">{pendingCount}</span>
            </Button>
          )}
          <Button variant="outline" onClick={() => void handleSyncCarriers()} disabled={isLoading} data-testid="button-sync-carriers" className="text-xs sm:text-sm h-8 sm:h-10">
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('admin.sync')}</span>
            <span className="sm:hidden">Sync</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('admin.verifiedCarriers')}</p>
                <p className="text-lg sm:text-xl font-bold">{verifiedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('admin.totalFleet')}</p>
                <p className="text-lg sm:text-xl font-bold">{allCarriers.filter(c => c.profile?.carrierType !== "solo").reduce((sum, c) => sum + (c.profile?.fleetSize || 0), 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('admin.highActivity')}</p>
                <p className="text-lg sm:text-xl font-bold">{allCarriers.filter(c => (c.bidCount || 0) > 5).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('admin.avgRating')}</p>
                <p className="text-lg sm:text-xl font-bold">{(allCarriers.reduce((sum, c) => sum + parseFloat(String(c.profile?.rating || 4.5)), 0) / Math.max(1, allCarriers.length)).toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingVerifications > 0 && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <span>{t('admin.carriersAwaitingVerification', { count: pendingVerifications })}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setStatusFilter("pending")}
              >
                {t('admin.viewPending')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.searchCarriersPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-carriers"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.allStatus')}</SelectItem>
                  <SelectItem value="verified">{t('admin.verified')}</SelectItem>
                  <SelectItem value="pending">{t('common.pending')}</SelectItem>
                  <SelectItem value="rejected">{t('common.rejected')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-full sm:w-[130px]" data-testid="select-activity-filter">
                  <SelectValue placeholder="Activity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.allActivity')}</SelectItem>
                  <SelectItem value="high">{t('admin.high')}</SelectItem>
                  <SelectItem value="medium">{t('admin.medium')}</SelectItem>
                  <SelectItem value="low">{t('admin.low')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={carrierTypeFilter} onValueChange={setCarrierTypeFilter}>
                <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-carrier-type-filter">
                  <SelectValue placeholder="Carrier Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.allTypes')}</SelectItem>
                  <SelectItem value="solo">{t('admin.soloDrivers')}</SelectItem>
                  <SelectItem value="enterprise">{t('roles.enterprise')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 -ml-3"
                      onClick={() => handleSort("companyName")}
                      data-testid="button-sort-name"
                    >
                      {t('roles.carrier')}
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 -ml-3"
                      onClick={() => handleSort("fleetSize")}
                      data-testid="button-sort-fleet"
                    >
                      {t('admin.fleet')}
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>{t('admin.serviceZones')}</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 -ml-3"
                      onClick={() => handleSort("rating")}
                      data-testid="button-sort-rating"
                    >
                      {t('admin.rating')}
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>{t('admin.activity')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCarriers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t('admin.noCarriersFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCarriers.map((carrier) => (
                    <TableRow 
                      key={carrier.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => setLocation(`/admin/carriers/${carrier.id}`)}
                      data-testid={`row-carrier-${carrier.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium flex items-center gap-1.5 sm:gap-2 flex-wrap text-sm sm:text-base" data-testid={`text-carrier-name-${carrier.id}`}>
                              <span className="truncate">{carrier.companyName || carrier.username}</span>
                              {carrier.isVerified && (
                                <Shield className="h-3 w-3 text-primary shrink-0" />
                              )}
                              {carrier.profile?.carrierType === "solo" && (
                                <Badge variant="outline" className="text-[10px] sm:text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 shrink-0" data-testid={`badge-solo-${carrier.id}`}>
                                  {t('roles.soloDriver')}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">{carrier.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`badge-status-${carrier.id}`}>
                        {getStatusBadge(carrier.isVerified ? "verified" : "pending")}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{carrier.profile?.fleetSize || 0} {t('admin.trucks')}</div>
                          <div className="text-muted-foreground">{carrier.bidCount || 0} {t('bids.title').toLowerCase()}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(carrier.profile?.serviceZones || []).slice(0, 2).map((zone, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              <MapPin className="h-2 w-2 mr-1" />
                              {zone}
                            </Badge>
                          ))}
                          {(carrier.profile?.serviceZones || []).length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{(carrier.profile?.serviceZones || []).length - 2}
                            </Badge>
                          )}
                          {(!carrier.profile?.serviceZones || carrier.profile.serviceZones.length === 0) && (
                            <span className="text-muted-foreground text-xs">{t('admin.notSpecified')}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-rating-${carrier.id}`}>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          <span className="font-medium">{parseFloat(String(carrier.profile?.rating || 4.5)).toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getActivityBadge(carrier.bidCount && carrier.bidCount > 5 ? "high" : carrier.bidCount && carrier.bidCount > 0 ? "medium" : "low")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" data-testid={`button-carrier-actions-${carrier.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(carrier);
                            }} data-testid={`menu-edit-${carrier.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t('admin.editCarrier')}
                            </DropdownMenuItem>
                            {!carrier.isVerified && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setLocation("/admin/verification");
                              }} data-testid={`menu-review-verification-${carrier.id}`}>
                                <Shield className="h-4 w-4 mr-2" />
                                Review Verification
                              </DropdownMenuItem>
                            )}
                            {carrier.isVerified && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCarrier(carrier);
                                setIsRejectModalOpen(true);
                              }}>
                                <ShieldX className="h-4 w-4 mr-2" />
                                {t('admin.revokeVerification')}
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

          {filteredCarriers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left" data-testid="text-pagination-info">
                {t('common.showing')} {((currentPage - 1) * itemsPerPage) + 1} {t('common.to')} {Math.min(currentPage * itemsPerPage, filteredCarriers.length)} {t('common.of')} {filteredCarriers.length} {t('nav.carriers').toLowerCase()}
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
                  {t('admin.page')} {currentPage} {t('common.of')} {totalPages || 1}
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

      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open) { setIsEditModalOpen(false); setSelectedCarrier(null); } }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.editCarrier')}</DialogTitle>
            <DialogDescription>{t('admin.updateCarrierProfile')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('admin.companyName')}</Label>
              <Input 
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                data-testid="input-company-name" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('common.email')}</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="input-email" 
                />
              </div>
              <div className="space-y-2">
                <Label>{t('common.phone')}</Label>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="input-phone" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('admin.fleetSize')}</Label>
              <Input 
                type="number"
                value={formData.fleetSize}
                onChange={(e) => setFormData(prev => ({ ...prev, fleetSize: e.target.value }))}
                data-testid="input-fleet-size" 
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.serviceZonesLabel')}</Label>
              <Textarea 
                value={formData.serviceZones}
                onChange={(e) => setFormData(prev => ({ ...prev, serviceZones: e.target.value }))}
                placeholder="North India, Delhi NCR, Punjab..."
                data-testid="input-service-zones" 
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setSelectedCarrier(null); }} className="w-full sm:w-auto">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateCarrier} data-testid="button-save-carrier" className="w-full sm:w-auto">
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerifyModalOpen} onOpenChange={(open) => { if (!open) { setIsVerifyModalOpen(false); setSelectedCarrier(null); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('admin.verifyCarrier')}</DialogTitle>
            <DialogDescription>
              {t('admin.approveCarrierDescription', { name: selectedCarrier?.companyName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsVerifyModalOpen(false); setSelectedCarrier(null); }} className="w-full sm:w-auto">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleVerifyCarrier} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto" data-testid="button-confirm-verify">
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('common.approved')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectModalOpen} onOpenChange={(open) => { if (!open) { setIsRejectModalOpen(false); setSelectedCarrier(null); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('admin.rejectVerification')}</DialogTitle>
            <DialogDescription>
              {t('admin.rejectVerificationDescription', { name: selectedCarrier?.companyName })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>{t('admin.reasonForRejection')}</Label>
            <Textarea 
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Incomplete documentation, invalid insurance..."
              className="mt-2"
              data-testid="input-reject-reason"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsRejectModalOpen(false); setSelectedCarrier(null); setRejectReason(""); }} className="w-full sm:w-auto">
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleRejectCarrier} data-testid="button-confirm-reject" className="w-full sm:w-auto">
              <XCircle className="h-4 w-4 mr-2" />
              {t('bids.rejectBid')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
