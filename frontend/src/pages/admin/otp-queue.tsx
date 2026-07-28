import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, Key, Truck, MapPin, Copy, Phone, MessageSquare, User, Building2, ChevronDown, ChevronUp, Mail, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOtpRequests, useApproveOtpRequest, useRejectOtpRequest, useRegenerateOtpRequest, type OtpRequest, invalidateOtpRequests } from "@/lib/api-hooks";
import { formatDistanceToNow, format } from "date-fns";

function formatLoadId(load?: { adminReferenceNumber?: number | null; shipperLoadNumber?: number | string | null; id?: string }): string {
  if (load?.adminReferenceNumber) {
    return `LD-${load.adminReferenceNumber}`;
  }
  if (load?.shipperLoadNumber) {
    const ref = String(load.shipperLoadNumber);
    // Avoid duplicating LD- prefix if already present
    if (ref.startsWith("LD-") || ref.startsWith("ld-")) {
      return ref.toUpperCase();
    }
    return `LD-${ref}`;
  }
  // Fallback to truncated load ID if available
  if (load?.id) {
    return `#${load.id.slice(0, 6)}`;
  }
  return "Unknown";
}

interface OtpRequestCardProps {
  request: OtpRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function OtpRequestCard({ request, onApprove, onReject }: OtpRequestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const typeLabels: Record<string, string> = {
    trip_start: "Trip Start",
    route_start: "Route Start",
    trip_end: "Trip End",
    registration: "Registration"
  };
  const typeColors: Record<string, string> = {
    trip_start: "bg-green-500/10 text-green-600 dark:text-green-400",
    route_start: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    trip_end: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    registration: "bg-purple-500/10 text-purple-600 dark:text-purple-400"
  };
  const typeLabel = typeLabels[request.requestType] || "Unknown";
  const typeColor = typeColors[request.requestType] || "bg-muted text-muted-foreground";

  const isSoloDriver = (request as any).isSoloDriver;
  const assignedDriver = (request as any).assignedDriver;
  const assignedTruck = (request as any).assignedTruck;
  
  return (
    <Card className="mb-2 sm:mb-3" data-testid={`otp-request-card-${request.id}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={typeColor}>{typeLabel}</Badge>
                <Badge variant="outline">{formatLoadId(request.load)}</Badge>
                {isSoloDriver ? (
                  <Badge variant="secondary" className="text-xs">Solo Driver</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Enterprise</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                {request.requestedAt ? formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true }) : "Just now"}
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                {isSoloDriver ? (
                  <User className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {isSoloDriver 
                    ? ((request.carrier as any)?.driverName || request.carrier?.username || "Unknown Driver")
                    : (request.carrier?.companyName || request.carrier?.username || "Unknown Carrier")
                  }
                </span>
              </div>
              {request.load && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{request.load.pickupCity || "—"} → {request.load.dropoffCity || (request.load as any).deliveryCity || "—"}</span>
                </div>
              )}
            </div>

            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-center text-muted-foreground"
                data-testid={`button-expand-${request.id}`}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    View Driver Details
                  </>
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <Separator className="my-2" />
              <div className="space-y-3 py-2">
                {isSoloDriver ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Solo Driver Details</p>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium">{(request.carrier as any)?.driverName || request.carrier?.username || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-medium">{request.carrier?.phone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Location:</span>
                          <span className="font-medium">{(request.carrier as any)?.location || "Not specified"}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Truck Details</p>
                      {assignedTruck ? (
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Truck Type:</span>
                            <span className="font-medium">{assignedTruck.truckType || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Truck Location:</span>
                            <span className="font-medium">{(assignedTruck as any).truckLocation || "Not specified"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground ml-6">License Plate:</span>
                            <span className="font-medium">{assignedTruck.licensePlate || assignedTruck.registrationNumber || "—"}</span>
                          </div>
                          {(assignedTruck.manufacturer || assignedTruck.model) && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground ml-6">Vehicle:</span>
                              <span className="font-medium">{[assignedTruck.manufacturer, assignedTruck.model].filter(Boolean).join(" ") || "—"}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No truck assigned yet</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Enterprise Details</p>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Company Name:</span>
                          <span className="font-medium">{request.carrier?.companyName || request.carrier?.username || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Location:</span>
                          <span className="font-medium">{(request.carrier as any)?.location || "Not specified"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-medium">{request.carrier?.phone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium">{(request.carrier as any)?.email || "—"}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Driver Details</p>
                      {assignedDriver ? (
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Driver Name:</span>
                            <span className="font-medium">{assignedDriver.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Driver Phone:</span>
                            <span className="font-medium">{assignedDriver.phone || "—"}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No driver assigned yet</p>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Truck Details</p>
                      {assignedTruck ? (
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Truck Type:</span>
                            <span className="font-medium">{assignedTruck.truckType || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Truck Location:</span>
                            <span className="font-medium">{(assignedTruck as any).truckLocation || "Not specified"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground ml-6">License Plate:</span>
                            <span className="font-medium">{assignedTruck.licensePlate || assignedTruck.registrationNumber || "—"}</span>
                          </div>
                          {(assignedTruck.manufacturer || assignedTruck.model) && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground ml-6">Vehicle:</span>
                              <span className="font-medium">{[assignedTruck.manufacturer, assignedTruck.model].filter(Boolean).join(" ") || "—"}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No truck assigned yet</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Separator className="my-2" />
            </CollapsibleContent>
            
            <div className="flex gap-2 pt-2 flex-col sm:flex-row">
              <Button 
                size="sm" 
                onClick={() => onApprove(request.id)}
                data-testid={`button-approve-${request.id}`}
                className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
              >
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="truncate">Approve & Generate OTP</span>
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onReject(request.id)}
                data-testid={`button-reject-${request.id}`}
                className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
              >
                <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Reject
              </Button>
            </div>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

interface ApprovedRequestCardProps {
  request: OtpRequest;
  onRegenerate: (id: string) => void;
}

function ApprovedRequestCard({ request, onRegenerate }: ApprovedRequestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const typeLabels: Record<string, string> = {
    trip_start: "Trip Start",
    route_start: "Route Start",
    trip_end: "Trip End",
    registration: "Registration"
  };
  const typeColors: Record<string, string> = {
    trip_start: "bg-green-500/10 text-green-600 dark:text-green-400",
    route_start: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    trip_end: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    registration: "bg-purple-500/10 text-purple-600 dark:text-purple-400"
  };
  const typeLabel = typeLabels[request.requestType] || "Unknown";
  const typeColor = typeColors[request.requestType] || "bg-muted text-muted-foreground";

  const isSoloDriver = (request as any).isSoloDriver;
  const assignedDriver = (request as any).assignedDriver;
  const assignedTruck = (request as any).assignedTruck;
  
  return (
    <Card className="mb-2 sm:mb-3" data-testid={`approved-request-${request.id}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <Badge className={`${typeColor} text-[10px] sm:text-xs`}>{typeLabel}</Badge>
                <Badge variant="outline" className="text-[10px] sm:text-xs">{formatLoadId(request.load)}</Badge>
                {isSoloDriver ? (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">Solo Driver</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">Enterprise</Badge>
                )}
              </div>
              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                Approved
              </Badge>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-wrap">
                {isSoloDriver ? (
                  <User className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="font-medium truncate">
                  {isSoloDriver 
                    ? ((request.carrier as any)?.driverName || request.carrier?.username || "Unknown Driver")
                    : (request.carrier?.companyName || request.carrier?.username || "Unknown Carrier")
                  }
                </span>
                {request.carrier?.phone && (
                  <span className="text-muted-foreground text-[10px] sm:text-xs">
                    <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-1" />
                    {request.carrier.phone}
                  </span>
                )}
              </div>
              {request.load && (
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{request.load.pickupCity || "—"} → {request.load.dropoffCity || (request.load as any).deliveryCity || "—"}</span>
                </div>
              )}
            </div>

            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-center text-muted-foreground h-8 sm:h-9 text-xs sm:text-sm"
                data-testid={`button-expand-approved-${request.id}`}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    View Driver Details
                  </>
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <Separator className="my-2" />
              <div className="space-y-3 py-2">
                {isSoloDriver ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Solo Driver Details</p>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium">{(request.carrier as any)?.driverName || request.carrier?.username || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-medium">{request.carrier?.phone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Location:</span>
                          <span className="font-medium">{(request.carrier as any)?.location || "Not specified"}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Truck Details</p>
                      {assignedTruck ? (
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Truck Type:</span>
                            <span className="font-medium">{assignedTruck.truckType || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Truck Location:</span>
                            <span className="font-medium">{(assignedTruck as any).truckLocation || "Not specified"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground ml-6">License Plate:</span>
                            <span className="font-medium">{assignedTruck.licensePlate || assignedTruck.registrationNumber || "—"}</span>
                          </div>
                          {(assignedTruck.manufacturer || assignedTruck.model) && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground ml-6">Vehicle:</span>
                              <span className="font-medium">{[assignedTruck.manufacturer, assignedTruck.model].filter(Boolean).join(" ") || "—"}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No truck assigned yet</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Enterprise Details</p>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Company Name:</span>
                          <span className="font-medium">{request.carrier?.companyName || request.carrier?.username || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Location:</span>
                          <span className="font-medium">{(request.carrier as any)?.location || "Not specified"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-medium">{request.carrier?.phone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium">{(request.carrier as any)?.email || "—"}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Driver Details</p>
                      {assignedDriver ? (
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Driver Name:</span>
                            <span className="font-medium">{assignedDriver.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Driver Phone:</span>
                            <span className="font-medium">{assignedDriver.phone || "—"}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No driver assigned yet</p>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Truck Details</p>
                      {assignedTruck ? (
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Truck Type:</span>
                            <span className="font-medium">{assignedTruck.truckType || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Truck Location:</span>
                            <span className="font-medium">{(assignedTruck as any).truckLocation || "Not specified"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground ml-6">License Plate:</span>
                            <span className="font-medium">{assignedTruck.licensePlate || assignedTruck.registrationNumber || "—"}</span>
                          </div>
                          {(assignedTruck.manufacturer || assignedTruck.model) && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground ml-6">Vehicle:</span>
                              <span className="font-medium">{[assignedTruck.manufacturer, assignedTruck.model].filter(Boolean).join(" ") || "—"}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No truck assigned yet</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Separator className="my-2" />
            </CollapsibleContent>
            
            <div className="flex items-center justify-between pt-2 border-t gap-2 sm:gap-4 flex-wrap">
              <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Requested:</span>{" "}
                  {request.requestedAt 
                    ? format(new Date(request.requestedAt), "MMM d, yyyy 'at' h:mm a")
                    : "—"}
                </div>
                <div>
                  <span className="font-medium">Approved:</span>{" "}
                  {request.processedAt 
                    ? format(new Date(request.processedAt), "MMM d, yyyy 'at' h:mm a")
                    : "—"}
                </div>
                {request.approvedBy && (
                  <div>
                    <span className="font-medium">By:</span> {request.approvedBy.username}
                  </div>
                )}
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onRegenerate(request.id)}
                data-testid={`button-regenerate-${request.id}`}
                className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
              >
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Regenerate OTP
              </Button>
            </div>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

export default function AdminOtpQueue() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("pending");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<OtpRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [validityMinutes, setValidityMinutes] = useState(10);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [showOtpDialog, setShowOtpDialog] = useState(false);

  const { data: requests, isLoading, refetch, isFetching } = useOtpRequests();
  const approveMutation = useApproveOtpRequest();
  const rejectMutation = useRejectOtpRequest();
  const regenerateMutation = useRegenerateOtpRequest();

  const handleRefreshQueue = async () => {
    try {
      const r = await refetch();
      if (r.error) {
        throw r.error instanceof Error ? r.error : new Error(String(r.error));
      }
      toast({
        title: "Queue updated",
        description: `${r.data?.length ?? 0} OTP request(s) loaded.`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Refresh failed";
      toast({
        title: "Refresh failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const pendingRequests = (requests || []).filter(r => r.status === "pending");
  const approvedRequests = (requests || []).filter(r => r.status === "approved");
  const rejectedRequests = (requests || []).filter(r => r.status === "rejected");

  const handleApproveClick = (id: string) => {
    const request = requests?.find(r => r.id === id);
    if (request) {
      setSelectedRequest(request);
      setApproveDialogOpen(true);
    }
  };

  const handleRejectClick = (id: string) => {
    const request = requests?.find(r => r.id === id);
    if (request) {
      setSelectedRequest(request);
      setRejectNotes("");
      setRejectDialogOpen(true);
    }
  };

  const handleApproveConfirm = async () => {
    if (!selectedRequest) return;
    
    try {
      const result = await approveMutation.mutateAsync({
        requestId: selectedRequest.id,
        validityMinutes,
      });
      
      setApproveDialogOpen(false);
      setGeneratedOtp(result.otp.code);
      setShowOtpDialog(true);
      
      toast({
        title: "OTP Generated",
        description: "Share this OTP with the carrier via phone or message.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest) return;
    
    try {
      await rejectMutation.mutateAsync({
        requestId: selectedRequest.id,
        notes: rejectNotes,
      });
      
      setRejectDialogOpen(false);
      toast({
        title: "Request Rejected",
        description: "The carrier has been notified.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    }
  };

  const handleRegenerateClick = async (id: string) => {
    const request = requests?.find(r => r.id === id);
    if (!request) return;
    
    try {
      console.log("[Admin OTP] Regenerate clicked", {
        requestId: id,
        shipmentId: request.shipmentId,
        carrierId: request.carrierId,
      });

      const result = await regenerateMutation.mutateAsync({
        requestId: id,
        validityMinutes: 10,
      });
      
      setGeneratedOtp(result.otp.code);
      setShowOtpDialog(true);
      
      toast({
        title: "OTP Regenerated",
        description: "A new OTP has been sent directly to the carrier.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate OTP",
        variant: "destructive",
      });
      console.error("[Admin OTP] Regenerate error", error);
    }
  };

  const copyOtpToClipboard = () => {
    if (generatedOtp) {
      navigator.clipboard.writeText(generatedOtp);
      toast({
        title: "Copied",
        description: "OTP copied to clipboard",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Key className="h-5 w-5 sm:h-6 sm:w-6" />
            OTP Request Queue
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Review and approve carrier OTP requests for trip actions
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => void handleRefreshQueue()}
          disabled={isFetching}
          data-testid="button-refresh-otp"
          className="h-8 sm:h-9"
        >
          <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isFetching ? "animate-spin" : ""}`} />
          <span className="text-xs sm:text-sm">Refresh</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Horizontal scrollable tabs with HIDDEN scrollbar */}
        <div className="relative overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0 mb-4">
          <TabsList className="inline-flex min-w-max">
            <TabsTrigger value="pending" data-testid="tab-pending" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              Pending
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 sm:ml-2 text-[10px] sm:text-xs px-1 sm:px-1.5">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" data-testid="tab-approved" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" data-testid="tab-rejected" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              Rejected
            </TabsTrigger>
            <TabsTrigger value="empty-run" data-testid="tab-empty-run" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              Empty Run
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Pending Requests</h3>
                <p className="text-muted-foreground text-sm">
                  All OTP requests have been processed.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map(request => (
              <OtpRequestCard
                key={request.id}
                request={request}
                onApprove={handleApproveClick}
                onReject={handleRejectClick}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="approved">
          {approvedRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No approved requests yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Showing {approvedRequests.length} approved request{approvedRequests.length !== 1 ? 's' : ''}
              </p>
              {approvedRequests.map(request => (
                <ApprovedRequestCard key={request.id} request={request} onRegenerate={handleRegenerateClick} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected">
          {rejectedRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No rejected requests.</p>
              </CardContent>
            </Card>
          ) : (
            rejectedRequests.map(request => (
              <Card key={request.id} className="mb-3">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-red-500/10 text-red-600">
                        {request.requestType === "trip_start" ? "Trip Start" : "Trip End"}
                      </Badge>
                      <Badge variant="outline">{formatLoadId(request.load)}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {request.carrier?.companyName || request.carrier?.username}
                      </span>
                    </div>
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Rejected
                    </Badge>
                  </div>
                  {request.notes && (
                    <p className="text-sm text-muted-foreground mt-2">Reason: {request.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="empty-run">
          {(() => {
            // Dummy data for Empty Run requests
            const emptyRunRequests = [
              {
                id: "empty-run-1",
                carrierId: "carrier-1",
                driverName: "Rajesh Kumar",
                companyName: "Fast Logistics",
                phone: "+91-9876543210",
                truckType: "20ft Container",
                licensePlate: "DL-01-AB-1234",
                pickupCity: "New Delhi",
                dropoffCity: "Jaipur",
                deliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                requestedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
                reason: "Need to return to base for maintenance and refueling. Truck needs service check.",
                status: "pending",
              },
              {
                id: "empty-run-2",
                carrierId: "carrier-2",
                driverName: "Amit Singh",
                companyName: "Express Transport",
                phone: "+91-9876543211",
                truckType: "32ft Trailer",
                licensePlate: "HR-26-CD-5678",
                pickupCity: "Bangalore",
                dropoffCity: "Chennai",
                deliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
                reason: "Driver needs rest. Next load pickup is from Bangalore warehouse.",
                status: "pending",
              },
              {
                id: "empty-run-3",
                carrierId: "carrier-3",
                driverName: "Vikram Patel",
                companyName: "Prime Movers",
                phone: "+91-9876543212",
                truckType: "14ft Open",
                licensePlate: "GJ-05-EF-9012",
                pickupCity: "Mumbai",
                dropoffCity: "Pune",
                deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                requestedAt: new Date(Date.now() - 30 * 60 * 1000),
                reason: "Returning to home base. No loads available in current location.",
                status: "pending",
              },
            ];

            return (
              <>
                {emptyRunRequests.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No empty run requests.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Showing {emptyRunRequests.length} empty run request{emptyRunRequests.length !== 1 ? 's' : ''}
                    </p>
                    {emptyRunRequests.map(request => (
                      <Card key={request.id} className="mb-3" data-testid={`empty-run-card-${request.id}`}>
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-amber-500/10 text-amber-600">
                                  <Truck className="h-3 w-3 mr-1" />
                                  Empty Run
                                </Badge>
                                <Badge variant="outline" className="text-xs">{request.truckType}</Badge>
                                {request.status === "pending" && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pending
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {request.requestedAt ? formatDistanceToNow(request.requestedAt, { addSuffix: true }) : "Just now"}
                              </span>
                            </div>

                            <div className="space-y-2 pt-2 border-t">
                              <div className="grid grid-cols-1 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Driver:</span>
                                  <span className="font-medium">{request.driverName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Phone:</span>
                                  <span className="font-medium">{request.phone}</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t">
                              <div className="grid grid-cols-1 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <Truck className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">License Plate:</span>
                                  <span className="font-medium">{request.licensePlate}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Route:</span>
                                  <span className="font-medium">{request.pickupCity} → {request.dropoffCity}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Delivery Date:</span>
                                  <span className="font-medium">{format(request.deliveryDate, "MMM d, yyyy")}</span>
                                </div>
                              </div>
                            </div>

                            {request.reason && (
                              <div className="space-y-2 pt-2 border-t">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reason</p>
                                <p className="text-sm bg-muted/50 p-2 rounded-lg">{request.reason}</p>
                              </div>
                            )}

                            <div className="flex gap-2 pt-3 border-t flex-col sm:flex-row">
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  toast({ 
                                    title: "Empty Run Approved", 
                                    description: `Empty run request from ${request.driverName} has been approved.` 
                                  });
                                }}
                                data-testid={`button-approve-empty-run-${request.id}`}
                                className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
                              >
                                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => {
                                  toast({ 
                                    title: "Empty Run Rejected", 
                                    description: `Empty run request from ${request.driverName} has been rejected.` 
                                  });
                                }}
                                data-testid={`button-reject-empty-run-${request.id}`}
                                className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
                              >
                                <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] gap-0 p-0">
          <DialogHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 border-b">
            <DialogTitle className="text-base sm:text-lg">Approve OTP Request</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Generate a one-time password for the carrier to start or end their trip.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 px-3 sm:px-6 py-3 sm:py-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Carrier</Label>
              <p className="text-xs sm:text-sm font-medium">
                {selectedRequest?.carrier?.companyName || selectedRequest?.carrier?.username}
              </p>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Route</Label>
              <p className="text-xs sm:text-sm">
                {selectedRequest?.load?.pickupCity || "—"} → {selectedRequest?.load?.dropoffCity || (selectedRequest?.load as any)?.deliveryCity || "—"}
              </p>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="validity" className="text-xs sm:text-sm">OTP Validity (minutes)</Label>
              <Input
                id="validity"
                type="number"
                min={5}
                max={60}
                value={validityMinutes}
                onChange={(e) => setValidityMinutes(parseInt(e.target.value) || 10)}
                data-testid="input-validity-minutes"
                className="h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 px-3 sm:px-6 py-3 sm:py-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setApproveDialogOpen(false)}
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApproveConfirm} 
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
              ) : (
                <Key className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              )}
              Generate OTP
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] gap-0 p-0">
          <DialogHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 border-b">
            <DialogTitle className="text-base sm:text-lg">Reject OTP Request</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Provide a reason for rejecting this OTP request. The carrier will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 px-3 sm:px-6 py-3 sm:py-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="reject-notes" className="text-xs sm:text-sm">Reason (optional)</Label>
              <Textarea
                id="reject-notes"
                placeholder=""
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                data-testid="input-reject-notes"
                className="min-h-[80px] sm:min-h-[100px] text-xs sm:text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 px-3 sm:px-6 py-3 sm:py-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setRejectDialogOpen(false)}
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRejectConfirm} 
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
              ) : (
                <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              )}
              Reject Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="w-[95vw] max-w-[500px] gap-0 p-0">
          <DialogHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              OTP Generated Successfully
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Share this OTP with the carrier through a secure channel (phone call or SMS).
            </DialogDescription>
          </DialogHeader>
          <div className="px-3 sm:px-6 py-4 sm:py-6">
            <div className="bg-muted rounded-lg p-4 sm:p-6 text-center">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">One-Time Password</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold tracking-[0.3em] sm:tracking-[0.5em]" data-testid="text-generated-otp">
                {generatedOtp}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                Valid for {validityMinutes} minutes
              </p>
            </div>
            <div className="flex justify-center gap-2 mt-3 sm:mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyOtpToClipboard}
                className="h-8 sm:h-9 text-xs sm:text-sm"
              >
                <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Copy OTP
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border-t items-center">
            <div className="flex gap-1.5 sm:gap-2 text-muted-foreground text-xs sm:text-sm items-center order-2 sm:order-1">
              <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>Call or message the carrier to share this OTP</span>
            </div>
            <Button 
              onClick={() => setShowOtpDialog(false)} 
              data-testid="button-close-otp-dialog"
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm order-1 sm:order-2"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
