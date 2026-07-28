CREATE TABLE "surepass_kyc_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar REFERENCES "users"("id"),
  "request_type" text NOT NULL,
  "request_ref" text,
  "status" text DEFAULT 'pending',
  "request_hash" text,
  "request_masked" jsonb,
  "response_masked" jsonb,
  "response_status_code" integer,
  "response_message_code" text,
  "error_message" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

ALTER TABLE "surepass_kyc_requests"
  ADD CONSTRAINT "surepass_kyc_requests_status_check"
  CHECK ("status" IN ('pending', 'success', 'failed'));

CREATE INDEX "surepass_kyc_requests_user_id_idx" ON "surepass_kyc_requests" ("user_id");
CREATE INDEX "surepass_kyc_requests_type_idx" ON "surepass_kyc_requests" ("request_type");
CREATE INDEX "surepass_kyc_requests_created_at_idx" ON "surepass_kyc_requests" ("created_at");
