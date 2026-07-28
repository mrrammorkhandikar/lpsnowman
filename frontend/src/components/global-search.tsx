import { useState, useEffect, useCallback } from "react";
import { Search, Package, Truck, DollarSign, FileText, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLoads, useBids, useCarriers } from "@/lib/api-hooks";

interface SearchResult {
  id: string;
  type: "load" | "carrier" | "bid" | "document";
  title: string;
  subtitle: string;
  route?: string;
  status?: string;
  statusVariant?: "default" | "secondary" | "destructive" | "outline";
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isShipper = user?.role === "shipper";

  const { data: loads = [] } = useLoads();
  const { data: bids = [] } = useBids();
  const { data: carriers = [] } = useCarriers();

  const searchAll = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) { setResults([]); return; }
    const q = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search real loads
    loads.forEach((load: any) => {
      const loadNum = load.shipperLoadNumber
        ? `LD-${String(load.shipperLoadNumber).padStart(3, "0")}`
        : load.adminReferenceNumber
        ? `LD-${load.adminReferenceNumber}`
        : load.id?.slice(0, 8).toUpperCase();

      if (
        loadNum?.toLowerCase().includes(q) ||
        load.pickupCity?.toLowerCase().includes(q) ||
        load.dropoffCity?.toLowerCase().includes(q) ||
        load.goodsToBeCarried?.toLowerCase().includes(q) ||
        load.status?.toLowerCase().includes(q) ||
        load.requiredTruckType?.toLowerCase().includes(q)
      ) {
        const statusMap: Record<string, string> = {
          pending: "Pending", priced: "Active", posted_to_carriers: "Active",
          open_for_bid: "Bidding", counter_received: "Bidding", awarded: "Assigned",
          in_transit: "En Route", delivered: "Delivered", closed: "Delivered",
          cancelled: "Cancelled",
        };
        const displayStatus = statusMap[load.status] || load.status;
        searchResults.push({
          id: load.id,
          type: "load",
          title: loadNum || load.id,
          subtitle: `${load.pickupCity || "?"} → ${load.dropoffCity || "?"}${load.goodsToBeCarried ? ` • ${load.goodsToBeCarried}` : ""}`,
          route: isShipper ? `/shipper/loads/${load.id}` : `/admin/loads/${load.id}`,
          status: displayStatus,
          statusVariant: ["Active", "Bidding"].includes(displayStatus) ? "default"
            : displayStatus === "Delivered" ? "secondary" : "outline",
        });
      }
    });

    // Search bids (admin/carrier only)
    if (!isShipper) {
      bids.forEach((bid: any) => {
        const carrierName = bid.carrier?.companyName || bid.carrier?.username || bid.carrierId;
        const loadNum = bid.load?.shipperLoadNumber
          ? `LD-${String(bid.load.shipperLoadNumber).padStart(3, "0")}`
          : bid.loadId?.slice(0, 8).toUpperCase();

        if (
          bid.id?.toLowerCase().includes(q) ||
          carrierName?.toLowerCase().includes(q) ||
          bid.loadId?.toLowerCase().includes(q) ||
          bid.status?.toLowerCase().includes(q) ||
          loadNum?.toLowerCase().includes(q)
        ) {
          searchResults.push({
            id: bid.id,
            type: "bid",
            title: `${carrierName} — ₹${parseFloat(bid.amount || "0").toLocaleString("en-IN")}`,
            subtitle: `Bid on ${loadNum || bid.loadId}`,
            route: `/admin/negotiations`,
            status: bid.status,
            statusVariant: bid.status === "pending" ? "default"
              : bid.status === "accepted" ? "secondary"
              : bid.status === "countered" ? "outline"
              : "destructive",
          });
        }
      });

      // Search real carriers
      carriers.forEach((carrier: any) => {
        const name = carrier.companyName || carrier.username;
        const profile = carrier.carrierProfile;
        if (
          name?.toLowerCase().includes(q) ||
          carrier.email?.toLowerCase().includes(q) ||
          carrier.phone?.toLowerCase().includes(q) ||
          profile?.companyName?.toLowerCase().includes(q)
        ) {
          searchResults.push({
            id: carrier.id,
            type: "carrier",
            title: name || "Unknown Carrier",
            subtitle: `${profile?.carrierType || "carrier"} • ${profile?.fleetSize ? `${profile.fleetSize} trucks` : carrier.email}`,
            route: `/admin/carriers/${carrier.id}`,
            status: carrier.isVerified ? "Verified" : "Pending",
            statusVariant: carrier.isVerified ? "secondary" : "outline",
          });
        }
      });
    }

    setResults(searchResults.slice(0, 10));
  }, [loads, bids, carriers, isShipper]);

  useEffect(() => {
    const t = setTimeout(() => searchAll(query), 150);
    return () => clearTimeout(t);
  }, [query, searchAll]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = (result: SearchResult) => {
    if (result.route) setLocation(result.route);
    setOpen(false);
    setQuery("");
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "load":     return <Package className="h-4 w-4 text-primary" />;
      case "carrier":  return <Truck className="h-4 w-4 text-blue-500" />;
      case "bid":      return <DollarSign className="h-4 w-4 text-green-500" />;
      case "document": return <FileText className="h-4 w-4 text-amber-500" />;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "load":     return "Load";
      case "carrier":  return "Carrier";
      case "bid":      return "Bid";
      case "document": return "Document";
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground w-full max-w-xs sm:w-64 justify-start"
        onClick={() => setOpen(true)}
        data-testid="button-global-search"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate text-xs sm:text-sm">
          {isShipper ? "Search loads..." : "Search..."}
        </span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
        <DialogContent className="p-0 max-w-lg overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Global Search</DialogTitle>
          </DialogHeader>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <Input
              placeholder={isShipper ? "Search loads, routes, cargo..." : "Search loads, carriers, bids..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 flex-1"
              data-testid="input-global-search"
              autoFocus
            />
          </div>

          <ScrollArea className="max-h-[300px]">
            {results.length === 0 && query && (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-1">
                  {isShipper ? "Try load ID, city, or cargo type" : "Try load ID, carrier name, or city"}
                </p>
              </div>
            )}

            {results.length === 0 && !query && (
              <div className="p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Actions</p>
                <div className="space-y-1">
                  {isShipper ? (
                    <>
                      <button className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                        onClick={() => { setLocation("/shipper/post-load"); setOpen(false); }}
                        data-testid="search-quick-post-load">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="text-sm">Post a new load</span>
                        <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                      </button>
                      <button className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                        onClick={() => { setLocation("/shipper/loads"); setOpen(false); }}
                        data-testid="search-quick-my-loads">
                        <Package className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">View my loads</span>
                        <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                      </button>
                      <button className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                        onClick={() => { setLocation("/shipper/tracking"); setOpen(false); }}
                        data-testid="search-quick-tracking">
                        <MapPin className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Track shipments</span>
                        <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                        onClick={() => { setLocation("/admin/queue"); setOpen(false); }}
                        data-testid="search-quick-load-queue">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="text-sm">View load queue</span>
                        <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                      </button>
                      <button className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                        onClick={() => { setLocation("/admin/carriers"); setOpen(false); }}
                        data-testid="search-quick-carriers">
                        <Truck className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Manage carriers</span>
                        <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                      </button>
                      <button className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                        onClick={() => { setLocation("/admin/negotiations"); setOpen(false); }}
                        data-testid="search-quick-bids">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-sm">View bids</span>
                        <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="p-2">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate text-left"
                    onClick={() => handleSelect(result)}
                    data-testid={`search-result-${result.type}-${result.id}`}
                  >
                    {getIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{result.title}</span>
                        <Badge variant="outline" className="text-[10px] px-1 h-4 shrink-0">
                          {getTypeLabel(result.type)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    {result.status && (
                      <Badge variant={result.statusVariant || "secondary"} className="text-xs shrink-0">
                        {result.status}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Searching live data</span>
            <span>Press <kbd className="px-1 rounded bg-muted">Esc</kbd> to close</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
