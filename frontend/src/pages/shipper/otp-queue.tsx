import { useState } from "react";
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, Key, Truck, MapPin, Copy, Star, User, Award, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useShipperOtpRequests, useApproveOtpRequest, useRejectOtpRequest, type ShipperOtpRequest, invalidateShipperOtpRequests } from "@/lib/api-hooks";
import { formatDistanceToNow, format } from "date-fns";

function formatLoadId(load?: { adminReferenceNumber?: number | null }): string {
  if (load?.adminReferenceNumber) {
    return `LD-${load.adminReferenceNumber}`;
  }
  return "Unknown";
}

interface CarrierInfoCardProps {
  carrier: ShipperOtpRequest['carrier'];
}

function CarrierInfoCard({ carrier }: CarrierInfoCardProps) {
  if (!carrier) return null;
  
  const rating = parseFloat(carrier.rating || "4.5");
  
  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          {carrier.isSoloDriver ? (
            <User className="h-4 w-4 text-primary" />
          ) : (
            <Truck className="h-4 w-4 text-primary" />
          )}
          <span className="font-semibold">
            {carrier.isSoloDriver ? "Solo Driver" : "Enterprise Carrier"}
          </span>
        </div>
        
        {carrier.isSoloDriver ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Driver Name:</span>
              <span className="font-medium">{carrier.driverName || carrier.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rating:</span>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">{rating.toFixed(1)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Trip History:</span>
              <span className="font-medium">{carrier.totalDeliveries || 0} deliveries</span>
            </div>
            {carrier.truckNumber && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Truck Number:</span>
                <Badge variant="outline">{carrier.truckNumber}</Badge>
              </div>
            )}
            {carrier.badgeLevel && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Badge:</span>
                <Badge variant="secondary" className="capitalize">
                  <Award className="h-3 w-3 mr-1" />
                  {carrier.badgeLevel}
                </Badge>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Company:</span>
              <span className="font-medium">{carrier.companyName || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Driver:</span>
              <span className="font-medium">{carrier.driverName || carrier.username}</span>
            </div>
            {carrier.truckNumber && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Truck Number:</span>
                <Badge variant="outline">{carrier.truckNumber}</Badge>
              </div>
            )}
            {carrier.truckType && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Truck Type:</span>
                <span className="font-medium capitalize">{carrier.truckType}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface OtpRequestCardProps {
  request: ShipperOtpRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function OtpRequestCard({ request, onApprove, onReject }: OtpRequestCardProps) {
  const typeLabel = request.requestType === "trip_start" ? "Trip Start" : request.requestType === "trip_end" ? "Trip End" : "Registration";
  const typeColor = request.requestType === "trip_start" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  
  return (
    <Card className="mb-3" data-testid={`otp-request-card-${request.id}`}>
      <CardContent className="pt-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={typeColor}>{typeLabel}</Badge>
              <Badge variant="outline">{formatLoadId(request.load)}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              <Clock className="inline h-3 w-3 mr-1" />
              {request.requestedAt ? formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true }) : "Just now"}
            </span>
          </div>
          
          {request.load && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{request.load.pickupCity || "—"} → {request.load.deliveryCity || "—"}</span>
            </div>
          )}
          
          <CarrierInfoCard carrier={request.carrier} />
          
          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              onClick={() => onApprove(request.id)}
              data-testid={`button-approve-${request.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve & Generate OTP
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onReject(request.id)}
              data-testid={`button-reject-${request.id}`}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ShipperOtpQueue() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ShipperOtpRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [validityMinutes, setValidityMinutes] = useState(10);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [showOtpDialog, setShowOtpDialog] = useState(false);

  const { data: requests, isLoading, refetch } = useShipperOtpRequests();
  const approveMutation = useApproveOtpRequest();
  const rejectMutation = useRejectOtpRequest();

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
        description: "The OTP has been sent to the carrier via notification.",
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
    <div className="container py-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6" />
            OTP Verification
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Approve carrier OTP requests for your shipments
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          data-testid="button-refresh-otp"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            Rejected
          </TabsTrigger>
        </TabsList>

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
                <Card key={request.id} className="mb-3" data-testid={`approved-request-${request.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
                            {request.requestType === "trip_start" ? "Trip Start" : "Trip End"}
                          </Badge>
                          <Badge variant="outline">{formatLoadId(request.load)}</Badge>
                        </div>
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approved
                        </Badge>
                      </div>
                      
                      <CarrierInfoCard carrier={request.carrier} />
                      
                      <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground border-t">
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-red-500/10 text-red-600">
                          {request.requestType === "trip_start" ? "Trip Start" : "Trip End"}
                        </Badge>
                        <Badge variant="outline">{formatLoadId(request.load)}</Badge>
                      </div>
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Rejected
                      </Badge>
                    </div>
                    
                    <CarrierInfoCard carrier={request.carrier} />
                    
                    {request.notes && (
                      <p className="text-sm text-muted-foreground">Reason: {request.notes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve OTP Request</DialogTitle>
            <DialogDescription>
              Generate a one-time password for the carrier to start or end their trip.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedRequest?.carrier && (
              <CarrierInfoCard carrier={selectedRequest.carrier} />
            )}
            <div className="space-y-2">
              <Label>Route</Label>
              <p className="text-sm">
                {selectedRequest?.load?.pickupCity || "—"} → {selectedRequest?.load?.deliveryCity || "—"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="validity">OTP Validity (minutes)</Label>
              <Input
                id="validity"
                type="number"
                min={5}
                max={60}
                value={validityMinutes}
                onChange={(e) => setValidityMinutes(parseInt(e.target.value) || 10)}
                data-testid="input-validity-minutes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApproveConfirm} 
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Generate OTP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject OTP Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this OTP request. The carrier will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedRequest?.carrier && (
              <CarrierInfoCard carrier={selectedRequest.carrier} />
            )}
            <div className="space-y-2">
              <Label htmlFor="reject-notes">Reason (optional)</Label>
              <Textarea
                id="reject-notes"
                placeholder=""
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                data-testid="input-reject-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRejectConfirm} 
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              OTP Generated Successfully
            </DialogTitle>
            <DialogDescription>
              The OTP has been sent to the carrier via in-app notification.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="bg-muted rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">One-Time Password</p>
              <p className="text-4xl font-mono font-bold tracking-[0.5em]" data-testid="text-generated-otp">
                {generatedOtp}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Valid for {validityMinutes} minutes
              </p>
            </div>
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={copyOtpToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy OTP
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowOtpDialog(false)} data-testid="button-close-otp-dialog">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
