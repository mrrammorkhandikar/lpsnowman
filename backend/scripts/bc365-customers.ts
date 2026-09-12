import "dotenv/config";
import { bc365SalesClient } from "../src/bc365/client";
import { getBcSalesConfig } from "../src/bc365/config";

async function main() {
  const config = getBcSalesConfig();
  console.log("environment", config.environment);
  const companies = await bc365SalesClient.listCompanies();
  for (const company of companies) {
    const customers = await bc365SalesClient.listCustomers(company.id);
    console.log({
      company: company.displayName || company.name,
      id: company.id,
      customerCount: customers.length,
      customers: customers.map((c) => ({ number: c.number, name: c.displayName })),
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
