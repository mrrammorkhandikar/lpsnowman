import crypto from "crypto";
import fs from "fs";
import path from "path";
import AWS from "aws-sdk";
import { db } from "./db";
import { apiLogs } from "@shared/schema";
import { SurepassEncryptedClient, SurepassError } from "./surepass-client";
import { parseSurepassResponse, type SurepassResponse } from "./surepass-types";
import { createSurepassKycRequest, updateSurepassKycRequest } from "./surepass-storage";

type PanVerificationResult = {
  pan_number?: string;
  full_name?: string;
  category?: string;
  status?: string;
};

type VerifyPanInput = {
  panNumber: string;
  userId?: string;
  requestRef?: string;
};

type VerifyGstinInput = {
  gstinNumber: string;
  userId?: string;
  requestRef?: string;
};

type VerifyEmailInput = {
  email: string;
  userId?: string;
  requestRef?: string;
};

type PanComprehensiveResult = {
  pan_number?: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  masked_aadhaar?: string;
};

type GstinVerificationResult = {
  gstin?: string;
  pan_number?: string;
  legal_name?: string;
  business_name?: string;
  gstin_status?: string;
};

type EmailCheckResult = {
  email?: string;
  status?: string;
  deliverable?: boolean;
};

type VerifyRcOwnerHistoryInput = {
  rcNumber: string;
  userId?: string;
  requestRef?: string;
};

type VerifyRcV2Input = {
  rcNumber: string;
  enrich?: boolean;
  userId?: string;
  requestRef?: string;
};

type VerifyChassisToRcInput = {
  chassisNumber: string;
  userId?: string;
  requestRef?: string;
};

type VerifyAadhaarInput = {
  aadhaarNumber: string;
  userId?: string;
  requestRef?: string;
};

type VerifyDrivingLicenseInput = {
  licenseNumber: string;
  dob: string;
  userId?: string;
  requestRef?: string;
};

type AadhaarOcrInput = {
  objectPath: string;
  userId?: string;
  requestRef?: string;
};

type AadhaarOcrResult = {
  aadhaar_number?: string;
  name?: string;
  dob?: string;
  gender?: string;
  address?: string;
  pin_code?: string;
  father_name?: string;
  id_number?: string;
};

type RcOwnerHistoryResult = {
  rc_number?: string;
  current_owner_number?: string;
  current_owner_name?: string;
  owner_history?: Array<{
    owner_name?: string;
    owner_number?: string;
  }>;
};

type RcV2Result = {
  rc_number?: string;
  owner_name?: string;
  vehicle_chasi_number?: string;
  vehicle_engine_number?: string;
  [key: string]: unknown;
};

type ChassisToRcResult = {
  rc_number?: string;
  vehicle_chasi_number?: string;
  details?: {
    rc_number?: string;
    vehicle_chasi_number?: string;
    vehicle_engine_number?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type AadhaarValidationResult = {
  aadhaar_number?: string;
  last_digits?: string;
  [key: string]: unknown;
};

type DrivingLicenseVerificationResult = {
  license_number?: string;
  dob?: string;
  father_or_husband_name?: string;
  profile_image?: string;
  [key: string]: unknown;
};

export function maskValue(value: string) {
  if (value.length <= 4) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, 2)}${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-2)}`;
}

export function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return maskValue(email);
  const maskedLocal = local.length <= 2 ? `${local[0] || "*"}*` : `${local[0]}${"*".repeat(local.length - 2)}${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

function sanitizePanRequest(panNumber: string) {
  return {
    pan_last4: panNumber.slice(-4),
    pan_masked: maskValue(panNumber),
    pan_hash: hashValue(panNumber),
  };
}

function sanitizePanResponse(data: PanVerificationResult | undefined) {
  if (!data) return undefined;
  return {
    ...data,
    pan_number: data.pan_number ? maskValue(data.pan_number) : undefined,
  };
}

function sanitizePanComprehensiveResponse(data: PanComprehensiveResult | undefined) {
  if (!data) return undefined;
  return {
    ...data,
    pan_number: data.pan_number ? maskValue(data.pan_number) : undefined,
    email: data.email ? maskEmail(data.email) : undefined,
    phone_number: data.phone_number ? maskValue(data.phone_number) : undefined,
    masked_aadhaar: data.masked_aadhaar ? maskValue(data.masked_aadhaar) : undefined,
  };
}

function sanitizeGstinRequest(gstinNumber: string) {
  return {
    gstin_last4: gstinNumber.slice(-4),
    gstin_masked: maskValue(gstinNumber),
    gstin_hash: hashValue(gstinNumber),
  };
}

function sanitizeGstinResponse(data: GstinVerificationResult | undefined) {
  if (!data) return undefined;
  return {
    ...data,
    gstin: data.gstin ? maskValue(data.gstin) : undefined,
    pan_number: data.pan_number ? maskValue(data.pan_number) : undefined,
  };
}

function sanitizeEmailRequest(email: string) {
  return {
    email_masked: maskEmail(email),
    email_hash: hashValue(email.toLowerCase()),
  };
}

function sanitizeEmailResponse(data: EmailCheckResult | undefined) {
  if (!data) return undefined;
  return {
    ...data,
    email: data.email ? maskEmail(data.email) : undefined,
  };
}

function sanitizeRcRequest(rcNumber: string) {
  return {
    rc_last4: rcNumber.slice(-4),
    rc_masked: maskValue(rcNumber),
    rc_hash: hashValue(rcNumber),
  };
}

function sanitizeRcResponse(data: RcOwnerHistoryResult | undefined) {
  if (!data) return undefined;
  return {
    ...data,
    rc_number: data.rc_number ? maskValue(data.rc_number) : undefined,
  };
}

function sanitizeRcV2Request(rcNumber: string) {
  return {
    rc_last4: rcNumber.slice(-4),
    rc_masked: maskValue(rcNumber),
    rc_hash: hashValue(rcNumber),
  };
}

function sanitizeRcV2Response(data: RcV2Result | undefined) {
  if (!data) return undefined;
  return {
    ...data,
    rc_number: data.rc_number ? maskValue(data.rc_number) : undefined,
    vehicle_chasi_number: data.vehicle_chasi_number
      ? maskValue(data.vehicle_chasi_number)
      : undefined,
    vehicle_engine_number: data.vehicle_engine_number
      ? maskValue(data.vehicle_engine_number)
      : undefined,
  };
}

function sanitizeChassisRequest(chassisNumber: string) {
  return {
    chassis_last4: chassisNumber.slice(-4),
    chassis_masked: maskValue(chassisNumber),
    chassis_hash: hashValue(chassisNumber),
  };
}

function sanitizeChassisResponse(data: ChassisToRcResult | undefined) {
  if (!data) return undefined;
  return {
    ...data,
    vehicle_chasi_number: data.vehicle_chasi_number
      ? maskValue(data.vehicle_chasi_number)
      : undefined,
    details: data.details
      ? {
          ...data.details,
          rc_number: data.details.rc_number ? maskValue(data.details.rc_number) : undefined,
          vehicle_chasi_number: data.details.vehicle_chasi_number
            ? maskValue(data.details.vehicle_chasi_number)
            : undefined,
          vehicle_engine_number: data.details.vehicle_engine_number
            ? maskValue(data.details.vehicle_engine_number)
            : undefined,
        }
      : undefined,
  };
}

function sanitizeAadhaarRequest(aadhaarNumber: string) {
  return {
    aadhaar_last4: aadhaarNumber.slice(-4),
    aadhaar_masked: maskValue(aadhaarNumber),
    aadhaar_hash: hashValue(aadhaarNumber),
  };
}

function sanitizeAadhaarResponse(data: AadhaarValidationResult | undefined) {
  if (!data) return undefined;
  return {
    ...data,
    aadhaar_number: data.aadhaar_number ? maskValue(data.aadhaar_number) : undefined,
    last_digits: data.last_digits ? maskValue(data.last_digits) : undefined,
  };
}

function sanitizeDrivingLicenseRequest(licenseNumber: string, dob: string) {
  return {
    license_last4: licenseNumber.slice(-4),
    license_masked: maskValue(licenseNumber),
    license_hash: hashValue(licenseNumber),
    dob_masked: dob ? `${dob.slice(0, 4)}-**-**` : "",
    dob_hash: dob ? hashValue(dob) : null,
  };
}

function sanitizeDrivingLicenseResponse(data: DrivingLicenseVerificationResult | undefined) {
  if (!data) return undefined;
  return {
    ...data,
    license_number: data.license_number ? maskValue(data.license_number) : undefined,
    dob: data.dob ? `${data.dob.slice(0, 4)}-**-**` : undefined,
    father_or_husband_name: data.father_or_husband_name
      ? `${data.father_or_husband_name[0] || ""}${"*".repeat(Math.max(0, data.father_or_husband_name.length - 1))}`
      : undefined,
    profile_image: data.profile_image ? "[REDACTED_BASE64_IMAGE]" : undefined,
  };
}

/** Normalized read so production env (K8s, ECS, etc.) always respects false. Only "true" or "1" enable proxy. */
export function isProxyModeEnabled(): boolean {
  const raw = process.env.SUREPASS_ALLOW_PROXY;
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "true" || v === "1";
}

function buildProxyData(requestType: string, body: unknown): Record<string, unknown> {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (requestType) {
    case "pan":
    case "pan_comprehensive":
      return {
        pan_number: b.pan_number ?? b.id_number,
        full_name: "Proxy Verified",
        category: "proxy",
        status: "proxy_verified",
      };
    case "gstin":
      return {
        gstin: b.id_number,
        gstin_status: "Active",
        legal_name: "Proxy Verified",
        business_name: "Proxy Verified",
      };
    case "email_check":
      return {
        email: b.email,
        status: "deliverable",
        deliverable: true,
      };
    case "rc_owner_history":
      return {
        rc_number: b.id_number,
        current_owner_name: "Proxy Owner",
        current_owner_number: "1",
      };
    case "rc_v2":
      return {
        rc_number: b.id_number,
        owner_name: "Proxy Owner",
      };
    case "chassis_to_rc":
      return {
        vehicle_chasi_number: b.chassis_number,
        rc_number: "PROXY0001",
        details: {
          rc_number: "PROXY0001",
          vehicle_chasi_number: b.chassis_number,
        },
      };
    case "aadhaar_validation":
      return {
        aadhaar_number: b.id_number,
        last_digits: String(b.id_number ?? "").slice(-3),
      };
    case "driving_license":
      return {
        license_number: b.id_number,
        dob: b.dob,
        status: "proxy_verified",
      };
    case "aadhaar_ocr":
      return {
        aadhaar_number: "000000000000",
        name: "Proxy Verified",
        dob: "1990-01-01",
        gender: "M",
      };
    default:
      return { status: "proxy_verified" };
  }
}

async function returnProxySurepassResponse<T>(input: {
  userId?: string;
  endpoint: string;
  requestType: string;
  requestRef?: string;
  requestHash?: string | null;
  requestMasked?: Record<string, unknown> | null;
  body: unknown;
  sanitizeResponse?: (data: T | undefined) => unknown;
}): Promise<SurepassResponse<T>> {
  const startedAt = Date.now();
  const proxyData = buildProxyData(input.requestType, input.body) as T;
  const response: SurepassResponse<T> = {
    success: true,
    status_code: 200,
    message: null,
    message_code: "proxy_success",
    data: proxyData,
  };
  const record = await createSurepassKycRequest({
    userId: input.userId,
    requestType: input.requestType,
    requestRef: input.requestRef,
    status: "success",
    requestHash: input.requestHash ?? null,
    requestMasked: input.requestMasked ?? null,
  });
  const sanitizedResponse = input.sanitizeResponse
    ? input.sanitizeResponse(response.data)
    : response.data;
  await updateSurepassKycRequest(record.id, {
    status: "success",
    responseStatusCode: response.status_code,
    responseMessageCode: response.message_code,
    responseMasked: (sanitizedResponse as Record<string, unknown> | null) ?? null,
  });
  await logSurepassCall({
    userId: input.userId,
    endpoint: input.endpoint,
    method: "POST",
    requestBody: input.requestMasked,
    responseBody: sanitizedResponse ?? null,
    statusCode: response.status_code,
    durationMs: Date.now() - startedAt,
  });
  console.log(`[surepass] PROXY ${input.endpoint} → success`);
  return response;
}

async function logSurepassCall(input: {
  userId?: string;
  endpoint: string;
  method: string;
  requestBody?: unknown;
  responseBody?: unknown;
  statusCode?: number;
  errorMessage?: string;
  durationMs: number;
}) {
  await db.insert(apiLogs).values({
    userId: input.userId,
    endpoint: input.endpoint,
    method: input.method,
    requestBody: input.requestBody,
    responseBody: input.responseBody,
    statusCode: input.statusCode,
    errorMessage: input.errorMessage,
    durationMs: input.durationMs,
    logType: "surepass",
    createdAt: new Date(),
  });
}

async function postPlainSurepass<T>(input: {
  userId?: string;
  endpoint: string;
  baseUrl: string;
  requestType: string;
  requestRef?: string;
  requestHash?: string;
  requestMasked?: Record<string, unknown> | null;
  body: unknown;
  sanitizeResponse?: (data: T | undefined) => unknown;
}) {
  if (isProxyModeEnabled()) {
    return returnProxySurepassResponse<T>({
      userId: input.userId,
      endpoint: input.endpoint,
      requestType: input.requestType,
      requestRef: input.requestRef,
      requestHash: input.requestHash,
      requestMasked: input.requestMasked,
      body: input.body,
      sanitizeResponse: input.sanitizeResponse,
    });
  }

  const startedAt = Date.now();
  const record = await createSurepassKycRequest({
    userId: input.userId,
    requestType: input.requestType,
    requestRef: input.requestRef,
    status: "pending",
    requestHash: input.requestHash,
    requestMasked: input.requestMasked ?? null,
  });
  try {
    const token = process.env.SUREPASS_API_TOKEN || "";
    if (!token) {
      throw new Error("Surepass API token missing");
    }
    const fullUrl = `${input.baseUrl}${input.endpoint}`;
    console.log(`[surepass] POST ${fullUrl}`);
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input.body),
    });
    console.log(`[surepass] Response status: ${response.status}`);
    const rawText = await response.text();
    console.log(`[surepass] Response body: ${rawText.substring(0, 300)}`);
    let payload: unknown;
    try {
      payload = JSON.parse(rawText);
    } catch {
      throw new SurepassError(`Non-JSON response: ${rawText.substring(0, 200)}`, response.status);
    }
    const parsed = parseSurepassResponse<T>(payload) as SurepassResponse<T>;
    if (!response.ok) {
      throw new SurepassError("Surepass request failed", response.status, parsed);
    }
    const sanitizedResponse = input.sanitizeResponse ? input.sanitizeResponse(parsed.data) : parsed.data;
    await updateSurepassKycRequest(record.id, {
      status: parsed.success ? "success" : "failed",
      responseStatusCode: parsed.status_code,
      responseMessageCode: parsed.message_code,
      responseMasked: sanitizedResponse ?? null,
    });
    await logSurepassCall({
      userId: input.userId,
      endpoint: input.endpoint,
      method: "POST",
      requestBody: input.requestMasked,
      responseBody: sanitizedResponse ?? null,
      statusCode: parsed.status_code,
      durationMs: Date.now() - startedAt,
    });
    return parsed;
  } catch (error: any) {
    const message = error instanceof SurepassError ? error.message : "Surepass request failed";
    console.error(`[Surepass] ${input.endpoint} FAILED (HTTP ${error?.status}):`, message, JSON.stringify(error?.payload));
    await updateSurepassKycRequest(record.id, {
      status: "failed",
      errorMessage: message,
    });
    await logSurepassCall({
      userId: input.userId,
      endpoint: input.endpoint,
      method: "POST",
      requestBody: input.requestMasked,
      responseBody: null,
      statusCode: error?.status,
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export async function verifyPan(input: VerifyPanInput) {
  const maskedRequest = sanitizePanRequest(input.panNumber);

  if (isProxyModeEnabled()) {
    return returnProxySurepassResponse<PanVerificationResult>({
      userId: input.userId,
      endpoint: "/api/v1/pan/pan",
      requestType: "pan",
      requestRef: input.requestRef,
      requestHash: maskedRequest.pan_hash,
      requestMasked: maskedRequest,
      body: { pan_number: input.panNumber },
      sanitizeResponse: sanitizePanResponse,
    });
  }

  const client = SurepassEncryptedClient.fromEnv();
  const startedAt = Date.now();
  const record = await createSurepassKycRequest({
    userId: input.userId,
    requestType: "pan",
    requestRef: input.requestRef,
    status: "pending",
    requestHash: maskedRequest.pan_hash,
    requestMasked: maskedRequest,
  });

  try {
    const response = await client.postJson<PanVerificationResult>("/api/v1/pan/pan", {
      pan_number: input.panNumber,
    });
    const sanitizedResponse = sanitizePanResponse(response.data);
    await updateSurepassKycRequest(record.id, {
      status: response.success ? "success" : "failed",
      responseStatusCode: response.status_code,
      responseMessageCode: response.message_code,
      responseMasked: sanitizedResponse ?? null,
    });
    await logSurepassCall({
      userId: input.userId,
      endpoint: "/api/v1/pan/pan",
      method: "POST",
      requestBody: maskedRequest,
      responseBody: sanitizedResponse ?? null,
      statusCode: response.status_code,
      durationMs: Date.now() - startedAt,
    });
    return response;
  } catch (error: any) {
    const message = error instanceof SurepassError ? error.message : "Surepass PAN verification failed";
    await updateSurepassKycRequest(record.id, {
      status: "failed",
      errorMessage: message,
    });
    await logSurepassCall({
      userId: input.userId,
      endpoint: "/api/v1/pan/pan",
      method: "POST",
      requestBody: maskedRequest,
      responseBody: null,
      statusCode: error?.status,
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export async function verifyPanComprehensive(input: VerifyPanInput) {
  const baseUrl = process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app";
  const maskedRequest = sanitizePanRequest(input.panNumber);
  return postPlainSurepass<PanComprehensiveResult>({
    userId: input.userId,
    endpoint: "/api/v1/pan/pan-comprehensive",
    baseUrl,
    requestType: "pan_comprehensive",
    requestRef: input.requestRef,
    requestHash: maskedRequest.pan_hash,
    requestMasked: maskedRequest,
    body: { id_number: input.panNumber },
    sanitizeResponse: sanitizePanComprehensiveResponse,
  });
}

export async function verifyGstin(input: VerifyGstinInput) {
  const baseUrl = process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app";
  const maskedRequest = sanitizeGstinRequest(input.gstinNumber);
  return postPlainSurepass<GstinVerificationResult>({
    userId: input.userId,
    endpoint: "/api/v1/corporate/gstin",
    baseUrl,
    requestType: "gstin",
    requestRef: input.requestRef,
    requestHash: maskedRequest.gstin_hash,
    requestMasked: maskedRequest,
    body: { id_number: input.gstinNumber },
    sanitizeResponse: sanitizeGstinResponse,
  });
}

export async function verifyEmailCheck(input: VerifyEmailInput) {
  const baseUrl = process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app";
  const maskedRequest = sanitizeEmailRequest(input.email);
  return postPlainSurepass<EmailCheckResult>({
    userId: input.userId,
    endpoint: "/api/v1/employment/email-check",
    baseUrl,
    requestType: "email_check",
    requestRef: input.requestRef,
    requestHash: maskedRequest.email_hash,
    requestMasked: maskedRequest,
    body: { email: input.email },
    sanitizeResponse: sanitizeEmailResponse,
  });
}

export async function verifyRcOwnerHistory(input: VerifyRcOwnerHistoryInput) {
  const baseUrl = process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app";
  const maskedRequest = sanitizeRcRequest(input.rcNumber);
  return postPlainSurepass<RcOwnerHistoryResult>({
    userId: input.userId,
    endpoint: "/api/v1/rc/rc-owner-history",
    baseUrl,
    requestType: "rc_owner_history",
    requestRef: input.requestRef,
    requestHash: maskedRequest.rc_hash,
    requestMasked: maskedRequest,
    body: { id_number: input.rcNumber },
    sanitizeResponse: sanitizeRcResponse,
  });
}

export async function verifyRcV2(input: VerifyRcV2Input) {
  const baseUrl = process.env.SUREPASS_RC_BASE_URL || "https://sandbox.surepass.app";
  const maskedRequest = sanitizeRcV2Request(input.rcNumber);
  return postPlainSurepass<RcV2Result>({
    userId: input.userId,
    endpoint: "/api/v1/rc/rc-v2",
    baseUrl,
    requestType: "rc_v2",
    requestRef: input.requestRef,
    requestHash: maskedRequest.rc_hash,
    requestMasked: maskedRequest,
    body: { id_number: input.rcNumber, enrich: input.enrich ?? true },
    sanitizeResponse: sanitizeRcV2Response,
  });
}

export async function verifyChassisToRc(input: VerifyChassisToRcInput) {
  const baseUrl = process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app";
  const maskedRequest = sanitizeChassisRequest(input.chassisNumber);
  return postPlainSurepass<ChassisToRcResult>({
    userId: input.userId,
    endpoint: "/api/v1/rc/chassis-to-rc-details",
    baseUrl,
    requestType: "chassis_to_rc",
    requestRef: input.requestRef,
    requestHash: maskedRequest.chassis_hash,
    requestMasked: maskedRequest,
    body: { chassis_number: input.chassisNumber },
    sanitizeResponse: sanitizeChassisResponse,
  });
}

export async function verifyAadhaarValidation(input: VerifyAadhaarInput) {
  const baseUrl = process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app";
  const maskedRequest = sanitizeAadhaarRequest(input.aadhaarNumber);
  return postPlainSurepass<AadhaarValidationResult>({
    userId: input.userId,
    endpoint: "/api/v1/aadhaar-validation/aadhaar-validation",
    baseUrl,
    requestType: "aadhaar_validation",
    requestRef: input.requestRef,
    requestHash: maskedRequest.aadhaar_hash,
    requestMasked: maskedRequest,
    body: { id_number: input.aadhaarNumber },
    sanitizeResponse: sanitizeAadhaarResponse,
  });
}

export async function verifyDrivingLicense(input: VerifyDrivingLicenseInput) {
  const baseUrl = process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app";
  const maskedRequest = sanitizeDrivingLicenseRequest(input.licenseNumber, input.dob);
  return postPlainSurepass<DrivingLicenseVerificationResult>({
    userId: input.userId,
    endpoint: "/api/v1/driving-license/driving-license",
    baseUrl,
    requestType: "driving_license",
    requestRef: input.requestRef,
    requestHash: maskedRequest.license_hash,
    requestMasked: maskedRequest,
    body: { id_number: input.licenseNumber, dob: input.dob },
    sanitizeResponse: sanitizeDrivingLicenseResponse,
  });
}

/**
 * Fetch the image buffer from either S3 or local storage given an objectPath
 * e.g. "/objects/uploads/uuid.jpg"
 */
async function fetchObjectBuffer(objectPath: string): Promise<{ buffer: Buffer; contentType: string }> {
  const USE_LOCAL = process.env.USE_LOCAL_OBJECT_STORAGE === "true";
  const AWS_BUCKET_NAME = (process.env.AWS_BUCKET_NAME || "").trim();
  const AWS_REGION = (process.env.AWS_REGION || "").trim();
  const AWS_ACCESS_KEY_ID = (process.env.AWS_ACCESS_KEY_ID || "").trim();
  const AWS_SECRET_ACCESS_KEY = (process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  const AWS_OBJECT_PREFIX = (process.env.AWS_OBJECT_PREFIX || "uploads").trim();
  const USE_S3 = Boolean(AWS_BUCKET_NAME && AWS_REGION);

  // Parse path: /objects/uploads/<id>
  const parts = objectPath.replace(/^\/+/, "").split("/").filter(Boolean);
  const id = parts.slice(2).join("/");

  if (USE_LOCAL) {
    const filePath = path.resolve(process.cwd(), "local_objects", "uploads", id);
    if (!fs.existsSync(filePath)) throw new Error(`Local file not found: ${filePath}`);
    const buffer = fs.readFileSync(filePath);
    const ext = id.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
      pdf: "application/pdf",
    };
    return { buffer, contentType: mimeMap[ext] || "application/octet-stream" };
  }

  if (USE_S3) {
    const s3 = new AWS.S3({ accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY, region: AWS_REGION, signatureVersion: "v4" });
    const key = `${AWS_OBJECT_PREFIX}/${id}`;
    const obj = await s3.getObject({ Bucket: AWS_BUCKET_NAME, Key: key }).promise();
    return { buffer: obj.Body as Buffer, contentType: (obj.ContentType as string) || "image/jpeg" };
  }

  throw new Error("No storage backend configured");
}

export async function extractAadhaarOcr(input: AadhaarOcrInput): Promise<SurepassResponse<AadhaarOcrResult>> {
  const baseUrl = process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app";

  if (isProxyModeEnabled()) {
    return returnProxySurepassResponse<AadhaarOcrResult>({
      userId: input.userId,
      endpoint: "/api/v1/aadhaar-ocr/aadhaar-ocr",
      requestType: "aadhaar_ocr",
      requestRef: input.requestRef,
      requestHash: null,
      requestMasked: { objectPath: input.objectPath },
      body: { object_path: input.objectPath },
      sanitizeResponse: (data) => ({
        ...data,
        aadhaar_number: data?.aadhaar_number ? maskValue(String(data.aadhaar_number)) : undefined,
        id_number: data?.id_number ? maskValue(String(data.id_number)) : undefined,
      }),
    });
  }

  const startedAt = Date.now();

  const record = await createSurepassKycRequest({
    userId: input.userId,
    requestType: "aadhaar_ocr",
    requestRef: input.requestRef,
    status: "pending",
    requestHash: null,
    requestMasked: { objectPath: input.objectPath },
  });

  try {
    const token = process.env.SUREPASS_API_TOKEN || "";
    if (!token) throw new Error("Surepass API token missing");

    const { buffer } = await fetchObjectBuffer(input.objectPath);
    const base64 = buffer.toString("base64");

    const response = await fetch(`${baseUrl}/api/v1/aadhaar-ocr/aadhaar-ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ doc1: base64 }),
    });

    const rawText = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(rawText);
    } catch {
      console.error("[KYC][aadhaar-ocr] Surepass returned non-JSON:", rawText.slice(0, 200));
      throw new Error("Surepass OCR service returned an unexpected response. Please try again.");
    }
    const parsed = parseSurepassResponse<AadhaarOcrResult>(payload) as SurepassResponse<AadhaarOcrResult>;

    // Mask Aadhaar number in logs — only keep last 4 digits
    const aadhaarNum = parsed.data?.aadhaar_number || parsed.data?.id_number || "";
    const maskedNum = aadhaarNum ? `XXXXXXXX${aadhaarNum.slice(-4)}` : null;
    const sanitizedResponse = { ...parsed.data, aadhaar_number: maskedNum, id_number: maskedNum };

    await updateSurepassKycRequest(record.id, {
      status: parsed.success ? "success" : "failed",
      responseStatusCode: parsed.status_code,
      responseMessageCode: parsed.message_code,
      responseMasked: sanitizedResponse,
    });
    await logSurepassCall({
      userId: input.userId,
      endpoint: "/api/v1/aadhaar-ocr/aadhaar-ocr",
      method: "POST",
      requestBody: { objectPath: input.objectPath },
      responseBody: sanitizedResponse,
      statusCode: parsed.status_code,
      durationMs: Date.now() - startedAt,
    });

    return parsed;
  } catch (error: any) {
    const message = error instanceof SurepassError ? error.message : "Aadhaar OCR failed";
    await updateSurepassKycRequest(record.id, { status: "failed", errorMessage: message });
    await logSurepassCall({
      userId: input.userId,
      endpoint: "/api/v1/aadhaar-ocr/aadhaar-ocr",
      method: "POST",
      requestBody: { objectPath: input.objectPath },
      responseBody: null,
      statusCode: error?.status,
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
