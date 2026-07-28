import twilio from "twilio";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
const verifyServiceSid = (process.env.TWILIO_VERIFY_SERVICE_SID || "").trim();
const isVerifySid = (s) => /^VA[a-f0-9]{32}$/i.test(s);

console.log("--- Twilio Configuration Check ---");
console.log("Account SID:", accountSid ? "Configured" : "MISSING");
console.log("Auth Token:", authToken ? "Configured" : "MISSING");
console.log("Verify Service SID:", verifyServiceSid ? "Configured" : "MISSING");
if (verifyServiceSid && !isVerifySid(verifyServiceSid)) {
  console.error(
    "\n❌ TWILIO_VERIFY_SERVICE_SID must be a Verify Service SID (VA + 32 hex chars).\n" +
      "   Do not use TWILIO_ACCOUNT_SID (AC…). Copy the SID from Console → Verify → Services.\n",
  );
}
console.log("----------------------------------");

if (!accountSid || !authToken || !verifyServiceSid) {
  console.error("Error: Twilio credentials missing in backend/.env");
  process.exit(1);
}

if (!isVerifySid(verifyServiceSid)) {
  process.exit(1);
}

const client = twilio(accountSid, authToken);
const phoneNumber = "+917218860925";

async function sendTestOtp() {
  console.log(`Attempting to send OTP to ${phoneNumber}...`);
  try {
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: phoneNumber, channel: "sms" });
    
    console.log("✅ Success!");
    console.log("Verification SID:", verification.sid);
    console.log("Status:", verification.status);
    console.log("Account SID:", verification.accountSid);
  } catch (error) {
    console.error("❌ Failed to send OTP");
    if (error.code) {
      console.error(`Twilio Error Code: ${error.code}`);
      console.error(`Twilio Error Message: ${error.message}`);
      if (error.moreInfo) console.error(`More Info: ${error.moreInfo}`);
      
      if (error.code === 21608) {
        console.error("\n💡 Insight: Error 21608 usually means you're using a Twilio Trial account and haven't verified this phone number in your Twilio Console yet.");
      }
      if (error.code === 60200) {
        console.error(
          "\n💡 Error 60200: Wrong Verify SID (use VA…), bad E.164 (+country…), wrong channel, or Verify geo permissions. See https://www.twilio.com/docs/api/errors/60200",
        );
      }
    } else {
      console.error("Unknown error:", error);
    }
  }
}

sendTestOtp();
