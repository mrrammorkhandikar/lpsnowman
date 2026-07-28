import { test } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

test("intutrack login returns token", async (t) => {
  const required = ["INTUTRACK_BASE_URL", "INTUTRACK_USERNAME", "INTUTRACK_PASSWORD"];
  const missing = required.filter((key) => !getEnv(key));
  if (missing.length > 0) {
    t.skip(`Missing env vars: ${missing.join(", ")}`);
    return;
  }

  const baseUrl = getEnv("INTUTRACK_BASE_URL")!;
  const username = getEnv("INTUTRACK_USERNAME")!;
  const password = getEnv("INTUTRACK_PASSWORD")!;

  const encoded = Buffer.from(`${username}:${password}`).toString("base64");
  const res = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
    },
  });

  const payloadText = await res.text();
  assert.equal(res.ok, true, `IntuTrack login failed with status ${res.status}: ${payloadText}`);

  let json: any;
  try {
    json = JSON.parse(payloadText);
  } catch {
    assert.fail("IntuTrack login response is not valid JSON");
  }

  assert.equal(typeof json.token, "string");
  assert.ok(json.token.length > 0);
});

