import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Users, Package, Truck, DollarSign, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, RefreshCw, FileCheck, Loader2, MessageSquare, ArrowUpDown, Percent, Wallet, Activity, Zap, ClipboardList, UserCheck, ShieldCheck, Receipt, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TransactionVolumeChart } from "@/components/transaction-volume-chart";
import { 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useTheme } from "@/lib/theme-provider";
import { useLoads, useBids, useUsers, useCarriers, useInvoices } from "@/lib/api-hooks";
import { formatDistanceToNow } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Load } from "@shared/schema";

// Format load ID for display - shows LD-1001 (admin ref) or LD-023 (shipper seq)
function formatLoadId(load: { shipperLoadNumber?: number | null; adminReferenceNumber?: number | null; id: string }): string {
  if (load.adminReferenceNumber) {
    return `LD-${load.adminReferenceNumber}`;
  }
  if (load.shipperLoadNumber) {
    return `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`;
  }
  return load.id.slice(0, 8);
}

interface ClickableStatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
  href: string;
  testId: string;
}

function ClickableStatCard({ title, value, icon: Icon, trend, subtitle, href, testId }: ClickableStatCardProps) {
  const [, setLocation] = useLocation();
  
  return (
    <Card 
      className="cursor-pointer transition-all hover-elevate group"
      onClick={() => setLocation(href)}
      data-testid={testId}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
              <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground break-words">{title}</p>
              <p className="text-xl sm:text-2xl font-bold break-words">{value}</p>
              {trend && (
                <Badge 
                  variant="secondary" 
                  className={`mt-1 text-xs inline-flex ${trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                >
                  <TrendingUp className={`h-3 w-3 mr-1 ${!trend.isPositive ? "rotate-180" : ""}`} />
                  {trend.isPositive ? "+" : ""}{trend.value}%
                </Badge>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1 break-words">{subtitle}</p>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminOverview() {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { data: loads, isLoading: loadsLoading } = useLoads();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: carriers, isLoading: carriersLoading } = useCarriers();
  const { data: bids } = useBids();
  const { data: invoices } = useInvoices();

  // Calculate user growth data from actual database - MUST be before any early returns
  const userGrowthData = useMemo(() => {
    const allUsers = users || [];
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return {
        short: d.toLocaleString("en-IN", { month: "short" }),
        num: d.getMonth(),
        year: d.getFullYear(),
      };
    });

    return months.map(m => {
      const shippers = allUsers.filter((u: any) => {
        if (u.role !== 'shipper') return false;
        if (!u.createdAt) return false;
        const userDate = new Date(u.createdAt);
        return userDate.getFullYear() === m.year && userDate.getMonth() === m.num;
      }).length;

      const carriers = allUsers.filter((u: any) => {
        if (u.role !== 'carrier') return false;
        if (!u.createdAt) return false;
        const userDate = new Date(u.createdAt);
        return userDate.getFullYear() === m.year && userDate.getMonth() === m.num;
      }).length;

      return { month: m.short, shippers, carriers };
    });
  }, [users]);
  
  // Fetch pending tasks for Quick Actions
  const { data: onboardingStats } = useQuery<{
    total: number;
    pending: number;
    underReview: number;
    approved: number;
    rejected: number;
    onHold: number;
  }>({
    queryKey: ['/api/admin/onboarding-requests/stats'],
    retry: false,
    enabled: false, // Disable this query since the endpoint is not available
  });

  // Real-time analytics with auto-refresh every 10 seconds
  const { data: analytics } = useQuery<{
    negotiations: {
      activeLoads: number;
      pendingBids: number;
      counteredBids: number;
      acceptedBids: number;
      recentBids24h: number;
      recentCounters24h: number;
      directAccepts: number;
      negotiatedAccepts: number;
      negotiationRate: number;
    };
    profitMargin: {
      totalShipperAmount: number;
      totalCarrierPayout: number;
      totalPlatformMargin: number;
      avgMarginPercent: number;
      completedLoads: number;
      loadsWithMarginData: number;
    };
    today: {
      newBids: number;
      counterOffers: number;
      acceptedBids: number;
    };
    timestamp: string;
  }>({
    queryKey: ['/api/admin/analytics/realtime'],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    retry: false,
  });

  if (loadsLoading || usersLoading || carriersLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allLoads = loads || [];
  const allUsers = users || [];
  const allCarriers = carriers || [];
  const allBids = bids || [];
  const allInvoices = invoices || [];

  const chartAxisColor = theme === "dark" ? "hsl(220, 10%, 65%)" : "hsl(220, 12%, 35%)";
  const chartGridColor = theme === "dark" ? "hsl(220, 12%, 18%)" : "hsl(220, 12%, 92%)";

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/loads"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/carriers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/bids"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/shipments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/carriers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/queue"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/negotiations"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/realtime"] }),
      ]);
      toast({
        title: t("admin.syncData"),
        description: "Latest data was refreshed from the server.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast({
        title: t("common.error"),
        description: message || "Could not refresh data. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate active users (users who have logged in within last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeUsersCount = allUsers.filter((u: any) => {
    if (!u.lastActiveAt) return false;
    const lastActive = new Date(u.lastActiveAt);
    return lastActive >= thirtyDaysAgo;
  }).length;

  const activeStatusList = ['pending', 'priced', 'posted_to_carriers', 'open_for_bid', 'counter_received', 'awarded', 'invoice_created', 'invoice_sent', 'invoice_acknowledged', 'invoice_paid', 'in_transit'];
  const inTransitLoads = allLoads.filter((l: Load) => l.status === 'in_transit');
  const activeLoads = allLoads.filter((l: Load) => activeStatusList.includes(l.status || ''));
  const completedLoads = allLoads.filter((l: Load) => ['delivered', 'closed'].includes(l.status || ''));
  const pendingLoads = allLoads.filter((l: Load) => ['pending', 'priced'].includes(l.status || ''));

  const verifiedCarriers = allCarriers.filter(c => 
    (c.carrierProfile as any)?.verificationStatus === 'approved' || c.isVerified === true
  );
  
  // Calculate total spend from paid invoices
  const totalSpendFromInvoices = allInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + parseFloat(inv.totalAmount?.toString() || '0'), 0);
  
  // Calculate total volume from completed loads in current month (fallback if no paid invoices)
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const completedLoadsThisMonth = completedLoads.filter((load) => {
    if (!load.createdAt) return false;
    const loadDate = new Date(load.createdAt);
    return loadDate.getFullYear() === currentYear && loadDate.getMonth() === currentMonth;
  });
  
  const totalVolumeFromLoads = completedLoadsThisMonth.reduce((sum, load) => {
    // Use finalPrice (carrier payout) or adminFinalPrice as fallback
    const amount = load.finalPrice 
      ? parseFloat(load.finalPrice) 
      : load.adminFinalPrice 
      ? parseFloat(load.adminFinalPrice)
      : 0;
    return sum + amount;
  }, 0);
  
  // Use invoices if available, otherwise use loads
  const monthlyVolume = totalSpendFromInvoices > 0 ? totalSpendFromInvoices : totalVolumeFromLoads;

  const stats = {
    // Count only verified users (isVerified = true) - excluding unverified users
    totalUsers: allUsers.filter((u: any) => 
      ['shipper', 'carrier', 'admin'].includes(u.role) && u.isVerified === true
    ).length,
    activeLoads: allLoads.length,
    verifiedCarriers: verifiedCarriers.length,
    monthlyVolume,
    monthlyChange: 12,
  };

  const pendingVerifications = allCarriers.filter(c => {
    const status = (c.carrierProfile as any)?.verificationStatus;
    // Count carriers that are not yet verified (pending, under_review, or undefined status)
    return status !== 'approved' && status !== 'rejected' && c.isVerified !== true;
  }).length;

  const loadDistribution = [
    { name: t('common.completed'), value: completedLoads.length, color: "hsl(142, 76%, 36%)" },
    { name: t('loads.inTransit'), value: inTransitLoads.length, color: "hsl(217, 91%, 48%)" },
    { name: t('common.pending'), value: pendingLoads.length, color: "hsl(48, 96%, 53%)" },
  ];

  const recentActivity = allLoads.slice(0, 8).map((load: Load, i) => ({
    id: `activity-${i}`,
    type: 'load',
    message: `Load ${formatLoadId(load)} - ${load.pickupCity} to ${load.dropoffCity}`,
    timestamp: load.createdAt ? new Date(load.createdAt) : new Date(),
    severity: load.status === 'in_transit' ? 'info' : load.status === 'delivered' ? 'success' : 'warning',
  }));

  const getActivityIcon = (type: string, severity: string) => {
    if (severity === "warning") return <AlertTriangle className="h-4 w-4" />;
    if (severity === "success") return <CheckCircle className="h-4 w-4" />;
    if (severity === "error") return <AlertTriangle className="h-4 w-4" />;
    return type === "user" ? <Users className="h-4 w-4" /> : 
           type === "load" ? <Package className="h-4 w-4" /> :
           type === "carrier" ? <Truck className="h-4 w-4" /> :
           type === "document" ? <FileCheck className="h-4 w-4" /> :
           <DollarSign className="h-4 w-4" />;
  };

  const getActivityColor = (severity: string) => {
    switch (severity) {
      case "warning": return "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400";
      case "success": return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
      case "error": return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{t('admin.dashboard')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t('admin.dashboardDescription')}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => void handleRefresh()}
          disabled={isSyncing}
          data-testid="button-refresh-data"
          className="w-full sm:w-auto shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {t('admin.syncData')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ClickableStatCard
          title={t('admin.totalUsers')}
          value={stats.totalUsers.toLocaleString()}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
          href="/admin/users"
          testId="card-total-users"
        />
        <ClickableStatCard
          title={t('admin.activeLoads')}
          value={stats.activeLoads}
          icon={Package}
          trend={{ value: 8, isPositive: true }}
          href="/admin/loads"
          testId="card-active-loads"
        />
        <ClickableStatCard
          title={t('admin.verifiedCarriers')}
          value={stats.verifiedCarriers}
          icon={Truck}
          subtitle={allCarriers.length > 0 ? `${Math.round((stats.verifiedCarriers / allCarriers.length) * 100)}% ${t('admin.verificationRate')}` : `0% ${t('admin.verificationRate')}`}
          href="/admin/carriers"
          testId="card-verified-carriers"
        />
        <ClickableStatCard
          title={t('admin.monthlyVolume')}
          value={`Rs. ${(stats.monthlyVolume / 100000).toFixed(1)}L`}
          icon={DollarSign}
          trend={{ value: stats.monthlyChange, isPositive: stats.monthlyChange > 0 }}
          href="/admin/volume"
          testId="card-monthly-volume"
        />
      </div>

      {/* Quick Actions - Pending Tasks Section */}
      {((onboardingStats?.pending || 0) + (onboardingStats?.underReview || 0) + pendingVerifications + pendingLoads.length + (analytics?.negotiations.pendingBids || 0)) > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" data-testid="card-quick-actions">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ClipboardList className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <CardTitle className="text-sm sm:text-base truncate">Pending Tasks</CardTitle>
              </div>
              <Badge variant="secondary" className="self-start sm:self-auto">
                {(onboardingStats?.pending || 0) + (onboardingStats?.underReview || 0) + pendingVerifications + pendingLoads.length + (analytics?.negotiations.pendingBids || 0)} items
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {/* Shipper Onboarding */}
              {((onboardingStats?.pending || 0) + (onboardingStats?.underReview || 0)) > 0 && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg bg-background hover-elevate cursor-pointer border"
                  onClick={() => setLocation("/admin/onboarding")}
                  data-testid="action-shipper-onboarding"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                    <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Shipper Onboarding</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {onboardingStats?.pending || 0} pending, {onboardingStats?.underReview || 0} reviewing
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              )}

              {/* Carrier Verification */}
              {pendingVerifications > 0 && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg bg-background hover-elevate cursor-pointer border"
                  onClick={() => setLocation("/admin/verification")}
                  data-testid="action-carrier-verification"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                    <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Carrier Verification</p>
                    <p className="text-xs text-muted-foreground truncate">{pendingVerifications} awaiting review</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              )}

              {/* Load Pricing Queue */}
              {pendingLoads.length > 0 && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg bg-background hover-elevate cursor-pointer border"
                  onClick={() => setLocation("/admin/queue")}
                  data-testid="action-load-pricing"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                    <Receipt className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Price Loads</p>
                    <p className="text-xs text-muted-foreground truncate">{pendingLoads.length} loads to price</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              )}

              {/* Pending Bids */}
              {(analytics?.negotiations.pendingBids || 0) > 0 && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg bg-background hover-elevate cursor-pointer border"
                  onClick={() => setLocation("/admin/negotiations")}
                  data-testid="action-pending-bids"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                    <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Review Bids</p>
                    <p className="text-xs text-muted-foreground truncate">{analytics?.negotiations.pendingBids || 0} pending bids</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              )}

              {/* In-Transit Tracking */}
              {inTransitLoads.length > 0 && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg bg-background hover-elevate cursor-pointer border"
                  onClick={() => setLocation("/admin/live-tracking")}
                  data-testid="action-live-tracking"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30 shrink-0">
                    <MapPin className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Live Tracking</p>
                    <p className="text-xs text-muted-foreground truncate">{inTransitLoads.length} shipments in transit</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Analytics Section */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Negotiation Analytics Card */}
        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => setLocation("/admin/negotiations")}
          data-testid="card-negotiation-analytics"
        >
          <CardHeader className="pb-2 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                </div>
                <CardTitle className="text-sm sm:text-base truncate">Real-time Negotiations</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs flex items-center gap-1 self-start sm:self-auto">
                <Zap className="h-3 w-3" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {analytics?.negotiations.activeLoads || 0}
                </p>
                <p className="text-xs text-muted-foreground">Available For Bid</p>
              </div>
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {analytics?.negotiations.counteredBids || 0}
                </p>
                <p className="text-xs text-muted-foreground">Counter Offers</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground truncate">Pending Bids</span>
                <Badge variant="outline">{analytics?.negotiations.pendingBids || 0}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground truncate">Accepted Today</span>
                <Badge className="bg-green-600">{analytics?.today.acceptedBids || 0}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground truncate">Negotiation Rate</span>
                <Badge variant="secondary">{(analytics?.negotiations.negotiationRate || 0).toFixed(1)}%</Badge>
              </div>
            </div>

            <div className="border-t pt-3 mt-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 truncate">
                  <Activity className="h-3 w-3 shrink-0" />
                  Last 24h: {analytics?.negotiations.recentBids24h || 0} bids
                </span>
                <span className="truncate">{analytics?.negotiations.recentCounters24h || 0} counters</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit Margin Analytics Card */}
        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => setLocation("/admin/volume")}
          data-testid="card-profit-margin-analytics"
        >
          <CardHeader className="pb-2 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                  <Percent className="h-4 w-4 text-green-500" />
                </div>
                <CardTitle className="text-sm sm:text-base truncate">Real-time Profit Margin</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs flex items-center gap-1 self-start sm:self-auto">
                <Zap className="h-3 w-3" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {(analytics?.profitMargin.avgMarginPercent || 0).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Margin</p>
              </div>
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold truncate">
                  ₹{((analytics?.profitMargin.totalPlatformMargin || 0) / 100000).toFixed(2)}L
                </p>
                <p className="text-xs text-muted-foreground">Total Margin</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground flex items-center gap-1 truncate">
                  <ArrowUpDown className="h-3 w-3 shrink-0" />
                  Shipper Amount
                </span>
                <span className="font-medium truncate">₹{((analytics?.profitMargin.totalShipperAmount || 0) / 100000).toFixed(2)}L</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground flex items-center gap-1 truncate">
                  <Wallet className="h-3 w-3 shrink-0" />
                  Carrier Payout
                </span>
                <span className="font-medium truncate">₹{((analytics?.profitMargin.totalCarrierPayout || 0) / 100000).toFixed(2)}L</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground truncate">Completed Loads</span>
                <Badge variant="outline">{analytics?.profitMargin.completedLoads || 0}</Badge>
              </div>
            </div>

            <div className="border-t pt-3 mt-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground">
                <span className="truncate">Loads with margin data: {analytics?.profitMargin.loadsWithMarginData || 0}</span>
                <span className="truncate">
                  Updated: {analytics?.timestamp ? new Date(analytics.timestamp).toLocaleTimeString() : '--:--'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        <TransactionVolumeChart loads={allLoads} invoices={allInvoices} />

        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => setLocation("/admin/loads")}
          data-testid="card-load-status"
        >
          <CardHeader className="pb-4 px-4 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg truncate">{t('dashboard.loadStatusDistribution')}</CardTitle>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="h-40 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={loadDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {loadDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "hsl(220, 14%, 10%)" : "hsl(0, 0%, 100%)",
                      border: `1px solid ${chartGridColor}`,
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {loadDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-medium shrink-0 ml-2">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => setLocation("/admin/users")}
          data-testid="card-user-growth"
        >
          <CardHeader className="pb-4 px-4 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg truncate">{t('dashboard.userGrowth')}</CardTitle>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={userGrowthData}
                  margin={{ top: 10, right: 5, left: 0, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartAxisColor, fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartAxisColor, fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "hsl(220, 14%, 10%)" : "hsl(0, 0%, 100%)",
                      border: `1px solid ${chartGridColor}`,
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="shippers" fill="hsl(217, 91%, 48%)" radius={[4, 4, 0, 0]} name="Shippers" />
                  <Bar dataKey="carriers" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Carriers" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-recent-activity">
          <CardHeader className="pb-4 px-4 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg truncate">{t('dashboard.recentActivity')}</CardTitle>
              <Badge variant="secondary" className="text-xs shrink-0">
                {t('dashboard.live')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="space-y-3 sm:space-y-4 max-h-60 sm:max-h-72 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">{t('dashboard.noRecentActivity')}</p>
              ) : (
                recentActivity.map((activity) => (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-2 sm:gap-3 cursor-pointer p-2 -mx-2 rounded-lg hover-elevate"
                    onClick={() => {
                      if (activity.type === "user") setLocation("/admin/users");
                      else if (activity.type === "load") setLocation("/admin/loads");
                      else if (activity.type === "carrier") setLocation("/admin/carriers");
                      else if (activity.type === "document") setLocation("/admin/verification");
                      else setLocation("/admin/volume");
                    }}
                    data-testid={`activity-${activity.id}`}
                  >
                    <div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full flex-shrink-0 ${getActivityColor(activity.severity)}`}>
                      {getActivityIcon(activity.type, activity.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm line-clamp-2">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => setLocation("/admin/users")}
          data-testid="card-user-breakdown"
        >
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base truncate">{t('dashboard.userBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('roles.shipper')}</span>
                <span className="font-medium text-sm sm:text-base shrink-0 ml-2">{allUsers.filter((u: any) => u.role === "shipper").length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('roles.carrier')}</span>
                <span className="font-medium text-sm sm:text-base shrink-0 ml-2">{allUsers.filter((u: any) => u.role === "carrier").length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('roles.admin')}</span>
                <span className="font-medium text-sm sm:text-base shrink-0 ml-2">{allUsers.filter((u: any) => u.role === "admin").length}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium truncate">{t('admin.totalVerifiedUsers')}</span>
                  <Badge variant="secondary" className="shrink-0 ml-2">{stats.totalUsers}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => setLocation("/admin/carriers")}
          data-testid="card-carrier-status"
        >
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base truncate">{t('dashboard.carrierStatus')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('admin.verified')}</span>
                <Badge className="bg-green-600 shrink-0 ml-2">{verifiedCarriers.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('common.pending')}</span>
                <Badge variant="secondary" className="shrink-0 ml-2">{pendingVerifications}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('admin.totalCarriers')}</span>
                <span className="font-medium text-sm sm:text-base shrink-0 ml-2">{allCarriers.length}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium truncate">{t('admin.avgRating')}</span>
                  <Badge variant="secondary" className="shrink-0 ml-2">
                    {allCarriers.length > 0 
                      ? (allCarriers.reduce((sum: number, c: any) => sum + parseFloat(String(c.profile?.rating || 4.5)), 0) / allCarriers.length).toFixed(1)
                      : '0.0'
                    }
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => setLocation("/admin/loads")}
          data-testid="card-load-summary"
        >
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base truncate">{t('dashboard.loadSummary')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('admin.totalLoads')}</span>
                <span className="font-medium text-sm sm:text-base shrink-0 ml-2">{allLoads.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('admin.activeBids')}</span>
                <span className="font-medium text-sm sm:text-base shrink-0 ml-2">{allBids.filter((b: any) => b.status === 'pending').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{t('loads.inTransit')}</span>
                <Badge className="bg-blue-600 shrink-0 ml-2">{inTransitLoads.length}</Badge>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium truncate">{t('admin.totalVolume')}</span>
                  <Badge variant="secondary" className="shrink-0 ml-2 text-xs">
                    Rs. {(allLoads.reduce((sum: number, l: Load) => sum + parseFloat(l.adminFinalPrice || l.finalPrice || '0'), 0) / 100000).toFixed(1)}L
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

