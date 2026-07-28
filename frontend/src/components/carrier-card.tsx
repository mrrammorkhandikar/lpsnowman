import { Star, Truck, MapPin, Shield, MessageSquare, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { User, CarrierProfile } from "@shared/schema";

interface CarrierCardProps {
  carrier: User & {
    carrierProfile?: CarrierProfile | null;
  };
  onViewProfile?: () => void;
  onRequestQuote?: () => void;
  onChat?: () => void;
}

function getBadgeInfo(level: string | null) {
  switch (level) {
    case "gold":
      return { label: "Gold", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    case "silver":
      return { label: "Silver", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300" };
    case "platinum":
      return { label: "Platinum", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" };
    default:
      return { label: "Bronze", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
  }
}

export function CarrierCard({ carrier, onViewProfile, onRequestQuote, onChat }: CarrierCardProps) {
  const profile = carrier.carrierProfile;
  const badgeInfo = getBadgeInfo(profile?.badgeLevel || null);
  
  const avgScore = profile 
    ? ((Number(profile.reliabilityScore) + Number(profile.communicationScore) + Number(profile.onTimeScore)) / 3).toFixed(1)
    : "0.0";

  return (
    <Card className="hover-elevate" data-testid={`carrier-card-${carrier.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {carrier.companyName?.slice(0, 2).toUpperCase() || carrier.username?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{carrier.companyName || carrier.username}</h3>
              <Badge className={`${badgeInfo.className} no-default-hover-elevate no-default-active-elevate text-xs`}>
                <Shield className="h-3 w-3 mr-1" />
                {badgeInfo.label}
              </Badge>
            </div>
            {carrier.isVerified && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Verified Carrier
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-semibold">{avgScore}</span>
            </div>
            <p className="text-xs text-muted-foreground">Rating</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Truck className="h-4 w-4 text-primary" />
              <span className="font-semibold">{profile?.fleetSize || 1}</span>
            </div>
            <p className="text-xs text-muted-foreground">Fleet</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="font-semibold mb-1">{profile?.totalDeliveries || 0}</div>
            <p className="text-xs text-muted-foreground">Deliveries</p>
          </div>
        </div>

        {profile?.serviceZones && profile.serviceZones.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="h-4 w-4" />
              <span>Service Zones</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {profile.serviceZones.slice(0, 3).map((zone) => (
                <Badge key={zone} variant="secondary" className="text-xs">
                  {zone}
                </Badge>
              ))}
              {profile.serviceZones.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{profile.serviceZones.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {onViewProfile && (
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={onViewProfile}
              data-testid={`button-view-profile-${carrier.id}`}
            >
              View Profile
            </Button>
          )}
          {onRequestQuote && (
            <Button 
              className="flex-1" 
              onClick={onRequestQuote}
              data-testid={`button-request-quote-${carrier.id}`}
            >
              Request Quote
            </Button>
          )}
          {onChat && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onChat}
              data-testid={`button-chat-${carrier.id}`}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
