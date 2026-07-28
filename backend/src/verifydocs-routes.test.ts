import { test, before } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

const BASE_URL = process.env.UPLOAD_TEST_BASE_URL || "http://localhost:5000";
const SESSION_COOKIE = process.env.UPLOAD_TEST_SESSION_COOKIE || "";

async function waitForHealth(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Backend health check failed");
}

async function postKyc(path: string, body: unknown, withAuth: boolean): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (withAuth && SESSION_COOKIE) {
    headers.Cookie = `connect.sid=${SESSION_COOKIE}`;
  }
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

before(async () => {
  assert.ok(BASE_URL, "UPLOAD_TEST_BASE_URL (BASE_URL) missing");
  await waitForHealth(15000);
});

test("unauthenticated KYC routes require auth", async () => {
  const panRes = await postKyc("/api/kyc/pan", { pan_number: "ABCDE1234F" }, false);
  assert.equal(panRes.status, 401);

  const panCompRes = await postKyc(
    "/api/kyc/pan-comprehensive",
    { pan_number: "EKRPR1234F" },
    false,
  );
  assert.equal(panCompRes.status, 401);

  const gstinRes = await postKyc(
    "/api/kyc/gstin",
    { gstin_number: "08AKWPJ1234H1ZN" },
    false,
  );
  assert.equal(gstinRes.status, 401);

  const emailRes = await postKyc(
    "/api/kyc/email-check",
    { email: "vishalrathore9965@gmail.com" },
    false,
  );
  assert.equal(emailRes.status, 401);

  const rcOwnerRes = await postKyc(
    "/api/kyc/rc-owner-history",
    { rc_number: "GJ01RV8123" },
    false,
  );
  assert.equal(rcOwnerRes.status, 401);

  const rcV2Res = await postKyc(
    "/api/kyc/rc-v2",
    { rc_number: "DL08AB1234" },
    false,
  );
  assert.equal(rcV2Res.status, 401);

  const chassisRes = await postKyc(
    "/api/kyc/chassis-to-rc",
    { chassis_number: "MALBM51ABC123456" },
    false,
  );
  assert.equal(chassisRes.status, 401);

  const aadhaarRes = await postKyc(
    "/api/kyc/aadhaar-validation",
    { aadhaar_number: "917646971298" },
    false,
  );
  assert.equal(aadhaarRes.status, 401);

  const licenseRes = await postKyc(
    "/api/kyc/driving-license",
    { id_number: "UK0620130073251", dob: "1991-07-01" },
    false,
  );
  assert.equal(licenseRes.status, 401);
});

test("authenticated PAN KYC route responds with JSON", async (t) => {
  if (!SESSION_COOKIE) {
    t.skip("UPLOAD_TEST_SESSION_COOKIE missing; cannot test authenticated KYC routes");
    return;
  }

  const res = await postKyc(
    "/api/kyc/pan",
    { pan_number: "FNMPM6342D", request_ref: "test-pan-route" },
    true,
  );

  const text = await res.text();
  assert.ok(
    res.status === 200 || res.status === 500,
    `Unexpected status ${res.status}: ${text}`,
  );

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    assert.fail(`PAN route response is not valid JSON: ${text}`);
  }

  assert.ok(
    typeof json === "object" && json !== null,
    "PAN route response must be a JSON object",
  );
});

test("authenticated GSTIN KYC route responds with JSON", async (t) => {
  if (!SESSION_COOKIE) {
    t.skip("UPLOAD_TEST_SESSION_COOKIE missing; cannot test authenticated KYC routes");
    return;
  }

  const res = await postKyc(
    "/api/kyc/gstin",
    { gstin_number: "08AKWPJ1234H1ZN", request_ref: "test-gstin-route" },
    true,
  );

  const text = await res.text();
  assert.ok(
    res.status === 200 || res.status === 500,
    `Unexpected status ${res.status}: ${text}`,
  );

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    assert.fail(`GSTIN route response is not valid JSON: ${text}`);
  }

  assert.ok(
    typeof json === "object" && json !== null,
    "GSTIN route response must be a JSON object",
  );
});

test("authenticated email-check KYC route responds with JSON", async (t) => {
  if (!SESSION_COOKIE) {
    t.skip("UPLOAD_TEST_SESSION_COOKIE missing; cannot test authenticated KYC routes");
    return;
  }

  const res = await postKyc(
    "/api/kyc/email-check",
    { email: "vishalrathore9965@gmail.com", request_ref: "test-email-route" },
    true,
  );

  const text = await res.text();
  assert.ok(
    res.status === 200 || res.status === 500,
    `Unexpected status ${res.status}: ${text}`,
  );

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    assert.fail(`email-check route response is not valid JSON: ${text}`);
  }

  assert.ok(
    typeof json === "object" && json !== null,
    "email-check route response must be a JSON object",
  );
});

test("authenticated RC owner history KYC route responds with JSON", async (t) => {
  if (!SESSION_COOKIE) {
    t.skip("UPLOAD_TEST_SESSION_COOKIE missing; cannot test authenticated KYC routes");
    return;
  }

  const res = await postKyc(
    "/api/kyc/rc-owner-history",
    { rc_number: "GJ01RV8123", request_ref: "test-rc-owner-history-route" },
    true,
  );

  const text = await res.text();
  assert.ok(
    res.status === 200 || res.status === 500,
    `Unexpected status ${res.status}: ${text}`,
  );

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    assert.fail(`rc-owner-history route response is not valid JSON: ${text}`);
  }

  assert.ok(
    typeof json === "object" && json !== null,
    "rc-owner-history route response must be a JSON object",
  );
});

test("authenticated RC v2 KYC route responds with JSON", async (t) => {
  if (!SESSION_COOKIE) {
    t.skip("UPLOAD_TEST_SESSION_COOKIE missing; cannot test authenticated KYC routes");
    return;
  }

  const res = await postKyc(
    "/api/kyc/rc-v2",
    { rc_number: "DL08AB1234", enrich: true, request_ref: "test-rc-v2-route" },
    true,
  );

  const text = await res.text();
  assert.ok(
    res.status === 200 || res.status === 500,
    `Unexpected status ${res.status}: ${text}`,
  );

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    assert.fail(`rc-v2 route response is not valid JSON: ${text}`);
  }

  assert.ok(
    typeof json === "object" && json !== null,
    "rc-v2 route response must be a JSON object",
  );
});

test("authenticated chassis-to-rc KYC route responds with JSON", async (t) => {
  if (!SESSION_COOKIE) {
    t.skip("UPLOAD_TEST_SESSION_COOKIE missing; cannot test authenticated KYC routes");
    return;
  }

  const res = await postKyc(
    "/api/kyc/chassis-to-rc",
    { chassis_number: "MALBM51ABC123456", request_ref: "test-chassis-to-rc-route" },
    true,
  );

  const text = await res.text();
  assert.ok(
    res.status === 200 || res.status === 500,
    `Unexpected status ${res.status}: ${text}`,
  );

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    assert.fail(`chassis-to-rc route response is not valid JSON: ${text}`);
  }

  assert.ok(
    typeof json === "object" && json !== null,
    "chassis-to-rc route response must be a JSON object",
  );
});

test("authenticated Aadhaar validation KYC route responds with JSON", async (t) => {
  if (!SESSION_COOKIE) {
    t.skip("UPLOAD_TEST_SESSION_COOKIE missing; cannot test authenticated KYC routes");
    return;
  }

  const res = await postKyc(
    "/api/kyc/aadhaar-validation",
    { aadhaar_number: "917646971298", request_ref: "test-aadhaar-validation-route" },
    true,
  );

  const text = await res.text();
  assert.ok(
    res.status === 200 || res.status === 500,
    `Unexpected status ${res.status}: ${text}`,
  );

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    assert.fail(`aadhaar-validation route response is not valid JSON: ${text}`);
  }

  assert.ok(
    typeof json === "object" && json !== null,
    "aadhaar-validation route response must be a JSON object",
  );
});

test("authenticated driving-license KYC route responds with JSON", async (t) => {
  if (!SESSION_COOKIE) {
    t.skip("UPLOAD_TEST_SESSION_COOKIE missing; cannot test authenticated KYC routes");
    return;
  }

  const res = await postKyc(
    "/api/kyc/driving-license",
    { id_number: "UK0620130073251", dob: "1991-07-01", request_ref: "test-driving-license-route" },
    true,
  );

  const text = await res.text();
  assert.ok(
    res.status === 200 || res.status === 500,
    `Unexpected status ${res.status}: ${text}`,
  );

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    assert.fail(`driving-license route response is not valid JSON: ${text}`);
  }

  assert.ok(
    typeof json === "object" && json !== null,
    "driving-license route response must be a JSON object",
  );
});

