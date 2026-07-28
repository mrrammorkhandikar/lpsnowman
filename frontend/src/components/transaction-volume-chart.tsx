import { useState, useMemo } from "react";
import { 
  AreaChart, 
  Area, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Maximize2,
  X,
  Calendar,
  Package,
  Users,
  DollarSign,
  MapPin,
  FileDown,
} from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import type { Load } from "@shared/schema";

interface MonthlyData {
  month: string;
  fullMonth: string;
  volume: number;
  activeLoads: number;
  carrierSignups: number;
  revenue: number;
  completedLoads: number;
  avgLoadPrice: number;
  topRoutes: { route: string; count: number }[];
}

interface TransactionVolumeChartProps {
  loads?: Load[];
  invoices?: any[];
}

const generateDataFromLoads = (loads: Load[] = [], invoices: any[] = []): MonthlyData[] => {
  const now = new Date();
  // Generate last 12 months ending at current month
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return {
      short: d.toLocaleString("en-IN", { month: "short" }),
      full: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
      num: d.getMonth(),
      year: d.getFullYear(),
    };
  });

  return months.map((m) => {
    // Filter loads for this month
    const monthLoads = loads.filter(load => {
      if (!load.createdAt) return false;
      const loadDate = new Date(load.createdAt);
      return loadDate.getMonth() === m.num && loadDate.getFullYear() === m.year;
    });

    // Filter invoices for this month
    const monthInvoices = invoices.filter(inv => {
      if (!inv.createdAt) return false;
      const invDate = new Date(inv.createdAt);
      return invDate.getMonth() === m.num && invDate.getFullYear() === m.year;
    });

    // Calculate completed loads
    const completedMonthLoads = monthLoads.filter(l => 
      ['delivered', 'closed'].includes(l.status || '')
    );
    const completedLoads = completedMonthLoads.length;

    // Calculate volume from paid invoices
    const volumeFromInvoices = monthInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.totalAmount?.toString() || '0'), 0);

    // Fallback: if no paid invoices, calculate from completed loads
    const volumeFromLoads = completedMonthLoads.reduce((sum, load) => {
      const amount = load.finalPrice 
        ? parseFloat(load.finalPrice) 
        : load.adminFinalPrice 
        ? parseFloat(load.adminFinalPrice)
        : 0;
      return sum + amount;
    }, 0);

    // Use invoices if available, otherwise use loads
    const volume = volumeFromInvoices > 0 ? volumeFromInvoices : volumeFromLoads;

    // Calculate revenue (platform margin - 12% of volume)
    const revenue = volume * 0.12;

    // Calculate average load price
    const avgLoadPrice = completedLoads > 0 
      ? volume / completedLoads 
      : 0;

    // Get top routes
    const routeCounts: Record<string, number> = {};
    monthLoads.forEach(load => {
      if (load.pickupCity && load.dropoffCity) {
        const route = `${load.pickupCity} - ${load.dropoffCity}`;
        routeCounts[route] = (routeCounts[route] || 0) + 1;
      }
    });

    const topRoutes = Object.entries(routeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([route, count]) => ({ route, count }));

    return {
      month: m.short,
      fullMonth: m.full,
      volume: Math.round(volume),
      activeLoads: monthLoads.length,
      carrierSignups: 0, // This would need carrier signup data
      revenue: Math.round(revenue),
      completedLoads,
      avgLoadPrice: Math.round(avgLoadPrice),
      topRoutes,
    };
  });
};

type TimeRange = "3m" | "6m" | "1y" | "custom";
type MetricType = "volume" | "activeLoads" | "carrierSignups" | "revenue";

const metricConfig: Record<MetricType, { label: string; formatter: (v: number) => string; icon: typeof DollarSign }> = {
  volume: { 
    label: "Transaction Volume", 
    formatter: (v) => `Rs. ${(v / 100000).toFixed(1)}L`,
    icon: DollarSign,
  },
  activeLoads: { 
    label: "All Loads", 
    formatter: (v) => v.toLocaleString(),
    icon: Package,
  },
  carrierSignups: { 
    label: "Carrier Signups", 
    formatter: (v) => v.toLocaleString(),
    icon: Users,
  },
  revenue: { 
    label: "Revenue", 
    formatter: (v) => `Rs. ${(v / 100000).toFixed(1)}L`,
    icon: DollarSign,
  },
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MonthlyData; value: number }>;
  label?: string;
  metric: MetricType;
  previousValue?: number;
}

function CustomTooltip({ active, payload, metric, previousValue }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  const currentValue = data[metric];
  const growth = previousValue ? ((currentValue - previousValue) / previousValue * 100) : 0;
  const isPositive = growth >= 0;

  return (
    <div className="bg-card border border-border rounded-lg shadow-xl p-3 min-w-[180px]">
      <div className="font-semibold text-foreground mb-2">{data.fullMonth}</div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-sm">{metricConfig[metric].label}</span>
          <span className="font-mono font-semibold text-foreground">
            {metricConfig[metric].formatter(currentValue)}
          </span>
        </div>
        {previousValue !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground text-sm">Growth</span>
            <div className={`flex items-center gap-1 font-medium ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{isPositive ? "+" : ""}{growth.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MonthDetailPanelProps {
  data: MonthlyData | null;
  onClose: () => void;
  previousData?: MonthlyData;
}

function MonthDetailPanel({ data, onClose, previousData }: MonthDetailPanelProps) {
  if (!data) return null;

  const volumeGrowth = previousData 
    ? ((data.volume - previousData.volume) / previousData.volume * 100) 
    : 0;
  const isPositive = volumeGrowth >= 0;

  return (
    <div className="bg-card border-t lg:border-t-0 lg:border-l border-border p-4 w-full lg:min-w-[280px] lg:max-w-[320px] overflow-y-auto max-h-[400px] lg:max-h-none">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base sm:text-lg truncate">{data.fullMonth}</h3>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onClose}
          data-testid="button-close-month-detail"
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground truncate">Transaction Volume</span>
            <span className="font-mono font-semibold text-sm sm:text-base shrink-0">Rs. {(data.volume / 100000).toFixed(1)}L</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground truncate">Completed Loads</span>
            <span className="font-mono font-semibold text-sm sm:text-base shrink-0">{data.completedLoads}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground truncate">Avg Load Price</span>
            <span className="font-mono font-semibold text-sm sm:text-base shrink-0">Rs. {data.avgLoadPrice.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground truncate">Growth</span>
            <div className={`flex items-center gap-1 font-semibold text-sm sm:text-base shrink-0 ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {isPositive ? <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4" />}
              {isPositive ? "+" : ""}{volumeGrowth.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm sm:text-base">Top 5 Routes</span>
          </div>
          <div className="space-y-2">
            {data.topRoutes.length > 0 ? (
              data.topRoutes.map((route, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                  <span className="text-muted-foreground truncate flex-1 min-w-0">{route.route}</span>
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs shrink-0">
                    {route.count} loads
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-2">No routes data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransactionVolumeChart({ loads = [], invoices = [] }: TransactionVolumeChartProps) {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [metric, setMetric] = useState<MetricType>("volume");
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthlyData | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const fullYearData = useMemo(() => generateDataFromLoads(loads, invoices), [loads, invoices]);

  const filteredData = useMemo(() => {
    switch (timeRange) {
      case "3m":
        return fullYearData.slice(-3);
      case "6m":
        return fullYearData.slice(-6);
      case "1y":
      case "custom":
      default:
        return fullYearData;
    }
  }, [timeRange]);

  const currentValue = filteredData[filteredData.length - 1]?.[metric] ?? 0;
  const previousValue = filteredData[filteredData.length - 2]?.[metric] ?? currentValue;
  const monthlyGrowth = previousValue ? ((currentValue - previousValue) / previousValue * 100) : 0;
  const isGrowthPositive = monthlyGrowth >= 0;

  const chartColors = {
    stroke: theme === "dark" ? "hsl(217, 91%, 65%)" : "hsl(217, 91%, 48%)",
    fill: theme === "dark" ? "hsl(217, 91%, 65%)" : "hsl(217, 91%, 48%)",
  };

  const handleExportCSV = () => {
    const headers = ["Month", "Volume", "All Loads", "Carrier Signups", "Revenue", "Completed Loads", "Avg Load Price"];
    const csvContent = [
      headers.join(","),
      ...filteredData.map(d => [
        d.fullMonth,
        d.volume,
        d.activeLoads,
        d.carrierSignups,
        d.revenue,
        d.completedLoads,
        d.avgLoadPrice,
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transaction-volume-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    alert("PDF export would be generated here. In production, this would use a library like jspdf or call a backend service.");
  };

  const handleChartClick = (data: { activePayload?: Array<{ payload: MonthlyData }> } | null) => {
    if (data?.activePayload?.[0]) {
      setSelectedMonth(data.activePayload[0].payload);
    }
  };

  const handleDotClick = (data: MonthlyData) => {
    setSelectedMonth(data);
  };

  const getYAxisFormatter = (value: number) => {
    if (metric === "volume" || metric === "revenue") {
      return `Rs. ${(value / 100000).toFixed(1)}L`;
    }
    return value.toString();
  };

  const renderChart = (height: number, showDots = false, isCompact = false) => (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart 
        data={filteredData}
        onClick={handleChartClick}
        onMouseMove={(e) => {
          if (e?.activeTooltipIndex !== undefined) {
            setHoveredIndex(e.activeTooltipIndex);
          }
        }}
        onMouseLeave={() => setHoveredIndex(null)}
        style={{ cursor: "pointer" }}
        margin={{ 
          top: 10, 
          right: isCompact ? 5 : 10, 
          left: isCompact ? 0 : 10, 
          bottom: 50
        }}
      >
        <defs>
          <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColors.fill} stopOpacity={0.3} />
            <stop offset="95%" stopColor={chartColors.fill} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="colorMetricExpanded" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColors.fill} stopOpacity={0.4} />
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
          tick={{ fill: theme === "dark" ? "hsl(220, 10%, 65%)" : "hsl(220, 12%, 35%)", fontSize: isCompact ? 9 : 10 }}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: theme === "dark" ? "hsl(220, 10%, 65%)" : "hsl(220, 12%, 35%)", fontSize: isCompact ? 10 : 11 }}
          tickFormatter={getYAxisFormatter}
          dx={-10}
          width={isCompact ? 60 : 80}
        />
        <Tooltip 
          content={
            <CustomTooltip 
              metric={metric} 
              previousValue={hoveredIndex !== null && hoveredIndex > 0 ? filteredData[hoveredIndex - 1]?.[metric] : undefined}
            />
          }
          cursor={{ 
            stroke: theme === "dark" ? "hsl(220, 12%, 25%)" : "hsl(220, 12%, 85%)",
            strokeWidth: 1,
            strokeDasharray: "4 4",
          }}
        />
        <Area
          type="monotone"
          dataKey={metric}
          stroke={chartColors.stroke}
          fillOpacity={1}
          fill={isExpanded ? "url(#colorMetricExpanded)" : "url(#colorMetric)"}
          strokeWidth={2}
          dot={showDots ? { 
            fill: chartColors.fill, 
            stroke: theme === "dark" ? "hsl(220, 15%, 8%)" : "white",
            strokeWidth: 2,
            r: 5,
            cursor: "pointer",
            onClick: (e: any, payload: any) => {
              e.stopPropagation?.();
              if (payload?.payload) {
                handleDotClick(payload.payload);
              }
            },
          } : false}
          activeDot={{
            fill: chartColors.fill,
            stroke: theme === "dark" ? "hsl(220, 15%, 8%)" : "white",
            strokeWidth: 2,
            r: 6,
            cursor: "pointer",
            onClick: (e: any, payload: any) => {
              if (payload?.payload) {
                handleDotClick(payload.payload);
              }
            },
          }}
          animationDuration={500}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  const selectedIndex = selectedMonth ? filteredData.findIndex(d => d.month === selectedMonth.month) : -1;
  const previousMonthData = selectedIndex > 0 ? filteredData[selectedIndex - 1] : undefined;

  return (
    <>
      <Card 
        className="lg:col-span-2 cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => setIsExpanded(true)}
        data-testid="card-transaction-volume"
      >
        <CardHeader className="flex flex-row items-center justify-between gap-2 sm:gap-4 pb-4 flex-wrap px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg truncate">Transaction Volume</CardTitle>
            <Badge 
              variant="secondary" 
              className={`no-default-hover-elevate no-default-active-elevate text-xs ${isGrowthPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {isGrowthPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {isGrowthPositive ? "+" : ""}{monthlyGrowth.toFixed(1)}%
            </Badge>
          </div>
          <Button 
            size="icon" 
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            data-testid="button-expand-chart"
            className="shrink-0"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="h-64 sm:h-72" data-testid="chart-transaction-volume">
            {renderChart(window.innerWidth < 640 ? 256 : 288, false, window.innerWidth < 640)}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Click anywhere on the chart to view detailed analytics
          </p>
        </CardContent>
      </Card>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="p-4 sm:p-6 pb-0 shrink-0">
            <div className="flex items-start justify-between gap-2 sm:gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-xl truncate">Transaction Volume Analytics</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Full year overview with detailed metrics and trends
                </DialogDescription>
              </div>
              <Badge 
                variant="secondary" 
                className={`no-default-hover-elevate no-default-active-elevate text-xs shrink-0 ${isGrowthPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
              >
                {isGrowthPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {isGrowthPositive ? "+" : ""}{monthlyGrowth.toFixed(1)}%
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                  <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-time-range">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3m">Last 3 Months</SelectItem>
                    <SelectItem value="6m">Last 6 Months</SelectItem>
                    <SelectItem value="1y">1 Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
                  <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-metric-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volume">Transaction Volume</SelectItem>
                    <SelectItem value="activeLoads">All Loads</SelectItem>
                    <SelectItem value="carrierSignups">Carrier Signups</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExportCSV}
                  data-testid="button-export-csv"
                  className="flex-1 sm:flex-none"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExportPDF}
                  data-testid="button-export-pdf"
                  className="flex-1 sm:flex-none"
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-0 border border-border rounded-lg overflow-hidden">
              <div className={`flex-1 p-3 sm:p-4 ${selectedMonth ? "lg:pr-0" : ""} min-w-0`}>
                <div className="h-[300px] sm:h-[350px]" data-testid="chart-expanded-view">
                  {renderChart(window.innerWidth < 640 ? 300 : 350, true, window.innerWidth < 640)}
                </div>
              </div>

              {selectedMonth && (
                <MonthDetailPanel 
                  data={selectedMonth}
                  previousData={previousMonthData}
                  onClose={() => setSelectedMonth(null)}
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                <div className="text-muted-foreground text-xs sm:text-sm mb-1">Total Volume (YTD)</div>
                <div className="text-xl sm:text-2xl font-bold font-mono truncate">
                  Rs. {(fullYearData.reduce((sum, d) => sum + d.volume, 0) / 10000000).toFixed(1)}Cr
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                <div className="text-muted-foreground text-xs sm:text-sm mb-1">Avg Monthly Volume</div>
                <div className="text-xl sm:text-2xl font-bold font-mono truncate">
                  Rs. {(fullYearData.reduce((sum, d) => sum + d.volume, 0) / fullYearData.length / 100000).toFixed(1)}L
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                <div className="text-muted-foreground text-xs sm:text-sm mb-1">Total Completed Loads</div>
                <div className="text-xl sm:text-2xl font-bold font-mono truncate">
                  {fullYearData.reduce((sum, d) => sum + d.completedLoads, 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                <div className="text-muted-foreground text-xs sm:text-sm mb-1">Avg Load Price</div>
                <div className="text-xl sm:text-2xl font-bold font-mono truncate">
                  Rs. {Math.round(fullYearData.reduce((sum, d) => sum + d.avgLoadPrice, 0) / fullYearData.length).toLocaleString()}
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Click on any data point in the chart to view detailed monthly metrics
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
