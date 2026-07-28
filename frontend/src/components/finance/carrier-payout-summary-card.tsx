import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { shipmentPayoutSummary } from "@/lib/finance-payout-utils";

export interface CarrierPayoutSummaryShipment {
  load?: {
    adminFinalPrice?: string | null;
    finalPrice?: string | null;
    carrierAdvancePercent?: number | null;
    advancePaymentPercent?: number | null;
  } | null;
  settlement?: {
    grossAmount?: number;
    deductions?: number;
    deductionReason?: string | null;
  } | null;
  completedAt?: string | null;
  physicalPodSubmittedAt?: string | null;
  financeReview?: {
    advancePaymentReleasedAt?: string | null;
    paymentStatus?: string;
  } | null;
}

export function CarrierPayoutSummaryCard({ shipment }: { shipment: CarrierPayoutSummaryShipment }) {
  const adminFinalPrice = shipment.load?.adminFinalPrice
    ? parseFloat(shipment.load.adminFinalPrice)
    : 0;

  const summary = shipmentPayoutSummary(shipment);
  const { actualCarrierPayout, totalDeductions } = summary;
  const advanceReleased = !!shipment.financeReview?.advancePaymentReleasedAt;

  const platformMargin = adminFinalPrice - actualCarrierPayout;
  const platformMarginPercent =
    adminFinalPrice > 0 ? (platformMargin / adminFinalPrice) * 100 : 0;

  let tdsAmount = 0;
  let podPenalty = 0;

  if (shipment.settlement?.deductions) {
    // settlement override — line items not split
  } else {
    tdsAmount = actualCarrierPayout * 0.02;
    const podGracePeriodDays = 15;
    const podPenaltyRate = 100;
    const now = new Date();

    if (shipment.completedAt) {
      const completedDate = new Date(shipment.completedAt);
      const daysSinceCompletion = Math.floor(
        (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceCompletion > podGracePeriodDays) {
        if (shipment.physicalPodSubmittedAt) {
          const podSubmittedDate = new Date(shipment.physicalPodSubmittedAt);
          const daysUntilPodSubmitted = Math.floor(
            (podSubmittedDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntilPodSubmitted > podGracePeriodDays) {
            podPenalty = (daysUntilPodSubmitted - podGracePeriodDays) * podPenaltyRate;
          }
        } else {
          podPenalty = (daysSinceCompletion - podGracePeriodDays) * podPenaltyRate;
        }
      }
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Carrier Payout Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Total Carrier Payout (Before Deductions)</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                Rs. {actualCarrierPayout.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              (Admin Price: Rs. {adminFinalPrice.toFixed(2)} - Platform Margin{" "}
              {platformMarginPercent.toFixed(2)}%: Rs. {platformMargin.toFixed(2)})
            </div>
          </div>

          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 space-y-2">
            <h4 className="text-xs font-semibold text-red-700 dark:text-red-400">Deductions</h4>
            <div className="space-y-1 text-xs">
              {shipment.settlement?.deductionReason ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{shipment.settlement.deductionReason}</span>
                  <span className="text-red-600 font-medium">Rs. {totalDeductions.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TDS (2%)</span>
                    <span className={tdsAmount > 0 ? "text-red-600 font-medium" : ""}>
                      Rs. {tdsAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Halting Charges</span>
                    <span>Rs. 0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">POD Penalty</span>
                    <span className={podPenalty > 0 ? "text-red-600 font-medium" : ""}>
                      Rs. {podPenalty.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              <div className="border-t border-red-200 dark:border-red-800 pt-1 mt-1 flex justify-between font-semibold">
                <span>Total Deductions</span>
                <span className="text-red-600">Rs. {totalDeductions.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg border border-green-300 dark:border-green-700">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                Final Carrier Payout (After Deductions)
              </span>
              <span className="font-bold text-lg text-green-700 dark:text-green-400">
                Rs. {summary.finalCarrierPayout.toFixed(2)}
              </span>
            </div>
          </div>

          {summary.requiresAdvanceRelease && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  Advance Payment
                  {advanceReleased ? ` (${summary.carrierAdvancePercent}%)` : ""}
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  Rs. {(advanceReleased ? summary.advanceAmount : 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-300 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Remaining Amount to Be Paid</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Rs. {summary.totalAmountToBePaid.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg border border-emerald-300 dark:border-emerald-700">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total Amount Paid</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                Rs. {summary.totalAmountPaid.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
