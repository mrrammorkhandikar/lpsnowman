import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/shared/schema.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

console.log("Testing connection to:", process.env.DATABASE_URL);

// Disable SSL for localhost tunnel, or enable if required by RDS even over tunnel?
// Usually RDS over tunnel acts like localhost, so no SSL or SSL mode prefer.
// But the connection string has ssl params maybe?
const client = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false }, 
  max: 1,
});

const db = drizzle(client, { schema });

async function main() {
  try {
    console.log("Connecting...");
    const result = await db.select().from(schema.users).limit(1);
    console.log("Connection successful!");
    console.log("Users found:", result.length);
    process.exit(0);
  } catch (error) {
    console.error("Connection failed:", error);
    process.exit(1);
  }
}

main();
