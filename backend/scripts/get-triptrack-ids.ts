import { Client } from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  const res = await client.query(
    "SELECT id, triptrack_id FROM loads WHERE triptrack_id IS NOT NULL ORDER BY id"
  );
  console.log(JSON.stringify(res.rows, null, 2));
  console.log("Total:", res.rows.length);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
