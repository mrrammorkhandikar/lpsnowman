import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { financeReviewStatuses, financePaymentStatuses } from "@shared/schema";
import {
  buildFinancePayoutSummary,
  resolveActualCarrierPayout,
  resolveCarrierAdvancePercent,
} from "./finance-payout-utils";

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const financeReviewStatusSchema = z.enum(
  financeReviewStatuses as unknown as [string, ...string[]],
);
const financePaymentStatusSchema = z.enum(
  financePaymentStatuses as unknown as [string, ...string[]],
);

async function isLoadInvoicePaid(loadId: string): Promise<boolean> {
  const invoice = await storage.getInvoiceByLoad(loadId);
  return invoice?.status === "paid" || !!invoice?.paidAt;
}

async function loadRequiresAdvanceRelease(loadId: string): Promise<boolean> {
  const load = await storage.getLoad(loadId);
  if (!load) return false;
  const pct = resolveCarrierAdvancePercent(load);
  if (pct <= 0) return false;

  const settlement = await storage.getSettlementByLoad(loadId);
  const actualCarrierPayout = resolveActualCarrierPayout(
    settlement?.grossAmount ? parseFloat(settlement.grossAmount.toString()) : null,
    load.finalPrice,
  );
  const summary = buildFinancePayoutSummary({
    actualCarrierPayout,
    carrierAdvancePercent: pct,
    paymentStatus: "not_released",
  });
  return summary.requiresAdvanceRelease;
}

/**
 * Finance document review API (admin). Registered early so tsx watch reliably reloads.
 */
export function registerFinanceReviewRoutes(app: Express): void {
  app.get("/api/finance/reviews/all", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const reviews = await storage.getAllFinanceReviews();

      // Enrich each review with shipment fields needed for accurate payout calculation
      const enriched = await Promise.all(
        reviews.map(async (review) => {
          const [shipment, settlement] = await Promise.all([
            storage.getShipment(review.shipmentId),
            storage.getSettlementByLoad(review.loadId),
          ]);
          return {
            ...review,
            physicalPodSubmittedAt: shipment?.physicalPodSubmittedAt ?? null,
            completedAt: shipment?.completedAt ?? null,
            settlementDeductions: settlement?.deductions ?? null,
          };
        })
      );

      res.json(enriched);
    } catch (error) {
      console.error("Get all finance reviews error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/finance/reviews", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const parsed = z
        .object({
          shipmentId: z.string().min(1),
          loadId: z.string().min(1),
          status: financeReviewStatusSchema,
          comment: z.string().optional(),
          paymentStatus: financePaymentStatusSchema.optional(),
        })
        .safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const { shipmentId, loadId: bodyLoadId, status, comment, paymentStatus: bodyPayment } =
        parsed.data;

      const shipment = await storage.getShipment(shipmentId);
      if (!shipment) {
        return res.status(404).json({ error: "Shipment not found" });
      }
      if (shipment.loadId !== bodyLoadId) {
        return res.status(400).json({ error: "loadId does not match shipment" });
      }

      const load = await storage.getLoad(shipment.loadId);
      if (!load) {
        return res.status(404).json({ error: "Load not found" });
      }

      const existing = await storage.getFinanceReviewByShipment(shipmentId);
      const commentVal = comment?.trim() ? comment.trim() : null;
      const now = new Date();

      if (existing) {
        const updated = await storage.updateFinanceReview(existing.id, {
          status,
          comment: commentVal,
          reviewerId: user.id,
          reviewedAt: now,
          ...(bodyPayment !== undefined ? { paymentStatus: bodyPayment } : {}),
        });
        return res.json(updated);
      }

      const created = await storage.createFinanceReview({
        shipmentId,
        loadId: shipment.loadId,
        reviewerId: user.id,
        status,
        comment: commentVal,
        paymentStatus: bodyPayment ?? "not_released",
        reviewedAt: now,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Create/update finance review error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/finance/reviews/:reviewId/advance-payment", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { reviewId } = req.params;
      const review = await storage.getFinanceReview(reviewId);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (review.status !== "approved") {
        return res.status(400).json({
          error: "Finance review must be approved before releasing advance payment",
        });
      }

      const invoicePaid = await isLoadInvoicePaid(review.loadId);
      if (!invoicePaid) {
        return res.status(400).json({
          error: "Invoice must be marked paid in Admin Invoices before releasing advance payment",
        });
      }

      const requiresAdvance = await loadRequiresAdvanceRelease(review.loadId);
      if (!requiresAdvance) {
        return res.status(400).json({ error: "This load has no carrier advance configured" });
      }

      if (review.advancePaymentReleasedAt) {
        return res.json(review);
      }

      const now = new Date();
      const updated = await storage.updateFinanceReview(reviewId, {
        advancePaymentReleasedAt: now,
        advancePaymentReleasedBy: user.id,
        updatedAt: now,
      });
      res.json(updated);
    } catch (error) {
      console.error("Release advance payment error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/finance/reviews/:reviewId/payment", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { reviewId } = req.params;
      const parsed = z
        .object({ paymentStatus: financePaymentStatusSchema })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const review = await storage.getFinanceReview(reviewId);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      const requiresAdvance = await loadRequiresAdvanceRelease(review.loadId);
      if (requiresAdvance && !review.advancePaymentReleasedAt) {
        return res.status(400).json({
          error: "Advance payment must be released before updating processing or released status",
        });
      }

      const updated = await storage.updateFinanceReview(reviewId, {
        paymentStatus: parsed.data.paymentStatus,
        updatedAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      console.error("Update finance review payment error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
