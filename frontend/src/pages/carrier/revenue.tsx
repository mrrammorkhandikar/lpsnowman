import { useMemo } from "react";
import { useLocation } from "wouter";
import { 
  TrendingUp, DollarSign, Truck, User, MapPin, Building2, 
  ArrowUpRight, ArrowDownRight, BarChart3, PieChart as PieChartIcon,
  Clock, CheckCircle2, AlertCircle, Wallet, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import { useShipments, useLoads, useSettlementsByCarrier, useDrivers, useTrucks } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-context";
import { deriveRegion, buildRegionMetrics } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval, parseISO } from "date-fns";
import type { Shipment, Load } from "@shared/schema";

function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Rs. 0';
  }
  if (amount >= 10000000) {
    return `Rs. ${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `Rs. ${(amount / 100000).toFixed(1)}L`;
  }
  return `Rs. ${amount.toLocaleString()}`;
}

function formatCurrencyPrecise(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Rs. 0';
  }
  // Show exact value with 2 decimal places
  return `Rs. ${amount.toFixed(2)}`;
}

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

export default function CarrierRevenuePage() {
  const [, setLocation] = useLocation();
  const { user, carrierType } = useAuth();
  const { data: allShipments = [] } = useShipments();
  const { data: allLoads = [] } = useLoads();
  const { data: allSettlements } = useSettlementsByCarrier();
  const { data: allDrivers = [] } = useDrivers();
  const { data: allTrucks = [] } = useTrucks();
  
  const isSoloDriver = carrierType === "solo";
  
  // Calculate real revenue from settlements and shipments
  const realRevenueData = useMemo(() => {
    // Get only delivered shipments for revenue calculation
    const myShipments = allShipments.filter((s: Shipment) => 
      s.carrierId === user?.id && s.status === 'delivered'
    );
    
    const carrierSettlements = Array.isArray(allSettlements) 
      ? allSettlements.filter((s: any) => s.carrierId === user?.id && s.status === 'paid')
      : [];
    
    // Calculate total real revenue from paid settlements
    const totalRealRevenue = carrierSettlements.reduce((sum: number, s: any) => 
      sum + parseFloat(s.carrierPayoutAmount?.toString() || '0'), 0
    );
    
    // Calculate revenue from delivered shipments (fallback if no settlements)
    const shipmentRevenue = myShipments.reduce((sum: number, s: Shipment) => {
      const load = allLoads.find((l: Load) => l.id === s.loadId);
      // finalPrice is the full carrier payout amount
      return sum + (load?.finalPrice ? parseFloat(load.finalPrice) : 0);
    }, 0);

    // Calculate revenue by region from DELIVERED shipments only (matches Trip History)
    // Includes both pickup and dropoff regions for comprehensive view
    const { revenueByRegion } = buildRegionMetrics(
      myShipments.map(s => ({ loadId: s.loadId, status: s.status || '' })),
      allLoads.map(l => ({ 
        id: l.id, 
        pickupCity: (l as any).pickupCity, 
        dropoffCity: (l as any).dropoffCity, 
        finalPrice: l.finalPrice 
      })),
      ['delivered']
    );

    // Calculate revenue by truck from shipments with truck assignments
    const truckRevenueMap: Record<string, { 
      truckId: string; 
      plate: string; 
      truckType: string;
      revenue: number; 
      trips: number;
    }> = {};
    
    myShipments.forEach((s: Shipment) => {
      const load = allLoads.find((l: Load) => l.id === s.loadId);
      const truckId = s.truckId;
      if (load && truckId) {
        const truck = allTrucks.find((t: any) => t.id === truckId);
        // finalPrice is the full carrier payout amount
        const tripRevenue = load.finalPrice ? parseFloat(load.finalPrice) : 0;
        
        if (!truckRevenueMap[truckId]) {
          truckRevenueMap[truckId] = {
            truckId,
            plate: truck?.registrationNumber || truck?.licensePlate || 'Unknown',
            truckType: truck?.truckType || (load as any).requiredTruckType || 'Unknown',
            revenue: 0,
            trips: 0
          };
        }
        truckRevenueMap[truckId].revenue += tripRevenue;
        truckRevenueMap[truckId].trips += 1;
      }
    });

    // Best performing trucks - sorted by revenue
    const bestPerformingTrucks = Object.values(truckRevenueMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(t => ({
        truckId: t.truckId,
        plate: t.plate,
        revenue: t.revenue,
        trips: t.trips
      }));

    // Calculate revenue by truck type from actual load data
    const truckTypeRevenueMap: Record<string, { truckType: string; revenue: number; trips: number }> = {};
    myShipments.forEach((s: Shipment) => {
      const load = allLoads.find((l: Load) => l.id === s.loadId);
      if (load) {
        const truckType = (load as any).requiredTruckType || 'Unknown';
        // finalPrice is the full carrier payout amount
        const tripRevenue = load.finalPrice ? parseFloat(load.finalPrice) : 0;
        
        if (!truckTypeRevenueMap[truckType]) {
          truckTypeRevenueMap[truckType] = { truckType, revenue: 0, trips: 0 };
        }
        truckTypeRevenueMap[truckType].revenue += tripRevenue;
        truckTypeRevenueMap[truckType].trips += 1;
      }
    });

    const revenueByTruckType = Object.values(truckTypeRevenueMap)
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate monthly reports from shipments for solo drivers
    const monthlyRevenueMap: Record<string, { revenue: number; trips: number }> = {};
    myShipments.forEach((s: Shipment) => {
      const load = allLoads.find((l: Load) => l.id === s.loadId);
      if (load) {
        // Group by month (e.g., "Jan 2026") - use completedAt for delivery date
        const completedDate = s.completedAt ? new Date(s.completedAt) : new Date();
        const monthKey = format(completedDate, 'MMM yyyy');
        // finalPrice is the full carrier payout amount
        const tripRevenue = load.finalPrice ? parseFloat(load.finalPrice) : 0;
        if (!monthlyRevenueMap[monthKey]) {
          monthlyRevenueMap[monthKey] = { revenue: 0, trips: 0 };
        }
        monthlyRevenueMap[monthKey].revenue += tripRevenue;
        monthlyRevenueMap[monthKey].trips += 1;
      }
    });
    const monthlyReports = Object.entries(monthlyRevenueMap)
      .map(([month, data]) => ({
        month,
        totalRevenue: data.revenue,
        tripsCompleted: data.trips,
        profitMargin: 25 // Approximate profit margin
      }))
      .sort((a, b) => {
        // Sort by date
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      });

    // Calculate top shippers from delivered shipments
    const shipperRevenueMap: Record<string, { 
      shipperId: string; 
      shipperName: string; 
      revenue: number; 
      loads: number;
      lastDelivery: Date;
    }> = {};
    
    myShipments.forEach((s: Shipment) => {
      const load = allLoads.find((l: Load) => l.id === s.loadId);
      if (load) {
        const shipperId = (load as any).shipperId || 'unknown';
        const shipperName = (load as any).shipperCompanyName || (load as any).shipperContactName || 'Unknown Shipper';
        // finalPrice is the full carrier payout amount
        const tripRevenue = load.finalPrice ? parseFloat(load.finalPrice) : 0;
        const completedAt = s.completedAt ? new Date(s.completedAt) : new Date();
        
        if (!shipperRevenueMap[shipperId]) {
          shipperRevenueMap[shipperId] = {
            shipperId,
            shipperName,
            revenue: 0,
            loads: 0,
            lastDelivery: completedAt
          };
        }
        shipperRevenueMap[shipperId].revenue += tripRevenue;
        shipperRevenueMap[shipperId].loads += 1;
        if (completedAt > shipperRevenueMap[shipperId].lastDelivery) {
          shipperRevenueMap[shipperId].lastDelivery = completedAt;
        }
      }
    });

    const topShippers = Object.values(shipperRevenueMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map((shipper, idx) => ({
        shipperId: shipper.shipperId,
        shipperName: shipper.shipperName,
        totalRevenue: shipper.revenue,
        loadsCompleted: shipper.loads,
        avgRevenuePerLoad: shipper.loads > 0 ? shipper.revenue / shipper.loads : 0,
        lastLoadDate: format(shipper.lastDelivery, 'MMM dd, yyyy'),
        reliabilityScore: 95 // Default score for completed loads
      }));

    // Calculate revenue by driver from delivered shipments with assigned drivers
    const driverRevenueMap: Record<string, { 
      driverId: string; 
      driverName: string; 
      revenue: number; 
      trips: number;
    }> = {};
    
    myShipments.forEach((s: Shipment) => {
      const load = allLoads.find((l: Load) => l.id === s.loadId);
      const shipmentDriverId = s.driverId;
      if (load && shipmentDriverId) {
        const driver = allDrivers.find(d => d.id === shipmentDriverId);
        const driverName = driver?.name || 'Unknown Driver';
        // finalPrice is the full carrier payout amount
        const tripRevenue = load.finalPrice ? parseFloat(load.finalPrice) : 0;
        
        if (!driverRevenueMap[shipmentDriverId]) {
          const driverIndex = allDrivers.findIndex((d: any) => d.id === shipmentDriverId);
          const formattedDriverId = driverIndex >= 0 ? `DR-${String(driverIndex + 1).padStart(3, '0')}` : `DR-???`;
          driverRevenueMap[shipmentDriverId] = {
            driverId: formattedDriverId,
            driverName,
            revenue: 0,
            trips: 0
          };
        }
        driverRevenueMap[shipmentDriverId].revenue += tripRevenue;
        driverRevenueMap[shipmentDriverId].trips += 1;
      }
    });

    const revenueByDriver = Object.values(driverRevenueMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map((driver) => ({
        driverId: driver.driverId,
        driverName: driver.driverName,
        revenue: driver.revenue,
        trips: driver.trips,
        avgPerTrip: driver.trips > 0 ? Math.round(driver.revenue / driver.trips) : 0,
        safetyScore: 85 // Default safety score - can be enhanced with actual driver data
      }));
    
    // Calculate payment status from settlements
    const allCarrierSettlements = Array.isArray(allSettlements) ? allSettlements : [];
    
    const paidSettlements = allCarrierSettlements.filter((s: any) => s.status === 'paid');
    const pendingSettlements = allCarrierSettlements.filter((s: any) => s.status === 'pending');
    
    const completedPayouts = paidSettlements.length > 0
      ? paidSettlements.reduce((sum: number, s: any) => 
          sum + parseFloat(s.netPayout?.toString() || '0'), 0)
      : shipmentRevenue; // fallback: use delivered shipment revenue if no settlements exist
    
    const pendingPayouts = pendingSettlements.reduce((sum: number, s: any) => 
      sum + parseFloat(s.netPayout?.toString() || '0'), 0
    );
    
    return {
      totalRevenue: totalRealRevenue || shipmentRevenue,
      completedTripsCount: myShipments.length,
      hasRealData: myShipments.length > 0 || carrierSettlements.length > 0,
      completedPayouts,
      pendingPayouts,
      revenueByRegion,
      revenueByTruckType,
      bestPerformingTrucks,
      monthlyReports,
      topShippers,
      revenueByDriver
    };
  }, [allShipments, allLoads, allSettlements, allDrivers, allTrucks, user?.id]);
  
  // Only show real data - no mock/demo data for any carrier type
  const analytics = useMemo(() => {
    return {
      totalRevenue: realRevenueData.totalRevenue,
      monthlyReports: realRevenueData.monthlyReports,
      revenueByTruckType: realRevenueData.revenueByTruckType,
      revenueByDriver: isSoloDriver ? [] : realRevenueData.revenueByDriver,
      revenueByRegion: realRevenueData.revenueByRegion,
      topShippers: realRevenueData.topShippers,
      bestPerformingTrucks: isSoloDriver ? [] : realRevenueData.bestPerformingTrucks,
      bidWinRatio: 0,
      loadAcceptanceRate: 0,
      avgRevenuePerTrip: realRevenueData.completedTripsCount > 0 
        ? Math.round(realRevenueData.totalRevenue / realRevenueData.completedTripsCount)
        : 0,
      yoyGrowth: 0,
    };
  }, [realRevenueData, isSoloDriver]);
  
  const completedTrips = realRevenueData.completedTripsCount;

  const monthlyChartData = analytics.monthlyReports.map(m => ({
    name: m.month,
    revenue: m.totalRevenue,
    profit: m.totalRevenue * (m.profitMargin / 100),
    trips: m.tripsCompleted
  }));

  // Create daily revenue trend data (stock-market style) from actual shipments and mock data
  const dailyRevenueData = useMemo(() => {
    // Get delivered shipments for this carrier
    const myDeliveredShipments = allShipments.filter((s: Shipment) => 
      s.carrierId === user?.id && s.status === 'delivered' && s.completedAt
    );

    // Create date range for last 30 days
    const today = startOfDay(new Date());
    const thirtyDaysAgo = subDays(today, 30);
    const dateRange = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

    // Map revenue to each day
    const dailyRevenue: { [key: string]: number } = {};
    dateRange.forEach(date => {
      dailyRevenue[format(date, 'yyyy-MM-dd')] = 0;
    });

    // Accumulate revenue from real shipments by completion date
    myDeliveredShipments.forEach((shipment: Shipment) => {
      if (!shipment.completedAt) return;
      const completedDate = format(new Date(shipment.completedAt), 'yyyy-MM-dd');
      const load = allLoads.find((l: Load) => l.id === shipment.loadId);
      // finalPrice is the full carrier payout amount
      const revenue = load?.finalPrice ? parseFloat(load.finalPrice) : 0;
      
      if (dailyRevenue[completedDate] !== undefined) {
        dailyRevenue[completedDate] += revenue;
      }
    });

    // Calculate cumulative revenue and format for chart
    let cumulativeRevenue = 0;
    let prevCumulative = 0;
    const chartData = dateRange.map((date, index) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const dayRevenue = dailyRevenue[dateKey];
      prevCumulative = cumulativeRevenue;
      cumulativeRevenue += dayRevenue;
      
      return {
        date: format(date, 'MMM dd'),
        fullDate: format(date, 'MMM dd, yyyy'),
        day: format(date, 'dd'),
        dayRevenue,
        cumulative: cumulativeRevenue,
        change: cumulativeRevenue - prevCumulative,
        hasRevenue: dayRevenue > 0
      };
    });

    // Calculate total and average for metrics
    const totalRevenue = cumulativeRevenue;
    const avgDailyRevenue = totalRevenue / dateRange.length;
    const maxDailyRevenue = Math.max(...Object.values(dailyRevenue));
    const daysWithRevenue = Object.values(dailyRevenue).filter(r => r > 0).length;
    
    // Calculate week-over-week change
    const last7Days = chartData.slice(-7);
    const prev7Days = chartData.slice(-14, -7);
    const last7Revenue = last7Days.reduce((sum, d) => sum + d.dayRevenue, 0);
    const prev7Revenue = prev7Days.reduce((sum, d) => sum + d.dayRevenue, 0);
    const weeklyChange = prev7Revenue > 0 
      ? ((last7Revenue - prev7Revenue) / prev7Revenue) * 100 
      : (last7Revenue > 0 ? 100 : 0);

    return {
      chartData,
      totalRevenue,
      avgDailyRevenue,
      maxDailyRevenue,
      daysWithRevenue,
      weeklyChange,
      last7Revenue,
      prev7Revenue
    };
  }, [allShipments, allLoads, user?.id]);

  const truckTypeChartData = analytics.revenueByTruckType.map((t, i) => ({
    name: t.truckType,
    value: t.revenue,
    trips: t.trips,
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));

  const regionChartData = analytics.revenueByRegion.map((r, i) => ({
    name: r.region,
    revenue: r.revenue,
    trips: r.trips,
    growth: r.growth,
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-revenue-title">Revenue Analytics</h1>
          <p className="text-sm sm:text-base text-muted-foreground truncate">
            Financial performance from {completedTrips} completed trips
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(analytics.totalRevenue)}
          icon={DollarSign}
          subtitle="All time"
          trend={{ value: analytics.yoyGrowth, isPositive: analytics.yoyGrowth > 0 }}
          testId="stat-total-revenue"
        />
        <StatCard
          title="Avg per Trip"
          value={formatCurrency(analytics.avgRevenuePerTrip)}
          icon={TrendingUp}
          subtitle="Revenue per load"
          testId="stat-avg-per-trip"
        />
        <StatCard
          title="Bid Win Rate"
          value={`${analytics.bidWinRatio}%`}
          icon={BarChart3}
          subtitle="Accepted bids"
          testId="stat-win-rate"
        />
        <StatCard
          title="YoY Growth"
          value={`${analytics.yoyGrowth > 0 ? "+" : ""}${analytics.yoyGrowth}%`}
          icon={analytics.yoyGrowth > 0 ? ArrowUpRight : ArrowDownRight}
          subtitle="vs last year"
          testId="stat-yoy-growth"
        />
      </div>

      <Tabs defaultValue={isSoloDriver ? "earnings" : "overview"} className="space-y-3 sm:space-y-4">
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-hide">
          <TabsList className="w-full sm:w-auto inline-flex justify-start border-b gap-1 min-w-max">
            {isSoloDriver ? (
              <>
                <TabsTrigger value="earnings" data-testid="tab-earnings" className="text-xs sm:text-sm whitespace-nowrap">My Earnings</TabsTrigger>
                <TabsTrigger value="deductions" data-testid="tab-deductions" className="text-xs sm:text-sm whitespace-nowrap">Deductions</TabsTrigger>
                <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm whitespace-nowrap">Trends</TabsTrigger>
                <TabsTrigger value="shippers" data-testid="tab-shippers" className="text-xs sm:text-sm whitespace-nowrap">Top Shippers</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm whitespace-nowrap">Overview</TabsTrigger>
                <TabsTrigger value="deductions" data-testid="tab-deductions" className="text-xs sm:text-sm whitespace-nowrap">Deductions</TabsTrigger>
                <TabsTrigger value="breakdown" data-testid="tab-breakdown" className="text-xs sm:text-sm whitespace-nowrap">Breakdown</TabsTrigger>
                <TabsTrigger value="drivers" data-testid="tab-drivers" className="text-xs sm:text-sm whitespace-nowrap">By Driver</TabsTrigger>
                <TabsTrigger value="shippers" data-testid="tab-shippers" className="text-xs sm:text-sm whitespace-nowrap">Top Shippers</TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        {/* Solo Driver Cash Flow View */}
        {isSoloDriver && (
          <TabsContent value="earnings" className="space-y-4 sm:space-y-6">
            {completedTrips === 0 ? (
              /* Empty state for solo drivers with no completed trips */
              <Card>
                <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                  <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                    <div className="p-3 sm:p-4 rounded-full bg-muted mb-3 sm:mb-4">
                      <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold mb-2">No earnings yet</h3>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-md px-4">
                      Complete trips to start earning revenue. Your earnings, payouts, and trip history will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <Card>
                    <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10 flex-shrink-0">
                          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Completed Payouts</p>
                          <p className="text-base sm:text-xl font-bold text-green-600 truncate" data-testid="text-completed-payouts">
                            {formatCurrency(realRevenueData.completedPayouts)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 flex-shrink-0">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Pending Payments</p>
                          <p className="text-base sm:text-xl font-bold text-amber-600 truncate" data-testid="text-pending-payments">
                            {formatCurrency(realRevenueData.pendingPayouts)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                          <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Total Earnings</p>
                          <p className="text-base sm:text-xl font-bold text-primary truncate" data-testid="text-net-earnings">
                            {formatCurrency(analytics.totalRevenue)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                    <CardTitle className="text-base sm:text-lg">Recent Trip Payouts</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Your per-trip earnings breakdown</CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <ScrollArea className="h-[300px] sm:h-[400px]">
                      <div className="space-y-2 sm:space-y-3">
                        {(() => {
                          // Get delivered shipments with their load data
                          const deliveredShipments = allShipments
                            .filter((s: Shipment) => s.carrierId === user?.id && s.status === 'delivered')
                            .slice(0, 10);
                          
                          if (deliveredShipments.length === 0) {
                            return (
                              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                                <Truck className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm sm:text-base">No completed trips yet</p>
                                <p className="text-xs sm:text-sm">Complete deliveries to see your earnings</p>
                              </div>
                            );
                          }
                          
                          return deliveredShipments.map((shipment: Shipment, idx: number) => {
                            const load = allLoads.find((l: Load) => l.id === shipment.loadId);
                            // finalPrice is already the carrier payout (full amount carrier receives)
                            const carrierPayout = load?.finalPrice ? parseFloat(load.finalPrice) : 0;
                            // Platform fee is not deducted from carrier payout - it's charged separately to shipper
                            const route = load 
                              ? `${(load as any).pickupCity || 'Origin'} to ${(load as any).dropoffCity || 'Destination'}`
                              : 'Route details unavailable';
                            const completedDate = shipment.completedAt 
                              ? format(new Date(shipment.completedAt), 'MMM dd, yyyy')
                              : 'Recently';
                            
                            return (
                              <div key={shipment.id} className="p-2.5 sm:p-4 rounded-lg bg-muted/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4" data-testid={`trip-payout-${idx}`}>
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                  <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                                    <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-xs sm:text-sm truncate">{route}</p>
                                    <p className="text-xs text-muted-foreground">{completedDate}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-4 justify-end sm:justify-start">
                                  <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Payout</p>
                                    <p className="font-bold text-sm sm:text-base text-green-600">{formatCurrency(carrierPayout)}</p>
                                  </div>
                                  <Badge variant="default" className="text-xs">Paid</Badge>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}

        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card className="col-span-full">
              <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg">Revenue Performance</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">30-day cumulative earnings trend</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6 flex-wrap text-xs sm:text-sm">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-muted-foreground">This Week</p>
                      <p className="text-base sm:text-lg font-bold">{formatCurrency(dailyRevenueData.last7Revenue)}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-muted-foreground">Week Change</p>
                      <div className="flex items-center gap-1">
                        {dailyRevenueData.weeklyChange >= 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
                        )}
                        <span className={`text-base sm:text-lg font-bold ${dailyRevenueData.weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {dailyRevenueData.weeklyChange >= 0 ? '+' : ''}{dailyRevenueData.weeklyChange.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-muted-foreground">Avg Daily</p>
                      <p className="text-base sm:text-lg font-bold">{formatCurrency(dailyRevenueData.avgDailyRevenue)}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {dailyRevenueData.totalRevenue > 0 ? (
                  <div className="space-y-4">
                    {/* Main cumulative chart - stock market style */}
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyRevenueData.chartData}>
                          <defs>
                            <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10 }} 
                            tickLine={false}
                            axisLine={false}
                            interval={4}
                          />
                          <YAxis 
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}K`}
                            tickLine={false}
                            axisLine={false}
                            width={50}
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-card border rounded-lg shadow-lg p-3 min-w-[180px]">
                                    <p className="font-medium text-sm mb-2">{data.fullDate}</p>
                                    <div className="space-y-1">
                                      <div className="flex justify-between gap-4">
                                        <span className="text-xs text-muted-foreground">Total Earnings</span>
                                        <span className="text-sm font-bold text-primary">{formatCurrency(data.cumulative)}</span>
                                      </div>
                                      {data.dayRevenue > 0 && (
                                        <div className="flex justify-between gap-4">
                                          <span className="text-xs text-muted-foreground">Day Revenue</span>
                                          <span className="text-sm font-semibold text-green-600">+{formatCurrency(data.dayRevenue)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <ReferenceLine 
                            y={dailyRevenueData.avgDailyRevenue * 30} 
                            stroke="#F59E0B" 
                            strokeDasharray="5 5" 
                            label={{ 
                              value: 'Avg', 
                              position: 'right', 
                              fontSize: 10,
                              fill: '#F59E0B'
                            }} 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="cumulative" 
                            stroke="#3B82F6" 
                            strokeWidth={2}
                            fill="url(#cumulativeGradient)"
                            dot={false}
                            activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Daily revenue bars - shows individual trip days */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Daily Trip Revenue</p>
                      <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyRevenueData.chartData}>
                            <XAxis dataKey="day" hide />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  if (data.dayRevenue === 0) return null;
                                  return (
                                    <div className="bg-card border rounded-lg shadow-lg p-2">
                                      <p className="text-xs font-medium">{data.fullDate}</p>
                                      <p className="text-sm font-bold text-green-600">{formatCurrency(data.dayRevenue)}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar 
                              dataKey="dayRevenue" 
                              fill="#10B981"
                              radius={[2, 2, 0, 0]}
                              opacity={0.8}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-2 border-t">
                      <div className="text-center p-1.5 sm:p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">30-Day Total</p>
                        <p className="font-bold text-xs sm:text-sm text-primary truncate">{formatCurrency(dailyRevenueData.totalRevenue)}</p>
                      </div>
                      <div className="text-center p-1.5 sm:p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Active Days</p>
                        <p className="font-bold text-xs sm:text-sm">{dailyRevenueData.daysWithRevenue} days</p>
                      </div>
                      <div className="text-center p-1.5 sm:p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Best Day</p>
                        <p className="font-bold text-xs sm:text-sm text-green-600 truncate">{formatCurrency(dailyRevenueData.maxDailyRevenue)}</p>
                      </div>
                      <div className="text-center p-1.5 sm:p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Last Week</p>
                        <p className="font-bold text-xs sm:text-sm truncate">{formatCurrency(dailyRevenueData.prev7Revenue)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-60 sm:h-80 flex items-center justify-center">
                    <div className="text-center text-muted-foreground px-4">
                      <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm sm:text-base">No revenue data yet</p>
                      <p className="text-xs sm:text-sm">Complete trips to see earnings trends</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg">Trip Activity</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Daily trip completions over 30 days</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6 flex-wrap text-xs sm:text-sm">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-muted-foreground">Total Trips</p>
                      <p className="text-base sm:text-lg font-bold text-primary">{dailyRevenueData.daysWithRevenue}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-muted-foreground">This Week</p>
                      <p className="text-base sm:text-lg font-bold">
                        {dailyRevenueData.chartData.slice(-7).filter(d => d.hasRevenue).length}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-muted-foreground">Avg/Week</p>
                      <p className="text-base sm:text-lg font-bold">
                        {(dailyRevenueData.daysWithRevenue / 4.3).toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {dailyRevenueData.daysWithRevenue > 0 ? (
                  <div className="space-y-4">
                    {/* Trip timeline - showing each day */}
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyRevenueData.chartData}>
                          <defs>
                            <linearGradient id="tripGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1}/>
                              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.6}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10 }} 
                            tickLine={false}
                            axisLine={false}
                            interval={4}
                          />
                          <YAxis 
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            width={30}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-card border rounded-lg shadow-lg p-3">
                                    <p className="font-medium text-sm mb-1">{data.fullDate}</p>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                                      <span className="text-sm">
                                        {data.hasRevenue ? 'Trip Completed' : 'No trips'}
                                      </span>
                                    </div>
                                    {data.dayRevenue > 0 && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Earned: {formatCurrency(data.dayRevenue)}
                                      </p>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey={(d) => d.hasRevenue ? 1 : 0}
                            name="Trips"
                            fill="url(#tripGradient)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Weekly breakdown */}
                    <div className="border-t pt-4">
                      <p className="text-xs text-muted-foreground mb-3">Weekly Summary</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[0, 1, 2, 3].map(weekIdx => {
                          const weekStart = weekIdx * 7;
                          const weekData = dailyRevenueData.chartData.slice(weekStart, weekStart + 7);
                          const weekTrips = weekData.filter(d => d.hasRevenue).length;
                          const weekRevenue = weekData.reduce((sum, d) => sum + d.dayRevenue, 0);
                          const weekLabel = weekIdx === 3 ? 'This Week' : `Week ${weekIdx + 1}`;
                          
                          return (
                            <div key={weekIdx} className="p-2 rounded-lg bg-muted/50 text-center">
                              <p className="text-xs text-muted-foreground">{weekLabel}</p>
                              <p className="text-lg font-bold text-purple-500">{weekTrips}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(weekRevenue)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Activity heatmap legend */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                      <span>Less active</span>
                      <div className="flex gap-1">
                        <div className="w-3 h-3 rounded bg-muted/30" />
                        <div className="w-3 h-3 rounded bg-purple-200" />
                        <div className="w-3 h-3 rounded bg-purple-400" />
                        <div className="w-3 h-3 rounded bg-purple-600" />
                      </div>
                      <span>More active</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No trips completed yet</p>
                      <p className="text-sm">Complete trips to see activity stats</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={`grid gap-6 ${isSoloDriver ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
            {/* Hide Best Performing Trucks for solo drivers - they only have one truck */}
            {!isSoloDriver && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Best Performing Trucks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.bestPerformingTrucks.slice(0, 5).map((truck, idx) => (
                      <div key={truck.truckId} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium">{truck.plate}</p>
                          </div>
                        </div>
                        <span className="font-bold">{formatCurrency(truck.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{isSoloDriver ? 'My Truck Revenue' : 'Revenue by Truck Type'}</CardTitle>
              </CardHeader>
              <CardContent>
                {truckTypeChartData.length > 0 ? (
                  <>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={truckTypeChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {truckTypeChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                      {truckTypeChartData.map((entry, idx) => (
                        <Badge key={idx} style={{ backgroundColor: entry.color }} className="text-white">
                          {entry.name}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-48 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No completed trips yet</p>
                      <p className="text-sm">Complete trips to see revenue data</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue by Region</CardTitle>
                <CardDescription>Click a region to view trips</CardDescription>
              </CardHeader>
              <CardContent>
                {regionChartData.length > 0 ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {regionChartData.map((region) => (
                        <div 
                          key={region.name} 
                          className="p-2 rounded-md hover-elevate cursor-pointer border border-transparent hover:border-border transition-colors"
                          onClick={() => setLocation(`/carrier/history?region=${encodeURIComponent(region.name)}`)}
                          data-testid={`region-item-${region.name.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span className="font-medium">{region.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{formatCurrency(region.revenue)}</span>
                              <Badge variant="secondary" className="text-xs">
                                {region.trips} {region.trips === 1 ? 'trip' : 'trips'}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress 
                              value={analytics.totalRevenue > 0 ? (region.revenue / analytics.totalRevenue) * 100 : 0} 
                              className="h-1.5 flex-1" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No regional data yet</p>
                      <p className="text-sm">Complete trips to see revenue by region</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Financial Breakdown</CardTitle>
              <CardDescription>Detailed cost and revenue breakdown per month</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {analytics.monthlyReports.map((report) => (
                    <Card key={report.month}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold">{report.month}</h4>
                          <Badge variant={report.profitMargin > 20 ? "default" : "secondary"}>
                            {report.profitMargin}% margin
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Revenue</p>
                            <p className="font-bold text-lg">{formatCurrency(report.totalRevenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Trips</p>
                            <p className="font-bold text-lg">{report.tripsCompleted}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Avg/Trip</p>
                            <p className="font-bold text-lg">
                              {formatCurrency(report.tripsCompleted > 0 ? report.totalRevenue / report.tripsCompleted : 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Profit</p>
                            <p className="font-bold text-lg text-green-600">
                              {formatCurrency(report.totalRevenue * (report.profitMargin / 100))}
                            </p>
                          </div>
                        </div>
                        {!isSoloDriver && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Fuel</p>
                            <p className="font-medium text-red-600">{formatCurrency((report as any).fuelCost || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Tolls</p>
                            <p className="font-medium text-red-600">{formatCurrency((report as any).tollCost || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Driver Pay</p>
                            <p className="font-medium text-red-600">{formatCurrency((report as any).driverPay || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Maintenance</p>
                            <p className="font-medium text-red-600">{formatCurrency((report as any).maintenanceCost || 0)}</p>
                          </div>
                        </div>
                        )}
                        {isSoloDriver && (
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Trips Completed</p>
                            <p className="font-medium text-primary">{report.tripsCompleted}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Earnings</p>
                            <p className="font-medium text-green-600">{formatCurrency(report.totalRevenue)}</p>
                          </div>
                        </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enterprise-only: Revenue by Driver tab */}
        {!isSoloDriver && (
          <TabsContent value="drivers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue by Driver</CardTitle>
                <CardDescription>Individual driver performance and earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {analytics.revenueByDriver.map((driver, idx) => (
                      <div key={driver.driverId} className="p-4 rounded-lg bg-muted/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-semibold">{driver.driverName}</p>
                              <p className="text-xs text-muted-foreground">{driver.driverId}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{formatCurrency(driver.revenue)}</p>
                            <p className="text-xs text-muted-foreground">{driver.trips} trips</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Avg per Trip</p>
                            <p className="font-medium">{formatCurrency(driver.avgPerTrip)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Safety Score</p>
                            <div className="flex items-center gap-2">
                              <Progress value={driver.safetyScore} className="h-2 flex-1" />
                              <span className={`font-medium ${
                                driver.safetyScore > 80 ? "text-green-600" : 
                                driver.safetyScore > 60 ? "text-amber-600" : "text-red-600"
                              }`}>{driver.safetyScore}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">% of Total</p>
                            <p className="font-medium">
                              {((driver.revenue / analytics.totalRevenue) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="deductions" className="space-y-6">
          {(() => {
            const totalRevenue = analytics.totalRevenue;
            // TDS rate: 2% deducted on every load
            const tdsRate = 0.02;
            const tdsAmount = totalRevenue * tdsRate;
            const deliveredShipments = allShipments
              .filter((s: Shipment) => s.carrierId === user?.id && s.status === 'delivered');
            const haltingChargesPerTrip = 0;
            const totalHaltingCharges = 0;
            const podPenaltyRate = 100; // Rs. 100/day after grace period
            const podGracePeriodDays = 15;
            const now = new Date();

            const perTripDeductions = deliveredShipments.map((shipment: Shipment) => {
              const load = allLoads.find((l: Load) => l.id === shipment.loadId);
              // finalPrice is the full carrier payout amount
              const grossRevenue = load?.finalPrice ? parseFloat(load.finalPrice) : 0;
              // 2% TDS on each trip's gross revenue
              const tripTds = Math.round(grossRevenue * tdsRate);
              const route = load
                ? `${(load as any).pickupCity || 'Origin'} to ${(load as any).dropoffCity || 'Destination'}`
                : 'Route unavailable';
              const loadNum = (load as any)?.shipperLoadNumber || (load as any)?.adminReferenceNumber;
              const loadId = loadNum
                ? `LD-${String(loadNum).padStart(3, '0')}`
                : `LD-${shipment.loadId.slice(0, 6)}`;
              const completedDate = shipment.completedAt ? new Date(shipment.completedAt) : now;
              
              // POD penalty calculation:
              // - Grace period: 15 days from trip completion
              // - After grace period: Rs. 100/day until POD is submitted
              // - If POD is submitted within grace period: no penalty
              // - If POD is submitted after grace period: penalty for overdue days only (up to submission date)
              // - If physical POD is submitted: penalty stops from that day onwards (accumulated penalty remains)
              let podPenalty = 0;
              let podOverdueDays = 0;
              
              // Check if physical POD has been submitted
              const hasPhysicalPodSubmitted = shipment.physicalPodSubmittedAt;
              const daysSinceCompletion = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysSinceCompletion > podGracePeriodDays) {
                // Grace period has passed, calculate penalty
                if (hasPhysicalPodSubmitted) {
                  // POD was submitted after deadline - calculate penalty only up to submission date
                  const podSubmittedDate = new Date(hasPhysicalPodSubmitted);
                  const daysUntilPodSubmitted = Math.floor((podSubmittedDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  if (daysUntilPodSubmitted > podGracePeriodDays) {
                    // Penalty applies only for days between grace period end and POD submission
                    podOverdueDays = daysUntilPodSubmitted - podGracePeriodDays;
                    podPenalty = podOverdueDays * podPenaltyRate;
                  }
                  // If POD submitted within grace period, no penalty
                } else {
                  // POD not submitted yet - calculate penalty up to today
                  podOverdueDays = daysSinceCompletion - podGracePeriodDays;
                  podPenalty = podOverdueDays * podPenaltyRate;
                }
              }
              
              return {
                loadId,
                route,
                grossRevenue,
                tds: tripTds,
                halting: 0,
                podPenalty,
                podOverdueDays,
                total: tripTds + podPenalty,
                date: shipment.completedAt ? format(completedDate, 'MMM dd, yyyy') : '-',
              };
            });

            const totalPodPenalty = perTripDeductions.reduce((sum, t) => sum + t.podPenalty, 0);
            const totalDeductions = tdsAmount + totalHaltingCharges + totalPodPenalty;

            return (
              <>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-red-500/10 flex-shrink-0">
                          <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Total Deductions</p>
                          <p className="text-base sm:text-xl font-bold text-red-600 truncate" data-testid="text-total-deductions">
                            {formatCurrency(totalDeductions)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 flex-shrink-0">
                          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">TDS Deduction (2%)</p>
                          <p className="text-base sm:text-xl font-bold text-amber-600 truncate" data-testid="text-tds-deduction">
                            {formatCurrency(tdsAmount)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/10 flex-shrink-0">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Halting Charges</p>
                          <p className="text-base sm:text-xl font-bold text-orange-600 truncate" data-testid="text-halting-charges">
                            {formatCurrency(totalHaltingCharges)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-red-500/10 flex-shrink-0">
                          <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">POD Penalty</p>
                          <p className="text-base sm:text-xl font-bold text-red-600 truncate" data-testid="text-pod-penalty">
                            {formatCurrency(totalPodPenalty)}
                          </p>
                          <p className="text-xs text-muted-foreground">Rs. 100/day after 15 days</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                      <CardTitle className="text-base sm:text-lg">TDS Declaration Status</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Submit your TDS declaration to reduce or eliminate the 2% TDS deduction
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                      <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base text-amber-800 dark:text-amber-400">TDS Declaration Not Submitted</p>
                          <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-500">
                            A 2% TDS is being deducted from your gross earnings because you have not submitted a TDS declaration.
                            Submit Form 15G/15H or your PAN details to reduce this deduction.
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                            Total TDS deducted: <span className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(tdsAmount)}</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                      <CardTitle className="text-base sm:text-lg">POD Submission Status</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Submit physical POD copy within 15 days of trip completion to avoid penalty
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                      <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 mt-0.5 shrink-0" />
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base text-red-800 dark:text-red-400">Physical POD Copy Pending</p>
                          <p className="text-xs sm:text-sm text-red-700 dark:text-red-500">
                            If the physical POD (Proof of Delivery) copy is not submitted within 15 days of trip
                            completion, a penalty of Rs. 100/day is charged until the POD is received.
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                            Total POD penalty: <span className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(totalPodPenalty)}</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                    <CardTitle className="text-base sm:text-lg">Per-Trip Deduction Breakdown</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Detailed deductions for each completed trip</CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <ScrollArea className="h-[300px] sm:h-[400px]">
                      {perTripDeductions.length > 0 ? (
                        <div className="space-y-3">
                          {perTripDeductions.map((trip, idx) => (
                            <div key={idx} className="p-4 rounded-lg border space-y-3" data-testid={`deduction-row-${idx}`}>
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline">{trip.loadId}</Badge>
                                  <span className="text-sm font-medium">{trip.route}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{trip.date}</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <p className="text-muted-foreground text-xs">Gross Amount</p>
                                  <p className="font-medium">{formatCurrencyPrecise(trip.grossRevenue)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs">TDS (2%)</p>
                                  <p className="font-medium text-amber-600">-{formatCurrencyPrecise(trip.tds)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs">Halting Charges</p>
                                  <p className="font-medium text-orange-600">-{formatCurrencyPrecise(trip.halting)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs">POD Penalty {trip.podOverdueDays > 0 ? `(${trip.podOverdueDays}d)` : ''}</p>
                                  <p className="font-medium text-red-600">{trip.podPenalty > 0 ? `-${formatCurrencyPrecise(trip.podPenalty)}` : 'Rs. 0'}</p>
                                </div>
                              </div>
                              <div className="pt-2 border-t flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Total Deductions</span>
                                <span className="font-semibold text-red-600">-{formatCurrencyPrecise(trip.total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-16 text-center text-muted-foreground">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">No deductions yet</p>
                          <p className="text-sm mt-1">Deductions will appear once you complete deliveries</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="shippers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Shippers</CardTitle>
              <CardDescription>Your highest-value shipper relationships</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.topShippers.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {analytics.topShippers.map((shipper: any, idx: number) => (
                      <div key={shipper.shipperId} className="p-4 rounded-lg bg-muted/50" data-testid={`shipper-card-${idx}`}>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{shipper.shipperName}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>{shipper.loadsCompleted} {shipper.loadsCompleted === 1 ? 'load' : 'loads'} completed</span>
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  {shipper.reliabilityScore}% reliability
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-primary">{formatCurrency(shipper.totalRevenue)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(shipper.avgRevenuePerLoad)} per load
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                          <span>Last delivery: {shipper.lastLoadDate}</span>
                          <Badge variant="secondary" className="text-xs">
                            Top {idx + 1}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="py-16 text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No shipper relationships yet</p>
                  <p className="text-sm mt-1">Complete deliveries to build shipper partnerships</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
