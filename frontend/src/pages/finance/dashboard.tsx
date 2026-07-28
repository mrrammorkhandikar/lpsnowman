import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Package, Truck, FileText, CheckCircle, AlertCircle, Clock, Eye,
  Search, DollarSign, Phone, Building2, XCircle, PauseCircle,
  User, MapPin, Filter, ArrowDown, FileCheck
} from "lucide-react";
import { getDocumentUrl } from "@/lib/document-utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { shipmentPayoutSummary } from "@/lib/finance-payout-utils";
import { CarrierPayoutSummaryCard } from "@/components/finance/carrier-payout-summary-card";
import { CarrierAdvancePaymentStatusButtons } from "@/components/finance/carrier-advance-payment-block";
import { MyFleetPricingCard } from "@/components/finance/my-fleet-pricing-card";

interface FinanceShipment {
  id: string;
  loadId: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  physicalPodSubmittedAt: string | null;
  load: {
    id: string;
    referenceNumber: number | null;
    pickupCity: string;
    pickupAddress: string;
    pickupState: string | null;
    pickupLocality: string | null;
    pickupLandmark: string | null;
    dropoffCity: string;
    dropoffAddress: string;
    dropoffState: string | null;
    dropoffLocality: string | null;
    dropoffLandmark: string | null;
    dropoffBusinessName: string | null;
    materialType: string | null;
    weight: string;
    requiredTruckType: string | null;
    pickupDate: string | null;
    deliveryDate: string | null;
    adminFinalPrice: string | null;
    finalPrice: string | null;
    carrierAdvancePercent: number | null;
    advancePaymentPercent: number | null;
    pricingType?: "marketplace" | "my_fleet";
    myFleetPricing?: {
      distance: number;
      monthlySalary: number;
      tripsPerMonth: number;
      proratedSalaryPerTrip: number;
      fuel: number;
      tolls: number;
      maintenance: number;
      miscellaneous: number;
      monthlyDepreciation: number;
      monthlyOverhead: number;
      proratedPerTrip: number;
      totalTripCost: number;
      costPerKm: number;
      shipperPrice: number;
      profitMarginPercent: number;
      netProfitLoss: number;
      notes: string;
    };
  } | null;
  invoicePaid?: boolean;
  shipper: {
    id: string;
    username: string;
    companyName: string;
    phone: string | null;
  } | null;
  carrier: {
    id: string;
    username: string;
    companyName: string;
    phone: string | null;
    carrierType: string;
  } | null;
  documents: {
    id: string;
    documentType: string;
    fileName: string;
    fileUrl: string | null;
    fileSize: number | null;
    isVerified: boolean | null;
    createdAt: string | null;
  }[];
  financeReview: {
    id: string;
    status: string;
    comment: string | null;
    paymentStatus: string;
    advancePaymentReleasedAt?: string | null;
    reviewedAt: string | null;
    reviewerName: string;
  } | null;
  pricing: {
    platformMargin: number;
    platformMarginPercent: number;
  } | null;
  settlement: {
    grossAmount: number;
    platformFee: number;
    deductions: number;
    deductionReason: string | null;
    netPayout: number;
  } | null;
}

const documentTypeLabels: Record<string, string> = {
  lr_consignment: "LR / Consignment Note",
  eway_bill: "E-way Bill",
  loading_photos: "Loading Photos",
  pod: "Proof of Delivery (POD)",
  invoice: "Invoice",
  other: "Other Document",
};

const reviewStatusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  approved: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  on_hold: { label: "On Hold", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", icon: PauseCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  not_released: { label: "Not Released", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  released: { label: "Released", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

export default function FinanceDashboard() {
  const { toast } = useToast();
  const [selectedShipment, setSelectedShipment] = useState<FinanceShipment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  const { data: shipments = [], isLoading } = useQuery<FinanceShipment[]>({
    queryKey: ["/api/finance/shipments"],
  });

  // Dummy My Fleet shipments for testing
  const dummyMyFleetShipments: FinanceShipment[] = [
    {
      id: "myfleet-001",
      loadId: "MF-001",
      status: "completed",
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      startedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      physicalPodSubmittedAt: new Date(Date.now() - 86400000).toISOString(),
      load: {
        id: "load-mf-001",
        referenceNumber: 2001,
        pickupCity: "Mumbai",
        pickupAddress: "123 Industrial Area, Bhiwandi",
        pickupState: "Maharashtra",
        pickupLocality: "Bhiwandi East",
        pickupLandmark: "Near Railway Station",
        dropoffCity: "Ahmedabad",
        dropoffAddress: "456 Trade Center, Ahmedabad",
        dropoffState: "Gujarat",
        dropoffLocality: "Ahmedabad West",
        dropoffLandmark: "Near Airport",
        dropoffBusinessName: "ABC Trading Co.",
        materialType: "Steel Coils",
        weight: "22",
        requiredTruckType: "Taurus 21T",
        pickupDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        deliveryDate: new Date(Date.now() - 86400000 * 4).toISOString(),
        adminFinalPrice: "45000",
        finalPrice: "43000",
        carrierAdvancePercent: 20,
        advancePaymentPercent: 20,
        pricingType: "my_fleet",
        myFleetPricing: {
          distance: 100,
          monthlySalary: 30000,
          tripsPerMonth: 8,
          proratedSalaryPerTrip: 3750,
          fuel: 5000,
          tolls: 2300,
          maintenance: 4500,
          miscellaneous: 2500,
          monthlyDepreciation: 15000,
          monthlyOverhead: 10000,
          proratedPerTrip: 3125,
          totalTripCost: 21175,
          costPerKm: 211.75,
          shipperPrice: 45000,
          profitMarginPercent: 53.06,
          netProfitLoss: 23825,
          notes: "Standard route with good margins",
        },
      },
      invoicePaid: true,
      shipper: {
        id: "shipper-001",
        username: "abc_logistics",
        companyName: "ABC Logistics",
        phone: "+91 98765 43210",
      },
      carrier: {
        id: "carrier-001",
        username: "rajesh_transport",
        companyName: "Rajesh Transport",
        phone: "+91 98765 43211",
        carrierType: "enterprise",
      },
      documents: [
        {
          id: "doc-001",
          documentType: "lr_consignment",
          fileName: "LR_Consignment_Note.pdf",
          fileUrl: "/mock/lr_note.pdf",
          fileSize: 245000,
          isVerified: true,
          createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        },
        {
          id: "doc-002",
          documentType: "pod",
          fileName: "POD_Delivery.pdf",
          fileUrl: "/mock/pod.pdf",
          fileSize: 310000,
          isVerified: true,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
      ],
      financeReview: {
        id: "review-001",
        status: "approved",
        comment: "All documents verified",
        paymentStatus: "released",
        advancePaymentReleasedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        reviewedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        reviewerName: "Admin User",
      },
      pricing: {
        platformMargin: 2000,
        platformMarginPercent: 4.44,
      },
      settlement: {
        grossAmount: 45000,
        platformFee: 2000,
        deductions: 0,
        deductionReason: null,
        netPayout: 43000,
      },
    },
    {
      id: "myfleet-002",
      loadId: "MF-002",
      status: "in_transit",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      completedAt: null,
      physicalPodSubmittedAt: null,
      load: {
        id: "load-mf-002",
        referenceNumber: 2002,
        pickupCity: "Ludhiana",
        pickupAddress: "789 Industrial Park, Ludhiana",
        pickupState: "Punjab",
        pickupLocality: "Ludhiana North",
        pickupLandmark: "Near Highway",
        dropoffCity: "Jaipur",
        dropoffAddress: "321 Business Hub, Jaipur",
        dropoffState: "Rajasthan",
        dropoffLocality: "Jaipur South",
        dropoffLandmark: "Near City Center",
        dropoffBusinessName: "XYZ Enterprises",
        materialType: "Textiles",
        weight: "15",
        requiredTruckType: "28 ft SXL",
        pickupDate: new Date(Date.now() - 86400000).toISOString(),
        deliveryDate: new Date(Date.now() + 86400000).toISOString(),
        adminFinalPrice: "35000",
        finalPrice: "33500",
        carrierAdvancePercent: 25,
        advancePaymentPercent: 25,
        pricingType: "my_fleet",
        myFleetPricing: {
          distance: 450,
          monthlySalary: 28000,
          tripsPerMonth: 10,
          proratedSalaryPerTrip: 2800,
          fuel: 4500,
          tolls: 1800,
          maintenance: 3500,
          miscellaneous: 2000,
          monthlyDepreciation: 12000,
          monthlyOverhead: 8000,
          proratedPerTrip: 2000,
          totalTripCost: 16600,
          costPerKm: 36.89,
          shipperPrice: 35000,
          profitMarginPercent: 52.57,
          netProfitLoss: 18400,
          notes: "High volume route",
        },
      },
      invoicePaid: false,
      shipper: {
        id: "shipper-002",
        username: "xyz_enterprises",
        companyName: "XYZ Enterprises",
        phone: "+91 98765 43212",
      },
      carrier: {
        id: "carrier-002",
        username: "sharma_logistics",
        companyName: "Sharma Logistics",
        phone: "+91 98765 43213",
        carrierType: "enterprise",
      },
      documents: [
        {
          id: "doc-003",
          documentType: "lr_consignment",
          fileName: "LR_Consignment_Ludhiana.pdf",
          fileUrl: "/mock/lr_ludhiana.pdf",
          fileSize: 220000,
          isVerified: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: "doc-004",
          documentType: "eway_bill",
          fileName: "E_Way_Bill_Ludhiana.pdf",
          fileUrl: "/mock/eway_ludhiana.pdf",
          fileSize: 180000,
          isVerified: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      financeReview: {
        id: "review-002",
        status: "pending",
        comment: null,
        paymentStatus: "processing",
        advancePaymentReleasedAt: new Date(Date.now() - 86400000).toISOString(),
        reviewedAt: null,
        reviewerName: "Pending",
      },
      pricing: {
        platformMargin: 1500,
        platformMarginPercent: 4.29,
      },
      settlement: {
        grossAmount: 35000,
        platformFee: 1500,
        deductions: 0,
        deductionReason: null,
        netPayout: 33500,
      },
    },
    {
      id: "myfleet-003",
      loadId: "MF-003",
      status: "completed",
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      startedAt: new Date(Date.now() - 86400000 * 9).toISOString(),
      completedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      physicalPodSubmittedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
      load: {
        id: "load-mf-003",
        referenceNumber: 2003,
        pickupCity: "Bengaluru",
        pickupAddress: "555 Tech Park, Bengaluru",
        pickupState: "Karnataka",
        pickupLocality: "Bengaluru East",
        pickupLandmark: "Near IT Hub",
        dropoffCity: "Chennai",
        dropoffAddress: "666 Business District, Chennai",
        dropoffState: "Tamil Nadu",
        dropoffLocality: "Chennai North",
        dropoffLandmark: "Near Port",
        dropoffBusinessName: "Tech Solutions Ltd.",
        materialType: "Electronics",
        weight: "12",
        requiredTruckType: "Container 20ft",
        pickupDate: new Date(Date.now() - 86400000 * 10).toISOString(),
        deliveryDate: new Date(Date.now() - 86400000 * 9).toISOString(),
        adminFinalPrice: "28000",
        finalPrice: "26500",
        carrierAdvancePercent: 30,
        advancePaymentPercent: 30,
        pricingType: "my_fleet",
        myFleetPricing: {
          distance: 350,
          monthlySalary: 32000,
          tripsPerMonth: 12,
          proratedSalaryPerTrip: 2667,
          fuel: 4200,
          tolls: 1500,
          maintenance: 3200,
          miscellaneous: 1800,
          monthlyDepreciation: 14000,
          monthlyOverhead: 9000,
          proratedPerTrip: 1917,
          totalTripCost: 15284,
          costPerKm: 43.67,
          shipperPrice: 28000,
          profitMarginPercent: 45.41,
          netProfitLoss: 12716,
          notes: "Tech cargo - premium handling",
        },
      },
      invoicePaid: true,
      shipper: {
        id: "shipper-003",
        username: "tech_solutions",
        companyName: "Tech Solutions Ltd.",
        phone: "+91 98765 43214",
      },
      carrier: {
        id: "carrier-003",
        username: "kumar_fleet",
        companyName: "Kumar Fleet Services",
        phone: "+91 98765 43215",
        carrierType: "enterprise",
      },
      documents: [
        {
          id: "doc-005",
          documentType: "lr_consignment",
          fileName: "LR_Bengaluru_Chennai.pdf",
          fileUrl: "/mock/lr_bangalore.pdf",
          fileSize: 195000,
          isVerified: true,
          createdAt: new Date(Date.now() - 86400000 * 9).toISOString(),
        },
        {
          id: "doc-006",
          documentType: "pod",
          fileName: "POD_Chennai_Delivery.pdf",
          fileUrl: "/mock/pod_chennai.pdf",
          fileSize: 280000,
          isVerified: true,
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        },
      ],
      financeReview: {
        id: "review-003",
        status: "approved",
        comment: "All documents verified and approved",
        paymentStatus: "released",
        advancePaymentReleasedAt: new Date(Date.now() - 86400000 * 9).toISOString(),
        reviewedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
        reviewerName: "Admin User",
      },
      pricing: {
        platformMargin: 1500,
        platformMarginPercent: 5.36,
      },
      settlement: {
        grossAmount: 28000,
        platformFee: 1500,
        deductions: 0,
        deductionReason: null,
        netPayout: 26500,
      },
    },
  ];

  // Combine real shipments with dummy My Fleet shipments
  const allShipments = [...(shipments || []), ...dummyMyFleetShipments];

  const advancePaymentMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const res = await apiRequest("PATCH", `/api/finance/reviews/${reviewId}/advance-payment`, {});
      return res.json();
    },
    onSuccess: (updatedReview) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/shipments"] });
      setSelectedShipment((prev) => {
        if (!prev || !prev.financeReview) return prev;
        return {
          ...prev,
          financeReview: {
            ...prev.financeReview,
            advancePaymentReleasedAt:
              updatedReview.advancePaymentReleasedAt || new Date().toISOString(),
          },
        };
      });
      toast({ title: "Advance Released", description: "Advance payment recorded." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to release advance.",
        variant: "destructive",
      });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: { reviewId: string; paymentStatus: string }) => {
      const res = await apiRequest("PATCH", `/api/finance/reviews/${data.reviewId}/payment`, { paymentStatus: data.paymentStatus });
      return res.json();
    },
    onSuccess: (_updatedReview, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/shipments"] });
      setSelectedShipment((prev) => {
        if (!prev || !prev.financeReview) return prev;
        return {
          ...prev,
          financeReview: {
            ...prev.financeReview,
            paymentStatus: variables.paymentStatus,
          },
        };
      });
      toast({ title: "Payment Updated", description: "Payment status has been updated." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update payment.",
        variant: "destructive",
      });
    },
  });

  const physicalPodMutation = useMutation({
    mutationFn: async (data: { shipmentId: string }) => {
      const res = await apiRequest("PATCH", `/api/shipments/${data.shipmentId}/physical-pod-submitted`, {});
      return res.json();
    },
    onSuccess: (updatedShipment) => {
      // Update the shipments list in cache
      queryClient.setQueryData<FinanceShipment[]>(
        ["/api/finance/shipments"],
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map((s) =>
            s.id === updatedShipment.id
              ? { ...s, physicalPodSubmittedAt: updatedShipment.physicalPodSubmittedAt }
              : s
          );
        }
      );

      // Update selectedShipment immediately with the response
      setSelectedShipment((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          physicalPodSubmittedAt: updatedShipment.physicalPodSubmittedAt || new Date().toISOString(),
        };
      });

      // Refetch to ensure data is fresh from server
      queryClient.refetchQueries({ queryKey: ["/api/finance/shipments"] });

      toast({ title: "Physical POD Submitted", description: "Physical copy of POD has been marked as submitted. Penalty count will stop from today." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit physical POD.", variant: "destructive" });
    },
  });

  const filteredShipments = allShipments.filter((s) => {
    const matchesSearch = searchQuery === "" ||
      s.load?.referenceNumber?.toString().includes(searchQuery) ||
      s.load?.pickupCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.load?.dropoffCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.carrier?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.shipper?.companyName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPayment =
      paymentFilter === "all" ||
      s.financeReview?.paymentStatus === paymentFilter;

    return matchesSearch && matchesPayment;
  });

  const stats = {
    total: allShipments.length,
    notReleased: allShipments.filter(s => s.financeReview?.paymentStatus === "not_released").length,
    processing: allShipments.filter(s => s.financeReview?.paymentStatus === "processing").length,
    paymentReleased: allShipments.filter(s => s.financeReview?.paymentStatus === "released").length,
    advanceReleased: allShipments.filter(s => !!s.financeReview?.advancePaymentReleasedAt).length,
  };

  return (
    <div className="min-h-full sm:min-h-screen sm:overflow-y-auto" data-testid="finance-dashboard">
      <div className="flex flex-col sm:flex-row h-full sm:h-auto">
        <div className="flex-1 flex flex-col sm:min-h-0">
          <div className="p-4 border-b space-y-4">
            <h1 className="text-xl font-bold" data-testid="text-finance-title">Finance Document Review</h1>
            <p className="text-sm text-muted-foreground">
              Only loads approved from Live Tracking appear here.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Approved Loads</div>
                <div className="text-lg font-bold" data-testid="stat-total">{stats.total}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Not Released</div>
                <div className="text-lg font-bold text-yellow-600" data-testid="stat-not-released">{stats.notReleased}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Processing</div>
                <div className="text-lg font-bold text-blue-600" data-testid="stat-processing">{stats.processing}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Payment Released</div>
                <div className="text-lg font-bold text-green-600" data-testid="stat-released">{stats.paymentReleased}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Advance Released</div>
                <div className="text-lg font-bold text-green-600" data-testid="stat-advance-released">{stats.advanceReleased}</div>
              </Card>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reference, city, carrier, shipper..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-payment-filter">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="not_released">Not Released</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 sm:flex-initial sm:min-h-0">
            <div className="h-full sm:h-auto">
              <ScrollArea className="h-[calc(100vh-280px)] sm:h-[calc(100vh-260px)]">
                <div className="p-4 space-y-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredShipments.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground" data-testid="text-no-shipments">
                      {allShipments.length === 0
                        ? "No approved loads yet. Approve loads from Live Tracking to see them here."
                        : "No shipments match your search or filter."}
                    </div>
                  ) : (
                    filteredShipments.map((shipment) => {
                      const reviewConfig = shipment.financeReview
                        ? reviewStatusConfig[shipment.financeReview.status] || reviewStatusConfig.pending
                        : reviewStatusConfig.pending;
                      const paymentConfig = shipment.financeReview
                        ? paymentStatusConfig[shipment.financeReview.paymentStatus] || paymentStatusConfig.not_released
                        : paymentStatusConfig.not_released;
                      const ReviewIcon = reviewConfig.icon;
                      const docCount = shipment.documents.length;
                      const isSelected = selectedShipment?.id === shipment.id;
                      const podSubmitted = !!shipment.physicalPodSubmittedAt;

                      return (
                        <Card
                          key={shipment.id}
                          className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}
                          onClick={() => setSelectedShipment(shipment)}
                          data-testid={`shipment-card-${shipment.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-semibold text-sm">
                                    Load #{shipment.load?.referenceNumber || "N/A"}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {shipment.status}
                                  </Badge>
                                  <Badge className={`text-xs ${reviewConfig.color}`}>
                                    <ReviewIcon className="h-3 w-3 mr-1" />
                                    {reviewConfig.label}
                                  </Badge>
                                  <Badge className={`text-xs ${paymentConfig.color}`}>
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    {paymentConfig.label}
                                  </Badge>
                                  <Badge className={`text-xs ${podSubmitted ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>
                                    <FileCheck className="h-3 w-3 mr-1" />
                                    {podSubmitted ? "POD-Submit" : "POD-Pending"}
                                  </Badge>
                                  <Badge className={`text-xs ${shipment.load?.pricingType === "my_fleet" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                    {shipment.load?.pricingType === "my_fleet" ? "My Fleet" : "Marketplace"}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {shipment.load?.pickupCity || "N/A"} to {shipment.load?.dropoffCity || "N/A"}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {shipment.carrier?.companyName || "N/A"}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {docCount} doc{docCount !== 1 ? "s" : ""}
                                  </span>
                                  {shipment.load?.weight && (
                                    <span>{shipment.load.weight} MT</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {selectedShipment && (
          <div className="w-[420px] border-l flex flex-col overflow-hidden bg-background hidden sm:flex h-screen">
            <div className="p-4 border-b flex items-center justify-between gap-2 shrink-0">
              <h2 className="font-semibold text-sm" data-testid="text-detail-title">
                Load #{selectedShipment.load?.referenceNumber || "N/A"}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedShipment(null)} data-testid="button-close-detail">
                <XCircle className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" /> Load Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div className="space-y-2">
                      <div className="p-2 bg-muted/50 rounded-lg space-y-1">
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> Pickup</p>
                        <p className="font-medium">{selectedShipment.load?.pickupAddress}</p>
                        {selectedShipment.load?.pickupLocality && (
                          <p className="text-muted-foreground">{selectedShipment.load.pickupLocality}</p>
                        )}
                        <p>{selectedShipment.load?.pickupCity}{selectedShipment.load?.pickupState ? `, ${selectedShipment.load.pickupState}` : ""}</p>
                        {selectedShipment.load?.pickupLandmark && (
                          <p className="text-xs text-muted-foreground">Landmark: {selectedShipment.load.pickupLandmark}</p>
                        )}
                        {selectedShipment.load?.pickupDate && (
                          <p className="text-xs text-muted-foreground">{format(new Date(selectedShipment.load.pickupDate), "MMM d, yyyy")}</p>
                        )}
                      </div>
                      <div className="flex justify-center">
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="p-2 bg-muted/50 rounded-lg space-y-1">
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> Dropoff</p>
                        {selectedShipment.load?.dropoffBusinessName && (
                          <p className="font-medium">{selectedShipment.load.dropoffBusinessName}</p>
                        )}
                        <p className={selectedShipment.load?.dropoffBusinessName ? "" : "font-medium"}>{selectedShipment.load?.dropoffAddress}</p>
                        {selectedShipment.load?.dropoffLocality && (
                          <p className="text-muted-foreground">{selectedShipment.load.dropoffLocality}</p>
                        )}
                        <p>{selectedShipment.load?.dropoffCity}{selectedShipment.load?.dropoffState ? `, ${selectedShipment.load.dropoffState}` : ""}</p>
                        {selectedShipment.load?.dropoffLandmark && (
                          <p className="text-xs text-muted-foreground">Landmark: {selectedShipment.load.dropoffLandmark}</p>
                        )}
                        {selectedShipment.load?.deliveryDate && (
                          <p className="text-xs text-muted-foreground">{format(new Date(selectedShipment.load.deliveryDate), "MMM d, yyyy")}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 pt-1 border-t">
                      <p><span className="text-muted-foreground">Material:</span> {selectedShipment.load?.materialType || "N/A"}</p>
                      <p><span className="text-muted-foreground">Weight:</span> {selectedShipment.load?.weight || "N/A"} MT</p>
                      <p><span className="text-muted-foreground">Truck Type:</span> {selectedShipment.load?.requiredTruckType?.replace(/_/g, " ") || "N/A"}</p>
                      {selectedShipment.load?.adminFinalPrice && (
                        <p><span className="text-muted-foreground">Price:</span> INR {parseFloat(selectedShipment.load.adminFinalPrice).toLocaleString()}</p>
                      )}
                      <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="text-xs ml-1">{selectedShipment.status?.replace(/_/g, " ")}</Badge></div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4" /> Carrier Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p className="font-medium">{selectedShipment.carrier?.companyName || "N/A"}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {selectedShipment.carrier?.carrierType === "solo" ? "Solo Operator" : "Fleet/Company"}
                      </Badge>
                    </div>
                    {selectedShipment.carrier?.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {selectedShipment.carrier.phone}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" /> Shipper
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p className="font-medium">{selectedShipment.shipper?.companyName || "N/A"}</p>
                    {selectedShipment.shipper?.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {selectedShipment.shipper.phone}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Shipment Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { key: "lr_consignment", label: "LR / Consignment Note" },
                      { key: "eway_bill", label: "E-way Bill" },
                      { key: "loading_photos", label: "Loading Photos" },
                      { key: "pod", label: "Proof of Delivery (POD)" },
                      { key: "invoice", label: "Invoice" },
                      { key: "other", label: "Other Document" },
                    ].map((docItem) => {
                      const doc = selectedShipment.documents.find(d => d.documentType === docItem.key);
                      const hasDocument = !!doc?.fileUrl;
                      const isVerified = doc?.isVerified === true;
                      return (
                        <div
                          key={docItem.key}
                          className={`flex items-center justify-between p-2 bg-muted/50 rounded-lg ${isVerified ? "cursor-pointer hover-elevate" : ""}`}
                          onClick={() => {
                            if (isVerified && doc?.fileUrl) {
                              const url = getDocumentUrl(doc.fileUrl);
                              if (url) {
                                window.open(url, "_blank");
                              }
                            }
                          }}
                          data-testid={`finance-doc-${docItem.key}`}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{docItem.label}</span>
                          </div>
                          <div>
                            {isVerified ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-pointer">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                View
                              </Badge>
                            ) : hasDocument ? (
                              <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700">
                                <Clock className="h-3 w-3 mr-1" />
                                Awaiting Approval
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Not Uploaded
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {selectedShipment.load?.pricingType === "my_fleet" && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Receipts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {[
                        { key: "fuel_receipt", label: "Fuel Receipt" },
                        { key: "toll_receipt", label: "Toll Receipt" },
                        { key: "maintenance_receipt", label: "Maintenance Receipt" },
                        { key: "other_receipt", label: "Other Receipt" },
                      ].map((receiptItem) => {
                        const receipt = selectedShipment.documents.find(d => d.documentType === receiptItem.key);
                        const hasDocument = !!receipt?.fileUrl;
                        const isVerified = receipt?.isVerified === true;
                        return (
                          <div
                            key={receiptItem.key}
                            className={`flex items-center justify-between p-2 bg-muted/50 rounded-lg ${isVerified ? "cursor-pointer hover-elevate" : ""}`}
                            onClick={() => {
                              if (isVerified && receipt?.fileUrl) {
                                const url = getDocumentUrl(receipt.fileUrl);
                                if (url) {
                                  window.open(url, "_blank");
                                }
                              }
                            }}
                            data-testid={`finance-receipt-${receiptItem.key}`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{receiptItem.label}</span>
                            </div>
                            <div>
                              {isVerified ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-pointer">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  View
                                </Badge>
                              ) : hasDocument ? (
                                <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Awaiting Approval
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Not Uploaded
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {selectedShipment.load?.pricingType !== "my_fleet" && (
                  <CarrierPayoutSummaryCard shipment={selectedShipment} />
                )}

                {selectedShipment.load?.pricingType === "my_fleet" && selectedShipment.load?.myFleetPricing && (
                  <MyFleetPricingCard
                    pricing={selectedShipment.load.myFleetPricing}
                    onUpdate={(updates) => {
                      setSelectedShipment(prev => {
                        if (!prev || !prev.load?.myFleetPricing) return prev;
                        return {
                          ...prev,
                          load: {
                            ...prev.load,
                            myFleetPricing: {
                              ...prev.load.myFleetPricing,
                              ...updates,
                            }
                          }
                        };
                      });
                    }}
                  />
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Live Tracking Approval
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedShipment.financeReview && (
                      <div className="text-sm space-y-1 p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">Review Status:</span>
                          {(() => {
                            const config = reviewStatusConfig[selectedShipment.financeReview.status] || reviewStatusConfig.pending;
                            const Icon = config.icon;
                            return (
                              <Badge className={`text-xs ${config.color}`}>
                                <Icon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        {selectedShipment.financeReview.comment && (
                          <p><span className="text-muted-foreground">Comment:</span> {selectedShipment.financeReview.comment}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Approved by {selectedShipment.financeReview.reviewerName}
                          {selectedShipment.financeReview.reviewedAt && (
                            <> on {format(new Date(selectedShipment.financeReview.reviewedAt), "MMM d, yyyy 'at' h:mm a")}</>
                          )}
                        </p>
                      </div>
                    )}

                    {selectedShipment.financeReview && (
                      <CarrierAdvancePaymentStatusButtons
                        reviewId={selectedShipment.financeReview.id}
                        paymentStatus={selectedShipment.financeReview.paymentStatus}
                        advancePaymentReleasedAt={selectedShipment.financeReview.advancePaymentReleasedAt ?? null}
                        physicalPodSubmittedAt={selectedShipment.physicalPodSubmittedAt}
                        invoicePaid={!!selectedShipment.invoicePaid}
                        isDelivered={["delivered", "closed"].includes(selectedShipment.status)}
                        payoutSummary={shipmentPayoutSummary(selectedShipment)}
                        onAdvancePayment={() =>
                          advancePaymentMutation.mutate(selectedShipment.financeReview!.id)
                        }
                        onPaymentStatus={(status) =>
                          paymentMutation.mutate({
                            reviewId: selectedShipment.financeReview!.id,
                            paymentStatus: status,
                          })
                        }
                        onPhysicalPod={() =>
                          physicalPodMutation.mutate({ shipmentId: selectedShipment.id })
                        }
                        advancePending={advancePaymentMutation.isPending}
                        paymentPending={paymentMutation.isPending}
                        physicalPodPending={physicalPodMutation.isPending}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Mobile Detail Panel - Only shown on mobile */}
        {selectedShipment && (
          <div className="sm:hidden fixed inset-0 z-50 bg-background">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sm" data-testid="text-detail-title">
                  Load #{selectedShipment.load?.referenceNumber || "N/A"}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setSelectedShipment(null)} data-testid="button-close-detail">
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" /> Load Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      <div className="space-y-2">
                        <div className="p-2 bg-muted/50 rounded-lg space-y-1">
                          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> Pickup</p>
                          <p className="font-medium">{selectedShipment.load?.pickupAddress}</p>
                          {selectedShipment.load?.pickupLocality && (
                            <p className="text-muted-foreground">{selectedShipment.load.pickupLocality}</p>
                          )}
                          <p>{selectedShipment.load?.pickupCity}{selectedShipment.load?.pickupState ? `, ${selectedShipment.load.pickupState}` : ""}</p>
                          {selectedShipment.load?.pickupLandmark && (
                            <p className="text-xs text-muted-foreground">Landmark: {selectedShipment.load.pickupLandmark}</p>
                          )}
                          {selectedShipment.load?.pickupDate && (
                            <p className="text-xs text-muted-foreground">{format(new Date(selectedShipment.load.pickupDate), "MMM d, yyyy")}</p>
                          )}
                        </div>
                        <div className="flex justify-center">
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg space-y-1">
                          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> Dropoff</p>
                          {selectedShipment.load?.dropoffBusinessName && (
                            <p className="font-medium">{selectedShipment.load.dropoffBusinessName}</p>
                          )}
                          <p className={selectedShipment.load?.dropoffBusinessName ? "" : "font-medium"}>{selectedShipment.load?.dropoffAddress}</p>
                          {selectedShipment.load?.dropoffLocality && (
                            <p className="text-muted-foreground">{selectedShipment.load.dropoffLocality}</p>
                          )}
                          <p>{selectedShipment.load?.dropoffCity}{selectedShipment.load?.dropoffState ? `, ${selectedShipment.load.dropoffState}` : ""}</p>
                          {selectedShipment.load?.dropoffLandmark && (
                            <p className="text-xs text-muted-foreground">Landmark: {selectedShipment.load.dropoffLandmark}</p>
                          )}
                          {selectedShipment.load?.deliveryDate && (
                            <p className="text-xs text-muted-foreground">{format(new Date(selectedShipment.load.deliveryDate), "MMM d, yyyy")}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 pt-1 border-t">
                        <p><span className="text-muted-foreground">Material:</span> {selectedShipment.load?.materialType || "N/A"}</p>
                        <p><span className="text-muted-foreground">Weight:</span> {selectedShipment.load?.weight || "N/A"} MT</p>
                        <p><span className="text-muted-foreground">Truck Type:</span> {selectedShipment.load?.requiredTruckType?.replace(/_/g, " ") || "N/A"}</p>
                        {selectedShipment.load?.adminFinalPrice && (
                          <p><span className="text-muted-foreground">Price:</span> INR {parseFloat(selectedShipment.load.adminFinalPrice).toLocaleString()}</p>
                        )}
                        <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="text-xs ml-1">{selectedShipment.status?.replace(/_/g, " ")}</Badge></div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Truck className="h-4 w-4" /> Carrier Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p className="font-medium">{selectedShipment.carrier?.companyName || "N/A"}</p>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {selectedShipment.carrier?.carrierType === "solo" ? "Solo Operator" : "Fleet/Company"}
                        </Badge>
                      </div>
                      {selectedShipment.carrier?.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {selectedShipment.carrier.phone}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4" /> Shipper
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p className="font-medium">{selectedShipment.shipper?.companyName || "N/A"}</p>
                      {selectedShipment.shipper?.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {selectedShipment.shipper.phone}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Shipment Documents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {[
                        { key: "lr_consignment", label: "LR / Consignment Note" },
                        { key: "eway_bill", label: "E-way Bill" },
                        { key: "loading_photos", label: "Loading Photos" },
                        { key: "pod", label: "Proof of Delivery (POD)" },
                        { key: "invoice", label: "Invoice" },
                        { key: "other", label: "Other Document" },
                      ].map((docItem) => {
                        const doc = selectedShipment.documents.find(d => d.documentType === docItem.key);
                        const hasDocument = !!doc?.fileUrl;
                        const isVerified = doc?.isVerified === true;
                        return (
                          <div
                            key={docItem.key}
                            className={`flex items-center justify-between p-2 bg-muted/50 rounded-lg ${isVerified ? "cursor-pointer hover-elevate" : ""}`}
                            onClick={() => {
                              if (isVerified && doc?.fileUrl) {
                                const url = getDocumentUrl(doc.fileUrl);
                                if (url) {
                                  window.open(url, "_blank");
                                }
                              }
                            }}
                            data-testid={`finance-doc-${docItem.key}`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{docItem.label}</span>
                            </div>
                            <div>
                              {isVerified ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-pointer">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  View
                                </Badge>
                              ) : hasDocument ? (
                                <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Awaiting Approval
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Not Uploaded
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  <CarrierPayoutSummaryCard shipment={selectedShipment} />

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" /> Live Tracking Approval
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedShipment.financeReview && (
                        <div className="text-sm space-y-1 p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground">Review Status:</span>
                            {(() => {
                              const config = reviewStatusConfig[selectedShipment.financeReview.status] || reviewStatusConfig.pending;
                              const Icon = config.icon;
                              return (
                                <Badge className={`text-xs ${config.color}`}>
                                  <Icon className="h-3 w-3 mr-1" />
                                  {config.label}
                                </Badge>
                              );
                            })()}
                          </div>
                          {selectedShipment.financeReview.comment && (
                            <p><span className="text-muted-foreground">Comment:</span> {selectedShipment.financeReview.comment}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Approved by {selectedShipment.financeReview.reviewerName}
                            {selectedShipment.financeReview.reviewedAt && (
                              <> on {format(new Date(selectedShipment.financeReview.reviewedAt), "MMM d, yyyy 'at' h:mm a")}</>
                            )}
                          </p>
                        </div>
                      )}

                      {selectedShipment.financeReview && (
                        <CarrierAdvancePaymentStatusButtons
                          reviewId={selectedShipment.financeReview.id}
                          paymentStatus={selectedShipment.financeReview.paymentStatus}
                          advancePaymentReleasedAt={selectedShipment.financeReview.advancePaymentReleasedAt ?? null}
                          physicalPodSubmittedAt={selectedShipment.physicalPodSubmittedAt}
                          invoicePaid={!!selectedShipment.invoicePaid}
                          isDelivered={["delivered", "closed"].includes(selectedShipment.status)}
                          payoutSummary={shipmentPayoutSummary(selectedShipment)}
                          onAdvancePayment={() =>
                            advancePaymentMutation.mutate(selectedShipment.financeReview!.id)
                          }
                          onPaymentStatus={(status) =>
                            paymentMutation.mutate({
                              reviewId: selectedShipment.financeReview!.id,
                              paymentStatus: status,
                            })
                          }
                          onPhysicalPod={() =>
                            physicalPodMutation.mutate({ shipmentId: selectedShipment.id })
                          }
                          advancePending={advancePaymentMutation.isPending}
                          paymentPending={paymentMutation.isPending}
                          physicalPodPending={physicalPodMutation.isPending}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
