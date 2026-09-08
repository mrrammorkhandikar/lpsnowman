import "dotenv/config";
import { updateBcSettings } from "../src/bc365/store";
import { fullPushToBc, getConnectionPreview } from "../src/bc365/sync-service";

const SNOWMAN_TEST_ID = "e3c4e8e7-73ab-f111-aaa8-70a8a5a815ca";

async function main() {
  const preview = await getConnectionPreview();
  console.log("connected", preview.connected);
  console.log("environment", preview.environment);
  console.log("companies", preview.companies);
  if (!preview.connected) {
    console.error(preview.error || "not connected");
    process.exit(1);
  }
  const target =
    preview.companies.find((c) => /snowman/i.test(c.name)) ||
    preview.companies.find((c) => c.id === SNOWMAN_TEST_ID);
  if (!target) {
    console.error("SnowmanTest company not found");
    process.exit(1);
  }
  await updateBcSettings({
    companyId: target.id,
    companyName: target.name,
    lastError: null,
  });
  console.log("targetCompany", target);
  const result = await fullPushToBc();
  console.log("pushStatus", result.report.connected, result.report.companyName);
  console.log("ourCount", result.report.ourCount);
  console.log("syncedCount", result.report.syncedCount);
  console.log("missingOnBc", result.report.missingOnBc);
  console.log("mismatchedCount", result.report.mismatchedCount);
  console.log("errorCount", result.errorCount);
  if (result.report.lastError) console.log("lastError", result.report.lastError);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
