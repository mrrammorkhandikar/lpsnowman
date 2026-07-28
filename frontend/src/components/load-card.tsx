import { MapPin, ArrowRight, Package, Calendar, DollarSign, Users } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Load } from "@shared/schema";

interface LoadCardProps {
  load: Load & {
    bidCount?: number;
    shipper?: { companyName?: string | null };
  };
  variant?: "shipper" | "carrier";
  onViewDetails?: () => void;
  onBid?: () => void;
}

function getStatusColor(status: string | null) {
  switch (status) {
    case "posted":
    case "bidding":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "assigned":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "in_transit":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "delivered":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatStatus(status: string | null) {
  if (!status) return "Draft";
  return status.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function LoadCard({ load, variant = "shipper", onViewDetails, onBid }: LoadCardProps) {
  const formattedDate = load.pickupDate 
    ? new Date(load.pickupDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "TBD";

  return (
    <Card className="hover-elevate cursor-pointer" onClick={onViewDetails} data-testid={`load-card-${load.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <Badge className={`${getStatusColor(load.status)} no-default-hover-elevate no-default-active-elevate`}>
            {formatStatus(load.status)}
          </Badge>
          {load.bidCount !== undefined && load.bidCount > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{load.bidCount} bid{load.bidCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 flex-shrink-0">
              <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{load.pickupCity}</p>
              <p className="text-xs text-muted-foreground truncate">{load.pickupAddress}</p>
            </div>
          </div>
          
          <div className="flex items-center pl-4">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 h-px bg-border ml-2" />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 flex-shrink-0">
              <MapPin className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{load.dropoffCity}</p>
              <p className="text-xs text-muted-foreground truncate">{load.dropoffAddress}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>{load.weight} {load.weightUnit}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formattedDate}</span>
          </div>
          {load.estimatedPrice && (
            <div className="flex items-center gap-1 ml-auto font-medium text-foreground">
              <DollarSign className="h-4 w-4" />
              <span>{Number(load.estimatedPrice).toLocaleString()}</span>
            </div>
          )}
        </div>
      </CardContent>

      {variant === "carrier" && onBid && (
        <CardFooter className="p-4 pt-0">
          <Button 
            className="w-full" 
            onClick={(e) => { e.stopPropagation(); onBid(); }}
            data-testid={`button-bid-${load.id}`}
          >
            Place Bid
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
