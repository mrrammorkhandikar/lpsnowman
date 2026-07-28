-- Alter saved_addresses.shipper_id from integer to varchar to match the UUID user id
ALTER TABLE "saved_addresses" ALTER COLUMN "shipper_id" TYPE varchar USING "shipper_id"::varchar;
