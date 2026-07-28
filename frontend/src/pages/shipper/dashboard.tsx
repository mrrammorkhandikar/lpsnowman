import { useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Package, DollarSign, Truck, TrendingUp, TrendingDown, Plus, ArrowRight, FileText, Receipt, Loader2, AlertTriangle, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatCard } from "@/components/stat-card";
import { useAuth } from "@/lib/auth-context";
import { useLoads, useInvoicesByShipper, useNotifications } from "@/lib/api-hooks";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import type { Load, Invoice } from "@shared/schema";

interface TrackedShipment {
  id: string;
  loadId: string;
  currentStage: string;
  progress: number;
  load: {
    shipperLoadNumber?: number | null;
    adminReferenceNumber?: number | null;
    pickupCity: string;
    dropoffCity: string;
  } | null;
  carrier: {
    companyName: string;
  } | null;
  documents: Array<{ id: string; documentType: string; status: string }>;
}

interface ApiDocument {
  id: string;
  documentType: string;
  fileName: string;
  createdAt: string;
  load?: { shipperLoadNumber?: number; adminReferenceNumber?: number };
}

function getStatusBadgeStyle(status: string | null | undefined) {
  switch (status) {
    case 'in_transit':
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case 'pending':
    case 'priced':
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case 'delivered':
    case 'closed':
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function formatStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

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

export default function ShipperDashboard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: loads, isLoading: loadsLoading } = useLoads();
  const { data: invoices, isLoading: invoicesLoading } = useInvoicesByShipper();
  const { data: notifications } = useNotifications();
  
  // Fetch real shipment data for tracking
  const { data: shipments = [] } = useQuery<TrackedShipment[]>({
    queryKey: ['/api/shipments/tracking'],
  });
  
  // Fetch real document data
  const { data: apiDocuments = [] } = useQuery<ApiDocument[]>({
    queryKey: ['/api/shipper/documents'],
  });

  const userLoads = (loads || []).filter((load: Load) => load.shipperId === user?.id);
  const activeLoads = userLoads.filter((load: Load) => 
    ['pending', 'priced', 'posted_to_carriers', 'open_for_bid', 'counter_received', 'awarded', 'invoice_created', 'invoice_sent', 'invoice_acknowledged', 'invoice_paid'].includes(load.status || '')
  );
  
  // Get in-transit count from real shipments
  const inTransitShipments = shipments.filter(s => s.currentStage === 'in_transit');
  const deliveredShipments = shipments.filter(s => s.currentStage === 'delivered');
  
  // Real document count from API
  const totalDocuments = apiDocuments.length;
  
  const recentLoads = activeLoads.slice(0, 5);

  const userInvoices = (invoices || []) as Invoice[];
  
  // Calculate real spending data from invoices (all invoices, not just paid)
  const { totalSpend, monthlyData, spendChange } = useMemo(() => {
    // Include all invoices for total spend (sent, acknowledged, paid)
    const relevantInvoices = userInvoices.filter(inv => 
      ['sent', 'acknowledged', 'paid'].includes(inv.status || '')
    );
    const total = relevantInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount?.toString() || '0'), 0);
    
    // Group invoices by month for chart
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const last6Months: { month: string; amount: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthNames[date.getMonth()];
      
      const monthTotal = relevantInvoices
        .filter(inv => {
          if (!inv.createdAt) return false;
          const invDate = new Date(inv.createdAt);
          return invDate.getMonth() === date.getMonth() && 
                 invDate.getFullYear() === date.getFullYear();
        })
        .reduce((sum, inv) => sum + parseFloat(inv.totalAmount?.toString() || '0'), 0);
      
      last6Months.push({ month: monthKey, amount: monthTotal });
    }
    
    // Calculate change from last month
    const currentMonth = last6Months[last6Months.length - 1]?.amount || 0;
    const lastMonth = last6Months[last6Months.length - 2]?.amount || 0;
    const change = lastMonth > 0 ? Math.round(((currentMonth - lastMonth) / lastMonth) * 100) : 0;
    
    return { totalSpend: total, monthlyData: last6Months, spendChange: change };
  }, [userInvoices]);

  const unreadNotifications = (notifications || []).filter(n => !n.isRead).slice(0, 4);

  // Build dashboard alerts from real data
  const dashboardAlerts = useMemo(() => {
    const alerts: Array<{ id: string; type: string; message: string; time: string }> = [];
    
    // Add notifications
    unreadNotifications.forEach((notif, i) => {
      alerts.push({
        id: `notif-${i}`,
        type: notif.type === 'error' ? 'delay' : 'status',
        message: notif.message || notif.title,
        time: notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString() : 'Just now',
      });
    });
    
    // Add shipment updates
    inTransitShipments.slice(0, 2).forEach((shipment, i) => {
      const loadId = shipment.load?.adminReferenceNumber || shipment.load?.shipperLoadNumber;
      alerts.push({
        id: `transit-${i}`,
        type: 'status',
        message: `Load LD-${String(loadId).padStart(3, '0')} is in transit to ${shipment.load?.dropoffCity}`,
        time: 'Active',
      });
    });
    
    // Add recent document uploads
    apiDocuments.slice(0, 2).forEach((doc, i) => {
      const loadNum = doc.load?.adminReferenceNumber || doc.load?.shipperLoadNumber;
      alerts.push({
        id: `doc-${i}`,
        type: 'document',
        message: `${doc.fileName} uploaded for LD-${String(loadNum).padStart(3, '0')}`,
        time: new Date(doc.createdAt).toLocaleTimeString(),
      });
    });
    
    return alerts.slice(0, 7);
  }, [unreadNotifications, inTransitShipments, apiDocuments]);

  if (loadsLoading || invoicesLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-welcome">
            {t("dashboard.welcomeBack")}, {user?.companyName || user?.username}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t("shipper.loadOverview")}</p>
        </div>
        <Button onClick={() => navigate("/shipper/post-load")} data-testid="button-post-load" className="w-full sm:w-auto shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {t("shipper.postNewLoad")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("dashboard.activeLoads")}
          value={userLoads.length}
          icon={Package}
          subtitle={`${activeLoads.length} active`}
          onClick={() => navigate("/shipper/loads")}
          testId="stat-active-loads"
        />
        <StatCard
          title={t("dashboard.inTransit")}
          value={inTransitShipments.length}
          icon={Truck}
          subtitle={`${deliveredShipments.length} delivered`}
          onClick={() => navigate("/shipper/tracking?tab=in_transit")}
          testId="stat-in-transit"
        />
        <StatCard
          title={t("shipper.totalSpent")}
          value={`Rs. ${totalSpend.toLocaleString('en-IN')}`}
          icon={DollarSign}
          trend={spendChange !== 0 ? { value: Math.abs(spendChange), isPositive: spendChange > 0 } : undefined}
          onClick={() => navigate("/shipper/invoices")}
          testId="stat-monthly-spend"
        />
        <StatCard
          title={t("documents.title")}
          value={totalDocuments}
          icon={FileText}
          subtitle={`${shipments.reduce((sum, s) => sum + s.documents.length, 0)} from shipments`}
          onClick={() => navigate("/shipper/documents")}
          testId="stat-documents"
        />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("shipper.totalSpent")}</CardTitle>
            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs self-start sm:self-auto">
              {spendChange >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {spendChange >= 0 ? "+" : ""}{spendChange}% {t("dashboard.vsLastWeek")}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="h-48 sm:h-56 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 48%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 48%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-[10px] sm:text-xs" />
                  <YAxis className="text-[10px] sm:text-xs" tickFormatter={(value) => `Rs. ${(value / 100000).toFixed(1)}L`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`Rs. ${value.toLocaleString('en-IN')}`, "Spend"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="hsl(217, 91%, 48%)"
                    fillOpacity={1}
                    fill="url(#colorAmount)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("common.notifications")}</CardTitle>
            <Badge variant="destructive" className="no-default-hover-elevate no-default-active-elevate text-xs">
              {dashboardAlerts.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ScrollArea className="h-48 sm:h-56 md:h-64">
              <div className="space-y-2 sm:space-y-3 pr-2 sm:pr-3">
                {dashboardAlerts.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">{t("messages.noDataFound")}</p>
                ) : (
                  dashboardAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                      onClick={() => alert.type === "document" && navigate("/shipper/documents")}
                      data-testid={`alert-${alert.id}`}
                    >
                      {alert.type === "document" ? (
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5 text-amber-500" />
                      ) : (
                        <AlertTriangle className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5 ${
                          alert.type === "delay" ? "text-red-500" : "text-green-500"
                        }`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm break-words">{alert.message}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">{alert.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.activeLoads")}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/shipper/loads?status=active")} data-testid="link-view-all-loads" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">{t("dashboard.viewAll")}</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {recentLoads.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-2 sm:mb-3" />
                <p className="text-xs sm:text-sm text-muted-foreground">{t("shipper.noLoadsPosted")}</p>
                <Button variant="outline" size="sm" className="mt-2 sm:mt-3 text-xs sm:text-sm" onClick={() => navigate("/shipper/post-load")}>
                  {t("shipper.postFirstLoad")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {recentLoads.map((load: Load) => (
                  <div
                    key={load.id}
                    className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer gap-2"
                    onClick={() => navigate(`/shipper/loads/${load.id}`)}
                    data-testid={`load-card-${load.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-xs sm:text-sm">{formatLoadId(load)}</span>
                        <Badge variant="outline" className="text-[10px] sm:text-xs">
                          {load.requiredTruckType || 'General'}
                        </Badge>
                        <Badge 
                          variant="secondary" 
                          className={`text-[10px] sm:text-xs ${getStatusBadgeStyle(load.status)}`}
                        >
                          {formatStatus(load.status)}
                        </Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {load.pickupCity}{load.pickupLocality ? `, ${load.pickupLocality}` : ''} to {load.dropoffCity}{load.dropoffLocality ? `, ${load.dropoffLocality}` : ''}
                      </p>
                    </div>
                    <div className="text-right ml-2 sm:ml-4 flex-shrink-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{load.weight ? `${parseFloat(load.weight).toLocaleString('en-IN')} kg` : 'N/A'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("memos.title")}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/shipper/invoices")} data-testid="link-view-memos" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">{t("dashboard.viewAll")}</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {userInvoices.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <Receipt className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-2 sm:mb-3" />
                <p className="text-xs sm:text-sm text-muted-foreground">{t("memos.noMemosFound")}</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {userInvoices.slice(0, 3).map((invoice: Invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer gap-2" 
                    onClick={() => navigate("/shipper/invoices")} 
                    data-testid={`memo-${invoice.id}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium text-xs sm:text-sm block truncate">{invoice.invoiceNumber}</span>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-medium text-xs sm:text-sm">Rs. {parseFloat(invoice.totalAmount?.toString() || '0').toLocaleString('en-IN')}</p>
                      <Badge className={`text-[10px] sm:text-xs no-default-hover-elevate no-default-active-elevate ${
                        invoice.status === 'paid' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Track Shipments Section */}
      {shipments.filter(s => s.currentStage !== 'delivered').length > 0 && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 sm:gap-4 pb-3 sm:pb-4">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="truncate">Active Shipments</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">Real-time tracking of your shipments</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/shipper/tracking")} data-testid="link-view-tracking" className="text-xs sm:text-sm shrink-0">
                <span className="hidden sm:inline">{t("dashboard.viewAll")}</span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {shipments.filter(s => s.currentStage !== 'delivered').slice(0, 3).map((shipment) => {
                const loadNum = shipment.load?.adminReferenceNumber || shipment.load?.shipperLoadNumber;
                return (
                  <div
                    key={shipment.id}
                    className="p-3 sm:p-4 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                    onClick={() => navigate("/shipper/tracking")}
                    data-testid={`shipment-card-${shipment.id}`}
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="font-medium text-xs sm:text-sm truncate">
                        LD-{String(loadNum).padStart(3, '0')}
                      </span>
                      <Badge className={`text-[10px] sm:text-xs no-default-hover-elevate no-default-active-elevate flex-shrink-0 ${
                        shipment.currentStage === 'delivered'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : shipment.currentStage === 'in_transit'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {shipment.currentStage === 'in_transit' ? 'In Transit' : 
                         shipment.currentStage === 'delivered' ? 'Delivered' : 'Active'}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {shipment.load?.pickupCity} to {shipment.load?.dropoffCity}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
                      <Truck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{shipment.carrier?.companyName}</span>
                    </div>
                    <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                      <div 
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${shipment.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{shipment.progress}% complete</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
