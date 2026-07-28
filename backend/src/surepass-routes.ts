import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  verifyAadhaarValidation,
  verifyDrivingLicense,
  extractAadhaarOcr,
  verifyChassisToRc,
  verifyEmailCheck,
  verifyGstin,
  verifyPan,
  verifyPanComprehensive,
  verifyRcOwnerHistory,
  verifyRcV2,
  isProxyModeEnabled,
} from "./surepass-service";
import { SurepassError } from "./surepass-client";

function handleSurepassError(res: Response, error: unknown, label: string) {
  if (error instanceof SurepassError) {
    console.error(`[Surepass] ${label} error (HTTP ${error.status}):`, JSON.stringify(error.payload));
    if (error.payload && typeof error.payload === "object") {
      return res.status(200).json(error.payload);
    }
    return res.status(error.status ?? 500).json({ success: false, message: error.message, message_code: "api_error" });
  }
  console.error(`[Surepass] ${label} unexpected error:`, error);
  return res.status(500).json({ success: false, message: `${label} failed`, message_code: "internal_error" });
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const panSchema = z.object({
  pan_number: z.string().min(5),
  request_ref: z.string().optional(),
});

const gstinSchema = z.object({
  gstin_number: z.string().min(5),
  request_ref: z.string().optional(),
});

const emailSchema = z.object({
  email: z.string().email(),
  request_ref: z.string().optional(),
});

const rcSchema = z.object({
  rc_number: z.string().min(5),
  request_ref: z.string().optional(),
});

const rcV2Schema = z.object({
  rc_number: z.string().min(5),
  enrich: z.boolean().optional(),
  request_ref: z.string().optional(),
});

const chassisSchema = z.object({
  chassis_number: z.string().min(5),
  request_ref: z.string().optional(),
});

const aadhaarSchema = z.object({
  aadhaar_number: z.string().min(5),
  request_ref: z.string().optional(),
});

const drivingLicenseSchema = z.object({
  id_number: z.string().min(5),
  dob: z.string().min(8),
  request_ref: z.string().optional(),
});

/** Same normalization as surepass-service so /api/kyc/config matches actual behavior. */
function getSurepassAllowProxy(): boolean {
  return isProxyModeEnabled();
}

export function registerSurepassRoutes(app: Express) {
  console.log("[Surepass] SUREPASS_ALLOW_PROXY env:", JSON.stringify(process.env.SUREPASS_ALLOW_PROXY), "→ allowProxy:", getSurepassAllowProxy());

  app.get("/api/kyc/config", requireAuth, (_req, res) => {
    res.json({
      surepassAllowProxy: getSurepassAllowProxy(),
      surepassConfigured: Boolean(process.env.SUREPASS_API_TOKEN) && Boolean(process.env.SUREPASS_CLIENT_ID),
      surepassKycBaseUrl: process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app",
      surepassEncryptedBaseUrl: process.env.SUREPASS_BASE_URL || "https://sandbox-encrypted.surepass.app",
    });
  });

  
  app.post("/api/kyc/pan", requireAuth, async (req, res) => {
    try {
      const payload = panSchema.parse(req.body);
      const response = await verifyPan({
        panNumber: payload.pan_number,
        userId: req.session?.userId,
        requestRef: payload.request_ref,
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "PAN verification");
    }
  });

  app.post("/api/kyc/pan-comprehensive", requireAuth, async (req, res) => {
    try {
      const payload = panSchema.parse(req.body);
      const response = await verifyPanComprehensive({
        panNumber: payload.pan_number,
        userId: req.session?.userId,
        requestRef: payload.request_ref,
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "PAN comprehensive verification");
    }
  });

  app.post("/api/kyc/gstin", requireAuth, async (req, res) => {
    try {
      const payload = gstinSchema.parse(req.body);
      const response = await verifyGstin({
        gstinNumber: payload.gstin_number,
        userId: req.session?.userId,
        requestRef: payload.request_ref,
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "GSTIN verification");
    }
  });

  app.post("/api/kyc/email-check", requireAuth, async (req, res) => {
    try {
      const payload = emailSchema.parse(req.body);
      const response = await verifyEmailCheck({
        email: payload.email,
        userId: req.session?.userId,
        requestRef: payload.request_ref,
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "Email verification");
    }
  });

  app.post("/api/kyc/rc-owner-history", requireAuth, async (req, res) => {
    try {
      const payload = rcSchema.parse(req.body);
      const response = await verifyRcOwnerHistory({
        rcNumber: payload.rc_number,
        userId: req.session?.userId,
        requestRef: payload.request_ref,
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "RC owner history verification");
    }
  });

  app.post("/api/kyc/rc-v2", requireAuth, async (req, res) => {
    try {
      const payload = rcV2Schema.parse(req.body);
      const response = await verifyRcV2({
        rcNumber: payload.rc_number,
        enrich: payload.enrich,
        userId: req.session?.userId,
        requestRef: payload.request_ref,
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "RC v2 verification");
    }
  });

  app.post("/api/kyc/chassis-to-rc", requireAuth, async (req, res) => {
    try {
      const payload = chassisSchema.parse(req.body);
      const response = await verifyChassisToRc({
        chassisNumber: payload.chassis_number,
        userId: req.session?.userId,
        requestRef: payload.request_ref,
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "Chassis-to-RC verification");
    }
  });

  app.post("/api/kyc/aadhaar-validation", requireAuth, async (req, res) => {
    try {
      const payload = aadhaarSchema.parse(req.body);
      const response = await verifyAadhaarValidation({
        aadhaarNumber: payload.aadhaar_number,
        userId: req.session?.userId,
        requestRef: payload.request_ref,
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "Aadhaar validation");
    }
  });

  app.post("/api/kyc/driving-license", requireAuth, async (req, res) => {
    try {
      const payload = drivingLicenseSchema.parse(req.body);
      const response = await verifyDrivingLicense({
        licenseNumber: payload.id_number,
        dob: payload.dob,
        userId: req.session?.userId,
        requestRef: payload.request_ref,
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "Driving license verification");
    }
  });

  const aadhaarOcrSchema = z.object({
    object_path: z.string().min(1),
    request_ref: z.string().optional(),
  });

  app.post("/api/kyc/aadhaar-ocr", requireAuth, async (req, res) => {
    try {
      const payload = aadhaarOcrSchema.parse(req.body);
      const response = await extractAadhaarOcr({
        objectPath: payload.object_path,
        userId: req.session?.userId,
        requestRef: payload.request_ref || "carrier_onboarding_aadhaar_ocr",
      });
      res.json(response);
    } catch (error) {
      handleSurepassError(res, error, "Aadhaar OCR");
    }
  });
}
