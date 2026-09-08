import "dotenv/config";
import { Bc365Client } from "../src/bc365/client";
import { getBc365Config } from "../src/bc365/config";

async function main() {
  const client = new Bc365Client(getBc365Config());
  const companies = await client.listCompanies();
  const cronus = companies.find((c) => /cronus/i.test(c.displayName || c.name));
  if (!cronus) {
    console.log("no cronus");
    return;
  }
  const orders = await client.listSalesOrders(cronus.id);
  const sample = orders[0];
  console.log("orderCount", orders.length);
  console.log("keys", sample ? Object.keys(sample) : []);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
