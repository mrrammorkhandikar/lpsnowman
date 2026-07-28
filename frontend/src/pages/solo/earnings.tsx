import { 
  IndianRupee, TrendingUp, Truck, Package, 
  Calendar, ChevronRight, Wallet
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface EarningsSummary {
  totalEarnings: number;
  thisMonth: number;
  lastMonth: number;
  tripsCompleted: number;
  pendingPayments: number;
}

interface Trip {
  id: string;
  loadId: string;
  status: string;
  completedAt: string | null;
  load?: {
    pickupCity: string;
    dropoffCity: string;
    finalPrice: string;
  };
}

export default function SoloEarnings() {
  const { data: tripsData, isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ["/api/shipments"],
  });

  const trips = tripsData || [];
  const completedTrips = trips.filter(t => t.status === "delivered");
  
  const totalEarnings = completedTrips.reduce((sum, trip) => {
    const price = parseFloat(trip.load?.finalPrice || "0");
    return sum + price;
  }, 0);

  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  
  const thisMonthEarnings = completedTrips.reduce((sum, trip) => {
    if (!trip.completedAt) return sum;
    const completedDate = new Date(trip.completedAt);
    if (completedDate.getMonth() === thisMonth && completedDate.getFullYear() === thisYear) {
      return sum + parseFloat(trip.load?.finalPrice || "0");
    }
    return sum;
  }, 0);

  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();

  const lastMonthEarnings = completedTrips.reduce((sum, trip) => {
    if (!trip.completedAt) return sum;
    const completedDate = new Date(trip.completedAt);
    if (completedDate.getMonth() === lastMonth && completedDate.getFullYear() === lastMonthYear) {
      return sum + parseFloat(trip.load?.finalPrice || "0");
    }
    return sum;
  }, 0);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-IN").format(amount);
  };

  const growthPercent = lastMonthEarnings > 0 
    ? ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings * 100).toFixed(1)
    : thisMonthEarnings > 0 ? "100" : "0";

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b bg-card sticky top-0 z-10">
        <h1 className="text-xl font-bold" data-testid="text-page-title">Earnings</h1>
        <p className="text-sm text-muted-foreground">Track your income and payments</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5" />
                <span className="text-sm opacity-90">Total Earnings</span>
              </div>
              {tripsLoading ? (
                <Skeleton className="h-10 w-48 bg-primary-foreground/20" />
              ) : (
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-8 w-8" />
                  <span className="text-4xl font-bold" data-testid="text-total-earnings">
                    {formatPrice(totalEarnings)}
                  </span>
                </div>
              )}
              <div className="mt-4 text-sm opacity-90">
                {completedTrips.length} trips completed
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">This Month</span>
                </div>
                {tripsLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <>
                    <div className="flex items-center gap-1 text-xl font-bold">
                      <IndianRupee className="h-4 w-4" />
                      {formatPrice(thisMonthEarnings)}
                    </div>
                    {parseFloat(growthPercent) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                        <TrendingUp className="h-3 w-3" />
                        +{growthPercent}%
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Last Month</span>
                </div>
                {tripsLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <div className="flex items-center gap-1 text-xl font-bold">
                    <IndianRupee className="h-4 w-4" />
                    {formatPrice(lastMonthEarnings)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Earnings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tripsLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : completedTrips.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No completed trips yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {completedTrips.slice(0, 10).map((trip) => (
                    <div 
                      key={trip.id} 
                      className="flex items-center justify-between p-4 hover-elevate"
                      data-testid={`earning-${trip.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {trip.load?.pickupCity} - {trip.load?.dropoffCity}
                        </div>
                        {trip.completedAt && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(trip.completedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 font-bold text-green-600">
                        <IndianRupee className="h-3.5 w-3.5" />
                        {formatPrice(parseFloat(trip.load?.finalPrice || "0"))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
