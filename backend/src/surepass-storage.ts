import { eq } from "drizzle-orm";
import { surepassDb } from "./surepass-db";
import {
  surepassKycRequests,
  type InsertSurepassKycRequest,
  type SurepassKycRequest,
} from "./surepass-schema";

export async function createSurepassKycRequest(
  input: InsertSurepassKycRequest,
): Promise<SurepassKycRequest> {
  const [created] = await surepassDb.insert(surepassKycRequests).values(input).returning();
  return created;
}

export async function updateSurepassKycRequest(
  id: string,
  updates: Partial<SurepassKycRequest>,
): Promise<SurepassKycRequest | undefined> {
  const [updated] = await surepassDb
    .update(surepassKycRequests)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(surepassKycRequests.id, id))
    .returning();
  return updated;
}

export async function getSurepassKycRequest(
  id: string,
): Promise<SurepassKycRequest | undefined> {
  const [record] = await surepassDb
    .select()
    .from(surepassKycRequests)
    .where(eq(surepassKycRequests.id, id))
    .limit(1);
  return record;
}
