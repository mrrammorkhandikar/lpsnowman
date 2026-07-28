import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { connectMarketplace, disconnectMarketplace, onMarketplaceEvent } from "@/lib/marketplace-socket";
import {
  MessageSquare,
  Send,
  Check,
  X,
  RefreshCw,
  Bot,
  User,
  Shield,
  TrendingUp,
  TrendingDown,
  FileText,
  Loader2,
  MapPin,
  Truck,
  Package,
  IndianRupee,
} from "lucide-react";
import type { BidNegotiation, Load, Bid, NegotiationThread } from "@shared/schema";

interface NegotiationChatProps {
  loadId: string;
  onClose?: () => void;
  onInvoiceCreate?: () => void;
}

interface EnrichedBid extends Bid {
  carrierName?: string;
  carrierEmail?: string;
}

interface NegotiationData {
  load: Load & { shipperName?: string };
  thread: NegotiationThread;
  messages: BidNegotiation[];
  bids: EnrichedBid[];
}

export function NegotiationChat({ loadId, onClose, onInvoiceCreate }: NegotiationChatProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [counterAmount, setCounterAmount] = useState("");
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<NegotiationData>({
    queryKey: ["/api/admin/negotiations", loadId],
    refetchInterval: 5000,
  });

  // Real-time WebSocket connection for negotiation updates
  useEffect(() => {
    if (!user?.id || user?.role !== "admin") return;

    connectMarketplace("admin", user.id);

    // Listen for carrier counter offers and messages
    const unsubNegotiation = onMarketplaceEvent("negotiation_message", (data: any) => {
      if (data.negotiation?.loadId === loadId || data.loadId === loadId) {
        // Refetch to get latest messages
        refetch();
        if (data.action === "carrier_counter") {
          toast({
            title: "Carrier Counter Offer",
            description: `${data.senderName || "Carrier"} sent a counter offer`,
          });
        } else if (data.action === "carrier_accept") {
          toast({
            title: "Carrier Accepted",
            description: `${data.senderName || "Carrier"} accepted the offer`,
          });
        }
      }
    });

    const unsubBidReceived = onMarketplaceEvent("bid_received", (data: any) => {
      if (data.loadId === loadId) {
        refetch();
        toast({
          title: "New Bid Received",
          description: `${data.carrierName || "Carrier"} submitted a bid`,
        });
      }
    });

    return () => {
      unsubNegotiation();
      unsubBidReceived();
    };
  }, [user?.id, user?.role, loadId, refetch, toast]);

  const counterMutation = useMutation({
    mutationFn: async ({ bidId, amount }: { bidId: string; amount: string }) => {
      const response = await apiRequest("POST", `/api/admin/negotiations/${loadId}/counter`, { bidId, counterAmount: amount });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Counter Offer Sent", description: "The carrier has been notified." });
      setCounterAmount("");
      setSelectedBidId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/negotiations", loadId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send counter offer.", variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (bidId: string) => {
      const response = await apiRequest("POST", `/api/admin/negotiations/${loadId}/accept`, { bidId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Bid Accepted", description: "Carrier has been finalized for this load." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/negotiations", loadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/negotiations"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to accept bid.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (bidId: string) => {
      const response = await apiRequest("POST", `/api/admin/negotiations/${loadId}/reject`, { bidId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Bid Rejected", description: "The carrier has been notified." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/negotiations", loadId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject bid.", variant: "destructive" });
    },
  });

  const simulateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/negotiations/${loadId}/simulate`, {});
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Simulated Bid Added",
        description: `${data.carrierName} bid Rs. ${data.bidAmount?.toLocaleString("en-IN")}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/negotiations", loadId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate simulated bid.", variant: "destructive" });
    },
  });

  const getMessageIcon = (type: string, isSimulated?: boolean) => {
    if (isSimulated) return <Bot className="h-4 w-4" />;
    switch (type) {
      case "initial_bid":
      case "counter_offer":
        return <TrendingUp className="h-4 w-4" />;
      case "admin_counter":
        return <TrendingDown className="h-4 w-4" />;
      case "admin_accept":
        return <Check className="h-4 w-4" />;
      case "admin_reject":
        return <X className="h-4 w-4" />;
      case "simulated_bid":
        return <Bot className="h-4 w-4" />;
      case "system_message":
        return <Shield className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getMessageColor = (type: string, isSimulated?: boolean) => {
    if (isSimulated) return "bg-muted/50 border-muted";
    switch (type) {
      case "initial_bid":
      case "counter_offer":
        return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
      case "admin_counter":
        return "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800";
      case "admin_accept":
        return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800";
      case "admin_reject":
        return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800";
      case "simulated_bid":
        return "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800";
      default:
        return "bg-muted/30 border-muted";
    }
  };

  const getBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "admin_accept":
        return "default";
      case "admin_reject":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Load not found or error loading data.
      </div>
    );
  }

  const { load, thread, messages, bids } = data;
  const activeBids = bids.filter((b) => b.status !== "rejected");
  const isFinalized = thread.status === "accepted" || load.status === "awarded";

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium truncate" data-testid="text-load-route">
                {load.pickupCity} to {load.dropoffCity}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                {load.requiredTruckType}
              </span>
              <span>{load.weight} {load.weightUnit}</span>
              {load.adminFinalPrice && (
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <IndianRupee className="h-3 w-3" />
                  {Number(load.adminFinalPrice).toLocaleString("en-IN")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isFinalized ? "default" : "secondary"} data-testid="badge-thread-status">
              {(thread.status || "pending").replace(/_/g, " ")}
            </Badge>
            {!isFinalized && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => simulateMutation.mutate()}
                disabled={simulateMutation.isPending}
                data-testid="button-simulate-bid"
              >
                {simulateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                <span className="ml-1 hidden sm:inline">Simulate</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.length === 0 && activeBids.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No bids or messages yet.</p>
                  <p className="text-sm">Waiting for carriers to submit bids.</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-md border ${getMessageColor(
                        msg.messageType || "",
                        msg.isSimulated || false
                      )}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {getMessageIcon(msg.messageType || "", msg.isSimulated || false)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-sm">
                              {msg.isSimulated
                                ? msg.simulatedCarrierName || "Simulated Carrier"
                                : msg.carrierName ||
                                  (msg.senderRole === "admin" ? "Admin" : "Carrier")}
                            </span>
                            <Badge variant={getBadgeVariant(msg.messageType || "")} className="text-xs">
                              {msg.isSimulated && "Simulated "}
                              {(msg.messageType || "message").replace(/_/g, " ")}
                            </Badge>
                            {msg.amount && (
                              <span className="text-sm font-medium flex items-center">
                                <IndianRupee className="h-3 w-3" />
                                {Number(msg.amount).toLocaleString("en-IN")}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{msg.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {msg.createdAt
                              ? format(new Date(msg.createdAt), "MMM d, h:mm a")
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>

          {isFinalized && (
            <div className="p-4 border-t bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Carrier Finalized
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Accepted at Rs. {Number(thread.acceptedAmount).toLocaleString("en-IN")}
                  </p>
                </div>
                <Button onClick={onInvoiceCreate} data-testid="button-send-invoice">
                  <FileText className="h-4 w-4 mr-2" />
                  Send Invoice to Shipper
                </Button>
              </div>
            </div>
          )}
        </div>

        {!isFinalized && activeBids.length > 0 && (
          <div className="w-72 border-l bg-muted/20 flex flex-col">
            <div className="p-3 border-b">
              <h3 className="font-medium text-sm">Active Bids ({activeBids.length})</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {activeBids.map((bid) => (
                  <Card
                    key={bid.id}
                    className={`cursor-pointer transition-all ${
                      selectedBidId === bid.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedBidId(bid.id)}
                    data-testid={`bid-card-${bid.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm truncate">
                          {bid.carrierName || "Carrier"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {bid.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-lg font-bold">
                        <IndianRupee className="h-4 w-4" />
                        {Number(bid.counterAmount || bid.amount).toLocaleString("en-IN")}
                      </div>
                      {bid.counterAmount && (
                        <p className="text-xs text-muted-foreground line-through">
                          Original: Rs. {Number(bid.amount).toLocaleString("en-IN")}
                        </p>
                      )}

                      {selectedBidId === bid.id && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                acceptMutation.mutate(bid.id);
                              }}
                              disabled={acceptMutation.isPending}
                              data-testid="button-accept-bid"
                            >
                              {acceptMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                rejectMutation.mutate(bid.id);
                              }}
                              disabled={rejectMutation.isPending}
                              data-testid="button-reject-bid"
                            >
                              {rejectMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                              Reject
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Counter amount"
                              value={counterAmount}
                              onChange={(e) => setCounterAmount(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1"
                              data-testid="input-counter-amount"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (counterAmount) {
                                  counterMutation.mutate({
                                    bidId: bid.id,
                                    amount: counterAmount,
                                  });
                                }
                              }}
                              disabled={!counterAmount || counterMutation.isPending}
                              data-testid="button-send-counter"
                            >
                              {counterMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
