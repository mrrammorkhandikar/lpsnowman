import { useState } from "react";
import { 
  MapPin, ArrowRight, IndianRupee, Clock, 
  CheckCircle2, XCircle, Hourglass, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface Bid {
  id: string;
  loadId: string;
  amount: string;
  status: string;
  bidType: string;
  notes: string | null;
  createdAt: string;
  load?: {
    pickupCity: string;
    dropoffCity: string;
    weight: string;
    requiredTruckType: string;
    adminFinalPrice: string;
  };
}

export default function SoloMyBids() {
  const [activeTab, setActiveTab] = useState<"pending" | "accepted" | "rejected">("pending");

  const { data: bidsData, isLoading } = useQuery<Bid[]>({
    queryKey: ["/api/bids"],
  });

  const bids = bidsData || [];
  
  const filteredBids = bids.filter((bid) => {
    if (activeTab === "pending") return bid.status === "pending";
    if (activeTab === "accepted") return bid.status === "accepted";
    return bid.status === "rejected";
  });

  const formatPrice = (price: string | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-IN").format(parseFloat(price));
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffHrs > 24) return `${Math.floor(diffHrs / 24)}d ago`;
    if (diffHrs > 0) return `${diffHrs}h ago`;
    return `${diffMins}m ago`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Hourglass className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const pendingCount = bids.filter(b => b.status === "pending").length;
  const acceptedCount = bids.filter(b => b.status === "accepted").length;
  const rejectedCount = bids.filter(b => b.status === "rejected").length;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b bg-card sticky top-0 z-10">
        <h1 className="text-xl font-bold mb-3" data-testid="text-page-title">My Bids</h1>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1" data-testid="tab-pending">
              Pending ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="accepted" className="flex-1" data-testid="tab-accepted">
              Won ({acceptedCount})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1" data-testid="tab-rejected">
              Lost ({rejectedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-16 w-full" />
              </Card>
            ))
          ) : filteredBids.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Hourglass className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No {activeTab} bids</p>
              <p className="text-sm">
                {activeTab === "pending" 
                  ? "Browse available loads to place bids"
                  : activeTab === "accepted"
                  ? "Your accepted bids will appear here"
                  : "Rejected bids are shown here"}
              </p>
            </div>
          ) : (
            filteredBids.map((bid) => (
              <Card key={bid.id} className="overflow-hidden" data-testid={`card-bid-${bid.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      {bid.load ? (
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className="truncate">{bid.load.pickupCity}</span>
                          <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate">{bid.load.dropoffCity}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Load #{bid.loadId.slice(0, 8)}</span>
                      )}
                    </div>
                    {getStatusBadge(bid.status)}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Your Bid</div>
                      <div className="flex items-center gap-1 text-lg font-bold">
                        <IndianRupee className="h-4 w-4" />
                        {formatPrice(bid.amount)}
                      </div>
                    </div>
                    {bid.load?.adminFinalPrice && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground mb-1">Total Price</div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <IndianRupee className="h-3 w-3" />
                          {formatPrice(bid.load.adminFinalPrice)}
                        </div>
                      </div>
                    )}
                  </div>

                  {bid.notes && (
                    <div className="mt-3 p-2 bg-muted rounded-md text-xs text-muted-foreground">
                      {bid.notes}
                    </div>
                  )}

                  <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{getTimeAgo(bid.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
