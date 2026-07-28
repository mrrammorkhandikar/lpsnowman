import { db } from "../db";
import { 
  users, 
  loads, 
  invoices, 
  shipperCreditProfiles, 
  shipperCreditEvaluations 
} from "@shared/schema";
import { eq, and, sql, desc, gte, lte, isNotNull } from "drizzle-orm";

interface CreditAssessmentResult {
  creditScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  suggestedCreditLimit: string;
  suggestedPaymentTerms: number;
  rationale: string;
  scoringBreakdown: {
    baseScore: number;
    paymentHistoryAdjustment: number;
    utilizationAdjustment: number;
    loadVolumeAdjustment: number;
    tenureAdjustment: number;
    details: {
      onTimePaymentRate: number;
      totalInvoices: number;
      paidInvoices: number;
      latePayments: number;
      creditUtilization: number;
      completedLoads: number;
      tenureMonths: number;
    };
  };
}

const SCORING_WEIGHTS = {
  BASE_SCORE: 500,
  PAYMENT_HISTORY_MAX: 250,
  UTILIZATION_MAX: 150,
  LOAD_VOLUME_MAX: 100,
  TENURE_MAX: 50,
};

const RISK_THRESHOLDS = {
  LOW: 750,
  MEDIUM: 600,
  HIGH: 450,
};

const DEFAULT_CREDIT_LIMITS = {
  low: "1000000",
  medium: "500000",
  high: "200000",
  critical: "50000",
};

const PAYMENT_TERMS_BY_RISK = {
  low: 45,
  medium: 30,
  high: 15,
  critical: 7,
};

function calculateRiskLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= RISK_THRESHOLDS.LOW) return "low";
  if (score >= RISK_THRESHOLDS.MEDIUM) return "medium";
  if (score >= RISK_THRESHOLDS.HIGH) return "high";
  return "critical";
}

export async function calculateAutoAssessment(shipperId: string): Promise<CreditAssessmentResult> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [shipper] = await db
    .select()
    .from(users)
    .where(eq(users.id, shipperId))
    .limit(1);

  if (!shipper) {
    throw new Error("Shipper not found");
  }

  const [existingProfile] = await db
    .select()
    .from(shipperCreditProfiles)
    .where(eq(shipperCreditProfiles.shipperId, shipperId))
    .limit(1);

  const shipperInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.shipperId, shipperId));

  const completedLoads = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loads)
    .where(
      and(
        eq(loads.shipperId, shipperId),
        eq(loads.status, "delivered")
      )
    );

  const recentLoads = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loads)
    .where(
      and(
        eq(loads.shipperId, shipperId),
        eq(loads.status, "delivered"),
        gte(loads.createdAt, ninetyDaysAgo)
      )
    );

  const totalInvoices = shipperInvoices.length;
  const paidInvoices = shipperInvoices.filter(inv => 
    inv.status === "paid" || inv.status === "completed"
  );
  
  let latePayments = 0;
  let onTimePayments = 0;
  
  for (const inv of paidInvoices) {
    if (inv.paidAt && inv.dueDate) {
      const paidDate = new Date(inv.paidAt);
      const dueDate = new Date(inv.dueDate);
      if (paidDate > dueDate) {
        latePayments++;
      } else {
        onTimePayments++;
      }
    } else {
      onTimePayments++;
    }
  }

  const onTimePaymentRate = paidInvoices.length > 0 
    ? (onTimePayments / paidInvoices.length) * 100 
    : 100;

  const currentOutstanding = existingProfile 
    ? parseFloat(String(existingProfile.outstandingBalance || 0))
    : 0;
  const currentLimit = existingProfile 
    ? parseFloat(String(existingProfile.creditLimit || 100000))
    : 100000;
  const creditUtilization = currentLimit > 0 
    ? (currentOutstanding / currentLimit) * 100 
    : 0;

  const totalCompletedLoads = completedLoads[0]?.count || 0;
  const recentLoadCount = recentLoads[0]?.count || 0;

  const createdAt = shipper.createdAt ? new Date(shipper.createdAt) : now;
  const tenureMonths = Math.floor((now.getTime() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));

  let paymentHistoryScore = 0;
  if (totalInvoices > 0) {
    paymentHistoryScore = (onTimePaymentRate / 100) * SCORING_WEIGHTS.PAYMENT_HISTORY_MAX;
    if (latePayments > 3) {
      paymentHistoryScore -= 50;
    }
  } else {
    paymentHistoryScore = SCORING_WEIGHTS.PAYMENT_HISTORY_MAX * 0.5;
  }

  let utilizationScore = 0;
  if (creditUtilization <= 30) {
    utilizationScore = SCORING_WEIGHTS.UTILIZATION_MAX;
  } else if (creditUtilization <= 50) {
    utilizationScore = SCORING_WEIGHTS.UTILIZATION_MAX * 0.8;
  } else if (creditUtilization <= 70) {
    utilizationScore = SCORING_WEIGHTS.UTILIZATION_MAX * 0.5;
  } else if (creditUtilization <= 90) {
    utilizationScore = SCORING_WEIGHTS.UTILIZATION_MAX * 0.2;
  } else {
    utilizationScore = -50;
  }

  let loadVolumeScore = 0;
  if (recentLoadCount >= 10) {
    loadVolumeScore = SCORING_WEIGHTS.LOAD_VOLUME_MAX;
  } else if (recentLoadCount >= 5) {
    loadVolumeScore = SCORING_WEIGHTS.LOAD_VOLUME_MAX * 0.7;
  } else if (recentLoadCount >= 2) {
    loadVolumeScore = SCORING_WEIGHTS.LOAD_VOLUME_MAX * 0.4;
  } else if (recentLoadCount >= 1) {
    loadVolumeScore = SCORING_WEIGHTS.LOAD_VOLUME_MAX * 0.2;
  }

  let tenureScore = 0;
  if (tenureMonths >= 24) {
    tenureScore = SCORING_WEIGHTS.TENURE_MAX;
  } else if (tenureMonths >= 12) {
    tenureScore = SCORING_WEIGHTS.TENURE_MAX * 0.7;
  } else if (tenureMonths >= 6) {
    tenureScore = SCORING_WEIGHTS.TENURE_MAX * 0.4;
  } else if (tenureMonths >= 3) {
    tenureScore = SCORING_WEIGHTS.TENURE_MAX * 0.2;
  }

  const totalScore = Math.max(0, Math.min(1000,
    SCORING_WEIGHTS.BASE_SCORE +
    paymentHistoryScore +
    utilizationScore +
    loadVolumeScore +
    tenureScore
  ));

  const riskLevel = calculateRiskLevel(totalScore);
  const suggestedCreditLimit = DEFAULT_CREDIT_LIMITS[riskLevel];
  const suggestedPaymentTerms = PAYMENT_TERMS_BY_RISK[riskLevel];

  const rationaleItems: string[] = [];
  
  if (totalInvoices === 0) {
    rationaleItems.push("New shipper with no payment history");
  } else {
    rationaleItems.push(`Payment history: ${onTimePaymentRate.toFixed(1)}% on-time rate (${onTimePayments}/${paidInvoices.length} invoices)`);
    if (latePayments > 0) {
      rationaleItems.push(`${latePayments} late payment(s) recorded`);
    }
  }
  
  rationaleItems.push(`Credit utilization: ${creditUtilization.toFixed(1)}%`);
  rationaleItems.push(`Load activity: ${recentLoadCount} loads in last 90 days, ${totalCompletedLoads} total completed`);
  rationaleItems.push(`Account tenure: ${tenureMonths} months`);
  rationaleItems.push(`Risk classification: ${riskLevel.toUpperCase()}`);

  return {
    creditScore: Math.round(totalScore),
    riskLevel,
    suggestedCreditLimit,
    suggestedPaymentTerms,
    rationale: rationaleItems.join(". "),
    scoringBreakdown: {
      baseScore: SCORING_WEIGHTS.BASE_SCORE,
      paymentHistoryAdjustment: Math.round(paymentHistoryScore),
      utilizationAdjustment: Math.round(utilizationScore),
      loadVolumeAdjustment: Math.round(loadVolumeScore),
      tenureAdjustment: Math.round(tenureScore),
      details: {
        onTimePaymentRate: Math.round(onTimePaymentRate * 100) / 100,
        totalInvoices,
        paidInvoices: paidInvoices.length,
        latePayments,
        creditUtilization: Math.round(creditUtilization * 100) / 100,
        completedLoads: totalCompletedLoads,
        tenureMonths,
      },
    },
  };
}

export async function runAutoAssessment(
  shipperId: string, 
  applyResults: boolean = false
): Promise<CreditAssessmentResult & { applied: boolean }> {
  const assessment = await calculateAutoAssessment(shipperId);
  
  const [existingProfile] = await db
    .select()
    .from(shipperCreditProfiles)
    .where(eq(shipperCreditProfiles.shipperId, shipperId))
    .limit(1);

  const now = new Date();

  if (existingProfile) {
    if (applyResults && !existingProfile.isManualOverride) {
      await db
        .update(shipperCreditProfiles)
        .set({
          creditScore: assessment.creditScore,
          riskLevel: assessment.riskLevel,
          creditLimit: assessment.suggestedCreditLimit,
          paymentTerms: assessment.suggestedPaymentTerms,
          lastAutoAssessmentAt: now,
          autoSuggestedScore: assessment.creditScore,
          autoSuggestedRiskLevel: assessment.riskLevel,
          autoSuggestedCreditLimit: assessment.suggestedCreditLimit,
          availableCredit: String(
            parseFloat(assessment.suggestedCreditLimit) - 
            parseFloat(String(existingProfile.outstandingBalance || 0))
          ),
          updatedAt: now,
        })
        .where(eq(shipperCreditProfiles.id, existingProfile.id));

      await db.insert(shipperCreditEvaluations).values({
        shipperId,
        evaluationType: "auto",
        previousCreditLimit: existingProfile.creditLimit,
        newCreditLimit: assessment.suggestedCreditLimit,
        previousRiskLevel: existingProfile.riskLevel,
        newRiskLevel: assessment.riskLevel,
        previousCreditScore: existingProfile.creditScore,
        newCreditScore: assessment.creditScore,
        previousPaymentTerms: existingProfile.paymentTerms,
        newPaymentTerms: assessment.suggestedPaymentTerms,
        decision: "auto_calculated",
        rationale: assessment.rationale,
        scoringBreakdown: JSON.stringify(assessment.scoringBreakdown),
      });

      return { ...assessment, applied: true };
    } else {
      await db
        .update(shipperCreditProfiles)
        .set({
          lastAutoAssessmentAt: now,
          autoSuggestedScore: assessment.creditScore,
          autoSuggestedRiskLevel: assessment.riskLevel,
          autoSuggestedCreditLimit: assessment.suggestedCreditLimit,
          updatedAt: now,
        })
        .where(eq(shipperCreditProfiles.id, existingProfile.id));

      return { ...assessment, applied: false };
    }
  } else {
    if (applyResults) {
      await db.insert(shipperCreditProfiles).values({
        shipperId,
        creditScore: assessment.creditScore,
        riskLevel: assessment.riskLevel,
        creditLimit: assessment.suggestedCreditLimit,
        paymentTerms: assessment.suggestedPaymentTerms,
        lastAutoAssessmentAt: now,
        autoSuggestedScore: assessment.creditScore,
        autoSuggestedRiskLevel: assessment.riskLevel,
        autoSuggestedCreditLimit: assessment.suggestedCreditLimit,
        availableCredit: assessment.suggestedCreditLimit,
        onTimePaymentRate: String(assessment.scoringBreakdown.details.onTimePaymentRate),
        totalLoadsCompleted: assessment.scoringBreakdown.details.completedLoads,
      });

      await db.insert(shipperCreditEvaluations).values({
        shipperId,
        evaluationType: "auto",
        newCreditLimit: assessment.suggestedCreditLimit,
        newRiskLevel: assessment.riskLevel,
        newCreditScore: assessment.creditScore,
        newPaymentTerms: assessment.suggestedPaymentTerms,
        decision: "auto_calculated",
        rationale: "Initial auto-assessment. " + assessment.rationale,
        scoringBreakdown: JSON.stringify(assessment.scoringBreakdown),
      });

      return { ...assessment, applied: true };
    }

    return { ...assessment, applied: false };
  }
}

export async function runBulkAutoAssessment(
  applyResults: boolean = false
): Promise<{ processed: number; applied: number; errors: number }> {
  const shippers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "shipper"));

  let processed = 0;
  let applied = 0;
  let errors = 0;

  for (const shipper of shippers) {
    try {
      const result = await runAutoAssessment(shipper.id, applyResults);
      processed++;
      if (result.applied) applied++;
    } catch (error) {
      console.error(`Error assessing shipper ${shipper.id}:`, error);
      errors++;
    }
  }

  return { processed, applied, errors };
}
