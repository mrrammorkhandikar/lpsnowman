import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Check, Package, Gavel, MapPin, FileText, Truck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";

function getNotificationIcon(type: string) {
  switch (type) {
    case "bid":
    case "bid_received":
    case "bid_accepted":
    case "bid_rejected":
    case "counter_offer":
      return <Gavel className="h-4 w-4" />;
    case "shipment":
    case "shipment_update":
    case "load_assigned":
    case "delivery_complete":
      return <Truck className="h-4 w-4" />;
    case "document":
    case "document_uploaded":
    case "pod_uploaded":
      return <FileText className="h-4 w-4" />;
    case "invoice":
    case "invoice_generated":
    case "payment_received":
      return <FileText className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
}

function getTimeAgo(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getCategoryFromType(type: string): "bid" | "shipment" | "document" | "other" {
  if (type.includes("bid") || type.includes("counter") || type.includes("negotiat")) {
    return "bid";
  }
  if (type.includes("shipment") || type.includes("delivery") || type.includes("load") || type.includes("pickup") || type.includes("transit")) {
    return "shipment";
  }
  if (type.includes("document") || type.includes("pod") || type.includes("invoice")) {
    return "document";
  }
  return "other";
}

export function NotificationPanel() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const { data: notifications = [], isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/notifications/read-all", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    setIsOpen(false);
    
    // Use actionUrl if provided for direct navigation
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      return;
    }

    // Build deep-link based on context type and user role
    const loadId = notification.relatedLoadId;
    const contextType = notification.contextType || notification.type;
    const title = notification.title?.toLowerCase() || '';
    const message = notification.message?.toLowerCase() || '';

    // Infer actual context from title/message - this takes priority for routing
    // because many old notifications have generic "load" contextType
    const isInvoiceRelated = title.includes('invoice') || title.includes('payment') || message.includes('invoice');
    const isBidRelated = (title.includes('bid') || title.includes('counter') || title.includes('negotiat') || message.includes('bid')) && !isInvoiceRelated;
    const isShipmentRelated = title.includes('shipment') || title.includes('delivery') || title.includes('transit') || message.includes('shipment');
    const isCarrierRelated = title.includes('carrier') || title.includes('verification') || title.includes('document');

    if (user?.role === "admin") {
      // FIRST: Route based on title/message content (most reliable for older notifications)
      if (isInvoiceRelated) {
        navigate(`/admin/invoices${loadId ? `?load=${loadId}` : ''}`);
        return;
      }
      if (isBidRelated) {
        navigate(`/admin/negotiations${loadId ? `?highlight=${loadId}` : ''}`);
        return;
      }
      if (isCarrierRelated) {
        navigate('/admin/verification');
        return;
      }
      
      // SECOND: Check explicit contextType for new notifications
      switch (contextType) {
        case "invoice":
        case "invoice_generated":
        case "invoice_acknowledged":
        case "invoice_paid":
        case "invoice_created":
        case "invoice_sent":
        case "payment_received":
          navigate(`/admin/invoices${loadId ? `?load=${loadId}` : ''}`);
          return;
        case "bid":
        case "bid_received":
        case "bid_accepted":
        case "bid_rejected":
        case "counter_offer":
        case "counter_received":
        case "negotiation":
          navigate(`/admin/negotiations${loadId ? `?highlight=${loadId}` : ''}`);
          return;
        case "carrier":
        case "verification":
        case "document":
        case "document_uploaded":
          navigate('/admin/verification');
          return;
        case "shipment":
        case "shipment_update":
        case "delivery_complete":
        case "in_transit":
        case "otp":
          if (loadId) {
            navigate(`/admin/loads/${loadId}`);
          } else {
            navigate('/admin/loads');
          }
          return;
        case "user":
        case "user_registered":
          navigate('/admin/users');
          return;
        case "load":
        case "load_created":
        case "load_posted":
        case "load_priced":
        case "pending":
          navigate(`/admin/queue${loadId ? `?highlight=${loadId}` : ''}`);
          return;
      }
      
      // THIRD: Default fallback
      if (isShipmentRelated && loadId) {
        navigate(`/admin/loads/${loadId}`);
      } else if (loadId) {
        navigate(`/admin/queue${loadId ? `?highlight=${loadId}` : ''}`);
      } else {
        navigate('/admin');
      }
    } else if (user?.role === "carrier") {
      if (isBidRelated) {
        navigate('/carrier/bids');
        return;
      }
      if (isInvoiceRelated) {
        navigate('/carrier/revenue');
        return;
      }
      const isOtpRelated = title.includes('otp') || message.includes('otp');
      const isTripRelated = title.includes('trip') || title.includes('transit') || title.includes('delivery') || title.includes('pickup') || message.includes('trip');
      const isDocRelated = title.includes('document') || title.includes('pod') || message.includes('document');

      if (isOtpRelated || isTripRelated) {
        navigate('/carrier/trips');
        return;
      }
      if (isDocRelated) {
        navigate('/carrier/my-documents');
        return;
      }
      if (isShipmentRelated) {
        navigate('/carrier/shipments');
        return;
      }

      switch (contextType) {
        case "bid":
        case "bid_accepted":
        case "bid_rejected":
        case "counter_offer":
          navigate('/carrier/bids');
          break;
        case "invoice":
        case "invoice_generated":
        case "payment_received":
          navigate('/carrier/revenue');
          break;
        case "otp":
          navigate('/carrier/trips');
          break;
        case "load_assigned":
        case "shipment":
        case "shipment_update":
        case "delivery_complete":
        case "in_transit":
          navigate('/carrier/shipments');
          break;
        case "document":
        case "document_uploaded":
        case "pod_uploaded":
          navigate('/carrier/my-documents');
          break;
        case "load":
        case "load_created":
        case "load_posted":
          navigate('/carrier/marketplace');
          break;
        default:
          navigate('/carrier/dashboard');
      }
    } else if (user?.role === "shipper") {
      switch (contextType) {
        case "invoice":
        case "invoice_generated":
          navigate('/shipper/invoices');
          break;
        case "shipment":
        case "shipment_update":
        case "delivery_complete":
          navigate(`/shipper/tracking${loadId ? `?load=${loadId}` : ''}`);
          break;
        case "bid":
        case "bid_received":
        case "counter_offer":
          if (loadId) {
            navigate(`/shipper/loads/${loadId}?tab=bids`);
          } else {
            navigate('/shipper/loads');
          }
          break;
        default:
          if (loadId) {
            navigate(`/shipper/loads/${loadId}`);
          } else {
            navigate('/shipper/loads');
          }
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = activeTab === "all" 
    ? notifications 
    : notifications.filter(n => getCategoryFromType(n.type || "other") === activeTab);

  const bidNotifications = notifications.filter(n => getCategoryFromType(n.type || "other") === "bid");
  const shipmentNotifications = notifications.filter(n => getCategoryFromType(n.type || "other") === "shipment");
  const documentNotifications = notifications.filter(n => getCategoryFromType(n.type || "other") === "document");

  const unreadByType = {
    bid: bidNotifications.filter(n => !n.isRead).length,
    shipment: shipmentNotifications.filter(n => !n.isRead).length,
    document: documentNotifications.filter(n => !n.isRead).length,
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-xs h-auto py-1"
              data-testid="button-refresh-notifications"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs h-auto py-1"
                data-testid="button-mark-all-read"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger 
              value="all" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              data-testid="tab-all"
            >
              All
            </TabsTrigger>
            <TabsTrigger 
              value="bid" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent relative"
              data-testid="tab-bids"
            >
              Bids
              {unreadByType.bid > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  {unreadByType.bid}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="shipment" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent relative"
              data-testid="tab-shipments"
            >
              Shipments
              {unreadByType.shipment > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  {unreadByType.shipment}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="document" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent relative"
              data-testid="tab-documents"
            >
              Docs
              {unreadByType.document > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  {unreadByType.document}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <ScrollArea className="h-80">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                  <Bell className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No {activeTab === "all" ? "" : activeTab} notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover-elevate cursor-pointer ${
                        !notification.isRead ? "bg-primary/5" : ""
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-item-${notification.id}`}
                    >
                      <div className="flex gap-3">
                        <div className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${
                          !notification.isRead ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {getNotificationIcon(notification.type || "other")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{notification.title}</p>
                            {!notification.isRead && (
                              <span className="flex-shrink-0 w-2 h-2 bg-primary rounded-full" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {notification.createdAt ? getTimeAgo(notification.createdAt) : ""}
                            </span>
                            {((notification as any).loadDisplayId || notification.relatedLoadId) && (
                              <span className="text-xs text-primary font-medium">
                                {(notification as any).loadDisplayId || ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
