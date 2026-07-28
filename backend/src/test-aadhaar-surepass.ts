/**
 * Quick test: Aadhaar validation via Surepass plain API
 * Run with: npx tsx src/test-aadhaar-surepass.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = process.env.SUREPASS_KYC_BASE_URL || "https://kyc-api.surepass.app";
const TOKEN = process.env.SUREPASS_API_TOKEN || "";
const AADHAAR_NUMBER = process.argv[2] || "942826675530";

async function main() {
  console.log("=== Surepass Aadhaar Validation Test ===");
  console.log("Base URL :", BASE_URL);
  console.log("Token    :", TOKEN ? `${TOKEN.slice(0, 30)}...` : "MISSING");
  console.log("Aadhaar  :", AADHAAR_NUMBER);
  console.log("----------------------------------------");

  if (!TOKEN) {
    console.error("ERROR: SUREPASS_API_TOKEN is not set in backend/.env");
    process.exit(1);
  }

  const url = `${BASE_URL}/api/v1/aadhaar-validation/aadhaar-validation`;
  console.log("Calling  :", url);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ id_number: AADHAAR_NUMBER }),
    });

    const rawText = await response.text();
    console.log("\nHTTP Status:", response.status, response.statusText);
    console.log("Response Body:");
    try {
      console.log(JSON.stringify(JSON.parse(rawText), null, 2));
    } catch {
      console.log(rawText);
    }
  } catch (err: any) {
    console.error("\nNetwork/Fetch Error:", err.message);
  }
}

main();
