-- Add physical POD submission tracking
ALTER TABLE shipments ADD COLUMN physical_pod_submitted_at TIMESTAMP;
