import { Truck, MapPin, Package, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Truck as TruckType } from "@shared/schema";

interface TruckCardProps {
  truck: TruckType & {
    matchScore?: number;
  };
  onQuote?: () => void;
  onViewDetails?: () => void;
}

function getTruckTypeLabel(type: string | null) {
  const labels: Record<string, string> = {
    flatbed: "Flatbed",
    refrigerated: "Refrigerated",
    dry_van: "Dry Van",
    tanker: "Tanker",
    container: "Container",
    open_deck: "Open Deck",
  };
  return type ? labels[type] || type : "Unknown";
}

export function TruckCard({ truck, onQuote, onViewDetails }: TruckCardProps) {
  return (
    <Card className="hover-elevate cursor-pointer" onClick={onViewDetails} data-testid={`truck-card-${truck.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{getTruckTypeLabel(truck.truckType)}</p>
              <p className="text-xs text-muted-foreground">{truck.licensePlate}</p>
            </div>
          </div>
          <Badge 
            variant={truck.isAvailable ? "default" : "secondary"} 
            className={truck.isAvailable 
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate" 
              : "no-default-hover-elevate no-default-active-elevate"
            }
          >
            {truck.isAvailable ? (
              <><CheckCircle className="h-3 w-3 mr-1" /> Available</>
            ) : (
              <><XCircle className="h-3 w-3 mr-1" /> In Use</>
            )}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Capacity</span>
            </div>
            <span className="font-medium">{truck.capacity} {truck.capacityUnit}</span>
          </div>
          {truck.currentLocation && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Location</span>
              </div>
              <span className="font-medium truncate max-w-[60%]">{truck.currentLocation}</span>
            </div>
          )}
        </div>

        {truck.matchScore !== undefined && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Match Score</span>
              <Badge className={`${
                truck.matchScore >= 80 
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                  : truck.matchScore >= 60 
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                    : "bg-muted text-muted-foreground"
              } no-default-hover-elevate no-default-active-elevate`}>
                {truck.matchScore}%
              </Badge>
            </div>
          </div>
        )}

        {onQuote && truck.isAvailable && (
          <Button 
            className="w-full mt-4" 
            variant="outline" 
            onClick={(e) => { e.stopPropagation(); onQuote(); }}
            data-testid={`button-quote-${truck.id}`}
          >
            Request Quote
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
