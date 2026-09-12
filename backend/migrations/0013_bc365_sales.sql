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
