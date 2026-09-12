import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import {
  hasAdminPageAccess,
  isAdminUser,
  resolveAdminPageKeys,
} from "../admin-permissions";
import {
  fullPushSalesDocuments,
  getSalesSyncStatus,
  pushLoadAsSalesDocument,
} from "./sales-sync-service";

const PAGE_KEY = "bc365_sales";

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

async function requireSalesAdmin(req: Request, res: Response) {
  const user = await storage.getUser(req.session!.userId!);
  if (!user || !isAdminUser(user)) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  const pageKeys = await resolveAdminPageKeys(user);
  if (!hasAdminPageAccess(pageKeys, PAGE_KEY)) {
    res.status(403).json({ error: "You do not have access to this area" });
    return null;
  }
  return user;
}

export function registerBc365SalesRoutes(app: Express): void {
  app.get("/api/admin/bc365-sales/status", requireAuth, async (req, res) => {
    try {
      const user = await requireSalesAdmin(req, res);
      if (!user) return;
      res.json(await getSalesSyncStatus());
    } catch (error) {
      console.error("BC 365 sales status error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load BC 365 sales status",
      });
    }
  });

  app.post("/api/admin/bc365-sales/push", requireAuth, async (req, res) => {
    try {
      const user = await requireSalesAdmin(req, res);
      if (!user) return;
      const result = await fullPushSalesDocuments();
      res.json(result);
    } catch (error) {
      console.error("BC 365 sales push error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to push sales documents",
      });
    }
  });

  app.post("/api/admin/bc365-sales/push/:loadId", requireAuth, async (req, res) => {
    try {
      const user = await requireSalesAdmin(req, res);
      if (!user) return;
      const result = await pushLoadAsSalesDocument(req.params.loadId);
      if (!result.ok) {
        return res.status(409).json(result);
      }
      res.json(result);
    } catch (error) {
      console.error("BC 365 sales single push error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to push sales document",
      });
    }
  });
}
