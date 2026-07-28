import { useState, useEffect } from "react";
import { Loader2, Key, CheckCircle, Clock, AlertCircle, PlayCircle, StopCircle, RefreshCw, Navigation, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  useRequestTripStartOtp, 
  useRequestTripEndOtp,
  useRequestRouteStartOtp,
  useVerifyOtp, 
  useOtpStatus,
  useIntutrackConsent,
  useIntutrackStartTrip,
  useIntutrackEndTrip,
  useUpdateLoad,
} from "@/lib/api-hooks";
import { geocodeAddress } from "@/lib/intutrack-api";
import type { IntutrackStartTripResponse } from "@/lib/intutrack-api";
import { useQuery } from "@tanstack/react-query";
import type { Shipment, Load } from "@shared/schema";
import { ShipperRatingDialog } from "./shipper-rating-dialog";

interface OtpStatusData {
  startOtpApproved?: boolean;
  routeStartOtpApproved?: boolean;
  endOtpApproved?: boolean;
  pendingStartRequest?: boolean;
  pendingRouteStartRequest?: boolean;
  pendingEndRequest?: boolean;
}

/** Normalize phone for IntuTrack: digits only, strip +91 prefix if present */
function normalizePhoneForConsent(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const digits = phone.trim().replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits || undefined;
}

/** Build a full address line for accurate geocoding: address, city, state pincode, India. */
function buildAddressForGeocode(
  primary: string | null | undefined,
  city: string | null | undefined,
  state?: string | null,
  pincode?: string | null
): string {
  const p = (primary ?? "").trim();
  const c = (city ?? "").trim();
  const s = (state ?? "").trim();
  const pin = (pincode ?? "").trim();
  const parts: string[] = [];
  if (p) parts.push(p);
  if (c && !p.toLowerCase().includes(c.toLowerCase())) parts.push(c);
  if (s) parts.push(pin ? `${s} ${pin}` : s);
  else if (pin) parts.push(pin);
  parts.push("India");
  return parts.join(", ") || "India";
}

const DEFAULT_START_COORDS: [number, number] = [18.587291, 73.819429];
const DEFAULT_END_COORDS: [number, number] = [18.680985, 74.127046];

/** IntuTrack public map URL for a given tripId (basic_cred is fixed). */
const INTRACK_MAP_BASIC_CRED = "VUNlQUpqRkwwWWZxSjQxZlFzbGNPQkJWQXNRU2h0cnZGZ0ZlZGJaQ1htcU5DdUkwTHNiOHBYaHNTR0hLTzhsRzo1OEFkcFNidlVsRUJ0b29vQ3hBVFJPRjZLTGNmY3dOcEJDcjZ0M1hKYnRoRWxSZnFlbHZPVzFkTlMxaWV2ZGNi";
function buildTriptrackMapUrl(tripId: string): string {
  return `https://sct.intutrack.com/#!/public?tripId=${encodeURIComponent(tripId)}&basic_cred=${INTRACK_MAP_BASIC_CRED}`;
}

/** Parse API error message (e.g. "500: {\"error\":\"...\",\"details\":\"...\"}") into a short user-facing string. */
function formatApiErrorMessage(message: string): string {
  const match = message.match(/^\d+\s*:\s*(\{.+\})$/s);
  if (match) {
    try {
      const body = JSON.parse(match[1]) as { error?: string; details?: string | Record<string, unknown> };
      const details = body.details;
      const detailStr =
        details == null
          ? undefined
          : typeof details === "string"
            ? details
            : typeof (details as { message?: string })?.message === "string"
              ? (details as { message: string }).message
              : JSON.stringify(details);
      const parts = [body.error, detailStr].filter(Boolean);
      return parts.join(" — ") || message;
    } catch {
      return message;
    }
  }
  return message;
}

interface OtpTripActionsProps {
  shipment: Shipment;
  loadStatus?: string;
  onStateChange?: () => void;
  /** Carrier (logged-in user) phone – used for IntuTrack consent when no driver assigned */
  carrierPhone?: string;
  /** Driver phone for this trip – preferred for IntuTrack consent when assigned */
  driverPhone?: string;
  /** Shipment documents to check for POD upload before trip end */
  shipmentDocuments?: Array<{ documentType: string; fileUrl?: string | null }>;
}

// Helper to check if a rating is pending for this shipment
const getRatingPendingKey = (shipmentId: string) => `rating_pending_${shipmentId}`;

export function OtpTripActions({ shipment, loadStatus, onStateChange, carrierPhone, driverPhone, shipmentDocuments = [] }: OtpTripActionsProps) {
  const { toast } = useToast();
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpType, setOtpType] = useState<"trip_start" | "route_start" | "trip_end">("trip_start");

  // Use driver phone for consent when assigned, otherwise carrier phone (carrier/driver mobile for IntuTrack)
  const consentPhone = normalizePhoneForConsent(driverPhone ?? carrierPhone);
  const { data: consentData } = useIntutrackConsent(consentPhone);
  
  const startTripMutation = useIntutrackStartTrip();
  const endTripMutation = useIntutrackEndTrip();
  const updateLoadMutation = useUpdateLoad();
  const [startTripResultDialogOpen, setStartTripResultDialogOpen] = useState(false);
  const [startTripResult, setStartTripResult] = useState<IntutrackStartTripResponse | null>(null);

  // Check if there's a pending rating for this shipment (survives component remounts)
  const [ratingDialogOpen, setRatingDialogOpen] = useState(() => {
    const pendingKey = getRatingPendingKey(shipment.id);
    return sessionStorage.getItem(pendingKey) === "true";
  });

  const { data: otpStatusRaw, refetch: refetchStatus } = useOtpStatus(shipment.id);
  
  // Always fetch load data to ensure shipperId is available for rating dialog
  const embeddedLoad = (shipment as any)?.load;
  const embeddedShipperId = embeddedLoad?.shipperId;
  
  const { data: loadData } = useQuery<Load>({
    queryKey: ["/api/loads", shipment.loadId],
    enabled: !!shipment.loadId, // Always fetch - don't skip based on embedded data
    staleTime: 60000,
  });

  // Fetch all invoices to check if the shipper has acknowledged the memo for this load
  // The most reliable signal is the load status — when shipper acknowledges, load transitions to
  // 'invoice_acknowledged' (or beyond: 'invoice_paid', 'in_transit', 'delivered').
  // We use loadData (already fetched above) for this check.
  const acknowledgedLoadStatuses = ['invoice_acknowledged', 'invoice_paid', 'in_transit', 'delivered', 'closed'];
  const isMemoAcknowledged = !!(
    loadData?.status && acknowledgedLoadStatuses.includes(loadData.status as string)
  );

  // State for "Memo Not Sent" blocking dialog
  const [memoBlockDialogOpen, setMemoBlockDialogOpen] = useState(false);

  // Check if POD (Proof of Delivery) has been uploaded
  const podDocument = shipmentDocuments?.find((doc: any) => doc.documentType === 'pod');
  const isPodUploaded = !!(podDocument?.fileUrl);

  // State for "POD Not Uploaded" blocking dialog
  const [podBlockDialogOpen, setPodBlockDialogOpen] = useState(false);

  // Use fetched load data first (more reliable), then embedded as fallback
  const effectiveShipperId = loadData?.shipperId || embeddedShipperId;

  const { data: shipperData } = useQuery<{ id: string; companyName: string | null; username: string }>({
    queryKey: ["/api/users", effectiveShipperId],
    enabled: !!effectiveShipperId,
  });
  
  // Effect to open rating dialog when shipperId becomes available after trip end
  useEffect(() => {
    const pendingKey = getRatingPendingKey(shipment.id);
    const hasPendingRating = sessionStorage.getItem(pendingKey) === "true";
    
    if (hasPendingRating && effectiveShipperId && !ratingDialogOpen) {
      setRatingDialogOpen(true);
    }
  }, [effectiveShipperId, shipment.id, ratingDialogOpen]);
  const otpStatus = otpStatusRaw as OtpStatusData | undefined;
  const requestStartMutation = useRequestTripStartOtp();
  const requestRouteStartMutation = useRequestRouteStartOtp();
  const requestEndMutation = useRequestTripEndOtp();
  const verifyMutation = useVerifyOtp();

  const canRequestStart = !shipment.startOtpVerified && !shipment.startOtpRequested;
  const hasStartPending = shipment.startOtpRequested && !shipment.startOtpVerified;
  const startApproved = otpStatus?.startOtpApproved && !shipment.startOtpVerified;

  const canRequestRouteStart = shipment.startOtpVerified && !(shipment as any).routeStartOtpVerified && !(shipment as any).routeStartOtpRequested;
  const hasRouteStartPending = (shipment as any).routeStartOtpRequested && !(shipment as any).routeStartOtpVerified;
  const routeStartApproved = otpStatus?.routeStartOtpApproved && !(shipment as any).routeStartOtpVerified;

  const canRequestEnd = (shipment as any).routeStartOtpVerified && !shipment.endOtpVerified && !shipment.endOtpRequested;
  const hasEndPending = shipment.endOtpRequested && !shipment.endOtpVerified;
  const endApproved = otpStatus?.endOtpApproved && !shipment.endOtpVerified;

  const handleRequestStart = async () => {
    // Gate: shipper must acknowledge the memo (invoice) before OTP can be requested
    if (!isMemoAcknowledged) {
      setMemoBlockDialogOpen(true);
      return;
    }
    try {
      await requestStartMutation.mutateAsync(shipment.id);
      toast({
        title: "OTP Requested",
        description: "Your trip start OTP request has been sent to admin for approval.",
      });
      refetchStatus();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request OTP",
        variant: "destructive",
      });
    }
  };

  const handleRequestRouteStart = async () => {
    const phone = consentPhone;
    if (!phone) {
      toast({
        title: "Phone required",
        description: "Driver or carrier phone is needed for tracking. Please set it in your profile or assign a driver.",
        variant: "destructive",
      });
      return;
    }

    const load = loadData;
    if (!load) {
      toast({
        title: "Load data required",
        description: "Unable to read load details. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const pickupLat = load.pickupLat != null ? Number(load.pickupLat) : NaN;
    const pickupLng = load.pickupLng != null ? Number(load.pickupLng) : NaN;
    const dropoffLat = load.dropoffLat != null ? Number(load.dropoffLat) : NaN;
    const dropoffLng = load.dropoffLng != null ? Number(load.dropoffLng) : NaN;

    let src: [string | number, string | number];
    let dest: [string | number, string | number];

    if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
      src = [String(pickupLat), String(pickupLng)];
    } else {
      const pickupStr = buildAddressForGeocode(
        load.pickupAddress,
        load.pickupCity,
        load.pickupState,
        load.pickupPincode
      );
      let pickupCoords = await geocodeAddress(pickupStr);
      if (!pickupCoords && load.pickupCity) {
        const withState = load.pickupState
          ? `${load.pickupCity}, ${load.pickupState}, India`
          : `${load.pickupCity}, India`;
        pickupCoords = await geocodeAddress(withState);
      }
      if (!pickupCoords && load.pickupCity) {
        pickupCoords = await geocodeAddress(`${load.pickupCity}, India`);
      }
      if (!pickupCoords) {
        pickupCoords = await geocodeAddress(load.pickupAddress ?? load.pickupCity ?? "India");
      }
      if (pickupCoords) {
        src = [pickupCoords.lat, pickupCoords.lng];
      } else {
        src = DEFAULT_START_COORDS;
        toast({
          title: "Using default start coordinates",
          description: `Could not resolve "${pickupStr}". Using default: ${DEFAULT_START_COORDS[0]}, ${DEFAULT_START_COORDS[1]}`,
          variant: "default",
        });
      }
    }

    if (Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)) {
      dest = [String(dropoffLat), String(dropoffLng)];
    } else {
      const dropoffStr = buildAddressForGeocode(
        load.dropoffAddress,
        load.dropoffCity,
        load.dropoffState,
        load.dropoffPincode
      );
      let dropoffCoords = await geocodeAddress(dropoffStr);
      if (!dropoffCoords && load.dropoffCity) {
        const withState = load.dropoffState
          ? `${load.dropoffCity}, ${load.dropoffState}, India`
          : `${load.dropoffCity}, India`;
        dropoffCoords = await geocodeAddress(withState);
      }
      if (!dropoffCoords && load.dropoffCity) {
        dropoffCoords = await geocodeAddress(`${load.dropoffCity}, India`);
      }
      if (!dropoffCoords) {
        dropoffCoords = await geocodeAddress(load.dropoffCity ?? load.dropoffAddress ?? "India");
      }
      if (dropoffCoords) {
        dest = [dropoffCoords.lat, dropoffCoords.lng];
      } else {
        dest = DEFAULT_END_COORDS;
        toast({
          title: "Using default end coordinates",
          description: `Could not resolve "${dropoffStr}". Using default: ${DEFAULT_END_COORDS[0]}, ${DEFAULT_END_COORDS[1]}`,
          variant: "default",
        });
      }
    }

    try {
      const result = await startTripMutation.mutateAsync({
        tel: phone,
        sim_no: phone,
        device: phone,
        src,
        dest,
        loadId: load.id, // backend stores triptrack_id in loads table on success
      });
      setStartTripResult(result);
      setStartTripResultDialogOpen(true);

      // Frontend also updates load so UI has trip link immediately (backend already stores when loadId sent)
      if (result.tripId && load.id) {
        try {
          await updateLoadMutation.mutateAsync({
            id: load.id,
            updates: {
              triptrackId: result.tripId,
              triptrackMap: buildTriptrackMapUrl(result.tripId),
            },
          });
        } catch (_e) {
          toast({
            title: "Trip started, save failed",
            description: "Updating the load with the trip link failed. You can still use the Trip ID from the dialog.",
            variant: "destructive",
          });
        }
      }

      await requestRouteStartMutation.mutateAsync(shipment.id);
      toast({
        title: "OTP Requested",
        description: "Your route start OTP request has been sent to admin for approval.",
      });
      refetchStatus();
    } catch (error: any) {
      const msg = error?.message || "Failed to start trip or request OTP";
      toast({
        title: "Error",
        description: formatApiErrorMessage(msg),
        variant: "destructive",
      });
    }
  };

  const handleRequestEnd = async () => {
    // Gate: POD must be uploaded before trip end OTP can be requested
    if (!isPodUploaded) {
      setPodBlockDialogOpen(true);
      return;
    }

    const load = loadData;
    if (!load?.id) {
      toast({
        title: "Load required",
        description: "Cannot end trip without load data.",
        variant: "destructive",
      });
      return;
    }
    // End trip: send loadId so backend gets latest triptrack_id from loads table
    try {
      await endTripMutation.mutateAsync({ loadId: load.id });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "IntuTrack end trip failed";
      toast({
        title: "End trip failed",
        description: formatApiErrorMessage(String(msg)),
        variant: "destructive",
      });
      return;
    }
    try {
      await requestEndMutation.mutateAsync(shipment.id);
      toast({
        title: "OTP Requested",
        description: "Your trip end OTP request has been sent to admin for approval.",
      });
      refetchStatus();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error instanceof Error ? error.message : "Failed to request OTP"),
        variant: "destructive",
      });
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid 6-digit OTP.",
        variant: "destructive",
      });
      return;
    }

    try {
      await verifyMutation.mutateAsync({
        shipmentId: shipment.id,
        otpCode,
        otpType,
      });
      const titles: Record<string, string> = {
        trip_start: "Trip Started",
        route_start: "Route Started",
        trip_end: "Trip Completed"
      };
      const descriptions: Record<string, string> = {
        trip_start: "Trip initialized. Now request Route Start OTP to begin transit.",
        route_start: "Your route is now in transit. GPS tracking activated.",
        trip_end: "Your delivery has been confirmed. Great job!"
      };
      toast({
        title: titles[otpType],
        description: descriptions[otpType],
      });
      setOtpDialogOpen(false);
      setOtpCode("");
      onStateChange?.();
      refetchStatus();
      
      if (otpType === "trip_end") {
        // Store rating pending state in sessionStorage to survive component remounts
        // This will show the rating dialog when shipperId becomes available
        const pendingKey = getRatingPendingKey(shipment.id);
        sessionStorage.setItem(pendingKey, "true");
        // Open dialog immediately if shipperId is available, or the effect will handle it
        if (effectiveShipperId) {
          setRatingDialogOpen(true);
        }
      }
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openOtpDialog = (type: "trip_start" | "route_start" | "trip_end") => {
    setOtpType(type);
    setOtpCode("");
    setOtpDialogOpen(true);
  };

  if (shipment.status === "delivered" || shipment.endOtpVerified) {
    return (
      <>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">Trip Completed</p>
                <p className="text-sm text-muted-foreground">Delivery confirmed via OTP verification</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {effectiveShipperId && (
          <ShipperRatingDialog
            open={ratingDialogOpen}
            onOpenChange={(open) => {
              setRatingDialogOpen(open);
              if (!open) {
                // Clear the pending state when dialog closes
                sessionStorage.removeItem(getRatingPendingKey(shipment.id));
              }
            }}
            shipmentId={shipment.id}
            loadId={shipment.loadId}
            shipperId={effectiveShipperId}
            shipperName={shipperData?.companyName || shipperData?.username || "Shipper"}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Memo Not Acknowledged blocking dialog */}
      <Dialog open={memoBlockDialogOpen} onOpenChange={setMemoBlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <FileWarning className="h-5 w-5" />
              Memo Not Acknowledged
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-2">
              <p>
                The shipper has not yet acknowledged the transaction memo (invoice) for this trip.
              </p>
              <p className="text-sm text-muted-foreground">
                Trip Start OTP can only be requested after the shipper acknowledges the memo. Please ask the shipper to review and acknowledge the memo before proceeding.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setMemoBlockDialogOpen(false)}>
              OK, Got It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POD Not Uploaded blocking dialog */}
      <Dialog open={podBlockDialogOpen} onOpenChange={setPodBlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <FileWarning className="h-5 w-5" />
              POD Upload Required
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-2">
              <p>
                Proof of Delivery (POD) must be uploaded before you can request Trip End OTP.
              </p>
              <p className="text-sm text-muted-foreground">
                Please upload the POD document (delivery receipt/signature) in the Documents section above, then try requesting the OTP again.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPodBlockDialogOpen(false)}>
              OK, Got It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card data-testid={`otp-card-${shipment.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">OTP Security Gate</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetchStatus()}
              data-testid="button-refresh-otp-status"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Request OTP approval from admin to start or end your trip
          </CardDescription>
          {consentPhone && consentData && (
            <p className="text-xs text-muted-foreground mt-2">
              Tracking consent (carrier/driver): <span className="font-medium">{consentData.consent ?? "—"}</span>
              {consentData.consent_suggestion && (
                <span className="block mt-1 text-muted-foreground">{consentData.consent_suggestion}</span>
              )}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                shipment.startOtpVerified 
                  ? "bg-green-100 dark:bg-green-900/30" 
                  : hasStartPending || startApproved
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-muted"
              }`}>
                {shipment.startOtpVerified ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : hasStartPending || startApproved ? (
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">Trip Start</p>
                <p className="text-xs text-muted-foreground">
                  {shipment.startOtpVerified 
                    ? "Verified - Trip in progress" 
                    : startApproved
                      ? "Approved - Enter OTP"
                      : hasStartPending 
                        ? "Pending admin approval" 
                        : "Request OTP to start"}
                </p>
              </div>
            </div>
            {canRequestStart && (
              <Button 
                size="sm" 
                onClick={handleRequestStart}
                disabled={requestStartMutation.isPending}
                data-testid="button-request-start-otp"
              >
                {requestStartMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Request OTP"
                )}
              </Button>
            )}
            {startApproved && (
              <Button 
                size="sm" 
                onClick={() => openOtpDialog("trip_start")}
                data-testid="button-enter-start-otp"
              >
                <Key className="h-4 w-4 mr-1" />
                Enter OTP
              </Button>
            )}
            {hasStartPending && !startApproved && (
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
            {shipment.startOtpVerified && (
              <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                (shipment as any).routeStartOtpVerified 
                  ? "bg-green-100 dark:bg-green-900/30" 
                  : hasRouteStartPending || routeStartApproved
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : !shipment.startOtpVerified
                      ? "bg-muted opacity-50"
                      : "bg-muted"
              }`}>
                {(shipment as any).routeStartOtpVerified ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : hasRouteStartPending || routeStartApproved ? (
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className={`font-medium text-sm ${!shipment.startOtpVerified ? "opacity-50" : ""}`}>
                  Route Start
                </p>
                <p className="text-xs text-muted-foreground">
                  {(shipment as any).routeStartOtpVerified 
                    ? "Verified - In transit" 
                    : routeStartApproved
                      ? "Approved - Enter OTP"
                      : hasRouteStartPending 
                        ? "Pending admin approval" 
                        : !shipment.startOtpVerified
                          ? "Complete trip start first"
                          : "Request OTP to begin route"}
                </p>
              </div>
            </div>
            {canRequestRouteStart && (
              <Button 
                size="sm" 
                onClick={handleRequestRouteStart}
                disabled={requestRouteStartMutation.isPending || startTripMutation.isPending}
                data-testid="button-request-route-start-otp"
              >
                {requestRouteStartMutation.isPending || startTripMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Request OTP"
                )}
              </Button>
            )}
            {routeStartApproved && (
              <Button 
                size="sm" 
                onClick={() => openOtpDialog("route_start")}
                data-testid="button-enter-route-start-otp"
              >
                <Key className="h-4 w-4 mr-1" />
                Enter OTP
              </Button>
            )}
            {hasRouteStartPending && !routeStartApproved && (
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
            {!shipment.startOtpVerified && (
              <Badge variant="outline" className="opacity-50">
                <AlertCircle className="h-3 w-3 mr-1" />
                Locked
              </Badge>
            )}
            {(shipment as any).routeStartOtpVerified && (
              <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                shipment.endOtpVerified 
                  ? "bg-green-100 dark:bg-green-900/30" 
                  : hasEndPending || endApproved
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : !(shipment as any).routeStartOtpVerified
                      ? "bg-muted opacity-50"
                      : "bg-muted"
              }`}>
                {shipment.endOtpVerified ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : hasEndPending || endApproved ? (
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <StopCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className={`font-medium text-sm ${!(shipment as any).routeStartOtpVerified ? "opacity-50" : ""}`}>
                  Trip End
                </p>
                <p className="text-xs text-muted-foreground">
                  {shipment.endOtpVerified 
                    ? "Verified - Delivery complete" 
                    : endApproved
                      ? "Approved - Enter OTP"
                      : hasEndPending 
                        ? "Pending admin approval" 
                        : !(shipment as any).routeStartOtpVerified
                          ? "Start route first"
                          : "Request OTP to complete"}
                </p>
              </div>
            </div>
            {canRequestEnd && (
              <Button 
                size="sm" 
                onClick={handleRequestEnd}
                disabled={requestEndMutation.isPending || endTripMutation.isPending}
                data-testid="button-request-end-otp"
              >
                {requestEndMutation.isPending || endTripMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Request OTP"
                )}
              </Button>
            )}
            {endApproved && (
              <Button 
                size="sm" 
                onClick={() => openOtpDialog("trip_end")}
                data-testid="button-enter-end-otp"
              >
                <Key className="h-4 w-4 mr-1" />
                Enter OTP
              </Button>
            )}
            {hasEndPending && !endApproved && (
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
            {!(shipment as any).routeStartOtpVerified && (
              <Badge variant="outline" className="opacity-50">
                <AlertCircle className="h-3 w-3 mr-1" />
                Locked
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {otpType === "trip_start" ? "Start Trip - Enter OTP" : otpType === "route_start" ? "Start Route - Enter OTP" : "Complete Trip - Enter OTP"}
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit OTP provided by admin to{" "}
              {otpType === "trip_start" ? "start your trip" : otpType === "route_start" ? "begin your route" : "confirm delivery"}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Label htmlFor="otp-input" className="mb-2 block">One-Time Password</Label>
            <Input
              id="otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              data-testid="input-otp-code"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleVerifyOtp}
              disabled={verifyMutation.isPending || otpCode.length !== 6}
              data-testid="button-verify-otp"
            >
              {verifyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {otpType === "trip_start" ? "Start Trip" : "Complete Delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={startTripResultDialogOpen} onOpenChange={(open) => { setStartTripResultDialogOpen(open); if (!open) setStartTripResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Trip (IntuTrack)</DialogTitle>
            <DialogDescription>
              Trip was started with carrier/driver phone and pickup/drop coordinates. Result below.
            </DialogDescription>
          </DialogHeader>
          {startTripResult && (
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium">Trip ID: <span className="font-mono text-primary">{startTripResult.tripId}</span></p>
              {startTripResult.msg && <p className="text-sm text-muted-foreground">{startTripResult.msg}</p>}
              {startTripResult.consentResults && startTripResult.consentResults.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consent</p>
                  {startTripResult.consentResults.map((c, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{c.number ?? "—"}</span>
                      <span className="mx-2">·</span>
                      <span>{c.consent ?? "—"}</span>
                      {c.consent_suggestion && <p className="text-xs text-muted-foreground mt-1">{c.consent_suggestion}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setStartTripResultDialogOpen(false); setStartTripResult(null); }}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {effectiveShipperId && (
        <ShipperRatingDialog
          open={ratingDialogOpen}
          onOpenChange={(open) => {
            setRatingDialogOpen(open);
            if (!open) {
              // Clear the pending state when dialog closes
              sessionStorage.removeItem(getRatingPendingKey(shipment.id));
            }
          }}
          shipmentId={shipment.id}
          loadId={shipment.loadId}
          shipperId={effectiveShipperId}
          shipperName={shipperData?.companyName || shipperData?.username || "Shipper"}
        />
      )}
    </>
  );
}
