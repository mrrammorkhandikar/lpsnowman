import { DollarSign, Calendar, Clock, CheckCircle, XCircle, RefreshCw, User, Building2, UserCircle } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Bid, User as UserType } from "@shared/schema";

interface BidCardProps {
  bid: Bid & {
    carrier?: UserType | null;
  };
  variant?: "shipper" | "carrier";
  onAccept?: () => void;
  onReject?: () => void;
  onCounter?: () => void;
  onViewDetails?: () => void;
}

function getStatusInfo(status: string | null) {
  switch (status) {
    case "accepted":
      return { label: "Accepted", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle };
    case "rejected":
      return { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle };
    case "countered":
      return { label: "Countered", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: RefreshCw };
    case "expired":
      return { label: "Expired", className: "bg-muted text-muted-foreground", icon: Clock };
    default:
      return { label: "Pending", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Clock };
  }
}

export function BidCard({ bid, variant = "shipper", onAccept, onReject, onCounter, onViewDetails }: BidCardProps) {
  const statusInfo = getStatusInfo(bid.status);
  const StatusIcon = statusInfo.icon;

  const formattedDate = bid.estimatedPickup 
    ? new Date(bid.estimatedPickup).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "TBD";

  return (
    <Card className="hover-elevate cursor-pointer" onClick={onViewDetails} data-testid={`bid-card-${bid.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          {variant === "shipper" && bid.carrier && (
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">
                  {bid.carrier.companyName?.slice(0, 2).toUpperCase() || bid.carrier.username?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{bid.carrier.companyName || bid.carrier.username}</p>
                  <Badge 
                    variant="outline" 
                    className={bid.carrierType === "solo" 
                      ? "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700 text-xs" 
                      : "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700 text-xs"
                    }
                    data-testid={`badge-carrier-type-${bid.id}`}
                  >
                    {bid.carrierType === "solo" ? <UserCircle className="h-3 w-3 mr-1" /> : <Building2 className="h-3 w-3 mr-1" />}
                    {bid.carrierType === "solo" ? "Solo" : "Enterprise"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Carrier</p>
              </div>
            </div>
          )}
          {variant === "carrier" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="text-sm">Your Bid</span>
            </div>
          )}
          <Badge className={`${statusInfo.className} no-default-hover-elevate no-default-active-elevate`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-sm text-muted-foreground">Bid Amount</span>
            </div>
            <span className="text-xl font-bold">${Number(bid.amount).toLocaleString()}</span>
          </div>

          {bid.counterAmount && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-amber-600 dark:text-amber-400">Counter Offer</span>
              </div>
              <span className="text-xl font-bold text-amber-700 dark:text-amber-300">
                ${Number(bid.counterAmount).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Est. Pickup</span>
            </div>
            <span className="font-medium">{formattedDate}</span>
          </div>

          {bid.notes && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground line-clamp-2">{bid.notes}</p>
            </div>
          )}
        </div>
      </CardContent>

      {bid.status === "pending" && variant === "shipper" && (onAccept || onReject || onCounter) && (
        <CardFooter className="p-4 pt-0 flex gap-2">
          {onAccept && (
            <Button 
              className="flex-1" 
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              data-testid={`button-accept-bid-${bid.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Accept
            </Button>
          )}
          {onCounter && (
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={(e) => { e.stopPropagation(); onCounter(); }}
              data-testid={`button-counter-bid-${bid.id}`}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Counter
            </Button>
          )}
          {onReject && (
            <Button 
              variant="ghost" 
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              data-testid={`button-reject-bid-${bid.id}`}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
