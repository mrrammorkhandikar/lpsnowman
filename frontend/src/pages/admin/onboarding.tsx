import { useState } from "react";
import * as React from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { parseDocumentValue } from "@/components/DocumentUpload";
import {
  UserCheck,
  Search,
  Building2,
  Phone,
  Mail,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  Calendar,
  MapPin,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAdminData } from "@/lib/admin-data-store";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import type { ShipperOnboardingRequest, User } from "@shared/schema";

interface OnboardingWithUser {
  request: ShipperOnboardingRequest;
  user: User;
}

interface OnboardingTableProps {
  items: OnboardingWithUser[];
  onReview: (item: OnboardingWithUser) => void;
  onViewUser: (shipperId: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  businessTypeLabels: Record<string, string>;
  t: (key: string) => string;
  testIdPrefix: string;
  emptyMessage: string;
}

function OnboardingTable({
  items,
  onReview,
  onViewUser,
  getStatusBadge,
  businessTypeLabels,
  t,
  testIdPrefix,
  emptyMessage,
}: OnboardingTableProps) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("onboarding.companyName")}</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>{t("onboarding.contactName")}</TableHead>
          <TableHead>{t("onboarding.businessType")}</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>{t("onboarding.submittedAt")}</TableHead>
          <TableHead>{t("common.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.request.id} data-testid={`row-${testIdPrefix}-${item.request.id}`}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{item.request.legalCompanyName || "-"}</div>
                  <div className="text-sm text-muted-foreground">{item.request.tradeName}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              {getStatusBadge(item.request.status || "draft")}
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm">
                  <span>{item.request.contactPersonName || "-"}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{item.request.contactPersonPhone || "-"}</span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              {item.request.businessType 
                ? t(businessTypeLabels[item.request.businessType] || item.request.businessType) 
                : "-"}
            </TableCell>
            <TableCell>
              <Badge variant={item.request.shipperRole === "transporter" ? "default" : "secondary"}>
                {item.request.shipperRole === "transporter" ? "Transporter" : "Shipper"}
              </Badge>
            </TableCell>
            <TableCell>
              {item.request.submittedAt
                ? format(new Date(item.request.submittedAt), "dd MMM yyyy, hh:mm a")
                : "-"}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReview(item)}
                  data-testid={`button-review-${testIdPrefix}-${item.request.id}`}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {t("adminOnboarding.review")}
                </Button>
                {item.request.status === "approved" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewUser(item.request.shipperId)}
                    data-testid={`button-view-user-${testIdPrefix}-${item.request.id}`}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View User
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const businessTypeLabels: Record<string, string> = {
  proprietorship: "onboarding.proprietorship",
  partnership: "onboarding.partnership",
  pvt_ltd: "onboarding.pvtLtd",
  public_ltd: "onboarding.publicLtd",
  llp: "onboarding.llp",
};

function DocumentLink({ value }: { value: string }) {
  const doc = parseDocumentValue(value);
  const [isLoading, setIsLoading] = React.useState(false);
  
  if (!doc) return null;
  
  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Get presigned URL from backend
      const response = await fetch(`/api/documents/presigned-url?path=${encodeURIComponent(doc.path)}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get document URL: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Open the presigned URL in new tab
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening document:', error);
      alert('Failed to open document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <a
      href="#"
      onClick={handleClick}
      className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
      title={`View ${doc.name}`}
    >
      {isLoading ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      {doc.name}
    </a>
  );
}

export default function AdminOnboardingPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { refetchUsers } = useAdminData();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // Navigate to Users page (filtered by shipper role)
  const handleViewUser = (shipperId: string) => {
    // Deep-link to Users page with shipper filter and user ID
    setLocation(`/admin/users?userId=${shipperId}&role=shipper`);
  };
  const [selectedRequest, setSelectedRequest] = useState<OnboardingWithUser | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewData, setReviewData] = useState({
    decision: "" as "" | "approved" | "rejected" | "on_hold" | "under_review",
    decisionNote: "",
  });

  const { data: requests, isLoading, refetch, isFetching } = useQuery<OnboardingWithUser[]>({
    queryKey: ["/api/admin/onboarding-requests"],
  });

  const handleRefreshOnboarding = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-requests"] });
      const r = await refetch();
      if (r.error) {
        throw r.error instanceof Error ? r.error : new Error(String(r.error));
      }
      void refetchUsers();
      const n = r.data?.length ?? 0;
      toast({
        title: "Onboarding refreshed",
        description: `${n} request(s) loaded.`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not refresh.";
      toast({
        title: t("common.error"),
        description: message,
        variant: "destructive",
      });
    }
  };

  const reviewMutation = useMutation({
    mutationFn: async (data: { requestId: string; review: typeof reviewData }) => {
      return apiRequest("POST", `/api/admin/onboarding-requests/${data.requestId}/review`, data.review);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-requests"] });
      void refetchUsers(); // Sync admin users context when shipper verified
      setIsReviewDialogOpen(false);
      setSelectedRequest(null);
      toast({
        title: t("adminOnboarding.reviewSaved"),
        description: t("adminOnboarding.reviewSavedDesc"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("adminOnboarding.reviewFailed"),
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
      draft: { variant: "outline", icon: AlertCircle },
      pending: { variant: "secondary", icon: Clock },
      under_review: { variant: "default", icon: Eye },
      approved: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      on_hold: { variant: "secondary", icon: AlertCircle },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {t(`onboarding.status${status.charAt(0).toUpperCase() + status.slice(1).replace(/_./g, (m) => m[1].toUpperCase())}`)}
      </Badge>
    );
  };

  const statusCounts = {
    all: requests?.length || 0,
    draft: requests?.filter((r) => r.request?.status === "draft").length || 0,
    // Include both pending and under_review in the pending count
    pending: requests?.filter((r) => r.request?.status === "pending" || r.request?.status === "under_review").length || 0,
    approved: requests?.filter((r) => r.request?.status === "approved").length || 0,
    rejected: requests?.filter((r) => r.request?.status === "rejected").length || 0,
    on_hold: requests?.filter((r) => r.request?.status === "on_hold").length || 0,
  };

  const getFilteredByStatus = (status: string): OnboardingWithUser[] => {
    const filtered = (requests || []).filter((item) => {
      if (!item?.request) return false;
      const matchesSearch =
        !searchQuery ||
        item.request.legalCompanyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // For "pending" section, also include "under_review" items
      if (status === "pending") {
        return matchesSearch && (item.request.status === "pending" || item.request.status === "under_review");
      }
      return matchesSearch && item.request.status === status;
    });
    
    // Sort by submittedAt descending (most recent first)
    return filtered.sort((a, b) => {
      const dateA = a.request.submittedAt ? new Date(a.request.submittedAt).getTime() : 0;
      const dateB = b.request.submittedAt ? new Date(b.request.submittedAt).getTime() : 0;
      return dateB - dateA;
    });
  };

  const openReviewDialog = (item: OnboardingWithUser) => {
    setSelectedRequest(item);
    setReviewData({
      decision: "",
      decisionNote: item.request.decisionNote || "",
    });
    setIsReviewDialogOpen(true);
  };

  const handleSubmitReview = () => {
    if (!selectedRequest || !reviewData.decision) return;
    reviewMutation.mutate({
      requestId: selectedRequest.request.id,
      review: reviewData,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            {t("adminOnboarding.title")}
          </h1>
          <p className="text-muted-foreground">{t("adminOnboarding.subtitle")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleRefreshOnboarding()}
          disabled={isFetching}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="approved" className="w-full">
            <div className="flex items-center justify-between border-b px-3 sm:px-4 gap-2 sm:gap-4 flex-wrap">
              {/* Horizontal scrollable tabs with HIDDEN scrollbar */}
              <div className="relative overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0 flex-1 min-w-0">
                <TabsList className="h-auto p-1 bg-transparent inline-flex min-w-max">
                  <TabsTrigger 
                    value="approved" 
                    className="gap-1.5 sm:gap-2 data-[state=active]:bg-green-100 dark:data-[state=active]:bg-green-900/30 text-green-700 dark:text-green-400 text-xs sm:text-sm px-2 sm:px-3"
                    data-testid="tab-approved"
                  >
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span>Approved ({statusCounts.approved})</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="rejected" 
                    className="gap-1.5 sm:gap-2 data-[state=active]:bg-red-100 dark:data-[state=active]:bg-red-900/30 text-red-700 dark:text-red-400 text-xs sm:text-sm px-2 sm:px-3"
                    data-testid="tab-rejected"
                  >
                    <XCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span>Rejected ({statusCounts.rejected})</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="on_hold" 
                    className="gap-1.5 sm:gap-2 data-[state=active]:bg-orange-100 dark:data-[state=active]:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs sm:text-sm px-2 sm:px-3"
                    data-testid="tab-on-hold"
                  >
                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span>On Hold ({statusCounts.on_hold})</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="pending" 
                    className="gap-1.5 sm:gap-2 data-[state=active]:bg-yellow-100 dark:data-[state=active]:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 text-xs sm:text-sm px-2 sm:px-3"
                    data-testid="tab-pending"
                  >
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span>Pending ({statusCounts.pending})</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="draft" 
                    className="gap-1.5 sm:gap-2 data-[state=active]:bg-cyan-100 dark:data-[state=active]:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-xs sm:text-sm px-2 sm:px-3"
                    data-testid="tab-draft"
                  >
                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span>Draft ({statusCounts.draft})</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <Input
                  placeholder={t("adminOnboarding.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 sm:pl-9 h-8 sm:h-10 text-xs sm:text-sm"
                  data-testid="input-search"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <>
                <TabsContent value="approved" className="m-0">
                  <OnboardingTable
                    items={getFilteredByStatus("approved")}
                    onReview={openReviewDialog}
                    onViewUser={handleViewUser}
                    getStatusBadge={getStatusBadge}
                    businessTypeLabels={businessTypeLabels}
                    t={t}
                    testIdPrefix="approved"
                    emptyMessage="No approved shippers"
                  />
                </TabsContent>

                <TabsContent value="rejected" className="m-0">
                  <OnboardingTable
                    items={getFilteredByStatus("rejected")}
                    onReview={openReviewDialog}
                    onViewUser={handleViewUser}
                    getStatusBadge={getStatusBadge}
                    businessTypeLabels={businessTypeLabels}
                    t={t}
                    testIdPrefix="rejected"
                    emptyMessage="No rejected applications"
                  />
                </TabsContent>

                <TabsContent value="on_hold" className="m-0">
                  <OnboardingTable
                    items={getFilteredByStatus("on_hold")}
                    onReview={openReviewDialog}
                    onViewUser={handleViewUser}
                    getStatusBadge={getStatusBadge}
                    businessTypeLabels={businessTypeLabels}
                    t={t}
                    testIdPrefix="on-hold"
                    emptyMessage="No applications on hold"
                  />
                </TabsContent>

                <TabsContent value="pending" className="m-0">
                  <OnboardingTable
                    items={getFilteredByStatus("pending")}
                    onReview={openReviewDialog}
                    onViewUser={handleViewUser}
                    getStatusBadge={getStatusBadge}
                    businessTypeLabels={businessTypeLabels}
                    t={t}
                    testIdPrefix="pending"
                    emptyMessage="No pending submissions"
                  />
                </TabsContent>

                <TabsContent value="draft" className="m-0">
                  <OnboardingTable
                    items={getFilteredByStatus("draft")}
                    onReview={openReviewDialog}
                    onViewUser={handleViewUser}
                    getStatusBadge={getStatusBadge}
                    businessTypeLabels={businessTypeLabels}
                    t={t}
                    testIdPrefix="draft"
                    emptyMessage="No draft applications"
                  />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="flex-shrink-0 px-3 sm:px-6 pt-4 sm:pt-6 pb-3 border-b">
            <DialogTitle className="text-base sm:text-lg">{t("adminOnboarding.reviewTitle")}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {selectedRequest?.request.legalCompanyName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
            <Tabs defaultValue="business" className="w-full">
              {/* Horizontal scrollable tabs with HIDDEN scrollbar */}
              <div className="relative overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0 mb-3 sm:mb-4">
                <TabsList className="grid grid-cols-3 w-full min-w-[500px] sm:min-w-0">
                  <TabsTrigger value="business" className="text-xs sm:text-sm">{t("onboarding.tabBusiness")}</TabsTrigger>
                  <TabsTrigger value="contact" className="text-xs sm:text-sm">{t("onboarding.tabContact")}</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs sm:text-sm">{t("onboarding.tabDocuments")}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="business" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.shipperRole")}</Label>
                    <Badge variant={selectedRequest?.request.shipperRole === "transporter" ? "secondary" : "outline"} className="mt-1 text-xs">
                      {selectedRequest?.request.shipperRole === "transporter" ? t("onboarding.transporter") : t("onboarding.shipper")}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.legalCompanyName")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.legalCompanyName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.tradeName")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.tradeName || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.businessType")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.businessType ? t(businessTypeLabels[selectedRequest.request.businessType] || selectedRequest.request.businessType) : "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.incorporationDate")}</Label>
                    <p className="font-medium text-xs sm:text-sm">
                      {selectedRequest?.request.incorporationDate
                        ? format(new Date(selectedRequest.request.incorporationDate), "PPP")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.pan")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.panNumber || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.gstin")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.gstinNumber || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.cin")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.cinNumber || "-"}</p>
                  </div>
                  {selectedRequest?.request.businessType === "proprietorship" && (
                    <div>
                      <Label className="text-muted-foreground text-xs sm:text-sm">Aadhaar Number</Label>
                      <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.aadhaarNumber || "-"}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Locality / Area</Label>
                  <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.registeredLocality || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.registeredAddress")}</Label>
                  <p className="font-medium text-xs sm:text-sm">
                    {selectedRequest?.request.registeredAddress || "-"}, {selectedRequest?.request.registeredCity || "-"},{" "}
                    {selectedRequest?.request.registeredState || "-"} - {selectedRequest?.request.registeredPincode || "-"}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.contactName")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.contactPersonName || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.designation")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.contactPersonDesignation || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.phone")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.contactPersonPhone || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.email")}</Label>
                    <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.contactPersonEmail || "-"}</p>
                  </div>
                </div>

                <Separator />

                <h4 className="font-medium text-base sm:text-lg">{t("onboarding.tradeReferences")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Card className="border-2">
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm text-muted-foreground">Reference 1</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6 space-y-1.5 sm:space-y-2">
                      <p className="font-medium text-sm sm:text-base">{selectedRequest?.request.tradeReference1Company || "-"}</p>
                      <p className="text-xs sm:text-sm"><span className="text-muted-foreground">Contact: </span>{selectedRequest?.request.tradeReference1Contact || "-"}</p>
                      <p className="text-xs sm:text-sm"><span className="text-muted-foreground">Phone: </span>{selectedRequest?.request.tradeReference1Phone || "-"}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2">
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm text-muted-foreground">Reference 2</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6 space-y-1.5 sm:space-y-2">
                      <p className="font-medium text-sm sm:text-base">{selectedRequest?.request.tradeReference2Company || "-"}</p>
                      <p className="text-xs sm:text-sm"><span className="text-muted-foreground">Contact: </span>{selectedRequest?.request.tradeReference2Contact || "-"}</p>
                      <p className="text-xs sm:text-sm"><span className="text-muted-foreground">Phone: </span>{selectedRequest?.request.tradeReference2Phone || "-"}</p>
                    </CardContent>
                  </Card>
                </div>

                <h4 className="font-medium mt-3 sm:mt-4 text-sm sm:text-base">How did you hear about us?</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs sm:text-sm">Referral Source</Label>
                    <p className="font-medium text-xs sm:text-sm">
                      {selectedRequest?.request.referralSource === "google" && "Google"}
                      {selectedRequest?.request.referralSource === "app_store" && "App Store"}
                      {selectedRequest?.request.referralSource === "linkedin" && "LinkedIn"}
                      {selectedRequest?.request.referralSource === "sales_person" && "Sales Person Reference"}
                      {!selectedRequest?.request.referralSource && "-"}
                    </p>
                  </div>
                  {selectedRequest?.request.referralSource === "sales_person" && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs sm:text-sm">Sales Person Code</Label>
                      <p className="font-medium text-xs sm:text-sm">{selectedRequest?.request.referralSalesPersonName || "-"}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-muted-foreground text-xs sm:text-sm">{t("onboarding.gstCertificate")}</Label>
                    {selectedRequest?.request.gstCertificateUrl ? (
                      <DocumentLink value={selectedRequest.request.gstCertificateUrl} />
                    ) : selectedRequest?.request.noGstCertificate ? (
                      <div className="space-y-2">
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          No GST - Alternative Document
                        </Badge>
                        {selectedRequest?.request.alternativeDocumentType && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Type: </span>
                            <span className="font-medium">
                              {(selectedRequest.request.alternativeDocumentType === "msme_certificate" || selectedRequest.request.alternativeDocumentType === "udyam_registration") && "MSME / Udyam Certificate"}
                              {selectedRequest.request.alternativeDocumentType === "shop_establishment" && "Shop & Establishment License"}
                              {selectedRequest.request.alternativeDocumentType === "trade_license" && "Trade License"}
                              {selectedRequest.request.alternativeDocumentType === "iec_certificate" && "IEC Certificate"}
                              {selectedRequest.request.alternativeDocumentType === "fssai_license" && "FSSAI License"}
                              {selectedRequest.request.alternativeDocumentType === "other_govt_auth" && "Other Government Authorization"}
                              {!["msme_certificate", "udyam_registration", "shop_establishment", "trade_license", "iec_certificate", "fssai_license", "other_govt_auth"].includes(selectedRequest.request.alternativeDocumentType || "") && selectedRequest.request.alternativeDocumentType}
                            </span>
                          </p>
                        )}
                        {selectedRequest?.request.alternativeAuthorizationUrl ? (
                          <DocumentLink value={selectedRequest.request.alternativeAuthorizationUrl} />
                        ) : (
                          <p className="text-sm text-muted-foreground">Document not yet uploaded</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">{t("common.notProvided")}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t("onboarding.panCard")}</Label>
                    {selectedRequest?.request.panCardUrl ? (
                      <DocumentLink value={selectedRequest.request.panCardUrl} />
                    ) : (
                      <p className="text-muted-foreground">{t("common.notProvided")}</p>
                    )}
                  </div>
                  {selectedRequest?.request.businessType === "proprietorship" && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Aadhaar Card</Label>
                      {selectedRequest?.request.aadhaarCardUrl ? (
                        <DocumentLink value={selectedRequest.request.aadhaarCardUrl} />
                      ) : (
                        <p className="text-muted-foreground">{t("common.notProvided")}</p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t("onboarding.incorporationCertificate")}</Label>
                    {selectedRequest?.request.incorporationCertificateUrl ? (
                      <DocumentLink value={selectedRequest.request.incorporationCertificateUrl} />
                    ) : (
                      <p className="text-muted-foreground">{t("common.notProvided")}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t("onboarding.addressProof")}</Label>
                    {selectedRequest?.request.businessAddressProofType && (
                      <Badge variant="outline" className="mb-1">
                        {selectedRequest.request.businessAddressProofType === "rent_agreement" ? t("onboarding.addressProofRentAgreement") :
                         selectedRequest.request.businessAddressProofType === "electricity_bill" ? t("onboarding.addressProofElectricityBill") :
                         selectedRequest.request.businessAddressProofType === "office_photo_with_board" ? t("onboarding.addressProofOfficePhoto") :
                         selectedRequest.request.businessAddressProofType}
                      </Badge>
                    )}
                    {selectedRequest?.request.businessAddressProofUrl ? (
                      <DocumentLink value={selectedRequest.request.businessAddressProofUrl} />
                    ) : (
                      <p className="text-muted-foreground">{t("common.notProvided")}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Selfie</Label>
                    {selectedRequest?.request.selfieUrl ? (
                      <DocumentLink value={selectedRequest.request.selfieUrl} />
                    ) : (
                      <p className="text-muted-foreground">{t("common.notProvided")}</p>
                    )}
                  </div>
                  {selectedRequest?.request.shipperRole === "transporter" && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">{t("onboarding.lrCopy")}</Label>
                      {selectedRequest?.request.lrCopyUrl ? (
                        <DocumentLink value={selectedRequest.request.lrCopyUrl} />
                      ) : (
                        <p className="text-muted-foreground">{t("common.notProvided")}</p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

            </Tabs>

            <Separator className="my-4 sm:my-6" />

            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-semibold text-sm sm:text-base">{t("adminOnboarding.decision")}</h3>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{t("common.status")}</Label>
                <Select
                  value={reviewData.decision}
                  onValueChange={(value) => setReviewData({ ...reviewData, decision: value as typeof reviewData.decision })}
                >
                  <SelectTrigger data-testid="select-decision" className="h-9 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder={t("adminOnboarding.selectDecision")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_review" className="text-xs sm:text-sm">{t("onboarding.statusUnderReview")}</SelectItem>
                    <SelectItem value="approved" className="text-xs sm:text-sm">{t("onboarding.statusApproved")}</SelectItem>
                    <SelectItem value="rejected" className="text-xs sm:text-sm">{t("onboarding.statusRejected")}</SelectItem>
                    <SelectItem value="on_hold" className="text-xs sm:text-sm">{t("onboarding.statusOnHold")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{t("adminOnboarding.decisionNote")}</Label>
                <Textarea
                  value={reviewData.decisionNote}
                  onChange={(e) => setReviewData({ ...reviewData, decisionNote: e.target.value })}
                  placeholder={t("adminOnboarding.notePlaceholder")}
                  rows={3}
                  data-testid="input-decision-note"
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6 border-t flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => setIsReviewDialogOpen(false)} 
              data-testid="button-cancel"
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={!reviewData.decision || reviewMutation.isPending}
              data-testid="button-submit-review"
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              {reviewMutation.isPending ? t("common.saving") : t("adminOnboarding.submitReview")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
