-- Speeds up rate-limit COUNT in getRecentOtpRequestCount (phone + type + recent created_at)
CREATE INDEX IF NOT EXISTS "idx_otp_verifications_phone_type_created"
ON "otp_verifications" ("phone_number", "otp_type", "created_at" DESC);
