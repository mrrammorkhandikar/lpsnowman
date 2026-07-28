import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { connectMarketplace, disconnectMarketplace, onMarketplaceEvent } from "@/lib/marketplace-socket";
import { 
  Gavel, 
  Check, 
  X, 
  MessageSquare, 
  Clock, 
  Truck,
  Building2,
  User,
  DollarSign,
  IndianRupee,
  ArrowRight,
  FileText,
  Search,
  RefreshCw,
  Package,
  Send,
  Loader2,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Format load ID for display - shows LD-1001 (admin ref) or LD-023 (shipper seq)
function formatLoadId(load: { shipperLoadNumber?: number | null; adminReferenceNumber?: number | null; id: string }): string {
  if (load.adminReferenceNumber) {
    return `LD-${load.adminReferenceNumber}`;
  }
  if (load.shipperLoadNumber) {
    return `LD-${String(load.shipperLoadNumber).padStart(3, '0')}`;
  }
  return load.id.slice(0, 8).toUpperCase();
}

type ChatMessage = {
  id: string;
  sender: "admin" | "carrier";
  message: string;
  amount?: string;
  timestamp: Date;
};

/** Latest proposed figure in the thread (newest message wins), matching Accept Bid logic. */
function getLatestProposedAmountFromChat(
  messages: ChatMessage[],
  originalBidAmount: string
): number {
  let latestPrice = parseFloat(originalBidAmount || "0");
  if (Number.isNaN(latestPrice)) latestPrice = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.amount != null && String(msg.amount).trim() !== "") {
      const v = parseFloat(String(msg.amount));
      if (!Number.isNaN(v)) {
        latestPrice = v;
        break;
      }
    }
    const text = msg.message || "";
    const simpleMatch = text.match(/\b(\d{4,})\b/);
    if (simpleMatch) {
      const parsed = parseFloat(simpleMatch[1]);
      if (!Number.isNaN(parsed) && parsed >= 1000) {
        latestPrice = parsed;
        break;
      }
    }
    const commaMatch = text.match(/\b(\d{1,2},\d{3})\b/);
    if (commaMatch) {
      const parsed = parseFloat(commaMatch[1].replace(/,/g, ""));
      if (!Number.isNaN(parsed) && parsed >= 1000) {
        latestPrice = parsed;
        break;
      }
    }
  }
  return latestPrice;
}

type Bid = {
  id: string;
  loadId: string;
  carrierId: string;
  amount: string;
  counterAmount?: string; // Stored counter-offer amount
  latestNegotiationAmount?: string; // Real-time latest negotiation amount from chat
  status: string;
  notes?: string;
  proposedTruckId?: string;
  createdAt: string;
  carrier?: {
    id: string;
    username: string;
    companyName?: string;
    carrierType?: string;
    phone?: string;
    avatar?: string;
  };
  load?: {
    id: string;
    pickupCity: string;
    dropoffCity: string;
    status: string;
    weight?: number;
    requiredTruckType?: string;
    adminReferenceNumber?: number;
    shipperLoadNumber?: number;
    adminFinalPrice?: string;
    finalPrice?: string;
  };
  truck?: {
    id: string;
    licensePlate: string;
    truckType: string;
  };
  driver?: {
    id: string;
    name: string;
    phone?: string;
    licenseNumber?: string;
  };
};

type LoadWithBids = {
  load: {
    id: string;
    pickupCity: string;
    dropoffCity: string;
    status: string;
    weight?: number;
    requiredTruckType?: string;
  };
  bids: Bid[];
};

export default function AdminNegotiationsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [counterDialogOpen, setCounterDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterNotes, setCounterNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [chatBid, setChatBid] = useState<Bid | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailBid, setDetailBid] = useState<Bid | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [finalNegotiatedPrice, setFinalNegotiatedPrice] = useState<number | null>(null);

  useEffect(() => {
    if (user?.id && user?.role === "admin") {
      connectMarketplace("admin", user.id);
      
      const unsubscribeBid = onMarketplaceEvent("bid_received", (data) => {
        toast({
          title: "New Bid Received",
          description: `${data.bid?.carrierName || "Carrier"} submitted a bid for Rs. ${parseFloat(data.bid?.amount || "0").toLocaleString("en-IN")}`,
        });
        refetch();
      });

      const unsubscribeNegotiation = onMarketplaceEvent("negotiation_message", (data) => {
        // Refresh bids to get updated latestNegotiationAmount for real-time margin calculation
        queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
        
        if (chatBid && data.bidId === chatBid.id) {
          const newMessage: ChatMessage = {
            id: data.negotiation?.id || `msg-${Date.now()}`,
            sender: data.negotiation?.senderRole === "admin" ? "admin" : "carrier",
            message: data.negotiation?.message || "",
            amount: data.negotiation?.amount || data.negotiation?.counterAmount,
            timestamp: new Date(data.negotiation?.createdAt || Date.now()),
          };
          setChatMessages(prev => {
            const exists = prev.some(m => m.id === newMessage.id);
            return exists ? prev : [...prev, newMessage];
          });
        }
      });

      return () => {
        unsubscribeBid();
        unsubscribeNegotiation();
        disconnectMarketplace();
      };
    }
  }, [user?.id, user?.role, toast, chatBid]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const openChatDialog = useCallback(async (bid: Bid) => {
    setChatBid(bid);
    setChatDialogOpen(true);
    
    const initialMessage: ChatMessage = {
      id: `initial-${bid.id}`,
      sender: "carrier",
      message: `Hi, I'm interested in this load from ${bid.load?.pickupCity} to ${bid.load?.dropoffCity}. My initial offer is Rs. ${parseFloat(bid.amount).toLocaleString("en-IN")}.`,
      amount: bid.amount,
      timestamp: new Date(bid.createdAt),
    };
    
    try {
      const response = await fetch(`/api/bids/${bid.id}/negotiations`);
      if (response.ok) {
        const negotiations = await response.json();
        if (Array.isArray(negotiations) && negotiations.length > 0) {
          const historyMessages: ChatMessage[] = negotiations
            .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map((n: any) => ({
              id: n.id,
              sender: n.senderRole === "admin" ? "admin" as const : "carrier" as const,
              message: n.message || "",
              amount: n.amount || n.counterAmount,
              timestamp: new Date(n.createdAt),
            }));
          setChatMessages([initialMessage, ...historyMessages]);
        } else {
          setChatMessages([initialMessage]);
        }
      } else {
        setChatMessages([initialMessage]);
      }
    } catch (error) {
      console.error("Failed to load negotiation history:", error);
      setChatMessages([initialMessage]);
    }
  }, []);

  const sendChatMessage = useCallback(async (message: string, amount?: string) => {
    if (!chatBid || !message.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const adminMessage: ChatMessage = {
      id: tempId,
      sender: "admin",
      message,
      amount,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, adminMessage]);
    setChatInput("");

    try {
      const response = await apiRequest("POST", `/api/bids/${chatBid.id}/negotiate`, {
        message,
        amount: amount || undefined,
        messageType: amount ? "counter_offer" : "message",
      });
      
      if (response.ok) {
        const negotiation = await response.json();
        setChatMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, id: negotiation.id } : m
        ));
        queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  }, [chatBid, toast]);

  const latestChatProposedAmount = useMemo(() => {
    if (!chatBid) return 0;
    return getLatestProposedAmountFromChat(chatMessages, chatBid.amount);
  }, [chatMessages, chatBid]);

  const { data: bids = [], isLoading, refetch, isFetching } = useQuery<Bid[]>({
    queryKey: ["/api/bids"],
    refetchInterval: 10000,
  });

  const handleRefreshPage = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      const r = await refetch();
      if (r.error) {
        throw r.error instanceof Error ? r.error : new Error(String(r.error));
      }
      toast({
        title: "Bids updated",
        description: `${r.data?.length ?? 0} bid(s) loaded.`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not refresh bids.";
      toast({
        title: "Refresh failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  // Auto-open bid detail dialog when navigating with bidId query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bidId = params.get("bidId");
    if (bidId && bids.length > 0 && !detailBid) {
      const bid = bids.find(b => b.id === bidId);
      if (bid) {
        setDetailBid(bid);
        setDetailDialogOpen(true);
        // Clear the query param from URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [bids, detailBid]);

  const acceptMutation = useMutation({
    mutationFn: async ({ bidId, finalPrice }: { bidId: string; finalPrice?: number }) => {
      return apiRequest("PATCH", `/api/bids/${bidId}`, { 
        action: "accept",
        finalPrice: finalPrice  // Pass the negotiated final price
      });
    },
    onSuccess: () => {
      toast({
        title: "Bid Accepted",
        description: "The carrier has been finalized for this load. You can now send the invoice to the shipper.",
      });
      setFinalNegotiatedPrice(null);  // Reset after successful accept
      queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      setAcceptDialogOpen(false);
      setSelectedBid(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept bid",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ bidId, reason }: { bidId: string; reason: string }) => {
      return apiRequest("PATCH", `/api/bids/${bidId}`, { action: "reject", reason });
    },
    onSuccess: () => {
      toast({
        title: "Bid Rejected",
        description: "The carrier has been notified.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
      setRejectDialogOpen(false);
      setSelectedBid(null);
      setRejectReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject bid",
        variant: "destructive",
      });
    },
  });

  const counterMutation = useMutation({
    mutationFn: async ({ bidId, amount, notes }: { bidId: string; amount: string; notes: string }) => {
      return apiRequest("PATCH", `/api/bids/${bidId}`, { 
        action: "counter", 
        counterAmount: parseFloat(amount),
        notes
      });
    },
    onSuccess: () => {
      toast({
        title: "Counter Offer Sent",
        description: "The carrier has been notified of your counter offer.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bids"] });
      setCounterDialogOpen(false);
      setSelectedBid(null);
      setCounterAmount("");
      setCounterNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send counter offer",
        variant: "destructive",
      });
    },
  });

  const groupedByLoad = useMemo(() => {
    const groups: Record<string, LoadWithBids> = {};
    
    bids.forEach(bid => {
      if (bid.load) {
        const loadId = bid.loadId;
        if (!groups[loadId]) {
          groups[loadId] = {
            load: bid.load,
            bids: [],
          };
        }
        groups[loadId].bids.push(bid);
      }
    });
    
    return Object.values(groups);
  }, [bids]);

  const filteredBids = useMemo(() => {
    return bids.filter(bid => {
      const matchesSearch = searchQuery === "" ||
        bid.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bid.carrier?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bid.carrier?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bid.load?.pickupCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bid.load?.dropoffCity?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const effectiveStatus = (bid.status === "countered" || (bid.counterAmount && parseFloat(bid.counterAmount) > 0))
        ? "countered"
        : bid.status;
      const matchesStatus = statusFilter === "all" || effectiveStatus === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [bids, searchQuery, statusFilter]);

  const isCountered = (b: typeof filteredBids[0]) => b.status === "countered" || (b.counterAmount && parseFloat(b.counterAmount) > 0);
  const pendingBids = filteredBids.filter(b => !isCountered(b) && b.status === "pending");
  const counteredBids = filteredBids.filter(b => isCountered(b));
  const acceptedBids = filteredBids.filter(b => b.status === "accepted");
  const rejectedBids = filteredBids.filter(b => b.status === "rejected");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending Review</Badge>;
      case "countered":
        return <Badge variant="secondary">Counter Sent</Badge>;
      case "accepted":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCarrierTypeBadge = (carrierType?: string) => {
    if (carrierType === "solo") {
      return <Badge variant="outline" className="text-xs"><User className="h-3 w-3 mr-1" />Solo Driver</Badge>;
    }
    return <Badge variant="outline" className="text-xs"><Building2 className="h-3 w-3 mr-1" />Enterprise</Badge>;
  };

  // Get display name based on carrier type: solo drivers show username, enterprise shows company name
  const getCarrierDisplayName = (carrier?: { username?: string; companyName?: string; carrierType?: string }) => {
    if (!carrier) return "Unknown Carrier";
    if (carrier.carrierType === "solo") {
      return carrier.username || carrier.companyName || "Solo Driver";
    }
    return carrier.companyName || carrier.username || "Unknown Carrier";
  };

  const openBidDetail = (bid: Bid) => {
    setDetailBid(bid);
    setDetailDialogOpen(true);
  };

  const BidCard = ({ bid }: { bid: Bid }) => (
    <Card 
      className="hover-elevate cursor-pointer" 
      data-testid={`card-bid-${bid.id}`}
      onClick={() => openBidDetail(bid)}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-2 sm:space-y-3">
          {/* Load ID Badge */}
          {bid.load && (
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className="text-[10px] sm:text-xs font-mono" data-testid={`text-load-id-${bid.id}`}>
                <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                {formatLoadId(bid.load)}
              </Badge>
              {getStatusBadge(bid.status)}
            </div>
          )}
          
          {/* Carrier Info */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm sm:text-base" data-testid={`text-carrier-${bid.id}`}>
              {getCarrierDisplayName(bid.carrier)}
            </span>
            {getCarrierTypeBadge(bid.carrier?.carrierType)}
          </div>
          
          {/* Route - Always on one line with proper wrapping */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground flex-wrap">
            <span className="font-medium shrink-0">Load:</span>
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="truncate">{bid.load?.pickupCity}</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{bid.load?.dropoffCity}</span>
            </div>
          </div>
          
          {/* Pricing Info */}
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const displayAmount = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0
                ? parseFloat(bid.latestNegotiationAmount)
                : bid.counterAmount && parseFloat(bid.counterAmount) > 0
                  ? parseFloat(bid.counterAmount)
                  : parseFloat(bid.amount);
              const hasNegotiatedAmount = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0;
              const originalAmount = parseFloat(bid.amount);
              return (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <IndianRupee className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-base sm:text-lg" data-testid={`text-amount-${bid.id}`}>
                      Rs. {displayAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  {hasNegotiatedAmount && displayAmount !== originalAmount && (
                    <span className="text-xs text-muted-foreground line-through">
                      Rs. {originalAmount.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
              );
            })()}
            
            {/* Comparison with posted price */}
            {bid.load?.finalPrice && (() => {
              const bidAmount = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0
                ? parseFloat(bid.latestNegotiationAmount)
                : bid.counterAmount && parseFloat(bid.counterAmount) > 0
                  ? parseFloat(bid.counterAmount)
                  : parseFloat(bid.amount);
              const originalPrice = parseFloat(bid.load.finalPrice);
              const difference = bidAmount - originalPrice;
              const percentDiff = ((difference / originalPrice) * 100).toFixed(1);
              const isHigher = difference > 0;
              const isEqual = difference === 0;
              if (isEqual) return null;
              return (
                <span className={`text-xs font-medium ${isHigher ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  ({isHigher ? "+" : ""}{percentDiff}% vs posted)
                </span>
              );
            })()}
            
            {/* Platform Margin */}
            {bid.load?.adminFinalPrice && (() => {
              const carrierPrice = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0 
                ? parseFloat(bid.latestNegotiationAmount)
                : bid.counterAmount && parseFloat(bid.counterAmount) > 0 
                  ? parseFloat(bid.counterAmount) 
                  : parseFloat(bid.amount);
              const shipperPrice = parseFloat(bid.load.adminFinalPrice);
              const platformMargin = shipperPrice - carrierPrice;
              const marginPercent = shipperPrice > 0 ? ((platformMargin / shipperPrice) * 100).toFixed(1) : "0";
              const isProfit = platformMargin > 0;
              const isLoss = platformMargin < 0;
              return (
                <Badge 
                  variant={isProfit ? "default" : isLoss ? "destructive" : "secondary"}
                  className={`text-xs ${isProfit ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : isLoss ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : ""}`}
                  data-testid={`badge-margin-${bid.id}`}
                >
                  {isProfit ? "+" : isLoss ? "-" : ""}₹{Math.abs(platformMargin).toLocaleString("en-IN")} ({marginPercent}%)
                </Badge>
              );
            })()}
          </div>
          
          {/* Truck Info */}
          {bid.truck && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Truck className="h-3 w-3" />
              <span className="truncate">{bid.truck.licensePlate} ({bid.truck.truckType})</span>
            </div>
          )}
          
          {/* Notes */}
          {bid.notes && (
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              <MessageSquare className="h-3 w-3 inline mr-1" />
              {bid.notes}
            </p>
          )}
          
          {/* Timestamp */}
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(bid.createdAt), "MMM d, yyyy h:mm a")}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
            {bid.status !== "accepted" && bid.status !== "rejected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openChatDialog(bid)}
              data-testid={`button-negotiate-${bid.id}`}
              className="flex-1 h-8 text-xs sm:text-sm"
            >
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Negotiate
            </Button>
            )}
            {(bid.status === "pending" || isCountered(bid)) && bid.status !== "accepted" && bid.status !== "rejected" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedBid(bid);
                    setRejectDialogOpen(true);
                  }}
                  data-testid={`button-reject-${bid.id}`}
                  className="h-8 text-xs sm:text-sm px-3"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Reject</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const negotiatedAmt = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0
                      ? parseFloat(bid.latestNegotiationAmount) : null;
                    setFinalNegotiatedPrice(negotiatedAmt);
                    setSelectedBid(bid);
                    setAcceptDialogOpen(true);
                  }}
                  data-testid={`button-accept-${bid.id}`}
                  className="h-8 text-xs sm:text-sm px-3"
                >
                  <Check className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Accept</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Negotiation Queue</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">Bids & Negotiations</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Review and manage carrier bids with per-load negotiation threads</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleRefreshPage()}
          disabled={isFetching}
          data-testid="button-refresh"
          className="h-8 sm:h-9"
        >
          <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[180px] sm:min-w-[200px]">
          <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          <Input
            placeholder="Search by carrier, load..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 sm:pl-10 h-8 sm:h-9 text-xs sm:text-sm"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] sm:w-[180px] h-8 sm:h-9 text-xs sm:text-sm" data-testid="select-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="countered">Countered</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-amber-600" data-testid="count-pending">{pendingBids.length}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Pending Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-blue-600" data-testid="count-countered">{counteredBids.length}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Counter Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-600" data-testid="count-accepted">{acceptedBids.length}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Accepted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-red-600" data-testid="count-rejected">{rejectedBids.length}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Rejected</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-3 sm:space-y-4">
        {/* Horizontal scrollable tabs with HIDDEN scrollbar */}
        <div className="relative overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0">
          <TabsList className="inline-flex min-w-max">
            <TabsTrigger value="pending" data-testid="tab-pending" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              Pending ({pendingBids.length})
            </TabsTrigger>
            <TabsTrigger value="countered" data-testid="tab-countered" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              Countered ({counteredBids.length})
            </TabsTrigger>
            <TabsTrigger value="accepted" data-testid="tab-accepted" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              Accepted ({acceptedBids.length})
            </TabsTrigger>
            <TabsTrigger value="by-load" data-testid="tab-by-load" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              By Load ({groupedByLoad.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending">
          <ScrollArea className="h-[600px]">
            {pendingBids.length === 0 ? (
              <EmptyState
                icon={Gavel}
                title="No pending bids"
                description="When carriers submit bids, they will appear here for your review."
              />
            ) : (
              <div className="space-y-4">
                {pendingBids.map(bid => (
                  <BidCard key={bid.id} bid={bid} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="countered">
          <ScrollArea className="h-[500px] sm:h-[600px]">
            {counteredBids.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No countered bids"
                description="Bids you've countered will appear here."
              />
            ) : (
              <div className="space-y-2 sm:space-y-4">
                {counteredBids.map(bid => (
                  <BidCard key={bid.id} bid={bid} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="accepted">
          <ScrollArea className="h-[500px] sm:h-[600px]">
            {acceptedBids.length === 0 ? (
              <EmptyState
                icon={Check}
                title="No accepted bids"
                description="Accepted bids will appear here. You can send invoices for finalized loads."
              />
            ) : (
              <div className="space-y-2 sm:space-y-4">
                {acceptedBids.map(bid => (
                  <Card key={bid.id} data-testid={`card-accepted-${bid.id}`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 sm:gap-4 flex-wrap">
                        <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0">
                          {bid.load && (
                            <Badge variant="secondary" className="text-[10px] sm:text-xs font-mono mb-1">
                              <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                              {formatLoadId(bid.load)}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Avatar className="h-12 w-12 sm:h-16 sm:w-16 shrink-0 rounded-full border border-border">
                              <AvatarImage
                                src={bid.carrier?.avatar || ""}
                                alt={getCarrierDisplayName(bid.carrier)}
                                className="object-cover"
                              />
                              <AvatarFallback className="text-xs font-semibold bg-muted">
                                {getCarrierDisplayName(bid.carrier).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="font-semibold text-xs sm:text-sm md:text-base">
                                {getCarrierDisplayName(bid.carrier)}
                              </span>
                              {getCarrierTypeBadge(bid.carrier?.carrierType)}
                              {getStatusBadge(bid.status)}
                            </div>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="truncate max-w-[120px] sm:max-w-[150px]">{bid.load?.pickupCity}</span>
                              <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                              <span className="truncate max-w-[120px] sm:max-w-[150px]">{bid.load?.dropoffCity}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                            <span className="font-semibold text-sm sm:text-base">Rs. {parseFloat(bid.amount).toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/admin/loads?loadId=${bid.loadId}`)}
                          data-testid={`button-view-load-${bid.id}`}
                          className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                        >
                          <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Send Invoice
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="by-load">
          <ScrollArea className="h-[500px] sm:h-[600px]">
            {groupedByLoad.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No loads with bids"
                description="When carriers bid on loads, they will be grouped here."
              />
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {groupedByLoad.map(({ load, bids: loadBids }) => (
                  <Card key={load.id}>
                    <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm sm:text-base md:text-lg">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="truncate max-w-[100px] sm:max-w-[150px]">{load.pickupCity}</span>
                              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                              <span className="truncate max-w-[100px] sm:max-w-[150px]">{load.dropoffCity}</span>
                            </div>
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm">
                            Load ID: {formatLoadId(load)} | {loadBids.length} bid(s)
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs">{load.status?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6">
                      <div className="space-y-2 sm:space-y-3">
                        {loadBids.map(bid => (
                          <div
                            key={bid.id}
                            className="flex items-center justify-between gap-2 sm:gap-4 p-2 sm:p-3 rounded-md bg-muted/50 flex-wrap"
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                              {getCarrierTypeBadge(bid.carrier?.carrierType)}
                              <span className="font-medium text-xs sm:text-sm truncate">
                                {getCarrierDisplayName(bid.carrier)}
                              </span>
                              {(() => {
                                // Display amount priority: latestNegotiationAmount > counterAmount > amount
                                const displayAmount = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0
                                  ? parseFloat(bid.latestNegotiationAmount)
                                  : bid.counterAmount && parseFloat(bid.counterAmount) > 0
                                    ? parseFloat(bid.counterAmount)
                                    : parseFloat(bid.amount);
                                const hasNegotiatedAmount = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0;
                                const originalAmount = parseFloat(bid.amount);
                                return (
                                  <div className="flex items-center gap-0.5 sm:gap-1">
                                    <span className="font-semibold text-green-600 text-xs sm:text-sm">
                                      Rs. {displayAmount.toLocaleString("en-IN")}
                                    </span>
                                    {hasNegotiatedAmount && displayAmount !== originalAmount && (
                                      <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                                        Rs. {originalAmount.toLocaleString("en-IN")}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                              {/* Show comparison with original posted price - use finalPrice (carrier-facing price) */}
                              {bid.load?.finalPrice && (() => {
                                // Use display amount (negotiated if available) for comparison
                                const bidAmount = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0
                                  ? parseFloat(bid.latestNegotiationAmount)
                                  : bid.counterAmount && parseFloat(bid.counterAmount) > 0
                                    ? parseFloat(bid.counterAmount)
                                    : parseFloat(bid.amount);
                                const originalPrice = parseFloat(bid.load.finalPrice);
                                const difference = bidAmount - originalPrice;
                                const percentDiff = ((difference / originalPrice) * 100).toFixed(1);
                                const isHigher = difference > 0;
                                const isEqual = difference === 0;
                                if (isEqual) return null;
                                return (
                                  <span className={`text-[10px] sm:text-xs font-medium ${isHigher ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                                    ({isHigher ? "+" : ""}{percentDiff}%)
                                  </span>
                                );
                              })()}
                              {/* Platform Margin Badge */}
                              {bid.load?.adminFinalPrice && (() => {
                                // Priority: latestNegotiationAmount (real-time chat) > counterAmount (stored) > amount (original)
                                const carrierPrice = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0 
                                  ? parseFloat(bid.latestNegotiationAmount)
                                  : bid.counterAmount && parseFloat(bid.counterAmount) > 0 
                                    ? parseFloat(bid.counterAmount) 
                                    : parseFloat(bid.amount);
                                const shipperPrice = parseFloat(bid.load.adminFinalPrice);
                                const platformMargin = shipperPrice - carrierPrice;
                                const marginPercent = shipperPrice > 0 ? ((platformMargin / shipperPrice) * 100).toFixed(1) : "0";
                                const isProfit = platformMargin > 0;
                                const isLoss = platformMargin < 0;
                                return (
                                  <Badge 
                                    variant={isProfit ? "default" : isLoss ? "destructive" : "secondary"}
                                    className={`text-[10px] sm:text-xs ${isProfit ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : isLoss ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : ""}`}
                                  >
                                    {isProfit ? "+" : isLoss ? "-" : ""}₹{Math.abs(platformMargin).toLocaleString("en-IN")} ({marginPercent}%)
                                  </Badge>
                                );
                              })()}
                              {getStatusBadge(bid.status)}
                            </div>
                            {(bid.status === "pending" || isCountered(bid)) && bid.status !== "accepted" && bid.status !== "rejected" && (
                              <div className="flex gap-1.5 sm:gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedBid(bid);
                                    setRejectDialogOpen(true);
                                  }}
                                  className="h-7 sm:h-8 px-2 sm:px-3"
                                >
                                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const negotiatedAmt = bid.latestNegotiationAmount && parseFloat(bid.latestNegotiationAmount) > 0
                                      ? parseFloat(bid.latestNegotiationAmount) : null;
                                    setFinalNegotiatedPrice(negotiatedAmt);
                                    setSelectedBid(bid);
                                    setAcceptDialogOpen(true);
                                  }}
                                  className="h-7 sm:h-8 px-2 sm:px-3"
                                >
                                  <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Bid Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bid Details
            </DialogTitle>
            <DialogDescription>
              {detailBid?.load && formatLoadId(detailBid.load)} - Complete bid information
            </DialogDescription>
          </DialogHeader>
          {detailBid && (
            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              {/* Carrier Info */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  {detailBid.carrier?.carrierType === "solo" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  Carrier Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium">{getCarrierDisplayName(detailBid.carrier)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <p className="font-medium">{detailBid.carrier?.carrierType === "solo" ? "Solo Driver" : "Enterprise"}</p>
                  </div>
                  {detailBid.truck && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Truck:</span>
                        <p className="font-medium">{detailBid.truck.licensePlate}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Truck Type:</span>
                        <p className="font-medium">{detailBid.truck.truckType}</p>
                      </div>
                    </>
                  )}
                  {detailBid.driver && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Assigned Driver:</span>
                        <p className="font-medium">{detailBid.driver.name}</p>
                      </div>
                      {detailBid.driver.phone && (
                        <div>
                          <span className="text-muted-foreground">Driver Phone:</span>
                          <p className="font-medium">{detailBid.driver.phone}</p>
                        </div>
                      )}
                    </>
                  )}
                  {!detailBid.driver && detailBid.carrier?.carrierType === "enterprise" && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Assigned Driver:</span>
                      <p className="font-medium text-amber-600">To be assigned later</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Load Info */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Load Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Route:</span>
                    <p className="font-medium">
                      {detailBid.load?.pickupCity} <ArrowRight className="h-3 w-3 inline mx-1" /> {detailBid.load?.dropoffCity}
                    </p>
                  </div>
                  {detailBid.load?.weight && (
                    <div>
                      <span className="text-muted-foreground">Weight:</span>
                      <p className="font-medium">{detailBid.load.weight} Tons</p>
                    </div>
                  )}
                  {detailBid.load?.requiredTruckType && (
                    <div>
                      <span className="text-muted-foreground">Truck Type:</span>
                      <p className="font-medium">{detailBid.load.requiredTruckType}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bid Info */}
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 space-y-3">
                <h4 className="font-semibold flex items-center gap-2 text-green-700 dark:text-green-300">
                  <IndianRupee className="h-4 w-4" />
                  Bid Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Original Posted Price - use finalPrice which is what carriers see */}
                  {detailBid.load?.finalPrice && (
                    <div className="col-span-2 pb-2 border-b border-green-200 dark:border-green-800">
                      <span className="text-muted-foreground">Original Posted Price:</span>
                      <p className="font-medium text-base">Rs. {parseFloat(detailBid.load.finalPrice).toLocaleString("en-IN")}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Bid Amount:</span>
                    <p className="font-bold text-lg text-green-600">Rs. {parseFloat(detailBid.amount).toLocaleString("en-IN")}</p>
                  </div>
                  {/* Comparison with original price */}
                  {detailBid.load?.finalPrice && (() => {
                    const bidAmount = parseFloat(detailBid.amount);
                    const originalPrice = parseFloat(detailBid.load.finalPrice);
                    const difference = bidAmount - originalPrice;
                    const percentDiff = ((difference / originalPrice) * 100).toFixed(1);
                    const isHigher = difference > 0;
                    const isEqual = difference === 0;
                    return (
                      <div>
                        <span className="text-muted-foreground">Difference:</span>
                        {isEqual ? (
                          <p className="font-medium text-muted-foreground">Same as posted</p>
                        ) : (
                          <p className={`font-medium ${isHigher ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                            {isHigher ? "+" : ""}{difference.toLocaleString("en-IN")} ({isHigher ? "+" : ""}{percentDiff}%)
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  {/* Platform Margin Calculation */}
                  {detailBid.load?.adminFinalPrice && (
                    <div className="col-span-2 pt-2 border-t border-green-200 dark:border-green-800">
                      <span className="text-muted-foreground">Platform Margin:</span>
                      {(() => {
                        // Priority: latestNegotiationAmount (real-time chat) > counterAmount (stored) > amount (original)
                        const carrierPrice = detailBid.latestNegotiationAmount && parseFloat(detailBid.latestNegotiationAmount) > 0 
                          ? parseFloat(detailBid.latestNegotiationAmount)
                          : detailBid.counterAmount && parseFloat(detailBid.counterAmount) > 0 
                            ? parseFloat(detailBid.counterAmount) 
                            : parseFloat(detailBid.amount);
                        const shipperPrice = parseFloat(detailBid.load.adminFinalPrice!);
                        const platformMargin = shipperPrice - carrierPrice;
                        const marginPercent = shipperPrice > 0 ? ((platformMargin / shipperPrice) * 100).toFixed(1) : "0";
                        const isProfit = platformMargin > 0;
                        const isLoss = platformMargin < 0;
                        const hasNegotiatedPrice = (detailBid.latestNegotiationAmount && parseFloat(detailBid.latestNegotiationAmount) > 0) || 
                          (detailBid.counterAmount && parseFloat(detailBid.counterAmount) > 0);
                        return (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant={isProfit ? "default" : isLoss ? "destructive" : "secondary"}
                              className={`${isProfit ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : isLoss ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : ""}`}
                            >
                              {isProfit ? "Profit" : isLoss ? "Loss" : "Break Even"}
                            </Badge>
                            <span className={`font-bold text-lg ${isProfit ? "text-green-600 dark:text-green-400" : isLoss ? "text-red-600 dark:text-red-400" : ""}`}>
                              {isProfit ? "+" : isLoss ? "-" : ""}₹{Math.abs(platformMargin).toLocaleString("en-IN")} ({marginPercent}%)
                            </span>
                          </div>
                        );
                      })()}
                      <p className="text-xs text-muted-foreground mt-1">
                        Shipper pays ₹{parseFloat(detailBid.load.adminFinalPrice!).toLocaleString("en-IN")} - Carrier gets ₹{(
                          detailBid.latestNegotiationAmount && parseFloat(detailBid.latestNegotiationAmount) > 0 
                            ? parseFloat(detailBid.latestNegotiationAmount) 
                            : detailBid.counterAmount && parseFloat(detailBid.counterAmount) > 0 
                              ? parseFloat(detailBid.counterAmount) 
                              : parseFloat(detailBid.amount)
                        ).toLocaleString("en-IN")}
                        {(detailBid.latestNegotiationAmount && parseFloat(detailBid.latestNegotiationAmount) > 0) ? " (live)" : 
                         (detailBid.counterAmount && parseFloat(detailBid.counterAmount) > 0) ? " (negotiated)" : ""}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-1">{getStatusBadge(detailBid.status)}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Submitted:</span>
                    <p className="font-medium">{format(new Date(detailBid.createdAt), "MMM d, yyyy h:mm a")}</p>
                  </div>
                  {detailBid.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Notes:</span>
                      <p className="font-medium">{detailBid.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
            {detailBid && detailBid.status !== "accepted" && detailBid.status !== "rejected" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    openChatDialog(detailBid!);
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Negotiate
                </Button>
                <Button
                  onClick={() => {
                    const negotiatedAmt = detailBid!.latestNegotiationAmount && parseFloat(detailBid!.latestNegotiationAmount) > 0
                      ? parseFloat(detailBid!.latestNegotiationAmount) : null;
                    setFinalNegotiatedPrice(negotiatedAmt);
                    setDetailDialogOpen(false);
                    setSelectedBid(detailBid!);
                    setAcceptDialogOpen(true);
                  }}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Accept Bid
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Bid</DialogTitle>
            <DialogDescription>
              Accepting this bid will finalize the carrier for this load and auto-reject all other bids.
            </DialogDescription>
          </DialogHeader>
          {selectedBid && (
            <div className="py-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Carrier:</span>
                <span className="font-medium">{getCarrierDisplayName(selectedBid.carrier)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Final Agreed Price:</span>
                <span className="font-semibold text-green-600">
                  Rs. {(finalNegotiatedPrice ?? parseFloat(selectedBid.amount)).toLocaleString("en-IN")}
                </span>
              </div>
              {finalNegotiatedPrice && finalNegotiatedPrice !== parseFloat(selectedBid.amount) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Original Bid:</span>
                  <span className="text-muted-foreground line-through">
                    Rs. {parseFloat(selectedBid.amount).toLocaleString("en-IN")}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Load:</span>
                <span>{selectedBid.load?.pickupCity} to {selectedBid.load?.dropoffCity}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedBid && acceptMutation.mutate({ 
                bidId: selectedBid.id,
                finalPrice: finalNegotiatedPrice ?? parseFloat(selectedBid.amount)
              })}
              disabled={acceptMutation.isPending}
              data-testid="button-confirm-accept"
            >
              {acceptMutation.isPending ? "Accepting..." : "Accept & Finalize Carrier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Bid</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this bid. The carrier will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              data-testid="input-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedBid && rejectMutation.mutate({ bidId: selectedBid.id, reason: rejectReason })}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={counterDialogOpen} onOpenChange={setCounterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Counter Offer</DialogTitle>
            <DialogDescription>
              Send a counter offer to the carrier.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Counter Amount</label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder=""
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  className="pl-10"
                  data-testid="input-counter-amount"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="Add notes for the carrier..."
                value={counterNotes}
                onChange={(e) => setCounterNotes(e.target.value)}
                className="mt-1"
                data-testid="input-counter-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedBid && counterMutation.mutate({ 
                bidId: selectedBid.id, 
                amount: counterAmount, 
                notes: counterNotes 
              })}
              disabled={counterMutation.isPending || !counterAmount}
              data-testid="button-confirm-counter"
            >
              {counterMutation.isPending ? "Sending..." : "Send Counter Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] sm:max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 border-b shrink-0">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">Negotiate with {getCarrierDisplayName(chatBid?.carrier)}</span>
              </DialogTitle>
              {chatBid?.carrier?.phone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`tel:${chatBid.carrier?.phone}`, '_self')}
                  className="flex items-center gap-1 text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 h-7 sm:h-8 px-2 sm:px-3 flex-shrink-0"
                  data-testid="button-call-carrier"
                >
                  <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline text-xs sm:text-sm">Call</span>
                </Button>
              )}
            </div>
            <DialogDescription className="text-xs sm:text-sm">
              <span className="font-semibold">
                {chatBid?.load?.adminReferenceNumber 
                  ? `LD-${String(chatBid.load.adminReferenceNumber).padStart(3, '0')}`
                  : chatBid?.load?.shipperLoadNumber 
                    ? `LD-${String(chatBid.load.shipperLoadNumber).padStart(3, '0')}`
                    : chatBid?.loadId?.slice(0, 8)?.toUpperCase()}
              </span>
              {" "}
              <span className="inline-block">
                {chatBid?.load?.pickupCity} to {chatBid?.load?.dropoffCity}
              </span>
              {" - "}
              <span className="inline-block">
                Current bid: Rs. {latestChatProposedAmount.toLocaleString("en-IN")}
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div 
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-muted/30 min-h-[200px] max-h-[400px]"
            data-testid="chat-messages-container"
          >
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 py-2 sm:px-4 ${
                    msg.sender === "admin"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border"
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <span className="text-[10px] sm:text-xs font-medium">
                      {msg.sender === "admin" ? "You (Admin)" : getCarrierDisplayName(chatBid?.carrier)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm break-words">{msg.message}</p>
                  {msg.amount && (
                    <div className="mt-1 text-xs sm:text-sm font-semibold">
                      Proposed: Rs. {parseFloat(msg.amount).toLocaleString("en-IN")}
                    </div>
                  )}
                  <p className="text-[10px] sm:text-xs opacity-70 mt-1">
                    {format(msg.timestamp, "h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 px-3 sm:px-6 py-3 sm:py-4 border-t shrink-0">
            <Input
              placeholder="Type your message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage(chatInput);
                }
              }}
              className="h-9 sm:h-10 text-xs sm:text-sm"
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              onClick={() => sendChatMessage(chatInput)}
              disabled={!chatInput.trim()}
              className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              data-testid="button-send-chat"
            >
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 px-3 sm:px-6 py-3 sm:py-4 border-t shrink-0">
            <Button
              variant="outline"
              onClick={() => setChatDialogOpen(false)}
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
              data-testid="button-close-chat"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                if (chatBid) {
                  setFinalNegotiatedPrice(
                    getLatestProposedAmountFromChat(chatMessages, chatBid.amount)
                  );
                  setSelectedBid(chatBid);
                  setChatDialogOpen(false);
                  setAcceptDialogOpen(true);
                }
              }}
              disabled={chatBid?.status === "accepted" || chatBid?.status === "rejected" || acceptMutation.isPending}
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
              data-testid="button-chat-accept"
            >
              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Accept Bid
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
