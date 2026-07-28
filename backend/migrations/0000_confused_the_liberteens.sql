CREATE TABLE "admin_actions_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"action_type" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'pending',
	"priority" integer DEFAULT 0,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"last_error" text,
	"scheduled_for" timestamp,
	"processed_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" varchar NOT NULL,
	"load_id" varchar,
	"user_id" varchar,
	"action_type" text NOT NULL,
	"action_description" text,
	"reason" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"admin_id" varchar NOT NULL,
	"suggested_price" numeric(12, 2) NOT NULL,
	"final_price" numeric(12, 2) NOT NULL,
	"posting_mode" text NOT NULL,
	"invited_carrier_ids" text[],
	"comment" text,
	"pricing_breakdown" jsonb,
	"action_type" text DEFAULT 'price_and_post',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_pricings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"admin_id" varchar NOT NULL,
	"template_id" varchar,
	"suggested_price" numeric(12, 2) NOT NULL,
	"final_price" numeric(12, 2),
	"markup_percent" numeric(5, 2) DEFAULT '0',
	"fixed_fee" numeric(12, 2) DEFAULT '0',
	"fuel_override" numeric(12, 2),
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"payout_estimate" numeric(12, 2),
	"platform_margin" numeric(12, 2),
	"platform_margin_percent" numeric(5, 2),
	"status" text DEFAULT 'draft',
	"requires_approval" boolean DEFAULT false,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"post_mode" text,
	"invited_carrier_ids" text[],
	"notes" text,
	"price_breakdown" jsonb,
	"confidence_score" integer,
	"risk_flags" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar,
	"user_id" varchar,
	"endpoint" text NOT NULL,
	"method" text NOT NULL,
	"request_body" jsonb,
	"response_body" jsonb,
	"status_code" integer,
	"error_message" text,
	"duration_ms" integer,
	"ip_address" text,
	"user_agent" text,
	"log_type" text DEFAULT 'request',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bid_negotiations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_id" varchar,
	"load_id" varchar NOT NULL,
	"sender_id" varchar,
	"sender_role" text NOT NULL,
	"message_type" text DEFAULT 'carrier_bid',
	"message" text,
	"amount" numeric(12, 2),
	"previous_amount" numeric(12, 2),
	"is_simulated" boolean DEFAULT false,
	"simulated_carrier_name" text,
	"carrier_name" text,
	"carrier_type" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"carrier_id" varchar NOT NULL,
	"truck_id" varchar,
	"driver_id" varchar,
	"amount" numeric(12, 2) NOT NULL,
	"counter_amount" numeric(12, 2),
	"estimated_pickup" timestamp,
	"estimated_delivery" timestamp,
	"notes" text,
	"status" text DEFAULT 'pending',
	"bid_type" text DEFAULT 'carrier_bid',
	"carrier_type" text DEFAULT 'enterprise',
	"approval_required" boolean DEFAULT false,
	"admin_mediated" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"carrier_type" text DEFAULT 'enterprise',
	"company_name" text,
	"company_phone" text,
	"city" text,
	"operating_region" text,
	"fleet_size" integer DEFAULT 1,
	"service_zones" text[],
	"reliability_score" numeric(3, 2) DEFAULT '0',
	"communication_score" numeric(3, 2) DEFAULT '0',
	"on_time_score" numeric(3, 2) DEFAULT '0',
	"total_deliveries" integer DEFAULT 0,
	"badge_level" text DEFAULT 'bronze',
	"rating" numeric(2, 1) DEFAULT '4.5',
	"bio" text
);
--> statement-breakpoint
CREATE TABLE "carrier_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"invoice_id" varchar,
	"carrier_id" varchar NOT NULL,
	"admin_id" varchar NOT NULL,
	"proposed_payout" numeric(12, 2) NOT NULL,
	"line_items" jsonb,
	"message" text,
	"expires_at" timestamp,
	"status" text DEFAULT 'pending',
	"counter_amount" numeric(12, 2),
	"counter_message" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" varchar NOT NULL,
	"shipper_id" varchar NOT NULL,
	"shipment_id" varchar NOT NULL,
	"load_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_settlements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"carrier_id" varchar NOT NULL,
	"invoice_id" varchar,
	"gross_amount" numeric(12, 2) NOT NULL,
	"platform_fee" numeric(12, 2) DEFAULT '0',
	"deductions" numeric(12, 2) DEFAULT '0',
	"deduction_reason" text,
	"net_payout" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'pending',
	"scheduled_date" timestamp,
	"paid_at" timestamp,
	"payment_method" text,
	"transaction_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_verification_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" varchar NOT NULL,
	"carrier_id" varchar NOT NULL,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"expiry_date" timestamp,
	"status" text DEFAULT 'pending',
	"rejection_reason" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" varchar NOT NULL,
	"status" text DEFAULT 'draft',
	"carrier_type" text DEFAULT 'solo',
	"fleet_size" integer DEFAULT 1,
	"aadhaar_number" text,
	"driver_license_number" text,
	"permit_type" text,
	"unique_registration_number" text,
	"chassis_number" text,
	"license_plate_number" text,
	"incorporation_type" text,
	"business_type" text,
	"cin_number" text,
	"partner_name" text,
	"business_registration_number" text,
	"business_address" text,
	"business_locality" text,
	"pan_number" text,
	"gstin_number" text,
	"no_gstin_number" boolean DEFAULT false,
	"tan_number" text,
	"address_proof_type" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_ifsc_code" text,
	"bank_account_holder_name" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"expires_at" timestamp,
	"notes" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"subject" varchar(255),
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"load_id" varchar,
	"shipment_id" varchar,
	"truck_id" varchar,
	"driver_id" varchar,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"expiry_date" timestamp,
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "driver_behavior_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"truck_id" varchar,
	"load_id" varchar,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'low',
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"speed" integer,
	"acceleration_g" numeric(4, 2),
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" varchar NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"license_number" text,
	"license_expiry" timestamp,
	"license_image_url" text,
	"aadhaar_number" text,
	"aadhaar_image_url" text,
	"status" text DEFAULT 'available',
	"assigned_truck_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT false,
	"target_roles" text[],
	"metadata" jsonb,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "feature_flags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "finance_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" varchar NOT NULL,
	"load_id" varchar NOT NULL,
	"reviewer_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"comment" text,
	"payment_status" text DEFAULT 'not_released' NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gps_breadcrumbs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"load_id" varchar,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"speed" integer,
	"heading" integer,
	"is_risky_segment" boolean DEFAULT false,
	"risk_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb,
	"previous_values" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"load_id" varchar NOT NULL,
	"shipper_id" varchar NOT NULL,
	"admin_id" varchar NOT NULL,
	"pricing_id" varchar,
	"base_freight" numeric(12, 2) DEFAULT '0',
	"rate_per_km" numeric(10, 2),
	"distance_km" numeric(10, 2),
	"diesel_adjustment" numeric(12, 2) DEFAULT '0',
	"toll_estimate" numeric(12, 2) DEFAULT '0',
	"driver_bata" numeric(12, 2) DEFAULT '0',
	"loading_charges" numeric(12, 2) DEFAULT '0',
	"unloading_charges" numeric(12, 2) DEFAULT '0',
	"subtotal" numeric(12, 2) NOT NULL,
	"fuel_surcharge" numeric(12, 2) DEFAULT '0',
	"toll_charges" numeric(12, 2) DEFAULT '0',
	"handling_fee" numeric(12, 2) DEFAULT '0',
	"insurance_fee" numeric(12, 2) DEFAULT '0',
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"discount_reason" text,
	"gst_applicable" boolean DEFAULT true,
	"gst_percent" numeric(5, 2) DEFAULT '18',
	"cgst_amount" numeric(12, 2) DEFAULT '0',
	"sgst_amount" numeric(12, 2) DEFAULT '0',
	"igst_amount" numeric(12, 2) DEFAULT '0',
	"hsn_sac_code" text,
	"shipper_gstin" text,
	"carrier_gstin" text,
	"tax_percent" numeric(5, 2) DEFAULT '18',
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"eway_bill_required" boolean DEFAULT false,
	"eway_bill_number" text,
	"eway_bill_valid_until" timestamp,
	"payment_terms" text DEFAULT 'Net 30',
	"payment_terms_days" integer DEFAULT 30,
	"due_date" timestamp,
	"advance_payment_percent" integer,
	"advance_payment_amount" numeric(12, 2),
	"balance_on_delivery" numeric(12, 2),
	"status" text DEFAULT 'draft',
	"notes" text,
	"line_items" jsonb,
	"shipper_response_type" text,
	"shipper_response_message" text,
	"shipper_counter_amount" numeric(12, 2),
	"shipper_status" text DEFAULT 'pending',
	"negotiation_thread_id" varchar,
	"counter_contact_name" text,
	"counter_contact_company" text,
	"counter_contact_phone" text,
	"counter_contact_address" text,
	"counter_reason" text,
	"countered_at" timestamp,
	"countered_by" varchar,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"paid_amount" numeric(12, 2),
	"payment_method" text,
	"payment_reference" text,
	"shipper_confirmed" boolean DEFAULT false,
	"shipper_confirmed_at" timestamp,
	"shipper_confirmed_by" varchar,
	"pdf_url" text,
	"attachments" jsonb,
	"idempotency_key" text,
	"revision_number" integer DEFAULT 1,
	"previous_invoice_id" varchar,
	"version" integer DEFAULT 1,
	"platform_margin" numeric(12, 2) DEFAULT '0',
	"estimated_carrier_payout" numeric(12, 2) DEFAULT '0',
	"currency" text DEFAULT 'INR',
	"price_locked_by" varchar,
	"price_locked_at" timestamp,
	"last_updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "load_state_change_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipper_id" varchar NOT NULL,
	"assigned_carrier_id" varchar,
	"assigned_truck_id" varchar,
	"shipper_load_number" integer,
	"admin_reference_number" integer,
	"shipper_reference_number" text,
	"pickup_id" varchar(4),
	"shipper_company_name" text,
	"shipper_contact_name" text,
	"shipper_company_address" text,
	"shipper_phone" text,
	"pickup_address" text NOT NULL,
	"pickup_locality" text,
	"pickup_landmark" text,
	"pickup_business_name" text,
	"pickup_city" text NOT NULL,
	"pickup_state" text,
	"pickup_pincode" text,
	"pickup_lat" numeric(10, 7),
	"pickup_lng" numeric(10, 7),
	"dropoff_address" text NOT NULL,
	"dropoff_locality" text,
	"dropoff_landmark" text,
	"dropoff_business_name" text,
	"dropoff_city" text NOT NULL,
	"dropoff_state" text,
	"dropoff_pincode" text,
	"dropoff_lat" numeric(10, 7),
	"dropoff_lng" numeric(10, 7),
	"distance" numeric(10, 2),
	"receiver_name" text,
	"receiver_phone" text,
	"receiver_email" text,
	"weight" numeric(10, 2) NOT NULL,
	"weight_unit" text DEFAULT 'MT',
	"cargo_description" text,
	"goods_to_be_carried" text,
	"special_notes" text,
	"shipper_price_per_ton" numeric(10, 2),
	"shipper_fixed_price" numeric(12, 2),
	"rate_type" text DEFAULT 'per_ton',
	"material_type" text,
	"required_truck_type" text,
	"estimated_price" numeric(12, 2),
	"final_price" numeric(12, 2),
	"admin_suggested_price" numeric(12, 2),
	"admin_final_price" numeric(12, 2),
	"advance_payment_percent" integer,
	"carrier_advance_percent" integer,
	"price_locked" boolean DEFAULT false,
	"price_locked_by" varchar,
	"price_locked_at" timestamp,
	"price_breakdown" jsonb,
	"pickup_date" timestamp,
	"delivery_date" timestamp,
	"status" text DEFAULT 'draft',
	"previous_status" text,
	"status_changed_by" varchar,
	"status_changed_at" timestamp,
	"status_note" text,
	"invoice_id" varchar,
	"invoice_sent_at" timestamp,
	"invoice_approved_at" timestamp,
	"open_for_bid_at" timestamp,
	"bidding_closed_at" timestamp,
	"awarded_at" timestamp,
	"awarded_bid_id" varchar,
	"admin_post_mode" text,
	"admin_id" varchar,
	"admin_decision_id" varchar,
	"invited_carrier_ids" text[],
	"allow_counter_bids" boolean DEFAULT true,
	"gst_applicable" boolean DEFAULT true,
	"eway_bill_required" boolean DEFAULT false,
	"eway_bill_number" text,
	"is_template" boolean DEFAULT false,
	"template_name" text,
	"kyc_verified" boolean DEFAULT false,
	"priority" text DEFAULT 'normal',
	"admin_employee_code" text,
	"admin_employee_name" text,
	"version" integer DEFAULT 1,
	"submitted_at" timestamp,
	"posted_at" timestamp,
	"last_updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text',
	"bid_id" varchar,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "negotiation_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"status" text DEFAULT 'pending_review',
	"total_bids" integer DEFAULT 0,
	"real_bids" integer DEFAULT 0,
	"simulated_bids" integer DEFAULT 0,
	"pending_counters" integer DEFAULT 0,
	"accepted_bid_id" varchar,
	"accepted_carrier_id" varchar,
	"accepted_amount" numeric(12, 2),
	"last_activity_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "negotiation_threads_load_id_unique" UNIQUE("load_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info',
	"related_load_id" varchar,
	"related_bid_id" varchar,
	"related_invoice_id" varchar,
	"context_type" text DEFAULT 'load',
	"context_tab" text,
	"action_url" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "otp_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_type" text NOT NULL,
	"carrier_id" varchar NOT NULL,
	"shipment_id" varchar NOT NULL,
	"load_id" varchar NOT NULL,
	"status" text DEFAULT 'pending',
	"requested_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	"processed_by" varchar,
	"otp_id" varchar,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"otp_type" text NOT NULL,
	"otp_code" text NOT NULL,
	"user_id" varchar,
	"carrier_id" varchar,
	"shipment_id" varchar,
	"load_id" varchar,
	"phone_number" text,
	"status" text DEFAULT 'pending',
	"generated_by" varchar,
	"validity_minutes" integer DEFAULT 10,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3
);
--> statement-breakpoint
CREATE TABLE "pricing_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"markup_percent" numeric(5, 2) DEFAULT '0',
	"fixed_fee" numeric(12, 2) DEFAULT '0',
	"fuel_surcharge_percent" numeric(5, 2) DEFAULT '0',
	"platform_rate_percent" numeric(5, 2) DEFAULT '10',
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"rater_id" varchar NOT NULL,
	"rated_user_id" varchar NOT NULL,
	"reliability" integer NOT NULL,
	"communication" integer NOT NULL,
	"on_time_delivery" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "route_eta_predictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"distance_remaining" numeric(10, 2),
	"distance_unit" text DEFAULT 'km',
	"current_eta" timestamp,
	"original_eta" timestamp,
	"delay_minutes" integer DEFAULT 0,
	"delay_risk" text DEFAULT 'low',
	"traffic_condition" text DEFAULT 'normal',
	"weather_condition" text DEFAULT 'clear',
	"better_route_available" boolean DEFAULT false,
	"better_route_savings_minutes" integer,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_addresses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saved_addresses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"shipper_id" integer NOT NULL,
	"address_type" varchar(20) NOT NULL,
	"label" varchar(100),
	"business_name" varchar(200),
	"address" varchar(500),
	"locality" varchar(200),
	"landmark" varchar(200),
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"contact_name" varchar(200),
	"contact_phone" varchar(20),
	"contact_email" varchar(200),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"usage_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"location" text,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" varchar NOT NULL,
	"carrier_id" varchar NOT NULL,
	"shipper_id" varchar,
	"truck_id" varchar,
	"driver_id" varchar,
	"status" text DEFAULT 'pickup_scheduled',
	"current_lat" numeric(10, 7),
	"current_lng" numeric(10, 7),
	"current_location" text,
	"eta" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"start_otp_requested" boolean DEFAULT false,
	"start_otp_requested_at" timestamp,
	"start_otp_verified" boolean DEFAULT false,
	"start_otp_verified_at" timestamp,
	"route_start_otp_requested" boolean DEFAULT false,
	"route_start_otp_requested_at" timestamp,
	"route_start_otp_verified" boolean DEFAULT false,
	"route_start_otp_verified_at" timestamp,
	"end_otp_requested" boolean DEFAULT false,
	"end_otp_requested_at" timestamp,
	"end_otp_verified" boolean DEFAULT false,
	"end_otp_verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "shipper_credit_evaluations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipper_id" varchar NOT NULL,
	"assessor_id" varchar,
	"evaluation_type" text DEFAULT 'manual',
	"previous_credit_limit" numeric(12, 2),
	"new_credit_limit" numeric(12, 2),
	"previous_risk_level" text,
	"new_risk_level" text,
	"previous_credit_score" integer,
	"new_credit_score" integer,
	"previous_payment_terms" integer,
	"new_payment_terms" integer,
	"decision" text NOT NULL,
	"rationale" text,
	"scoring_breakdown" text,
	"supporting_documents" text[],
	"evaluated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipper_credit_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipper_id" varchar NOT NULL,
	"credit_limit" numeric(12, 2) DEFAULT '0',
	"credit_score" integer DEFAULT 0,
	"risk_level" text DEFAULT 'medium',
	"payment_terms" integer DEFAULT 30,
	"outstanding_balance" numeric(12, 2) DEFAULT '0',
	"available_credit" numeric(12, 2) DEFAULT '0',
	"total_loads_completed" integer DEFAULT 0,
	"on_time_payment_rate" numeric(5, 2) DEFAULT '0',
	"average_payment_days" numeric(5, 1) DEFAULT '0',
	"last_assessment_at" timestamp,
	"last_assessed_by" varchar,
	"last_auto_assessment_at" timestamp,
	"is_manual_override" boolean DEFAULT false,
	"auto_suggested_score" integer,
	"auto_suggested_risk_level" text,
	"auto_suggested_credit_limit" numeric(12, 2),
	"annual_revenue" numeric(16, 2),
	"total_assets" numeric(16, 2),
	"debt_summary" text,
	"cash_flow_rating" text,
	"liquidity_ratio" numeric(5, 2),
	"debt_to_equity_ratio" numeric(5, 2),
	"outstanding_debt_amount" numeric(14, 2),
	"business_years_in_operation" integer,
	"company_scale" text,
	"payment_history_score" integer,
	"average_days_to_pay" integer,
	"late_payment_count" integer DEFAULT 0,
	"reputation_rating" text,
	"gst_compliant" boolean DEFAULT false,
	"gst_number" text,
	"income_tax_compliant" boolean DEFAULT false,
	"dgft_registered" boolean DEFAULT false,
	"dgft_iec_number" text,
	"has_valid_contracts" boolean DEFAULT false,
	"contract_types" text,
	"confirmed_orders_value" numeric(16, 2),
	"external_credit_score" integer,
	"credit_bureau_score" integer,
	"last_credit_bureau_check" timestamp,
	"has_public_records" boolean DEFAULT false,
	"public_records_details" text,
	"credit_utilization_percent" numeric(5, 2),
	"financial_analysis_notes" text,
	"qualitative_assessment_notes" text,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipper_invoice_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"load_id" varchar NOT NULL,
	"shipper_id" varchar NOT NULL,
	"response_type" text NOT NULL,
	"message" text,
	"counter_amount" numeric(12, 2),
	"attachments" jsonb,
	"admin_response" text,
	"admin_responded_at" timestamp,
	"admin_id" varchar,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipper_onboarding_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipper_id" varchar NOT NULL,
	"status" text DEFAULT 'draft',
	"shipper_role" text DEFAULT 'shipper',
	"legal_company_name" text,
	"trade_name" text,
	"business_type" text,
	"incorporation_date" timestamp,
	"cin_number" text,
	"pan_number" text,
	"gstin_number" text,
	"registered_address" text,
	"registered_locality" text,
	"registered_city" text,
	"registered_city_custom" text,
	"registered_state" text,
	"registered_country" text DEFAULT 'India',
	"registered_pincode" text,
	"operating_regions" text[],
	"primary_commodities" text[],
	"estimated_monthly_loads" integer,
	"avg_load_value_inr" numeric(12, 2),
	"contact_person_name" text,
	"contact_person_designation" text,
	"contact_person_phone" text,
	"contact_person_email" text,
	"gst_certificate_url" text,
	"no_gst_certificate" boolean DEFAULT false,
	"alternative_document_type" text,
	"alternative_authorization_url" text,
	"pan_card_url" text,
	"incorporation_certificate_url" text,
	"cancelled_cheque_url" text,
	"business_address_proof_type" text,
	"business_address_proof_url" text,
	"selfie_url" text,
	"msme_url" text,
	"udyam_url" text,
	"lr_copy_url" text,
	"aadhaar_number" text,
	"aadhaar_card_url" text,
	"trade_reference_1_company" text,
	"trade_reference_1_contact" text,
	"trade_reference_1_phone" text,
	"trade_reference_2_company" text,
	"trade_reference_2_contact" text,
	"trade_reference_2_phone" text,
	"referral_source" text,
	"referral_sales_person_name" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_ifsc_code" text,
	"bank_branch_name" text,
	"preferred_payment_terms" text,
	"requested_credit_limit" numeric(12, 2),
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"decision_note" text,
	"follow_up_date" timestamp,
	"credit_assessment_id" varchar,
	"proposed_credit_limit" numeric(12, 2),
	"proposed_payment_terms" text,
	"credit_limit_accepted" boolean,
	"credit_limit_accepted_at" timestamp,
	"credit_limit_response" text,
	"submitted_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipper_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipper_id" varchar NOT NULL,
	"carrier_id" varchar NOT NULL,
	"shipment_id" varchar NOT NULL,
	"load_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "telematics_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"load_id" varchar,
	"driver_id" varchar,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'warning',
	"message" text NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"value" numeric(10, 2),
	"threshold" numeric(10, 2),
	"is_acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trucks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" varchar NOT NULL,
	"truck_type" text NOT NULL,
	"license_plate" text NOT NULL,
	"capacity" integer NOT NULL,
	"capacity_unit" text DEFAULT 'tons',
	"is_available" boolean DEFAULT true,
	"current_lat" numeric(10, 7),
	"current_lng" numeric(10, 7),
	"current_location" text,
	"created_at" timestamp DEFAULT now(),
	"make" text,
	"model" text,
	"year" integer,
	"city" text,
	"registration_date" timestamp,
	"chassis_number" text,
	"registration_number" text,
	"body_type" text,
	"permit_type" text,
	"insurance_expiry" timestamp,
	"fitness_expiry" timestamp,
	"permit_expiry" timestamp,
	"puc_expiry" timestamp,
	"rc_document_url" text,
	"insurance_document_url" text,
	"fitness_document_url" text,
	"permit_document_url" text,
	"puc_document_url" text,
	"rc_verified" boolean DEFAULT false,
	"insurance_verified" boolean DEFAULT false,
	"fitness_verified" boolean DEFAULT false,
	"permit_verified" boolean DEFAULT false,
	"puc_verified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_number" serial NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'shipper' NOT NULL,
	"company_name" text,
	"company_address" text,
	"phone" text,
	"avatar" text,
	"is_verified" boolean DEFAULT false,
	"default_pickup_address" text,
	"default_pickup_locality" text,
	"default_pickup_landmark" text,
	"default_pickup_city" text,
	"last_active_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_user_number_unique" UNIQUE("user_number"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicle_telemetry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"truck_id" varchar,
	"load_id" varchar,
	"driver_id" varchar,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"speed" integer DEFAULT 0,
	"rpm" integer DEFAULT 0,
	"fuel_level" integer DEFAULT 100,
	"engine_temp" integer DEFAULT 80,
	"battery_voltage" numeric(4, 1) DEFAULT '12.6',
	"odometer" numeric(12, 1) DEFAULT '0',
	"load_weight" numeric(10, 2),
	"max_capacity" numeric(10, 2),
	"heading" integer DEFAULT 0,
	"altitude" integer DEFAULT 0,
	"is_ignition_on" boolean DEFAULT true,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "help_bot_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_bot_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_actions_queue" ADD CONSTRAINT "admin_actions_queue_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions_queue" ADD CONSTRAINT "admin_actions_queue_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_decisions" ADD CONSTRAINT "admin_decisions_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_decisions" ADD CONSTRAINT "admin_decisions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_pricings" ADD CONSTRAINT "admin_pricings_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_pricings" ADD CONSTRAINT "admin_pricings_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_pricings" ADD CONSTRAINT "admin_pricings_template_id_pricing_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."pricing_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_pricings" ADD CONSTRAINT "admin_pricings_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_pricings" ADD CONSTRAINT "admin_pricings_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_negotiations" ADD CONSTRAINT "bid_negotiations_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_negotiations" ADD CONSTRAINT "bid_negotiations_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_negotiations" ADD CONSTRAINT "bid_negotiations_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_profiles" ADD CONSTRAINT "carrier_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_proposals" ADD CONSTRAINT "carrier_proposals_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_proposals" ADD CONSTRAINT "carrier_proposals_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_proposals" ADD CONSTRAINT "carrier_proposals_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_proposals" ADD CONSTRAINT "carrier_proposals_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_ratings" ADD CONSTRAINT "carrier_ratings_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_ratings" ADD CONSTRAINT "carrier_ratings_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_ratings" ADD CONSTRAINT "carrier_ratings_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_ratings" ADD CONSTRAINT "carrier_ratings_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_settlements" ADD CONSTRAINT "carrier_settlements_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_settlements" ADD CONSTRAINT "carrier_settlements_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_settlements" ADD CONSTRAINT "carrier_settlements_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_verification_documents" ADD CONSTRAINT "carrier_verification_documents_verification_id_carrier_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."carrier_verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_verification_documents" ADD CONSTRAINT "carrier_verification_documents_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_verification_documents" ADD CONSTRAINT "carrier_verification_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_verifications" ADD CONSTRAINT "carrier_verifications_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_verifications" ADD CONSTRAINT "carrier_verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_behavior_events" ADD CONSTRAINT "driver_behavior_events_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_behavior_events" ADD CONSTRAINT "driver_behavior_events_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_behavior_events" ADD CONSTRAINT "driver_behavior_events_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_assigned_truck_id_trucks_id_fk" FOREIGN KEY ("assigned_truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reviews" ADD CONSTRAINT "finance_reviews_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reviews" ADD CONSTRAINT "finance_reviews_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reviews" ADD CONSTRAINT "finance_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_breadcrumbs" ADD CONSTRAINT "gps_breadcrumbs_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_history" ADD CONSTRAINT "invoice_history_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_history" ADD CONSTRAINT "invoice_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pricing_id_admin_pricings_id_fk" FOREIGN KEY ("pricing_id") REFERENCES "public"."admin_pricings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_state_change_logs" ADD CONSTRAINT "load_state_change_logs_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_state_change_logs" ADD CONSTRAINT "load_state_change_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_assigned_carrier_id_users_id_fk" FOREIGN KEY ("assigned_carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_assigned_truck_id_trucks_id_fk" FOREIGN KEY ("assigned_truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_price_locked_by_users_id_fk" FOREIGN KEY ("price_locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_accepted_bid_id_bids_id_fk" FOREIGN KEY ("accepted_bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_accepted_carrier_id_users_id_fk" FOREIGN KEY ("accepted_carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_load_id_loads_id_fk" FOREIGN KEY ("related_load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_bid_id_bids_id_fk" FOREIGN KEY ("related_bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_requests" ADD CONSTRAINT "otp_requests_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_requests" ADD CONSTRAINT "otp_requests_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_requests" ADD CONSTRAINT "otp_requests_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_requests" ADD CONSTRAINT "otp_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_requests" ADD CONSTRAINT "otp_requests_otp_id_otp_verifications_id_fk" FOREIGN KEY ("otp_id") REFERENCES "public"."otp_verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_templates" ADD CONSTRAINT "pricing_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rated_user_id_users_id_fk" FOREIGN KEY ("rated_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_eta_predictions" ADD CONSTRAINT "route_eta_predictions_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_credit_evaluations" ADD CONSTRAINT "shipper_credit_evaluations_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_credit_evaluations" ADD CONSTRAINT "shipper_credit_evaluations_assessor_id_users_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_credit_profiles" ADD CONSTRAINT "shipper_credit_profiles_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_credit_profiles" ADD CONSTRAINT "shipper_credit_profiles_last_assessed_by_users_id_fk" FOREIGN KEY ("last_assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_invoice_responses" ADD CONSTRAINT "shipper_invoice_responses_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_invoice_responses" ADD CONSTRAINT "shipper_invoice_responses_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_invoice_responses" ADD CONSTRAINT "shipper_invoice_responses_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_onboarding_requests" ADD CONSTRAINT "shipper_onboarding_requests_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_onboarding_requests" ADD CONSTRAINT "shipper_onboarding_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_ratings" ADD CONSTRAINT "shipper_ratings_shipper_id_users_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_ratings" ADD CONSTRAINT "shipper_ratings_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_ratings" ADD CONSTRAINT "shipper_ratings_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipper_ratings" ADD CONSTRAINT "shipper_ratings_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telematics_alerts" ADD CONSTRAINT "telematics_alerts_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telematics_alerts" ADD CONSTRAINT "telematics_alerts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_telemetry" ADD CONSTRAINT "vehicle_telemetry_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_telemetry" ADD CONSTRAINT "vehicle_telemetry_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_telemetry" ADD CONSTRAINT "vehicle_telemetry_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_bot_messages" ADD CONSTRAINT "help_bot_messages_conversation_id_help_bot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."help_bot_conversations"("id") ON DELETE cascade ON UPDATE no action;