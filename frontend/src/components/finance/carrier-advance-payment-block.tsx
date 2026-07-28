import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, DollarSign, FileCheck } from "lucide-react";
import type { FinancePayoutSummary } from "@/lib/finance-payout-utils";

export interface CarrierAdvancePaymentStatusButtonsProps {
  reviewId: string;
  paymentStatus: string;
  advancePaymentReleasedAt: string | null;
  physicalPodSubmittedAt: string | null;
  invoicePaid?: boolean;
  isDelivered?: boolean;
  payoutSummary: FinancePayoutSummary;
  onAdvancePayment: () => void;
  onPaymentStatus: (status: string) => void;
  onPhysicalPod: () => void;
  advancePending?: boolean;
  paymentPending?: boolean;
  physicalPodPending?: boolean;
}

export function CarrierAdvancePaymentStatusButtons({
  reviewId,
  paymentStatus,
  advancePaymentReleasedAt,
  physicalPodSubmittedAt,
  invoicePaid,
  isDelivered = false,
  payoutSummary,
  onAdvancePayment,
  onPaymentStatus,
  onPhysicalPod,
  advancePending,
  paymentPending,
  physicalPodPending,
}: CarrierAdvancePaymentStatusButtonsProps) {
  const advanceReleased = !!advancePaymentReleasedAt;
  const { requiresAdvanceRelease } = payoutSummary;
  const paymentGateOpen = !requiresAdvanceRelease || advanceReleased;

  return (
    <div className="pt-2 border-t space-y-2">
      <p className="text-sm font-medium flex items-center gap-1">
        <DollarSign className="h-4 w-4" /> Payment Status
      </p>
      {requiresAdvanceRelease && !invoicePaid && (
        <p className="text-xs text-muted-foreground">
          Mark the shipper invoice as paid in Admin Invoices to enable advance payment.
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {requiresAdvanceRelease && (
          <Button
            size="sm"
            variant={advanceReleased ? "default" : "outline"}
            className={`flex-1 justify-center ${advanceReleased ? "bg-amber-700 hover:bg-amber-800 text-white" : ""}`}
            onClick={onAdvancePayment}
            disabled={advancePending || advanceReleased || !invoicePaid || !reviewId}
            data-testid="button-advance-payment"
          >
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            {advanceReleased ? "Advance Payment Released" : "Advance Payment"}
          </Button>
        )}
        <Button
          size="sm"
          variant={paymentStatus === "processing" ? "default" : "outline"}
          className="flex-1 justify-center"
          onClick={() => onPaymentStatus("processing")}
          disabled={paymentPending || !paymentGateOpen}
          data-testid="button-payment-processing"
        >
          <Clock className="h-3.5 w-3.5 mr-1" />
          Remaining Payment Processing
        </Button>
        <Button
          size="sm"
          variant={paymentStatus === "released" ? "default" : "outline"}
          className={`flex-1 justify-center ${paymentStatus === "released" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
          onClick={() => onPaymentStatus("released")}
          disabled={paymentPending || !paymentGateOpen}
          data-testid="button-payment-released"
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1" />
          Remaining Payment Released
        </Button>
      </div>
      <Button
        size="sm"
        className={`w-full mt-2 ${
          physicalPodSubmittedAt
            ? "bg-green-600 hover:bg-green-700 text-white"
            : isDelivered
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : ""
        }`}
        variant={!physicalPodSubmittedAt && !isDelivered ? "outline" : "default"}
        onClick={onPhysicalPod}
        disabled={physicalPodPending || !!physicalPodSubmittedAt || !isDelivered}
        data-testid="button-physical-pod-submitted"
        title={!isDelivered ? "Available after load is delivered" : undefined}
      >
        <FileCheck className="h-3.5 w-3.5 mr-1" />
        {physicalPodSubmittedAt
          ? "Physical POD Submitted"
          : isDelivered
            ? "Submit Physical POD"
            : "Submit Physical POD (Pending Delivery)"}
      </Button>
    </div>
  );
}
