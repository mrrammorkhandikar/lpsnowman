import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  MapPin,
  Package,
  Truck,
  Calendar,
  Fuel,
  TrendingUp,
  Send,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMockData } from "@/lib/mock-data-store";
import type { ExtendedCarrier } from "@/lib/carrier-data";

interface RequestQuotePanelProps {
  carrier: ExtendedCarrier | null;
  open: boolean;
  onClose: () => void;
}

function calculateEstimate(
  carrier: ExtendedCarrier,
  weight: number
): {
  baseRate: number;
  fuelSurcharge: number;
  carrierPremium: number;
  total: number;
} {
  const distance = 500 + Math.random() * 500;
  const baseRate = Math.round(distance * 1.5 + weight * 10);
  const fuelSurcharge = Math.round(baseRate * 0.15);
  const premiumFactor = carrier.extendedProfile.pricingFactor - 1;
  const carrierPremium = Math.round(baseRate * premiumFactor);
  const total = baseRate + fuelSurcharge + carrierPremium;

  return { baseRate, fuelSurcharge, carrierPremium, total };
}

export function RequestQuotePanel({ carrier, open, onClose }: RequestQuotePanelProps) {
  const { toast } = useToast();
  const { getActiveLoads, addBid, getOrCreateNegotiation, sendNegotiationMessage, addNotification } = useMockData();
  const activeLoads = getActiveLoads();
  
  const [selectedLoadId, setSelectedLoadId] = useState<string>("");
  const [preferredPickupTime, setPreferredPickupTime] = useState("");
  const [notes, setNotes] = useState("");
  const [counterOffer, setCounterOffer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!carrier) return null;

  const selectedLoad = activeLoads.find(l => l.loadId === selectedLoadId);
  
  const estimate = selectedLoad && carrier ? calculateEstimate(
    carrier,
    selectedLoad.weight
  ) : null;

  const handleSubmitQuote = async () => {
    if (!selectedLoad || !carrier) {
      toast({
        title: "Missing Information",
        description: "Please select a load to request a quote.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const finalAmount = counterOffer ? parseFloat(counterOffer) : estimate?.total || 0;
      
      const newBid = addBid({
        loadId: selectedLoad.loadId,
        carrierName: carrier.companyName || "Unknown Carrier",
        carrierId: carrier.id,
        bidPrice: finalAmount,
        eta: preferredPickupTime || "Within 24 hours",
        status: "Pending",
      });

      const thread = getOrCreateNegotiation(newBid.bidId, selectedLoad.loadId);
      
      if (thread) {
        const routeDisplay = `${selectedLoad.pickup} to ${selectedLoad.drop}`;
        
        setTimeout(() => {
          sendNegotiationMessage(
            thread.threadId,
            `Requesting quote for ${routeDisplay}. ${notes ? `Notes: ${notes}` : ""}`
          );
        }, 500);
      }

      addNotification({
        title: "Quote Request Sent",
        message: `Your quote request was sent to ${carrier.companyName} for load ${selectedLoad.loadId}`,
        type: "bid",
        loadId: selectedLoad.loadId,
      });

      toast({
        title: "Quote Request Submitted",
        description: `Your request has been sent to ${carrier.companyName}. Check Pending Bids for updates.`,
      });

      setSelectedLoadId("");
      setPreferredPickupTime("");
      setNotes("");
      setCounterOffer("");
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit quote request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Request Quote from {carrier.companyName}
              </DialogTitle>
              <DialogDescription>
                Select a load and get an instant price estimate
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="load-select">Select Load</Label>
                {activeLoads.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-center text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>No active loads available</p>
                      <p className="text-sm">Create a load first to request quotes</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Select value={selectedLoadId} onValueChange={setSelectedLoadId}>
                    <SelectTrigger data-testid="select-load">
                      <SelectValue placeholder="Choose a load..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeLoads.map((load) => (
                        <SelectItem key={load.loadId} value={load.loadId}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{load.loadId}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className="truncate">{load.pickup} to {load.drop}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedLoad && (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Load Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Route</p>
                            <p className="text-sm font-medium">{selectedLoad.pickup} to {selectedLoad.drop}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Truck Type</p>
                            <p className="text-sm font-medium">{selectedLoad.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Weight</p>
                            <p className="text-sm font-medium">{selectedLoad.weight} {selectedLoad.weightUnit}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Pickup</p>
                            <p className="text-sm font-medium">{selectedLoad.pickupDate}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {estimate && (
                    <Card className="border-primary/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Estimated Quote
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Base Rate</span>
                            <span className="font-medium">${estimate.baseRate.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Fuel className="h-3 w-3" /> Fuel Surcharge
                            </span>
                            <span className="font-medium">${estimate.fuelSurcharge.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Carrier {estimate.carrierPremium >= 0 ? "Premium" : "Discount"}
                            </span>
                            <span className={`font-medium ${estimate.carrierPremium < 0 ? "text-green-600" : ""}`}>
                              {estimate.carrierPremium >= 0 ? "+" : ""}${estimate.carrierPremium.toLocaleString()}
                            </span>
                          </div>
                          <div className="border-t pt-3 flex justify-between items-center">
                            <span className="font-semibold">Total Estimate</span>
                            <span className="text-xl font-bold text-primary">${estimate.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pickup-time">Preferred Pickup Time</Label>
                      <Input
                        id="pickup-time"
                        placeholder="e.g., Tomorrow 9:00 AM"
                        value={preferredPickupTime}
                        onChange={(e) => setPreferredPickupTime(e.target.value)}
                        data-testid="input-pickup-time"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="counter-offer">Counter Offer (optional)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="counter-offer"
                          type="number"
                          placeholder={estimate?.total.toString() || "Enter amount"}
                          value={counterOffer}
                          onChange={(e) => setCounterOffer(e.target.value)}
                          className="pl-8"
                          data-testid="input-counter-offer"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes to Carrier</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any special requirements or instructions..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        data-testid="input-notes"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  onClick={handleSubmitQuote} 
                  className="flex-1" 
                  disabled={!selectedLoad || isSubmitting}
                  data-testid="button-submit-quote"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Quote Request
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={onClose} data-testid="button-cancel-quote">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
