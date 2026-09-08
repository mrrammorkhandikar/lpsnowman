import "dotenv/config";
import { Bc365Client, explainBc365Error } from "../src/bc365/client";
import { getBc365Config } from "../src/bc365/config";

async function main() {
  const config = getBc365Config();
  console.log("configured", config.enabled);
  console.log("environment", config.environment);
  const client = new Bc365Client(config);
  try {
    await client.pingToken();
    console.log("azureToken", "ok");
  } catch (error) {
    console.log("azureToken", "fail");
    console.log("hint", explainBc365Error(error));
    process.exit(1);
  }
  try {
    const companies = await client.listCompanies();
    console.log("bcCompanies", "ok");
    console.log(
      "companies",
      companies.map((c) => ({ id: c.id, name: c.displayName || c.name })),
    );
  } catch (error) {
    console.log("bcCompanies", "fail");
    console.log("hint", explainBc365Error(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("probe_failed", explainBc365Error(error));
  process.exit(1);
});
