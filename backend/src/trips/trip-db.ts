import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "../db";
import * as tripSchema from "./trip-schema";

export const tripDb = drizzle(pool, { schema: tripSchema });
