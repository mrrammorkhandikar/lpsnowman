import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Star,
  Shield,
  Truck,
  MapPin,
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileText,
  Phone,
  MessageSquare,
  Heart,
  Package,
  Award,
  Users,
  ThumbsUp,
  Timer,
  Route,
} from "lucide-react";
import type { ExtendedCarrier, FleetBreakdown, CarrierDocument } from "@/lib/carrier-data";

interface CarrierProfileModalProps {
  carrier: ExtendedCarrier | null;
  open: boolean;
  onClose: () => void;
  onRequestQuote: () => void;
}

function getBadgeInfo(level: string | null | undefined) {
  switch (level) {
    case "platinum":
      return { label: "Platinum", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" };
    case "gold":
      return { label: "Gold", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    case "silver":
      return { label: "Silver", className: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300" };
    default:
      return { label: "Bronze", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
  }
}

export function CarrierProfileModal({ carrier, open, onClose, onRequestQuote }: CarrierProfileModalProps) {
  if (!carrier) return null;

  const profile = carrier.carrierProfile;
  const badgeInfo = getBadgeInfo(profile?.badgeLevel);
  
  const avgRating = profile 
    ? ((Number(profile.reliabilityScore) + Number(profile.communicationScore) + Number(profile.onTimeScore)) / 3).toFixed(1)
    : "0.0";

  const extended = carrier.extendedProfile;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader className="mb-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {carrier.companyName?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <DialogTitle className="text-xl">{carrier.companyName}</DialogTitle>
                    <Badge className={`${badgeInfo.className} no-default-hover-elevate no-default-active-elevate`}>
                      <Award className="h-3 w-3 mr-1" />
                      {badgeInfo.label}
                    </Badge>
                    {carrier.isVerified && (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-500 fill-current" />
                      {avgRating} rating
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      {profile?.fleetSize || 1} trucks
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {profile?.totalDeliveries || 0} deliveries
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {extended?.yearsInOperation || 1} years
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="fleet" data-testid="tab-fleet">Fleet & Capacity</TabsTrigger>
                <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
                <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Service Zones
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {profile?.serviceZones?.map((zone: string) => (
                          <Badge key={zone} variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                            {zone}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Route className="h-4 w-4" />
                        Preferred Routes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {extended?.preferredRoutes?.map((route: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                            {route}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">About</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{profile?.bio}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
                        <Star className="h-5 w-5 fill-current" />
                        <span className="text-xl font-bold">{profile?.reliabilityScore}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Reliability</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-500 mb-1">
                        <MessageSquare className="h-5 w-5" />
                        <span className="text-xl font-bold">{profile?.communicationScore}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Communication</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
                        <Clock className="h-5 w-5" />
                        <span className="text-xl font-bold">{profile?.onTimeScore}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">On-Time</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-purple-500 mb-1">
                        <Shield className="h-5 w-5" />
                        <span className="text-xl font-bold">{extended?.safetyScore || 95}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Safety</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="fleet" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Fleet Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {extended?.fleetBreakdown?.map((item: FleetBreakdown, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{item.type}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24">
                              <Progress value={(item.count / (profile?.fleetSize || 1)) * 100} className="h-2" />
                            </div>
                            <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Timer className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Avg Delivery Time</span>
                      </div>
                      <p className="text-2xl font-bold">{extended?.avgDeliveryTime || "24-48h"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Response Time</span>
                      </div>
                      <p className="text-2xl font-bold">{extended?.responseTime || "< 2 hours"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Monthly Capacity</span>
                      </div>
                      <p className="text-2xl font-bold">{extended?.monthlyCapacity || 50} loads</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Performance Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>On-Time Delivery</span>
                          <span className="font-medium">{extended?.onTimeDeliveryPct || 94}%</span>
                        </div>
                        <Progress value={extended?.onTimeDeliveryPct || 94} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Communication Rating</span>
                          <span className="font-medium">{extended?.communicationRating || 92}%</span>
                        </div>
                        <Progress value={extended?.communicationRating || 92} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Damage-Free Deliveries</span>
                          <span className="font-medium">{100 - (extended?.damageClaimRate || 0.5)}%</span>
                        </div>
                        <Progress value={100 - (extended?.damageClaimRate || 0.5)} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Risk Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="text-sm">Damage Claim Rate</span>
                        <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                          {extended?.damageClaimRate || 0.5}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="text-sm">Cancellation Rate</span>
                        <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                          {extended?.cancellationRate || 1.2}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="text-sm">Safety Score</span>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate">
                          {extended?.safetyScore || 95}/100
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Compliance Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {extended?.documents?.map((doc: CarrierDocument, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">Expires: {doc.expiry}</p>
                            </div>
                          </div>
                          <Badge 
                            className={`no-default-hover-elevate no-default-active-elevate ${
                              doc.status === "verified" 
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}
                          >
                            {doc.status === "verified" ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Verified</>
                            ) : (
                              <><Clock className="h-3 w-3 mr-1" /> Pending</>
                            )}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Driver Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">Active Drivers</p>
                        <p className="text-xs text-muted-foreground">All with valid licenses</p>
                      </div>
                      <span className="text-xl font-bold">{extended?.activeDrivers || profile?.fleetSize || 1}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t">
              <Button onClick={onRequestQuote} className="flex-1" data-testid="button-request-quote-modal">
                Request Quote
              </Button>
              <Button variant="outline" size="icon" data-testid="button-add-favorite">
                <Heart className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" data-testid="button-contact-carrier">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={onClose} data-testid="button-close-profile">
                Close
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
