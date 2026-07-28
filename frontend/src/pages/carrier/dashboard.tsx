import { useLocation, Redirect } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { Truck, DollarSign, Package, Clock, TrendingUp, Route, Plus, ArrowRight, Star, MapPin, User, Info, Loader2, CheckCircle, XCircle, FileText, ShieldCheck, ShieldX, ShieldAlert, Eye, Bell, AlertTriangle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { useAuth } from "@/lib/auth-context";
import { useTrucks, useLoads, useShipments, useSettlements } from "@/lib/api-hooks";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { connectMarketplace, onMarketplaceEvent, offMarketplaceEvent } from "@/lib/marketplace-socket";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from "recharts";
import type { Truck as TruckType, Load, Shipment } from "@shared/schema";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";

const formatCurrency = (amount: number): string => {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
};

const formatEta = (eta: Date | string): string => {
  const now = new Date();
  const etaDate = new Date(eta);
  const diffMs = etaDate.getTime() - now.getTime();
  const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const performanceTooltips = {
  reliability: "Measures on-time pickup and delivery consistency. Based on completed trips vs scheduled times.",
  communication: "Tracks responsiveness to shipper messages and update frequency during trips.",
  onTime: "Percentage of deliveries completed within the promised delivery window.",
  overall: "Weighted average of all performance metrics. Industry benchmark is 4.5/5.0"
};

const getDocumentDisplayName = (docType: string): string => {
  const typeMap: Record<string, string> = {
    rc_book: "RC (Registration Certificate)",
    insurance: "Vehicle Insurance",
    permit: "Commercial Permit",
    pan_card: "PAN Card",
    gst_certificate: "GST Certificate",
    driving_license: "Driving License",
    pollution_certificate: "Pollution Certificate",
    fitness_certificate: "Fitness Certificate",
    other: "Other Document",
  };
  return typeMap[docType] || docType;
};

export default function CarrierDashboard() {
  const [, navigate] = useLocation();
  const { user, carrierType } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [hasNewVerificationUpdate, setHasNewVerificationUpdate] = useState(false);
  const [welcomeBannerDismissed, setWelcomeBannerDismissed] = useState(() => {
    return localStorage.getItem(`welcomeBannerDismissed_${user?.id}`) === "true";
  });

  const dismissWelcomeBanner = () => {
    setWelcomeBannerDismissed(true);
    if (user?.id) {
      localStorage.setItem(`welcomeBannerDismissed_${user.id}`, "true");
    }
  };
  
  // Fetch onboarding status for gating
  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = useQuery<{
    id: string;
    status: string;
    carrierType: string;
    rejectionReason?: string;
  }>({
    queryKey: ["/api/carrier/onboarding"],
  });
  
  // Fetch verification status
  const { data: verification, refetch: refetchVerification } = useQuery<{
    id: string;
    status: string;
    rejectionReason?: string;
    documents: Array<{
      id: string;
      documentType: string;
      fileName: string;
      fileUrl: string;
      status: string;
      uploadedAt?: string;
      rejectionReason?: string;
    }>;
    updatedAt?: string;
  }>({
    queryKey: ["/api/carrier/verification"],
  });
  
  // Connect to WebSocket for real-time verification status updates
  useEffect(() => {
    if (user?.id) {
      connectMarketplace("carrier", user.id);
      
      const handleVerificationStatus = (data: { status: string; companyName?: string; reason?: string }) => {
        // Set flag to show notification indicator
        setHasNewVerificationUpdate(true);
        refetchVerification();
        
        if (data.status === "approved") {
          toast({
            title: "Verification Approved!",
            description: "Congratulations! Your carrier account has been verified. You can now bid on loads. Click to view details.",
            duration: 10000,
            action: (
              <Button variant="outline" size="sm" onClick={() => setVerificationDialogOpen(true)}>
                View
              </Button>
            ),
          });
        } else if (data.status === "rejected") {
          toast({
            variant: "destructive",
            title: "Verification Rejected",
            description: data.reason || "Your verification application was rejected. Click to view details.",
            duration: 10000,
            action: (
              <Button variant="outline" size="sm" onClick={() => setVerificationDialogOpen(true)}>
                View
              </Button>
            ),
          });
        }
      };
      
      onMarketplaceEvent("verification_status_changed", handleVerificationStatus);
      
      return () => {
        offMarketplaceEvent("verification_status_changed", handleVerificationStatus);
      };
    }
  }, [user?.id, toast, refetchVerification]);
  
  // Use new stats endpoint for dashboard data
  const { data: dashboardStats, isLoading: statsLoading } = useQuery<{
    activeTruckCount: number;
    totalTruckCount: number;
    availableTruckCount: number;
    pendingBidsCount: number;
    activeTripsCount: number;
    driversEnRoute: number;
    currentMonthRevenue: number;
    completedTripsThisMonth: number;
    totalShipments: number;
    hasRevenueData: boolean;
  }>({
    queryKey: ["/api/carrier/dashboard/stats"],
  });

  const { data: allTrucks } = useTrucks();
  const { data: allLoads, isLoading: loadsLoading } = useLoads();
  const { data: allShipments } = useShipments();
  const { data: allSettlements } = useSettlements();

  // Fetch real performance metrics from trip history
  const { data: realPerformanceData } = useQuery<{
    hasData: boolean;
    totalTrips: number;
    overallScore: number | null;
    reliabilityScore: number | null;
    communicationScore: number | null;
    onTimeRate: number | null;
    totalRatings?: number;
    tripHistory: Array<{
      tripId: string;
      loadId: string;
      completedAt: string;
      wasOnTime: boolean;
      rating: { reliability: number; communication: number; onTimeDelivery: number } | null;
    }>;
  }>({
    queryKey: ["/api/carrier/performance"],
  });

  // Calculate revenue from real shipments and settlements
  const combinedRevenueData = useMemo(() => {
    const myShipments = (allShipments || []).filter((s: Shipment) => 
      s.carrierId === user?.id && s.status === 'delivered'
    );
    
    const carrierSettlements = Array.isArray(allSettlements) 
      ? allSettlements.filter((s: any) => s.carrierId === user?.id && s.status === 'paid')
      : [];
    
    // Calculate total real revenue from paid settlements
    const totalSettlementRevenue = carrierSettlements.reduce((sum: number, s: any) => 
      sum + parseFloat(s.carrierPayoutAmount?.toString() || '0'), 0
    );
    
    // Calculate revenue from delivered shipments (fallback if no settlements)
    const shipmentRevenue = myShipments.reduce((sum: number, s: Shipment) => {
      const load = (allLoads || []).find((l: Load) => l.id === s.loadId);
      // Use finalPrice (full carrier payout), fallback to adminFinalPrice
      return sum + (load?.finalPrice ? parseFloat(load.finalPrice) : 
                    load?.adminFinalPrice ? parseFloat(load.adminFinalPrice) : 0);
    }, 0);

    const realRevenue = totalSettlementRevenue > 0 ? totalSettlementRevenue : shipmentRevenue;
    const totalRevenue = realRevenue;
    const totalTrips = myShipments.length;
    
    return {
      totalRevenue,
      totalTrips,
      hasData: totalRevenue > 0 || totalTrips > 0,
      realTrips: myShipments.length,
    };
  }, [allShipments, allSettlements, allLoads, user?.id]);

  // Calculate performance metrics from real trip history
  const performanceMetrics = useMemo(() => {
    if (realPerformanceData?.hasData) {
      const totalRatings = realPerformanceData.totalRatings ?? 0;
      return {
        onTimeRate: realPerformanceData.onTimeRate ?? 0,
        reliabilityScore: realPerformanceData.reliabilityScore,
        communicationScore: realPerformanceData.communicationScore,
        overallScore: realPerformanceData.overallScore,
        totalTrips: realPerformanceData.totalTrips,
        totalRatings,
        hasShipperRatings: totalRatings > 0,
        isRealData: true,
      };
    }
    return null;
  }, [realPerformanceData]);

  if (statsLoading || loadsLoading || isLoadingOnboarding) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Note: Onboarding gate is now applied at the router level in App.tsx
  // This component will only render for approved/verified carriers

  // Use stats from the API endpoint
  const activeTruckCount = dashboardStats?.activeTruckCount || 0;
  const availableTruckCount = dashboardStats?.availableTruckCount || 0;
  const totalTruckCount = dashboardStats?.totalTruckCount || 0;
  const pendingBidsCount = dashboardStats?.pendingBidsCount || 0;
  const activeTripsCount = dashboardStats?.activeTripsCount || 0;
  const driversEnRoute = dashboardStats?.driversEnRoute || 0;
  
  // Use combined revenue data (API + mock data) for consistency with Revenue page
  const currentMonthRevenue = combinedRevenueData.totalRevenue;
  const hasRevenueData = combinedRevenueData.hasData;

  const trucks = (allTrucks || []).filter((t: TruckType) => t.carrierId === user?.id);
  const loads = allLoads || [];
  const shipments = (allShipments || []).filter((s: Shipment) => s.carrierId === user?.id);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentMonthName = monthNames[currentMonth];
  
  const monthlyRevenueData = hasRevenueData 
    ? [{ month: currentMonthName, revenue: currentMonthRevenue, fullMonth: `${monthNames[currentMonth]} (Current Month)` }]
    : [];

  const revenueChange = 0;

  const availableLoads = loads.filter((l: Load) => 
    ['posted_to_carriers', 'open_for_bid'].includes(l.status || '')
  );

  const topRecommendedLoads = availableLoads.slice(0, 4).map((load: Load) => {
    const est = computeRouteDistanceKmEstimate({
      pickupLat: load.pickupLat,
      pickupLng: load.pickupLng,
      dropoffLat: load.dropoffLat,
      dropoffLng: load.dropoffLng,
      pickupCity: load.pickupCity,
      dropoffCity: load.dropoffCity,
    });
    const n = Number.isFinite(est) ? Math.round(est) : null;
    return {
      loadId: load.id,
      pickup: `${load.pickupCity || "Unknown"}`,
      dropoff: `${load.dropoffCity || "Unknown"}`,
      distance: n != null && n >= 1 ? n : null,
      loadType: load.requiredTruckType || "General",
      budget: load.adminFinalPrice ? parseFloat(load.adminFinalPrice) : null,
    };
  });

  const displayTrips = shipments
    .filter((s: Shipment) => ['in_transit', 'picked_up', 'out_for_delivery', 'at_checkpoint', 'pickup_scheduled'].includes(s.status || ''))
    .slice(0, 4)
    .map((shipment: Shipment) => {
      const load = loads.find((l: Load) => l.id === shipment.loadId);
      const truck = trucks.find((t: TruckType) => t.id === shipment.truckId);
      return {
        tripId: shipment.id,
        pickup: load?.pickupCity || 'Unknown',
        dropoff: load?.dropoffCity || 'Unknown',
        eta: shipment.eta,
        driverAssigned: 'Driver Assigned',
        truckAssigned: truck?.licensePlate || 'Truck Assigned',
        loadType: load?.requiredTruckType || 'General',
        totalDistance: (() => {
          if (!load) return null;
          const k = computeRouteDistanceKmEstimate({
            pickupLat: load.pickupLat,
            pickupLng: load.pickupLng,
            dropoffLat: load.dropoffLat,
            dropoffLng: load.dropoffLng,
            pickupCity: load.pickupCity,
            dropoffCity: load.dropoffCity,
          });
          const rounded = Number.isFinite(k) ? Math.round(k) : null;
          return rounded != null && rounded >= 1 ? rounded : null;
        })(),
        status: shipment.status,
      };
    });

  // Show pending review banner if onboarding is pending or under_review
  const pendingReview = onboardingStatus?.status === "pending" || onboardingStatus?.status === "under_review";

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Pending Review Banner */}
      {pendingReview && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base">{t("carrierOnboarding.pendingReview")}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{t("carrierOnboarding.pendingReviewDesc")}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 self-start sm:self-center">
                <Clock className="h-3 w-3 mr-1" />
                {t(`carrierOnboarding.status.${onboardingStatus?.status}`)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-welcome">
            {t("dashboard.welcomeBack")}, {user?.companyName || user?.username}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t("dashboard.fleetOverview")}</p>
        </div>
        <Button onClick={() => navigate("/carrier/add-truck")} data-testid="button-add-truck" className="shrink-0 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t("fleet.addTruck")}
        </Button>
      </div>

      {/* Welcome Box for Verified Carriers */}
      {verification?.status === "approved" && !welcomeBannerDismissed && (
        <Card 
          className="border-green-500/50 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 relative"
          data-testid="card-welcome-verified"
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 text-green-600 hover:bg-green-200/50 dark:hover:bg-green-800/50 z-10"
            onClick={dismissWelcomeBanner}
            data-testid="button-dismiss-welcome"
          >
            <X className="h-4 w-4" />
          </Button>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <ShieldCheck className="h-8 w-8 sm:h-10 sm:w-10 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-green-800 dark:text-green-200">
                  Welcome Aboard, {user?.companyName || user?.username}!
                </h2>
                <p className="text-sm sm:text-base text-green-700 dark:text-green-300 mt-1">
                  Your carrier account has been verified. You can now bid on loads and start earning.
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mt-4 justify-center md:justify-start">
                  <Button 
                    onClick={() => navigate("/carrier/my-documents")}
                    variant="outline"
                    className="border-green-600 text-green-700 hover:bg-green-100 dark:border-green-400 dark:text-green-300 dark:hover:bg-green-900/50 w-full sm:w-auto"
                    data-testid="button-view-documents"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View My Documents
                  </Button>
                  <Button 
                    onClick={() => navigate("/carrier/loads")}
                    className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                    data-testid="button-start-bidding"
                  >
                    Start Bidding on Loads
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Status Card - Show for pending or rejected */}
      {verification && (verification.status === "pending" || verification.status === "rejected") && (
        <Card 
          className={`cursor-pointer hover-elevate ${
            verification.status === "rejected" ? "border-destructive/50 bg-red-50/50 dark:bg-red-950/20" : 
            "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20"
          }`}
          onClick={() => {
            setHasNewVerificationUpdate(false);
            setVerificationDialogOpen(true);
          }}
          data-testid="card-verification-status"
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                {verification.status === "rejected" ? (
                  <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full shrink-0">
                    <ShieldX className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
                  </div>
                ) : (
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full relative shrink-0">
                    <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
                    {hasNewVerificationUpdate && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full animate-pulse" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm sm:text-base">
                    {verification.status === "rejected" ? "Verification Rejected" : "Verification Pending"}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">
                    {verification.status === "rejected"
                      ? verification.rejectionReason || "Please review the rejection details and resubmit."
                      : `${verification.documents?.length || 0} documents submitted and awaiting review.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {hasNewVerificationUpdate && (
                  <Badge variant="default" className="animate-pulse">
                    <Bell className="h-3 w-3 mr-1" />
                    New Update
                  </Badge>
                )}
                <Button variant="outline" size="sm" data-testid="button-view-verification" className="whitespace-nowrap">
                  <Eye className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">View Details</span>
                  <span className="sm:hidden">View</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div 
          className="cursor-pointer hover-elevate rounded-lg"
          onClick={() => navigate(carrierType === "solo" ? "/carrier/my-truck" : "/carrier/fleet")}
          data-testid="tile-active-trucks"
        >
          <StatCard
            title={t("dashboard.activeTrucks")}
            value={`${activeTruckCount} / ${totalTruckCount}`}
            icon={Truck}
            subtitle={`${availableTruckCount} ${t("dashboard.availableNow")}`}
          />
        </div>
        <div 
          className="cursor-pointer hover-elevate rounded-lg"
          onClick={() => navigate("/carrier/bids")}
          data-testid="tile-pending-bids"
        >
          <StatCard
            title={t("dashboard.pendingBids")}
            value={pendingBidsCount}
            icon={Clock}
            trend={{ value: 15, isPositive: true }}
            subtitle={t("dashboard.vsLastWeek")}
          />
        </div>
        <div 
          className="cursor-pointer hover-elevate rounded-lg"
          onClick={() => navigate("/carrier/trips")}
          data-testid="tile-active-trips"
        >
          <StatCard
            title={t("dashboard.activeTrips")}
            value={activeTripsCount}
            icon={Route}
            subtitle={`${driversEnRoute} ${t("dashboard.driversEnRoute")}`}
          />
        </div>
        <div 
          className="cursor-pointer hover-elevate rounded-lg"
          onClick={() => navigate("/carrier/revenue")}
          data-testid="tile-monthly-revenue"
        >
          <StatCard
            title={t("dashboard.monthlyRevenue")}
            value={currentMonthRevenue > 0 ? formatCurrency(currentMonthRevenue) : t("dashboard.noData")}
            icon={DollarSign}
            subtitle={hasRevenueData ? `${combinedRevenueData.totalTrips} ${t("dashboard.tripsCompleted")}` : t("dashboard.completeTripsToEarn")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.revenueSummary")}</CardTitle>
            {hasRevenueData && (
              <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate self-start sm:self-center">
                {formatCurrency(currentMonthRevenue)} {t("dashboard.total")}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {!hasRevenueData ? (
              <div className="h-48 sm:h-64 flex items-center justify-center">
                <div className="text-center text-muted-foreground px-4">
                  <DollarSign className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium text-sm sm:text-base">{t("dashboard.noRevenueDataYet")}</p>
                  <p className="text-xs sm:text-sm">{t("dashboard.completeTripsToStartEarning")}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(value) => `${(value / 100000).toFixed(1)}L`} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) {
                            return payload[0].payload.fullMonth;
                          }
                          return label;
                        }}
                      />
                      <Bar 
                        dataKey="revenue" 
                        fill="hsl(217, 91%, 48%)" 
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                        onClick={() => {
                          navigate("/carrier/revenue");
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Click any bar to view detailed monthly report
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.performanceScore")}</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{performanceTooltips.overall}</p>
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            {performanceMetrics ? (
              <div className="space-y-4">
                {/* Overall Score */}
                <div className="flex flex-col items-center justify-center py-4">
                  {performanceMetrics.hasShipperRatings ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 fill-yellow-500" />
                        <span className="text-2xl sm:text-3xl font-bold">
                          {performanceMetrics.overallScore != null
                            ? performanceMetrics.overallScore.toFixed(1)
                            : "—"}
                        </span>
                        <span className="text-base sm:text-lg text-muted-foreground">/5.0</span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground text-center">
                        Based on {performanceMetrics.totalTrips} completed trip{performanceMetrics.totalTrips !== 1 ? "s" : ""}
                        {performanceMetrics.isRealData && (
                          <span>
                            {" "}
                            ({performanceMetrics.totalRatings} shipper rating
                            {performanceMetrics.totalRatings !== 1 ? "s" : ""})
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <div className="text-center px-2 max-w-[280px] mx-auto">
                      <Star className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("dashboard.noRatingsReceived")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {t("dashboard.ratingsFromShippersHint")}
                      </p>
                      {performanceMetrics.totalTrips > 0 && (
                        <p className="text-xs text-muted-foreground mt-3">
                          Based on {performanceMetrics.totalTrips} completed trip
                          {performanceMetrics.totalTrips !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Individual Metrics */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-medium truncate">Reliability</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{performanceTooltips.reliability}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="font-semibold text-xs sm:text-sm shrink-0 text-right max-w-[55%]">
                      {performanceMetrics.hasShipperRatings && performanceMetrics.reliabilityScore != null
                        ? `${performanceMetrics.reliabilityScore.toFixed(1)}/5.0`
                        : !performanceMetrics.hasShipperRatings
                          ? (
                              <span className="font-normal text-muted-foreground">
                                {t("dashboard.noRatingsReceived")}
                              </span>
                            )
                          : "—"}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{
                        width: `${
                          performanceMetrics.hasShipperRatings && performanceMetrics.reliabilityScore != null
                            ? (performanceMetrics.reliabilityScore / 5) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-medium truncate">On-Time Delivery</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{performanceTooltips.onTime}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="font-semibold text-xs sm:text-sm shrink-0">{performanceMetrics.onTimeRate}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${performanceMetrics.onTimeRate}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-medium truncate">Shipper Rating</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{performanceTooltips.communication}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="font-semibold text-xs sm:text-sm shrink-0 text-right max-w-[55%]">
                      {performanceMetrics.hasShipperRatings && performanceMetrics.communicationScore != null
                        ? `${performanceMetrics.communicationScore.toFixed(1)}/5.0`
                        : !performanceMetrics.hasShipperRatings
                          ? (
                              <span className="font-normal text-muted-foreground">
                                {t("dashboard.noRatingsReceived")}
                              </span>
                            )
                          : "—"}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{
                        width: `${
                          performanceMetrics.hasShipperRatings && performanceMetrics.communicationScore != null
                            ? (performanceMetrics.communicationScore / 5) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 sm:h-64">
                <Star className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/50 mb-4" />
                <p className="font-medium text-muted-foreground text-sm sm:text-base">{t("dashboard.performanceDataUnavailable")}</p>
                <p className="text-xs sm:text-sm text-muted-foreground text-center mt-1 px-4">
                  {t("dashboard.completeMoreTrips")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 sm:gap-4 pb-4">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.recommendedLoads")}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/carrier/loads")} data-testid="link-view-all-loads" className="shrink-0">
              <span className="hidden sm:inline">{t("dashboard.viewAll")} ({availableLoads.length})</span>
              <span className="sm:hidden">All ({availableLoads.length})</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {topRecommendedLoads.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">{t("dashboard.noRecommendedLoads")}</p>
            ) : (
              <div className="space-y-3">
                {topRecommendedLoads.map((load) => (
                  <div
                    key={load.loadId}
                    className="p-3 sm:p-4 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                    onClick={() => navigate("/carrier/loads")}
                    data-testid={`recommended-load-${load.loadId}`}
                  >
                    <div className="flex items-start sm:items-center justify-between mb-2 gap-2">
                      <span className="font-medium text-xs sm:text-sm line-clamp-1">{load.pickup} to {load.dropoff}</span>
                      <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate shrink-0 text-xs">
                        {load.loadType}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground gap-2 flex-wrap">
                      {load.distance != null && (
                        <span>{load.distance} km</span>
                      )}
                      {load.budget && <span className="font-semibold text-foreground">{formatCurrency(load.budget)}</span>}
                      {load.distance == null && !load.budget && <span>{t("dashboard.detailsPending")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 sm:gap-4 pb-4">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.activeTrips")}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/carrier/trips")} data-testid="link-view-all-trips" className="shrink-0">
              <span className="hidden sm:inline">{t("dashboard.viewAll")} ({activeTripsCount})</span>
              <span className="sm:hidden">All ({activeTripsCount})</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayTrips.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">{t("dashboard.noActiveTrips")}</p>
              ) : (
                displayTrips.map((trip) => (
                  <div
                    key={trip.tripId}
                    className="p-3 sm:p-4 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                    onClick={() => navigate("/carrier/trips")}
                    data-testid={`active-trip-${trip.tripId}`}
                  >
                    <div className="flex items-start sm:items-center justify-between mb-2 gap-2">
                      <span className="font-medium text-xs sm:text-sm line-clamp-1">{trip.pickup} to {trip.dropoff}</span>
                      {trip.eta && (
                        <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate shrink-0 text-xs">
                          ETA: {formatEta(trip.eta)}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      {trip.driverAssigned && (
                        <div className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{trip.driverAssigned}</span>
                        </div>
                      )}
                      {trip.truckAssigned && (
                        <div className="flex items-center gap-1 truncate">
                          <Truck className="h-3 w-3 shrink-0" />
                          <span className="truncate">{trip.truckAssigned}</span>
                        </div>
                      )}
                      {trip.totalDistance != null && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {trip.totalDistance} km
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                        {trip.loadType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{t("dashboard.inTransit")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 sm:gap-4 pb-4">
          <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-3 sm:py-4 flex-col gap-2"
              onClick={() => navigate("/carrier/loads")}
              data-testid="quick-action-find-loads"
            >
              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs">Find Loads</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 sm:py-4 flex-col gap-2"
              onClick={() => navigate("/carrier/bids")}
              data-testid="quick-action-manage-bids"
            >
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs">Manage Bids</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 sm:py-4 flex-col gap-2"
              onClick={() => navigate("/carrier/revenue")}
              data-testid="quick-action-revenue"
            >
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs">Revenue Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Verification Status Dialog */}
      <Dialog open={verificationDialogOpen} onOpenChange={(open) => {
        setVerificationDialogOpen(open);
        if (!open) {
          setHasNewVerificationUpdate(false);
        }
      }}>
        <DialogContent className={`${verification?.status === "approved" ? "max-w-md" : "max-w-2xl"} max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col`}>
          {verification?.status === "approved" ? (
            <>
              <DialogHeader className="text-center pb-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <ShieldCheck className="h-8 w-8 text-green-600" />
                </div>
                <DialogTitle className="text-2xl font-bold">
                  Welcome Aboard, {user?.companyName || user?.username || "Partner"}!
                </DialogTitle>
                <DialogDescription className="text-base pt-2">
                  Congratulations! Your carrier account has been verified. You can now bid on loads and start earning.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  onClick={() => {
                    setVerificationDialogOpen(false);
                    navigate("/carrier/my-documents");
                  }}
                  variant="outline"
                  data-testid="button-view-documents"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View My Documents
                </Button>
                <Button 
                  onClick={() => {
                    setVerificationDialogOpen(false);
                    navigate("/carrier/loads");
                  }}
                  data-testid="button-start-bidding"
                >
                  Start Bidding on Loads
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {verification?.status === "rejected" ? (
                    <ShieldX className="h-5 w-5 text-destructive" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-yellow-600" />
                  )}
                  Verification Status
                </DialogTitle>
                <DialogDescription>
                  {verification?.status === "rejected"
                    ? "Your verification was rejected. Please review the details below and resubmit."
                    : "Your verification is pending review by our team."}
                </DialogDescription>
              </DialogHeader>
              
              {verification && (
                <ScrollArea className="flex-1 max-h-[60vh] pr-4">
                  <div className="space-y-4">
                    {/* Overall Status */}
                    <Card className={
                      verification.status === "rejected" ? "border-destructive/50" :
                      "border-yellow-500/50"
                    }>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="font-semibold">Overall Status</h3>
                            <p className="text-sm text-muted-foreground">
                              {verification.updatedAt && `Last updated: ${format(new Date(verification.updatedAt), "MMM d, yyyy 'at' h:mm a")}`}
                            </p>
                          </div>
                          <Badge 
                            variant={
                              verification.status === "rejected" ? "destructive" :
                              "secondary"
                            }
                          >
                            {verification.status === "rejected" ? "Rejected" : "Pending Review"}
                          </Badge>
                        </div>
                        {verification.rejectionReason && (
                          <div className="mt-3 p-3 bg-destructive/10 rounded-md">
                            <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
                            <p className="text-sm text-muted-foreground">{verification.rejectionReason}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Documents List - only show for non-approved status */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Submitted Documents ({verification.documents?.length || 0})</CardTitle>
                        <CardDescription>Status of each document you submitted</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {(verification.documents || []).length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">No documents submitted yet</p>
                          ) : (
                            verification.documents?.map((doc) => (
                              <div 
                                key={doc.id} 
                                className={`flex items-center justify-between p-3 border rounded-lg ${
                                  doc.status === "approved" ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/20" :
                                  doc.status === "rejected" ? "border-destructive/30 bg-red-50/50 dark:bg-red-950/20" :
                                  ""
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">{getDocumentDisplayName(doc.documentType)}</p>
                                    <p className="text-sm text-muted-foreground">{doc.fileName}</p>
                                    {doc.uploadedAt && (
                                      <p className="text-xs text-muted-foreground">
                                        Uploaded {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {doc.status === "approved" ? (
                                    <Badge variant="default" className="bg-green-600">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Approved
                                    </Badge>
                                  ) : doc.status === "rejected" ? (
                                    <div className="text-right">
                                      <Badge variant="destructive">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Rejected
                                      </Badge>
                                      {doc.rejectionReason && (
                                        <p className="text-xs text-destructive mt-1">{doc.rejectionReason}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <Badge variant="secondary">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pending
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    {verification.status === "rejected" && (
                      <div className="flex justify-end">
                        <Button onClick={() => navigate("/carrier/verification")} data-testid="button-resubmit-verification">
                          Resubmit Documents
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
