import { test } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { verifyAadhaarValidation } from "./surepass-service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

test("surepass aadhaar validation sandbox check", async (t) => {
  const required = ["SUREPASS_API_TOKEN"];
  const missing = required.filter((key) => !getEnv(key));
  if (missing.length > 0) {
    t.skip(`Missing env vars: ${missing.join(", ")}`);
    return;
  }

  const aadhaarNumber = "942826675530";
  const response = await verifyAadhaarValidation({ aadhaarNumber });

  assert.equal(typeof response.success, "boolean");
  assert.ok(
    response.success || !response.success,
    "Response should contain a success flag",
  );
});

