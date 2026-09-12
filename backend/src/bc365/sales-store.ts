import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { bcSalesMaps } from "@shared/schema";

let schemaReady: Promise<void> | null = null;

export async function ensureBcSalesSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "bc_sales_maps" (
          "load_id" varchar PRIMARY KEY REFERENCES "loads"("id") ON DELETE CASCADE,
          "bc_customer_id" text,
          "bc_customer_number" text,
          "bc_order_id" text,
          "bc_order_number" text,
          "bc_invoice_id" text,
          "bc_invoice_number" text,
          "memo_id" text,
          "last_pushed_at" timestamp,
          "last_error" text,
          "created_at" timestamp DEFAULT now(),
          "updated_at" timestamp DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "idx_bc_sales_maps_order_id" ON "bc_sales_maps" ("bc_order_id");
      `);
    })();
  }
  await schemaReady;
}

export async function getBcSalesMap(loadId: string) {
  await ensureBcSalesSchema();
  const [row] = await db.select().from(bcSalesMaps).where(eq(bcSalesMaps.loadId, loadId));
  return row;
}

export async function getAllBcSalesMaps() {
  await ensureBcSalesSchema();
  return db.select().from(bcSalesMaps);
}

export async function upsertBcSalesMap(values: {
  loadId: string;
  bcCustomerId?: string | null;
  bcCustomerNumber?: string | null;
  bcOrderId?: string | null;
  bcOrderNumber?: string | null;
  bcInvoiceId?: string | null;
  bcInvoiceNumber?: string | null;
  memoId?: string | null;
  lastError?: string | null;
}) {
  const existing = await getBcSalesMap(values.loadId);
  const patch = {
    bcCustomerId: values.bcCustomerId ?? existing?.bcCustomerId,
    bcCustomerNumber: values.bcCustomerNumber ?? existing?.bcCustomerNumber,
    bcOrderId: values.bcOrderId ?? existing?.bcOrderId,
    bcOrderNumber: values.bcOrderNumber ?? existing?.bcOrderNumber,
    bcInvoiceId: values.bcInvoiceId ?? existing?.bcInvoiceId,
    bcInvoiceNumber: values.bcInvoiceNumber ?? existing?.bcInvoiceNumber,
    memoId: values.memoId ?? existing?.memoId,
    lastError: values.lastError ?? null,
    lastPushedAt: new Date(),
    updatedAt: new Date(),
  };
  if (existing) {
    const [row] = await db
      .update(bcSalesMaps)
      .set(patch)
      .where(eq(bcSalesMaps.loadId, values.loadId))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(bcSalesMaps)
    .values({
      loadId: values.loadId,
      ...patch,
    })
    .returning();
  return row;
}
