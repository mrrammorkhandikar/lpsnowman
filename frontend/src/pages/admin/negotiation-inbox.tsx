import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NegotiationChat } from "@/components/admin/negotiation-chat";
import {
  MessageSquare,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  IndianRupee,
  MapPin,
  Truck,
} from "lucide-react";
import type { Load, NegotiationThread } from "@shared/schema";

interface EnrichedLoad extends Load {
  shipperName?: string;
  shipperEmail?: string;
  thread: NegotiationThread;
  bidCount: number;
  messageCount: number;
  latestActivity: Date;
}

interface NegotiationsResponse {
  loads: EnrichedLoad[];
  counters: {
    pending: number;
    counterSent: number;
    accepted: number;
    rejected: number;
  };
}

export default function NegotiationInbox() {
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading } = useQuery<NegotiationsResponse>({
    queryKey: ["/api/admin/negotiations"],
    refetchInterval: 10000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending_review":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "counter_sent":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "carrier_responded":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "accepted":
        return "default";
      case "rejected":
        return "destructive";
      case "counter_sent":
      case "carrier_responded":
        return "secondary";
      default:
        return "outline";
    }
  };

  const filteredLoads = data?.loads.filter((load) => {
    const status = load.thread.status || "pending_review";
    if (activeTab === "all") return true;
    if (activeTab === "pending") return status === "pending_review";
    if (activeTab === "active") return ["counter_sent", "carrier_responded"].includes(status);
    if (activeTab === "completed") return ["accepted", "rejected"].includes(status);
    return true;
  }) || [];

  const selectedLoad = selectedLoadId 
    ? data?.loads.find((l) => l.id === selectedLoadId) 
    : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className="w-96 border-r flex flex-col bg-background">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold flex items-center gap-2" data-testid="heading-negotiation-inbox">
            <MessageSquare className="h-5 w-5" />
            Negotiation Inbox
          </h1>
          {data?.counters && (
            <div className="flex gap-2 mt-3 flex-wrap">
              <Badge variant="outline" className="text-xs" data-testid="counter-pending">
                <Clock className="h-3 w-3 mr-1" />
                {data.counters.pending} Pending
              </Badge>
              <Badge variant="secondary" className="text-xs" data-testid="counter-active">
                <MessageSquare className="h-3 w-3 mr-1" />
                {data.counters.counterSent} Active
              </Badge>
              <Badge variant="default" className="text-xs" data-testid="counter-accepted">
                <CheckCircle className="h-3 w-3 mr-1" />
                {data.counters.accepted} Won
              </Badge>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1" data-testid="tab-all">
                All
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex-1" data-testid="tab-pending">
                New
              </TabsTrigger>
              <TabsTrigger value="active" className="flex-1" data-testid="tab-active">
                Active
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex-1" data-testid="tab-completed">
                Done
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-4 py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLoads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No negotiations found.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLoads.map((load) => (
                  <Card
                    key={load.id}
                    className={`cursor-pointer transition-all hover-elevate ${
                      selectedLoadId === load.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedLoadId(load.id)}
                    data-testid={`load-item-${load.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {getStatusIcon(load.thread.status || "pending_review")}
                          <span className="font-medium text-sm truncate">
                            {load.pickupCity?.split(",")[0]} → {load.dropoffCity?.split(",")[0]}
                          </span>
                        </div>
                        <Badge variant={getStatusBadgeVariant(load.thread.status || "pending_review")} className="text-xs flex-shrink-0">
                          {(load.thread.status || "pending_review").replace(/_/g, " ")}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {load.requiredTruckType}
                        </span>
                        <span>{load.weight} {load.weightUnit}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {load.adminFinalPrice && (
                            <span className="flex items-center gap-0.5 font-medium">
                              <IndianRupee className="h-3 w-3" />
                              {Number(load.adminFinalPrice).toLocaleString("en-IN")}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {load.bidCount} bids
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {load.latestActivity
                            ? format(new Date(load.latestActivity), "MMM d, h:mm a")
                            : ""}
                        </span>
                      </div>

                      {load.shipperName && (
                        <p className="text-xs text-muted-foreground mt-2 truncate">
                          From: {load.shipperName}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </div>

      <div className="flex-1 flex flex-col bg-muted/10">
        {selectedLoadId ? (
          <NegotiationChat
            loadId={selectedLoadId}
            onClose={() => setSelectedLoadId(null)}
            onInvoiceCreate={() => {
              window.location.href = `/admin/invoices?loadId=${selectedLoadId}`;
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h2 className="text-lg font-medium mb-1">Select a Load</h2>
              <p className="text-sm">Choose a load from the list to view its negotiation thread.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
