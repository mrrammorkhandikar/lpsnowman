import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Truck, TrendingUp, DollarSign, Zap } from "lucide-react";

interface MyFleetPricingData {
  distance: number;
  monthlySalary: number;
  tripsPerMonth: number;
  proratedSalaryPerTrip: number;
  fuel: number;
  tolls: number;
  maintenance: number;
  miscellaneous: number;
  monthlyDepreciation: number;
  monthlyOverhead: number;
  proratedPerTrip: number;
  totalTripCost: number;
  costPerKm: number;
  shipperPrice: number;
  profitMarginPercent: number;
  netProfitLoss: number;
  notes: string;
}

interface MyFleetPricingCardProps {
  pricing: MyFleetPricingData;
  onUpdate: (updatedPricing: Partial<MyFleetPricingData>) => void;
}

export function MyFleetPricingCard({ pricing, onUpdate }: MyFleetPricingCardProps) {
  const totalTripCost =
    pricing.proratedSalaryPerTrip +
    pricing.fuel +
    pricing.tolls +
    pricing.maintenance +
    pricing.miscellaneous +
    pricing.proratedPerTrip;

  const costPerKm = pricing.distance > 0 ? totalTripCost / pricing.distance : 0;

  const handleInputChange = (field: keyof MyFleetPricingData, value: number) => {
    const updates: Partial<MyFleetPricingData> = { [field]: value };

    if (field === "monthlySalary" || field === "tripsPerMonth") {
      const salary = field === "monthlySalary" ? value : pricing.monthlySalary;
      const trips = field === "tripsPerMonth" ? value : pricing.tripsPerMonth;
      updates.proratedSalaryPerTrip = trips > 0 ? salary / trips : 0;
    }

    if (field === "monthlyDepreciation" || field === "monthlyOverhead") {
      const depreciation = field === "monthlyDepreciation" ? value : pricing.monthlyDepreciation;
      const overhead = field === "monthlyOverhead" ? value : pricing.monthlyOverhead;
      updates.proratedPerTrip = pricing.tripsPerMonth > 0 ? (depreciation + overhead) / pricing.tripsPerMonth : 0;
    }

    onUpdate(updates);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Truck className="h-4 w-4" /> My Fleet Pricing Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Trip Overview */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Distance</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{pricing.distance} KM</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Trips/Month</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{pricing.tripsPerMonth}</p>
          </div>
        </div>

        {/* Driver Cost Section */}
        <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-950/10 rounded-lg border border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400" />
            <p className="font-semibold text-xs uppercase tracking-wide text-amber-900 dark:text-amber-300">Driver Cost</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">Monthly Salary</span>
              <Input
                type="number"
                value={pricing.monthlySalary}
                onChange={(e) => handleInputChange("monthlySalary", parseFloat(e.target.value) || 0)}
                className="w-20 h-7 text-right text-xs"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">Trips Per Month</span>
              <Input
                type="number"
                value={pricing.tripsPerMonth}
                onChange={(e) => handleInputChange("tripsPerMonth", parseFloat(e.target.value) || 1)}
                className="w-20 h-7 text-right text-xs"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border border-amber-200 dark:border-amber-900/30">
              <span className="text-xs font-medium text-amber-900 dark:text-amber-300">Per Trip</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">₹{pricing.proratedSalaryPerTrip.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Trip Allowances Section */}
        <div className="space-y-3 p-3 bg-green-50 dark:bg-green-950/10 rounded-lg border border-green-200 dark:border-green-900/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400" />
            <p className="font-semibold text-xs uppercase tracking-wide text-green-900 dark:text-green-300">Trip Allowances</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Fuel", key: "fuel" as const },
              { label: "Tolls", key: "tolls" as const },
              { label: "Maintenance", key: "maintenance" as const },
              { label: "Misc", key: "miscellaneous" as const },
            ].map(({ label, key }) => (
              <div key={key} className="flex justify-between items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border border-green-200 dark:border-green-900/30">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Input
                  type="number"
                  value={pricing[key]}
                  onChange={(e) => handleInputChange(key, parseFloat(e.target.value) || 0)}
                  className="w-16 h-6 text-right text-xs"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Overhead & Depreciation Section */}
        <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/20 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400" />
            <p className="font-semibold text-xs uppercase tracking-wide text-slate-900 dark:text-slate-300">Overhead & Depreciation</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">Monthly Depreciation</span>
              <Input
                type="number"
                value={pricing.monthlyDepreciation}
                onChange={(e) => handleInputChange("monthlyDepreciation", parseFloat(e.target.value) || 0)}
                className="w-20 h-7 text-right text-xs"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-muted-foreground">Monthly Overhead</span>
              <Input
                type="number"
                value={pricing.monthlyOverhead}
                onChange={(e) => handleInputChange("monthlyOverhead", parseFloat(e.target.value) || 0)}
                className="w-20 h-7 text-right text-xs"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Per Trip</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">₹{pricing.proratedPerTrip.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Cost Summary - Key Metrics */}
        <div className="space-y-2 p-3 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg border border-blue-200 dark:border-blue-900/30">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <p className="font-semibold text-xs uppercase tracking-wide text-blue-900 dark:text-blue-300">Cost Analysis</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 rounded">
              <span className="text-xs font-medium">Total Trip Cost</span>
              <span className="font-bold text-blue-700 dark:text-blue-400">₹{totalTripCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 rounded">
              <span className="text-xs font-medium">Cost Per KM</span>
              <span className="font-bold text-cyan-700 dark:text-cyan-400">₹{costPerKm.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Pricing & Profitability */}
        <div className="space-y-2 p-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900/30">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="font-semibold text-xs uppercase tracking-wide text-emerald-900 dark:text-emerald-300">Profitability</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 rounded">
              <span className="text-xs font-medium">Shipper Price</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">₹{pricing.shipperPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 rounded">
              <span className="text-xs font-medium">Total Own Fleet Cost</span>
              <span className="font-bold text-orange-700 dark:text-orange-400">₹{totalTripCost.toLocaleString()}</span>
            </div>
            <div className={`flex justify-between items-center p-2 rounded ${pricing.netProfitLoss >= 0 ? "bg-green-100 dark:bg-green-950/30" : "bg-red-100 dark:bg-red-950/30"}`}>
              <span className="text-xs font-medium">Net Profit/Loss</span>
              <span className={`font-bold ${pricing.netProfitLoss >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                ₹{(pricing.shipperPrice - totalTripCost).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 rounded">
              <span className="text-xs font-medium">Margin %</span>
              <span className="font-bold text-teal-700 dark:text-teal-400">{totalTripCost > 0 ? (((pricing.shipperPrice - totalTripCost) / pricing.shipperPrice) * 100).toFixed(2) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {pricing.notes && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/10 rounded-lg border border-amber-200 dark:border-amber-900/30">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 mb-1">Notes</p>
            <p className="text-xs text-muted-foreground italic">{pricing.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
