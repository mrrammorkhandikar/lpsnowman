import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum
export const userRoles = ["shipper", "carrier", "admin", "driver"] as const;
export type UserRole = typeof userRoles[number];

// Load status enum - Admin-Managed Freight Exchange Lifecycle (12 Core States + Terminal)
// Per specification: Invoice comes AFTER carrier finalization, not before
// Flow: Shipper submits → Admin prices → Post to Carriers → Bidding → Carrier Finalized → Invoice Created → Sent → Acknowledged → Paid → In Transit → Completed
export const loadStatuses = [
  "draft",                      // 0. Initial creation state (internal)
  "pending",                    // 1. SUBMITTED_BY_SHIPPER - awaiting admin review/pricing
  "priced",                     // 2. PRICING_BY_ADMIN - Admin assigned internal cost
  "posted_to_carriers",         // 3. POSTED_TO_MARKETPLACE - visible to carriers
  "open_for_bid",               // 4. BIDDING_OPEN - Carriers can see & bid
  "counter_received",           // 5. NEGOTIATION_ACTIVE - Active negotiation in progress
  "awarded",                    // 6. CARRIER_FINALIZED - Carrier accepted/assigned
  "invoice_created",            // 7. INVOICE_CREATED - Admin created invoice (unlocked after finalization)
  "invoice_sent",               // 8. INVOICE_SENT - Invoice pushed to Shipper
  "invoice_acknowledged",       // 9. INVOICE_ACKNOWLEDGED - Shipper acknowledged invoice
  "invoice_paid",               // 10. INVOICE_PAID - Payment confirmed
  "in_transit",                 // 11. IN_TRANSIT - Shipment underway
  "delivered",                  // 12. COMPLETED - Delivery confirmed
  "closed",                     // Terminal state (completed)
  "cancelled",                  // Terminal state (cancelled)
  "unavailable"                 // Shipper-controlled - load temporarily unavailable
] as const;
export type LoadStatus = typeof loadStatuses[number];

// Valid state transitions map - Admin-Managed Freight Exchange workflow
// CRITICAL: Invoice comes AFTER carrier finalization per business rules
export const validStateTransitions: Record<LoadStatus, LoadStatus[]> = {
  draft: ["pending", "cancelled", "unavailable"],
  pending: ["priced", "cancelled", "unavailable"],
  priced: ["posted_to_carriers", "pending", "cancelled", "unavailable"],
  posted_to_carriers: ["open_for_bid", "awarded", "cancelled", "unavailable"],
  open_for_bid: ["counter_received", "awarded", "cancelled", "unavailable"],
  counter_received: ["open_for_bid", "awarded", "cancelled", "unavailable"],
  awarded: ["invoice_created", "invoice_sent", "open_for_bid", "cancelled"],
  invoice_created: ["invoice_sent", "awarded", "cancelled"],
  invoice_sent: ["invoice_acknowledged", "invoice_created", "cancelled"],
  invoice_acknowledged: ["invoice_paid", "invoice_sent", "cancelled"],
  invoice_paid: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: ["closed"],
  closed: [],
  cancelled: [],
  unavailable: ["pending"],
};

// Admin post mode enum
export const adminPostModes = ["open", "invite", "assign"] as const;
export type AdminPostMode = typeof adminPostModes[number];

// Admin pricing status enum
export const adminPricingStatuses = ["draft", "locked", "awaiting_approval", "approved", "posted", "assigned", "rejected"] as const;
export type AdminPricingStatus = typeof adminPricingStatuses[number];

// Bid status enum
export const bidStatuses = ["pending", "accepted", "rejected", "countered", "expired"] as const;
export type BidStatus = typeof bidStatuses[number];

// Bid type enum (for Admin-as-Mediator flow)
export const bidTypes = ["carrier_bid", "admin_posted_acceptance", "admin_counter"] as const;
export type BidType = typeof bidTypes[number];

// Negotiation message types enum (for chat-style negotiation)
export const negotiationMessageTypes = [
  "carrier_bid",          // Initial bid from carrier
  "admin_counter",        // Admin counter-offer
  "carrier_counter",      // Carrier counter to admin's counter
  "admin_accept",         // Admin accepts a bid
  "carrier_accept",       // Carrier accepts admin's counter
  "admin_reject",         // Admin rejects a bid
  "carrier_reject",       // Carrier rejects admin's counter
  "system_message",       // System notifications (finalization, etc.)
  "simulated_bid",        // Auto-generated simulated bid
  "simulated_counter",    // Simulated carrier counter-response
] as const;
export type NegotiationMessageType = typeof negotiationMessageTypes[number];

// Negotiation thread status enum
export const negotiationStatuses = [
  "pending_review",       // Initial bids awaiting admin review
  "counter_sent",         // Admin sent counter, awaiting response
  "carrier_responded",    // Carrier responded to counter
  "accepted",             // Negotiation finalized with acceptance
  "rejected",             // All bids rejected
  "expired",              // Negotiation timed out
] as const;
export type NegotiationStatus = typeof negotiationStatuses[number];

// Shipment status enum
export const shipmentStatuses = ["pickup_scheduled", "picked_up", "in_transit", "at_checkpoint", "out_for_delivery", "delivered"] as const;
export type ShipmentStatus = typeof shipmentStatuses[number];

// Indian Truck Types - Main Categories
export const truckCategories = [
  "open",           // Open body trucks (7.5 - 43 Ton)
  "container",      // Container trucks (7.5 - 30 Ton)
  "lcv",            // Light Commercial Vehicle (2.5 - 7 Ton)
  "mini_pickup",    // Mini/Pickup (0.75 - 2 Ton)
  "trailer",        // Trailer trucks (16 - 43 Ton)
  "tipper",         // Tipper trucks (9 - 30 Ton)
  "tanker",         // Tanker trucks (8 - 36 Ton)
  "dumper",         // Dumper trucks (9 - 36 Ton)
  "bulker",         // Bulker trucks (20 - 36 Ton)
] as const;
export type TruckCategory = typeof truckCategories[number];

// Enhanced truck body categories with metadata for UI
export const truckBodyCategories = [
  { 
    id: "open", 
    name: "Open Body", 
    description: "Open flatbed trucks for general cargo",
    tonnageRange: "7.5-43 Ton",
    icon: "truck"
  },
  { 
    id: "closed", 
    name: "Closed Body", 
    description: "Fully enclosed trucks for weather protection",
    tonnageRange: "7.5-25 Ton",
    icon: "box"
  },
  { 
    id: "container", 
    name: "Container", 
    description: "Container trucks for protected cargo",
    tonnageRange: "7.5-30 Ton",
    icon: "container"
  },
  { 
    id: "lcv", 
    name: "LCV (Light Commercial)", 
    description: "Small trucks for light loads",
    tonnageRange: "0.75-7 Ton",
    icon: "truck"
  },
  { 
    id: "trailer", 
    name: "Trailer", 
    description: "Large trailers for heavy cargo",
    tonnageRange: "16-43 Ton",
    icon: "trailer"
  },
  { 
    id: "tipper", 
    name: "Tipper", 
    description: "Trucks with tipping body for loose materials",
    tonnageRange: "9-30 Ton",
    icon: "tipper"
  },
  { 
    id: "tanker", 
    name: "Tanker", 
    description: "For liquid cargo - oil, water, chemicals",
    tonnageRange: "8-36 Ton",
    icon: "tanker"
  },
  { 
    id: "dumper", 
    name: "Dumper/Hyva", 
    description: "For construction materials and bulk",
    tonnageRange: "9-36 Ton",
    icon: "dumper"
  },
  { 
    id: "bulker", 
    name: "Bulker", 
    description: "For cement, fly ash and powder materials",
    tonnageRange: "20-36 Ton",
    icon: "bulker"
  },
  { 
    id: "mini_pickup", 
    name: "Mini/Pickup Truck", 
    description: "Small pickups for local delivery",
    tonnageRange: "0.5-2 Ton",
    icon: "pickup"
  },
] as const;

// Open truck subtypes by size
export const openTruckSubtypes = [
  "17_feet", "19_feet", "20_feet", "22_feet", "24_feet",
  "10_wheeler", "12_wheeler", "14_wheeler", "16_wheeler", "18_wheeler"
] as const;
export type OpenTruckSubtype = typeof openTruckSubtypes[number];

// Full truck types with categories and capacity ranges (for UI display)
export const indianTruckTypes = [
  { value: "open_17_feet", label: "Open - 17 Feet", category: "open", capacityMin: 7.5, capacityMax: 12 },
  { value: "open_19_feet", label: "Open - 19 Feet", category: "open", capacityMin: 9, capacityMax: 15 },
  { value: "open_20_feet", label: "Open - 20 Feet", category: "open", capacityMin: 10, capacityMax: 18 },
  { value: "open_22_feet", label: "Open - 22 Feet", category: "open", capacityMin: 12, capacityMax: 22 },
  { value: "open_24_feet", label: "Open - 24 Feet", category: "open", capacityMin: 15, capacityMax: 25 },
  { value: "open_10_wheeler", label: "Open - 10 Wheeler", category: "open", capacityMin: 16, capacityMax: 25 },
  { value: "open_12_wheeler", label: "Open - 12 Wheeler", category: "open", capacityMin: 20, capacityMax: 30 },
  { value: "open_14_wheeler", label: "Open - 14 Wheeler", category: "open", capacityMin: 25, capacityMax: 35 },
  { value: "open_16_wheeler", label: "Open - 16 Wheeler", category: "open", capacityMin: 30, capacityMax: 40 },
  { value: "open_18_wheeler", label: "Open - 18 Wheeler", category: "open", capacityMin: 35, capacityMax: 43 },
  { value: "closed_17_feet", label: "Closed Body - 17 Feet", category: "closed", capacityMin: 4, capacityMax: 7 },
  { value: "closed_19_feet", label: "Closed Body - 19 Feet", category: "closed", capacityMin: 6, capacityMax: 9 },
  { value: "closed_20_feet", label: "Closed Body - 20 Feet", category: "closed", capacityMin: 7.5, capacityMax: 12 },
  { value: "closed_22_feet", label: "Closed Body - 22 Feet", category: "closed", capacityMin: 9, capacityMax: 15 },
  { value: "closed_24_feet", label: "Closed Body - 24 Feet", category: "closed", capacityMin: 12, capacityMax: 18 },
  { value: "closed_32_feet", label: "Closed Body - 32 Feet", category: "closed", capacityMin: 15, capacityMax: 25 },
  { value: "container_20ft", label: "Container - 20 Ft", category: "container", capacityMin: 7.5, capacityMax: 20 },
  { value: "container_32ft", label: "Container - 32 Ft", category: "container", capacityMin: 15, capacityMax: 30 },
  { value: "container_40ft", label: "Container - 40 Ft", category: "container", capacityMin: 20, capacityMax: 30 },
  { value: "lcv_tata_ace", label: "LCV - Tata Ace", category: "lcv", capacityMin: 0.75, capacityMax: 1 },
  { value: "lcv_bolero", label: "LCV - Bolero Pickup", category: "lcv", capacityMin: 1, capacityMax: 1.5 },
  { value: "lcv_14ft", label: "LCV - 14 Feet", category: "lcv", capacityMin: 2.5, capacityMax: 4 },
  { value: "lcv_17ft", label: "LCV - 17 Feet", category: "lcv", capacityMin: 4, capacityMax: 7 },
  { value: "mini_pickup", label: "Mini/Pickup", category: "mini_pickup", capacityMin: 0.5, capacityMax: 2 },
  { value: "trailer_40ft", label: "Trailer - 40 Ft", category: "trailer", capacityMin: 25, capacityMax: 35 },
  { value: "trailer_triple_axle", label: "Trailer - Triple Axle", category: "trailer", capacityMin: 30, capacityMax: 43 },
  { value: "tipper_10_wheel", label: "Tipper - 10 Wheeler", category: "tipper", capacityMin: 16, capacityMax: 22 },
  { value: "tipper_12_wheel", label: "Tipper - 12 Wheeler", category: "tipper", capacityMin: 20, capacityMax: 30 },
  { value: "tanker_oil", label: "Tanker - Oil/Fuel", category: "tanker", capacityMin: 10, capacityMax: 24 },
  { value: "tanker_water", label: "Tanker - Water", category: "tanker", capacityMin: 8, capacityMax: 20 },
  { value: "tanker_chemical", label: "Tanker - Chemical", category: "tanker", capacityMin: 12, capacityMax: 36 },
  { value: "dumper_hyva", label: "Dumper - Hyva", category: "dumper", capacityMin: 16, capacityMax: 25 },
  { value: "dumper_10_wheel", label: "Dumper - 10 Wheeler", category: "dumper", capacityMin: 20, capacityMax: 36 },
  { value: "bulker_cement", label: "Bulker - Cement", category: "bulker", capacityMin: 25, capacityMax: 35 },
  { value: "bulker_fly_ash", label: "Bulker - Fly Ash", category: "bulker", capacityMin: 20, capacityMax: 36 },
] as const;

// Truck types enum (for backward compatibility)
export const truckTypes = indianTruckTypes.map(t => t.value);
export type TruckType = typeof indianTruckTypes[number]["value"];

// Document types enum
export const documentTypes = ["pod", "invoice", "rc", "insurance", "fitness", "license", "other"] as const;
export type DocumentType = typeof documentTypes[number];

// Alert types enum
export const alertTypes = ["overheating", "low_fuel", "overspeed", "low_battery", "harsh_brake", "sudden_acceleration", "route_deviation", "unexpected_stop", "idle_time"] as const;
export type AlertType = typeof alertTypes[number];

// Carrier types enum - Enterprise fleets vs Solo owner-operators
export const carrierTypes = ["enterprise", "solo"] as const;
export type CarrierType = typeof carrierTypes[number];

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userNumber: serial("user_number").notNull().unique(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("shipper"),
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  phone: text("phone"),
  avatar: text("avatar"),
  isVerified: boolean("is_verified").default(false),
  defaultPickupAddress: text("default_pickup_address"),
  defaultPickupLocality: text("default_pickup_locality"),
  defaultPickupLandmark: text("default_pickup_landmark"),
  defaultPickupCity: text("default_pickup_city"),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  /** NULL = full admin; set = role-based admin with page restrictions */
  adminRoleId: varchar("admin_role_id"),
});

// Admin roles for role-based admin page access
export const adminRoles = pgTable("admin_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  pageKeys: text("page_keys").array().notNull().default(sql`'{}'::text[]`),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Carrier profiles (additional info for carriers)
export const carrierProfiles = pgTable("carrier_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  carrierType: text("carrier_type").default("enterprise"), // enterprise or solo
  companyName: text("company_name"), // Company name for enterprise carriers
  companyPhone: text("company_phone"), // Separate company phone for enterprise
  city: text("city"), // City/location
  operatingRegion: text("operating_region"), // Operating region
  fleetSize: integer("fleet_size").default(1),
  serviceZones: text("service_zones").array(),
  reliabilityScore: decimal("reliability_score", { precision: 3, scale: 2 }).default("0"),
  communicationScore: decimal("communication_score", { precision: 3, scale: 2 }).default("0"),
  onTimeScore: decimal("on_time_score", { precision: 3, scale: 2 }).default("0"),
  totalDeliveries: integer("total_deliveries").default(0),
  badgeLevel: text("badge_level").default("bronze"),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("4.5"), // Carrier rating 1.0-5.0
  bio: text("bio"),
});

// Trucks table
export const trucks = pgTable("trucks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  truckType: text("truck_type").notNull(),
  licensePlate: text("license_plate").notNull(),
  capacity: integer("capacity").notNull(),
  capacityUnit: text("capacity_unit").default("tons"),
  isAvailable: boolean("is_available").default(true),
  currentLat: decimal("current_lat", { precision: 10, scale: 7 }),
  currentLng: decimal("current_lng", { precision: 10, scale: 7 }),
  currentLocation: text("current_location"),
  createdAt: timestamp("created_at").defaultNow(),
  // Extended truck info fields
  make: text("make"), // Truck manufacturer (Tata, Ashok Leyland, etc.)
  model: text("model"), // Model name
  year: integer("year"), // Manufacturing year
  city: text("city"), // Registration city
  registrationDate: timestamp("registration_date"), // Vehicle registration date
  // Additional specification fields
  chassisNumber: text("chassis_number"), // Chassis number
  registrationNumber: text("registration_number"), // Registration certificate number (RC)
  bodyType: text("body_type"), // Body type (open, closed, container, etc.)
  permitType: text("permit_type"), // national or domestic
  // Document expiry dates for Indian truck compliance
  rcExpiry: timestamp("rc_expiry"),
  insuranceExpiry: timestamp("insurance_expiry"),
  fitnessExpiry: timestamp("fitness_expiry"),
  permitExpiry: timestamp("permit_expiry"),
  pucExpiry: timestamp("puc_expiry"),
  // Document URLs for Indian truck compliance
  rcDocumentUrl: text("rc_document_url"), // Registration Certificate document
  insuranceDocumentUrl: text("insurance_document_url"), // Insurance document
  fitnessDocumentUrl: text("fitness_document_url"), // Fitness certificate document
  permitDocumentUrl: text("permit_document_url"), // Permit document
  pucDocumentUrl: text("puc_document_url"), // Pollution Under Control certificate
  // Document verification status (admin verified)
  rcVerified: boolean("rc_verified").default(false),
  insuranceVerified: boolean("insurance_verified").default(false),
  fitnessVerified: boolean("fitness_verified").default(false),
  permitVerified: boolean("permit_verified").default(false),
  pucVerified: boolean("puc_verified").default(false),
});

// Drivers table (for enterprise carriers and admin-provisioned accounts)
export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  licenseNumber: text("license_number"),
  licenseExpiry: timestamp("license_expiry"),
  licenseImageUrl: text("license_image_url"),
  aadhaarNumber: text("aadhaar_number"),
  aadhaarImageUrl: text("aadhaar_image_url"),
  status: text("status").default("available"), // available, on_trip, inactive
  assignedTruckId: varchar("assigned_truck_id").references(() => trucks.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Loads table (updated for 12-state canonical lifecycle)
export const loads = pgTable("loads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipperId: varchar("shipper_id").notNull().references(() => users.id),
  assignedCarrierId: varchar("assigned_carrier_id").references(() => users.id),
  assignedTruckId: varchar("assigned_truck_id").references(() => trucks.id),
  
  // Sequential load numbers (global - same across all portals)
  shipperLoadNumber: integer("shipper_load_number"), // Assigned at creation: LD-001, LD-002, etc. (global sequential)
  adminReferenceNumber: integer("admin_reference_number"), // Legacy - now using shipperLoadNumber
  shipperReferenceNumber: text("shipper_reference_number"), // Shipper's own custom reference/pickup number for their tracking
  pickupId: varchar("pickup_id", { length: 4 }), // Unique 4-digit code given to carrier for pickup verification
  
  // Shipper contact details
  shipperCompanyName: text("shipper_company_name"),
  shipperContactName: text("shipper_contact_name"),
  shipperCompanyAddress: text("shipper_company_address"),
  shipperPhone: text("shipper_phone"),
  
  // Location details - Pickup
  pickupAddress: text("pickup_address").notNull(),
  pickupLocality: text("pickup_locality"),
  pickupLandmark: text("pickup_landmark"),
  pickupBusinessName: text("pickup_business_name"),
  pickupCity: text("pickup_city").notNull(),
  pickupState: text("pickup_state"),
  pickupPincode: text("pickup_pincode"),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 7 }),
  pickupLng: decimal("pickup_lng", { precision: 10, scale: 7 }),
  
  // Location details - Dropoff
  dropoffAddress: text("dropoff_address").notNull(),
  dropoffLocality: text("dropoff_locality"),
  dropoffLandmark: text("dropoff_landmark"),
  dropoffBusinessName: text("dropoff_business_name"),
  dropoffCity: text("dropoff_city").notNull(),
  dropoffState: text("dropoff_state"),
  dropoffPincode: text("dropoff_pincode"),
  dropoffLat: decimal("dropoff_lat", { precision: 10, scale: 7 }),
  dropoffLng: decimal("dropoff_lng", { precision: 10, scale: 7 }),
  distance: decimal("distance", { precision: 10, scale: 2 }),
  
  // Receiver contact details
  receiverName: text("receiver_name"),
  receiverPhone: text("receiver_phone"),
  receiverEmail: text("receiver_email"),
  
  // Cargo details
  weight: decimal("weight", { precision: 10, scale: 2 }).notNull(),
  weightUnit: text("weight_unit").default("MT"), // Metric Tons
  cargoDescription: text("cargo_description"), // Legacy field
  goodsToBeCarried: text("goods_to_be_carried"), // Type of goods being transported
  specialNotes: text("special_notes"), // Special handling instructions
  shipperPricePerTon: decimal("shipper_price_per_ton", { precision: 10, scale: 2 }), // Price per ton shipper is willing to pay
  shipperFixedPrice: decimal("shipper_fixed_price", { precision: 12, scale: 2 }), // Fixed price shipper is willing to pay
  rateType: text("rate_type").default("per_ton"), // per_ton or fixed_price
  materialType: text("material_type"), // Type of goods
  requiredTruckType: text("required_truck_type"),
  
  // Pricing
  estimatedPrice: decimal("estimated_price", { precision: 12, scale: 2 }),
  finalPrice: decimal("final_price", { precision: 12, scale: 2 }),
  adminSuggestedPrice: decimal("admin_suggested_price", { precision: 12, scale: 2 }),
  adminFinalPrice: decimal("admin_final_price", { precision: 12, scale: 2 }),
  advancePaymentPercent: integer("advance_payment_percent"), // Shipper's advance preference for invoicing
  carrierAdvancePercent: integer("carrier_advance_percent"), // Admin-set advance percentage for carrier marketplace
  
  // Price lock fields (per specification)
  priceLocked: boolean("price_locked").default(false),
  priceLockedBy: varchar("price_locked_by").references(() => users.id),
  priceLockedAt: timestamp("price_locked_at"),
  priceBreakdown: jsonb("price_breakdown"), // Detailed cost components
  
  // Dates
  pickupDate: timestamp("pickup_date"),
  deliveryDate: timestamp("delivery_date"),
  
  // Canonical state machine status
  status: text("status").default("draft"),
  previousStatus: text("previous_status"),
  statusChangedBy: varchar("status_changed_by"),
  statusChangedAt: timestamp("status_changed_at"),
  statusNote: text("status_note"),
  
  // Invoice reference (after price lock)
  invoiceId: varchar("invoice_id"),
  invoiceSentAt: timestamp("invoice_sent_at"),
  invoiceApprovedAt: timestamp("invoice_approved_at"),
  
  // Bidding fields
  openForBidAt: timestamp("open_for_bid_at"),
  biddingClosedAt: timestamp("bidding_closed_at"),
  awardedAt: timestamp("awarded_at"),
  awardedBidId: varchar("awarded_bid_id"),
  
  // Admin workflow
  adminPostMode: text("admin_post_mode"), // open, invite, assign
  adminId: varchar("admin_id").references(() => users.id),
  adminDecisionId: varchar("admin_decision_id"),
  invitedCarrierIds: text("invited_carrier_ids").array(),
  allowCounterBids: boolean("allow_counter_bids").default(true),
  
  // GST and compliance (India-specific)
  gstApplicable: boolean("gst_applicable").default(true),
  ewayBillRequired: boolean("eway_bill_required").default(false),
  ewayBillNumber: text("eway_bill_number"),
  
  // Template and misc
  isTemplate: boolean("is_template").default(false),
  templateName: text("template_name"),
  kycVerified: boolean("kyc_verified").default(false),
  priority: text("priority").default("normal"),
  
  // Admin employee info (when admin posts load on behalf of shipper)
  adminEmployeeCode: text("admin_employee_code"),
  adminEmployeeName: text("admin_employee_name"),
  
  // Optimistic locking
  version: integer("version").default(1),

  // IntuTrack trip tracking (set when start trip succeeds)
  triptrackId: text("triptrack_id"), // IntuTrack tripId from successful start trip
  triptrackMap: text("triptrack_map"), // Public map URL for this trip
  triptrackLocations: jsonb("triptrack_locations"), // Array of IntuTrack location points for this trip
  
  // Timestamps
  submittedAt: timestamp("submitted_at"),
  postedAt: timestamp("posted_at"),
  lastUpdatedBy: varchar("last_updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin Decisions table (immutable audit trail)
export const adminDecisions = pgTable("admin_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  suggestedPrice: decimal("suggested_price", { precision: 12, scale: 2 }).notNull(),
  finalPrice: decimal("final_price", { precision: 12, scale: 2 }).notNull(),
  postingMode: text("posting_mode").notNull(),
  invitedCarrierIds: text("invited_carrier_ids").array(),
  comment: text("comment"),
  pricingBreakdown: jsonb("pricing_breakdown"),
  actionType: text("action_type").default("price_and_post"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pricing Templates table (reusable margin presets)
export const pricingTemplates = pgTable("pricing_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  markupPercent: decimal("markup_percent", { precision: 5, scale: 2 }).default("0"),
  fixedFee: decimal("fixed_fee", { precision: 12, scale: 2 }).default("0"),
  fuelSurchargePercent: decimal("fuel_surcharge_percent", { precision: 5, scale: 2 }).default("0"),
  platformRatePercent: decimal("platform_rate_percent", { precision: 5, scale: 2 }).default("10"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin Pricings table (detailed pricing calculations and adjustments)
export const adminPricings = pgTable("admin_pricings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  templateId: varchar("template_id").references(() => pricingTemplates.id),
  suggestedPrice: decimal("suggested_price", { precision: 12, scale: 2 }).notNull(),
  finalPrice: decimal("final_price", { precision: 12, scale: 2 }),
  markupPercent: decimal("markup_percent", { precision: 5, scale: 2 }).default("0"),
  fixedFee: decimal("fixed_fee", { precision: 12, scale: 2 }).default("0"),
  fuelOverride: decimal("fuel_override", { precision: 12, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  payoutEstimate: decimal("payout_estimate", { precision: 12, scale: 2 }),
  platformMargin: decimal("platform_margin", { precision: 12, scale: 2 }),
  platformMarginPercent: decimal("platform_margin_percent", { precision: 5, scale: 2 }),
  status: text("status").default("draft"),
  requiresApproval: boolean("requires_approval").default(false),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  postMode: text("post_mode"),
  invitedCarrierIds: text("invited_carrier_ids").array(),
  notes: text("notes"),
  priceBreakdown: jsonb("price_breakdown"),
  confidenceScore: integer("confidence_score"),
  riskFlags: text("risk_flags").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice status enum - aligned with load lifecycle
export const invoiceStatuses = [
  "draft",           // Initial creation
  "sent",            // Sent to shipper
  "viewed",          // Shipper has viewed
  "approved",        // Shipper approved
  "negotiating",     // Under negotiation
  "revised",         // Revised after negotiation
  "paid",            // Payment received
  "overdue",         // Past due date
  "disputed",        // Shipper raised dispute
  "push_failed",     // Delivery failed, needs retry
  "cancelled"        // Cancelled
] as const;
export type InvoiceStatus = typeof invoiceStatuses[number];

// Shipper response types for invoice
export const shipperResponseTypes = ["approve", "negotiate", "query", "reject"] as const;
export type ShipperResponseType = typeof shipperResponseTypes[number];

// Invoices table (Admin-generated invoices for shippers)
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  shipperId: varchar("shipper_id").notNull().references(() => users.id),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  pricingId: varchar("pricing_id").references(() => adminPricings.id),
  
  // Line item breakdown
  baseFreight: decimal("base_freight", { precision: 12, scale: 2 }).default("0"),
  ratePerKm: decimal("rate_per_km", { precision: 10, scale: 2 }),
  distanceKm: decimal("distance_km", { precision: 10, scale: 2 }),
  dieselAdjustment: decimal("diesel_adjustment", { precision: 12, scale: 2 }).default("0"),
  tollEstimate: decimal("toll_estimate", { precision: 12, scale: 2 }).default("0"),
  driverBata: decimal("driver_bata", { precision: 12, scale: 2 }).default("0"),
  loadingCharges: decimal("loading_charges", { precision: 12, scale: 2 }).default("0"),
  unloadingCharges: decimal("unloading_charges", { precision: 12, scale: 2 }).default("0"),
  
  // Legacy fields for compatibility
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  fuelSurcharge: decimal("fuel_surcharge", { precision: 12, scale: 2 }).default("0"),
  tollCharges: decimal("toll_charges", { precision: 12, scale: 2 }).default("0"),
  handlingFee: decimal("handling_fee", { precision: 12, scale: 2 }).default("0"),
  insuranceFee: decimal("insurance_fee", { precision: 12, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  discountReason: text("discount_reason"),
  
  // GST and tax fields (India-specific)
  gstApplicable: boolean("gst_applicable").default(true),
  gstPercent: decimal("gst_percent", { precision: 5, scale: 2 }).default("18"),
  cgstAmount: decimal("cgst_amount", { precision: 12, scale: 2 }).default("0"),
  sgstAmount: decimal("sgst_amount", { precision: 12, scale: 2 }).default("0"),
  igstAmount: decimal("igst_amount", { precision: 12, scale: 2 }).default("0"),
  hsnSacCode: text("hsn_sac_code"), // HSN/SAC code for GST
  shipperGstin: text("shipper_gstin"),
  carrierGstin: text("carrier_gstin"),
  
  // Legacy tax fields
  taxPercent: decimal("tax_percent", { precision: 5, scale: 2 }).default("18"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  
  // E-way bill (required if goods > Rs.50,000)
  ewayBillRequired: boolean("eway_bill_required").default(false),
  ewayBillNumber: text("eway_bill_number"),
  ewayBillValidUntil: timestamp("eway_bill_valid_until"),
  
  // Payment terms
  paymentTerms: text("payment_terms").default("Net 30"), // T+X days or COD
  paymentTermsDays: integer("payment_terms_days").default(30),
  dueDate: timestamp("due_date"),
  
  // Advance payment
  advancePaymentPercent: integer("advance_payment_percent"),
  advancePaymentAmount: decimal("advance_payment_amount", { precision: 12, scale: 2 }),
  balanceOnDelivery: decimal("balance_on_delivery", { precision: 12, scale: 2 }),
  
  status: text("status").default("draft"),
  notes: text("notes"),
  lineItems: jsonb("line_items"),
  
  // Shipper response tracking
  shipperResponseType: text("shipper_response_type"), // approve, negotiate, query
  shipperResponseMessage: text("shipper_response_message"),
  shipperCounterAmount: decimal("shipper_counter_amount", { precision: 12, scale: 2 }),
  shipperStatus: text("shipper_status").default("pending"), // pending, viewed, acknowledged, countered, paid
  negotiationThreadId: varchar("negotiation_thread_id"),
  
  // Counter offer contact details (submitted by shipper)
  counterContactName: text("counter_contact_name"),
  counterContactCompany: text("counter_contact_company"),
  counterContactPhone: text("counter_contact_phone"),
  counterContactAddress: text("counter_contact_address"),
  counterReason: text("counter_reason"),
  counteredAt: timestamp("countered_at"),
  counteredBy: varchar("countered_by"),
  
  // Timestamps
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  
  // Shipper confirmation
  shipperConfirmed: boolean("shipper_confirmed").default(false),
  shipperConfirmedAt: timestamp("shipper_confirmed_at"),
  shipperConfirmedBy: varchar("shipper_confirmed_by"),
  
  // Document attachments
  pdfUrl: text("pdf_url"),
  attachments: jsonb("attachments"), // PO, packing list, insurance docs
  
  // Idempotency and versioning
  idempotencyKey: text("idempotency_key"),
  revisionNumber: integer("revision_number").default(1),
  previousInvoiceId: varchar("previous_invoice_id"),
  version: integer("version").default(1), // Optimistic locking
  
  // Platform margin
  platformMargin: decimal("platform_margin", { precision: 12, scale: 2 }).default("0"),
  estimatedCarrierPayout: decimal("estimated_carrier_payout", { precision: 12, scale: 2 }).default("0"),
  currency: text("currency").default("INR"),
  
  // Audit fields
  priceLockedBy: varchar("price_locked_by"),
  priceLockedAt: timestamp("price_locked_at"),
  lastUpdatedBy: varchar("last_updated_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice History table for audit trail
export const invoiceHistory = pgTable("invoice_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // create, edit, send, acknowledge, pay, dispute, cancel, revise
  payload: jsonb("payload"),
  previousValues: jsonb("previous_values"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Carrier Proposal table for edited estimations sent to carriers
export const carrierProposals = pgTable("carrier_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  proposedPayout: decimal("proposed_payout", { precision: 12, scale: 2 }).notNull(),
  lineItems: jsonb("line_items"),
  message: text("message"),
  expiresAt: timestamp("expires_at"),
  status: text("status").default("pending"), // pending, accepted, rejected, countered, expired
  counterAmount: decimal("counter_amount", { precision: 12, scale: 2 }),
  counterMessage: text("counter_message"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin Action Types enum
export const adminActionTypes = [
  "view_load", "impersonate_user", "force_post", "generate_invoice", 
  "send_invoice", "save_draft", "requeue_post", "toggle_feature_flag",
  "grant_permission", "rollback_price", "manual_override", "create_ticket"
] as const;
export type AdminActionType = typeof adminActionTypes[number];

// API Log types enum
export const apiLogTypes = ["request", "response", "error"] as const;
export type ApiLogType = typeof apiLogTypes[number];

// Admin Audit Logs table (immutable trail of all admin actions)
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  loadId: varchar("load_id").references(() => loads.id),
  userId: varchar("user_id").references(() => users.id),
  actionType: text("action_type").notNull(),
  actionDescription: text("action_description"),
  reason: text("reason"),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Load State Change Log table (immutable audit trail for state machine)
export const loadStateChangeLogs = pgTable("load_state_change_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  metadata: jsonb("metadata"), // Additional context like price breakdown, invoice details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Shipper Invoice Responses table (for negotiation thread)
export const shipperInvoiceResponses = pgTable("shipper_invoice_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  shipperId: varchar("shipper_id").notNull().references(() => users.id),
  responseType: text("response_type").notNull(), // approve, negotiate, query
  message: text("message"),
  counterAmount: decimal("counter_amount", { precision: 12, scale: 2 }),
  attachments: jsonb("attachments"),
  adminResponse: text("admin_response"),
  adminRespondedAt: timestamp("admin_responded_at"),
  adminId: varchar("admin_id"),
  status: text("status").default("pending"), // pending, resolved, escalated
  createdAt: timestamp("created_at").defaultNow(),
});

// API Request Logs table (for debugging and troubleshooting)
export const apiLogs = pgTable("api_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").references(() => loads.id),
  userId: varchar("user_id").references(() => users.id),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  logType: text("log_type").default("request"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin Actions Queue table (for retry/requeue operations)
export const adminActionsQueue = pgTable("admin_actions_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  actionType: text("action_type").notNull(),
  payload: jsonb("payload"),
  status: text("status").default("pending"),
  priority: integer("priority").default(0),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  lastError: text("last_error"),
  scheduledFor: timestamp("scheduled_for"),
  processedAt: timestamp("processed_at"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Feature Flags table (for admin controls)
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isEnabled: boolean("is_enabled").default(false),
  targetRoles: text("target_roles").array(),
  metadata: jsonb("metadata"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Carrier Settlements table (payouts to carriers)
export const carrierSettlements = pgTable("carrier_settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  grossAmount: decimal("gross_amount", { precision: 12, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 12, scale: 2 }).default("0"),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).default("0"),
  deductionReason: text("deduction_reason"),
  netPayout: decimal("net_payout", { precision: 12, scale: 2 }).notNull(),
  status: text("status").default("pending"),
  scheduledDate: timestamp("scheduled_date"),
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"),
  transactionId: text("transaction_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bids table (updated for Admin-as-Mediator flow)
export const bids = pgTable("bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  truckId: varchar("truck_id").references(() => trucks.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  counterAmount: decimal("counter_amount", { precision: 12, scale: 2 }),
  estimatedPickup: timestamp("estimated_pickup"),
  estimatedDelivery: timestamp("estimated_delivery"),
  notes: text("notes"),
  status: text("status").default("pending"),
  bidType: text("bid_type").default("carrier_bid"),
  carrierType: text("carrier_type").default("enterprise"), // enterprise or solo - tracks bid source
  approvalRequired: boolean("approval_required").default(false),
  adminMediated: boolean("admin_mediated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Shipments table (for tracking) - OTP-gated execution
export const shipments = pgTable("shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  shipperId: varchar("shipper_id").references(() => users.id),
  truckId: varchar("truck_id").references(() => trucks.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  status: text("status").default("pickup_scheduled"),
  currentLat: decimal("current_lat", { precision: 10, scale: 7 }),
  currentLng: decimal("current_lng", { precision: 10, scale: 7 }),
  currentLocation: text("current_location"),
  eta: timestamp("eta"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  // OTP-gated execution fields
  startOtpRequested: boolean("start_otp_requested").default(false),
  startOtpRequestedAt: timestamp("start_otp_requested_at"),
  startOtpVerified: boolean("start_otp_verified").default(false),
  startOtpVerifiedAt: timestamp("start_otp_verified_at"),
  routeStartOtpRequested: boolean("route_start_otp_requested").default(false),
  routeStartOtpRequestedAt: timestamp("route_start_otp_requested_at"),
  routeStartOtpVerified: boolean("route_start_otp_verified").default(false),
  routeStartOtpVerifiedAt: timestamp("route_start_otp_verified_at"),
  endOtpRequested: boolean("end_otp_requested").default(false),
  endOtpRequestedAt: timestamp("end_otp_requested_at"),
  endOtpVerified: boolean("end_otp_verified").default(false),
  endOtpVerifiedAt: timestamp("end_otp_verified_at"),
  physicalPodSubmittedAt: timestamp("physical_pod_submitted_at"),
});

// Shipment timeline events
export const shipmentEvents = pgTable("shipment_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentId: varchar("shipment_id").notNull().references(() => shipments.id),
  eventType: text("event_type").notNull(),
  location: text("location"),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// OTP Types for security gates
export const otpTypes = ["registration", "trip_start", "route_start", "trip_end"] as const;
export type OtpType = typeof otpTypes[number];

// OTP Statuses
export const otpStatuses = ["pending", "verified", "expired", "cancelled"] as const;
export type OtpStatus = typeof otpStatuses[number];

// OTP Verifications table - Admin-authorized security gates
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  otpType: text("otp_type").notNull(), // registration, trip_start, trip_end
  otpCode: text("otp_code").notNull(), // 6-digit code
  userId: varchar("user_id").references(() => users.id), // For registration OTPs
  carrierId: varchar("carrier_id").references(() => users.id), // For trip OTPs
  shipmentId: varchar("shipment_id").references(() => shipments.id), // For trip OTPs
  loadId: varchar("load_id").references(() => loads.id), // For trip OTPs
  phoneNumber: text("phone_number"), // For registration OTPs
  status: text("status").default("pending"), // pending, verified, expired, cancelled
  generatedBy: varchar("generated_by").references(() => users.id), // Admin who generated (for trip OTPs)
  validityMinutes: integer("validity_minutes").default(10), // OTP validity period
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  attempts: integer("attempts").default(0), // Failed attempts count
  maxAttempts: integer("max_attempts").default(3), // Maximum allowed attempts
});

// OTP Request Queue - Carrier requests awaiting admin approval
export const otpRequests = pgTable("otp_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestType: text("request_type").notNull(), // trip_start, trip_end
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  shipmentId: varchar("shipment_id").notNull().references(() => shipments.id),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  status: text("status").default("pending"), // pending, approved, rejected
  requestedAt: timestamp("requested_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  processedBy: varchar("processed_by").references(() => users.id), // Admin who processed
  otpId: varchar("otp_id").references(() => otpVerifications.id), // Generated OTP (if approved)
  notes: text("notes"),
});

// Messages table (for negotiation chat)
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  messageType: text("message_type").default("text"),
  bidId: varchar("bid_id").references(() => bids.id),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents table
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  loadId: varchar("load_id").references(() => loads.id),
  shipmentId: varchar("shipment_id").references(() => shipments.id),
  truckId: varchar("truck_id").references(() => trucks.id), // Link to specific truck for compliance docs
  driverId: varchar("driver_id").references(() => drivers.id), // Link to specific driver for compliance docs
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  expiryDate: timestamp("expiry_date"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
// Notification context types for deep-linking
export const notificationContextTypes = ["load", "bid", "negotiation", "invoice", "shipment", "document", "carrier", "general"] as const;
export type NotificationContextType = typeof notificationContextTypes[number];

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").default("info"),
  relatedLoadId: varchar("related_load_id").references(() => loads.id),
  relatedBidId: varchar("related_bid_id").references(() => bids.id),
  relatedInvoiceId: varchar("related_invoice_id"),
  contextType: text("context_type").default("load"),
  contextTab: text("context_tab"),
  actionUrl: text("action_url"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Ratings table
export const ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  raterId: varchar("rater_id").notNull().references(() => users.id),
  ratedUserId: varchar("rated_user_id").notNull().references(() => users.id),
  reliability: integer("reliability").notNull(),
  communication: integer("communication").notNull(),
  onTimeDelivery: integer("on_time_delivery").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vehicle Telemetry table (CAN-Bus data)
export const vehicleTelemetry = pgTable("vehicle_telemetry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  truckId: varchar("truck_id").references(() => trucks.id),
  loadId: varchar("load_id").references(() => loads.id),
  driverId: varchar("driver_id").references(() => users.id),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  speed: integer("speed").default(0),
  rpm: integer("rpm").default(0),
  fuelLevel: integer("fuel_level").default(100),
  engineTemp: integer("engine_temp").default(80),
  batteryVoltage: decimal("battery_voltage", { precision: 4, scale: 1 }).default("12.6"),
  odometer: decimal("odometer", { precision: 12, scale: 1 }).default("0"),
  loadWeight: decimal("load_weight", { precision: 10, scale: 2 }),
  maxCapacity: decimal("max_capacity", { precision: 10, scale: 2 }),
  heading: integer("heading").default(0),
  altitude: integer("altitude").default(0),
  isIgnitionOn: boolean("is_ignition_on").default(true),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Driver Behavior Events table
export const driverBehaviorEvents = pgTable("driver_behavior_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => users.id),
  truckId: varchar("truck_id").references(() => trucks.id),
  loadId: varchar("load_id").references(() => loads.id),
  eventType: text("event_type").notNull(),
  severity: text("severity").default("low"),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  speed: integer("speed"),
  accelerationG: decimal("acceleration_g", { precision: 4, scale: 2 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Telematics Alerts table
export const telematicsAlerts = pgTable("telematics_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  loadId: varchar("load_id").references(() => loads.id),
  driverId: varchar("driver_id").references(() => users.id),
  alertType: text("alert_type").notNull(),
  severity: text("severity").default("warning"),
  message: text("message").notNull(),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  value: decimal("value", { precision: 10, scale: 2 }),
  threshold: decimal("threshold", { precision: 10, scale: 2 }),
  isAcknowledged: boolean("is_acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// GPS Breadcrumb Trail table
export const gpsBreadcrumbs = pgTable("gps_breadcrumbs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  loadId: varchar("load_id").references(() => loads.id),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  speed: integer("speed"),
  heading: integer("heading"),
  isRiskySegment: boolean("is_risky_segment").default(false),
  riskReason: text("risk_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Route ETA Predictions table
export const routeEtaPredictions = pgTable("route_eta_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  vehicleId: varchar("vehicle_id").notNull(),
  distanceRemaining: decimal("distance_remaining", { precision: 10, scale: 2 }),
  distanceUnit: text("distance_unit").default("km"),
  currentEta: timestamp("current_eta"),
  originalEta: timestamp("original_eta"),
  delayMinutes: integer("delay_minutes").default(0),
  delayRisk: text("delay_risk").default("low"),
  trafficCondition: text("traffic_condition").default("normal"),
  weatherCondition: text("weather_condition").default("clear"),
  betterRouteAvailable: boolean("better_route_available").default(false),
  betterRouteSavingsMinutes: integer("better_route_savings_minutes"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  carrierProfile: one(carrierProfiles, {
    fields: [users.id],
    references: [carrierProfiles.userId],
  }),
  trucks: many(trucks),
  loadsAsShipper: many(loads, { relationName: "shipperLoads" }),
  loadsAsCarrier: many(loads, { relationName: "carrierLoads" }),
  bids: many(bids),
  sentMessages: many(messages, { relationName: "sentMessages" }),
  receivedMessages: many(messages, { relationName: "receivedMessages" }),
  documents: many(documents),
  notifications: many(notifications),
}));

export const trucksRelations = relations(trucks, ({ one, many }) => ({
  carrier: one(users, {
    fields: [trucks.carrierId],
    references: [users.id],
  }),
  loads: many(loads),
  bids: many(bids),
}));

export const loadsRelations = relations(loads, ({ one, many }) => ({
  shipper: one(users, {
    fields: [loads.shipperId],
    references: [users.id],
    relationName: "shipperLoads",
  }),
  assignedCarrier: one(users, {
    fields: [loads.assignedCarrierId],
    references: [users.id],
    relationName: "carrierLoads",
  }),
  assignedTruck: one(trucks, {
    fields: [loads.assignedTruckId],
    references: [trucks.id],
  }),
  bids: many(bids),
  messages: many(messages),
  documents: many(documents),
  shipment: one(shipments, {
    fields: [loads.id],
    references: [shipments.loadId],
  }),
}));

export const bidsRelations = relations(bids, ({ one, many }) => ({
  load: one(loads, {
    fields: [bids.loadId],
    references: [loads.id],
  }),
  carrier: one(users, {
    fields: [bids.carrierId],
    references: [users.id],
  }),
  truck: one(trucks, {
    fields: [bids.truckId],
    references: [trucks.id],
  }),
  messages: many(messages),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  load: one(loads, {
    fields: [shipments.loadId],
    references: [loads.id],
  }),
  carrier: one(users, {
    fields: [shipments.carrierId],
    references: [users.id],
  }),
  truck: one(trucks, {
    fields: [shipments.truckId],
    references: [trucks.id],
  }),
  events: many(shipmentEvents),
  documents: many(documents),
}));

export const shipmentEventsRelations = relations(shipmentEvents, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentEvents.shipmentId],
    references: [shipments.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  load: one(loads, {
    fields: [messages.loadId],
    references: [loads.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sentMessages",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receivedMessages",
  }),
  bid: one(bids, {
    fields: [messages.bidId],
    references: [bids.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  load: one(loads, {
    fields: [documents.loadId],
    references: [loads.id],
  }),
  shipment: one(shipments, {
    fields: [documents.shipmentId],
    references: [shipments.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  load: one(loads, {
    fields: [notifications.relatedLoadId],
    references: [loads.id],
  }),
  bid: one(bids, {
    fields: [notifications.relatedBidId],
    references: [bids.id],
  }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  load: one(loads, {
    fields: [ratings.loadId],
    references: [loads.id],
  }),
  rater: one(users, {
    fields: [ratings.raterId],
    references: [users.id],
  }),
  ratedUser: one(users, {
    fields: [ratings.ratedUserId],
    references: [users.id],
  }),
}));

export const adminDecisionsRelations = relations(adminDecisions, ({ one }) => ({
  load: one(loads, {
    fields: [adminDecisions.loadId],
    references: [loads.id],
  }),
  admin: one(users, {
    fields: [adminDecisions.adminId],
    references: [users.id],
  }),
}));

export const pricingTemplatesRelations = relations(pricingTemplates, ({ one, many }) => ({
  creator: one(users, {
    fields: [pricingTemplates.createdBy],
    references: [users.id],
  }),
  pricings: many(adminPricings),
}));

export const adminPricingsRelations = relations(adminPricings, ({ one, many }) => ({
  load: one(loads, {
    fields: [adminPricings.loadId],
    references: [loads.id],
  }),
  admin: one(users, {
    fields: [adminPricings.adminId],
    references: [users.id],
  }),
  template: one(pricingTemplates, {
    fields: [adminPricings.templateId],
    references: [pricingTemplates.id],
  }),
  approver: one(users, {
    fields: [adminPricings.approvedBy],
    references: [users.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  load: one(loads, {
    fields: [invoices.loadId],
    references: [loads.id],
  }),
  shipper: one(users, {
    fields: [invoices.shipperId],
    references: [users.id],
  }),
  admin: one(users, {
    fields: [invoices.adminId],
    references: [users.id],
  }),
  pricing: one(adminPricings, {
    fields: [invoices.pricingId],
    references: [adminPricings.id],
  }),
}));

export const carrierSettlementsRelations = relations(carrierSettlements, ({ one }) => ({
  load: one(loads, {
    fields: [carrierSettlements.loadId],
    references: [loads.id],
  }),
  carrier: one(users, {
    fields: [carrierSettlements.carrierId],
    references: [users.id],
  }),
  invoice: one(invoices, {
    fields: [carrierSettlements.invoiceId],
    references: [invoices.id],
  }),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  admin: one(users, {
    fields: [adminAuditLogs.adminId],
    references: [users.id],
  }),
  load: one(loads, {
    fields: [adminAuditLogs.loadId],
    references: [loads.id],
  }),
  user: one(users, {
    fields: [adminAuditLogs.userId],
    references: [users.id],
  }),
}));

export const apiLogsRelations = relations(apiLogs, ({ one }) => ({
  load: one(loads, {
    fields: [apiLogs.loadId],
    references: [loads.id],
  }),
  user: one(users, {
    fields: [apiLogs.userId],
    references: [users.id],
  }),
}));

export const adminActionsQueueRelations = relations(adminActionsQueue, ({ one }) => ({
  load: one(loads, {
    fields: [adminActionsQueue.loadId],
    references: [loads.id],
  }),
  createdByUser: one(users, {
    fields: [adminActionsQueue.createdBy],
    references: [users.id],
  }),
}));

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [featureFlags.updatedBy],
    references: [users.id],
  }),
}));

// Carrier onboarding statuses
export const carrierOnboardingStatuses = ["draft", "pending", "under_review", "approved", "rejected", "on_hold"] as const;
export type CarrierOnboardingStatus = typeof carrierOnboardingStatuses[number];

// Carrier verification document types - extended for solo and fleet
export const carrierVerificationDocTypes = [
  // Solo operator documents
  "aadhaar",           // Aadhaar Card
  "license",           // Driver License
  "permit",            // National/Domestic Permit
  "rc",                // Registration Certificate
  "insurance",         // Vehicle Insurance Certificate
  "fitness",           // Fitness Certificate
  // Fleet/Company documents
  "incorporation",     // Company Incorporation Documents
  "trade_license",     // Business Registration/Trade License
  "address_proof",     // Business Address Proof
  "pan",               // PAN Card
  "gstin",             // GSTIN Certificate
  "tan",               // TAN Certificate
  // Bank documents (both solo and fleet)
  "void_cheque",       // Void Cheque for bank verification
] as const;
export type CarrierVerificationDocType = typeof carrierVerificationDocTypes[number];

// Carrier Verification table (for pending/rejected verification queue)
export const carrierVerifications = pgTable("carrier_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  status: text("status").default("draft"), // draft, pending, under_review, approved, rejected, on_hold
  carrierType: text("carrier_type").default("solo"), // solo or fleet/enterprise
  fleetSize: integer("fleet_size").default(1),
  
  // Solo operator specific fields
  aadhaarNumber: text("aadhaar_number"),
  driverLicenseNumber: text("driver_license_number"),
  permitType: text("permit_type"), // national or domestic
  uniqueRegistrationNumber: text("unique_registration_number"),
  chassisNumber: text("chassis_number"),
  licensePlateNumber: text("license_plate_number"),
  
  // Fleet/Company specific fields
  incorporationType: text("incorporation_type"), // pvt_ltd, llp, proprietorship, partnership
  businessType: text("business_type"), // sole_proprietor, registered_partnership, non_registered_partnership, other
  cinNumber: text("cin_number"),
  partnerName: text("partner_name"),
  businessRegistrationNumber: text("business_registration_number"),
  businessAddress: text("business_address"),
  businessLocality: text("business_locality"),
  panNumber: text("pan_number"),
  gstinNumber: text("gstin_number"),
  noGstinNumber: boolean("no_gstin_number").default(false),
  tanNumber: text("tan_number"),
  addressProofType: text("address_proof_type"), // rent_agreement, electricity_bill, office_photo_with_board
  
  // Bank details (for both solo and fleet)
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankIfscCode: text("bank_ifsc_code"),
  bankAccountHolderName: text("bank_account_holder_name"),
  
  // Admin review fields
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  expiresAt: timestamp("expires_at"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Carrier Verification Documents table
export const carrierVerificationDocuments = pgTable("carrier_verification_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verificationId: varchar("verification_id").notNull().references(() => carrierVerifications.id),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  documentType: text("document_type").notNull(), // license, rc, insurance, pan, gst, aadhar, fleet_proof
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  expiryDate: timestamp("expiry_date"),
  status: text("status").default("pending"), // pending, approved, rejected
  rejectionReason: text("rejection_reason"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bid Negotiations table (for chat-style negotiation history)
export const bidNegotiations = pgTable("bid_negotiations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bidId: varchar("bid_id").references(() => bids.id), // Can be null for system messages
  loadId: varchar("load_id").notNull().references(() => loads.id),
  senderId: varchar("sender_id").references(() => users.id), // Can be null for simulated/system
  senderRole: text("sender_role").notNull(), // carrier, admin, system
  messageType: text("message_type").default("carrier_bid"), // negotiationMessageTypes
  message: text("message"),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  previousAmount: decimal("previous_amount", { precision: 12, scale: 2 }), // For counter offers
  isSimulated: boolean("is_simulated").default(false), // Flag for simulated bids
  simulatedCarrierName: text("simulated_carrier_name"), // Name for simulated carriers
  carrierName: text("carrier_name"), // Display name for real carriers
  carrierType: text("carrier_type"), // enterprise or solo
  isRead: boolean("is_read").default(false), // Track read status
  createdAt: timestamp("created_at").defaultNow(),
});

// Negotiation Thread Summary table (for live counters and quick lookups)
export const negotiationThreads = pgTable("negotiation_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadId: varchar("load_id").notNull().references(() => loads.id).unique(),
  status: text("status").default("pending_review"), // negotiationStatuses
  totalBids: integer("total_bids").default(0),
  realBids: integer("real_bids").default(0),
  simulatedBids: integer("simulated_bids").default(0),
  pendingCounters: integer("pending_counters").default(0),
  acceptedBidId: varchar("accepted_bid_id").references(() => bids.id),
  acceptedCarrierId: varchar("accepted_carrier_id").references(() => users.id),
  acceptedAmount: decimal("accepted_amount", { precision: 12, scale: 2 }),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for new tables
export const carrierVerificationsRelations = relations(carrierVerifications, ({ one, many }) => ({
  carrier: one(users, {
    fields: [carrierVerifications.carrierId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [carrierVerifications.reviewedBy],
    references: [users.id],
  }),
  documents: many(carrierVerificationDocuments),
}));

export const carrierVerificationDocumentsRelations = relations(carrierVerificationDocuments, ({ one }) => ({
  verification: one(carrierVerifications, {
    fields: [carrierVerificationDocuments.verificationId],
    references: [carrierVerifications.id],
  }),
  carrier: one(users, {
    fields: [carrierVerificationDocuments.carrierId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [carrierVerificationDocuments.reviewedBy],
    references: [users.id],
  }),
}));

export const bidNegotiationsRelations = relations(bidNegotiations, ({ one }) => ({
  bid: one(bids, {
    fields: [bidNegotiations.bidId],
    references: [bids.id],
  }),
  load: one(loads, {
    fields: [bidNegotiations.loadId],
    references: [loads.id],
  }),
  sender: one(users, {
    fields: [bidNegotiations.senderId],
    references: [users.id],
  }),
}));

export const negotiationThreadsRelations = relations(negotiationThreads, ({ one }) => ({
  load: one(loads, {
    fields: [negotiationThreads.loadId],
    references: [loads.id],
  }),
  acceptedBid: one(bids, {
    fields: [negotiationThreads.acceptedBidId],
    references: [bids.id],
  }),
  acceptedCarrier: one(users, {
    fields: [negotiationThreads.acceptedCarrierId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, userNumber: true, lastActiveAt: true, createdAt: true });
export const insertAdminRoleSchema = createInsertSchema(adminRoles).omit({ id: true, createdAt: true });
export const insertCarrierVerificationSchema = createInsertSchema(carrierVerifications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCarrierVerificationDocumentSchema = createInsertSchema(carrierVerificationDocuments).omit({ id: true, createdAt: true });
export const insertBidNegotiationSchema = createInsertSchema(bidNegotiations).omit({ id: true, createdAt: true });
export const insertCarrierProfileSchema = createInsertSchema(carrierProfiles).omit({ id: true });
export const insertTruckSchema = createInsertSchema(trucks).omit({ id: true, createdAt: true });
export const insertDriverSchema = createInsertSchema(drivers).omit({ id: true, createdAt: true });
export const insertLoadSchema = createInsertSchema(loads).omit({ id: true, createdAt: true }).extend({
  shipperCompanyName: z.string().optional().nullable(),
  shipperContactName: z.string().optional().nullable(),
  shipperCompanyAddress: z.string().optional().nullable(),
  shipperPhone: z.string().optional().nullable(),
  receiverName: z.string().optional().nullable(),
  receiverPhone: z.string().optional().nullable(),
  receiverEmail: z.string().optional().nullable(),
  weight: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : String(value)),
    z.string().default("0")
  ),
  goodsToBeCarried: z.string().optional().nullable(),
  rateType: z.string().optional().nullable(),
  shipperFixedPrice: z.string().optional().nullable(),
  advancePaymentPercent: z.number().int().min(0).max(100).optional().nullable(),
});
export const insertBidSchema = createInsertSchema(bids).omit({ id: true, createdAt: true });
export const insertAdminDecisionSchema = createInsertSchema(adminDecisions).omit({ id: true, createdAt: true });
export const insertPricingTemplateSchema = createInsertSchema(pricingTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdminPricingSchema = createInsertSchema(adminPricings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertShipmentSchema = createInsertSchema(shipments).omit({ id: true, createdAt: true });
export const insertShipmentEventSchema = createInsertSchema(shipmentEvents).omit({ id: true, createdAt: true });
export const insertOtpVerificationSchema = createInsertSchema(otpVerifications).omit({ id: true, createdAt: true });
export const insertOtpRequestSchema = createInsertSchema(otpRequests).omit({ id: true, requestedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertRatingSchema = createInsertSchema(ratings).omit({ id: true, createdAt: true });
export const insertVehicleTelemetrySchema = createInsertSchema(vehicleTelemetry).omit({ id: true });
export const insertDriverBehaviorEventSchema = createInsertSchema(driverBehaviorEvents).omit({ id: true, createdAt: true });
export const insertTelematicsAlertSchema = createInsertSchema(telematicsAlerts).omit({ id: true, createdAt: true });
export const insertGpsBreadcrumbSchema = createInsertSchema(gpsBreadcrumbs).omit({ id: true, createdAt: true });
export const insertRouteEtaPredictionSchema = createInsertSchema(routeEtaPredictions).omit({ id: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceHistorySchema = createInsertSchema(invoiceHistory).omit({ id: true, createdAt: true });
export const insertCarrierProposalSchema = createInsertSchema(carrierProposals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCarrierSettlementSchema = createInsertSchema(carrierSettlements).omit({ id: true, createdAt: true });
export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs).omit({ id: true, createdAt: true });
export const insertApiLogSchema = createInsertSchema(apiLogs).omit({ id: true, createdAt: true });
export const insertAdminActionsQueueSchema = createInsertSchema(adminActionsQueue).omit({ id: true, createdAt: true });
export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLoadStateChangeLogSchema = createInsertSchema(loadStateChangeLogs).omit({ id: true, createdAt: true });
export const insertShipperInvoiceResponseSchema = createInsertSchema(shipperInvoiceResponses).omit({ id: true, createdAt: true });
export const insertNegotiationThreadSchema = createInsertSchema(negotiationThreads).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAdminRole = z.infer<typeof insertAdminRoleSchema>;
export type AdminRole = typeof adminRoles.$inferSelect;
export type InsertCarrierProfile = z.infer<typeof insertCarrierProfileSchema>;
export type CarrierProfile = typeof carrierProfiles.$inferSelect;
export type InsertTruck = z.infer<typeof insertTruckSchema>;
export type Truck = typeof trucks.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertLoad = z.infer<typeof insertLoadSchema>;
export type Load = typeof loads.$inferSelect;
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bids.$inferSelect;
export type InsertAdminDecision = z.infer<typeof insertAdminDecisionSchema>;
export type AdminDecision = typeof adminDecisions.$inferSelect;
export type InsertPricingTemplate = z.infer<typeof insertPricingTemplateSchema>;
export type PricingTemplate = typeof pricingTemplates.$inferSelect;
export type InsertAdminPricing = z.infer<typeof insertAdminPricingSchema>;
export type AdminPricing = typeof adminPricings.$inferSelect;
export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipments.$inferSelect;
export type InsertShipmentEvent = z.infer<typeof insertShipmentEventSchema>;
export type ShipmentEvent = typeof shipmentEvents.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpRequest = z.infer<typeof insertOtpRequestSchema>;
export type OtpRequest = typeof otpRequests.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;
export type InsertVehicleTelemetry = z.infer<typeof insertVehicleTelemetrySchema>;
export type VehicleTelemetry = typeof vehicleTelemetry.$inferSelect;
export type InsertDriverBehaviorEvent = z.infer<typeof insertDriverBehaviorEventSchema>;
export type DriverBehaviorEvent = typeof driverBehaviorEvents.$inferSelect;
export type InsertTelematicsAlert = z.infer<typeof insertTelematicsAlertSchema>;
export type TelematicsAlert = typeof telematicsAlerts.$inferSelect;
export type InsertGpsBreadcrumb = z.infer<typeof insertGpsBreadcrumbSchema>;
export type GpsBreadcrumb = typeof gpsBreadcrumbs.$inferSelect;
export type InsertRouteEtaPrediction = z.infer<typeof insertRouteEtaPredictionSchema>;
export type RouteEtaPrediction = typeof routeEtaPredictions.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoiceHistory = z.infer<typeof insertInvoiceHistorySchema>;
export type InvoiceHistory = typeof invoiceHistory.$inferSelect;
export type InsertCarrierProposal = z.infer<typeof insertCarrierProposalSchema>;
export type CarrierProposal = typeof carrierProposals.$inferSelect;
export type InsertCarrierSettlement = z.infer<typeof insertCarrierSettlementSchema>;
export type CarrierSettlement = typeof carrierSettlements.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertApiLog = z.infer<typeof insertApiLogSchema>;
export type ApiLog = typeof apiLogs.$inferSelect;
export type InsertAdminActionsQueue = z.infer<typeof insertAdminActionsQueueSchema>;
export type AdminActionsQueue = typeof adminActionsQueue.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertLoadStateChangeLog = z.infer<typeof insertLoadStateChangeLogSchema>;
export type LoadStateChangeLog = typeof loadStateChangeLogs.$inferSelect;
export type InsertShipperInvoiceResponse = z.infer<typeof insertShipperInvoiceResponseSchema>;
export type ShipperInvoiceResponse = typeof shipperInvoiceResponses.$inferSelect;
export type InsertCarrierVerification = z.infer<typeof insertCarrierVerificationSchema>;
export type CarrierVerification = typeof carrierVerifications.$inferSelect;
export type InsertCarrierVerificationDocument = z.infer<typeof insertCarrierVerificationDocumentSchema>;
export type CarrierVerificationDocument = typeof carrierVerificationDocuments.$inferSelect;
export type InsertBidNegotiation = z.infer<typeof insertBidNegotiationSchema>;
export type BidNegotiation = typeof bidNegotiations.$inferSelect;
export type InsertNegotiationThread = z.infer<typeof insertNegotiationThreadSchema>;
export type NegotiationThread = typeof negotiationThreads.$inferSelect;

// Credit risk level enum
export const creditRiskLevels = ["low", "medium", "high", "critical"] as const;
export type CreditRiskLevel = typeof creditRiskLevels[number];

// Credit assessment status enum
export const creditAssessmentStatuses = ["pending", "approved", "rejected", "under_review"] as const;
export type CreditAssessmentStatus = typeof creditAssessmentStatuses[number];

// Shipper Credit Profiles - stores current credit status for each shipper
export const shipperCreditProfiles = pgTable("shipper_credit_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipperId: varchar("shipper_id").notNull().references(() => users.id),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }).default("0"),
  creditScore: integer("credit_score").default(0), // 0-1000 internal score
  riskLevel: text("risk_level").default("medium"), // low, medium, high, critical
  paymentTerms: integer("payment_terms").default(30), // days
  outstandingBalance: decimal("outstanding_balance", { precision: 12, scale: 2 }).default("0"),
  availableCredit: decimal("available_credit", { precision: 12, scale: 2 }).default("0"),
  totalLoadsCompleted: integer("total_loads_completed").default(0),
  onTimePaymentRate: decimal("on_time_payment_rate", { precision: 5, scale: 2 }).default("0"), // percentage
  averagePaymentDays: decimal("average_payment_days", { precision: 5, scale: 1 }).default("0"),
  lastAssessmentAt: timestamp("last_assessment_at"),
  lastAssessedBy: varchar("last_assessed_by").references(() => users.id),
  lastAutoAssessmentAt: timestamp("last_auto_assessment_at"),
  isManualOverride: boolean("is_manual_override").default(false),
  autoSuggestedScore: integer("auto_suggested_score"),
  autoSuggestedRiskLevel: text("auto_suggested_risk_level"),
  autoSuggestedCreditLimit: decimal("auto_suggested_credit_limit", { precision: 12, scale: 2 }),
  
  // Financial Health (India-specific)
  annualRevenue: decimal("annual_revenue", { precision: 16, scale: 2 }), // INR
  totalAssets: decimal("total_assets", { precision: 16, scale: 2 }), // INR
  debtSummary: text("debt_summary"), // Description of overall debt
  cashFlowRating: text("cash_flow_rating"), // excellent, good, fair, poor
  liquidityRatio: decimal("liquidity_ratio", { precision: 5, scale: 2 }), // Current ratio
  debtToEquityRatio: decimal("debt_to_equity_ratio", { precision: 5, scale: 2 }),
  outstandingDebtAmount: decimal("outstanding_debt_amount", { precision: 14, scale: 2 }),
  
  // Business Profile
  businessYearsInOperation: integer("business_years_in_operation"),
  companyScale: text("company_scale"), // small, medium, large, enterprise
  paymentHistoryScore: integer("payment_history_score"), // 0-100 rating
  averageDaysToPay: integer("average_days_to_pay"),
  latePaymentCount: integer("late_payment_count").default(0),
  reputationRating: text("reputation_rating"), // excellent, good, fair, poor
  
  // Compliance & Documentation (India-specific)
  gstCompliant: boolean("gst_compliant").default(false),
  gstNumber: text("gst_number"),
  incomeTaxCompliant: boolean("income_tax_compliant").default(false),
  dgftRegistered: boolean("dgft_registered").default(false), // For export finance
  dgftIecNumber: text("dgft_iec_number"), // Import-Export Code
  hasValidContracts: boolean("has_valid_contracts").default(false),
  contractTypes: text("contract_types"), // POs, LCs, etc.
  confirmedOrdersValue: decimal("confirmed_orders_value", { precision: 16, scale: 2 }),
  
  // Credit History
  externalCreditScore: integer("external_credit_score"), // External bureau score (300-900)
  creditBureauScore: integer("credit_bureau_score"), // CIBIL/Experian score
  lastCreditBureauCheck: timestamp("last_credit_bureau_check"),
  hasPublicRecords: boolean("has_public_records").default(false), // legal/financial issues
  publicRecordsDetails: text("public_records_details"),
  creditUtilizationPercent: decimal("credit_utilization_percent", { precision: 5, scale: 2 }),
  
  // Section Notes
  financialAnalysisNotes: text("financial_analysis_notes"),
  qualitativeAssessmentNotes: text("qualitative_assessment_notes"),
  
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Shipper Credit Evaluations - history of all credit assessments
export const shipperCreditEvaluations = pgTable("shipper_credit_evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipperId: varchar("shipper_id").notNull().references(() => users.id),
  assessorId: varchar("assessor_id").references(() => users.id),
  evaluationType: text("evaluation_type").default("manual"), // manual, auto
  previousCreditLimit: decimal("previous_credit_limit", { precision: 12, scale: 2 }),
  newCreditLimit: decimal("new_credit_limit", { precision: 12, scale: 2 }),
  previousRiskLevel: text("previous_risk_level"),
  newRiskLevel: text("new_risk_level"),
  previousCreditScore: integer("previous_credit_score"),
  newCreditScore: integer("new_credit_score"),
  previousPaymentTerms: integer("previous_payment_terms"),
  newPaymentTerms: integer("new_payment_terms"),
  decision: text("decision").notNull(), // approved, rejected, adjusted, under_review, auto_calculated
  rationale: text("rationale"),
  scoringBreakdown: text("scoring_breakdown"), // JSON with detailed scoring factors
  supportingDocuments: text("supporting_documents").array(),
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
});

// Insert schemas for credit assessment
export const insertShipperCreditProfileSchema = createInsertSchema(shipperCreditProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShipperCreditEvaluationSchema = createInsertSchema(shipperCreditEvaluations).omit({
  id: true,
  evaluatedAt: true,
});

// Types for credit assessment
export type InsertShipperCreditProfile = z.infer<typeof insertShipperCreditProfileSchema>;
export type ShipperCreditProfile = typeof shipperCreditProfiles.$inferSelect;
export type InsertShipperCreditEvaluation = z.infer<typeof insertShipperCreditEvaluationSchema>;
export type ShipperCreditEvaluation = typeof shipperCreditEvaluations.$inferSelect;

// Shipper Onboarding Status enum
export const shipperOnboardingStatuses = [
  "draft",          // Auto-created on registration, awaiting shipper to complete form
  "pending",        // Shipper submitted, awaiting admin review
  "under_review",   // Admin is reviewing the application
  "approved",       // Application approved, shipper can post loads
  "rejected",       // Application rejected
  "on_hold",        // Application on hold, pending additional info
] as const;
export type ShipperOnboardingStatus = typeof shipperOnboardingStatuses[number];

// Shipper Role Types - "I am a" dropdown
export const shipperRoleTypes = ["shipper", "transporter"] as const;
export type ShipperRoleType = typeof shipperRoleTypes[number];

// Shipper Onboarding Requests table
export const shipperOnboardingRequests = pgTable("shipper_onboarding_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipperId: varchar("shipper_id").notNull().references(() => users.id),
  status: text("status").default("draft"), // draft, pending, under_review, approved, rejected, on_hold
  
  // Shipper Role - "I am a" dropdown (Shipper or Transporter)
  shipperRole: text("shipper_role").default("shipper"), // shipper or transporter
  
  // Business Identity (optional for draft, required on submission)
  legalCompanyName: text("legal_company_name"),
  tradeName: text("trade_name"), // Trading as / DBA name
  businessType: text("business_type"), // proprietorship, partnership, pvt_ltd, public_ltd, llp
  incorporationDate: timestamp("incorporation_date"),
  cinNumber: text("cin_number"), // Corporate Identification Number
  panNumber: text("pan_number"), // Permanent Account Number
  gstinNumber: text("gstin_number"), // GST Identification Number
  
  // Registered Address (optional for draft, required on submission)
  registeredAddress: text("registered_address"),
  registeredLocality: text("registered_locality"),
  registeredCity: text("registered_city"),
  registeredCityCustom: text("registered_city_custom"),
  registeredState: text("registered_state"),
  registeredCountry: text("registered_country").default("India"),
  registeredPincode: text("registered_pincode"),
  
  // Operations Details
  operatingRegions: text("operating_regions").array(), // States/regions where shipper operates
  primaryCommodities: text("primary_commodities").array(), // Types of goods typically shipped
  estimatedMonthlyLoads: integer("estimated_monthly_loads"), // Expected volume
  avgLoadValueInr: decimal("avg_load_value_inr", { precision: 12, scale: 2 }), // Average load value
  
  // Key Contact Person (optional for draft, required on submission)
  contactPersonName: text("contact_person_name"),
  contactPersonDesignation: text("contact_person_designation"),
  contactPersonPhone: text("contact_person_phone"),
  contactPersonEmail: text("contact_person_email"),
  
  // Compliance Documents (references to uploaded files)
  gstCertificateUrl: text("gst_certificate_url"),
  noGstCertificate: boolean("no_gst_certificate").default(false),
  alternativeDocumentType: text("alternative_document_type"), // msme_certificate, udyam_registration, shop_establishment, trade_license, iec_certificate, fssai_license, other_govt_auth
  alternativeAuthorizationUrl: text("alternative_authorization_url"), // MSME certificate or other govt authorization
  panCardUrl: text("pan_card_url"),
  incorporationCertificateUrl: text("incorporation_certificate_url"),
  cancelledChequeUrl: text("cancelled_cheque_url"),
  businessAddressProofType: text("business_address_proof_type"), // rent_agreement, electricity_bill, office_photo_with_board
  businessAddressProofUrl: text("business_address_proof_url"),
  selfieUrl: text("selfie_url"),
  msmeUrl: text("msme_url"),
  udyamUrl: text("udyam_url"),
  lrCopyUrl: text("lr_copy_url"), // LR Copy - mandatory for Transporters
  
  // Aadhaar Details - mandatory for Proprietorship business type
  aadhaarNumber: text("aadhaar_number"),
  aadhaarCardUrl: text("aadhaar_card_url"),
  
  // Trade References
  tradeReference1Company: text("trade_reference_1_company"),
  tradeReference1Contact: text("trade_reference_1_contact"),
  tradeReference1Phone: text("trade_reference_1_phone"),
  tradeReference2Company: text("trade_reference_2_company"),
  tradeReference2Contact: text("trade_reference_2_contact"),
  tradeReference2Phone: text("trade_reference_2_phone"),
  
  // Referral Source
  referralSource: text("referral_source"), // google, app_store, linkedin, sales_person
  referralSalesPersonName: text("referral_sales_person_name"), // Name of sales person if referralSource is sales_person
  
  // Bank Details (for verification)
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankIfscCode: text("bank_ifsc_code"),
  bankBranchName: text("bank_branch_name"),
  
  // Preferred Payment Terms
  preferredPaymentTerms: text("preferred_payment_terms"), // cod, net_7, net_15, net_30, net_45
  requestedCreditLimit: decimal("requested_credit_limit", { precision: 12, scale: 2 }),
  
  // Admin Review Fields
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  decisionNote: text("decision_note"), // Reason for approval/rejection/hold
  followUpDate: timestamp("follow_up_date"), // For on_hold cases
  creditAssessmentId: varchar("credit_assessment_id"), // Link to credit evaluation if conducted
  
  // Admin Credit Limit Proposal
  proposedCreditLimit: decimal("proposed_credit_limit", { precision: 12, scale: 2 }), // Admin's proposed credit limit
  proposedPaymentTerms: text("proposed_payment_terms"), // Admin's proposed payment terms
  
  // Shipper Credit Limit Response
  creditLimitAccepted: boolean("credit_limit_accepted"), // Whether shipper accepted the proposed limit
  creditLimitAcceptedAt: timestamp("credit_limit_accepted_at"), // When they accepted
  creditLimitResponse: text("credit_limit_response"), // 'accepted', 'contact_support'
  
  // Timestamps
  submittedAt: timestamp("submitted_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schema for shipper onboarding
export const insertShipperOnboardingRequestSchema = createInsertSchema(shipperOnboardingRequests).omit({
  id: true,
  submittedAt: true,
  updatedAt: true,
  reviewedAt: true,
  reviewedBy: true,
  creditAssessmentId: true,
});

// Types for shipper onboarding
export type InsertShipperOnboardingRequest = z.infer<typeof insertShipperOnboardingRequestSchema>;
export type ShipperOnboardingRequest = typeof shipperOnboardingRequests.$inferSelect;

// Carrier Ratings table - shippers rate carriers after delivery
export const carrierRatings = pgTable("carrier_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  shipperId: varchar("shipper_id").notNull().references(() => users.id),
  shipmentId: varchar("shipment_id").notNull().references(() => shipments.id),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  rating: integer("rating").notNull(), // 1-5 stars
  review: text("review"), // Optional review text
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schema for carrier ratings
export const insertCarrierRatingSchema = createInsertSchema(carrierRatings).omit({
  id: true,
  createdAt: true,
});

// Types for carrier ratings
export type InsertCarrierRating = z.infer<typeof insertCarrierRatingSchema>;
export type CarrierRating = typeof carrierRatings.$inferSelect;

// Shipper Ratings table - carriers rate shippers after trip completion
export const shipperRatings = pgTable("shipper_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipperId: varchar("shipper_id").notNull().references(() => users.id),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  shipmentId: varchar("shipment_id").notNull().references(() => shipments.id),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  rating: integer("rating").notNull(), // 1-5 stars
  review: text("review"), // Optional review text
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schema for shipper ratings
export const insertShipperRatingSchema = createInsertSchema(shipperRatings).omit({
  id: true,
  createdAt: true,
});

// Types for shipper ratings
export type InsertShipperRating = z.infer<typeof insertShipperRatingSchema>;
export type ShipperRating = typeof shipperRatings.$inferSelect;

// Saved addresses table for shippers to reuse pickup/dropoff addresses
export const savedAddresses = pgTable("saved_addresses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  shipperId: varchar("shipper_id").notNull().references(() => users.id),
  addressType: varchar("address_type", { length: 20 }).notNull(), // 'pickup' or 'dropoff'
  label: varchar("label", { length: 100 }), // Optional friendly name like "Mumbai Warehouse"
  businessName: varchar("business_name", { length: 200 }),
  address: varchar("address", { length: 500 }),
  locality: varchar("locality", { length: 200 }),
  landmark: varchar("landmark", { length: 200 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  pincode: varchar("pincode", { length: 10 }),
  contactName: varchar("contact_name", { length: 200 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  contactEmail: varchar("contact_email", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  usageCount: integer("usage_count").default(0),
  isActive: boolean("is_active").default(true),
});

export const insertSavedAddressSchema = createInsertSchema(savedAddresses);

export type InsertSavedAddress = z.infer<typeof insertSavedAddressSchema>;
export type SavedAddress = typeof savedAddresses.$inferSelect;

// Live telemetry data type (for WebSocket streaming)
export interface LiveTelemetryData {
  vehicleId: string;
  gps: { lat: number; lng: number };
  speed: number;
  rpm: number;
  fuelLevel: number;
  engineTemp: number;
  batteryVoltage: number;
  odometer: number;
  driverId: string;
  loadId: string;
  heading: number;
  loadWeight?: number;
  maxCapacity?: number;
  isIgnitionOn: boolean;
  timestamp: string;
}

// Driver behavior score type
export interface DriverBehaviorScore {
  driverId: string;
  overallScore: number;
  harshBrakingEvents: number;
  suddenAccelerationEvents: number;
  overspeedEvents: number;
  idleTimeMinutes: number;
  totalTrips: number;
  averageSpeed: number;
  fuelEfficiency: number;
}

// ETA prediction type
export interface EtaPrediction {
  loadId: string;
  vehicleId: string;
  currentEta: string;
  originalEta: string;
  delayMinutes: number;
  delayRisk: "low" | "medium" | "high";
  distanceRemaining: number;
  distanceUnit: string;
  trafficCondition: string;
  weatherCondition: string;
  betterRouteAvailable: boolean;
  betterRouteSavingsMinutes?: number;
}

// Help Bot Chat exports
export * from "./models/chat";

// Contact form submissions table
export const contactSubmissions = pgTable("contact_submissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  subject: varchar("subject", { length: 255 }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).default("new").notNull(),
});

export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions);
export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;
export type ContactSubmission = typeof contactSubmissions.$inferSelect;

// Finance review statuses
export const financeReviewStatuses = ["pending", "approved", "on_hold", "rejected"] as const;
export type FinanceReviewStatus = typeof financeReviewStatuses[number];

// Finance payment statuses
export const financePaymentStatuses = ["not_released", "released", "processing"] as const;
export type FinancePaymentStatus = typeof financePaymentStatuses[number];

// Finance Reviews table - tracks finance team decisions on shipment documents
export const financeReviews = pgTable("finance_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentId: varchar("shipment_id").notNull().references(() => shipments.id),
  loadId: varchar("load_id").notNull().references(() => loads.id),
  reviewerId: varchar("reviewer_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  comment: text("comment"),
  paymentStatus: text("payment_status").notNull().default("not_released"),
  advancePaymentReleasedAt: timestamp("advance_payment_released_at"),
  advancePaymentReleasedBy: varchar("advance_payment_released_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const financeReviewsRelations = relations(financeReviews, ({ one }) => ({
  shipment: one(shipments, {
    fields: [financeReviews.shipmentId],
    references: [shipments.id],
  }),
  load: one(loads, {
    fields: [financeReviews.loadId],
    references: [loads.id],
  }),
  reviewer: one(users, {
    fields: [financeReviews.reviewerId],
    references: [users.id],
  }),
  advanceReleasedBy: one(users, {
    fields: [financeReviews.advancePaymentReleasedBy],
    references: [users.id],
  }),
}));

export const insertFinanceReviewSchema = createInsertSchema(financeReviews).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinanceReview = z.infer<typeof insertFinanceReviewSchema>;
export type FinanceReview = typeof financeReviews.$inferSelect;

export const bcSyncSettings = pgTable("bc_sync_settings", {
  id: varchar("id").primaryKey().default("default"),
  companyId: text("company_id"),
  companyName: text("company_name"),
  customerNumber: text("customer_number"),
  lastPushAt: timestamp("last_push_at"),
  lastPullAt: timestamp("last_pull_at"),
  lastWipeAt: timestamp("last_wipe_at"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bcLoadMaps = pgTable("bc_load_maps", {
  loadId: varchar("load_id").primaryKey().references(() => loads.id),
  bcOrderId: text("bc_order_id").notNull(),
  bcOrderNumber: text("bc_order_number"),
  payloadHash: text("payload_hash"),
  lastPushedAt: timestamp("last_pushed_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bcSyncRuns = pgTable("bc_sync_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runType: text("run_type").notNull(),
  status: text("status").notNull(),
  ourCount: integer("our_count"),
  syncedCount: integer("synced_count"),
  mismatchedCount: integer("mismatched_count"),
  missingOnBc: integer("missing_on_bc"),
  extraOnBc: integer("extra_on_bc"),
  errorCount: integer("error_count"),
  details: jsonb("details"),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
  startedBy: varchar("started_by").references(() => users.id),
});

export type BcSyncSettings = typeof bcSyncSettings.$inferSelect;
export type BcLoadMap = typeof bcLoadMaps.$inferSelect;
export type BcSyncRun = typeof bcSyncRuns.$inferSelect;
