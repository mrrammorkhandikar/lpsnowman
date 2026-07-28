import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  FileText, Send, Check, Clock, AlertCircle, DollarSign,
  Search, Filter, Eye, RefreshCw, MessageSquare, History,
  CheckCircle, XCircle, ArrowLeftRight, ChevronDown, ChevronUp, Star,
  User, Building2, Phone, Truck, Award, MapPin, Calculator, Percent,
  Wallet, TrendingUp, Receipt, Banknote
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { connectMarketplace, disconnectMarketplace, onMarketplaceEvent } from "@/lib/marketplace-socket";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface CounterOffer {
  id: string;
  proposedAmount: string;
  reason: string;
  proposedBy: "shipper" | "admin";
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
  respondedAt?: Date;
  responseNote?: string;
}

interface CarrierDetails {
  id: string;
  name: string;
  companyName?: string;
  phone?: string;
  carrierType: 'solo' | 'enterprise';
  tripsCompleted: number;
}

interface DriverDetails {
  id: string;
  name: string;
  phone?: string;
  licenseNumber?: string;
}

interface TruckDetails {
  id: string;
  licensePlate?: string;
  registrationNumber?: string;
  truckType?: string;
  capacity?: number;
  make?: string;
  model?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  loadId: string;
  shipperLoadNumber?: number | null;
  adminReferenceNumber?: number | null;
  shipperId: string;
  shipper?: { companyName?: string; username: string };
  load?: { 
    pickupCity: string; 
    dropoffCity: string; 
    status: string;
    adminFinalPrice?: string;
    finalPrice?: string;
    weight?: string;
  };
  subtotal: string;
  taxAmount: string;
  taxPercent?: number;
  totalAmount: string;
  status: string;
  shipperStatus?: "pending" | "viewed" | "acknowledged" | "countered" | "paid";
  acknowledgedAt?: string;
  paidAt?: string;
  counterOffers?: CounterOffer[];
  createdAt: string;
  sentAt?: string;
  dueDate?: string;
  shipperCounterAmount?: string;
  shipperResponseMessage?: string;
  counterContactName?: string;
  counterContactCompany?: string;
  counterContactPhone?: string;
  counterContactAddress?: string;
  counterReason?: string;
  counteredAt?: string;
  advancePaymentPercent?: number;
  advancePaymentAmount?: string;
  balanceOnDelivery?: string;
  lineItems?: { description: string; amount: string }[];
  pickupCity?: string;
  dropoffCity?: string;
  loadRoute?: string;
  carrier?: CarrierDetails;
  driver?: DriverDetails;
  truck?: TruckDetails;
  // Admin financial breakdown fields
  platformMargin?: string;
  estimatedCarrierPayout?: string;
  winningBidAmount?: string;
  adminPostedPrice?: string;
  paymentReference?: string;
}

// Format load ID for display - shows LD-1001 (admin ref) or LD-044 (shipper seq)
function formatLoadId(invoice: { 
  shipperLoadNumber?: number | null; 
  adminReferenceNumber?: number | null; 
  loadId?: string | null;
  load?: { shipperLoadNumber?: number | null; adminReferenceNumber?: number | null } | null;
}): string {
  // First check invoice-level fields
  if (invoice.adminReferenceNumber) {
    return `LD-${String(invoice.adminReferenceNumber).padStart(3, '0')}`;
  }
  if (invoice.shipperLoadNumber) {
    return `LD-${String(invoice.shipperLoadNumber).padStart(3, '0')}`;
  }
  // Then check load-level fields
  if (invoice.load?.adminReferenceNumber) {
    return `LD-${String(invoice.load.adminReferenceNumber).padStart(3, '0')}`;
  }
  if (invoice.load?.shipperLoadNumber) {
    return `LD-${String(invoice.load.shipperLoadNumber).padStart(3, '0')}`;
  }
  // Fallback to first 8 chars of loadId UUID
  return invoice.loadId?.slice(0, 8)?.toUpperCase() || "N/A";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return <Badge variant="outline" data-testid="badge-status-draft"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
    case "sent":
      return <Badge variant="secondary" data-testid="badge-status-sent"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
    case "approved":
    case "acknowledged":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" data-testid="badge-status-acknowledged"><Check className="h-3 w-3 mr-1" />Acknowledged</Badge>;
    case "paid":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-status-paid"><DollarSign className="h-3 w-3 mr-1" />Paid</Badge>;
    case "overdue":
      return <Badge variant="destructive" data-testid="badge-status-overdue"><AlertCircle className="h-3 w-3 mr-1" />Overdue</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-status-unknown">{status}</Badge>;
  }
}

function getShipperStatusBadge(status?: string) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Not Viewed</Badge>;
    case "viewed":
      return <Badge variant="secondary" className="text-xs"><Eye className="h-3 w-3 mr-1" />Viewed</Badge>;
    case "acknowledged":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Acknowledged</Badge>;
    case "countered":
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs"><ArrowLeftRight className="h-3 w-3 mr-1" />Countered</Badge>;
    case "paid":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"><DollarSign className="h-3 w-3 mr-1" />Paid</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">-</Badge>;
  }
}

export default function AdminInvoicesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shipperStatusFilter, setShipperStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [markPaidConfirmOpen, setMarkPaidConfirmOpen] = useState(false);
  const [invoiceToMarkPaid, setInvoiceToMarkPaid] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"shipper" | "admin">("shipper");
  const [costBreakdownOpen, setCostBreakdownOpen] = useState(false);
  const [costBreakdownInvoice, setCostBreakdownInvoice] = useState<Invoice | null>(null);

  const { data: apiInvoices = [], isLoading, refetch, isFetching } = useQuery<Invoice[]>({
    queryKey: ["/api/admin/invoices"],
  });

  const handleRefreshInvoices = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      const r = await refetch();
      if (r.error) {
        throw r.error instanceof Error ? r.error : new Error(String(r.error));
      }
      const n = r.data?.length ?? 0;
      toast({
        title: "Memos updated",
        description: `${n} memo${n === 1 ? "" : "s"} loaded.`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not refresh memos.";
      toast({
        title: "Refresh failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user?.id && user?.role === "admin") {
      connectMarketplace("admin", user.id);
      
      const unsubInvoice = onMarketplaceEvent("invoice_update", (data) => {
        if (data.event === "invoice_viewed") {
          toast({
            title: "Invoice Viewed",
            description: `Invoice ${data.invoice?.invoiceNumber || data.invoiceId} has been viewed by shipper.`,
          });
          refetch();
        } else if (data.event === "invoice_acknowledged") {
          toast({
            title: "Invoice Acknowledged",
            description: `Invoice ${data.invoice?.invoiceNumber || data.invoiceId} has been acknowledged by shipper.`,
          });
          refetch();
        } else if (data.event === "invoice_opened") {
          toast({
            title: "Invoice Opened",
            description: `Invoice ${data.invoice?.invoiceNumber || data.invoiceId} has been opened by shipper.`,
          });
          refetch();
        } else if (data.event === "invoice_paid") {
          toast({
            title: "Payment Received",
            description: `Invoice ${data.invoice?.invoiceNumber || data.invoiceId} has been paid.`,
          });
          refetch();
        } else if (data.event === "invoice_countered") {
          toast({
            title: "Counter Offer Received",
            description: `Shipper submitted a counter offer for invoice ${data.invoice?.invoiceNumber || data.invoiceId}.`,
          });
          refetch();
        }
      });

      return () => {
        unsubInvoice();
        disconnectMarketplace();
      };
    }
  }, [user?.id, user?.role, toast, refetch]);

  const invoices = useMemo(() => {
    return apiInvoices.map(inv => ({
      ...inv,
      shipperStatus: inv.shipperStatus || (inv.status === "paid" ? "paid" : inv.status === "sent" ? "viewed" : "pending"),
    }));
  }, [apiInvoices]);

  const sendMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return apiRequest("POST", `/api/admin/invoices/${invoiceId}/send`, {});
    },
    onSuccess: () => {
      toast({ title: "Invoice Sent", description: "Invoice has been sent to the shipper." });
      // Sync data across portal
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return apiRequest("POST", `/api/admin/invoices/${invoiceId}/mark-paid`, {});
    },
    onSuccess: () => {
      toast({ title: "Invoice Marked as Paid", description: "Payment has been recorded for this invoice." });
      // Sync data across portal
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const [resendingInvoiceId, setResendingInvoiceId] = useState<string | null>(null);

  const resendMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      setResendingInvoiceId(invoiceId);
      return apiRequest("POST", `/api/admin/invoices/${invoiceId}/send`, {});
    },
    onSuccess: () => {
      toast({ title: "Invoice Resent", description: "Invoice has been resent to the shipper." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/queue"] });
      setResendingInvoiceId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Resend Failed", description: error.message || "Failed to resend invoice", variant: "destructive" });
      setResendingInvoiceId(null);
    },
  });

  const filteredInvoices = invoices.filter((inv) => {
    const loadId = formatLoadId(inv);
    const matchesSearch = searchQuery === "" ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.shipper?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.shipper?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.load?.pickupCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.load?.dropoffCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loadId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesShipperStatus = shipperStatusFilter === "all" || inv.shipperStatus === shipperStatusFilter;
    return matchesSearch && matchesStatus && matchesShipperStatus;
  });

  const stats = {
    total: invoices.length,
    draft: invoices.filter((i) => i.status === "draft").length,
    sent: invoices.filter((i) => i.status === "sent").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
  };

  const totalRevenue = invoices
    .filter(i => i.status === "paid")
    .reduce((sum, i) => sum + parseFloat(i.totalAmount || "0"), 0);

  const pendingAmount = invoices
    .filter(i => i.status === "sent")
    .reduce((sum, i) => sum + parseFloat(i.totalAmount || "0"), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Memo Management</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Track memos and shipper responses</p>
        </div>
        <Button
          type="button"
          onClick={() => void handleRefreshInvoices()}
          disabled={isFetching}
          variant="outline"
          data-testid="button-refresh"
          className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
        >
          <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid - 1 column on mobile, 2 on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card data-testid="card-stat-total">
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Memos</p>
                <p className="text-lg sm:text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-revenue">
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Collected</p>
                <p className="text-lg sm:text-xl font-bold truncate">Rs. {totalRevenue.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-pending">
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 flex-shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                <p className="text-lg sm:text-xl font-bold truncate">Rs. {pendingAmount.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-overdue">
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 flex-shrink-0">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Overdue</p>
                <p className="text-lg sm:text-xl font-bold">{stats.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:gap-4 pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">All Memos</CardTitle>
              <CardDescription className="text-xs sm:text-sm">With shipper response status tracking</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <Input
                  placeholder="Shipper, Load ID, City..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 sm:pl-9 w-full sm:w-48 h-8 sm:h-10 text-xs sm:text-sm"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[110px] sm:w-32 h-8 sm:h-10 text-xs sm:text-sm" data-testid="select-status-filter">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs sm:text-sm">All Status</SelectItem>
                  <SelectItem value="draft" className="text-xs sm:text-sm">Draft</SelectItem>
                  <SelectItem value="sent" className="text-xs sm:text-sm">Sent</SelectItem>
                  <SelectItem value="paid" className="text-xs sm:text-sm">Paid</SelectItem>
                  <SelectItem value="overdue" className="text-xs sm:text-sm">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={shipperStatusFilter} onValueChange={setShipperStatusFilter}>
                <SelectTrigger className="w-[130px] sm:w-36 h-8 sm:h-10 text-xs sm:text-sm" data-testid="select-shipper-status-filter">
                  <SelectValue placeholder="Shipper Response" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs sm:text-sm">All Responses</SelectItem>
                  <SelectItem value="pending" className="text-xs sm:text-sm">Not Viewed</SelectItem>
                  <SelectItem value="viewed" className="text-xs sm:text-sm">Viewed</SelectItem>
                  <SelectItem value="acknowledged" className="text-xs sm:text-sm">Acknowledged</SelectItem>
                  <SelectItem value="countered" className="text-xs sm:text-sm">Countered</SelectItem>
                  <SelectItem value="paid" className="text-xs sm:text-sm">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "shipper" | "admin")} className="w-full">
            {/* Horizontal scrollable tabs with HIDDEN scrollbar */}
            <div className="relative overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0 mb-4">
              <TabsList className="inline-flex min-w-max">
                <TabsTrigger value="shipper" className="gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4" data-testid="tab-shipper-view">
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                  Shipper View
                </TabsTrigger>
                <TabsTrigger value="admin" className="gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4" data-testid="tab-admin-view">
                  <Calculator className="h-3 w-3 sm:h-4 sm:w-4" />
                  Admin View (Financial)
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="shipper">
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No invoices found</p>
                  <p className="text-sm">Invoices are created when carriers are finalized for loads</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Load ID</TableHead>
                      <TableHead>Shipper</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Shipper Response</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {formatLoadId(invoice)}
                        </TableCell>
                        <TableCell>{invoice.shipper?.companyName || invoice.shipper?.username || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {invoice.load ? `${invoice.load.pickupCity} → ${invoice.load.dropoffCity}` : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          Rs. {parseFloat(invoice.totalAmount || '0').toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getShipperStatusBadge(invoice.shipperStatus)}
                            {invoice.counterOffers?.some(c => c.status === "pending") && (
                              <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20">
                                <ArrowLeftRight className="h-3 w-3 mr-1" />
                                Counter Pending
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setDetailsOpen(true);
                              }}
                              data-testid={`button-view-${invoice.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {invoice.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendMutation.mutate(invoice.id)}
                                disabled={sendMutation.isPending}
                                data-testid={`button-send-${invoice.id}`}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Send
                              </Button>
                            )}
                            {["sent", "approved", "acknowledged", "overdue"].includes(invoice.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resendMutation.mutate(invoice.id)}
                                disabled={resendingInvoiceId === invoice.id || resendMutation.isPending}
                                data-testid={`button-resend-${invoice.id}`}
                              >
                                <RefreshCw className={`h-4 w-4 mr-1 ${resendingInvoiceId === invoice.id ? 'animate-spin' : ''}`} />
                                Resend
                              </Button>
                            )}
                            {(invoice.shipperStatus === "acknowledged" || invoice.acknowledgedAt) && invoice.status !== "paid" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setInvoiceToMarkPaid(invoice.id);
                                  setMarkPaidConfirmOpen(true);
                                }}
                                disabled={markPaidMutation.isPending}
                                data-testid={`button-mark-paid-${invoice.id}`}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            
            <TabsContent value="admin">
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state-admin">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No invoices found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                      Admin View - For internal use only. Not sent to shippers.
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                          <TableHead className="whitespace-nowrap">Load ID</TableHead>
                          <TableHead className="whitespace-nowrap">Shipper</TableHead>
                          <TableHead className="whitespace-nowrap">Route</TableHead>
                          <TableHead className="whitespace-nowrap text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Receipt className="h-3 w-3" />
                              Admin Posted
                            </div>
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Truck className="h-3 w-3" />
                              Carrier Bid
                            </div>
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <TrendingUp className="h-3 w-3" />
                              Margin
                            </div>
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Wallet className="h-3 w-3" />
                              Carrier Payout
                            </div>
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Percent className="h-3 w-3" />
                              Adv %
                            </div>
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Banknote className="h-3 w-3" />
                              Advance Paid
                            </div>
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <DollarSign className="h-3 w-3" />
                              Balance Due
                            </div>
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">
                            <div className="flex items-center gap-1 justify-end font-semibold">
                              Shipper Total
                            </div>
                          </TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.map((invoice) => {
                          // Calculate financial breakdown
                          const totalAmount = parseFloat(invoice.totalAmount || '0');
                          const subtotal = parseFloat(invoice.subtotal || '0');
                          const adminPostedPrice = parseFloat(invoice.adminPostedPrice || invoice.load?.adminFinalPrice || invoice.subtotal || '0');
                          const winningBid = parseFloat(invoice.winningBidAmount || invoice.estimatedCarrierPayout || '0');
                          const platformMargin = parseFloat(invoice.platformMargin || '0') || (adminPostedPrice - winningBid);
                          const carrierPayout = parseFloat(invoice.estimatedCarrierPayout || '0') || winningBid;
                          const advancePercent = invoice.advancePaymentPercent || 0;
                          const advanceAmount = parseFloat(invoice.advancePaymentAmount || '0') || (totalAmount * advancePercent / 100);
                          const balanceDue = parseFloat(invoice.balanceOnDelivery || '0') || (totalAmount - advanceAmount);
                          
                          return (
                            <TableRow 
                              key={invoice.id} 
                              data-testid={`row-admin-invoice-${invoice.id}`}
                              className="cursor-pointer hover-elevate"
                              onClick={() => {
                                setCostBreakdownInvoice(invoice);
                                setCostBreakdownOpen(true);
                              }}
                            >
                              <TableCell className="font-medium whitespace-nowrap">{invoice.invoiceNumber}</TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground whitespace-nowrap">
                                {formatLoadId(invoice)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{invoice.shipper?.companyName || invoice.shipper?.username || '-'}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">
                                {invoice.load ? `${invoice.load.pickupCity} → ${invoice.load.dropoffCity}` : '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap">
                                Rs. {adminPostedPrice.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap text-orange-600 dark:text-orange-400">
                                {winningBid > 0 ? `Rs. ${winningBid.toLocaleString('en-IN')}` : '-'}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <span className={platformMargin > 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                                  {platformMargin > 0 ? `Rs. ${platformMargin.toLocaleString('en-IN')}` : '-'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap text-blue-600 dark:text-blue-400">
                                {carrierPayout > 0 ? `Rs. ${carrierPayout.toLocaleString('en-IN')}` : '-'}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {advancePercent > 0 ? (
                                  <Badge variant="outline" className="font-medium">
                                    {advancePercent}%
                                  </Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap text-purple-600 dark:text-purple-400">
                                {advanceAmount > 0 ? `Rs. ${advanceAmount.toLocaleString('en-IN')}` : '-'}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap font-medium">
                                {balanceDue > 0 ? `Rs. ${balanceDue.toLocaleString('en-IN')}` : '-'}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap font-bold">
                                Rs. {totalAmount.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Admin View Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-sm font-medium">Total Platform Margin</span>
                      </div>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300">
                        Rs. {filteredInvoices.reduce((sum, inv) => {
                          const adminPrice = parseFloat(inv.adminPostedPrice || inv.load?.adminFinalPrice || inv.subtotal || '0');
                          const carrierPay = parseFloat(inv.estimatedCarrierPayout || inv.winningBidAmount || '0');
                          return sum + (adminPrice - carrierPay);
                        }, 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <Truck className="h-4 w-4" />
                        <span className="text-sm font-medium">Total Carrier Payouts</span>
                      </div>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                        Rs. {filteredInvoices.reduce((sum, inv) => 
                          sum + parseFloat(inv.estimatedCarrierPayout || inv.winningBidAmount || '0'), 0
                        ).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                        <Banknote className="h-4 w-4" />
                        <span className="text-sm font-medium">Advances Collected</span>
                      </div>
                      <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                        Rs. {filteredInvoices.reduce((sum, inv) => {
                          const total = parseFloat(inv.totalAmount || '0');
                          const advPct = inv.advancePaymentPercent || 0;
                          return sum + parseFloat(inv.advancePaymentAmount || '0') || (total * advPct / 100);
                        }, 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-sm font-medium">Balance Pending</span>
                      </div>
                      <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                        Rs. {filteredInvoices.reduce((sum, inv) => {
                          if (inv.status === 'paid') return sum;
                          const total = parseFloat(inv.totalAmount || '0');
                          const advPct = inv.advancePaymentPercent || 0;
                          const advAmt = parseFloat(inv.advancePaymentAmount || '0') || (total * advPct / 100);
                          return sum + (total - advAmt);
                        }, 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden mx-auto">
          {/* Invoice Header - Professional Look */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sm:p-6 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                  <span className="text-lg sm:text-2xl font-bold truncate">{selectedInvoice?.invoiceNumber}</span>
                </div>
                <p className="text-blue-100 text-xs sm:text-sm">Freight Invoice</p>
              </div>
              <div className="flex-shrink-0">
                {selectedInvoice && getStatusBadge(selectedInvoice.status)}
              </div>
            </div>
          </div>
          
          {selectedInvoice && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              <div className="space-y-4 sm:space-y-6">
                {/* Key Details Grid - Responsive */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 sm:p-4">
                  <div className="text-center sm:border-r sm:border-slate-200 sm:dark:border-slate-700">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Load ID</Label>
                    <p className="font-bold text-base sm:text-lg font-mono mt-1 break-all">{formatLoadId(selectedInvoice)}</p>
                  </div>
                  <div className="text-center sm:border-r sm:border-slate-200 sm:dark:border-slate-700">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Created</Label>
                    <p className="font-semibold mt-1 text-sm">{format(new Date(selectedInvoice.createdAt), "d MMM yyyy")}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</Label>
                    <p className="font-semibold mt-1 text-orange-600 dark:text-orange-400 text-sm">
                      {selectedInvoice.dueDate ? format(new Date(selectedInvoice.dueDate), "d MMM yyyy") : "-"}
                    </p>
                  </div>
                </div>
                {selectedInvoice.paymentReference && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                    <span className="font-medium text-foreground">Ref:</span>
                    <span className="font-mono">{selectedInvoice.paymentReference}</span>
                  </div>
                )}

                {/* Route Card - Responsive Layout */}
                <Card className="border-2 border-blue-100 dark:border-blue-900/50">
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="text-xs uppercase tracking-wide font-semibold">Pickup Location</span>
                        </div>
                        <p className="font-semibold text-base sm:text-lg break-words">{selectedInvoice.pickupCity || selectedInvoice.load?.pickupCity || "N/A"}</p>
                        {(selectedInvoice.pickupAddress || selectedInvoice.load?.pickupAddress) && (
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {selectedInvoice.pickupAddress || selectedInvoice.load?.pickupAddress}
                          </p>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="flex items-center justify-start sm:justify-end gap-2 text-red-600 mb-2">
                          <span className="text-xs uppercase tracking-wide font-semibold">Drop Location</span>
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                        </div>
                        <p className="font-semibold text-base sm:text-lg break-words">{selectedInvoice.dropoffCity || selectedInvoice.load?.dropoffCity || "N/A"}</p>
                        {(selectedInvoice.dropoffAddress || selectedInvoice.load?.dropoffAddress) && (
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {selectedInvoice.dropoffAddress || selectedInvoice.load?.dropoffAddress}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Commodity & Weight Info - Responsive */}
                    <div className="mt-4 pt-3 border-t flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Commodity:</span>
                        <span className="font-medium break-words">{selectedInvoice.cargoDescription || selectedInvoice.load?.cargoDescription || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Weight:</span>
                        <span className="font-medium">{selectedInvoice.weight || selectedInvoice.load?.weight || "N/A"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Shipper & Carrier Info - Responsive Stack on Mobile */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Shipper Section */}
                  <Card className="border-slate-200 dark:border-slate-700/50">
                    <CardHeader className="pb-2 bg-slate-50 dark:bg-slate-900/30 rounded-t-lg">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-600 flex-shrink-0" />
                        Shipper Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3 space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Company Name</Label>
                        <p className="font-semibold text-lg">{selectedInvoice.shipper?.companyName || "N/A"}</p>
                      </div>
                      {selectedInvoice.shipper?.name && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Contact Person</Label>
                          <p className="font-medium">{selectedInvoice.shipper.name}</p>
                        </div>
                      )}
                      {selectedInvoice.shipper?.email && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Email</Label>
                          <p className="text-sm">{selectedInvoice.shipper.email}</p>
                        </div>
                      )}
                      {selectedInvoice.shipper?.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{selectedInvoice.shipper.phone}</span>
                        </div>
                      )}
                      <Separator />
                      <div>
                        <Label className="text-xs text-muted-foreground">Response Status</Label>
                        <div className="mt-1">{getShipperStatusBadge(selectedInvoice.shipperStatus)}</div>
                      </div>
                      {selectedInvoice.acknowledgedAt && (
                        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 rounded p-2">
                          <CheckCircle className="h-3 w-3" />
                          Acknowledged on {format(new Date(selectedInvoice.acknowledgedAt), "MMM d, yyyy")}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Carrier Section */}
                  <Card className="border-blue-200 dark:border-blue-700/50">
                    <CardHeader className="pb-2 bg-blue-50 dark:bg-blue-900/20 rounded-t-lg">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Truck className="h-4 w-4 text-blue-600" />
                        Carrier Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3 space-y-3">
                      {selectedInvoice.carrier ? (
                        <>
                          {/* Carrier Type Badge */}
                          <div className="flex items-center gap-2">
                            <Badge variant={selectedInvoice.carrier.carrierType === 'solo' ? 'secondary' : 'default'} className="text-xs">
                              {selectedInvoice.carrier.carrierType === 'solo' ? (
                                <><User className="h-3 w-3 mr-1" /> Solo Driver</>
                              ) : (
                                <><Building2 className="h-3 w-3 mr-1" /> Enterprise</>
                              )}
                            </Badge>
                          </div>
                          
                          {/* Carrier/Company Name */}
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              {selectedInvoice.carrier.carrierType === 'solo' ? 'Driver Name' : 'Company Name'}
                            </Label>
                            <p className="font-semibold text-lg">
                              {selectedInvoice.carrier.carrierType === 'solo' 
                                ? selectedInvoice.carrier.name 
                                : (selectedInvoice.carrier.companyName || selectedInvoice.carrier.name)}
                            </p>
                          </div>
                          
                          {/* Phone */}
                          {selectedInvoice.carrier.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{selectedInvoice.carrier.phone}</span>
                            </div>
                          )}
                          
                          <Separator />
                          
                          {/* Vehicle Info */}
                          {selectedInvoice.truck && (
                            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-3 space-y-2">
                              <Label className="text-xs text-muted-foreground font-semibold">Vehicle Information</Label>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground text-xs">Vehicle Number</span>
                                  <p className="font-semibold font-mono">{selectedInvoice.truck.licensePlate || selectedInvoice.truck.registrationNumber || "N/A"}</p>
                                </div>
                                {selectedInvoice.truck.truckType && (
                                  <div>
                                    <span className="text-muted-foreground text-xs">Truck Type</span>
                                    <p className="font-medium">{selectedInvoice.truck.truckType.replace(/_/g, ' ')}</p>
                                  </div>
                                )}
                                {(selectedInvoice.truck.make || selectedInvoice.truck.model) && (
                                  <div>
                                    <span className="text-muted-foreground text-xs">Make / Model</span>
                                    <p className="font-medium">
                                      {selectedInvoice.truck.make || ''} {selectedInvoice.truck.model || ''}
                                    </p>
                                  </div>
                                )}
                                {selectedInvoice.truck.capacity && (
                                  <div>
                                    <span className="text-muted-foreground text-xs">Capacity</span>
                                    <p className="font-medium">{selectedInvoice.truck.capacity} MT</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Trips completed */}
                          <div className="flex items-center gap-2 text-xs bg-green-50 dark:bg-green-900/20 rounded p-2">
                            <Award className="h-3 w-3 text-green-600" />
                            <span className="text-green-700 dark:text-green-400 font-medium">
                              {selectedInvoice.carrier.tripsCompleted || 0} trips completed
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-6">
                          <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                          <p className="text-muted-foreground text-sm">Carrier not yet assigned</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Invoice Amount Section - Professional Layout */}
                <Card className="border-2">
                  <CardHeader className="pb-2 bg-slate-50 dark:bg-slate-900/30">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Invoice Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {/* Line Items Table */}
                    <div className="border rounded-lg overflow-hidden mb-4">
                      <div className="bg-slate-100 dark:bg-slate-800 px-3 sm:px-4 py-2 grid grid-cols-12 gap-2 sm:gap-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <div className="col-span-7 sm:col-span-8">Description</div>
                        <div className="col-span-5 sm:col-span-4 text-right">Amount</div>
                      </div>
                      {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 ? (
                        selectedInvoice.lineItems.map((item, idx) => (
                          <div key={idx} className="px-3 sm:px-4 py-3 grid grid-cols-12 gap-2 sm:gap-4 border-t text-sm">
                            <div className="col-span-7 sm:col-span-8 text-xs sm:text-sm break-words">{item.description}</div>
                            <div className="col-span-5 sm:col-span-4 text-right font-medium text-xs sm:text-sm">Rs. {parseFloat(item.amount || '0').toLocaleString('en-IN')}</div>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 sm:px-4 py-3 grid grid-cols-12 gap-2 sm:gap-4 border-t text-sm">
                          <div className="col-span-7 sm:col-span-8">
                            <span className="flex items-center gap-2 text-xs sm:text-sm">
                              <Truck className="h-4 w-4 text-muted-foreground" />
                              <span className="break-words">
                                Freight services: {selectedInvoice.load?.pickupCity || "Origin"} to {selectedInvoice.load?.dropoffCity || "Destination"}
                              </span>
                            </span>
                          </div>
                          <div className="col-span-5 sm:col-span-4 text-right font-medium text-xs sm:text-sm">Rs. {parseFloat(selectedInvoice.subtotal || '0').toLocaleString('en-IN')}</div>
                        </div>
                      )}
                    </div>

                    {/* Total Amount */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4">
                      <span className="text-base sm:text-lg font-semibold">Total Amount</span>
                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                          Rs. {parseFloat(selectedInvoice.totalAmount || '0').toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Advance Payment Info */}
                    {selectedInvoice.advancePaymentPercent && selectedInvoice.advancePaymentPercent > 0 && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-green-600 mb-1">
                            <Star className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase">Advance Payment</span>
                          </div>
                          <p className="text-base sm:text-lg font-bold text-green-700 dark:text-green-400">
                            {selectedInvoice.advancePaymentPercent}%
                          </p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-amber-600 mb-1">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase">Balance on Delivery</span>
                          </div>
                          <p className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400">
                            {100 - selectedInvoice.advancePaymentPercent}%
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment History Timeline */}
                {(selectedInvoice.acknowledgedAt || selectedInvoice.paidAt) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Payment History
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="space-y-3">
                        {selectedInvoice.acknowledgedAt && (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">Invoice Acknowledged</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(selectedInvoice.acknowledgedAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedInvoice.paidAt && (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">Payment Received</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(selectedInvoice.paidAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(selectedInvoice.shipperCounterAmount || selectedInvoice.counterContactName) && (
                  <Card className="border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4 text-amber-600" />
                        Counter Offer Details
                        {selectedInvoice.counteredAt && (
                          <span className="text-xs font-normal text-muted-foreground">
                            - {format(new Date(selectedInvoice.counteredAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedInvoice.shipperCounterAmount && (
                        <div className="flex items-center justify-between gap-4 bg-background p-3 rounded-md border">
                          <div>
                            <p className="text-sm text-muted-foreground">Proposed Amount</p>
                            <p className="font-semibold text-lg text-amber-700 dark:text-amber-400">
                              Rs. {parseFloat(selectedInvoice.shipperCounterAmount).toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Original Amount</p>
                            <p className="font-medium">
                              Rs. {parseFloat(selectedInvoice.totalAmount || '0').toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {selectedInvoice.counterReason && (
                        <div>
                          <p className="text-sm font-medium mb-1">Reason for Counter Offer</p>
                          <p className="text-sm bg-background p-3 rounded-md border">{selectedInvoice.counterReason}</p>
                        </div>
                      )}
                      
                      {(selectedInvoice.counterContactName || selectedInvoice.counterContactPhone) && (
                        <div>
                          <p className="text-sm font-medium mb-2">Contact Information</p>
                          <div className="bg-background p-3 rounded-md border space-y-2">
                            {selectedInvoice.counterContactName && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-sm w-20">Name:</span>
                                <span className="font-medium">{selectedInvoice.counterContactName}</span>
                              </div>
                            )}
                            {selectedInvoice.counterContactCompany && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-sm w-20">Company:</span>
                                <span className="font-medium">{selectedInvoice.counterContactCompany}</span>
                              </div>
                            )}
                            {selectedInvoice.counterContactPhone && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-sm w-20">Phone:</span>
                                <span className="font-medium">{selectedInvoice.counterContactPhone}</span>
                              </div>
                            )}
                            {selectedInvoice.counterContactAddress && (
                              <div className="flex items-start gap-2">
                                <span className="text-muted-foreground text-sm w-20">Address:</span>
                                <span className="font-medium">{selectedInvoice.counterContactAddress}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {selectedInvoice.counterOffers && selectedInvoice.counterOffers.length > 0 && (
                  <Collapsible open={historyExpanded} onOpenChange={setHistoryExpanded}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="py-3 cursor-pointer hover-elevate">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <History className="h-4 w-4" />
                              Counter Offer History ({selectedInvoice.counterOffers.length})
                            </CardTitle>
                            {historyExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-4">
                          {selectedInvoice.counterOffers.map((offer, index) => (
                            <div key={offer.id} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">Counter #{index + 1}</Badge>
                                  {offer.status === "pending" && (
                                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pending
                                    </Badge>
                                  )}
                                  {offer.status === "accepted" && (
                                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Accepted
                                    </Badge>
                                  )}
                                  {offer.status === "rejected" && (
                                    <Badge variant="destructive">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Rejected
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(offer.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Proposed Amount</p>
                                <p className="font-semibold text-lg">Rs. {parseFloat(offer.proposedAmount).toLocaleString('en-IN')}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Shipper's Reason</p>
                                <p className="text-sm bg-muted/50 p-2 rounded">{offer.reason}</p>
                              </div>
                              {offer.responseNote && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Admin Response</p>
                                  <p className="text-sm bg-primary/5 p-2 rounded">{offer.responseNote}</p>
                                  {offer.respondedAt && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Responded on {format(new Date(offer.respondedAt), "MMM d, yyyy 'at' h:mm a")}
                                    </p>
                                  )}
                                </div>
                              )}
                              {offer.status === "pending" && (
                                <div className="flex gap-2 pt-2 border-t">
                                  <Button size="sm" variant="outline">
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                  <Button size="sm">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Accept
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
            {selectedInvoice?.status === "draft" && (
              <Button onClick={() => {
                sendMutation.mutate(selectedInvoice.id);
                setDetailsOpen(false);
              }}>
                <Send className="h-4 w-4 mr-2" />
                Send to Shipper
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Confirmation Dialog - Restricted to Authorized Personnel */}
      <Dialog open={markPaidConfirmOpen} onOpenChange={setMarkPaidConfirmOpen}>
        <DialogContent className="sm:max-w-lg w-[95vw] mx-auto max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <span className="truncate">Confirm Payment Recording</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              This action is restricted to authorized accounts personnel only.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                By proceeding, you confirm that:
              </p>
              <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 mt-2 space-y-1">
                <li>You are authorized to record payments</li>
                <li>Payment has been verified in the bank account</li>
                <li>The full invoice amount has been received</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setMarkPaidConfirmOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (invoiceToMarkPaid) {
                  markPaidMutation.mutate(invoiceToMarkPaid);
                }
                setMarkPaidConfirmOpen(false);
                setInvoiceToMarkPaid(null);
              }}
              disabled={markPaidMutation.isPending}
              className="w-full sm:w-auto"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Confirm Payment Received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cost Breakdown Dialog for Admin View */}
      <Dialog open={costBreakdownOpen} onOpenChange={setCostBreakdownOpen}>
        <DialogContent className="sm:max-w-3xl w-[95vw] mx-auto max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calculator className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">Cost Breakdown</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              {costBreakdownInvoice?.invoiceNumber} - Internal financial details
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
          {costBreakdownInvoice && (() => {
            const totalAmount = parseFloat(costBreakdownInvoice.totalAmount || '0');
            const adminPostedPrice = parseFloat(costBreakdownInvoice.adminPostedPrice || costBreakdownInvoice.load?.adminFinalPrice || costBreakdownInvoice.subtotal || '0');
            const winningBid = parseFloat(costBreakdownInvoice.winningBidAmount || costBreakdownInvoice.estimatedCarrierPayout || '0');
            const platformMargin = parseFloat(costBreakdownInvoice.platformMargin || '0') || (adminPostedPrice - winningBid);
            const carrierPayout = parseFloat(costBreakdownInvoice.estimatedCarrierPayout || '0') || winningBid;
            const advancePercent = costBreakdownInvoice.advancePaymentPercent || 0;
            const advanceAmount = parseFloat(costBreakdownInvoice.advancePaymentAmount || '0') || (totalAmount * advancePercent / 100);
            const balanceDue = parseFloat(costBreakdownInvoice.balanceOnDelivery || '0') || (totalAmount - advanceAmount);
            
            return (
              <div className="space-y-3 sm:space-y-4">
                {/* Route Info - Responsive */}
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="font-semibold">Route</span>
                  </div>
                  <p className="font-medium text-sm sm:text-base break-words">
                    {costBreakdownInvoice.load 
                      ? `${costBreakdownInvoice.load.pickupCity} → ${costBreakdownInvoice.load.dropoffCity}` 
                      : '-'}
                  </p>
                </div>

                {/* Shipper & Carrier Info - Responsive */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="font-semibold">Shipper</span>
                    </div>
                    <p className="font-medium text-sm sm:text-base break-words">
                      {costBreakdownInvoice.shipper?.companyName || costBreakdownInvoice.shipper?.username || '-'}
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-2">
                      <Truck className="h-4 w-4 flex-shrink-0" />
                      <span className="font-semibold">Carrier</span>
                    </div>
                    <p className="font-medium text-sm sm:text-base break-words">
                      {costBreakdownInvoice.carrier?.companyName || costBreakdownInvoice.carrier?.name || '-'}
                    </p>
                    {costBreakdownInvoice.carrier && (
                      <Badge variant="outline" className="text-xs mt-2 inline-block">
                        {costBreakdownInvoice.carrier.carrierType === 'solo' ? 'Solo Driver' : 'Enterprise'}
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Price Breakdown - Responsive Cards */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5 flex-shrink-0" />
                    Price Breakdown
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Admin Posted Price */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg border p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <DollarSign className="h-4 w-4 flex-shrink-0" />
                        <span>Admin Posted Price</span>
                      </div>
                      <p className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">
                        Rs. {adminPostedPrice.toLocaleString('en-IN')}
                      </p>
                    </div>
                    
                    {/* Winning Carrier Bid */}
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700/50 p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 mb-2">
                        <TrendingUp className="h-4 w-4 flex-shrink-0" />
                        <span>Winning Carrier Bid</span>
                      </div>
                      <p className="font-bold text-lg sm:text-xl text-orange-600 dark:text-orange-400">
                        {winningBid > 0 ? `Rs. ${winningBid.toLocaleString('en-IN')}` : '-'}
                      </p>
                    </div>
                    
                    {/* Platform Margin */}
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700/50 p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-2">
                        <Wallet className="h-4 w-4 flex-shrink-0" />
                        <span>Platform Margin</span>
                      </div>
                      <p className="font-bold text-lg sm:text-xl text-green-600 dark:text-green-400">
                        {platformMargin > 0 ? `Rs. ${platformMargin.toLocaleString('en-IN')}` : '-'}
                      </p>
                    </div>
                    
                    {/* Carrier Payout */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700/50 p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-2">
                        <Wallet className="h-4 w-4 flex-shrink-0" />
                        <span>Carrier Payout</span>
                      </div>
                      <p className="font-bold text-lg sm:text-xl text-blue-600 dark:text-blue-400">
                        {carrierPayout > 0 ? `Rs. ${carrierPayout.toLocaleString('en-IN')}` : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Payment Schedule - Responsive */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                    <Banknote className="h-5 w-5 flex-shrink-0" />
                    Payment Schedule
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Shipper Total */}
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 sm:p-4 sm:col-span-3 lg:col-span-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Receipt className="h-4 w-4 flex-shrink-0" />
                        <span>Shipper Total (Invoice)</span>
                      </div>
                      <p className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">
                        Rs. {totalAmount.toLocaleString('en-IN')}
                      </p>
                    </div>
                    
                    {advancePercent > 0 && (
                      <>
                        {/* Advance Payment */}
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700/50 p-3 sm:p-4">
                          <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 mb-2">
                            <Percent className="h-4 w-4 flex-shrink-0" />
                            <span>Advance ({advancePercent}%)</span>
                          </div>
                          <p className="font-bold text-lg sm:text-xl text-purple-600 dark:text-purple-400">
                            Rs. {advanceAmount.toLocaleString('en-IN')}
                          </p>
                        </div>
                        
                        {/* Balance on Delivery */}
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50 p-3 sm:p-4">
                          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-2">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span>Balance on Delivery</span>
                          </div>
                          <p className="font-bold text-lg sm:text-xl text-amber-600 dark:text-amber-400">
                            Rs. {balanceDue.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Status - Responsive */}
                <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Invoice Status</span>
                    <div className="flex-shrink-0">
                      {getStatusBadge(costBreakdownInvoice.status)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setCostBreakdownOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
