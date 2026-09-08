import "dotenv/config";
import { Bc365Client } from "../src/bc365/client";
import { getBc365Config } from "../src/bc365/config";

async function main() {
  const client = new Bc365Client(getBc365Config());
  const companies = await client.listCompanies();
  const cronus = companies.find((c) => /cronus/i.test(c.displayName || c.name));
  const snowman = companies.find((c) => /snowman/i.test(c.displayName || c.name));
  if (cronus) {
    const customers = await client.listCustomers(cronus.id);
    console.log("cronusCustomerCount", customers.length);
    console.log("cronusSampleKeys", customers[0] ? Object.keys(customers[0]) : []);
    console.log("cronusSample", customers[0]);
  }
  if (snowman) {
    const customers = await client.listCustomers(snowman.id);
    console.log("snowmanCustomers", customers);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
