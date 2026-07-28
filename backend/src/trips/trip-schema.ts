import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, decimal, integer, varchar, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tripStatuses = ["SUBMITTED", "STARTED", "ENDED"] as const;
export type TripStatus = (typeof tripStatuses)[number];

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intutrackTripId: text("intutrack_trip_id").unique(),
  truckNumber: text("truck_number"),
  invoice: text("invoice"),
  srcLat: decimal("src_lat", { precision: 10, scale: 6 }),
  srcLng: decimal("src_lng", { precision: 10, scale: 6 }),
  destLat: decimal("dest_lat", { precision: 10, scale: 6 }),
  destLng: decimal("dest_lng", { precision: 10, scale: 6 }),
  tel: text("tel"),
  status: text("status").default("SUBMITTED"),
  etaHrs: integer("eta_hrs"),
  trackingState: text("tracking_state"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  publicLink: text("public_link"),
  createdAt: timestamp("created_at").defaultNow(),

  // Extended fields for richer IntuTrack mapping / analytics (all optional)
  submit: boolean("submit"),
  doTracking: boolean("do_tracking"),
  doEpod: boolean("do_epod"),
  etaDays: decimal("eta_days", { precision: 5, scale: 2 }),
  etaTime: timestamp("eta_time"),
  lrNumber: text("lr_number"),
  lrDate: timestamp("lr_date"),
  tripType: text("trip_type"),
  containerNumber: text("container_number"),
  shippingLineScac: text("shipping_line_scac"),
  clientName: text("client_name"),
  division: text("division"),
  env: text("env"),
  operator: text("operator"),
  currentDbConsent: text("current_db_consent"),
  rawRemoteTrip: jsonb("raw_remote_trip"),
});

export const drops = pgTable("drops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id")
    .notNull()
    .references(() => trips.id),

  name: text("name").notNull(),
  lat: decimal("lat", { precision: 10, scale: 6 }),
  lng: decimal("lng", { precision: 10, scale: 6 }),

  invoice: text("invoice"),
  lrNumber: text("lr_number"),
  etaDays: decimal("eta_days", { precision: 5, scale: 2 }),

  dropIndex: integer("drop_index"),
  isVisited: boolean("is_visited").default(false),
  isDeparted: boolean("is_departed").default(false),

  inTime: timestamp("in_time"),
  outTime: timestamp("out_time"),
});

export const consentRecords = pgTable("consent_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").references(() => trips.id),

  number: varchar("number", { length: 20 }).notNull(),
  operator: text("operator"),
  consent: text("consent").notNull(),
  suggestion: text("suggestion"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const pings = pgTable("pings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id")
    .notNull()
    .references(() => trips.id),

  tel: varchar("tel", { length: 20 }),
  lat: decimal("lat", { precision: 10, scale: 6 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 6 }).notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: integer("pincode"),
  mode: text("mode"),
  type: text("type"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  createdAt: true,
});

export const insertDropSchema = createInsertSchema(drops).omit({
  id: true,
});

export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({
  id: true,
  createdAt: true,
});

export const insertPingSchema = createInsertSchema(pings).omit({
  id: true,
  createdAt: true,
});

export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;

export type InsertDrop = z.infer<typeof insertDropSchema>;
export type Drop = typeof drops.$inferSelect;

export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;
export type ConsentRecord = typeof consentRecords.$inferSelect;

export type InsertPing = z.infer<typeof insertPingSchema>;
export type Ping = typeof pings.$inferSelect;
