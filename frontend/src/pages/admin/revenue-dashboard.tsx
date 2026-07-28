import { useState, useMemo, useCallback } from "react";
import { jsPDF } from "jspdf";
import { useLocation, useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  ChevronLeft,
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Package,
  Users,
  Building,
  MapPin,
  Calendar,
  Truck,
  Filter,
  Download,
  FileText,
  CreditCard,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Search,
  FileDown,
  BarChart3,
  PieChart as PieChartIcon,
  Table2,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import { useTheme } from "@/lib/theme-provider";
import { useToast } from "@/hooks/use-toast";

type MetricView = "overview" | "sources" | "contributors" | "loadTypes" | "regions" | "timeline" | "transactions" | "profitability";

// Helper function to format currency - defined outside component to avoid initialization issues
const formatCurrency = (value: number) => {
  if (value >= 10000000) {
    return `Rs. ${(value / 10000000).toFixed(2)}Cr`;
  }
  if (value >= 100000) {
    return `Rs. ${(value / 100000).toFixed(1)}L`;
  }
  if (value >= 1000) {
    return `Rs. ${(value / 1000).toFixed(0)}K`;
  }
  return `Rs. ${value.toFixed(0)}`;
};

const formatCurrencyFull = (value: number) =>
  `Rs. ${Math.round(value).toLocaleString("en-IN")}`;

const roundInr = (n: number) => Number(n.toFixed(2));

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

function csvTitleBlock(reportTitle: string, periodLabel: string): CsvTable {
  return [
    ["Revenue Intelligence Dashboard"],
    [reportTitle],
    ["Reporting period", periodLabel],
    ["Generated (UTC)", new Date().toISOString()],
    [],
  ];
}

function platformFeeFromLoad(load: Record<string, unknown>): number {
  try {
    const raw = load.priceBreakdown;
    const bd = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
      platformMargin?: number;
      platformMarginPercent?: number;
    } | null;
    if (bd?.platformMargin) return parseFloat(String(bd.platformMargin));
    const gross = parseFloat(String(load.adminFinalPrice || 0));
    const payout = parseFloat(String(load.finalPrice || 0));
    if (gross > 0 && payout > 0 && gross > payout) return gross - payout;
    const loadValue = parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
    if (bd?.platformMarginPercent) {
      return loadValue * (parseFloat(String(bd.platformMarginPercent)) / 100);
    }
    return 0;
  } catch {
    return 0;
  }
}

function filterLoadsForLocalCalendarDay(
  loads: Record<string, unknown>[],
  dayStart: Date,
): Record<string, unknown>[] {
  const start = dayStart.getTime();
  const end = start + 86400000;
  return loads.filter((load) => {
    const t = new Date(String(load.createdAt || 0)).getTime();
    return !Number.isNaN(t) && t >= start && t < end;
  });
}

function localMidnightForOffsetFromToday(offsetDays: number): Date {
  const base = new Date();
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - offsetDays, 0, 0, 0, 0);
}

type DailyAiInsightLine = { text: string; type: "success" | "info" };

type DailyAiInsightsBundle = {
  metrics: { loads: number; revenue: number; delivered: number; platformFees: number };
  automatedAnalysis: DailyAiInsightLine[];
  financeRecommendations: DailyAiInsightLine[];
  marketPredictiveInsights: DailyAiInsightLine[];
};

function buildDailyFinancialInsights(
  dayLoads: Record<string, unknown>[],
  users: { id?: string; username?: string; companyName?: string }[],
  allBids: unknown[],
  context: { fullTotalRevenue: number; fullLoadsCount: number; fullPlatformFees: number },
): DailyAiInsightsBundle {
  const totalRevenue = dayLoads.reduce(
    (s, l) => s + parseFloat(String(l.adminFinalPrice || l.finalPrice || 0)),
    0,
  );
  const loadsCount = dayLoads.length;
  const deliveredLoadsCount = dayLoads.filter((l) => l.status === "delivered").length;
  const totalPlatformFees = roundInr(dayLoads.reduce((s, l) => s + platformFeeFromLoad(l), 0));
  const avgLoadRevenue = loadsCount > 0 ? totalRevenue / loadsCount : 0;
  const takeRatePct = totalRevenue > 0 ? (totalPlatformFees / totalRevenue) * 100 : 0;
  const totalBids = allBids.length;
  const bidsPerLoad = context.fullLoadsCount > 0 ? totalBids / context.fullLoadsCount : 0;
  const pendingLoadShare =
    loadsCount > 0 ? Math.round(((loadsCount - deliveredLoadsCount) / loadsCount) * 100) : 0;

  if (loadsCount === 0) {
    return {
      metrics: { loads: 0, revenue: 0, delivered: 0, platformFees: 0 },
      automatedAnalysis: [
        { text: "No loads were created on this calendar day in the synced dataset.", type: "info" },
      ],
      financeRecommendations: [
        {
          text: `Network gross is ${formatCurrency(context.fullTotalRevenue)} across ${context.fullLoadsCount} loads with ${formatCurrency(context.fullPlatformFees)} in captured platform margin—this day simply has no new bookings in the feed.`,
          type: "info",
        },
      ],
      marketPredictiveInsights: [
        {
          text: "Quiet days often align with holidays, shipper blackout windows, or batch TMS uploads—compare against your commercial calendar before changing targets.",
          type: "info",
        },
        {
          text: "Compliance and settlement queues still need coverage on light days so carriers stay liquid when volumes snap back.",
          type: "info",
        },
      ],
    };
  }

  const loadTypeMap: Record<string, { loads: number; revenue: number }> = {};
  const shipperMap: Record<
    string,
    { spend: number; loads: number; name: string; company: string; region: string }
  > = {};
  const carrierMap: Record<string, { loads: number; loadValue: number; name: string }> = {};
  const regionMap: Record<string, { loads: number; revenue: number }> = {};

  for (const load of dayLoads) {
    const type = String(load.requiredTruckType || "Unknown Type");
    const loadRevenue = parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
    if (!loadTypeMap[type]) loadTypeMap[type] = { loads: 0, revenue: 0 };
    loadTypeMap[type].loads += 1;
    loadTypeMap[type].revenue += loadRevenue;

    if (load.shipperId) {
      const shipper = users.find((u) => u.id === load.shipperId);
      if (!shipperMap[String(load.shipperId)]) {
        shipperMap[String(load.shipperId)] = {
          spend: 0,
          loads: 0,
          name: shipper?.username || "Unknown",
          company: shipper?.companyName || shipper?.username || "Unknown Company",
          region: "India",
        };
      }
      const sm = shipperMap[String(load.shipperId)];
      sm.spend += loadRevenue;
      sm.loads += 1;
    }

    if (load.assignedCarrierId) {
      const carrier = users.find((u) => u.id === load.assignedCarrierId);
      if (!carrierMap[String(load.assignedCarrierId)]) {
        carrierMap[String(load.assignedCarrierId)] = {
          loads: 0,
          loadValue: 0,
          name: carrier?.companyName || carrier?.username || "Unknown Carrier",
        };
      }
      const cm = carrierMap[String(load.assignedCarrierId)];
      cm.loads += 1;
      cm.loadValue += loadRevenue;
    }

    const region = String(load.pickupCity || "Unknown");
    if (!regionMap[region]) regionMap[region] = { loads: 0, revenue: 0 };
    regionMap[region].loads += 1;
    regionMap[region].revenue += loadRevenue;
  }

  const loadTypeRevenue = Object.entries(loadTypeMap)
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  const shipperContributors = Object.entries(shipperMap)
    .map(([id, data]) => ({
      shipperId: id,
      ...data,
      contribution: totalRevenue > 0 ? (data.spend / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  const carrierContributors = Object.entries(carrierMap)
    .map(([id, data]) => ({
      carrierId: id,
      ...data,
      commissionGenerated: data.loadValue * 0.08,
    }))
    .sort((a, b) => b.commissionGenerated - a.commissionGenerated);

  const regionRevenue = Object.entries(regionMap)
    .map(([region, data]) => ({
      region,
      revenue: data.revenue,
      heatValue: totalRevenue > 0 ? data.revenue / totalRevenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topShipperRow = shipperContributors[0];
  const topShipperShare = topShipperRow ? topShipperRow.contribution : 0;
  const loadsPerCarrier =
    carrierContributors.length > 0 ? loadsCount / carrierContributors.length : loadsCount;
  const strongestRegion = regionRevenue[0]?.region ?? "N/A";
  const weakestRegion =
    regionRevenue.length > 0 ? regionRevenue[regionRevenue.length - 1].region : "N/A";
  const simulatedLoadTxn = totalRevenue * 0.92;
  const simulatedPlatformLine = simulatedLoadTxn * 0.15;

  const automatedAnalysis: DailyAiInsightLine[] = [
    {
      text: `${loadTypeRevenue[0]?.type || "Top load type"} led this day's revenue mix.`,
      type: "success",
    },
    {
      text: `${topShipperRow?.company || "Top shipper"} was the largest spender among shippers with activity this day.`,
      type: "info",
    },
    {
      text: `${loadsCount} loads posted ${formatCurrency(totalRevenue)} in gross for this date.`,
      type: "success",
    },
    {
      text: `${carrierContributors.length} carriers touched this day's executions.`,
      type: "info",
    },
    {
      text: `Lane breadth spans ${regionRevenue.length} origin clusters—${weakestRegion} is the lightest in this day's set for follow-up.`,
      type: "info",
    },
  ];

  const financeRecommendations: DailyAiInsightLine[] = [
    {
      text: `This day recorded ${formatCurrency(totalRevenue)} gross (${formatCurrency(avgLoadRevenue)} per load) vs ${formatCurrency(context.fullTotalRevenue)} all-time in the dashboard window—stack the ~32% illustrative margin assumption against ${formatCurrency(totalPlatformFees)} in platform margin parsed from price breakdowns.`,
      type: "info",
    },
    {
      text: `Realised take rate on the day's gross is ${takeRatePct.toFixed(1)}% (${formatCurrency(
        totalPlatformFees,
      )}). Simulated fee lines still allocate ~${formatCurrency(
        simulatedPlatformLine,
      )} to “platform fee per load” inside ${formatCurrency(simulatedLoadTxn)} of modelled transaction revenue.`,
      type: "success",
    },
    {
      text: `${topShipperRow?.company ?? "Your top shipper that day"} is ${topShipperShare.toFixed(
        1,
      )}% of the day's spend across ${shipperContributors.length} shipper accounts.`,
      type: "info",
    },
    {
      text: `${carrierContributors.length} carriers executed ${loadsCount} loads (~${loadsPerCarrier.toFixed(
        1,
      )} loads per carrier)—watch utilisation before opening new lanes.`,
      type: "success",
    },
    {
      text: `Strongest origin that day is ${strongestRegion}; lightest among active lanes is ${weakestRegion}.`,
      type: "info",
    },
  ];

  const marketPredictiveInsights: DailyAiInsightLine[] = [
    {
      text: `Spot economics still track diesel and toll resets—${loadTypeRevenue[0]?.type ?? "FTL"} lanes compress when pump prices move faster than contract resets; keep quarterly indexation in mind on ${strongestRegion !== "N/A" ? strongestRegion : "core metro"} corridors.`,
      type: "success",
    },
    {
      text: `${deliveredLoadsCount} of ${loadsCount} loads delivered (${pendingLoadShare}% still in-flight). Faster POD and GST-clean invoicing protect carrier liquidity on ${formatCurrency(
        avgLoadRevenue,
      )} typical tickets.`,
      type: "info",
    },
    {
      text:
        totalBids > 0
          ? `${totalBids} marketplace bids network-wide (~${bidsPerLoad.toFixed(
              1,
            )} per load) contextualise liquidity—pair that with this day's ${takeRatePct.toFixed(
              1,
            )}% take rate.`
          : `As bid depth returns, expect spreads to tighten—monitor take rate on ${formatCurrency(
              avgLoadRevenue,
            )} tickets.`,
      type: "success",
    },
    {
      text: `E-way bill, GST, and border checks still drive detention—keep compliance prompts tight across the ${regionRevenue.length} active origin pockets from this day.`,
      type: "info",
    },
  ];

  return {
    metrics: {
      loads: loadsCount,
      revenue: roundInr(totalRevenue),
      delivered: deliveredLoadsCount,
      platformFees: totalPlatformFees,
    },
    automatedAnalysis,
    financeRecommendations,
    marketPredictiveInsights,
  };
}

function downloadAiInsightsThreeDayPdf(
  sections: {
    heading: string;
    bundle: DailyAiInsightsBundle;
  }[],
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 44;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addParagraph = (text: string, fontSize: number, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxW);
    const lineHeight = fontSize * 1.25;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  addParagraph("AI-Powered Financial Insights", 18, "bold");
  addParagraph(`Generated ${new Date().toLocaleString("en-IN")} (local time)`, 9);
  addParagraph(
    "Three-day snapshot: today, yesterday, and the day before yesterday (loads filtered by created date, local calendar).",
    10,
  );
  y += 8;

  for (const sec of sections) {
    addParagraph(sec.heading, 14, "bold");
    const { metrics: m } = sec.bundle;
    addParagraph(
      `Loads ${m.loads} · Gross Rs. ${Math.round(m.revenue).toLocaleString("en-IN")} · Delivered ${m.delivered} · Platform margin Rs. ${Math.round(m.platformFees).toLocaleString("en-IN")}`,
      10,
      "bold",
    );
    y += 4;
    addParagraph("Automated analysis", 11, "bold");
    for (const item of sec.bundle.automatedAnalysis) {
      addParagraph(`• ${item.text}`, 9);
    }
    y += 2;
    addParagraph("Recommendations", 11, "bold");
    for (const item of sec.bundle.financeRecommendations) {
      addParagraph(`• ${item.text}`, 9);
    }
    y += 2;
    addParagraph("Market & transport outlook", 11, "bold");
    for (const item of sec.bundle.marketPredictiveInsights) {
      addParagraph(`• ${item.text}`, 9);
    }
    y += 14;
  }

  doc.save(`ai-financial-insights-3day-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function RevenueDashboard() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/revenue/:metric?");
  const { theme } = useTheme();
  const { toast } = useToast();
  
  // Fetch real data from APIs
  const { data: loads = [] } = useQuery<any[]>({
    queryKey: ["/api/loads"],
  });

  const { data: allBids = [] } = useQuery<any[]>({
    queryKey: ["/api/bids"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });
  
  // Calculate real revenue data from actual loads
  const revenueData = useMemo(() => {
    const toMonthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;
    const monthShort = (date: Date) => date.toLocaleString("en-IN", { month: "short" });
    const monthLong = (date: Date) => date.toLocaleString("en-IN", { month: "long", year: "numeric" });
    
    // Calculate total revenue from real loads
    const totalRevenue = loads.reduce((sum, load) => {
      return sum + parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
    }, 0);

    // Calculate revenue by source (simplified - mainly from load transactions)
    const loadTransactionRevenue = totalRevenue * 0.92; // Assume 92% from loads
    const subscriptionRevenue = totalRevenue * 0.05; // Assume 5% from subscriptions
    const addOnRevenue = totalRevenue * 0.02; // Assume 2% from add-ons
    const penaltyRevenue = totalRevenue * 0.01; // Assume 1% from penalties

    const revenueBySource = [
      { source: "Load Transactions", category: "Freight commissions", amount: loadTransactionRevenue * 0.85, percentage: 78.2, trend: 12.4, color: "hsl(217, 91%, 48%)" },
      { source: "Load Transactions", category: "Platform fee per load", amount: loadTransactionRevenue * 0.15, percentage: 13.8, trend: 8.2, color: "hsl(217, 91%, 58%)" },
      { source: "Subscription Revenue", category: "Shipper subscriptions", amount: subscriptionRevenue * 0.6, percentage: 3, trend: 15.6, color: "hsl(142, 76%, 36%)" },
      { source: "Subscription Revenue", category: "Carrier premium subscriptions", amount: subscriptionRevenue * 0.4, percentage: 2, trend: 22.1, color: "hsl(142, 76%, 46%)" },
      { source: "Add-on Services", category: "Document verification fees", amount: addOnRevenue * 0.5, percentage: 1, trend: 5.3, color: "hsl(48, 96%, 53%)" },
      { source: "Add-on Services", category: "Priority support", amount: addOnRevenue * 0.5, percentage: 1, trend: 7.8, color: "hsl(48, 96%, 63%)" },
      { source: "Penalty/Adjustment", category: "Late cancellation fees", amount: penaltyRevenue, percentage: 1, trend: -3.2, color: "hsl(0, 72%, 51%)" },
    ];

    const sourceGroups = [
      { name: "Load Transactions", value: loadTransactionRevenue, color: "hsl(217, 91%, 48%)" },
      { name: "Subscriptions", value: subscriptionRevenue, color: "hsl(142, 76%, 36%)" },
      { name: "Add-on Services", value: addOnRevenue, color: "hsl(48, 96%, 53%)" },
      { name: "Penalties", value: penaltyRevenue, color: "hsl(0, 72%, 51%)" },
    ];

    // Calculate shipper contributors from real data
    const shipperMap: Record<string, { spend: number; loads: number; name: string; company: string; region: string }> = {};
    loads.forEach(load => {
      if (load.shipperId) {
        const shipper = users.find(u => u.id === load.shipperId);
        if (!shipperMap[load.shipperId]) {
          shipperMap[load.shipperId] = {
            spend: 0,
            loads: 0,
            name: shipper?.username || 'Unknown',
            company: shipper?.companyName || shipper?.username || 'Unknown Company',
            region: 'India', // Default region
          };
        }
        shipperMap[load.shipperId].spend += parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
        shipperMap[load.shipperId].loads += 1;
      }
    });

    const shipperContributors = Object.entries(shipperMap)
      .map(([shipperId, data]) => ({
        shipperId,
        name: data.name,
        company: data.company,
        totalSpend: data.spend,
        loadsBooked: data.loads,
        avgSpendPerLoad: data.loads > 0 ? Math.round(data.spend / data.loads) : 0,
        contribution: totalRevenue > 0 ? (data.spend / totalRevenue) * 100 : 0,
        region: data.region,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);

    // Calculate carrier contributors from real data
    const carrierMap: Record<string, { loads: number; loadValue: number; name: string; rating: number }> = {};
    loads.forEach(load => {
      if (load.assignedCarrierId) {
        const carrier = users.find(u => u.id === load.assignedCarrierId);
        if (!carrierMap[load.assignedCarrierId]) {
          carrierMap[load.assignedCarrierId] = {
            loads: 0,
            loadValue: 0,
            name: carrier?.companyName || carrier?.username || 'Unknown Carrier',
            rating: 4.5,
          };
        }
        carrierMap[load.assignedCarrierId].loads += 1;
        carrierMap[load.assignedCarrierId].loadValue += parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
      }
    });

    const carrierContributors = Object.entries(carrierMap)
      .map(([carrierId, data]) => {
        const commission = data.loadValue * 0.08; // Assume 8% commission
        return {
          carrierId,
          name: data.name,
          loadsExecuted: data.loads,
          loadValue: data.loadValue,
          commissionGenerated: commission,
          contribution: loadTransactionRevenue > 0 ? (commission / loadTransactionRevenue) * 100 : 0,
          rating: data.rating,
        };
      })
      .sort((a, b) => b.commissionGenerated - a.commissionGenerated);

    // Calculate load type revenue from real data
    const loadTypeMap: Record<string, { loads: number; revenue: number }> = {};
    const loadTypeMonthMap: Record<string, Record<string, number>> = {};
    loads.forEach(load => {
      const type = load.requiredTruckType || 'Unknown Type';
      const loadDate = new Date(load.createdAt || Date.now());
      const monthKey = toMonthKey(loadDate);
      if (!loadTypeMap[type]) {
        loadTypeMap[type] = { loads: 0, revenue: 0 };
      }
      if (!loadTypeMonthMap[type]) {
        loadTypeMonthMap[type] = {};
      }
      if (!loadTypeMonthMap[type][monthKey]) {
        loadTypeMonthMap[type][monthKey] = 0;
      }
      loadTypeMap[type].loads += 1;
      const loadRevenue = parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
      loadTypeMap[type].revenue += loadRevenue;
      loadTypeMonthMap[type][monthKey] += loadRevenue;
    });

    const loadTypeRevenue = Object.entries(loadTypeMap)
      .map(([type, data]) => {
        const typeMonthEntries = Object.entries(loadTypeMonthMap[type] || {});
        const peakMonthEntry = typeMonthEntries.sort((a, b) => b[1] - a[1])[0];
        let peakMonth = "N/A";
        if (peakMonthEntry) {
          const [year, month] = peakMonthEntry[0].split("-").map(Number);
          peakMonth = monthLong(new Date(year, month, 1));
        }
        return {
          type,
          totalLoads: data.loads,
          avgRate: data.loads > 0 ? Math.round(data.revenue / data.loads) : 0,
          revenue: data.revenue,
          peakMonth,
          yoyGrowth: 15, // Simplified
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate region revenue from real data
    const regionMap: Record<string, { loads: number; revenue: number }> = {};
    loads.forEach(load => {
      const region = load.pickupCity || 'Unknown';
      if (!regionMap[region]) {
        regionMap[region] = { loads: 0, revenue: 0 };
      }
      regionMap[region].loads += 1;
      regionMap[region].revenue += parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
    });

    const regionRevenue = Object.entries(regionMap)
      .map(([region, data]) => ({
        region,
        code: region.substring(0, 2).toUpperCase(),
        loadsExecuted: data.loads,
        revenue: data.revenue,
        yoyGrowth: 15, // Simplified
        topCustomer: shipperContributors[0]?.company || 'Unknown',
        heatValue: data.revenue / totalRevenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Calculate monthly revenue from real data (rolling 12 months ending on latest load month)
    const monthlyMap: Record<string, { revenue: number; loads: number }> = {};
    const validLoadDates = loads
      .map(load => new Date(load.createdAt || Date.now()))
      .filter(date => !Number.isNaN(date.getTime()));
    const latestDataDate = validLoadDates.length > 0
      ? new Date(Math.max(...validLoadDates.map(d => d.getTime())))
      : new Date();

    loads.forEach(load => {
      const loadDate = new Date(load.createdAt || Date.now());
      const monthKey = toMonthKey(loadDate);
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { revenue: 0, loads: 0 };
      }
      monthlyMap[monthKey].revenue += parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
      monthlyMap[monthKey].loads += 1;
    });

    const monthSequence = Array.from({ length: 12 }, (_, idx) => {
      const date = new Date(latestDataDate.getFullYear(), latestDataDate.getMonth() - (11 - idx), 1);
      return date;
    });

    const monthlyRevenue = monthSequence.map((date) => {
      const data = monthlyMap[toMonthKey(date)] || { revenue: 0, loads: 0 };
      return {
        month: monthShort(date),
        fullMonth: monthLong(date),
        revenue: data.revenue,
        loads: data.loads,
        growth: 0,
        loadTransactions: data.revenue * 0.92,
        subscriptions: data.revenue * 0.05,
        addOns: data.revenue * 0.02,
        penalties: data.revenue * 0.01,
      };
    });
    monthlyRevenue.forEach((month, idx) => {
      if (idx === 0) {
        month.growth = 0;
        return;
      }
      const previous = monthlyRevenue[idx - 1].revenue;
      month.growth = previous > 0 ? Number((((month.revenue - previous) / previous) * 100).toFixed(1)) : 0;
    });

    const sumQuarterRevenueFromMonth = (startMonthDate: Date) => {
      let sum = 0;
      for (let i = 0; i < 3; i++) {
        const d = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth() + i, 1);
        sum += (monthlyMap[toMonthKey(d)] || { revenue: 0 }).revenue;
      }
      return sum;
    };

    // Create transactions from real loads (full list for exports; UI tables paginate/limit separately)
    const revenueTransactions = loads
      .map(load => {
        const shipper = users.find(u => u.id === load.shipperId);
        const carrier = users.find(u => u.id === load.assignedCarrierId);
        const loadValue = parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
        let breakdown: { platformMargin?: number; platformMarginPercent?: number } | null = null;
        try {
          const raw = load.priceBreakdown;
          breakdown = typeof raw === "string" ? JSON.parse(raw) : raw ?? null;
        } catch { breakdown = null; }
        // Use saved platformMargin from priceBreakdown if available,
        // else derive from adminFinalPrice - finalPrice (gross - carrier payout = platform fee),
        // else fall back to platformMarginPercent calculation
        const adminGross = parseFloat(String(load.adminFinalPrice || 0));
        const carrierPayout = parseFloat(String(load.finalPrice || 0));
        const derivedMargin = adminGross > 0 && carrierPayout > 0 && adminGross > carrierPayout
          ? adminGross - carrierPayout
          : 0;
        const platformFee = breakdown?.platformMargin
          ? parseFloat(String(breakdown.platformMargin))
          : derivedMargin > 0
          ? derivedMargin
          : breakdown?.platformMarginPercent
          ? loadValue * (parseFloat(String(breakdown.platformMarginPercent)) / 100)
          : 0;
        return {
          date: new Date(load.createdAt || Date.now()),
          loadId: load.adminReferenceNumber 
            ? `LD-${load.adminReferenceNumber}`
            : load.shipperLoadNumber
            ? `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`
            : load.id?.slice(0, 8).toUpperCase() || 'Unknown',
          shipper: shipper?.companyName || shipper?.username || 'Unknown',
          shipperId: load.shipperId || 'Unknown',
          carrier: carrier?.companyName || carrier?.username || 'Unknown',
          carrierId: load.assignedCarrierId || 'Unknown',
          loadValue,
          platformFee,
          subscriptionFee: 0,
          paymentStatus: load.status === 'delivered' ? 'Paid' : 'Pending',
          region: load.pickupCity || 'Unknown',
          loadType: load.requiredTruckType || 'Unknown',
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    // QoQ %: build 4 actual calendar quarters ending at the current quarter
    const now = new Date();
    const currentQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const quarterlyData = Array.from({ length: 4 }, (_, i) => {
      // i=0 → current quarter, i=1 → 1 quarter ago, etc. Then reverse for display order
      const offset = 3 - i; // so final array is oldest→newest
      const qStartMonth = currentQuarterStart.getMonth() - offset * 3;
      const qStart = new Date(currentQuarterStart.getFullYear(), qStartMonth, 1);
      const quarterNumber = Math.floor(qStart.getMonth() / 3) + 1;

      // Sum revenue for the 3 months of this quarter from monthlyMap
      let currentRev = 0;
      let loadsCount = 0;
      for (let m = 0; m < 3; m++) {
        const mDate = new Date(qStart.getFullYear(), qStart.getMonth() + m, 1);
        const key = toMonthKey(mDate);
        currentRev += monthlyMap[key]?.revenue || 0;
        loadsCount += monthlyMap[key]?.loads || 0;
      }

      const prevRev = sumQuarterRevenueFromMonth(new Date(qStart.getFullYear(), qStart.getMonth() - 3, 1));
      let growth: number | null = null;
      if (prevRev > 0) {
        growth = Number((((currentRev - prevRev) / prevRev) * 100).toFixed(1));
      } else if (currentRev > 0) {
        growth = null;
      } else {
        growth = 0;
      }

      return {
        quarter: `Q${quarterNumber} ${qStart.getFullYear()}`,
        revenue: currentRev,
        loads: loadsCount,
        growth,
      };
    });

    const forecast = Array.from({ length: 3 }, (_, idx) => {
      const nextMonthDate = new Date(latestDataDate.getFullYear(), latestDataDate.getMonth() + idx + 1, 1);
      return {
        month: nextMonthDate.toLocaleString("en-IN", { month: "short", year: "numeric" }),
        projected: totalRevenue * (0.1 + idx * 0.01),
        confidence: [85, 78, 72][idx],
      };
    });

    const deliveredLoadsCount = loads.filter((l) => l.status === "delivered").length;
    const totalPlatformFees = roundInr(revenueTransactions.reduce((sum, t) => sum + t.platformFee, 0));
    const avgLoadRevenue = loads.length > 0 ? totalRevenue / loads.length : 0;
    const simulatedLoadTxn = totalRevenue * 0.92;
    const simulatedPlatformLine = simulatedLoadTxn * 0.15;
    const topShipperRow = shipperContributors[0];
    const topShipperShare = topShipperRow ? topShipperRow.contribution : 0;
    const loadsPerCarrier =
      carrierContributors.length > 0 ? loads.length / carrierContributors.length : loads.length;
    const pendingLoadShare =
      loads.length > 0 ? Math.round(((loads.length - deliveredLoadsCount) / loads.length) * 100) : 0;
    const totalBids = allBids.length;
    const bidsPerLoad = loads.length > 0 ? totalBids / loads.length : 0;
    const takeRatePct = totalRevenue > 0 ? (totalPlatformFees / totalRevenue) * 100 : 0;
    const strongestRegion = regionRevenue[0]?.region ?? "N/A";
    const weakestRegion =
      regionRevenue.length > 0 ? regionRevenue[regionRevenue.length - 1].region : "N/A";

    const populatedMonths = monthlyRevenue.filter((m) => m.loads > 0);
    const sortedMonths = [...(populatedMonths.length > 0 ? populatedMonths : monthlyRevenue)].sort((a, b) => b.revenue - a.revenue);
    const bestMonth = sortedMonths[0] || { fullMonth: 'N/A', revenue: 0, loads: 0 };
    const worstMonth = sortedMonths[sortedMonths.length - 1] || { fullMonth: 'N/A', revenue: 0, loads: 0 };
    const dateRangeLabel = `${monthlyRevenue[0]?.fullMonth || "N/A"} - ${monthlyRevenue[monthlyRevenue.length - 1]?.fullMonth || "N/A"}`;

    // Actual average platform margin % derived from real load data
    const avgPlatformMarginPct = takeRatePct; // (totalPlatformFees / totalRevenue) * 100
    const estimatedCostPct = Math.max(0, 100 - avgPlatformMarginPct) / 100;

    const profitInsights = [
      { label: "Gross Revenue", value: totalRevenue, trend: 14.2, icon: "up" as const },
      { label: "Estimated Cost", value: totalRevenue * estimatedCostPct, trend: 5.8, icon: "up" as const },
      { label: "Estimated Profit Margin", value: `${avgPlatformMarginPct.toFixed(1)}%`, trend: 2.1, icon: "up" as const },
      { label: "CAC (Customer Acquisition)", value: 12500, trend: -5.3, icon: "down" as const },
      { label: "LTV (Lifetime Value)", value: 285000, trend: 18.7, icon: "up" as const },
    ];

    const automatedAnalysis = [
      { text: `${loadTypeRevenue[0]?.type || "Top load type"} shows the highest revenue contribution.`, type: "success" as const },
      { text: `${shipperContributors[0]?.company || "Top shipper"} is your top-paying customer.`, type: "info" as const },
      { text: `Total of ${loads.length} loads processed with ${formatCurrency(totalRevenue)} revenue.`, type: "success" as const },
      { text: `${carrierContributors.length} carriers are actively generating commissions.`, type: "info" as const },
      {
        text: `Consider expanding in ${regionRevenue[regionRevenue.length - 1]?.region || "new regions"} for growth.`,
        type: "info" as const,
      },
    ];

    const financeRecommendations = [
      {
        text: `Recorded gross from loads is ${formatCurrency(totalRevenue)} (${formatCurrency(avgLoadRevenue)} per load). The profitability tiles still use a flat ~32% estimated margin on gross—stack that assumption against ${formatCurrency(totalPlatformFees)} in platform margin actually captured in price breakdowns.`,
        type: "info" as const,
      },
      {
        text: `Take rate on gross is ${takeRatePct.toFixed(1)}% (${formatCurrency(totalPlatformFees)} platform margin). The revenue mix model allocates ~${formatCurrency(simulatedPlatformLine)} to “platform fee per load” within ${formatCurrency(simulatedLoadTxn)} simulated transaction revenue—reconcile when setting fees and carrier payouts.`,
        type: "success" as const,
      },
      {
        text: `${topShipperRow?.company ?? "Your top shipper"} is ${topShipperShare.toFixed(1)}% of spend across ${shipperContributors.length} shipper accounts—pair growth targets with concentration limits typical for a load board / digital brokerage stack.`,
        type: "info" as const,
      },
      {
        text: `${carrierContributors.length} carriers cover ${loads.length} loads (~${loadsPerCarrier.toFixed(1)} loads per carrier). If utilisation stays skewed, recruit verified capacity on ${loadTypeRevenue[0]?.type ?? "your core"} equipment before marketing new lanes.`,
        type: "success" as const,
      },
      {
        text: `Origin revenue leader is ${strongestRegion}; lightest in your current top set is ${weakestRegion}. Route marketing spend toward lanes that already convert in your transaction log.`,
        type: "info" as const,
      },
    ];

    const marketPredictiveInsights = [
      {
        text: `Spot economics still track diesel and toll resets—${loadTypeRevenue[0]?.type ?? "FTL"} lanes compress when pump prices move faster than contract resets; plan quarterly indexation on repeat ${strongestRegion !== "N/A" ? strongestRegion : "metro"} corridors.`,
        type: "success" as const,
      },
      {
        text: `Peak billing in this window is ${bestMonth.fullMonth}. Indian road freight typically lifts around harvest, festive restock, and quarter-close—test ${forecast[0]?.month ?? "next month"} (${formatCurrency(forecast[0]?.projected ?? totalRevenue * 0.11)} directional forecast) against shipper tender calendars.`,
        type: "info" as const,
      },
      {
        text: `${deliveredLoadsCount} of ${loads.length} loads delivered (${pendingLoadShare}% in-flight). Faster POD, GST-clean invoicing, and predictable settlement improve carrier cash flow and reduce fallout on ${formatCurrency(avgLoadRevenue)} typical tickets.`,
        type: "info" as const,
      },
      {
        text:
          totalBids > 0
            ? `${totalBids} marketplace bids (~${bidsPerLoad.toFixed(1)} per load) signal liquidity—deeper bid stacks usually tighten clearing spreads; watch how that interacts with your ${takeRatePct.toFixed(1)}% realised take rate.`
            : `As bid volume grows on posted loads, expect clearing spreads to tighten—monitor take rate on ${formatCurrency(avgLoadRevenue)} tickets and keep carrier response SLAs tight.`,
        type: "success" as const,
      },
      {
        text: `E-way bill, GST, and border checks still drive detention risk on inter-state legs—embed compliance checks in booking flows across your ${regionRevenue.length} active origin clusters to protect ${formatCurrency(totalRevenue)} network gross.`,
        type: "info" as const,
      },
    ].slice(0, 5);

    const aiInsights = automatedAnalysis;

    return {
      totalRevenue,
      revenueBySource,
      sourceGroups,
      shipperContributors,
      carrierContributors,
      loadTypeRevenue,
      regionRevenue,
      monthlyRevenue,
      transactions: revenueTransactions,
      quarterlyData,
      forecast,
      bestMonth,
      worstMonth,
      dateRangeLabel,
      profitInsights,
      aiInsights,
      automatedAnalysis,
      financeRecommendations,
      marketPredictiveInsights,
      avgPlatformMarginPct,
      estimatedCostPct,
    };
  }, [loads, users, allBids]);

  const fullBookPlatformFees = useMemo(
    () =>
      roundInr(
        loads.reduce(
          (s, l) => s + platformFeeFromLoad(l as Record<string, unknown>),
          0,
        ),
      ),
    [loads],
  );

  const handleDownloadAiInsightsThreeDayPdf = useCallback(() => {
    try {
      const ctx = {
        fullTotalRevenue: revenueData.totalRevenue,
        fullLoadsCount: loads.length,
        fullPlatformFees: fullBookPlatformFees,
      };
      const loadRecords = loads as Record<string, unknown>[];
      const sections = [0, 1, 2].map((offset) => {
        const day = localMidnightForOffsetFromToday(offset);
        const dayLoads = filterLoadsForLocalCalendarDay(loadRecords, day);
        const label =
          offset === 0 ? "Today" : offset === 1 ? "Yesterday" : "Day before yesterday";
        const heading = `${label} — ${day.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`;
        return {
          heading,
          bundle: buildDailyFinancialInsights(dayLoads, users, allBids, ctx),
        };
      });
      downloadAiInsightsThreeDayPdf(sections);
      toast({
        title: "PDF ready",
        description: "Downloaded AI insights for today, yesterday, and the day before yesterday.",
      });
    } catch (err) {
      toast({
        title: "PDF export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [loads, users, allBids, revenueData.totalRevenue, fullBookPlatformFees, toast]);
  
  const initialView = (params?.metric as MetricView) || "overview";
  const [activeView, setActiveView] = useState<MetricView>(initialView);
  const [timeRange, setTimeRange] = useState<string>("1y");
  const [sortBy, setSortBy] = useState<string>("revenue");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [contributorTab, setContributorTab] = useState<"shippers" | "carriers">("shippers");

  const chartColors = {
    primary: theme === "dark" ? "hsl(217, 91%, 65%)" : "hsl(217, 91%, 48%)",
    secondary: theme === "dark" ? "hsl(142, 76%, 50%)" : "hsl(142, 76%, 36%)",
    warning: theme === "dark" ? "hsl(48, 96%, 60%)" : "hsl(48, 96%, 53%)",
    danger: theme === "dark" ? "hsl(0, 72%, 55%)" : "hsl(0, 72%, 51%)",
  };

  const handleExport = useCallback(
    (type: string) => {
      const stamp = new Date().toISOString().slice(0, 10);
      const period = revenueData.dateRangeLabel;

      const buildTransactionRows = () =>
        [...loads]
          .map((load: Record<string, unknown>) => {
            const shipper = users.find((u: { id?: string }) => u.id === load.shipperId);
            const carrier = users.find((u: { id?: string }) => u.id === load.assignedCarrierId);
            const loadValue = parseFloat(String(load.adminFinalPrice || load.finalPrice || 0));
            const created = load.createdAt ? new Date(String(load.createdAt)) : new Date();
            const shipperRec = shipper as { companyName?: string; username?: string } | undefined;
            const carrierRec = carrier as { companyName?: string; username?: string } | undefined;
            return {
              dateIso: Number.isNaN(created.getTime()) ? "" : created.toISOString(),
              dateDisplay: Number.isNaN(created.getTime())
                ? ""
                : created.toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
              loadId: load.adminReferenceNumber
                ? `LD-${load.adminReferenceNumber}`
                : load.shipperLoadNumber
                ? `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`
                : String(load.id ?? "Unknown").slice(0, 8).toUpperCase(),
              shipper: String(shipperRec?.companyName || shipperRec?.username || "Unknown"),
              shipperId: String(load.shipperId ?? ""),
              carrier: String(carrierRec?.companyName || carrierRec?.username || "Unknown"),
              carrierId: String(load.assignedCarrierId ?? ""),
              loadValue: roundInr(loadValue),
              platformFee: roundInr((() => {
                try {
                  const raw = load.priceBreakdown;
                  const bd: { platformMargin?: number; platformMarginPercent?: number } | null =
                    typeof raw === "string" ? JSON.parse(raw) : raw ?? null;
                  if (bd?.platformMargin) return parseFloat(String(bd.platformMargin));
                  const gross = parseFloat(String(load.adminFinalPrice || 0));
                  const payout = parseFloat(String(load.finalPrice || 0));
                  if (gross > 0 && payout > 0 && gross > payout) return gross - payout;
                  if (bd?.platformMarginPercent) return loadValue * (parseFloat(String(bd.platformMarginPercent)) / 100);
                  return 0;
                } catch { return 0; }
              })()),
              subscriptionFee: 0,
              paymentStatus: load.status === "delivered" ? "Paid" : "Pending",
              region: String(load.pickupCity ?? "Unknown"),
              loadType: String(load.requiredTruckType ?? "Unknown"),
            };
          })
          .sort(
            (a, b) =>
              (b.dateIso ? new Date(b.dateIso).getTime() : 0) -
              (a.dateIso ? new Date(a.dateIso).getTime() : 0),
          );

      try {
        let csv = "";
        let fileSlug = "export";

        switch (type) {
          case "Full Revenue": {
            fileSlug = `full-revenue-intelligence-report-${stamp}`;
            const txs = buildTransactionRows();
            const rows: CsvTable = [
              ...csvTitleBlock("Full revenue intelligence report (detailed)", period),
              ["Section", "Executive summary"],
              [],
              ["Metric", "Value"],
              ["Total revenue (INR)", roundInr(revenueData.totalRevenue)],
              ["Total loads", loads.length],
              [
                "Average load value (INR)",
                loads.length ? roundInr(revenueData.totalRevenue / loads.length) : 0,
              ],
              ["Reporting window (dashboard)", period],
              ["Best month (revenue)", revenueData.bestMonth.fullMonth],
              ["Best month revenue (INR)", roundInr(revenueData.bestMonth.revenue)],
              ["Slowest month (revenue)", revenueData.worstMonth.fullMonth],
              ["Slowest month revenue (INR)", roundInr(revenueData.worstMonth.revenue)],
              [],
              ["Section", "Revenue by source — aggregated"],
              [],
              ["Source group", "Amount (INR)"],
              ...revenueData.sourceGroups.map((s) => [s.name, roundInr(s.value)]),
              [],
              ["Section", "Revenue by source — line items"],
              [],
              ["Source", "Category", "Amount (INR)", "Share %", "Trend %"],
              ...revenueData.revenueBySource.map((r) => [
                r.source,
                r.category,
                roundInr(r.amount),
                r.percentage,
                r.trend,
              ]),
              [],
              ["Section", "Monthly revenue (rolling 12 months)"],
              [],
              [
                "Month",
                "Month (full)",
                "Revenue (INR)",
                "Loads",
                "MoM growth %",
                "Load transactions (INR)",
                "Subscriptions (INR)",
                "Add-ons (INR)",
                "Penalties (INR)",
              ],
              ...revenueData.monthlyRevenue.map((m) => [
                m.month,
                m.fullMonth,
                roundInr(m.revenue),
                m.loads,
                m.growth,
                roundInr(m.loadTransactions),
                roundInr(m.subscriptions),
                roundInr(m.addOns),
                roundInr(m.penalties),
              ]),
              [],
              ["Section", "Quarterly performance"],
              [],
              ["Quarter", "Revenue (INR)", "Loads", "QoQ growth %"],
              ...revenueData.quarterlyData.map((q) => [
                q.quarter,
                roundInr(q.revenue),
                q.loads,
                q.growth == null ? "N/A" : q.growth,
              ]),
              [],
              ["Section", "Shipper contributors"],
              [],
              [
                "Shipper ID",
                "Company",
                "Contact name",
                "Region",
                "Total spend (INR)",
                "Loads booked",
                "Avg spend per load (INR)",
                "Contribution %",
              ],
              ...revenueData.shipperContributors.map((s) => [
                s.shipperId,
                s.company,
                s.name,
                s.region,
                roundInr(s.totalSpend),
                s.loadsBooked,
                roundInr(s.avgSpendPerLoad),
                Number(s.contribution.toFixed(2)),
              ]),
              [],
              ["Section", "Carrier contributors"],
              [],
              [
                "Carrier ID",
                "Carrier name",
                "Loads executed",
                "Load value (INR)",
                "Commission generated (INR)",
                "Contribution %",
                "Rating",
              ],
              ...revenueData.carrierContributors.map((c) => [
                c.carrierId,
                c.name,
                c.loadsExecuted,
                roundInr(c.loadValue),
                roundInr(c.commissionGenerated),
                Number(c.contribution.toFixed(2)),
                c.rating,
              ]),
              [],
              ["Section", "Revenue by load type"],
              [],
              [
                "Load type",
                "Total loads",
                "Avg rate (INR)",
                "Revenue (INR)",
                "Peak month",
                "YoY growth % (est.)",
              ],
              ...revenueData.loadTypeRevenue.map((l) => [
                l.type,
                l.totalLoads,
                roundInr(l.avgRate),
                roundInr(l.revenue),
                l.peakMonth,
                l.yoyGrowth,
              ]),
              [],
              ["Section", "Regional performance"],
              [],
              [
                "Region",
                "Code",
                "Loads executed",
                "Revenue (INR)",
                "YoY growth % (est.)",
                "Top customer",
                "Share of total revenue %",
              ],
              ...revenueData.regionRevenue.map((r) => [
                r.region,
                r.code,
                r.loadsExecuted,
                roundInr(r.revenue),
                r.yoyGrowth,
                r.topCustomer,
                r.heatValue != null ? Number((r.heatValue * 100).toFixed(2)) : "",
              ]),
              [],
              ["Section", "Transaction-level detail (all loads)"],
              [],
              [
                "Date (ISO)",
                "Date (display)",
                "Load ID",
                "Shipper",
                "Shipper ID",
                "Carrier",
                "Carrier ID",
                "Load value (INR)",
                "Platform fee (INR)",
                "Subscription fee (INR)",
                "Payment status",
                "Region",
                "Load type",
              ],
              ...txs.map((t) => [
                t.dateIso,
                t.dateDisplay,
                t.loadId,
                t.shipper,
                t.shipperId,
                t.carrier,
                t.carrierId,
                t.loadValue,
                t.platformFee,
                t.subscriptionFee,
                t.paymentStatus,
                t.region,
                t.loadType,
              ]),
            ];
            csv = buildCsv(rows);
            break;
          }
          case "Revenue by Source": {
            fileSlug = `revenue-by-source-${stamp}`;
            const rows: CsvTable = [
              ...csvTitleBlock("Revenue by source (detailed)", period),
              ["Source", "Category", "Amount (INR)", "Share %", "Trend %"],
              ...revenueData.revenueBySource.map((r) => [
                r.source,
                r.category,
                roundInr(r.amount),
                r.percentage,
                r.trend,
              ]),
            ];
            csv = buildCsv(rows);
            break;
          }
          case "Shipper Revenue Report":
          case "Shipper Revenue": {
            fileSlug = `shipper-revenue-${stamp}`;
            const rows: CsvTable = [
              ...csvTitleBlock("Shipper revenue report", period),
              [
                "Shipper ID",
                "Company",
                "Contact name",
                "Region",
                "Total spend (INR)",
                "Loads booked",
                "Avg spend per load (INR)",
                "Contribution %",
              ],
              ...revenueData.shipperContributors.map((s) => [
                s.shipperId,
                s.company,
                s.name,
                s.region,
                roundInr(s.totalSpend),
                s.loadsBooked,
                roundInr(s.avgSpendPerLoad),
                Number(s.contribution.toFixed(2)),
              ]),
            ];
            csv = buildCsv(rows);
            break;
          }
          case "Carrier Revenue Report":
          case "Carrier Revenue": {
            fileSlug = `carrier-revenue-${stamp}`;
            const rows: CsvTable = [
              ...csvTitleBlock("Carrier revenue report", period),
              [
                "Carrier ID",
                "Carrier name",
                "Loads executed",
                "Load value (INR)",
                "Commission generated (INR)",
                "Contribution %",
                "Rating",
              ],
              ...revenueData.carrierContributors.map((c) => [
                c.carrierId,
                c.name,
                c.loadsExecuted,
                roundInr(c.loadValue),
                roundInr(c.commissionGenerated),
                Number(c.contribution.toFixed(2)),
                c.rating,
              ]),
            ];
            csv = buildCsv(rows);
            break;
          }
          case "Load Type Revenue": {
            fileSlug = `revenue-by-load-type-${stamp}`;
            const rows: CsvTable = [
              ...csvTitleBlock("Revenue by load type", period),
              [
                "Load type",
                "Total loads",
                "Avg rate (INR)",
                "Revenue (INR)",
                "Peak month",
                "YoY growth % (est.)",
              ],
              ...revenueData.loadTypeRevenue.map((l) => [
                l.type,
                l.totalLoads,
                roundInr(l.avgRate),
                roundInr(l.revenue),
                l.peakMonth,
                l.yoyGrowth,
              ]),
            ];
            csv = buildCsv(rows);
            break;
          }
          case "Region Revenue Report":
          case "Region Revenue": {
            fileSlug = `region-revenue-${stamp}`;
            const rows: CsvTable = [
              ...csvTitleBlock("Region revenue report", period),
              [
                "Region",
                "Code",
                "Loads executed",
                "Revenue (INR)",
                "YoY growth % (est.)",
                "Top customer",
                "Share of total revenue",
              ],
              ...revenueData.regionRevenue.map((r) => [
                r.region,
                r.code,
                r.loadsExecuted,
                roundInr(r.revenue),
                r.yoyGrowth,
                r.topCustomer,
                r.heatValue != null ? Number((r.heatValue * 100).toFixed(2)) + "%" : "",
              ]),
            ];
            csv = buildCsv(rows);
            break;
          }
          case "Transaction CSV":
          case "Transaction PDF":
          case "Full Transaction Analytics": {
            fileSlug = `transaction-analytics-${stamp}`;
            const txs = buildTransactionRows();
            const rows: (string | number)[][] = [
              ...csvTitleBlock("Full transaction analytics", period),
              [
                "Date (ISO)",
                "Date (display)",
                "Load ID",
                "Shipper",
                "Shipper ID",
                "Carrier",
                "Carrier ID",
                "Load value (INR)",
                "Platform fee (INR)",
                "Subscription fee (INR)",
                "Payment status",
                "Region",
                "Load type",
              ],
              ...txs.map((t) => [
                t.dateIso,
                t.dateDisplay,
                t.loadId,
                t.shipper,
                t.shipperId,
                t.carrier,
                t.carrierId,
                t.loadValue,
                t.platformFee,
                t.subscriptionFee,
                t.paymentStatus,
                t.region,
                t.loadType,
              ]),
            ];
            csv = buildCsv(rows);
            break;
          }
          case "Monthly Revenue Report": {
            fileSlug = `monthly-revenue-${stamp}`;
            const rows: CsvTable = [
              ...csvTitleBlock("Monthly revenue report", period),
              [
                "Month",
                "Month (full label)",
                "Revenue (INR)",
                "Loads",
                "MoM growth %",
                "Load transactions (INR)",
                "Subscriptions (INR)",
                "Add-ons (INR)",
                "Penalties (INR)",
              ],
              ...revenueData.monthlyRevenue.map((m) => [
                m.month,
                m.fullMonth,
                roundInr(m.revenue),
                m.loads,
                m.growth,
                roundInr(m.loadTransactions),
                roundInr(m.subscriptions),
                roundInr(m.addOns),
                roundInr(m.penalties),
              ]),
            ];
            csv = buildCsv(rows);
            break;
          }
          case "Profitability Analysis": {
            fileSlug = `profitability-analysis-${stamp}`;
            const rows: CsvTable = [
              ...csvTitleBlock("Profitability analysis", period),
              ["Section", "Key metrics (dashboard calculations)"],
              [],
              ["Metric", "Value", "Trend %"],
              ...revenueData.profitInsights.map((p) => [
                p.label,
                typeof p.value === "number" ? roundInr(p.value) : p.value,
                p.trend,
              ]),
              [],
              ["Section", `Monthly estimated P&L (cost assumed ${(revenueData.estimatedCostPct * 100).toFixed(1)}% of revenue — based on actual platform margin)`],
              [],
              ["Month", "Revenue (INR)", "Est. cost (INR)", "Est. profit (INR)", "Est. margin %"],
              ...revenueData.monthlyRevenue.map((m) => {
                const cost = m.revenue * revenueData.estimatedCostPct;
                const profit = m.revenue * (revenueData.avgPlatformMarginPct / 100);
                const marginPct = m.revenue > 0 ? revenueData.avgPlatformMarginPct : 0;
                return [
                  m.fullMonth,
                  roundInr(m.revenue),
                  roundInr(cost),
                  roundInr(profit),
                  marginPct,
                ];
              }),
              [],
              ["Section", "Quarterly performance (rolling window)"],
              [],
              ["Quarter", "Revenue (INR)", "Loads", "QoQ growth %"],
              ...revenueData.quarterlyData.map((q) => [
                q.quarter,
                roundInr(q.revenue),
                q.loads,
                q.growth == null ? "N/A" : q.growth,
              ]),
            ];
            csv = buildCsv(rows);
            break;
          }
          default: {
            toast({
              title: "Export not available",
              description: `No CSV template for "${type}".`,
              variant: "destructive",
            });
            return;
          }
        }

        downloadCsvFile(`${fileSlug}.csv`, csv);
        toast({
          title: "Export complete",
          description: `Downloaded ${fileSlug}.csv`,
        });
      } catch (err) {
        toast({
          title: "Export failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [revenueData, loads, users, toast],
  );

  const filteredShippers = useMemo(() => {
    let filtered = revenueData.shipperContributors;
    if (filterRegion !== "all") {
      filtered = filtered.filter(s => s.region === filterRegion);
    }
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.company.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [revenueData, filterRegion, searchQuery]);

  const filteredTransactions = useMemo(() => {
    let filtered = revenueData.transactions;
    if (filterRegion !== "all") {
      filtered = filtered.filter(t => t.region === filterRegion);
    }
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.loadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.shipper.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.carrier.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [revenueData, filterRegion, searchQuery]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/analytics")} data-testid="button-back">
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Revenue Intelligence Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Complete breakdown of {formatCurrency(revenueData.totalRevenue)} total revenue ({revenueData.dateRangeLabel})</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap w-full sm:w-auto">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-32" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last 12 Months</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport("Full Revenue")} data-testid="button-export-full" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Quick Stats - Clickable */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="cursor-pointer hover-elevate" 
          onClick={() => setActiveView("sources")}
          data-testid="card-total-revenue"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold">{formatCurrency(revenueData.totalRevenue)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                <TrendingUp className="h-3 w-3 mr-1" />
                +14.2% vs last year
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate" 
          onClick={() => setActiveView("timeline")}
          data-testid="card-avg-load-price"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Avg Load Price</p>
                <p className="text-2xl font-bold">{formatCurrency(loads.length > 0 ? revenueData.totalRevenue / loads.length : 0)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                <TrendingUp className="h-3 w-3 mr-1" />
                +8.3% vs last year
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate" 
          onClick={() => setActiveView("transactions")}
          data-testid="card-total-loads"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Total Loads</p>
                <p className="text-2xl font-bold">{loads.length.toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                <TrendingUp className="h-3 w-3 mr-1" />
                +23.5% vs last year
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate" 
          onClick={() => setActiveView("profitability")}
          data-testid="card-profit-margin"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Profit Margin</p>
                <p className="text-2xl font-bold">
                  {revenueData.totalRevenue > 0 ? `${revenueData.avgPlatformMarginPct.toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                <TrendingUp className="h-3 w-3 mr-1" />
                +2.1% vs last year
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as MetricView)} className="w-full">
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max min-w-full sm:w-auto h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-1 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-overview">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-1 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-sources">
              <PieChartIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>By Source</span>
            </TabsTrigger>
            <TabsTrigger value="contributors" className="gap-1 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-contributors">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Contributors</span>
            </TabsTrigger>
            <TabsTrigger value="loadTypes" className="gap-1 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-load-types">
              <Package className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>By Load Type</span>
            </TabsTrigger>
            <TabsTrigger value="regions" className="gap-1 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-regions">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>By Region</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-timeline">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-transactions">
              <Table2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Transactions</span>
            </TabsTrigger>
            <TabsTrigger value="profitability" className="gap-1 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-profitability">
              <Lightbulb className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Profitability</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue by Source Pie Chart */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-lg">Revenue by Source</CardTitle>
                  <CardDescription>Distribution of total revenue</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveView("sources")}>
                  View Details <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData.sourceGroups}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {revenueData.sourceGroups.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Revenue Trend */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 px-4 sm:px-6">
                <div>
                  <CardTitle className="text-base sm:text-lg">Monthly Revenue Trend</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">12-month performance overview</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveView("timeline")} className="text-xs sm:text-sm">
                  View Details <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-64 sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData.monthlyRevenue} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={9} interval={0} />
                      <YAxis fontSize={9} tickFormatter={(v) => formatCurrency(v)} width={45} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: "12px" }} />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke={chartColors.primary}
                        fill={chartColors.primary}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Contributors Quick View */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-lg">Top Shippers</CardTitle>
                  <CardDescription>Highest revenue contributors</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setActiveView("contributors"); setContributorTab("shippers"); }}>
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenueData.shipperContributors.slice(0, 5).map((shipper, idx) => (
                    <div 
                      key={shipper.shipperId} 
                      className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                      onClick={() => setLocation(`/admin/users/${shipper.shipperId}`)}
                      data-testid={`row-shipper-${shipper.shipperId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-medium text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{shipper.company}</p>
                          <p className="text-xs text-muted-foreground">{shipper.loadsBooked} loads</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCurrency(shipper.totalSpend)}</p>
                        <p className="text-xs text-muted-foreground">{shipper.contribution.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-lg">Top Carriers</CardTitle>
                  <CardDescription>Highest commission generators</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setActiveView("contributors"); setContributorTab("carriers"); }}>
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenueData.carrierContributors.slice(0, 5).map((carrier, idx) => (
                    <div 
                      key={carrier.carrierId} 
                      className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                      onClick={() => setLocation(`/admin/carriers/${carrier.carrierId}`)}
                      data-testid={`row-carrier-${carrier.carrierId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center font-medium text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{carrier.name}</p>
                          <p className="text-xs text-muted-foreground">{carrier.loadsExecuted} loads executed</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCurrency(carrier.commissionGenerated)}</p>
                        <p className="text-xs text-muted-foreground">{carrier.contribution.toFixed(1)}% of commissions</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI-Powered Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {revenueData.aiInsights.map((insight, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-md border ${
                      insight.type === "success" ? "border-green-500/30 bg-green-500/5" :
                      "border-blue-500/30 bg-blue-500/5"
                    }`}
                  >
                    <p className="text-sm">{insight.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue by Source Tab */}
        <TabsContent value="sources" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Pie Chart */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Revenue Distribution</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-64 sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData.sourceGroups}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {revenueData.sourceGroups.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: "12px" }} />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Detailed Source Breakdown</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleExport("Revenue by Source")} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Source</TableHead>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Category</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Amount</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Share</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueData.revenueBySource.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">{item.source}</TableCell>
                          <TableCell className="text-xs sm:text-sm">{item.category}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">{item.percentage}%</TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs whitespace-nowrap ${item.trend >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {item.trend >= 0 ? "+" : ""}{item.trend}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Trend by Source */}
          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Monthly Revenue by Source</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="h-80 sm:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData.monthlyRevenue} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={9} interval={0} angle={0} />
                    <YAxis fontSize={9} tickFormatter={(v) => formatCurrency(v)} width={45} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                    <Bar dataKey="loadTransactions" name="Load Transactions" stackId="a" fill={chartColors.primary} />
                    <Bar dataKey="subscriptions" name="Subscriptions" stackId="a" fill={chartColors.secondary} />
                    <Bar dataKey="addOns" name="Add-ons" stackId="a" fill={chartColors.warning} />
                    <Bar dataKey="penalties" name="Penalties" stackId="a" fill={chartColors.danger} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contributors Tab */}
        <TabsContent value="contributors" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="flex flex-col gap-4">
            <Tabs value={contributorTab} onValueChange={(v) => setContributorTab(v as "shippers" | "carriers")}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="shippers" data-testid="tab-shippers" className="flex-1 sm:flex-none">
                  <Building className="h-4 w-4 mr-2" />
                  Shippers
                </TabsTrigger>
                <TabsTrigger value="carriers" data-testid="tab-carriers" className="flex-1 sm:flex-none">
                  <Truck className="h-4 w-4 mr-2" />
                  Carriers
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full"
                  data-testid="input-search"
                />
              </div>
              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-region">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="North India">North India</SelectItem>
                  <SelectItem value="South India">South India</SelectItem>
                  <SelectItem value="West India">West India</SelectItem>
                  <SelectItem value="East India">East India</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">By Revenue</SelectItem>
                  <SelectItem value="loads">By Loads</SelectItem>
                  <SelectItem value="contribution">By Contribution</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => handleExport(contributorTab === "shippers" ? "Shipper Revenue" : "Carrier Revenue")} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {contributorTab === "shippers" ? (
            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Top Revenue Contributors - Shippers</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Shippers ranked by total spend on the platform</CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 sm:w-12 text-xs sm:text-sm">#</TableHead>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Company</TableHead>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Region</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Total Spend</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Loads</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Avg/Load</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Contribution</TableHead>
                        <TableHead className="w-8 sm:w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredShippers.map((shipper, idx) => (
                        <TableRow 
                          key={shipper.shipperId} 
                          className="cursor-pointer hover-elevate"
                          onClick={() => setLocation(`/admin/users/${shipper.shipperId}`)}
                          data-testid={`row-shipper-detail-${shipper.shipperId}`}
                        >
                          <TableCell className="font-medium text-xs sm:text-sm">{idx + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-xs sm:text-sm whitespace-nowrap">{shipper.company}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs whitespace-nowrap">{shipper.region}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-xs sm:text-sm whitespace-nowrap">{formatCurrency(shipper.totalSpend)}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm">{shipper.loadsBooked}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">{formatCurrency(shipper.avgSpendPerLoad)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="text-xs whitespace-nowrap">{shipper.contribution.toFixed(1)}%</Badge>
                          </TableCell>
                          <TableCell>
                            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Top Revenue Contributors - Carriers</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Carriers ranked by commission generated for the platform</CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 sm:w-12 text-xs sm:text-sm">#</TableHead>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Carrier</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Loads Executed</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Load Value</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Commission</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Contribution</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Rating</TableHead>
                        <TableHead className="w-8 sm:w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueData.carrierContributors.map((carrier, idx) => (
                        <TableRow 
                          key={carrier.carrierId} 
                          className="cursor-pointer hover-elevate"
                          onClick={() => setLocation(`/admin/carriers/${carrier.carrierId}`)}
                          data-testid={`row-carrier-detail-${carrier.carrierId}`}
                        >
                          <TableCell className="font-medium text-xs sm:text-sm">{idx + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-xs sm:text-sm whitespace-nowrap">{carrier.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm">{carrier.loadsExecuted}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">{formatCurrency(carrier.loadValue)}</TableCell>
                          <TableCell className="text-right font-semibold text-xs sm:text-sm whitespace-nowrap">{formatCurrency(carrier.commissionGenerated)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="text-xs whitespace-nowrap">{carrier.contribution.toFixed(1)}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
                              {carrier.rating.toFixed(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Load Types Tab */}
        <TabsContent value="loadTypes" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Chart */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Revenue by Load Type</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-80 sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData.loadTypeRevenue} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" fontSize={10} tickFormatter={(v) => formatCurrency(v)} />
                      <YAxis type="category" dataKey="type" fontSize={9} width={80} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: "12px" }} />
                      <Bar dataKey="revenue" fill={chartColors.primary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Load Type Performance</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleExport("Load Type Revenue")} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Load Type</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Total Loads</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Avg Rate</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Revenue</TableHead>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Peak Month</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">YoY Growth</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueData.loadTypeRevenue.map((item) => (
                        <TableRow key={item.type}>
                          <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">{item.type}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm">{item.totalLoads}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">{formatCurrency(item.avgRate)}</TableCell>
                          <TableCell className="text-right font-semibold text-xs sm:text-sm whitespace-nowrap">{formatCurrency(item.revenue)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs whitespace-nowrap">{item.peakMonth}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs whitespace-nowrap ${item.yoyGrowth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {item.yoyGrowth >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                              {item.yoyGrowth >= 0 ? "+" : ""}{item.yoyGrowth}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Regions Tab */}
        <TabsContent value="regions" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Region Heatmap visualization */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Revenue Heatmap</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Regional concentration</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="grid grid-cols-2 gap-2">
                  {revenueData.regionRevenue.map((region) => (
                    <div 
                      key={region.code}
                      className="p-2 sm:p-3 rounded-md text-center cursor-pointer hover-elevate"
                      style={{
                        backgroundColor: `hsl(217, 91%, ${80 - region.heatValue * 40}%)`,
                      }}
                    >
                      <p className="font-semibold text-xs sm:text-sm text-white drop-shadow">{region.code}</p>
                      <p className="text-xs text-white/80 drop-shadow">{formatCurrency(region.revenue)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  <span className="text-xs">Low</span>
                  <div className="flex-1 mx-2 h-2 rounded bg-gradient-to-r from-blue-200 to-blue-600" />
                  <span className="text-xs">High</span>
                </div>
              </CardContent>
            </Card>

            {/* Region Table */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Regional Performance</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleExport("Region Revenue")} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Region</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Loads</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Revenue</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">YoY Growth</TableHead>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Top Customer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueData.regionRevenue.map((region) => (
                        <TableRow 
                          key={region.code} 
                          className="cursor-pointer hover-elevate"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                              <span className="font-medium text-xs sm:text-sm whitespace-nowrap">{region.region}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm">{region.loadsExecuted}</TableCell>
                          <TableCell className="text-right font-semibold text-xs sm:text-sm whitespace-nowrap">{formatCurrency(region.revenue)}</TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs whitespace-nowrap ${region.yoyGrowth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {region.yoyGrowth >= 0 ? "+" : ""}{region.yoyGrowth}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs sm:text-sm">{region.topCustomer}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Regional Bar Chart */}
          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Regional Revenue Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="h-64 sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData.regionRevenue} margin={{ top: 5, right: 5, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="region" fontSize={9} angle={-20} textAnchor="end" height={60} />
                    <YAxis fontSize={10} tickFormatter={(v) => formatCurrency(v)} width={45} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="revenue" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Best/Worst months */}
            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Performance Highlights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
                <div className="p-3 sm:p-4 rounded-md bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    <span className="font-semibold text-sm sm:text-base text-green-700 dark:text-green-400">Best Month</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">{revenueData.bestMonth.fullMonth}</p>
                  <p className="text-base sm:text-lg">{formatCurrency(revenueData.bestMonth.revenue)}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{revenueData.bestMonth.loads} loads</p>
                </div>
                <div className="p-3 sm:p-4 rounded-md bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                    <span className="font-semibold text-sm sm:text-base text-amber-700 dark:text-amber-400">Slowest Month</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">{revenueData.worstMonth.fullMonth}</p>
                  <p className="text-base sm:text-lg">{formatCurrency(revenueData.worstMonth.revenue)}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{revenueData.worstMonth.loads} loads</p>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Revenue Chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Monthly Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-64 sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={revenueData.monthlyRevenue} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={9} interval={0} angle={0} />
                      <YAxis yAxisId="left" fontSize={9} tickFormatter={(v) => formatCurrency(v)} width={45} />
                      <YAxis yAxisId="right" orientation="right" fontSize={9} width={35} />
                      <Tooltip formatter={(value: number, name: string) => 
                        name === "growth" ? `${value}%` : formatCurrency(value)
                      } contentStyle={{ fontSize: "12px" }} />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                      <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="growth" name="Growth %" stroke={chartColors.secondary} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quarterly View */}
          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Quarterly Performance</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                {revenueData.quarterlyData.map((q) => (
                  <div key={q.quarter} className="p-3 sm:p-4 rounded-md border">
                    <p className="text-xs sm:text-sm text-muted-foreground">{q.quarter}</p>
                    <p className="text-lg sm:text-2xl font-bold mt-1">{formatCurrency(q.revenue)}</p>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">{q.loads} loads</span>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs whitespace-nowrap ${
                          q.growth == null
                            ? "text-muted-foreground"
                            : q.growth >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {q.growth == null ? "N/A" : `${q.growth >= 0 ? "+" : ""}${q.growth}%`}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Forecast */}
          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                3-Month Forecast (AI Predicted)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                {revenueData.forecast.map((f) => (
                  <div key={f.month} className="p-3 sm:p-4 rounded-md bg-purple-500/5 border border-purple-500/20">
                    <p className="font-semibold text-sm sm:text-base">{f.month}</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(f.projected)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full" 
                          style={{ width: `${f.confidence}%` }} 
                        />
                      </div>
                      <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{f.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by Load ID, Shipper, Carrier..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-72"
                  data-testid="input-search-transactions"
                />
              </div>
              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="North India">North India</SelectItem>
                  <SelectItem value="South India">South India</SelectItem>
                  <SelectItem value="West India">West India</SelectItem>
                  <SelectItem value="East India">East India</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => handleExport("Transaction CSV")} className="w-full sm:w-auto">
                <FileDown className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport("Transaction PDF")} className="w-full sm:w-auto">
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Detailed Transaction Table</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Complete record of all revenue events</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Load ID</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Shipper</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Carrier</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Load Value</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Platform Fee</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">Subscription</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Region</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.slice(0, 25).map((tx, idx) => (
                      <TableRow key={idx} className="hover-elevate">
                        <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                          {tx.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Link href={`/admin/loads/${tx.loadId}`}>
                            <span className="text-primary hover:underline cursor-pointer text-xs sm:text-sm" data-testid={`link-load-${tx.loadId}`}>
                              {tx.loadId}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[120px] sm:max-w-none">
                          <Link href={`/admin/users/${tx.shipperId}`}>
                            <span className="text-primary hover:underline cursor-pointer text-xs sm:text-sm truncate block" data-testid={`link-shipper-${tx.shipperId}`}>
                              {tx.shipper.length > 20 ? tx.shipper.substring(0, 20) + "..." : tx.shipper}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[120px] sm:max-w-none">
                          <Link href={`/admin/carriers/${tx.carrierId}`}>
                            <span className="text-primary hover:underline cursor-pointer text-xs sm:text-sm truncate block" data-testid={`link-carrier-${tx.carrierId}`}>
                              {tx.carrier.length > 20 ? tx.carrier.substring(0, 20) + "..." : tx.carrier}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">{formatCurrencyFull(tx.loadValue)}</TableCell>
                        <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">{formatCurrencyFull(tx.platformFee)}</TableCell>
                        <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">{tx.subscriptionFee > 0 ? formatCurrencyFull(tx.subscriptionFee) : "-"}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={tx.paymentStatus === "Paid" ? "default" : tx.paymentStatus === "Pending" ? "secondary" : "destructive"}
                            className="text-xs whitespace-nowrap"
                          >
                            {tx.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{tx.region}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{tx.loadType}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredTransactions.length > 25 && (
                <div className="text-center mt-4 text-xs sm:text-sm text-muted-foreground">
                  Showing 25 of {filteredTransactions.length} transactions. Export for complete data.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profitability Tab */}
        <TabsContent value="profitability" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Key Metrics */}
            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Profitability Metrics</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Simulated financial health indicators</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-3 sm:space-y-4">
                  {revenueData.profitInsights.map((insight, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 sm:p-3 rounded-md border gap-2">
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">{insight.label}</p>
                        <p className="text-lg sm:text-xl font-bold">
                          {typeof insight.value === "number" ? formatCurrency(insight.value) : insight.value}
                        </p>
                      </div>
                      {insight.trend !== undefined && (
                        <Badge 
                          variant="secondary" 
                          className={`text-xs whitespace-nowrap ${insight.icon === "up" ? "text-green-600 dark:text-green-400" : insight.icon === "down" ? "text-red-600 dark:text-red-400" : ""}`}
                        >
                          {insight.icon === "up" ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                           insight.icon === "down" ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                          {insight.trend >= 0 ? "+" : ""}{insight.trend}%
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Revenue vs Cost Chart */}
            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Revenue vs Estimated Cost</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="h-64 sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData.monthlyRevenue.map(m => ({
                      month: m.month,
                      revenue: m.revenue,
                      cost: m.revenue * revenueData.estimatedCostPct,
                      profit: m.revenue * (revenueData.avgPlatformMarginPct / 100),
                    }))} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={9} interval={0} angle={0} />
                      <YAxis fontSize={9} tickFormatter={(v) => formatCurrency(v)} width={45} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: "12px" }} />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="revenue" name="Revenue" fill={chartColors.primary} />
                      <Bar dataKey="cost" name="Est. Cost" fill={chartColors.danger} />
                      <Bar dataKey="profit" name="Est. Profit" fill={chartColors.secondary} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights Panel */}
          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5 min-w-0">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 shrink-0" />
                    AI-Powered Financial Insights
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Automated analysis from your loads, then recommendations that compare real finances to model assumptions
                    plus five market and transport outlook signals.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 w-full sm:w-auto"
                  onClick={handleDownloadAiInsightsThreeDayPdf}
                  data-testid="button-download-ai-insights-3day-pdf"
                >
                  <FileDown className="h-4 w-4" />
                  Download 3-day PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-8 pb-6">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                    Automated analysis
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    What your current load, shipper, carrier, and region data shows.
                  </p>
                </div>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {revenueData.automatedAnalysis.map((insight, idx) => (
                    <div
                      key={`auto-${idx}`}
                      className={`p-3 sm:p-4 rounded-md border flex items-start gap-2 sm:gap-3 ${
                        insight.type === "success"
                          ? "border-green-500/30 bg-green-500/5"
                          : "border-blue-500/30 bg-blue-500/5"
                      }`}
                    >
                      {insight.type === "success" ? (
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 shrink-0" />
                      ) : (
                        <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 shrink-0" />
                      )}
                      <p className="text-xs sm:text-sm">{insight.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0" />
                    Recommendations
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Compare recorded transactions and platform margin to simulated revenue lines and margin assumptions,
                    then scan five forward-looking market signals for Indian road freight and compliance.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Finance vs. your data
                  </h4>
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {revenueData.financeRecommendations.map((insight, idx) => (
                      <div
                        key={`fin-${idx}`}
                        className={`p-3 sm:p-4 rounded-md border flex items-start gap-2 sm:gap-3 ${
                          insight.type === "success"
                            ? "border-green-500/30 bg-green-500/5"
                            : "border-blue-500/30 bg-blue-500/5"
                        }`}
                      >
                        {insight.type === "success" ? (
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 shrink-0" />
                        )}
                        <p className="text-xs sm:text-sm">{insight.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Five market &amp; transport outlook signals
                  </h4>
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {revenueData.marketPredictiveInsights.map((insight, idx) => (
                      <div
                        key={`mkt-${idx}`}
                        className={`p-3 sm:p-4 rounded-md border flex items-start gap-2 sm:gap-3 ${
                          insight.type === "success"
                            ? "border-green-500/30 bg-green-500/5"
                            : "border-amber-500/30 bg-amber-500/5"
                        }`}
                      >
                        {insight.type === "success" ? (
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                        )}
                        <p className="text-xs sm:text-sm">{insight.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Export Reports</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Generate and download detailed reports</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { name: "Monthly Revenue Report", icon: Calendar },
                  { name: "Shipper Revenue Report", icon: Building },
                  { name: "Carrier Revenue Report", icon: Truck },
                  { name: "Region Revenue Report", icon: MapPin },
                  { name: "Full Transaction Analytics", icon: Table2 },
                  { name: "Profitability Analysis", icon: Sparkles },
                ].map((report) => (
                  <Button 
                    key={report.name}
                    variant="outline" 
                    className="justify-start h-auto py-2 sm:py-3"
                    onClick={() => handleExport(report.name)}
                    data-testid={`button-export-${report.name.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <report.icon className="h-3 w-3 sm:h-4 sm:w-4 mr-2 sm:mr-3 shrink-0" />
                    <div className="text-left">
                      <p className="font-medium text-xs sm:text-sm">{report.name}</p>
                      <p className="text-xs text-muted-foreground">Download CSV</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
