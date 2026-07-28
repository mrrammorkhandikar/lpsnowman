import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import dotenv from "dotenv";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { decryptPayload, encryptPayload } from "./surepass-crypto";
import { SurepassEncryptedClient } from "./surepass-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

function resolveKeyValue(value: string | undefined) {
  if (!value) return value;
  const match = value.match(/^\$\((?:cat|type)\s+(.+)\)$/);
  if (!match) return value;
  const relativePath = match[1].trim().replace(/^["']|["']$/g, "");
  const candidatePaths = [
    resolve(__dirname, "..", relativePath),
    resolve(__dirname, "..", "..", relativePath),
  ];
  const found = candidatePaths.find((p) => fs.existsSync(p));
  if (!found) return value;
  return fs.readFileSync(found, "utf8");
}

process.env.SUREPASS_CLIENT_PRIVATE_KEY = resolveKeyValue(process.env.SUREPASS_CLIENT_PRIVATE_KEY);
process.env.SUREPASS_PUBLIC_KEY = resolveKeyValue(process.env.SUREPASS_PUBLIC_KEY);

test("encrypts and decrypts payloads", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const publicPem = publicKey.export({ type: "pkcs1", format: "pem" }).toString();
  const privatePem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  const input = JSON.stringify({ pan_number: "FNMPM6342D" });
  const encrypted = encryptPayload(input, publicPem);
  const decrypted = decryptPayload(encrypted.encrypted, privatePem);
  assert.equal(decrypted, input);
});

test("surepass sandbox pan verification", async (t) => {
  const required = [
    "SUREPASS_CLIENT_ID",
    "SUREPASS_API_TOKEN",
    "SUREPASS_PUBLIC_KEY",
    "SUREPASS_CLIENT_PRIVATE_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    t.skip(`Missing env vars: ${missing.join(", ")}`);
    return;
  }
  const client = SurepassEncryptedClient.fromEnv();
  const response = await client.postJson("/api/v1/pan/pan", { pan_number: "FNMPM6342D" });
  assert.equal(typeof response.success, "boolean");
});
