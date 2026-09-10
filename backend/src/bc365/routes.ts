import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import {
  hasAdminPageAccess,
  isAdminUser,
  resolveAdminPageKeys,
} from "../admin-permissions";
import {
  compareSyncStatus,
  fullPushToBc,
  getConnectionPreview,
  pullPaymentStatusFromBc,
  wipeBcLoadData,
} from "./sync-service";

const PAGE_KEY = "bc365_sync";

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

async function requireBc365Admin(req: Request, res: Response) {
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

export function registerBc365Routes(app: Express): void {
  app.get("/api/admin/bc365/status", requireAuth, async (req, res) => {
    try {
      const user = await requireBc365Admin(req, res);
      if (!user) return;
      const [preview, report] = await Promise.all([
        getConnectionPreview(),
        compareSyncStatus(),
      ]);
      res.json({ ...report, companies: preview.companies });
    } catch (error) {
      console.error("BC 365 status error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load BC 365 status",
      });
    }
  });

  app.post("/api/admin/bc365/sync", requireAuth, async (req, res) => {
    try {
      const user = await requireBc365Admin(req, res);
      if (!user) return;
      const result = await fullPushToBc(user.id);
      if (result.errorCount > 0) {
        const first = (result.report.lastError || "Business Central rejected the load rows.").toString();
        return res.status(409).json({
          error: first,
          ...result,
        });
      }
      res.json(result);
    } catch (error) {
      console.error("BC 365 sync error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to sync to BC 365",
      });
    }
  });

  app.post("/api/admin/bc365/wipe", requireAuth, async (req, res) => {
    try {
      const user = await requireBc365Admin(req, res);
      if (!user) return;
      const confirm = String(req.body?.confirm || "").trim();
      if (confirm !== "ERASE BC LOADS") {
        return res.status(400).json({
          error: 'Type "ERASE BC LOADS" to confirm wiping LoadPilot records on Business Central',
        });
      }
      const result = await wipeBcLoadData(user.id);
      res.json(result);
    } catch (error) {
      console.error("BC 365 wipe error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to erase BC 365 load data",
      });
    }
  });

  app.post("/api/admin/bc365/pull-payments", requireAuth, async (req, res) => {
    try {
      const user = await requireBc365Admin(req, res);
      if (!user) return;
      const result = await pullPaymentStatusFromBc();
      res.json(result);
    } catch (error) {
      console.error("BC 365 payment pull error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to pull payment status",
      });
    }
  });
}
