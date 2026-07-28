import type { Express, NextFunction, Request, Response } from "express";
import { pool } from "./db";
import { storage } from "./storage";

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const handleAdminRemoveSavedAddress = async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session!.userId!);
    if (!user || (user.role !== "admin" && user.role !== "admin_employee")) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const idRaw = body.id ?? body.addressId;
    const shipperIdRaw = body.shipperId;
    const addressId =
      typeof idRaw === "number" && Number.isFinite(idRaw)
        ? Math.trunc(idRaw)
        : parseInt(String(idRaw ?? "").trim(), 10);
    if (!Number.isFinite(addressId) || addressId < 1) {
      return res.status(400).json({ error: "Invalid address id" });
    }
    const shipperId = String(shipperIdRaw ?? "").trim();
    if (!shipperId) {
      return res.status(400).json({ error: "shipperId is required" });
    }

    const up = await pool.query(
      `UPDATE public.saved_addresses
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND LOWER(TRIM(shipper_id::text)) = LOWER(TRIM($2::text))
       RETURNING id`,
      [addressId, shipperId],
    );

    if ((up.rowCount ?? 0) > 0) {
      return res.json({ success: true });
    }

    const check = await pool.query(
      `SELECT id, shipper_id FROM public.saved_addresses WHERE id = $1`,
      [addressId],
    );
    if (check.rows.length === 0) {
      console.warn("[admin] remove saved address: no row for id", addressId, "url=", req.originalUrl);
      return res.status(404).json({ error: "Address not found", code: "ADDRESS_NOT_FOUND" });
    }
    return res.status(403).json({ error: "Address does not belong to this shipper" });
  } catch (error) {
    console.error("POST admin remove saved address error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** Registered from index.ts after registerRoutes() so the route always exists even if routes.ts hot-reload fails. */
export function registerAdminRemoveSavedAddress(app: Express): void {
  app.post("/api/admin/remove-saved-address", requireAuth, handleAdminRemoveSavedAddress);
  app.post("/api/admin/saved-addresses/remove", requireAuth, handleAdminRemoveSavedAddress);
}
