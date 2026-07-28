import "dotenv/config";
import { db } from "../src/db";
import { drivers, documents } from "../src/shared/schema";
import { desc, eq } from "drizzle-orm";

async function main() {
  const allDrivers = await db
    .select({
      id: drivers.id,
      name: drivers.name,
      carrierId: drivers.carrierId,
      userId: drivers.userId,
      licenseImageUrl: drivers.licenseImageUrl,
      aadhaarImageUrl: drivers.aadhaarImageUrl,
    })
    .from(drivers)
    .orderBy(desc(drivers.createdAt))
    .limit(5);

  console.log("Recent drivers:", JSON.stringify(allDrivers, null, 2));

  for (const d of allDrivers) {
    const driverDocs = await db.select().from(documents).where(eq(documents.driverId, d.id));
    const carrierDocs = d.carrierId
      ? await db.select().from(documents).where(eq(documents.userId, d.carrierId))
      : [];
    const driverUserDocs = d.userId
      ? await db.select().from(documents).where(eq(documents.userId, d.userId))
      : [];

    console.log("Driver", d.name, d.id.slice(0, 8));
    console.log(
      "  byDriverId:",
      driverDocs.map((x) => ({
        type: x.documentType,
        driverId: x.driverId,
        url: (x.fileUrl || "").slice(0, 80),
      })),
    );
    console.log(
      "  carrier driver-type:",
      carrierDocs
        .filter((x) =>
          ["license", "aadhaar", "aadhar", "driving_license", "pan_card"].includes(x.documentType),
        )
        .map((x) => ({
          type: x.documentType,
          driverId: x.driverId,
          url: (x.fileUrl || "").slice(0, 80),
        })),
    );
    console.log(
      "  driver user docs:",
      driverUserDocs.map((x) => ({
        type: x.documentType,
        driverId: x.driverId,
        url: (x.fileUrl || "").slice(0, 80),
      })),
    );
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
