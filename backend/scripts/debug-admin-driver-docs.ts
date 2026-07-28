import "dotenv/config";
import { storage } from "../src/storage";
import { documentMatchKey } from "../src/document-url-utils";

const driverId = "2b12e039-6bb3-46a0-a558-14a7ae9bbc46";

async function main() {
  const driver = await storage.getDriver(driverId);
  if (!driver) {
    console.log("Driver not found");
    return;
  }

  const driverDocTypes = new Set([
    "license",
    "driving_license",
    "aadhaar",
    "aadhar",
    "pan",
    "pan_card",
    "selfie",
    "address_proof",
  ]);

  const toDisplayDoc = (doc: {
    id: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    isVerified?: boolean | null;
  }) => ({
    id: doc.id,
    documentType: doc.documentType,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    isVerified: doc.isVerified === true,
  });

  const seenIds = new Set<string>();
  const seenUrlKeys = new Set<string>();
  const driverDocuments: ReturnType<typeof toDisplayDoc>[] = [];

  const pushDriverDoc = (doc: ReturnType<typeof toDisplayDoc>) => {
    const urlKey = documentMatchKey(doc.documentType, doc.fileUrl);
    if (urlKey && seenUrlKeys.has(urlKey)) return;
    if (seenIds.has(doc.id)) return;
    seenIds.add(doc.id);
    if (urlKey) seenUrlKeys.add(urlKey);
    driverDocuments.push(doc);
  };

  const [byDriverId, userDocs] = await Promise.all([
    storage.getDocumentsByDriver(driver.id),
    driver.userId ? storage.getDocumentsByUser(driver.userId) : Promise.resolve([]),
  ]);

  const allDbDocs = [
    ...byDriverId,
    ...userDocs.filter((doc) => {
      if (doc.driverId && doc.driverId !== driver.id) return false;
      const type = doc.documentType || "";
      return doc.driverId === driver.id || driverDocTypes.has(type);
    }),
  ];

  for (const doc of byDriverId) pushDriverDoc(toDisplayDoc(doc));
  for (const doc of userDocs) {
    if (doc.driverId && doc.driverId !== driver.id) continue;
    const type = doc.documentType || "";
    if (doc.driverId === driver.id || driverDocTypes.has(type)) {
      if (!doc.loadId) pushDriverDoc(toDisplayDoc(doc));
    }
  }

  const addProfileIfMissing = (
    type: string,
    fileUrl: string | null | undefined,
    fileName: string,
  ) => {
    if (!fileUrl) return;
    const urlKey = documentMatchKey(type, fileUrl);
    console.log("addProfileIfMissing", type, "urlKey=", urlKey);
    if (!urlKey || seenUrlKeys.has(urlKey)) return;

    const dbMatch = allDbDocs.find(
      (d) => documentMatchKey(d.documentType, d.fileUrl) === urlKey,
    );
    if (dbMatch) {
      pushDriverDoc(toDisplayDoc(dbMatch));
      return;
    }

    pushDriverDoc({
      id: `${driver.id}-${type}-profile`,
      documentType: type,
      fileName,
      fileUrl,
      isVerified: false,
    });
  };

  addProfileIfMissing("license", driver.licenseImageUrl, "Driving License");
  addProfileIfMissing("aadhaar", driver.aadhaarImageUrl, "Aadhaar Card");

  console.log("Result:", JSON.stringify(driverDocuments, null, 2));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
