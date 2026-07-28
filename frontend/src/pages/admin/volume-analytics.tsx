import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  ChevronLeft,
  Calendar,
  Package,
  Users,
  Truck,
  MapPin,
  Building,
  Filter,
  Download,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  X,
  Calculator,
  IndianRupee,
  FileText,
  User,
} from "lucide-react";
import type { Load, Bid } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  AreaChart, 
  Area, 
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
  Legend,
} from "recharts";
import { useTheme } from "@/lib/theme-provider";
import { useToast } from "@/hooks/use-toast";

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type CsvTable = (string | number | boolean | null | undefined)[][];

function buildCsv(rows: CsvTable): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function downloadCsvFile(filename: string, csvContent: string) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface MonthlyVolumeData {
  month: string;
  fullMonth: string;
  volume: number;
  loads: number;
  avgLoadPrice: number;
  topRoutes: { route: string; volume: number; loads: number }[];
  topShippers: { name: string; volume: number; loads: number }[];
  topCarriers: { name: string; volume: number; loads: number }[];
}

type TimeRange = "30d" | "90d" | "1y" | "custom";

interface LoadWithMargin extends Load {
  shipperPrice: number;
  carrierPayout: number;
  margin: number;
  marginPercent: number;
}

export default function AdminVolumeAnalytics() {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [selectedMonth, setSelectedMonth] = useState<MonthlyVolumeData | null>(null);
  const [selectedLoadDetail, setSelectedLoadDetail] = useState<LoadWithMargin | null>(null);

  const { data: loads = [] } = useQuery<Load[]>({
    queryKey: ["/api/loads"],
    staleTime: 30000,
  });

  const { data: allBids = [] } = useQuery<Bid[]>({
    queryKey: ["/api/bids"],
    staleTime: 30000,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    staleTime: 30000,
  });

  // Generate real volume data from actual loads - dynamic year based on actual data
  const fullYearData = useMemo(() => {
    if (loads.length === 0) return [];

    // Find the actual year range from real data
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Build last 12 months dynamically from current date
    const months: { short: string; full: string; year: number; monthNum: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth();
      const short = d.toLocaleString("default", { month: "short" });
      const full = d.toLocaleString("default", { month: "long" }) + " " + year;
      months.push({ short, full, year, monthNum });
    }

    // Group loads by year+month key
    const monthlyGroups: Record<string, Load[]> = {};
    loads.forEach(load => {
      const loadDate = new Date(load.createdAt || Date.now());
      const key = `${loadDate.getFullYear()}-${loadDate.getMonth()}`;
      if (!monthlyGroups[key]) monthlyGroups[key] = [];
      monthlyGroups[key].push(load);
    });

    return months.map(m => {
      const key = `${m.year}-${m.monthNum}`;
      const monthLoads = monthlyGroups[key] || [];
      const volume = monthLoads.reduce((sum, load) => {
        return sum + parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
      }, 0);
      const loadsCount = monthLoads.length;

      // Calculate top routes for this month
      const routeMap: Record<string, { volume: number; loads: number }> = {};
      monthLoads.forEach(load => {
        const route = `${load.pickupCity || 'Unknown'} - ${load.dropoffCity || 'Unknown'}`;
        if (!routeMap[route]) routeMap[route] = { volume: 0, loads: 0 };
        routeMap[route].volume += parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
        routeMap[route].loads += 1;
      });
      const topRoutes = Object.entries(routeMap)
        .map(([route, data]) => ({ route, ...data }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5);

      // Calculate top shippers for this month
      const shipperMap: Record<string, { volume: number; loads: number }> = {};
      monthLoads.forEach(load => {
        const shipper = users.find(u => u.id === load.shipperId);
        const shipperName = shipper?.companyName || shipper?.username || 'Unknown Shipper';
        if (!shipperMap[shipperName]) shipperMap[shipperName] = { volume: 0, loads: 0 };
        shipperMap[shipperName].volume += parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
        shipperMap[shipperName].loads += 1;
      });
      const topShippers = Object.entries(shipperMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5);

      // Calculate top carriers for this month
      const carrierMap: Record<string, { volume: number; loads: number }> = {};
      monthLoads.forEach(load => {
        if (load.assignedCarrierId) {
          const carrier = users.find(u => u.id === load.assignedCarrierId);
          const carrierName = carrier?.companyName || carrier?.username || 'Unknown Carrier';
          if (!carrierMap[carrierName]) carrierMap[carrierName] = { volume: 0, loads: 0 };
          carrierMap[carrierName].volume += parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
          carrierMap[carrierName].loads += 1;
        }
      });
      const topCarriers = Object.entries(carrierMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5);

      return {
        month: m.short,
        fullMonth: m.full,
        volume: Math.round(volume),
        loads: loadsCount,
        avgLoadPrice: loadsCount > 0 ? Math.round(volume / loadsCount) : 0,
        topRoutes,
        topShippers,
        topCarriers,
      };
    });
  }, [loads, users]);

  // Calculate route breakdown from real data
  const routeBreakdown = useMemo(() => {
    const routeMap: Record<string, number> = {};
    loads.forEach(load => {
      const route = `${load.pickupCity || 'Unknown'} - ${load.dropoffCity || 'Unknown'}`;
      const price = parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
      routeMap[route] = (routeMap[route] || 0) + price;
    });

    const sortedRoutes = Object.entries(routeMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const top4 = sortedRoutes.slice(0, 4);
    const othersValue = sortedRoutes.slice(4).reduce((sum, r) => sum + r.value, 0);

    const colors = [
      "hsl(217, 91%, 48%)",
      "hsl(217, 91%, 58%)",
      "hsl(217, 91%, 68%)",
      "hsl(217, 91%, 78%)",
      "hsl(220, 12%, 50%)",
    ];

    const result = top4.map((route, idx) => ({ ...route, color: colors[idx] }));
    if (othersValue > 0) {
      result.push({ name: "Other Routes", value: othersValue, color: colors[4] });
    }

    return result;
  }, [loads]);

  // Calculate load type breakdown from real data
  const loadTypeBreakdown = useMemo(() => {
    const typeMap: Record<string, number> = {};
    loads.forEach(load => {
      const type = load.requiredTruckType || 'Unknown Type';
      const price = parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
      typeMap[type] = (typeMap[type] || 0) + price;
    });

    const colors = [
      "hsl(217, 91%, 48%)",
      "hsl(142, 76%, 36%)",
      "hsl(48, 96%, 53%)",
      "hsl(280, 70%, 50%)",
      "hsl(340, 75%, 55%)",
    ];

    return Object.entries(typeMap)
      .map(([name, value], idx) => ({ 
        name, 
        value, 
        color: colors[idx % colors.length] 
      }))
      .sort((a, b) => b.value - a.value);
  }, [loads]);

  const platformMarginData = useMemo(() => {
    const finalizedStatuses = ['awarded', 'invoice_created', 'invoice_sent', 'invoice_acknowledged', 'invoice_paid', 'invoice_approved', 'invoice_negotiation', 'in_transit', 'delivered', 'closed'];
    
    const loadsWithMargin = loads.filter((load) => {
      const adminPrice = parseFloat(String(load.adminFinalPrice || 0));
      const acceptedBid = allBids.find(bid => bid.loadId === load.id && bid.status === 'accepted');
      const isBidFinalized = acceptedBid && (load.assignedCarrierId || finalizedStatuses.includes(load.status || ''));
      return adminPrice > 0 && isBidFinalized && acceptedBid;
    });

    const getCarrierPayout = (load: Load) => {
      const acceptedBid = allBids.find(bid => bid.loadId === load.id && bid.status === 'accepted');
      return acceptedBid ? parseFloat(String(acceptedBid.amount || 0)) : 0;
    };

    const totalShipperPrice = loadsWithMargin.reduce((sum, load) => {
      return sum + parseFloat(String(load.adminFinalPrice || 0));
    }, 0);
    const totalCarrierPayout = loadsWithMargin.reduce((sum, load) => {
      return sum + getCarrierPayout(load);
    }, 0);
    const totalMargin = totalShipperPrice - totalCarrierPayout;
    const avgMarginPercent = totalShipperPrice > 0 ? (totalMargin / totalShipperPrice) * 100 : 0;

    const allLoadsWithMargin = loadsWithMargin
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .map((load) => {
        const shipperPrice = parseFloat(String(load.adminFinalPrice || 0));
        const carrierPayout = getCarrierPayout(load);
        const margin = shipperPrice - carrierPayout;
        const marginPercent = shipperPrice > 0 ? (margin / shipperPrice) * 100 : 0;
        return {
          ...load,
          shipperPrice,
          carrierPayout,
          margin,
          marginPercent,
        };
      });

    return {
      totalShipperPrice,
      totalCarrierPayout,
      totalMargin,
      avgMarginPercent,
      loadsCount: loadsWithMargin.length,
      allLoadsWithMargin,
    };
  }, [loads, allBids]);

  const filteredData = useMemo(() => {
    if (fullYearData.length === 0) return [];
    switch (timeRange) {
      case "30d":
        return fullYearData.slice(-1);
      case "90d":
        return fullYearData.slice(-3);
      case "1y":
      case "custom":
      default:
        return fullYearData;
    }
  }, [timeRange, fullYearData]);

  const totalVolume = filteredData.reduce((sum, d) => sum + d.volume, 0);
  const totalLoads = filteredData.reduce((sum, d) => sum + d.loads, 0);
  const avgLoadPrice = totalLoads > 0 ? totalVolume / totalLoads : 0;
  
  const currentMonth = filteredData.length > 0 ? filteredData[filteredData.length - 1] : null;
  const previousMonth = filteredData.length > 1 ? filteredData[filteredData.length - 2] : null;
  const monthlyGrowth = previousMonth && previousMonth.volume > 0
    ? ((currentMonth!.volume - previousMonth.volume) / previousMonth.volume * 100) 
    : 0;

  const chartColors = {
    stroke: theme === "dark" ? "hsl(217, 91%, 65%)" : "hsl(217, 91%, 48%)",
    fill: theme === "dark" ? "hsl(217, 91%, 65%)" : "hsl(217, 91%, 48%)",
    bar: theme === "dark" ? "hsl(217, 91%, 55%)" : "hsl(217, 91%, 48%)",
    bar2: theme === "dark" ? "hsl(142, 76%, 50%)" : "hsl(142, 76%, 36%)",
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `Rs. ${(value / 10000000).toFixed(2)}Cr`;
    }
    if (value >= 100000) {
      return `Rs. ${(value / 100000).toFixed(1)}L`;
    }
    return `Rs. ${(value / 1000).toFixed(0)}K`;
  };

  const formatFullCurrency = (value: number) => {
    return `Rs. ${value.toLocaleString('en-IN')}`;
  };

  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]) {
      const monthData = fullYearData.find(d => d.month === data.activePayload[0].payload.month);
      if (monthData) {
        setSelectedMonth(monthData);
      }
    }
  };

  const handleExportDetailedCsv = () => {
    try {
      const timeRangeLabel =
        timeRange === "30d"
          ? "Last 30 days (most recent month in chart)"
          : timeRange === "90d"
            ? "Last 90 days (last 3 months in chart)"
            : timeRange === "1y"
              ? "Rolling 12 months"
              : "Custom";

      const rows: CsvTable = [
        ["Volume Analytics", "Detailed report"],
        ["Time range filter", timeRangeLabel],
        ["Generated (UTC)", new Date().toISOString()],
        [],
        ["Period summary (filtered chart range)"],
        ["Total volume INR", Math.round(totalVolume)],
        ["Total loads", totalLoads],
        ["Average load value INR", Math.round(avgLoadPrice)],
        ["Month-over-month growth % (latest vs prior month)", Number(monthlyGrowth.toFixed(2))],
        [],
        ["Platform margin (loads with accepted bid and shipper price)"],
        ["Total shipper price INR", Math.round(platformMarginData.totalShipperPrice)],
        ["Total carrier payout INR", Math.round(platformMarginData.totalCarrierPayout)],
        ["Total platform margin INR", Math.round(platformMarginData.totalMargin)],
        ["Average margin %", Number(platformMarginData.avgMarginPercent.toFixed(2))],
        ["Loads in margin sample", platformMarginData.loadsCount],
        [],
        ["Monthly breakdown (filtered)"],
        ["Month", "Volume INR", "Loads", "Avg load INR"],
        ...filteredData.map((d) => [d.fullMonth, d.volume, d.loads, d.avgLoadPrice]),
        [],
        ["Top routes by volume (all loads in dataset)"],
        ["Route", "Volume INR"],
        ...routeBreakdown.map((r) => [r.name, Math.round(r.value)]),
        [],
        ["Volume by truck / load type"],
        ["Type", "Volume INR"],
        ...loadTypeBreakdown.map((r) => [r.name, Math.round(r.value)]),
        [],
        ["Load-level detail (margin sample)"],
        [
          "Load ID",
          "Shipper load #",
          "Admin ref #",
          "Status",
          "Pickup city",
          "Dropoff city",
          "Created (ISO)",
          "Shipper price INR",
          "Carrier payout INR",
          "Margin INR",
          "Margin %",
        ],
        ...platformMarginData.allLoadsWithMargin.map((load) => [
          load.id,
          load.shipperLoadNumber ?? "",
          load.adminReferenceNumber ?? "",
          load.status ?? "",
          load.pickupCity ?? "",
          load.dropoffCity ?? "",
          load.createdAt ? new Date(load.createdAt).toISOString() : "",
          load.shipperPrice,
          load.carrierPayout,
          load.margin,
          Number(load.marginPercent.toFixed(2)),
        ]),
      ];

      const slug = `volume-analytics-detailed-${new Date().toISOString().slice(0, 10)}`;
      downloadCsvFile(`${slug}.csv`, buildCsv(rows));
      toast({
        title: "Export ready",
        description: "Detailed CSV report downloaded.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Export failed";
      toast({
        title: "Export failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/admin")}
              data-testid="button-back-to-dashboard"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">Volume Analytics</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground ml-10">Detailed breakdown of transaction volume and revenue</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-time-range">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-export" className="w-full sm:w-auto" onClick={handleExportDetailedCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card 
          className="hover-elevate transition-all"
          data-testid="card-platform-margin"
        >
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 overflow-hidden">
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Platform Margin</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold break-words">{formatCurrency(platformMarginData.totalMargin)}</p>
              </div>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Percent className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
              </div>
            </div>
            <Badge 
              variant="secondary" 
              className={`mt-2 text-xs ${platformMarginData.avgMarginPercent >= 10 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}
            >
              {platformMarginData.avgMarginPercent >= 10 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {platformMarginData.avgMarginPercent.toFixed(1)}% avg margin
            </Badge>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
              From {platformMarginData.loadsCount} priced loads
            </p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => setLocation("/admin/revenue/sources")}
          data-testid="card-total-volume"
        >
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 overflow-hidden">
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Total Volume</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold break-words">{formatCurrency(totalVolume)}</p>
              </div>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
            </div>
            <Badge 
              variant="secondary" 
              className={`mt-2 text-xs ${monthlyGrowth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {monthlyGrowth >= 0 ? <TrendingUp className="h-2 w-2 mr-1" /> : <TrendingDown className="h-2 w-2 mr-1" />}
              {monthlyGrowth >= 0 ? "+" : ""}{monthlyGrowth.toFixed(1)}% vs last month
            </Badge>
            <p className="text-[10px] sm:text-xs text-primary mt-2">
              Click to view detailed breakdown
            </p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => setLocation("/admin/revenue/transactions")}
          data-testid="card-total-loads"
        >
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 overflow-hidden">
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Total Loads</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold break-words">{totalLoads.toLocaleString()}</p>
              </div>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-primary mt-2">
              Click to view all transactions
            </p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => setLocation("/admin/revenue/timeline")}
          data-testid="card-avg-load-price"
        >
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 overflow-hidden">
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Avg Load Price</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold break-words">{formatCurrency(avgLoadPrice)}</p>
              </div>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-primary mt-2">
              Click to view pricing trends
            </p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate transition-all"
          onClick={() => setLocation("/admin/revenue/profitability")}
          data-testid="card-active-months"
        >
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 overflow-hidden">
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Active Months</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold break-words">{filteredData.length}</p>
              </div>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-primary mt-2">
              Click for profitability insights
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Volume Over Time</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={fullYearData}
                  onClick={handleChartClick}
                  style={{ cursor: "pointer" }}
                  margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorVolumeAnalytics" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.fill} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColors.fill} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={theme === "dark" ? "hsl(220, 12%, 18%)" : "hsl(220, 12%, 92%)"} 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "hsl(220, 10%, 65%)" : "hsl(220, 12%, 35%)", fontSize: 9 }}
                    interval={0}
                    angle={0}
                    height={30}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "hsl(220, 10%, 65%)" : "hsl(220, 12%, 35%)", fontSize: 9 }}
                    tickFormatter={(value) => `${(value / 10000000).toFixed(1)}Cr`}
                    width={45}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "hsl(220, 14%, 10%)" : "hsl(0, 0%, 100%)",
                      border: `1px solid ${theme === "dark" ? "hsl(220, 12%, 18%)" : "hsl(220, 12%, 92%)"}`,
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Volume"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke={chartColors.stroke}
                    fillOpacity={1}
                    fill="url(#colorVolumeAnalytics)"
                    strokeWidth={2}
                    dot={{ fill: chartColors.fill, strokeWidth: 2, r: 3, cursor: "pointer" }}
                    activeDot={{ r: 5, cursor: "pointer" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Click on a data point to see detailed breakdown
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Volume by Load Type</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col h-[400px]">
            <div className="h-64 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={loadTypeBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {loadTypeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "hsl(220, 14%, 10%)" : "hsl(0, 0%, 100%)",
                      border: `1px solid ${theme === "dark" ? "hsl(220, 12%, 18%)" : "hsl(220, 12%, 92%)"}`,
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Volume"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mt-2 pr-1">
              {loadTypeBreakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedMonth && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{selectedMonth.fullMonth} Breakdown</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(null)}>
                Clear Selection
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{formatCurrency(selectedMonth.volume)}</div>
                <div className="text-sm text-muted-foreground">Total Volume</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{selectedMonth.loads}</div>
                <div className="text-sm text-muted-foreground">Completed Loads</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{formatCurrency(selectedMonth.avgLoadPrice)}</div>
                <div className="text-sm text-muted-foreground">Avg Load Price</div>
              </div>
            </div>

            <Tabs defaultValue="routes">
              <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                <TabsList className="grid w-full min-w-max grid-cols-3">
                  <TabsTrigger value="routes" className="whitespace-nowrap text-xs sm:text-sm">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span>Top Routes</span>
                  </TabsTrigger>
                  <TabsTrigger value="shippers" className="whitespace-nowrap text-xs sm:text-sm">
                    <Building className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span>Top Shippers</span>
                  </TabsTrigger>
                  <TabsTrigger value="carriers" className="whitespace-nowrap text-xs sm:text-sm">
                    <Truck className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span>Top Carriers</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="routes" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Loads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMonth.topRoutes.map((route, idx) => (
                      <TableRow key={idx} className="cursor-pointer" onClick={() => setLocation("/admin/loads")}>
                        <TableCell className="font-medium">{route.route}</TableCell>
                        <TableCell className="text-right">{formatCurrency(route.volume)}</TableCell>
                        <TableCell className="text-right">{route.loads}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="shippers" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipper</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Loads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMonth.topShippers.map((shipper, idx) => (
                      <TableRow key={idx} className="cursor-pointer" onClick={() => setLocation("/admin/users")}>
                        <TableCell className="font-medium">{shipper.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(shipper.volume)}</TableCell>
                        <TableCell className="text-right">{shipper.loads}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="carriers" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carrier</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Loads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMonth.topCarriers.map((carrier, idx) => (
                      <TableRow key={idx} className="cursor-pointer" onClick={() => setLocation("/admin/carriers")}>
                        <TableCell className="font-medium">{carrier.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(carrier.volume)}</TableCell>
                        <TableCell className="text-right">{carrier.loads}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Volume by Route</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={routeBreakdown} layout="vertical">
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={theme === "dark" ? "hsl(220, 12%, 18%)" : "hsl(220, 12%, 92%)"} 
                    horizontal={false}
                  />
                  <XAxis 
                    type="number" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "hsl(220, 10%, 65%)" : "hsl(220, 12%, 35%)", fontSize: 10 }}
                    tickFormatter={(value) => `Rs. ${(value / 10000000).toFixed(1)}Cr`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "hsl(220, 10%, 65%)" : "hsl(220, 12%, 35%)", fontSize: 10 }}
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "hsl(220, 14%, 10%)" : "hsl(0, 0%, 100%)",
                      border: `1px solid ${theme === "dark" ? "hsl(220, 12%, 18%)" : "hsl(220, 12%, 92%)"}`,
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Volume"]}
                  />
                  <Bar dataKey="value" fill={chartColors.bar} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Monthly Loads Completed</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fullYearData}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={theme === "dark" ? "hsl(220, 12%, 18%)" : "hsl(220, 12%, 92%)"} 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "hsl(220, 10%, 65%)" : "hsl(220, 12%, 35%)", fontSize: 10 }}
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "hsl(220, 10%, 65%)" : "hsl(220, 12%, 35%)", fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "hsl(220, 14%, 10%)" : "hsl(0, 0%, 100%)",
                      border: `1px solid ${theme === "dark" ? "hsl(220, 12%, 18%)" : "hsl(220, 12%, 92%)"}`,
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="loads" fill={chartColors.bar2} radius={[4, 4, 0, 0]} name="Loads" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2 flex-wrap">
            <CardTitle className="text-base sm:text-lg">All Finalized Loads - Platform Margins</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {platformMarginData.loadsCount} loads
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Percent className="h-3 w-3 mr-1" />
                Real-time margin tracking
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {platformMarginData.allLoadsWithMargin.length > 0 ? (
            <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto overflow-x-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Load ID</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Route</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Shipper Price</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Carrier Payout</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Platform Margin</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformMarginData.allLoadsWithMargin.map((load) => (
                    <TableRow 
                      key={load.id} 
                      data-testid={`row-load-margin-${load.id}`}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedLoadDetail(load)}
                    >
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">#{load.adminReferenceNumber || load.shipperLoadNumber || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[180px]">
                            {load.pickupCity} - {load.dropoffCity}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs sm:text-sm whitespace-nowrap">
                        {formatFullCurrency(load.shipperPrice)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs sm:text-sm whitespace-nowrap">
                        {formatFullCurrency(load.carrierPayout)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span className={`text-xs sm:text-sm ${load.margin >= 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}`}>
                          {load.margin >= 0 ? "+" : ""}{formatFullCurrency(load.margin)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge 
                            variant="secondary"
                            className={`text-xs ${load.marginPercent >= 10 
                              ? "text-emerald-600 dark:text-emerald-400" 
                              : load.marginPercent >= 5 
                                ? "text-amber-600 dark:text-amber-400" 
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {load.marginPercent >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                            {load.marginPercent.toFixed(1)}%
                          </Badge>
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Percent className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm sm:text-base">No finalized loads yet</p>
              <p className="text-xs sm:text-sm mt-1">Platform margins will appear here once bids are finalized (carrier assigned)</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLoadDetail} onOpenChange={() => setSelectedLoadDetail(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="truncate">Load #{selectedLoadDetail?.adminReferenceNumber || selectedLoadDetail?.shipperLoadNumber || '—'} - Margin Breakdown</span>
            </DialogTitle>
          </DialogHeader>

          {selectedLoadDetail && (() => {
            const loadBids = allBids.filter(bid => bid.loadId === selectedLoadDetail.id);
            const acceptedBid = loadBids.find(bid => bid.status === 'accepted');
            
            return (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Route</p>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-primary" />
                      {selectedLoadDetail.pickupCity}
                    </p>
                    <p className="text-sm text-muted-foreground">to</p>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-destructive" />
                      {selectedLoadDetail.dropoffCity}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant="outline" className="capitalize">{selectedLoadDetail.status}</Badge>
                    <p className="text-sm text-muted-foreground mt-2">Truck Type</p>
                    <p className="font-medium">{selectedLoadDetail.requiredTruckType || 'Not specified'}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Pricing Breakdown
                  </h4>
                  
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Admin Set Price (Shipper Pays)</span>
                      <span className="font-bold text-lg">{formatFullCurrency(selectedLoadDetail.shipperPrice)}</span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Carrier Final Payout</span>
                      <span className="font-medium text-lg">{formatFullCurrency(selectedLoadDetail.carrierPayout)}</span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between bg-primary/10 dark:bg-primary/20 -mx-4 px-4 py-2 rounded-md">
                      <span className="font-semibold flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" />
                        Platform Margin
                      </span>
                      <div className="text-right">
                        <span className={`font-bold text-xl ${selectedLoadDetail.margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {selectedLoadDetail.margin >= 0 ? '+' : ''}{formatFullCurrency(selectedLoadDetail.margin)}
                        </span>
                        <Badge 
                          variant="secondary" 
                          className={`ml-2 ${selectedLoadDetail.marginPercent >= 10 
                            ? "text-emerald-600 dark:text-emerald-400" 
                            : selectedLoadDetail.marginPercent >= 5 
                              ? "text-amber-600 dark:text-amber-400" 
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {selectedLoadDetail.marginPercent.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Bidding History ({loadBids.length} bid{loadBids.length !== 1 ? 's' : ''})
                  </h4>
                  
                  {loadBids.length > 0 ? (
                    <div className="space-y-2">
                      {loadBids
                        .sort((a, b) => (b.status === 'accepted' ? 1 : 0) - (a.status === 'accepted' ? 1 : 0))
                        .map((bid) => (
                        <div 
                          key={bid.id} 
                          className={`flex items-center justify-between p-3 rounded-md border ${bid.status === 'accepted' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : 'bg-muted/30'}`}
                        >
                          <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">Carrier Bid</p>
                              <p className="text-xs text-muted-foreground">
                                {bid.createdAt ? new Date(bid.createdAt).toLocaleDateString() : 'Date unknown'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatFullCurrency(parseFloat(String(bid.amount || 0)))}</p>
                            <Badge 
                              variant={bid.status === 'accepted' ? 'default' : bid.status === 'rejected' ? 'destructive' : 'secondary'}
                              className="text-xs capitalize"
                            >
                              {bid.status === 'accepted' ? 'Finalized' : bid.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No bids recorded for this load</p>
                  )}
                </div>

                {acceptedBid && (
                  <>
                    <Separator />
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-emerald-700 dark:text-emerald-400">Margin Calculation</h4>
                      <div className="text-sm space-y-1">
                        <p>Shipper Price: <span className="font-medium">{formatFullCurrency(selectedLoadDetail.shipperPrice)}</span></p>
                        <p>Accepted Bid: <span className="font-medium">{formatFullCurrency(parseFloat(String(acceptedBid.amount || 0)))}</span></p>
                        <p>Final Carrier Payout: <span className="font-medium">{formatFullCurrency(selectedLoadDetail.carrierPayout)}</span></p>
                        <p className="pt-1 border-t">
                          Platform keeps: {formatFullCurrency(selectedLoadDetail.shipperPrice)} - {formatFullCurrency(selectedLoadDetail.carrierPayout)} = <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatFullCurrency(selectedLoadDetail.margin)}</span>
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
