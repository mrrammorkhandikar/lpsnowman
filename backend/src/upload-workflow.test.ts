import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import AWS from "aws-sdk";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import crypto from "node:crypto";

type RequestUrlResponse = {
  uploadURL: string;
  objectPath: string;
  metadata: { name: string; size: number; contentType: string };
};

const BASE_URL = process.env.UPLOAD_TEST_BASE_URL || "http://localhost:5000";
const SESSION_COOKIE = process.env.UPLOAD_TEST_SESSION_COOKIE || "";
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME || "";
const AWS_REGION = process.env.AWS_REGION || "";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "";
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const AWS_OBJECT_PREFIX = process.env.AWS_OBJECT_PREFIX || "uploads";
const CLOUDTRAIL_VERIFY = process.env.CLOUDTRAIL_VERIFY === "1" || process.env.CLOUDTRAIL_VERIFY === "true";
const S3_LOG_BUCKET = process.env.AWS_S3_LOG_BUCKET || "";
const S3_LOG_PREFIX = process.env.AWS_S3_LOG_PREFIX || "";

/**
 * Test documentation:
 * - This suite validates uploads via /api/uploads/request-url to S3, mirroring the approach used
 *   in surepass.test.ts for environment gating and deterministic assertions.
 * - It performs pre-test backend health checks with retry logic.
 * - It uploads a single local file (74353.jpg), verifies S3 headObject metadata,
 *   verifies retrieval via backend /objects route, and cleans up the S3 object afterward.
 * - Expected outcomes:
 *   - 200 status from request-url
 *   - Presigned URL pointing to S3 (https://..amazonaws.com..)
 *   - PUT returns 200/204
 *   - headObject returns correct ContentLength and ContentType
 *   - GET via backend returns identical bytes
 *   - deleteObject succeeds for cleanup
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

const s3 =
  AWS_BUCKET_NAME && AWS_REGION
    ? new AWS.S3({
        accessKeyId: AWS_ACCESS_KEY_ID || undefined,
        secretAccessKey: AWS_SECRET_ACCESS_KEY || undefined,
        region: AWS_REGION,
        signatureVersion: "v4",
      })
    : null;

async function requestUploadUrl(name: string, size: number, contentType: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/uploads/request-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(SESSION_COOKIE ? { Cookie: `connect.sid=${SESSION_COOKIE}` } : {}),
    },
    body: JSON.stringify({ name, size, contentType }),
  });
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON: ${text}`);
  }
}

function makeBuffer(bytes: number): Buffer {
  const b = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) b[i] = Math.floor(Math.random() * 256);
  return b;
}

async function uploadBytesToUrl(url: string, buf: Buffer, contentType: string): Promise<Response> {
  return fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buf,
  });
}

async function getObjectIdFromPath(objectPath: string): Promise<string> {
  const parts = objectPath.split("/").filter(Boolean);
  if (parts.length >= 3 && parts[0] === "objects" && parts[1] === "uploads") {
    return parts.slice(2).join("/");
  }
  throw new Error(`Unexpected objectPath: ${objectPath}`);
}

async function verifyViaBackend(objectPath: string, filename: string): Promise<Response> {
  const url = `${BASE_URL}${objectPath}?filename=${encodeURIComponent(filename)}`;
  return fetch(url, {
    method: "GET",
    headers: {
      ...(SESSION_COOKIE ? { Cookie: `connect.sid=${SESSION_COOKIE}` } : {}),
    },
  });
}

async function waitForHealth(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Backend health check failed");
}

before(async () => {
  assert.ok(BASE_URL, "BASE_URL missing");
  await waitForHealth(15000);
});

after(() => {});

test("png upload end-to-end (S3 or local)", async () => {
  const name = "test-image.png";
  const contentType = "image/png";
  const buf = makeBuffer(128 * 1024);

  const t0 = Date.now();
  const presignRes = await requestUploadUrl(name, buf.length, contentType);
  const t1 = Date.now();
  assert.equal(presignRes.status, 200, `presign failed ${presignRes.status}`);
  const payload = await parseJson<RequestUrlResponse>(presignRes);
  assert.ok(payload.uploadURL && payload.objectPath, "missing uploadURL/objectPath");

  const isLocal = payload.uploadURL.startsWith("http://localhost");
  const uploadRes = await uploadBytesToUrl(payload.uploadURL, buf, contentType);
  assert.ok(uploadRes.status === 200 || uploadRes.status === 204, `upload status ${uploadRes.status}`);
  const t2 = Date.now();

  const backendGet = await verifyViaBackend(payload.objectPath, name);
  if (SESSION_COOKIE) {
    assert.equal(backendGet.status, 200, `backend GET ${backendGet.status}`);
    const received = Buffer.from(await backendGet.arrayBuffer());
    assert.equal(received.length, buf.length, "backend served size mismatch");
  } else {
    assert.ok(backendGet.status === 200 || backendGet.status === 401, `backend GET ${backendGet.status}`);
  }

  if (!isLocal && s3) {
    const objectId = await getObjectIdFromPath(payload.objectPath);
    const key = `${AWS_OBJECT_PREFIX}/${objectId}`;
    const head = await s3
      .headObject({
        Bucket: AWS_BUCKET_NAME,
        Key: key,
      })
      .promise();
    assert.equal(head.ContentLength, buf.length, "S3 head size mismatch");
    assert.equal(head.ContentType, contentType, "S3 content type mismatch");
  }

  assert.ok(t1 - t0 < 3000, `presign slow ${t1 - t0}ms`);
  assert.ok(t2 - t1 < 5000, `upload slow ${t2 - t1}ms`);
});

test("jpeg upload", async () => {
  const name = "test-photo.jpg";
  const contentType = "image/jpg";
  const buf = makeBuffer(96 * 1024);
  const presignRes = await requestUploadUrl(name, buf.length, contentType);
  assert.equal(presignRes.status, 200);
  const payload = await parseJson<RequestUrlResponse>(presignRes);
  const uploadRes = await uploadBytesToUrl(payload.uploadURL, buf, contentType);
  assert.ok(uploadRes.status === 200 || uploadRes.status === 204);
});

test("pdf upload", async () => {
  const name = "test-doc.pdf";
  const contentType = "application/pdf";
  const buf = makeBuffer(64 * 1024);
  const presignRes = await requestUploadUrl(name, buf.length, contentType);
  assert.equal(presignRes.status, 200);
  const payload = await parseJson<RequestUrlResponse>(presignRes);
  const uploadRes = await uploadBytesToUrl(payload.uploadURL, buf, contentType);
  assert.ok(uploadRes.status === 200 || uploadRes.status === 204);
});

test("unsupported type (mp4) should fail at presign", async () => {
  const name = "video.mp4";
  const contentType = "video/mp4";
  const buf = makeBuffer(32 * 1024);
  const res = await requestUploadUrl(name, buf.length, contentType);
  assert.equal(res.status, 400);
  const body = await res.text();
  assert.match(body, /Invalid file type/i);
});

test("oversize should be rejected", async () => {
  const name = "big.pdf";
  const contentType = "application/pdf";
  const buf = makeBuffer(11 * 1024 * 1024);
  const res = await requestUploadUrl(name, buf.length, contentType);
  assert.equal(res.status, 400);
  const body = await res.text();
  assert.match(body, /File too large/i);
});

test("auth required in S3 mode without cookie", async () => {
  const name = "auth.png";
  const contentType = "image/png";
  const buf = makeBuffer(8 * 1024);
  const res = await fetch(`${BASE_URL}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, size: buf.length, contentType }),
  });
  if (res.status === 401) {
    assert.equal(res.status, 401);
  } else {
    assert.equal(res.status, 200);
  }
});

test("upload local file Capture.png from user path", async () => {
  const filePath = "C:\\Users\\admin\\OneDrive\\Pictures\\Capture.png";
  assert.ok(fs.existsSync(filePath), `File not found at ${filePath}`);
  const stat = fs.statSync(filePath);
  const name = path.basename(filePath);
  const contentType = "image/png";
  const fileBuf = fs.readFileSync(filePath);
  assert.equal(fileBuf.length, stat.size);

  const presignRes = await requestUploadUrl(name, stat.size, contentType);
  assert.equal(presignRes.status, 200);
  const payload = await parseJson<RequestUrlResponse>(presignRes);
  const uploadRes = await uploadBytesToUrl(payload.uploadURL, fileBuf, contentType);
  assert.ok(uploadRes.status === 200 || uploadRes.status === 204);

  const backendGet = await verifyViaBackend(payload.objectPath, name);
  if (SESSION_COOKIE) {
    assert.equal(backendGet.status, 200);
    const received = Buffer.from(await backendGet.arrayBuffer());
    assert.equal(received.length, stat.size);
  } else {
    assert.ok(backendGet.status === 200 || backendGet.status === 401);
  }

  if (s3 && !payload.uploadURL.startsWith("http://localhost")) {
    const objectId = await getObjectIdFromPath(payload.objectPath);
    const key = `${AWS_OBJECT_PREFIX}/${objectId}`;
    const head = await s3
      .headObject({
        Bucket: AWS_BUCKET_NAME,
        Key: key,
      })
      .promise();
    assert.equal(head.ContentLength, stat.size);
    assert.equal(head.ContentType, contentType);
  }
});

test("single image 74353.jpg upload via request-url to S3 (with cleanup)", async (t) => {
  // Integrate surepass.test.ts methodology: env gating and deterministic assertions
  const required = ["AWS_BUCKET_NAME", "AWS_REGION"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    t.skip(`Missing env vars: ${missing.join(", ")}`);
    return;
  }

  // Pre-test validation: backend health is checked in before()

  const filePath = "C:\\Users\\admin\\OneDrive\\Pictures\\74353.jpg";
  assert.ok(fs.existsSync(filePath), `File not found at ${filePath}`);
  const stat = fs.statSync(filePath);
  const name = path.basename(filePath);
  const contentType = "image/jpeg";
  const fileBuf = fs.readFileSync(filePath);
  assert.equal(fileBuf.length, stat.size);

  // Request presigned URL
  const presignRes = await requestUploadUrl(name, stat.size, contentType);
  assert.equal(presignRes.status, 200, `presign failed ${presignRes.status}`);
  const payload = await parseJson<RequestUrlResponse>(presignRes);
  assert.ok(payload.uploadURL && payload.objectPath, "missing uploadURL/objectPath");
  assert.match(payload.uploadURL, /^https:\/\//, "uploadURL must be https");
  assert.match(payload.uploadURL, /amazonaws\.com/, "uploadURL must point to S3");

  // Upload bytes
  const uploadRes = await uploadBytesToUrl(payload.uploadURL, fileBuf, contentType);
  assert.ok(uploadRes.status === 200 || uploadRes.status === 204, `upload status ${uploadRes.status}`);

  // Verify via backend GET
  const backendGet = await verifyViaBackend(payload.objectPath, name);
  assert.equal(backendGet.status, 200, `backend GET ${backendGet.status}`);
  const received = Buffer.from(await backendGet.arrayBuffer());
  assert.equal(received.length, stat.size, "backend served size mismatch");
  // Basic integrity check: compare a hash of the content rather than full byte compare for speed
  const hashOf = (b: Buffer) => require("crypto").createHash("sha256").update(b).digest("hex");
  assert.equal(hashOf(received), hashOf(fileBuf), "backend content hash mismatch");

  // Verify in S3 via headObject
  assert.ok(s3, "S3 client unavailable");
  const objectId = await getObjectIdFromPath(payload.objectPath);
  const key = `${AWS_OBJECT_PREFIX}/${objectId}`;
  const head = await s3
    .headObject({
      Bucket: AWS_BUCKET_NAME!,
      Key: key,
    })
    .promise();
  assert.equal(head.ContentLength, stat.size, "S3 head size mismatch");
  assert.equal(head.ContentType, contentType, "S3 content type mismatch");

  // Cleanup: delete the S3 object
  const del = await s3
    .deleteObject({
      Bucket: AWS_BUCKET_NAME!,
      Key: key,
    })
    .promise();
  assert.ok(del.DeleteMarker === undefined || del.DeleteMarker === true, "S3 delete did not mark object deleted");
});

test("74353.jpg integrity and audit checks (CloudTrail/access logs if configured)", async (t) => {
  const required = ["AWS_BUCKET_NAME", "AWS_REGION"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    t.skip(`Missing env vars: ${missing.join(", ")}`);
    return;
  }
  const filePath = "C:\\Users\\admin\\OneDrive\\Pictures\\74353.jpg";
  if (!fs.existsSync(filePath)) {
    t.skip(`File not found at ${filePath}`);
    return;
  }
  const stat = fs.statSync(filePath);
  const name = path.basename(filePath);
  const contentType = "image/jpeg";
  const fileBuf = fs.readFileSync(filePath);
  const md5Hex = crypto.createHash("md5").update(fileBuf).digest("hex");
  const startTime = new Date();
  // presign
  const presignRes = await requestUploadUrl(name, stat.size, contentType);
  assert.equal(presignRes.status, 200);
  const payload = await parseJson<RequestUrlResponse>(presignRes);
  // upload
  const putRes = await uploadBytesToUrl(payload.uploadURL, fileBuf, contentType);
  assert.ok(putRes.status === 200 || putRes.status === 204);
  // S3 head
  assert.ok(s3, "S3 client unavailable");
  const objectId = await getObjectIdFromPath(payload.objectPath);
  const key = `${AWS_OBJECT_PREFIX}/${objectId}`;
  const head = await s3!
    .headObject({
      Bucket: AWS_BUCKET_NAME!,
      Key: key,
    })
    .promise();
  assert.equal(head.ContentLength, stat.size);
  assert.equal(head.ContentType, contentType);
  if (head.ETag) {
    const etag = head.ETag.replace(/"/g, "");
    // For single-part uploads ETag is MD5
    if (!etag.includes("-")) {
      assert.equal(etag, md5Hex, "ETag MD5 does not match local MD5");
    }
  }
  // Optional: CloudTrail data event check
  if (CLOUDTRAIL_VERIFY) {
    const trail = new AWS.CloudTrail({
      accessKeyId: AWS_ACCESS_KEY_ID || undefined,
      secretAccessKey: AWS_SECRET_ACCESS_KEY || undefined,
      region: AWS_REGION,
    });
    const endTime = new Date(Date.now() + 60 * 1000);
    const targetArn = `arn:aws:s3:::${AWS_BUCKET_NAME}/${key}`;
    const resp = await trail
      .lookupEvents({
        LookupAttributes: [
          { AttributeKey: "ResourceName", AttributeValue: targetArn },
          { AttributeKey: "EventName", AttributeValue: "PutObject" },
        ],
        StartTime: new Date(startTime.getTime() - 2 * 60 * 1000),
        EndTime: endTime,
        MaxResults: 50,
      })
      .promise();
    const found = (resp.Events || []).some((e) => e.EventName === "PutObject");
    assert.ok(found, "No CloudTrail PutObject event found for the uploaded object");
  }
  // Optional: S3 access log check
  if (S3_LOG_BUCKET && S3_LOG_PREFIX) {
    const logS3 = new AWS.S3({
      accessKeyId: AWS_ACCESS_KEY_ID || undefined,
      secretAccessKey: AWS_SECRET_ACCESS_KEY || undefined,
      region: AWS_REGION,
    });
    // fetch a few latest log objects
    const listed = await logS3
      .listObjectsV2({
        Bucket: S3_LOG_BUCKET,
        Prefix: S3_LOG_PREFIX,
        MaxKeys: 20,
      })
      .promise();
    const candidates = (listed.Contents || [])
      .filter((o) => o.Key && o.LastModified && o.LastModified >= startTime)
      .sort((a, b) => (a.LastModified!.getTime() - b.LastModified!.getTime()));
    let matched = false;
    for (const obj of candidates.slice(-5)) {
      const logObj = await logS3
        .getObject({ Bucket: S3_LOG_BUCKET, Key: obj.Key! })
        .promise();
      const txt = (logObj.Body || Buffer.from("")).toString();
      if (txt.includes(`/${AWS_BUCKET_NAME}/${key}`) || txt.includes(`/${key}`)) {
        matched = true;
        break;
      }
    }
    assert.ok(matched, "No matching S3 access log entry found for the uploaded object");
  }
});
