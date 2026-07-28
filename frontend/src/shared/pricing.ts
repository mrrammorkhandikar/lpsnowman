/**
 * Shared Pricing Calculator
 * 
 * Uses integer arithmetic (paise for amounts, basis points for percentages)
 * to ensure accuracy across frontend and backend calculations.
 * 
 * Invariant: grossPrice = carrierPayout + platformMargin (always)
 */

export interface PricingResult {
  grossPrice: number;           // What shipper pays (in rupees)
  platformMarginPercent: number; // Platform margin as percentage (supports decimals)
  platformMargin: number;        // Platform earnings in rupees
  carrierPayout: number;         // What carrier receives in rupees
  isValid: boolean;
  error?: string;
}

export interface CalculateFromMarginInput {
  grossPrice: number;
  platformMarginPercent: number;
}

export interface CalculateFromPayoutInput {
  grossPrice: number;
  carrierPayout: number;
}

const MIN_MARGIN_PERCENT = 0;
const MAX_MARGIN_PERCENT = 50;

/**
 * Calculate pricing from gross price and platform margin percentage
 * 
 * @param input - grossPrice and platformMarginPercent
 * @returns Complete pricing breakdown with carrier payout
 */
export function calculateFromMargin(input: CalculateFromMarginInput): PricingResult {
  const { grossPrice, platformMarginPercent } = input;

  // Validate inputs
  if (grossPrice < 0) {
    return {
      grossPrice: 0,
      platformMarginPercent: 0,
      platformMargin: 0,
      carrierPayout: 0,
      isValid: false,
      error: "Gross price cannot be negative"
    };
  }

  // Clamp margin percent to valid range
  const clampedMarginPercent = Math.min(MAX_MARGIN_PERCENT, Math.max(MIN_MARGIN_PERCENT, platformMarginPercent));

  // Calculate margin and payout using integer math for precision
  // Convert to paise (multiply by 100) for calculation, then back to rupees
  const grossPaise = Math.round(grossPrice * 100);
  const marginBasisPoints = Math.round(clampedMarginPercent * 100); // 10.5% = 1050 basis points
  
  const marginPaise = Math.round((grossPaise * marginBasisPoints) / 10000);
  const payoutPaise = grossPaise - marginPaise;

  // Convert back to rupees
  const platformMargin = marginPaise / 100;
  const carrierPayout = payoutPaise / 100;

  return {
    grossPrice,
    platformMarginPercent: clampedMarginPercent,
    platformMargin: Math.round(platformMargin), // Round to whole rupees for display
    carrierPayout: Math.round(carrierPayout),   // Round to whole rupees for display
    isValid: true
  };
}

/**
 * Calculate pricing from gross price and desired carrier payout
 * Derives the platform margin percentage from the difference
 * 
 * @param input - grossPrice and carrierPayout
 * @returns Complete pricing breakdown with derived margin percent
 */
export function calculateFromPayout(input: CalculateFromPayoutInput): PricingResult {
  const { grossPrice, carrierPayout } = input;

  // Validate inputs
  if (grossPrice <= 0) {
    return {
      grossPrice: 0,
      platformMarginPercent: 0,
      platformMargin: 0,
      carrierPayout: 0,
      isValid: false,
      error: "Gross price must be greater than 0"
    };
  }

  if (carrierPayout < 0) {
    return {
      grossPrice,
      platformMarginPercent: MAX_MARGIN_PERCENT,
      platformMargin: grossPrice,
      carrierPayout: 0,
      isValid: false,
      error: "Carrier payout cannot be negative"
    };
  }

  if (carrierPayout > grossPrice) {
    return {
      grossPrice,
      platformMarginPercent: 0,
      platformMargin: 0,
      carrierPayout: grossPrice,
      isValid: false,
      error: "Carrier payout cannot exceed gross price"
    };
  }

  // Calculate margin amount
  const platformMargin = grossPrice - carrierPayout;
  
  // Calculate margin percentage (with decimal precision)
  // margin% = (margin / gross) * 100
  const marginPercent = (platformMargin / grossPrice) * 100;
  
  // Round to 1 decimal place for clean display
  const roundedMarginPercent = Math.round(marginPercent * 10) / 10;

  // Clamp to valid range
  if (roundedMarginPercent > MAX_MARGIN_PERCENT) {
    return {
      grossPrice,
      platformMarginPercent: MAX_MARGIN_PERCENT,
      platformMargin: Math.round(grossPrice * (MAX_MARGIN_PERCENT / 100)),
      carrierPayout: Math.round(grossPrice * (1 - MAX_MARGIN_PERCENT / 100)),
      isValid: false,
      error: `Margin cannot exceed ${MAX_MARGIN_PERCENT}%`
    };
  }

  return {
    grossPrice,
    platformMarginPercent: roundedMarginPercent,
    platformMargin: Math.round(platformMargin),
    carrierPayout: Math.round(carrierPayout),
    isValid: true
  };
}

/**
 * Validate a complete pricing set
 * Ensures the invariant: grossPrice = carrierPayout + platformMargin
 */
export function validatePricing(
  grossPrice: number,
  platformMarginPercent: number,
  carrierPayout: number
): { isValid: boolean; error?: string; recalculated?: PricingResult } {
  if (grossPrice <= 0) {
    return { isValid: false, error: "Gross price must be greater than 0" };
  }

  if (platformMarginPercent < MIN_MARGIN_PERCENT || platformMarginPercent > MAX_MARGIN_PERCENT) {
    return { isValid: false, error: `Margin must be between ${MIN_MARGIN_PERCENT}% and ${MAX_MARGIN_PERCENT}%` };
  }

  if (carrierPayout < 0 || carrierPayout > grossPrice) {
    return { isValid: false, error: "Carrier payout must be between 0 and gross price" };
  }

  // Recalculate from margin to verify
  const calculated = calculateFromMargin({ grossPrice, platformMarginPercent });
  
  // Allow small rounding tolerance (1 rupee)
  const payoutDiff = Math.abs(calculated.carrierPayout - carrierPayout);
  if (payoutDiff > 1) {
    return {
      isValid: false,
      error: "Pricing values are inconsistent",
      recalculated: calculated
    };
  }

  return { isValid: true };
}

/**
 * Format rupees for display
 */
export function formatRupees(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}
