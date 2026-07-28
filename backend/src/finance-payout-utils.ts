/**
 * Finance review payout math. Keep in sync with frontend/src/lib/finance-payout-utils.ts
 */

export interface FinancePayoutDeductionInput {
  actualCarrierPayout: number;
  settlementDeductions?: number | null;
  completedAt?: string | Date | null;
  physicalPodSubmittedAt?: string | Date | null;
}

export interface FinancePayoutSummary {
  actualCarrierPayout: number;
  totalDeductions: number;
  finalCarrierPayout: number;
  carrierAdvancePercent: number;
  advanceAmount: number;
  totalAmountPaid: number;
  totalAmountToBePaid: number;
  requiresAdvanceRelease: boolean;
}

const TDS_RATE = 0.02;
const POD_GRACE_PERIOD_DAYS = 15;
const POD_PENALTY_RATE = 100;

export function calculateFinanceDeductions(input: FinancePayoutDeductionInput): number {
  if (input.settlementDeductions != null && input.settlementDeductions > 0) {
    return input.settlementDeductions;
  }

  const tdsAmount = input.actualCarrierPayout * TDS_RATE;
  let podPenalty = 0;

  if (input.completedAt) {
    const completedDate = new Date(input.completedAt);
    const now = new Date();
    const daysSinceCompletion = Math.floor(
      (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceCompletion > POD_GRACE_PERIOD_DAYS) {
      if (input.physicalPodSubmittedAt) {
        const podSubmittedDate = new Date(input.physicalPodSubmittedAt);
        const daysUntilPodSubmitted = Math.floor(
          (podSubmittedDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysUntilPodSubmitted > POD_GRACE_PERIOD_DAYS) {
          podPenalty = (daysUntilPodSubmitted - POD_GRACE_PERIOD_DAYS) * POD_PENALTY_RATE;
        }
      } else {
        podPenalty = (daysSinceCompletion - POD_GRACE_PERIOD_DAYS) * POD_PENALTY_RATE;
      }
    }
  }

  return tdsAmount + podPenalty;
}

export function buildFinancePayoutSummary(params: {
  actualCarrierPayout: number;
  carrierAdvancePercent: number;
  settlementDeductions?: number | null;
  completedAt?: string | Date | null;
  physicalPodSubmittedAt?: string | Date | null;
  advancePaymentReleasedAt?: string | Date | null;
  paymentStatus: string;
}): FinancePayoutSummary {
  const totalDeductions = calculateFinanceDeductions({
    actualCarrierPayout: params.actualCarrierPayout,
    settlementDeductions: params.settlementDeductions,
    completedAt: params.completedAt,
    physicalPodSubmittedAt: params.physicalPodSubmittedAt,
  });

  const finalCarrierPayout = params.actualCarrierPayout - totalDeductions;
  const pct = Math.max(0, Math.min(100, params.carrierAdvancePercent || 0));
  const advanceAmount =
    pct > 0 && params.actualCarrierPayout > 0
      ? Math.round(params.actualCarrierPayout * (pct / 100))
      : 0;
  const requiresAdvanceRelease = pct > 0 && advanceAmount > 0;

  const advanceReleased = !!params.advancePaymentReleasedAt;
  let totalAmountPaid = 0;

  if (params.paymentStatus === "released") {
    totalAmountPaid = finalCarrierPayout;
  } else if (advanceReleased && advanceAmount > 0) {
    totalAmountPaid = advanceAmount;
  }

  const totalAmountToBePaid = Math.max(0, finalCarrierPayout - totalAmountPaid);

  return {
    actualCarrierPayout: params.actualCarrierPayout,
    totalDeductions,
    finalCarrierPayout,
    carrierAdvancePercent: pct,
    advanceAmount,
    totalAmountPaid,
    totalAmountToBePaid,
    requiresAdvanceRelease,
  };
}

/** Advance % from loads table: carrier_advance_percent, else advance_payment_percent. */
export function resolveCarrierAdvancePercent(load?: {
  carrierAdvancePercent?: number | string | null;
  advancePaymentPercent?: number | string | null;
} | null): number {
  if (!load) return 0;
  const raw = load.carrierAdvancePercent ?? load.advancePaymentPercent;
  if (raw == null || raw === "") return 0;
  const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(100, n);
}

export function resolveActualCarrierPayout(
  settlementGrossAmount?: number | null,
  loadFinalPrice?: string | number | null,
): number {
  if (settlementGrossAmount != null && settlementGrossAmount > 0) {
    return settlementGrossAmount;
  }
  if (loadFinalPrice != null) {
    const n = typeof loadFinalPrice === "string" ? parseFloat(loadFinalPrice) : loadFinalPrice;
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
}
