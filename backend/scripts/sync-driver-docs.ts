import "dotenv/config";
import { storage } from "../src/storage";
import { syncDriverProfileDocuments } from "../src/driver-document-sync";

const driverId = process.argv[2] || "39985487-3899-4f2b-8911-20e0382d6da6";

async function main() {
  const driver = await storage.getDriver(driverId);
  if (!driver) throw new Error("driver not found");
  const synced = await syncDriverProfileDocuments(storage, driver);
  const docs = await storage.getDocumentsByDriver(driverId);
  console.log("synced profile urls", {
    licenseImageUrl: synced.licenseImageUrl,
    aadhaarImageUrl: synced.aadhaarImageUrl,
  });
  console.log("documents table", docs);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
