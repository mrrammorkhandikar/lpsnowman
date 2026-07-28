import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { 
  Search, Filter, Gavel, Clock, CheckCircle, XCircle, RefreshCw, 
  MapPin, Truck, Package, Building2, Star, MessageSquare, Send,
  TrendingUp, AlertTriangle, Timer, ArrowRight, ChevronDown, ChevronRight,
  Loader2, Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { useCarrierData, type CarrierBid } from "@/lib/carrier-data-store";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { connectMarketplace, disconnectMarketplace, onMarketplaceEvent } from "@/lib/marketplace-socket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { computeRouteDistanceKmEstimate } from "@/lib/route-distance";
import {
  buildCarrierRouteDestinationString,
  buildCarrierRouteOriginString,
} from "@/lib/carrier-route-strings";
import { useQuery, useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Bid, Load } from "@shared/schema";

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function distanceKmEstimateFromBidLoad(load: any): number {
  if (!load) return 0;
  const km = computeRouteDistanceKmEstimate({
    pickupLat: load.pickupLat,
    pickupLng: load.pickupLng,
    dropoffLat: load.dropoffLat,
    dropoffLng: load.dropoffLng,
    pickupCity: load.pickupCity,
    dropoffCity: load.dropoffCity,
  });
  if (!Number.isFinite(km)) return 0;
  const rounded = Math.round(km);
  return rounded >= 1 ? rounded : 0;
}

const statusConfig: Record<CarrierBid["bidStatus"], { label: string; icon: typeof CheckCircle; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  countered: { label: "Countered", icon: RefreshCw, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  accepted: { label: "Accepted", icon: CheckCircle, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  expired: { label: "Expired", icon: Clock, color: "bg-muted text-muted-foreground" },
};

interface ChatMessage {
  id: string;
  sender: "carrier" | "admin";
  message: string;
  amount?: number;
  timestamp: Date;
}

function NegotiationDialog({ bid, distanceLabel, onAccept, onCounter, onReject, isOpen }: { 
  bid: CarrierBid;
  distanceLabel: string;
  onAccept: () => void;
  onCounter: (amount: number) => void;
  onReject: () => void;
  isOpen: boolean;
}) {
  const [counterAmount, setCounterAmount] = useState(bid.currentRate.toString());
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Extract amount from message text (handles: "85600", "85,600", "Rs. 85600", "Rs 85,600")
  const extractAmount = (text: string): number | null => {
    // Match any sequence of digits, optionally with commas
    const match = text.match(/\d[\d,]*/g);
    if (match) {
      // Take the last number mentioned (usually the agreed price)
      const lastMatch = match[match.length - 1];
      const num = parseFloat(lastMatch.replace(/,/g, ''));
      if (!isNaN(num) && num >= 10000) return num; // Freight amounts are typically 10k+
    }
    return null;
  };
  
  // Compute live carrier offer from chat messages
  const liveCarrierOffer = useMemo(() => {
    // Find latest carrier message with an amount
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i];
      if (msg.sender === "carrier") {
        if (msg.amount && msg.amount >= 10000) return msg.amount;
        const extracted = extractAmount(msg.message);
        if (extracted) return extracted;
      }
    }
    return bid.carrierOffer; // Fallback to cached value
  }, [chatMessages, bid.carrierOffer]);
  
  // Compute live admin counter offer from chat messages
  const liveAdminCounter = useMemo(() => {
    // Find latest admin message with an amount
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i];
      if (msg.sender === "admin") {
        if (msg.amount && msg.amount >= 10000) return msg.amount;
        const extracted = extractAmount(msg.message);
        if (extracted) return extracted;
      }
    }
    return bid.shipperCounterRate || null; // Fallback to cached value
  }, [chatMessages, bid.shipperCounterRate]);
  
  // Get the latest agreed price from chat messages (for Accept button)
  // IMPORTANT: Only use admin's last offer — carrier cannot self-determine the accepted price
  const latestAgreedPrice = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i];
      if (msg.sender === "admin") {
        if (msg.amount && msg.amount >= 10000) return msg.amount;
        const extracted = extractAmount(msg.message);
        if (extracted) return extracted;
      }
    }
    return bid.shipperCounterRate || bid.currentRate;
  }, [chatMessages, bid.shipperCounterRate, bid.currentRate]);

  const isRealBid = bid.bidId && !bid.bidId.startsWith("bid-");
  
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/admin/contact", { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setAdminPhone(data?.phone || null))
      .catch(() => setAdminPhone(null));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (isRealBid) {
      setIsLoading(true);
      fetch(`/api/bids/${bid.bidId}/negotiations`, { credentials: "include" })
        .then((res) => res.ok ? res.json() : [])
        .then((data) => {
          const messages: ChatMessage[] = data
            .filter((msg: any) => msg.messageType !== "initial_bid")
            .map((msg: any) => ({
              id: msg.id,
              sender: msg.senderRole === "admin" ? "admin" : "carrier",
              message: msg.message || (msg.messageType === "counter_offer" ? "Counter offer" : "Message"),
              amount: msg.amount ? parseFloat(msg.amount) : undefined,
              timestamp: new Date(msg.createdAt),
            }));
          setChatMessages(messages);
        })
        .catch(() => setChatMessages([]))
        .finally(() => setIsLoading(false));
    } else {
      setChatMessages([]);
    }
  }, [isOpen, bid.bidId, isRealBid, bid.negotiationHistory]);

  useEffect(() => {
    if (!isOpen || !isRealBid) return;

    const unsub = onMarketplaceEvent("negotiation_message", (data) => {
      if (data.bidId === bid.bidId) {
        const newMsg: ChatMessage = {
          id: data.negotiation?.id || `msg-${Date.now()}`,
          sender: data.negotiation?.senderRole === "carrier" ? "carrier" : "admin",
          message: data.negotiation?.message || "Counter offer",
          amount: data.negotiation?.counterAmount ? parseFloat(data.negotiation.counterAmount) : undefined,
          timestamp: new Date(data.negotiation?.createdAt || Date.now()),
        };
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    });

    return () => unsub();
  }, [isOpen, isRealBid, bid.bidId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const sendMessage = async (messageType: "message" | "counter_offer") => {
    if (!isRealBid) {
      if (messageType === "counter_offer") {
        onCounter(parseInt(counterAmount));
        setShowCounterInput(false);
      }
      return;
    }

    setIsSending(true);
    try {
      if (messageType === "counter_offer") {
        // Use the new dedicated carrier counter endpoint for real-time sync
        await apiRequest("POST", `/api/carrier/bids/${bid.bidId}/counter`, {
          amount: parseInt(counterAmount),
          message: `Counter offer: Rs. ${parseInt(counterAmount).toLocaleString("en-IN")}`,
        });
        setShowCounterInput(false);
        // Invalidate and immediately refetch carrier bids cache
        await queryClient.invalidateQueries({ queryKey: ['/api/carrier/bids'] });
        toast({ title: "Counter Sent", description: `Your counter offer of ${formatCurrency(parseInt(counterAmount))} has been sent.` });
      } else {
        // For regular messages, use the negotiate endpoint
        await apiRequest("POST", `/api/bids/${bid.bidId}/negotiate`, {
          messageType,
          message: newMessage,
        });
        setNewMessage("");
        // Invalidate and immediately refetch carrier bids cache
        await queryClient.invalidateQueries({ queryKey: ['/api/carrier/bids'] });
        toast({ title: "Message Sent", description: "Your message has been sent to the admin." });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const acceptCounterOffer = async () => {
    if (!isRealBid) {
      onAccept();
      return;
    }

    setIsSending(true);
    try {
      // Send the negotiated price to be recorded
      await apiRequest("POST", `/api/carrier/bids/${bid.bidId}/accept`, {
        agreedPrice: latestAgreedPrice
      });
      // Invalidate carrier bids cache
      queryClient.invalidateQueries({ queryKey: ['/api/carrier/bids'] });
      toast({ 
        title: "Offer Accepted", 
        description: `You have accepted the offer at Rs. ${latestAgreedPrice.toLocaleString("en-IN")}` 
      });
      onAccept();
    } catch {
      toast({ title: "Error", description: "Failed to accept offer", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };
  
  return (
    <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            Negotiation - {(bid as any).displayLoadId || bid.loadId.slice(0, 8).toUpperCase()}
          </DialogTitle>
          {adminPhone && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`tel:${adminPhone}`, '_self')}
              className="flex items-center gap-1 text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 text-xs sm:text-sm w-full sm:w-auto"
              data-testid="button-call-admin"
            >
              <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Call Admin
            </Button>
          )}
        </div>
        <DialogDescription className="text-xs sm:text-sm">
          {bid.pickup} to {bid.dropoff}
        </DialogDescription>
      </DialogHeader>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-3 sm:py-4">
        <Card>
          <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4 space-y-2">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Load Type</span>
              <span className="font-medium truncate ml-2">{bid.loadType}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Weight</span>
              <span className="font-medium">{bid.weight} Tons</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4 space-y-2">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Distance</span>
              <span className="font-medium">{distanceLabel}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Your Offer</span>
              <span className="font-medium text-primary">{formatCurrency(liveCarrierOffer)}</span>
            </div>
            {liveAdminCounter && (
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Admin Counter</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(liveAdminCounter)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
          <CardTitle className="text-sm">Negotiation Chat</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
          <ScrollArea className="h-40 sm:h-48" ref={scrollRef}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-muted-foreground" />
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs sm:text-sm">
                No negotiation messages yet
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {chatMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.sender === "carrier" ? "justify-end" : "justify-start"}`}
                  >
                    <div 
                      className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-2 sm:p-3 ${
                        msg.sender === "carrier" 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {msg.sender === "carrier" ? "You" : "Admin"}
                        </span>
                        <span className="text-xs opacity-70">
                          {format(new Date(msg.timestamp), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm break-words">{msg.message}</p>
                      {msg.amount && (
                        <p className="text-base sm:text-lg font-bold mt-1">{formatCurrency(msg.amount)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {isRealBid && (bid.bidStatus === "pending" || bid.bidStatus === "countered") && (
        <div className="flex gap-2 pt-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newMessage.trim()) {
                sendMessage("message");
              }
            }}
            className="flex-1 text-xs sm:text-sm"
            data-testid="input-chat-message"
          />
          <Button
            size="icon"
            disabled={!newMessage.trim() || isSending}
            onClick={() => sendMessage("message")}
            data-testid="button-send-message"
            className="shrink-0"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
      
      {(bid.bidStatus === "pending" || bid.bidStatus === "countered") && (
        <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t">
          {bid.bidStatus === "countered" && bid.shipperCounterRate && (
            <div className="p-3 sm:p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
                <span className="font-medium text-amber-800 dark:text-amber-200 text-xs sm:text-sm">Admin Counter Offer</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-amber-700 dark:text-amber-300">
                {formatCurrency(bid.shipperCounterRate)}
              </p>
              <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 mt-1">
                {bid.timeLeftToRespond}h left to respond
              </p>
            </div>
          )}
          
          {showConfirmation ? (
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  Confirm Load Acceptance
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Accepting this will finalize your commitment to this load.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 pb-2 sm:pb-3 px-3 sm:px-4">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Your Original Bid:</span>
                  <span className="font-medium line-through text-muted-foreground">
                    {formatCurrency(bid.carrierOffer)}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Final Agreed Price:</span>
                  <span className="font-bold text-green-600 text-base sm:text-lg">
                    {formatCurrency(latestAgreedPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Load:</span>
                  <span className="font-medium break-words text-right ml-2">{bid.pickup} → {bid.dropoff}</span>
                </div>
              </CardContent>
              <div className="flex flex-col sm:flex-row gap-2 px-3 sm:px-6 pb-3 sm:pb-4">
                <Button 
                  variant="outline" 
                  className="flex-1 text-xs sm:text-sm"
                  onClick={() => setShowConfirmation(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-xs sm:text-sm" 
                  onClick={acceptCounterOffer}
                  disabled={isSending}
                  data-testid="button-confirm-accept"
                >
                  {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Confirm & Accept
                </Button>
              </div>
            </Card>
          ) : showCounterInput ? (
            <div className="space-y-2 sm:space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs sm:text-sm">Rs.</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    value={counterAmount}
                    onChange={(e) => {
                      // Allow only digits and format as needed
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setCounterAmount(value);
                    }}
                    className="pl-10 text-right font-semibold text-sm sm:text-base"
                    data-testid="input-counter-amount"
                  />
                </div>
                <Button 
                  onClick={() => sendMessage("counter_offer")}
                  disabled={isSending}
                  data-testid="button-submit-counter"
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send
                </Button>
              </div>
              <Button 
                variant="ghost" 
                className="w-full text-xs sm:text-sm" 
                onClick={() => setShowCounterInput(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                className="flex-1 text-xs sm:text-sm" 
                onClick={() => setShowConfirmation(true)}
                disabled={isSending}
                data-testid="button-accept-bid"
              >
                {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Accept {bid.shipperCounterRate ? "Counter" : ""}
              </Button>
              <Button 
                variant="destructive" 
                onClick={onReject}
                data-testid="button-reject-bid"
                size="sm"
                className="text-xs sm:text-sm"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </DialogContent>
  );
}

export default function CarrierBidsPage() {
  const { t } = useTranslation();
  const { updateBid, updateBidStatus } = useCarrierData();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadTypeFilter, setLoadTypeFilter] = useState("all");
  const [selectedBid, setSelectedBid] = useState<CarrierBid | null>(null);
  const [autoOpenProcessed, setAutoOpenProcessed] = useState(false);
  
  // Fetch real bids from API
  const { data: realBidsData = [] } = useQuery<(Bid & { load?: Load })[]>({
    queryKey: ['/api/carrier/bids'],
    staleTime: 15000,
    refetchInterval: 30000,
    enabled: !!user && user.role === "carrier",
  });
  
  // Convert real bids to CarrierBid format (no mock data)
  const bids = useMemo(() => {
    const realBids: CarrierBid[] = realBidsData.map((bid) => {
      const load = bid.load as any;
      const loadNum = load?.shipperLoadNumber || load?.adminReferenceNumber;
      const displayLoadId = loadNum
        ? `LD-${String(loadNum).padStart(3, '0')}`
        : `LD-${bid.loadId.slice(0, 6).toUpperCase()}`;
      
      // Use latest carrier amount if available, otherwise original bid amount
      const latestCarrierAmount = (bid as any).latestCarrierAmount;
      const latestAdminAmount = (bid as any).latestAdminAmount;
      const latestNegotiationAmount = (bid as any).latestNegotiationAmount;
      const carrierCurrentOffer = latestCarrierAmount ? Number(latestCarrierAmount) : Number(bid.amount) || 50000;
      
      // Admin counter: prefer latestAdminAmount from negotiations, fallback to counterAmount
      const adminCounterOffer = latestAdminAmount 
        ? Number(latestAdminAmount) 
        : (bid.counterAmount ? Number(bid.counterAmount) : null);
      
      // The actual current rate is the most recent negotiation amount from either party
      const actualCurrentRate = latestNegotiationAmount 
        ? Number(latestNegotiationAmount) 
        : carrierCurrentOffer;
      
      // Calculate estimated revenue (85% of carrier offer - carrier share after platform fee)
      const estimatedRev = carrierCurrentOffer * 0.85;
      // Profit margin estimate (25% default)
      const estimatedProf = estimatedRev * 0.25;

      const estKm = distanceKmEstimateFromBidLoad(load);
      const routeOrigin = buildCarrierRouteOriginString(load ?? {});
      const routeDestination = buildCarrierRouteDestinationString(load ?? {});
      
      return {
      bidId: bid.id,
      loadId: bid.loadId,
      displayLoadId,
      shipperName: "Shipper",
      shipperCompany: load?.shipperCompanyName || load?.shipperContactName || "Unknown Shipper",
      shipperRating: 4.5,
      pickup: bid.load?.pickupCity || bid.load?.pickupAddress || "Origin",
      dropoff: bid.load?.dropoffCity || bid.load?.dropoffAddress || "Destination",
      loadType: bid.load?.requiredTruckType || "General",
      weight: Number(bid.load?.weight) || 10,
      distance: estKm,
      routeOrigin,
      routeDestination,
      estimatedDistanceKm: estKm,
      proposedRate: Number(bid.load?.finalPrice) || Number(bid.load?.adminFinalPrice) || Number(bid.amount) || 50000,
      carrierOffer: carrierCurrentOffer, // Use latest carrier counter offer
      currentRate: actualCurrentRate,
      shipperCounterRate: adminCounterOffer, // Admin's latest counter offer
      requiredVehicleType: bid.load?.requiredTruckType || "Open - 17 Feet",
      bidStatus: (() => {
        const s = (bid.status as CarrierBid["bidStatus"]) || "pending";
        // DB status is the source of truth — use it directly
        if (s === "countered" || s === "accepted" || s === "rejected" || s === "expired") return s;
        // Fallback: if counterAmount > 0 (from any party), treat as countered
        // This handles bids where status wasn't updated but counterAmount was set
        const hasCounter = (bid.counterAmount && parseFloat(String(bid.counterAmount)) > 0)
          || (adminCounterOffer && adminCounterOffer > 0);
        if (hasCounter) return "countered" as CarrierBid["bidStatus"];
        return s;
      })(),
      timeLeftToRespond: 24,
      submittedAt: new Date(bid.createdAt || Date.now()),
      estimatedRevenue: estimatedRev,
      estimatedProfit: estimatedProf,
      negotiationHistory: [{
        id: `msg-${bid.id}-1`,
        sender: "carrier" as const,
        message: "Initial bid placed",
        amount: Number(bid.amount),
        timestamp: new Date(bid.createdAt || Date.now()),
      }],
    };
    });
    
    // Return only real bids from the API (no mock data)
    return realBids;
  }, [realBidsData]);

  type RouteMetricsResponse = { distance: number; duration: string };

  const bidRouteJobs = useMemo(() => {
    const byLoadId = new Map<string, { origin: string; dest: string }>();
    for (const b of bids) {
      const o = b.routeOrigin ?? "";
      const d = b.routeDestination ?? "";
      if (o.length < 2 || d.length < 2) continue;
      if (!byLoadId.has(b.loadId)) byLoadId.set(b.loadId, { origin: o, dest: d });
    }
    return Array.from(byLoadId.entries()).map(([loadId, v]) => ({
      loadId,
      origin: v.origin,
      dest: v.dest,
    }));
  }, [bids]);

  const bidRouteQueries = useQueries({
    queries: bidRouteJobs.map((j) => ({
      queryKey: ["/api/distance/calculate", j.loadId, j.origin, j.dest] as const,
      queryFn: async (): Promise<RouteMetricsResponse> => {
        const response = await fetch("/api/distance/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ origin: j.origin, destination: j.dest }),
        });
        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errorData.error || `Distance API failed (${response.status})`);
        }
        return response.json();
      },
      staleTime: 86_400_000,
    })),
  });

  const formatBidRouteKmLabel = (bid: CarrierBid): string => {
    const jobIdx = bidRouteJobs.findIndex((j) => j.loadId === bid.loadId);
    const q = jobIdx >= 0 ? bidRouteQueries[jobIdx] : null;
    const r = q?.data?.distance;
    if (r != null && Number.isFinite(r) && r > 0) return `${Math.round(r)} km`;
    const est = bid.estimatedDistanceKm ?? bid.distance;
    if (est > 0) return `~${est} km`;
    if (q?.isPending && !q?.data) return "Calculating…";
    return "—";
  };
  
  // Auto-open negotiation dialog when navigating from notification with ?load= parameter
  useEffect(() => {
    if (autoOpenProcessed) return;
    
    const params = new URLSearchParams(searchParams);
    const loadId = params.get("load");
    
    if (loadId && bids.length > 0) {
      const matchingBid = bids.find(b => b.loadId === loadId);
      if (matchingBid) {
        setSelectedBid(matchingBid);
        // Clear the URL parameter
        setLocation("/carrier/bids", { replace: true });
      }
      setAutoOpenProcessed(true);
    }
  }, [searchParams, bids, autoOpenProcessed, setLocation]);

  useEffect(() => {
    if (user?.id && user?.role === "carrier") {
      connectMarketplace("carrier", user.id);
      
      const unsubCounter = onMarketplaceEvent("bid_countered", (data) => {
        if (data.carrierId === user.id) {
          const counterAmount = data.counterAmount || data.bid?.counterAmount;
          if (counterAmount && !isNaN(parseFloat(counterAmount))) {
            updateBidStatus(data.bidId || data.bid?.id, "countered", parseFloat(counterAmount));
          }
          // Invalidate carrier bids cache to refresh from API
          queryClient.invalidateQueries({ queryKey: ['/api/carrier/bids'] });
          toast({
            title: "Counter Offer Received",
            description: `Admin sent a counter offer of Rs. ${parseFloat(counterAmount || "0").toLocaleString("en-IN")}`,
          });
        }
      });

      const unsubAccepted = onMarketplaceEvent("bid_accepted", (data) => {
        if (data.carrierId === user.id) {
          updateBidStatus(data.bidId || data.bid?.id, "accepted");
          // Invalidate carrier bids cache to refresh from API
          queryClient.invalidateQueries({ queryKey: ['/api/carrier/bids'] });
          toast({
            title: "Bid Accepted!",
            description: `Your bid for the load has been accepted. Check your trips.`,
          });
        }
      });

      const unsubRejected = onMarketplaceEvent("bid_rejected", (data) => {
        if (data.carrierId === user.id) {
          updateBidStatus(data.bidId || data.bid?.id, "rejected");
          // Invalidate carrier bids cache to refresh from API
          queryClient.invalidateQueries({ queryKey: ['/api/carrier/bids'] });
          toast({
            title: "Bid Rejected",
            description: "Your bid was not accepted for this load.",
            variant: "destructive",
          });
        }
      });

      return () => {
        unsubCounter();
        unsubAccepted();
        unsubRejected();
        disconnectMarketplace();
      };
    }
  }, [user?.id, user?.role, toast, updateBidStatus]);

  const filteredBids = useMemo(() => {
    return bids.filter((bid) => {
      const matchesStatus = statusFilter === "all" || bid.bidStatus === statusFilter;
      const matchesSearch = 
        bid.pickup.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bid.dropoff.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bid.shipperCompany.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bid.loadId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLoadType = loadTypeFilter === "all" || bid.loadType === loadTypeFilter;
      return matchesStatus && matchesSearch && matchesLoadType;
    });
  }, [bids, statusFilter, searchQuery, loadTypeFilter]);

  const statusCounts = useMemo(() => ({
    all: bids.length,
    pending: bids.filter((b) => b.bidStatus === "pending").length,
    countered: bids.filter((b) => b.bidStatus === "countered").length,
    accepted: bids.filter((b) => b.bidStatus === "accepted").length,
    rejected: bids.filter((b) => b.bidStatus === "rejected").length,
  }), [bids]);
  
  const stats = useMemo(() => {
    const total = bids.length;
    const won = bids.filter(b => b.bidStatus === "accepted").length;
    const pending = bids.filter(b => b.bidStatus === "pending" || b.bidStatus === "countered").length;
    const totalValue = bids.filter(b => b.bidStatus === "accepted").reduce((sum, b) => sum + b.currentRate, 0);
    
    return {
      total,
      won,
      pending,
      winRate: total > 0 ? Math.round((won / total) * 100) : 0,
      totalValue
    };
  }, [bids]);

  const loadTypes = useMemo(() => {
    const types = new Set(bids.map(b => b.loadType));
    return Array.from(types);
  }, [bids]);

  const handleAccept = (bidId: string) => {
    updateBid(bidId, "accept");
    toast({
      title: "Bid Accepted",
      description: "The bid has been accepted. A new trip will be created.",
    });
  };

  const handleCounter = (bidId: string, amount: number) => {
    updateBid(bidId, "counter", amount);
    toast({
      title: "Counter Offer Sent",
      description: `Your counter offer of ${formatCurrency(amount)} has been sent.`,
    });
  };

  const handleReject = (bidId: string) => {
    updateBid(bidId, "reject");
    toast({
      title: "Bid Rejected",
      description: "The bid has been rejected.",
    });
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-bids-title">{t("carrier.bidTracking")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t("carrier.bidTrackingDesc")}</p>
        </div>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("carrier.totalBids")}
          value={stats.total}
          icon={Gavel}
          subtitle={t("carrier.submitted")}
          testId="stat-total-bids"
        />
        <StatCard
          title={t("carrier.underNegotiation")}
          value={stats.pending}
          icon={MessageSquare}
          subtitle={t("carrier.requireAttention")}
          testId="stat-pending-bids"
        />
        <StatCard
          title={t("dashboard.performanceScore")}
          value={`${stats.winRate}%`}
          icon={TrendingUp}
          subtitle={`${stats.won} ${t("bids.accepted")}`}
          testId="stat-win-rate"
        />
        <StatCard
          title={t("carrier.acceptedBids")}
          value={formatCurrency(stats.totalValue)}
          icon={Package}
          subtitle={t("bids.accepted")}
          testId="stat-total-value"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("carrier.searchBids")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-bids"
          />
        </div>
        <Select value={loadTypeFilter} onValueChange={setLoadTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-load-type">
            <SelectValue placeholder={t("loads.loadType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("carrier.allTypes")}</SelectItem>
            {loadTypes.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-hide">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="all" className="gap-2 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-all">
              {t("common.all")}
              <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-pending">
              {t("bids.pending")}
              <Badge variant="secondary" className="ml-1">{statusCounts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="countered" className="gap-2 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-countered">
              {t("bids.countered")}
              <Badge variant="secondary" className="ml-1">{statusCounts.countered}</Badge>
            </TabsTrigger>
            <TabsTrigger value="accepted" className="gap-2 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-accepted">
              {t("bids.accepted")}
              <Badge variant="secondary" className="ml-1">{statusCounts.accepted}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2 whitespace-nowrap text-xs sm:text-sm" data-testid="tab-rejected">
              {t("bids.rejected")}
              <Badge variant="secondary" className="ml-1">{statusCounts.rejected}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredBids.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={t("bids.noBidsYet")}
          description={
            bids.length === 0
              ? t("carrier.browseLoads")
              : t("carrier.noLoadsMatchFilters")
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredBids.slice(0, 50).map((bid) => {
            const statusInfo = statusConfig[bid.bidStatus];
            const StatusIcon = statusInfo.icon;
            
            return (
              <Card key={bid.bidId} className="hover-elevate" data-testid={`bid-card-${bid.bidId}`}>
                <CardContent className="p-3 sm:p-4 md:p-5">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${statusInfo.color} no-default-hover-elevate no-default-active-elevate text-xs`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            {(bid as any).displayLoadId || `LD-${bid.loadId.slice(0, 6).toUpperCase()}`}
                          </span>
                          <Badge variant="outline" className="text-xs">{bid.loadType}</Badge>
                          {bid.bidStatus === "countered" && bid.timeLeftToRespond > 0 && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                              <Timer className="h-3 w-3 mr-1" />
                              {bid.timeLeftToRespond}h left
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base flex-wrap">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{bid.pickup}</span>
                          <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{bid.dropoff}</span>
                          {(() => {
                            const routeKmLabel = formatBidRouteKmLabel(bid);
                            if (routeKmLabel === "—") return null;
                            return (
                              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                                ({routeKmLabel})
                              </span>
                            );
                          })()}
                        </div>
                        
                        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                            <span>{bid.weight} Tons</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate max-w-[150px] sm:max-w-none">{bid.requiredVehicleType}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 sm:gap-2">
                        <div className="text-left sm:text-right space-y-1">
                          <div className="text-xs sm:text-sm text-muted-foreground">{t("bids.yourBid")}</div>
                          <div className="text-lg sm:text-xl font-bold">{formatCurrency(bid.currentRate)}</div>
                        </div>
                        
                        <Dialog 
                          open={selectedBid?.bidId === bid.bidId} 
                          onOpenChange={(open) => setSelectedBid(open ? bid : null)}
                        >
                          <DialogTrigger asChild>
                            <Button 
                              variant={bid.bidStatus === "countered" ? "default" : "outline"}
                              data-testid={`button-view-${bid.bidId}`}
                              size="sm"
                              className="text-xs sm:text-sm whitespace-nowrap"
                            >
                              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              {bid.bidStatus === "countered" ? t("bids.counterOffer") : t("common.details")}
                            </Button>
                          </DialogTrigger>
                          <NegotiationDialog 
                            bid={bid}
                            distanceLabel={formatBidRouteKmLabel(bid)}
                            isOpen={selectedBid?.bidId === bid.bidId}
                            onAccept={() => handleAccept(bid.bidId)}
                            onCounter={(amount) => handleCounter(bid.bidId, amount)}
                            onReject={() => handleReject(bid.bidId)}
                          />
                        </Dialog>
                      </div>
                    </div>
                  
                    {bid.negotiationHistory.length > 1 && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                          <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                          <span className="break-words">Latest: {bid.negotiationHistory[bid.negotiationHistory.length - 1].message}</span>
                          <span className="text-xs whitespace-nowrap">
                            ({format(new Date(bid.negotiationHistory[bid.negotiationHistory.length - 1].timestamp), "MMM d, h:mm a")})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      <p className="text-sm text-muted-foreground">
        {t("common.showing")} {Math.min(filteredBids.length, 50)} {t("common.of")} {filteredBids.length} {t("bids.title").toLowerCase()}
      </p>
    </div>
  );
}
