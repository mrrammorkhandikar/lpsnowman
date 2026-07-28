CREATE TABLE "trips" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "intutrack_trip_id" text UNIQUE,
  "truck_number" text,
  "invoice" text,
  "src_lat" numeric(10, 6),
  "src_lng" numeric(10, 6),
  "dest_lat" numeric(10, 6),
  "dest_lng" numeric(10, 6),
  "tel" text,
  "status" text DEFAULT 'SUBMITTED',
  "eta_hrs" integer,
  "tracking_state" text,
  "started_at" timestamp,
  "ended_at" timestamp,
  "public_link" text,
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "trips"
  ADD CONSTRAINT "trips_status_check"
  CHECK ("status" IN ('SUBMITTED', 'STARTED', 'ENDED'));
