-- Track carrier advance payment release (idempotent)
ALTER TABLE finance_reviews
ADD COLUMN IF NOT EXISTS advance_payment_released_at TIMESTAMP NULL;

ALTER TABLE finance_reviews
ADD COLUMN IF NOT EXISTS advance_payment_released_by VARCHAR NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'finance_reviews_advance_payment_released_by_fkey'
  ) THEN
    ALTER TABLE finance_reviews
    ADD CONSTRAINT finance_reviews_advance_payment_released_by_fkey
    FOREIGN KEY (advance_payment_released_by)
    REFERENCES users(id);
  END IF;
END $$;
