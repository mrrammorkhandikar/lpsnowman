import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "@shared/schema";

export const surepassKycStatuses = ["pending", "success", "failed"] as const;
export type SurepassKycStatus = typeof surepassKycStatuses[number];

export const surepassKycRequests = pgTable("surepass_kyc_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  requestType: text("request_type").notNull(),
  requestRef: text("request_ref"),
  status: text("status").default("pending"),
  requestHash: text("request_hash"),
  requestMasked: jsonb("request_masked"),
  responseMasked: jsonb("response_masked"),
  responseStatusCode: integer("response_status_code"),
  responseMessageCode: text("response_message_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSurepassKycRequestSchema = createInsertSchema(surepassKycRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSurepassKycRequest = z.infer<typeof insertSurepassKycRequestSchema>;
export type SurepassKycRequest = typeof surepassKycRequests.$inferSelect;
