import { pool } from "../src/db";

/**
 * Fix session table schema to add PRIMARY KEY constraint
 * This is required for connect-pg-simple to properly store and retrieve sessions
 */
async function fixSessionTable() {
  console.log("🔧 Fixing session table schema...");
  
  try {
    // Check if session table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'session'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("✅ Session table doesn't exist yet - will be created with correct schema");
      return;
    }
    
    // Check if PRIMARY KEY constraint exists
    const pkCheck = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'session' 
      AND constraint_type = 'PRIMARY KEY';
    `);
    
    if (pkCheck.rows.length > 0) {
      console.log("✅ Session table already has PRIMARY KEY constraint");
      return;
    }
    
    console.log("⚠️  Session table missing PRIMARY KEY - fixing now...");
    
    // Drop and recreate the session table with PRIMARY KEY
    // This will clear existing sessions but fix the schema
    await pool.query(`
      DROP TABLE IF EXISTS "session";
      CREATE TABLE "session" (
        "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      );
      CREATE INDEX "IDX_session_expire" ON "session" ("expire");
    `);
    
    console.log("✅ Session table fixed with PRIMARY KEY constraint");
    console.log("ℹ️  Note: Existing sessions were cleared - users will need to log in again");
    
  } catch (error) {
    console.error("❌ Error fixing session table:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixSessionTable()
  .then(() => {
    console.log("✅ Session table fix completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Session table fix failed:", error);
    process.exit(1);
  });
