-- Add IntuTrack trip tracking columns to loads (tripId + public map URL)
ALTER TABLE "loads" ADD COLUMN IF NOT EXISTS "triptrack_id" text;
ALTER TABLE "loads" ADD COLUMN IF NOT EXISTS "triptrack_map" text;
ALTER TABLE "loads" ADD COLUMN IF NOT EXISTS "triptrack_locations" jsonb;
