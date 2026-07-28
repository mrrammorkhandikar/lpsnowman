import { db } from "./db";
import { randomUUID, timingSafeEqual } from "crypto";
import { eq, and, desc, asc, sql, inArray, or, count } from "drizzle-orm";
import {
  users, trucks, loads, bids, shipments, shipmentEvents, drivers,
  messages, documents, notifications, ratings, carrierProfiles, adminDecisions,
  adminRoles,
  pricingTemplates, adminPricings, invoices, carrierSettlements,
  adminAuditLogs, apiLogs, adminActionsQueue, featureFlags,
  invoiceHistory, carrierProposals, loadStateChangeLogs, shipperInvoiceResponses,
  carrierVerifications, carrierVerificationDocuments, bidNegotiations, negotiationThreads,
  otpVerifications, otpRequests,
  shipperCreditProfiles, shipperCreditEvaluations,
  shipperOnboardingRequests,
  financeReviews,
  validStateTransitions,
  type User, type InsertUser,
  type AdminRole, type InsertAdminRole,
  type Truck, type InsertTruck,
  type Load, type InsertLoad,
  type Bid, type InsertBid,
  type Shipment, type InsertShipment,
  type ShipmentEvent, type InsertShipmentEvent,
  type Message, type InsertMessage,
  type Document, type InsertDocument,
  type Notification, type InsertNotification,
  type Rating, type InsertRating,
  type CarrierProfile, type InsertCarrierProfile,
  type Driver, type InsertDriver,
  type AdminDecision, type InsertAdminDecision,
  type PricingTemplate, type InsertPricingTemplate,
  type AdminPricing, type InsertAdminPricing,
  type Invoice, type InsertInvoice,
  type InvoiceHistory, type InsertInvoiceHistory,
  type CarrierProposal, type InsertCarrierProposal,
  type CarrierSettlement, type InsertCarrierSettlement,
  type AdminAuditLog, type InsertAdminAuditLog,
  type ApiLog, type InsertApiLog,
  type AdminActionsQueue, type InsertAdminActionsQueue,
  type FeatureFlag, type InsertFeatureFlag,
  type LoadStateChangeLog, type InsertLoadStateChangeLog,
  type ShipperInvoiceResponse, type InsertShipperInvoiceResponse,
  type CarrierVerification, type InsertCarrierVerification,
  type CarrierVerificationDocument, type InsertCarrierVerificationDocument,
  type BidNegotiation, type InsertBidNegotiation,
  type NegotiationThread, type InsertNegotiationThread,
  type OtpVerification, type InsertOtpVerification,
  type OtpRequest, type InsertOtpRequest,
  type ShipperCreditProfile, type InsertShipperCreditProfile,
  type ShipperCreditEvaluation, type InsertShipperCreditEvaluation,
  type ShipperOnboardingRequest, type InsertShipperOnboardingRequest,
  type FinanceReview, type InsertFinanceReview,
  type LoadStatus,
  shipperRatings,
  carrierRatings,
  type ShipperRating,
  type CarrierRating,
  type InsertCarrierRating,
  type InsertShipperRating,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  /** Single round-trip for login identifier (username, email, or phone); falls back to flexible phone match. */
  getUserByLoginIdentifier(identifier: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getAllCarriers(): Promise<User[]>;
  getAdmins(): Promise<User[]>;
  getAllCarriers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  getAdminRole(id: string): Promise<AdminRole | undefined>;
  getAllAdminRoles(): Promise<AdminRole[]>;
  createAdminRole(role: InsertAdminRole): Promise<AdminRole>;
  updateAdminRole(id: string, updates: Partial<AdminRole>): Promise<AdminRole | undefined>;
  deleteAdminRole(id: string): Promise<boolean>;
  countUsersWithAdminRole(roleId: string): Promise<number>;

  getCarrierProfile(userId: string): Promise<CarrierProfile | undefined>;
  createCarrierProfile(profile: InsertCarrierProfile): Promise<CarrierProfile>;
  updateCarrierProfile(userId: string, updates: Partial<CarrierProfile>): Promise<CarrierProfile | undefined>;

  getTruck(id: string): Promise<Truck | undefined>;
  getTrucksByCarrier(carrierId: string): Promise<Truck[]>;
  getAllTrucks(): Promise<Truck[]>;
  createTruck(truck: InsertTruck): Promise<Truck>;
  updateTruck(id: string, updates: Partial<Truck>): Promise<Truck | undefined>;
  deleteTruck(id: string): Promise<boolean>;

  getDriver(id: string): Promise<Driver | undefined>;
  getDriverByUserId(userId: string): Promise<Driver | undefined>;
  getDriversByCarrier(carrierId: string): Promise<Driver[]>;
  getAllDriversWithUsers(): Promise<Array<Driver & { username: string | null; loginEmail: string | null }>>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriver(id: string, updates: Partial<Driver>): Promise<Driver | undefined>;
  deleteDriver(id: string): Promise<boolean>;
  deleteUser(id: string): Promise<boolean>;

  getLoad(id: string): Promise<Load | undefined>;
  getLoadsByShipper(shipperId: string): Promise<Load[]>;
  getLoadsByCarrier(carrierId: string): Promise<Load[]>;
  getAvailableLoads(): Promise<Load[]>;
  getAllLoads(): Promise<Load[]>;
  createLoad(load: InsertLoad): Promise<Load>;
  updateLoad(id: string, updates: Partial<Load>): Promise<Load | undefined>;
  getNextGlobalLoadNumber(): Promise<number>;
  getNextShipperLoadNumber(shipperId: string): Promise<number>;
  getNextAdminReferenceNumber(shipperId: string): Promise<number>;
  generateUniquePickupId(): Promise<string>;

  getBid(id: string): Promise<Bid | undefined>;
  getBidsByLoad(loadId: string): Promise<Bid[]>;
  getBidsByCarrier(carrierId: string): Promise<Bid[]>;
  getAllBids(): Promise<Bid[]>;
  createBid(bid: InsertBid): Promise<Bid>;
  updateBid(id: string, updates: Partial<Bid>): Promise<Bid | undefined>;

  getShipment(id: string): Promise<Shipment | undefined>;
  getShipmentByLoad(loadId: string): Promise<Shipment | undefined>;
  getShipmentsByCarrier(carrierId: string): Promise<Shipment[]>;
  getShipmentsByDriver(driverId: string): Promise<Shipment[]>;
  driverHasShipmentHistory(driverId: string): Promise<boolean>;
  truckHasShipmentHistory(truckId: string): Promise<boolean>;
  getShipmentsByShipper(shipperId: string): Promise<Shipment[]>;
  getAllShipments(): Promise<Shipment[]>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: string, updates: Partial<Shipment>): Promise<Shipment | undefined>;

  getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]>;
  createShipmentEvent(event: InsertShipmentEvent): Promise<ShipmentEvent>;

  getMessagesByLoad(loadId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(loadId: string, userId: string): Promise<void>;

  getDocumentsByUser(userId: string): Promise<Document[]>;
  getDocumentsByDriver(driverId: string): Promise<Document[]>;
  getDocumentsByLoad(loadId: string): Promise<Document[]>;
  getDocumentsByShipment(shipmentId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  getNotification(id: string): Promise<Notification | undefined>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  getRatingsByUser(userId: string): Promise<Rating[]>;
  createRating(rating: InsertRating): Promise<Rating>;
  getShipperRatingsByShipperId(shipperId: string): Promise<ShipperRating[]>;
  getCarrierRatingByShipmentAndShipper(shipmentId: string, shipperId: string): Promise<CarrierRating | undefined>;
  getShipperRatingByShipmentAndCarrier(shipmentId: string, carrierId: string): Promise<ShipperRating | undefined>;
  createCarrierRating(rating: InsertCarrierRating): Promise<CarrierRating>;
  createShipperRating(rating: InsertShipperRating): Promise<ShipperRating>;

  // Admin mediation methods
  getLoadsSubmittedToAdmin(): Promise<Load[]>;
  getAdminPostedLoads(): Promise<Load[]>;
  submitLoadToAdmin(loadId: string): Promise<Load | undefined>;
  getAdminDecision(id: string): Promise<AdminDecision | undefined>;
  getAdminDecisionsByLoad(loadId: string): Promise<AdminDecision[]>;
  createAdminDecision(decision: InsertAdminDecision): Promise<AdminDecision>;

  // Admin Pricing & Margin Builder methods
  getPricingTemplates(): Promise<PricingTemplate[]>;
  getPricingTemplate(id: string): Promise<PricingTemplate | undefined>;
  createPricingTemplate(template: InsertPricingTemplate): Promise<PricingTemplate>;
  updatePricingTemplate(id: string, updates: Partial<PricingTemplate>): Promise<PricingTemplate | undefined>;
  deletePricingTemplate(id: string): Promise<boolean>;

  getAdminPricing(id: string): Promise<AdminPricing | undefined>;
  getAdminPricingByLoad(loadId: string): Promise<AdminPricing | undefined>;
  getAdminPricingHistory(loadId: string): Promise<AdminPricing[]>;
  createAdminPricing(pricing: InsertAdminPricing): Promise<AdminPricing>;
  updateAdminPricing(id: string, updates: Partial<AdminPricing>): Promise<AdminPricing | undefined>;
  lockAdminPricing(id: string, finalPrice: string, postMode: string, invitedCarrierIds?: string[]): Promise<AdminPricing | undefined>;
  approveAdminPricing(id: string, approverId: string): Promise<AdminPricing | undefined>;
  rejectAdminPricing(id: string, rejecterId: string, reason: string): Promise<AdminPricing | undefined>;

  // Invoice Builder methods
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined>;
  getInvoiceByLoad(loadId: string): Promise<Invoice | undefined>;
  getInvoicesByShipper(shipperId: string): Promise<Invoice[]>;
  getInvoicesByAdmin(adminId: string): Promise<Invoice[]>;
  getAllInvoices(): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined>;
  sendInvoice(id: string): Promise<Invoice | undefined>;
  markInvoicePaid(id: string, paymentDetails: { paidAmount: string; paymentMethod: string; paymentReference?: string }): Promise<Invoice | undefined>;
  generateInvoiceNumber(): Promise<string>;
  getInvoiceByIdempotencyKey(key: string): Promise<Invoice | undefined>;

  // Invoice History methods (audit trail)
  createInvoiceHistory(entry: InsertInvoiceHistory): Promise<InvoiceHistory>;
  getInvoiceHistory(invoiceId: string): Promise<InvoiceHistory[]>;

  // Carrier Proposal methods
  createCarrierProposal(proposal: InsertCarrierProposal): Promise<CarrierProposal>;
  getCarrierProposal(id: string): Promise<CarrierProposal | undefined>;
  getCarrierProposalsByLoad(loadId: string): Promise<CarrierProposal[]>;
  getCarrierProposalsByCarrier(carrierId: string): Promise<CarrierProposal[]>;
  getPendingCarrierProposals(carrierId: string): Promise<CarrierProposal[]>;
  updateCarrierProposal(id: string, updates: Partial<CarrierProposal>): Promise<CarrierProposal | undefined>;
  acceptCarrierProposal(id: string): Promise<CarrierProposal | undefined>;
  counterCarrierProposal(id: string, counterAmount: string, counterMessage: string): Promise<CarrierProposal | undefined>;

  // Carrier Settlement methods
  getSettlement(id: string): Promise<CarrierSettlement | undefined>;
  getSettlementByLoad(loadId: string): Promise<CarrierSettlement | undefined>;
  getSettlementsByCarrier(carrierId: string): Promise<CarrierSettlement[]>;
  getAllSettlements(): Promise<CarrierSettlement[]>;
  createSettlement(settlement: InsertCarrierSettlement): Promise<CarrierSettlement>;
  updateSettlement(id: string, updates: Partial<CarrierSettlement>): Promise<CarrierSettlement | undefined>;
  markSettlementPaid(id: string, paymentDetails: { paymentMethod: string; transactionId?: string }): Promise<CarrierSettlement | undefined>;

  // Admin Audit Log methods
  createAuditLog(log: InsertAdminAuditLog): Promise<AdminAuditLog>;
  getAuditLogsByLoad(loadId: string): Promise<AdminAuditLog[]>;
  getAuditLogsByAdmin(adminId: string): Promise<AdminAuditLog[]>;
  getRecentAuditLogs(limit?: number): Promise<AdminAuditLog[]>;

  // API Log methods
  createApiLog(log: InsertApiLog): Promise<ApiLog>;
  getApiLogsByLoad(loadId: string, limit?: number): Promise<ApiLog[]>;
  getApiLogsByEndpoint(endpoint: string, limit?: number): Promise<ApiLog[]>;
  getRecentApiLogs(limit?: number): Promise<ApiLog[]>;

  // Admin Actions Queue methods
  createActionQueue(action: InsertAdminActionsQueue): Promise<AdminActionsQueue>;
  getActionQueue(id: string): Promise<AdminActionsQueue | undefined>;
  getPendingActionsByLoad(loadId: string): Promise<AdminActionsQueue[]>;
  getPendingActions(): Promise<AdminActionsQueue[]>;
  updateActionQueue(id: string, updates: Partial<AdminActionsQueue>): Promise<AdminActionsQueue | undefined>;
  processActionQueue(id: string): Promise<AdminActionsQueue | undefined>;

  // Feature Flags methods
  getFeatureFlag(name: string): Promise<FeatureFlag | undefined>;
  getAllFeatureFlags(): Promise<FeatureFlag[]>;
  createFeatureFlag(flag: InsertFeatureFlag): Promise<FeatureFlag>;
  updateFeatureFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | undefined>;
  toggleFeatureFlag(name: string, isEnabled: boolean, adminId: string): Promise<FeatureFlag | undefined>;

  // State Machine & Canonical Lifecycle methods
  validateStateTransition(fromStatus: LoadStatus, toStatus: LoadStatus): boolean;
  transitionLoadState(loadId: string, toStatus: LoadStatus, userId: string, reason?: string, metadata?: Record<string, unknown>): Promise<Load | undefined>;
  getLoadStateHistory(loadId: string): Promise<LoadStateChangeLog[]>;
  createLoadStateChangeLog(log: InsertLoadStateChangeLog): Promise<LoadStateChangeLog>;
  
  // Shipper Invoice Response methods
  createShipperInvoiceResponse(response: InsertShipperInvoiceResponse): Promise<ShipperInvoiceResponse>;
  getShipperInvoiceResponses(invoiceId: string): Promise<ShipperInvoiceResponse[]>;
  getPendingShipperResponses(shipperId: string): Promise<ShipperInvoiceResponse[]>;
  updateShipperInvoiceResponse(id: string, updates: Partial<ShipperInvoiceResponse>): Promise<ShipperInvoiceResponse | undefined>;
  
  // Load Status Queries by canonical states
  getLoadsByStatus(status: LoadStatus): Promise<Load[]>;
  getLoadsByStatuses(statuses: LoadStatus[]): Promise<Load[]>;
  getPendingLoads(): Promise<Load[]>;
  getPricedLoads(): Promise<Load[]>;
  getApprovedLoads(): Promise<Load[]>;
  getOpenForBidLoads(): Promise<Load[]>;
  
  // Carrier Verification methods
  createCarrierVerification(verification: InsertCarrierVerification): Promise<CarrierVerification>;
  getCarrierVerification(id: string): Promise<CarrierVerification | undefined>;
  getCarrierVerificationByCarrier(carrierId: string): Promise<CarrierVerification | undefined>;
  getCarrierVerificationsByStatus(status: string): Promise<CarrierVerification[]>;
  getAllCarrierVerifications(): Promise<CarrierVerification[]>;
  updateCarrierVerification(id: string, updates: Partial<CarrierVerification>): Promise<CarrierVerification | undefined>;
  
  // Carrier Verification Document methods
  createVerificationDocument(doc: InsertCarrierVerificationDocument): Promise<CarrierVerificationDocument>;
  getVerificationDocument(id: string): Promise<CarrierVerificationDocument | undefined>;
  getVerificationDocuments(verificationId: string): Promise<CarrierVerificationDocument[]>;
  getVerificationDocumentsByCarrier(carrierId: string): Promise<CarrierVerificationDocument[]>;
  updateVerificationDocument(id: string, updates: Partial<CarrierVerificationDocument>): Promise<CarrierVerificationDocument | undefined>;
  
  // Bid Negotiation methods
  createBidNegotiation(negotiation: InsertBidNegotiation): Promise<BidNegotiation>;
  getBidNegotiations(bidId: string): Promise<BidNegotiation[]>;
  getBidNegotiationsByLoad(loadId: string): Promise<BidNegotiation[]>;
  
  // Negotiation Thread methods (for Admin Negotiation Chat)
  createNegotiationThread(thread: InsertNegotiationThread): Promise<NegotiationThread>;
  getNegotiationThread(loadId: string): Promise<NegotiationThread | undefined>;
  getNegotiationThreadById(id: string): Promise<NegotiationThread | undefined>;
  getAllNegotiationThreads(): Promise<NegotiationThread[]>;
  getActiveNegotiationThreads(): Promise<NegotiationThread[]>;
  updateNegotiationThread(loadId: string, updates: Partial<NegotiationThread>): Promise<NegotiationThread | undefined>;
  getOrCreateNegotiationThread(loadId: string): Promise<NegotiationThread>;
  acceptBidInThread(loadId: string, bidId: string, carrierId: string, amount: string): Promise<NegotiationThread | undefined>;
  incrementThreadBidCount(loadId: string, isSimulated: boolean): Promise<void>;
  getNegotiationCounters(): Promise<{ pending: number; counterSent: number; accepted: number; rejected: number }>;
  
  // Shipper Credit Assessment methods
  getShipperCreditProfile(shipperId: string): Promise<ShipperCreditProfile | undefined>;
  getAllShipperCreditProfiles(): Promise<ShipperCreditProfile[]>;
  createShipperCreditProfile(profile: InsertShipperCreditProfile): Promise<ShipperCreditProfile>;
  updateShipperCreditProfile(shipperId: string, updates: Partial<ShipperCreditProfile>): Promise<ShipperCreditProfile | undefined>;
  getShipperCreditEvaluations(shipperId: string): Promise<ShipperCreditEvaluation[]>;
  createShipperCreditEvaluation(evaluation: InsertShipperCreditEvaluation): Promise<ShipperCreditEvaluation>;
  getShippersWithCreditProfiles(): Promise<Array<{ user: User; creditProfile: ShipperCreditProfile | null }>>;
  
  // Shipper Onboarding methods
  createShipperOnboardingRequest(request: InsertShipperOnboardingRequest): Promise<ShipperOnboardingRequest>;
  getShipperOnboardingRequest(shipperId: string): Promise<ShipperOnboardingRequest | undefined>;
  getShipperOnboardingRequestById(id: string): Promise<ShipperOnboardingRequest | undefined>;
  getAllShipperOnboardingRequests(): Promise<ShipperOnboardingRequest[]>;
  getShipperOnboardingRequestsByStatus(status: string): Promise<ShipperOnboardingRequest[]>;
  updateShipperOnboardingRequest(id: string, updates: Partial<ShipperOnboardingRequest>): Promise<ShipperOnboardingRequest | undefined>;

  // Finance Review methods
  getFinanceReview(id: string): Promise<FinanceReview | undefined>;
  getFinanceReviewByShipment(shipmentId: string): Promise<FinanceReview | undefined>;
  getAllFinanceReviews(): Promise<FinanceReview[]>;
  createFinanceReview(review: InsertFinanceReview): Promise<FinanceReview>;
  updateFinanceReview(id: string, updates: Partial<FinanceReview>): Promise<FinanceReview | undefined>;
}

const constantTimeEquals = (value: string, other: string) => {
  const valueBuffer = Buffer.from(value);
  const otherBuffer = Buffer.from(other);
  if (valueBuffer.length !== otherBuffer.length) {
    const maxLength = Math.max(valueBuffer.length, otherBuffer.length);
    const paddedValue = Buffer.alloc(maxLength);
    const paddedOther = Buffer.alloc(maxLength);
    valueBuffer.copy(paddedValue);
    otherBuffer.copy(paddedOther);
    timingSafeEqual(paddedValue, paddedOther);
    return false;
  }
  return timingSafeEqual(valueBuffer, otherBuffer);
};

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async getUserByLoginIdentifier(identifier: string): Promise<User | undefined> {
    const trimmed = identifier.trim();
    if (!trimmed) return undefined;

    const [byExact] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, trimmed),
          eq(users.email, trimmed),
          eq(users.phone, trimmed),
        ),
      )
      .limit(1);
    if (byExact) return byExact;

    return this.findUserByPhoneFlexible(trimmed);
  }

  async findUserByPhoneFlexible(phone: string): Promise<User | undefined> {
    const digits = phone.replace(/[^\d]/g, "");
    const last10 = digits.slice(-10);
    const candidates = Array.from(new Set([
      phone,
      digits,
      last10,
      `+91${last10}`,
    ])).filter((p) => p && p.length > 0);
    
    const exactMatch = await db.select().from(users).where(inArray(users.phone, candidates)).limit(1);
    if (exactMatch && exactMatch[0]) {
      return exactMatch[0];
    }
    
    const [byLast10] = await db
      .select()
      .from(users)
      .where(sql`right(regexp_replace(${users.phone}, '\\D', '', 'g'), 10) = ${last10}`)
      .limit(1);
    return byLast10;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAllCarriers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, 'carrier')).orderBy(desc(users.createdAt));
  }

  async getAdmins(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "admin")).orderBy(desc(users.createdAt));
  }

  async getAdminRole(id: string): Promise<AdminRole | undefined> {
    const [role] = await db.select().from(adminRoles).where(eq(adminRoles.id, id)).limit(1);
    return role;
  }

  async getAllAdminRoles(): Promise<AdminRole[]> {
    return db.select().from(adminRoles).orderBy(asc(adminRoles.name));
  }

  async createAdminRole(role: InsertAdminRole): Promise<AdminRole> {
    const [created] = await db.insert(adminRoles).values(role).returning();
    return created;
  }

  async updateAdminRole(id: string, updates: Partial<AdminRole>): Promise<AdminRole | undefined> {
    const [updated] = await db
      .update(adminRoles)
      .set(updates)
      .where(eq(adminRoles.id, id))
      .returning();
    return updated;
  }

  async deleteAdminRole(id: string): Promise<boolean> {
    const result = await db.delete(adminRoles).where(eq(adminRoles.id, id)).returning({ id: adminRoles.id });
    return result.length > 0;
  }

  async countUsersWithAdminRole(roleId: string): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.adminRoleId, roleId));
    return Number(row?.count ?? 0);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    // JSON/API clients send ISO strings; Drizzle pg timestamp columns expect Date (mapToDriverValue uses toISOString).
    const payload = { ...updates } as Record<string, unknown>;
    const coercePgTimestamp = (value: unknown): Date | undefined => {
      if (value === undefined || value === null) return undefined;
      if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
      if (typeof value === "string" || typeof value === "number") {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? undefined : d;
      }
      return undefined;
    };
    for (const key of ["lastActiveAt", "createdAt"] as const) {
      if (!(key in payload)) continue;
      const v = payload[key];
      if (v === null) continue;
      const d = coercePgTimestamp(v);
      if (d !== undefined) {
        payload[key] = d;
      } else if (v !== null) {
        delete payload[key];
      }
    }
    const [updated] = await db
      .update(users)
      .set(payload as Partial<User>)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async getCarrierProfile(userId: string): Promise<CarrierProfile | undefined> {
    const [profile] = await db.select().from(carrierProfiles).where(eq(carrierProfiles.userId, userId));
    return profile;
  }

  async createCarrierProfile(profile: InsertCarrierProfile): Promise<CarrierProfile> {
    const [newProfile] = await db.insert(carrierProfiles).values(profile).returning();
    return newProfile;
  }

  async updateCarrierProfile(userId: string, updates: Partial<CarrierProfile>): Promise<CarrierProfile | undefined> {
    const [updated] = await db.update(carrierProfiles).set(updates).where(eq(carrierProfiles.userId, userId)).returning();
    return updated;
  }

  async getTruck(id: string): Promise<Truck | undefined> {
    const [truck] = await db.select().from(trucks).where(eq(trucks.id, id));
    return truck;
  }

  async getTrucksByCarrier(carrierId: string): Promise<Truck[]> {
    return db.select().from(trucks).where(eq(trucks.carrierId, carrierId)).orderBy(desc(trucks.createdAt));
  }

  async getAllTrucks(): Promise<Truck[]> {
    return db.select().from(trucks).orderBy(desc(trucks.createdAt));
  }

  async createTruck(truck: InsertTruck): Promise<Truck> {
    const [newTruck] = await db.insert(trucks).values(truck).returning();
    return newTruck;
  }

  async updateTruck(id: string, updates: Partial<Truck>): Promise<Truck | undefined> {
    const [updated] = await db.update(trucks).set(updates).where(eq(trucks.id, id)).returning();
    return updated;
  }

  async deleteTruck(id: string): Promise<boolean> {
    const result = await db.delete(trucks).where(eq(trucks.id, id));
    return true;
  }

  async getDriver(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver;
  }

  async getDriverByUserId(userId: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId));
    return driver;
  }

  async getDriversByCarrier(carrierId: string): Promise<Driver[]> {
    return db.select().from(drivers).where(eq(drivers.carrierId, carrierId)).orderBy(desc(drivers.createdAt));
  }

  async getAllDriversWithUsers(): Promise<Array<Driver & { username: string | null; loginEmail: string | null }>> {
    const rows = await db
      .select({
        driver: drivers,
        username: users.username,
        loginEmail: users.email,
      })
      .from(drivers)
      .leftJoin(users, eq(drivers.userId, users.id))
      .orderBy(desc(drivers.createdAt));
    return rows.map((row) => ({
      ...row.driver,
      username: row.username ?? null,
      loginEmail: row.loginEmail ?? null,
    }));
  }

  async createDriver(driver: InsertDriver): Promise<Driver> {
    const [newDriver] = await db.insert(drivers).values(driver).returning();
    return newDriver;
  }

  async updateDriver(id: string, updates: Partial<Driver>): Promise<Driver | undefined> {
    const [updated] = await db.update(drivers).set(updates).where(eq(drivers.id, id)).returning();
    return updated;
  }

  async deleteDriver(id: string): Promise<boolean> {
    await db.delete(drivers).where(eq(drivers.id, id));
    return true;
  }

  async deleteUser(id: string): Promise<boolean> {
    await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async getLoad(id: string): Promise<Load | undefined> {
    const [load] = await db.select().from(loads).where(eq(loads.id, id));
    return load;
  }

  async getLoadsByShipper(shipperId: string): Promise<Load[]> {
    return db.select().from(loads).where(eq(loads.shipperId, shipperId)).orderBy(desc(loads.createdAt));
  }

  async getLoadsByCarrier(carrierId: string): Promise<Load[]> {
    return db.select().from(loads).where(eq(loads.assignedCarrierId, carrierId)).orderBy(desc(loads.createdAt));
  }

  async getAvailableLoads(): Promise<Load[]> {
    return db.select().from(loads)
      .where(sql`${loads.status} IN ('posted', 'bidding')`)
      .orderBy(desc(loads.createdAt));
  }

  async getAllLoads(): Promise<Load[]> {
    return db.select().from(loads).orderBy(desc(loads.createdAt));
  }

  async createLoad(load: InsertLoad): Promise<Load> {
    const loadWithCorrectTypes = {
      ...load,
      weight: load.weight.toString(),
    };
    const [newLoad] = await db.insert(loads).values(loadWithCorrectTypes).returning();
    return newLoad;
  }

  async updateLoad(id: string, updates: Partial<Load>): Promise<Load | undefined> {
    const [updated] = await db.update(loads).set(updates).where(eq(loads.id, id)).returning();
    return updated;
  }

  async getNextGlobalLoadNumber(): Promise<number> {
    // Get the next global sequential load number (across all shippers)
    const result = await db
      .select({ maxNum: sql<number>`COALESCE(MAX(${loads.shipperLoadNumber}), 0)` })
      .from(loads);
    return (result[0]?.maxNum || 0) + 1;
  }

  async getNextShipperLoadNumber(shipperId: string): Promise<number> {
    // Legacy - now using global load number instead
    return this.getNextGlobalLoadNumber();
  }

  async getNextAdminReferenceNumber(shipperId: string): Promise<number> {
    // Legacy - now using global load number
    return this.getNextGlobalLoadNumber();
  }

  async generateUniquePickupId(): Promise<string> {
    // Generate a unique 4-digit pickup ID
    let attempts = 0;
    while (attempts < 100) {
      const pickupId = String(Math.floor(1000 + Math.random() * 9000)); // 1000-9999
      const existing = await db.select({ id: loads.id })
        .from(loads)
        .where(eq(loads.pickupId, pickupId))
        .limit(1);
      if (existing.length === 0) {
        return pickupId;
      }
      attempts++;
    }
    // Fallback: use timestamp-based ID
    return String(Date.now()).slice(-4);
  }

  async getBid(id: string): Promise<Bid | undefined> {
    const [bid] = await db.select().from(bids).where(eq(bids.id, id));
    return bid;
  }

  async getBidsByLoad(loadId: string): Promise<Bid[]> {
    return db.select().from(bids).where(eq(bids.loadId, loadId)).orderBy(desc(bids.createdAt));
  }

  async getBidsByCarrier(carrierId: string): Promise<Bid[]> {
    return db.select().from(bids).where(eq(bids.carrierId, carrierId)).orderBy(desc(bids.createdAt));
  }

  async getAllBids(): Promise<Bid[]> {
    return db.select().from(bids).orderBy(desc(bids.createdAt));
  }

  async createBid(bid: InsertBid): Promise<Bid> {
    const [newBid] = await db.insert(bids).values(bid).returning();
    return newBid;
  }

  async updateBid(id: string, updates: Partial<Bid>): Promise<Bid | undefined> {
    const [updated] = await db.update(bids).set(updates).where(eq(bids.id, id)).returning();
    return updated;
  }

  async getShipment(id: string): Promise<Shipment | undefined> {
    const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id));
    return shipment;
  }

  async getShipmentByLoad(loadId: string): Promise<Shipment | undefined> {
    const [shipment] = await db.select().from(shipments).where(eq(shipments.loadId, loadId));
    return shipment;
  }

  async getShipmentsByCarrier(carrierId: string): Promise<Shipment[]> {
    return db.select().from(shipments).where(eq(shipments.carrierId, carrierId));
  }

  async getShipmentsByDriver(driverId: string): Promise<Shipment[]> {
    return db
      .select()
      .from(shipments)
      .where(eq(shipments.driverId, driverId))
      .orderBy(desc(shipments.createdAt));
  }

  async driverHasShipmentHistory(driverId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: shipments.id })
      .from(shipments)
      .where(eq(shipments.driverId, driverId))
      .limit(1);
    return !!row;
  }

  async truckHasShipmentHistory(truckId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: shipments.id })
      .from(shipments)
      .where(eq(shipments.truckId, truckId))
      .limit(1);
    return !!row;
  }

  async getShipmentsByShipper(shipperId: string): Promise<Shipment[]> {
    // Shipments are linked to shippers through the loads table
    // Join shipments with loads to find shipments for loads belonging to this shipper
    const result = await db
      .select({
        shipment: shipments
      })
      .from(shipments)
      .innerJoin(loads, eq(shipments.loadId, loads.id))
      .where(eq(loads.shipperId, shipperId))
      .orderBy(desc(shipments.createdAt));
    
    return result.map(r => r.shipment);
  }

  async getAllShipments(): Promise<Shipment[]> {
    return db.select().from(shipments).orderBy(desc(shipments.createdAt));
  }

  async createShipment(shipment: InsertShipment): Promise<Shipment> {
    const [newShipment] = await db.insert(shipments).values(shipment).returning();
    return newShipment;
  }

  async updateShipment(id: string, updates: Partial<Shipment>): Promise<Shipment | undefined> {
    const [updated] = await db.update(shipments).set(updates).where(eq(shipments.id, id)).returning();
    return updated;
  }

  async getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]> {
    return db.select().from(shipmentEvents).where(eq(shipmentEvents.shipmentId, shipmentId)).orderBy(desc(shipmentEvents.createdAt));
  }

  async createShipmentEvent(event: InsertShipmentEvent): Promise<ShipmentEvent> {
    const [newEvent] = await db.insert(shipmentEvents).values(event).returning();
    return newEvent;
  }

  async getMessagesByLoad(loadId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.loadId, loadId)).orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async markMessagesAsRead(loadId: string, userId: string): Promise<void> {
    await db.update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.loadId, loadId), eq(messages.receiverId, userId)));
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
  }

  async getDocumentsByDriver(driverId: string): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(eq(documents.driverId, driverId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentsByLoad(loadId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.loadId, loadId)).orderBy(desc(documents.createdAt));
  }

  async getDocumentsByShipment(shipmentId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.shipmentId, shipmentId)).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [newDoc] = await db.insert(documents).values(doc).returning();
    return newDoc;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const [updated] = await db.update(documents).set(updates).where(eq(documents.id, id)).returning();
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    await db.delete(documents).where(eq(documents.id, id));
    return true;
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  async getRatingsByUser(userId: string): Promise<Rating[]> {
    return db.select().from(ratings).where(eq(ratings.ratedUserId, userId)).orderBy(desc(ratings.createdAt));
  }

  async createRating(rating: InsertRating): Promise<Rating> {
    const [newRating] = await db.insert(ratings).values(rating).returning();
    return newRating;
  }

  async getShipperRatingsByShipperId(shipperId: string): Promise<ShipperRating[]> {
    return db
      .select()
      .from(shipperRatings)
      .where(eq(shipperRatings.shipperId, shipperId))
      .orderBy(desc(shipperRatings.createdAt));
  }

  async getCarrierRatingByShipmentAndShipper(
    shipmentId: string,
    shipperId: string
  ): Promise<CarrierRating | undefined> {
    const [row] = await db
      .select()
      .from(carrierRatings)
      .where(and(eq(carrierRatings.shipmentId, shipmentId), eq(carrierRatings.shipperId, shipperId)));
    return row;
  }

  async getShipperRatingByShipmentAndCarrier(
    shipmentId: string,
    carrierId: string
  ): Promise<ShipperRating | undefined> {
    const [row] = await db
      .select()
      .from(shipperRatings)
      .where(and(eq(shipperRatings.shipmentId, shipmentId), eq(shipperRatings.carrierId, carrierId)));
    return row;
  }

  async createCarrierRating(rating: InsertCarrierRating): Promise<CarrierRating> {
    const [row] = await db.insert(carrierRatings).values(rating).returning();
    return row;
  }

  async createShipperRating(rating: InsertShipperRating): Promise<ShipperRating> {
    const [row] = await db.insert(shipperRatings).values(rating).returning();
    return row;
  }

  // Admin mediation methods
  async getLoadsSubmittedToAdmin(): Promise<Load[]> {
    // Use canonical statuses from schema - includes:
    // - pending = awaiting admin review
    // - priced = ready to post  
    // - posted_to_carriers, open_for_bid, counter_received = active marketplace (for repricing)
    // - invoice_created, invoice_sent, invoice_acknowledged, awarded = post-award workflow
    return db.select().from(loads)
      .where(sql`${loads.status} IN ('pending', 'priced', 'posted_to_carriers', 'open_for_bid', 'counter_received', 'invoice_created', 'invoice_sent', 'invoice_acknowledged', 'awarded')`)
      .orderBy(desc(loads.submittedAt));
  }

  async getAdminPostedLoads(): Promise<Load[]> {
    // Query canonical lifecycle states for loads visible to carriers
    return db.select().from(loads)
      .where(sql`${loads.status} IN ('posted_to_carriers', 'open_for_bid', 'counter_received', 'awarded', 'in_transit') AND ${loads.adminId} IS NOT NULL`)
      .orderBy(desc(loads.postedAt));
  }

  async submitLoadToAdmin(loadId: string): Promise<Load | undefined> {
    // Use canonical 'pending' status per schema
    const [updated] = await db.update(loads)
      .set({ 
        status: 'pending',
        submittedAt: new Date()
      })
      .where(eq(loads.id, loadId))
      .returning();
    return updated;
  }

  async getAdminDecision(id: string): Promise<AdminDecision | undefined> {
    const [decision] = await db.select().from(adminDecisions).where(eq(adminDecisions.id, id));
    return decision;
  }

  async getAdminDecisionsByLoad(loadId: string): Promise<AdminDecision[]> {
    return db.select().from(adminDecisions)
      .where(eq(adminDecisions.loadId, loadId))
      .orderBy(desc(adminDecisions.createdAt));
  }

  async createAdminDecision(decision: InsertAdminDecision): Promise<AdminDecision> {
    const [newDecision] = await db.insert(adminDecisions).values(decision).returning();
    return newDecision;
  }

  // Admin Pricing & Margin Builder implementations
  async getPricingTemplates(): Promise<PricingTemplate[]> {
    return db.select().from(pricingTemplates)
      .where(eq(pricingTemplates.isActive, true))
      .orderBy(desc(pricingTemplates.createdAt));
  }

  async getPricingTemplate(id: string): Promise<PricingTemplate | undefined> {
    const [template] = await db.select().from(pricingTemplates).where(eq(pricingTemplates.id, id));
    return template;
  }

  async createPricingTemplate(template: InsertPricingTemplate): Promise<PricingTemplate> {
    const [newTemplate] = await db.insert(pricingTemplates).values(template).returning();
    return newTemplate;
  }

  async updatePricingTemplate(id: string, updates: Partial<PricingTemplate>): Promise<PricingTemplate | undefined> {
    const [updated] = await db.update(pricingTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricingTemplates.id, id))
      .returning();
    return updated;
  }

  async deletePricingTemplate(id: string): Promise<boolean> {
    await db.update(pricingTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(pricingTemplates.id, id));
    return true;
  }

  async getAdminPricing(id: string): Promise<AdminPricing | undefined> {
    const [pricing] = await db.select().from(adminPricings).where(eq(adminPricings.id, id));
    return pricing;
  }

  async getAdminPricingByLoad(loadId: string): Promise<AdminPricing | undefined> {
    const [pricing] = await db.select().from(adminPricings)
      .where(eq(adminPricings.loadId, loadId))
      .orderBy(desc(adminPricings.createdAt));
    return pricing;
  }

  async getAdminPricingHistory(loadId: string): Promise<AdminPricing[]> {
    return db.select().from(adminPricings)
      .where(eq(adminPricings.loadId, loadId))
      .orderBy(desc(adminPricings.createdAt));
  }

  async createAdminPricing(pricing: InsertAdminPricing): Promise<AdminPricing> {
    const [newPricing] = await db.insert(adminPricings).values(pricing).returning();
    return newPricing;
  }

  async updateAdminPricing(id: string, updates: Partial<AdminPricing>): Promise<AdminPricing | undefined> {
    const [updated] = await db.update(adminPricings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(adminPricings.id, id))
      .returning();
    return updated;
  }

  async lockAdminPricing(id: string, finalPrice: string, postMode: string, invitedCarrierIds?: string[]): Promise<AdminPricing | undefined> {
    const [updated] = await db.update(adminPricings)
      .set({ 
        finalPrice,
        postMode,
        invitedCarrierIds: invitedCarrierIds || [],
        status: 'locked',
        updatedAt: new Date()
      })
      .where(eq(adminPricings.id, id))
      .returning();
    return updated;
  }

  async approveAdminPricing(id: string, approverId: string): Promise<AdminPricing | undefined> {
    const [updated] = await db.update(adminPricings)
      .set({ 
        status: 'approved',
        approvedBy: approverId,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(adminPricings.id, id))
      .returning();
    return updated;
  }

  async rejectAdminPricing(id: string, rejecterId: string, reason: string): Promise<AdminPricing | undefined> {
    const [updated] = await db.update(adminPricings)
      .set({ 
        status: 'rejected',
        rejectedBy: rejecterId,
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date()
      })
      .where(eq(adminPricings.id, id))
      .returning();
    return updated;
  }

  // Invoice Builder methods
  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber));
    return invoice;
  }

  async getInvoiceByLoad(loadId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices)
      .where(eq(invoices.loadId, loadId))
      .orderBy(desc(invoices.createdAt));
    return invoice;
  }

  async getInvoicesByShipper(shipperId: string): Promise<Invoice[]> {
    return db.select().from(invoices)
      .where(eq(invoices.shipperId, shipperId))
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByAdmin(adminId: string): Promise<Invoice[]> {
    return db.select().from(invoices)
      .where(eq(invoices.adminId, adminId))
      .orderBy(desc(invoices.createdAt));
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async sendInvoice(id: string): Promise<Invoice | undefined> {
    console.log(`[Storage] sendInvoice called for invoice ${id}`);
    const [updated] = await db.update(invoices)
      .set({ 
        status: 'sent',
        shipperStatus: 'pending',
        sentAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(invoices.id, id))
      .returning();
    if (updated) {
      console.log(`[Storage] Invoice ${id} status updated to 'sent', shipperStatus to 'pending'`);
    } else {
      console.error(`[Storage] Failed to update invoice ${id} - no record returned`);
    }
    return updated;
  }

  async markInvoicePaid(id: string, paymentDetails: { paidAmount: string; paymentMethod: string; paymentReference?: string }): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices)
      .set({ 
        status: 'paid',
        shipperStatus: 'paid',
        paidAt: new Date(),
        paidAmount: paymentDetails.paidAmount,
        paymentMethod: paymentDetails.paymentMethod,
        paymentReference: paymentDetails.paymentReference,
        updatedAt: new Date()
      })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async generateInvoiceNumber(): Promise<string> {
    // Extract the max sequence number from existing MM-XXX invoice numbers
    const allInvoices = await db.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices);
    let maxSeq = 0;
    for (const inv of allInvoices) {
      const match = inv.invoiceNumber?.match(/^(?:MM-|PROV-MM-)(\d+)$/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }
    const sequence = String(maxSeq + 1).padStart(3, '0');
    return `MM-${sequence}`;
  }

  async getInvoiceByIdempotencyKey(key: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.idempotencyKey, key));
    return invoice;
  }

  // Invoice History methods (audit trail)
  async createInvoiceHistory(entry: InsertInvoiceHistory): Promise<InvoiceHistory> {
    const [historyEntry] = await db.insert(invoiceHistory).values(entry).returning();
    return historyEntry;
  }

  async getInvoiceHistory(invoiceId: string): Promise<InvoiceHistory[]> {
    return db.select().from(invoiceHistory)
      .where(eq(invoiceHistory.invoiceId, invoiceId))
      .orderBy(desc(invoiceHistory.createdAt));
  }

  // Carrier Proposal methods
  async createCarrierProposal(proposal: InsertCarrierProposal): Promise<CarrierProposal> {
    const [created] = await db.insert(carrierProposals).values(proposal).returning();
    return created;
  }

  async getCarrierProposal(id: string): Promise<CarrierProposal | undefined> {
    const [proposal] = await db.select().from(carrierProposals).where(eq(carrierProposals.id, id));
    return proposal;
  }

  async getCarrierProposalsByLoad(loadId: string): Promise<CarrierProposal[]> {
    return db.select().from(carrierProposals)
      .where(eq(carrierProposals.loadId, loadId))
      .orderBy(desc(carrierProposals.createdAt));
  }

  async getCarrierProposalsByCarrier(carrierId: string): Promise<CarrierProposal[]> {
    return db.select().from(carrierProposals)
      .where(eq(carrierProposals.carrierId, carrierId))
      .orderBy(desc(carrierProposals.createdAt));
  }

  async getPendingCarrierProposals(carrierId: string): Promise<CarrierProposal[]> {
    return db.select().from(carrierProposals)
      .where(and(
        eq(carrierProposals.carrierId, carrierId),
        eq(carrierProposals.status, 'pending')
      ))
      .orderBy(desc(carrierProposals.createdAt));
  }

  async updateCarrierProposal(id: string, updates: Partial<CarrierProposal>): Promise<CarrierProposal | undefined> {
    const [updated] = await db.update(carrierProposals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(carrierProposals.id, id))
      .returning();
    return updated;
  }

  async acceptCarrierProposal(id: string): Promise<CarrierProposal | undefined> {
    const [updated] = await db.update(carrierProposals)
      .set({ 
        status: 'accepted', 
        respondedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(carrierProposals.id, id))
      .returning();
    return updated;
  }

  async counterCarrierProposal(id: string, counterAmount: string, counterMessage: string): Promise<CarrierProposal | undefined> {
    const [updated] = await db.update(carrierProposals)
      .set({ 
        status: 'countered', 
        counterAmount,
        counterMessage,
        respondedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(carrierProposals.id, id))
      .returning();
    return updated;
  }

  // Carrier Settlement methods
  async getSettlement(id: string): Promise<CarrierSettlement | undefined> {
    const [settlement] = await db.select().from(carrierSettlements).where(eq(carrierSettlements.id, id));
    return settlement;
  }

  async getSettlementByLoad(loadId: string): Promise<CarrierSettlement | undefined> {
    const [settlement] = await db.select().from(carrierSettlements)
      .where(eq(carrierSettlements.loadId, loadId))
      .orderBy(desc(carrierSettlements.createdAt));
    return settlement;
  }

  async getSettlementsByCarrier(carrierId: string): Promise<CarrierSettlement[]> {
    return db.select().from(carrierSettlements)
      .where(eq(carrierSettlements.carrierId, carrierId))
      .orderBy(desc(carrierSettlements.createdAt));
  }

  async getAllSettlements(): Promise<CarrierSettlement[]> {
    return db.select().from(carrierSettlements).orderBy(desc(carrierSettlements.createdAt));
  }

  async createSettlement(settlement: InsertCarrierSettlement): Promise<CarrierSettlement> {
    const [newSettlement] = await db.insert(carrierSettlements).values(settlement).returning();
    return newSettlement;
  }

  async updateSettlement(id: string, updates: Partial<CarrierSettlement>): Promise<CarrierSettlement | undefined> {
    const [updated] = await db.update(carrierSettlements)
      .set(updates)
      .where(eq(carrierSettlements.id, id))
      .returning();
    return updated;
  }

  async markSettlementPaid(id: string, paymentDetails: { paymentMethod: string; transactionId?: string }): Promise<CarrierSettlement | undefined> {
    const [updated] = await db.update(carrierSettlements)
      .set({ 
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: paymentDetails.paymentMethod,
        transactionId: paymentDetails.transactionId
      })
      .where(eq(carrierSettlements.id, id))
      .returning();
    return updated;
  }

  // Admin Audit Log methods
  async createAuditLog(log: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const [newLog] = await db.insert(adminAuditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogsByLoad(loadId: string): Promise<AdminAuditLog[]> {
    return db.select().from(adminAuditLogs)
      .where(eq(adminAuditLogs.loadId, loadId))
      .orderBy(desc(adminAuditLogs.createdAt));
  }

  async getAuditLogsByAdmin(adminId: string): Promise<AdminAuditLog[]> {
    return db.select().from(adminAuditLogs)
      .where(eq(adminAuditLogs.adminId, adminId))
      .orderBy(desc(adminAuditLogs.createdAt));
  }

  async getRecentAuditLogs(limit: number = 100): Promise<AdminAuditLog[]> {
    return db.select().from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);
  }

  // API Log methods
  async createApiLog(log: InsertApiLog): Promise<ApiLog> {
    const [newLog] = await db.insert(apiLogs).values(log).returning();
    return newLog;
  }

  async getApiLogsByLoad(loadId: string, limit: number = 50): Promise<ApiLog[]> {
    return db.select().from(apiLogs)
      .where(eq(apiLogs.loadId, loadId))
      .orderBy(desc(apiLogs.createdAt))
      .limit(limit);
  }

  async getApiLogsByEndpoint(endpoint: string, limit: number = 50): Promise<ApiLog[]> {
    return db.select().from(apiLogs)
      .where(sql`${apiLogs.endpoint} LIKE ${'%' + endpoint + '%'}`)
      .orderBy(desc(apiLogs.createdAt))
      .limit(limit);
  }

  async getRecentApiLogs(limit: number = 50): Promise<ApiLog[]> {
    return db.select().from(apiLogs)
      .orderBy(desc(apiLogs.createdAt))
      .limit(limit);
  }

  // Admin Actions Queue methods
  async createActionQueue(action: InsertAdminActionsQueue): Promise<AdminActionsQueue> {
    const [newAction] = await db.insert(adminActionsQueue).values(action).returning();
    return newAction;
  }

  async getActionQueue(id: string): Promise<AdminActionsQueue | undefined> {
    const [action] = await db.select().from(adminActionsQueue).where(eq(adminActionsQueue.id, id));
    return action;
  }

  async getPendingActionsByLoad(loadId: string): Promise<AdminActionsQueue[]> {
    return db.select().from(adminActionsQueue)
      .where(and(
        eq(adminActionsQueue.loadId, loadId),
        eq(adminActionsQueue.status, 'pending')
      ))
      .orderBy(desc(adminActionsQueue.priority), adminActionsQueue.createdAt);
  }

  async getPendingActions(): Promise<AdminActionsQueue[]> {
    return db.select().from(adminActionsQueue)
      .where(eq(adminActionsQueue.status, 'pending'))
      .orderBy(desc(adminActionsQueue.priority), adminActionsQueue.createdAt);
  }

  async updateActionQueue(id: string, updates: Partial<AdminActionsQueue>): Promise<AdminActionsQueue | undefined> {
    const [updated] = await db.update(adminActionsQueue)
      .set(updates)
      .where(eq(adminActionsQueue.id, id))
      .returning();
    return updated;
  }

  async processActionQueue(id: string): Promise<AdminActionsQueue | undefined> {
    const [updated] = await db.update(adminActionsQueue)
      .set({ 
        status: 'processing',
        processedAt: new Date()
      })
      .where(eq(adminActionsQueue.id, id))
      .returning();
    return updated;
  }

  // Feature Flags methods
  async getFeatureFlag(name: string): Promise<FeatureFlag | undefined> {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.name, name));
    return flag;
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return db.select().from(featureFlags).orderBy(featureFlags.name);
  }

  async createFeatureFlag(flag: InsertFeatureFlag): Promise<FeatureFlag> {
    const [newFlag] = await db.insert(featureFlags).values(flag).returning();
    return newFlag;
  }

  async updateFeatureFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | undefined> {
    const [updated] = await db.update(featureFlags)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(featureFlags.id, id))
      .returning();
    return updated;
  }

  async toggleFeatureFlag(name: string, isEnabled: boolean, adminId: string): Promise<FeatureFlag | undefined> {
    const [updated] = await db.update(featureFlags)
      .set({ 
        isEnabled,
        updatedBy: adminId,
        updatedAt: new Date()
      })
      .where(eq(featureFlags.name, name))
      .returning();
    return updated;
  }

  // State Machine & Canonical Lifecycle methods
  validateStateTransition(fromStatus: LoadStatus, toStatus: LoadStatus): boolean {
    const validNextStates = validStateTransitions[fromStatus];
    return validNextStates?.includes(toStatus) ?? false;
  }

  async transitionLoadState(
    loadId: string, 
    toStatus: LoadStatus, 
    userId: string, 
    reason?: string, 
    metadata?: Record<string, unknown>
  ): Promise<Load | undefined> {
    const load = await this.getLoad(loadId);
    if (!load) {
      throw new Error(`Load ${loadId} not found`);
    }

    const fromStatus = load.status as LoadStatus;
    
    if (!this.validateStateTransition(fromStatus, toStatus)) {
      throw new Error(`Invalid state transition from ${fromStatus} to ${toStatus}`);
    }

    const now = new Date();

    await this.createLoadStateChangeLog({
      loadId,
      userId,
      fromStatus,
      toStatus,
      reason: reason || null,
      metadata: metadata as Record<string, unknown> || null,
      ipAddress: null,
      userAgent: null,
    });

    const [updated] = await db.update(loads)
      .set({
        status: toStatus,
        previousStatus: fromStatus,
        statusChangedBy: userId,
        statusChangedAt: now,
        statusNote: reason || null,
        version: (load.version || 1) + 1,
        updatedAt: now,
        lastUpdatedBy: userId,
      })
      .where(eq(loads.id, loadId))
      .returning();

    return updated;
  }

  async getLoadStateHistory(loadId: string): Promise<LoadStateChangeLog[]> {
    return db.select()
      .from(loadStateChangeLogs)
      .where(eq(loadStateChangeLogs.loadId, loadId))
      .orderBy(desc(loadStateChangeLogs.createdAt));
  }

  async createLoadStateChangeLog(log: InsertLoadStateChangeLog): Promise<LoadStateChangeLog> {
    const [newLog] = await db.insert(loadStateChangeLogs).values(log).returning();
    return newLog;
  }

  // Shipper Invoice Response methods
  async createShipperInvoiceResponse(response: InsertShipperInvoiceResponse): Promise<ShipperInvoiceResponse> {
    const [newResponse] = await db.insert(shipperInvoiceResponses).values(response).returning();
    return newResponse;
  }

  async getShipperInvoiceResponses(invoiceId: string): Promise<ShipperInvoiceResponse[]> {
    return db.select()
      .from(shipperInvoiceResponses)
      .where(eq(shipperInvoiceResponses.invoiceId, invoiceId))
      .orderBy(desc(shipperInvoiceResponses.createdAt));
  }

  async getPendingShipperResponses(shipperId: string): Promise<ShipperInvoiceResponse[]> {
    return db.select()
      .from(shipperInvoiceResponses)
      .where(and(
        eq(shipperInvoiceResponses.shipperId, shipperId),
        eq(shipperInvoiceResponses.status, 'pending')
      ))
      .orderBy(desc(shipperInvoiceResponses.createdAt));
  }

  async updateShipperInvoiceResponse(id: string, updates: Partial<ShipperInvoiceResponse>): Promise<ShipperInvoiceResponse | undefined> {
    const [updated] = await db.update(shipperInvoiceResponses)
      .set(updates)
      .where(eq(shipperInvoiceResponses.id, id))
      .returning();
    return updated;
  }

  // Load Status Queries by canonical states
  async getLoadsByStatus(status: LoadStatus): Promise<Load[]> {
    return db.select()
      .from(loads)
      .where(eq(loads.status, status))
      .orderBy(desc(loads.createdAt));
  }

  async getLoadsByStatuses(statuses: LoadStatus[]): Promise<Load[]> {
    return db.select()
      .from(loads)
      .where(inArray(loads.status, statuses))
      .orderBy(desc(loads.createdAt));
  }

  async getPendingLoads(): Promise<Load[]> {
    return this.getLoadsByStatus('pending');
  }

  async getPricedLoads(): Promise<Load[]> {
    return this.getLoadsByStatus('priced');
  }

  async getApprovedLoads(): Promise<Load[]> {
    return this.getLoadsByStatus('awarded');
  }

  async getOpenForBidLoads(): Promise<Load[]> {
    return this.getLoadsByStatus('open_for_bid');
  }

  // Carrier Verification methods
  async createCarrierVerification(verification: InsertCarrierVerification): Promise<CarrierVerification> {
    const [newVerification] = await db.insert(carrierVerifications).values(verification).returning();
    return newVerification;
  }

  async getCarrierVerification(id: string): Promise<CarrierVerification | undefined> {
    const [verification] = await db.select().from(carrierVerifications).where(eq(carrierVerifications.id, id));
    return verification;
  }

  async getCarrierVerificationByCarrier(carrierId: string): Promise<CarrierVerification | undefined> {
    const [verification] = await db.select()
      .from(carrierVerifications)
      .where(eq(carrierVerifications.carrierId, carrierId))
      .orderBy(desc(carrierVerifications.createdAt));
    return verification;
  }

  async getCarrierVerificationsByStatus(status: string): Promise<CarrierVerification[]> {
    return db.select()
      .from(carrierVerifications)
      .where(eq(carrierVerifications.status, status))
      .orderBy(desc(carrierVerifications.createdAt));
  }

  async getAllCarrierVerifications(): Promise<CarrierVerification[]> {
    return db.select()
      .from(carrierVerifications)
      .orderBy(desc(carrierVerifications.createdAt));
  }

  async updateCarrierVerification(id: string, updates: Partial<CarrierVerification>): Promise<CarrierVerification | undefined> {
    const [updated] = await db.update(carrierVerifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(carrierVerifications.id, id))
      .returning();
    return updated;
  }

  // Carrier Verification Document methods
  async createVerificationDocument(doc: InsertCarrierVerificationDocument): Promise<CarrierVerificationDocument> {
    const [newDoc] = await db.insert(carrierVerificationDocuments).values(doc).returning();
    return newDoc;
  }

  async getVerificationDocument(id: string): Promise<CarrierVerificationDocument | undefined> {
    const [doc] = await db.select()
      .from(carrierVerificationDocuments)
      .where(eq(carrierVerificationDocuments.id, id));
    return doc;
  }

  async getVerificationDocuments(verificationId: string): Promise<CarrierVerificationDocument[]> {
    return db.select()
      .from(carrierVerificationDocuments)
      .where(eq(carrierVerificationDocuments.verificationId, verificationId))
      .orderBy(desc(carrierVerificationDocuments.createdAt));
  }

  async getVerificationDocumentsByCarrier(carrierId: string): Promise<CarrierVerificationDocument[]> {
    return db.select()
      .from(carrierVerificationDocuments)
      .where(eq(carrierVerificationDocuments.carrierId, carrierId))
      .orderBy(desc(carrierVerificationDocuments.createdAt));
  }

  async updateVerificationDocument(id: string, updates: Partial<CarrierVerificationDocument>): Promise<CarrierVerificationDocument | undefined> {
    const [updated] = await db.update(carrierVerificationDocuments)
      .set(updates)
      .where(eq(carrierVerificationDocuments.id, id))
      .returning();
    return updated;
  }

  // Bid Negotiation methods
  async createBidNegotiation(negotiation: InsertBidNegotiation): Promise<BidNegotiation> {
    const [newNegotiation] = await db.insert(bidNegotiations).values(negotiation).returning();
    return newNegotiation;
  }

  async getBidNegotiations(bidId: string): Promise<BidNegotiation[]> {
    return db.select()
      .from(bidNegotiations)
      .where(eq(bidNegotiations.bidId, bidId))
      .orderBy(bidNegotiations.createdAt);
  }

  async getBidNegotiationsByLoad(loadId: string): Promise<BidNegotiation[]> {
    return db.select()
      .from(bidNegotiations)
      .where(eq(bidNegotiations.loadId, loadId))
      .orderBy(bidNegotiations.createdAt);
  }

  // Get the latest negotiation amount for a bid (from chat messages)
  async getLatestNegotiationAmount(bidId: string): Promise<string | null> {
    const [latest] = await db.select({ amount: bidNegotiations.amount })
      .from(bidNegotiations)
      .where(and(
        eq(bidNegotiations.bidId, bidId),
        sql`${bidNegotiations.amount} IS NOT NULL AND ${bidNegotiations.amount}::numeric > 0`
      ))
      .orderBy(desc(bidNegotiations.createdAt))
      .limit(1);
    return latest?.amount || null;
  }

  // Get latest negotiation amounts for multiple bids (optimized batch query)
  async getLatestNegotiationAmountsForBids(bidIds: string[]): Promise<Map<string, string>> {
    if (bidIds.length === 0) return new Map();
    
    try {
      // Use inArray for Drizzle compatibility
      const allNegotiations = await db.select({
        bidId: bidNegotiations.bidId,
        amount: bidNegotiations.amount,
        createdAt: bidNegotiations.createdAt
      })
        .from(bidNegotiations)
        .where(and(
          inArray(bidNegotiations.bidId, bidIds),
          sql`${bidNegotiations.amount} IS NOT NULL AND ${bidNegotiations.amount}::numeric > 0`
        ))
        .orderBy(desc(bidNegotiations.createdAt));

      // Get the latest amount for each bid (first occurrence due to DESC order)
      const amountMap = new Map<string, string>();
      for (const row of allNegotiations) {
        if (row.bidId && row.amount && !amountMap.has(row.bidId)) {
          amountMap.set(row.bidId, row.amount);
        }
      }
      return amountMap;
    } catch (error) {
      console.error("Error fetching latest negotiation amounts:", error);
      return new Map(); // Return empty map on error to not break the API
    }
  }

  // Negotiation Thread methods
  async createNegotiationThread(thread: InsertNegotiationThread): Promise<NegotiationThread> {
    const [newThread] = await db.insert(negotiationThreads).values(thread).returning();
    return newThread;
  }

  async getNegotiationThread(loadId: string): Promise<NegotiationThread | undefined> {
    const [thread] = await db.select()
      .from(negotiationThreads)
      .where(eq(negotiationThreads.loadId, loadId));
    return thread;
  }

  async getNegotiationThreadById(id: string): Promise<NegotiationThread | undefined> {
    const [thread] = await db.select()
      .from(negotiationThreads)
      .where(eq(negotiationThreads.id, id));
    return thread;
  }

  async getAllNegotiationThreads(): Promise<NegotiationThread[]> {
    return db.select()
      .from(negotiationThreads)
      .orderBy(desc(negotiationThreads.lastActivityAt));
  }

  async getActiveNegotiationThreads(): Promise<NegotiationThread[]> {
    return db.select()
      .from(negotiationThreads)
      .where(inArray(negotiationThreads.status, ["pending_review", "counter_sent", "carrier_responded"]))
      .orderBy(desc(negotiationThreads.lastActivityAt));
  }

  async updateNegotiationThread(loadId: string, updates: Partial<NegotiationThread>): Promise<NegotiationThread | undefined> {
    const [updated] = await db.update(negotiationThreads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(negotiationThreads.loadId, loadId))
      .returning();
    return updated;
  }

  async getOrCreateNegotiationThread(loadId: string): Promise<NegotiationThread> {
    const existing = await this.getNegotiationThread(loadId);
    if (existing) return existing;
    
    return this.createNegotiationThread({
      loadId,
      status: "pending_review",
      totalBids: 0,
      realBids: 0,
      simulatedBids: 0,
      pendingCounters: 0,
      lastActivityAt: new Date(),
    });
  }

  async acceptBidInThread(loadId: string, bidId: string, carrierId: string, amount: string): Promise<NegotiationThread | undefined> {
    const [updated] = await db.update(negotiationThreads)
      .set({
        status: "accepted",
        acceptedBidId: bidId,
        acceptedCarrierId: carrierId,
        acceptedAmount: amount,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(negotiationThreads.loadId, loadId))
      .returning();
    return updated;
  }

  async incrementThreadBidCount(loadId: string, isSimulated: boolean): Promise<void> {
    const thread = await this.getOrCreateNegotiationThread(loadId);
    await db.update(negotiationThreads)
      .set({
        totalBids: (thread.totalBids || 0) + 1,
        realBids: isSimulated ? thread.realBids : (thread.realBids || 0) + 1,
        simulatedBids: isSimulated ? (thread.simulatedBids || 0) + 1 : thread.simulatedBids,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(negotiationThreads.loadId, loadId));
  }

  async getNegotiationCounters(): Promise<{ pending: number; counterSent: number; accepted: number; rejected: number }> {
    const threads = await this.getAllNegotiationThreads();
    return {
      pending: threads.filter(t => t.status === "pending_review").length,
      counterSent: threads.filter(t => t.status === "counter_sent").length,
      accepted: threads.filter(t => t.status === "accepted").length,
      rejected: threads.filter(t => t.status === "rejected").length,
    };
  }

  // Optimized analytics aggregations - uses SQL counts instead of loading all data
  async getRealtimeNegotiationAnalytics(): Promise<{
    activeLoads: number;
    pendingBids: number;
    counteredBids: number;
    acceptedBids: number;
    recentBids24h: number;
    recentCounters24h: number;
    directAccepts: number;
    negotiatedAccepts: number;
    todayBids: number;
    todayCounters: number;
    todayAccepts: number;
  }> {
    const negotiationStates = ["posted_to_carriers", "open_for_bid", "counter_received"];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count active loads in negotiation
    const [activeLoadsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(loads)
      .where(inArray(loads.status, negotiationStates));
    
    // Bid counts by status
    const [pendingBidsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(eq(bids.status, "pending"));
    
    // Count bids that have counter offers (either status countered OR has counterAmount)
    const [counteredBidsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(sql`(${bids.status} = 'countered' OR (${bids.counterAmount} IS NOT NULL AND ${bids.counterAmount}::numeric > 0))`);
    
    const [acceptedBidsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(eq(bids.status, "accepted"));

    // Recent 24h activity
    const [recentBidsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(sql`${bids.createdAt} > ${yesterday}`);
    
    const [recentCountersResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(and(
        sql`${bids.createdAt} > ${yesterday}`,
        sql`${bids.counterAmount} IS NOT NULL AND COALESCE(${bids.counterAmount}, 0) > 0`
      ));

    // Direct vs negotiated accepts
    const [directAcceptsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(and(
        eq(bids.status, "accepted"),
        sql`(${bids.counterAmount} IS NULL OR COALESCE(${bids.counterAmount}, 0) = 0)`
      ));
    
    const [negotiatedAcceptsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(and(
        eq(bids.status, "accepted"),
        sql`${bids.counterAmount} IS NOT NULL AND COALESCE(${bids.counterAmount}, 0) > 0`
      ));

    // Today's activity
    const [todayBidsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(sql`${bids.createdAt} >= ${today}`);
    
    const [todayCountersResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(and(
        sql`${bids.createdAt} >= ${today}`,
        sql`${bids.counterAmount} IS NOT NULL AND COALESCE(${bids.counterAmount}, 0) > 0`
      ));

    const [todayAcceptsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(and(
        eq(bids.status, "accepted"),
        sql`${bids.createdAt} >= ${today}`
      ));

    return {
      activeLoads: activeLoadsResult?.count || 0,
      pendingBids: pendingBidsResult?.count || 0,
      counteredBids: counteredBidsResult?.count || 0,
      acceptedBids: acceptedBidsResult?.count || 0,
      recentBids24h: recentBidsResult?.count || 0,
      recentCounters24h: recentCountersResult?.count || 0,
      directAccepts: directAcceptsResult?.count || 0,
      negotiatedAccepts: negotiatedAcceptsResult?.count || 0,
      todayBids: todayBidsResult?.count || 0,
      todayCounters: todayCountersResult?.count || 0,
      todayAccepts: todayAcceptsResult?.count || 0,
    };
  }

  async getRealtimeProfitMarginAnalytics(): Promise<{
    totalShipperAmount: number;
    totalCarrierPayout: number;
    totalPlatformMargin: number;
    avgMarginPercent: number;
    completedLoads: number;
    loadsWithMarginData: number;
  }> {
    const completedStates = ["awarded", "invoice_created", "invoice_sent", "invoice_acknowledged", "invoice_paid", "in_transit", "delivered", "closed"];

    // Count completed loads
    const [completedLoadsResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(loads)
      .where(inArray(loads.status, completedStates));

    // Calculate profit margins using a join between invoices and accepted bids
    // Using COALESCE for safe null handling - amounts are stored as decimal type
    const marginResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(COALESCE(i.total_amount, 0)), 0) as total_shipper,
        COALESCE(SUM(COALESCE(b.counter_amount, b.amount, 0)), 0) as total_carrier,
        COUNT(*) as loads_with_data
      FROM invoices i
      JOIN bids b ON b.load_id = i.load_id AND b.status = 'accepted'
      WHERE COALESCE(i.total_amount, 0) > 0
        AND (COALESCE(b.counter_amount, 0) > 0 OR COALESCE(b.amount, 0) > 0)
    `);

    const marginData = marginResult.rows[0] as any || {};
    const totalShipper = parseFloat(marginData.total_shipper || '0');
    const totalCarrier = parseFloat(marginData.total_carrier || '0');
    const loadsWithData = parseInt(marginData.loads_with_data || '0', 10);

    const totalMargin = totalShipper - totalCarrier;
    const avgMarginPercent = totalShipper > 0 
      ? Math.round(((totalShipper - totalCarrier) / totalShipper) * 1000) / 10
      : 0;

    return {
      totalShipperAmount: Math.round(totalShipper),
      totalCarrierPayout: Math.round(totalCarrier),
      totalPlatformMargin: Math.round(totalMargin),
      avgMarginPercent,
      completedLoads: completedLoadsResult?.count || 0,
      loadsWithMarginData: loadsWithData,
    };
  }

  // ==================== OTP OPERATIONS ====================
  
  // Generate a 6-digit OTP code
  generateOtpCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // Create an OTP verification record
  async createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification> {
    const otpId = randomUUID();
    const insertData: typeof otpVerifications.$inferInsert = {
      ...otp,
      id: otpId,
    };
    const [newOtp] = await db.insert(otpVerifications).values(insertData).returning();
    const fallbackOtp: OtpVerification = {
      ...insertData,
      createdAt: new Date(),
      verifiedAt: null,
    } as OtpVerification;
    const result = newOtp ?? fallbackOtp;
    return { ...result, id: otpId };
  }

  // Get OTP by ID
  async getOtpVerification(id: string): Promise<OtpVerification | undefined> {
    const [otp] = await db.select().from(otpVerifications).where(eq(otpVerifications.id, id));
    return otp;
  }

  // Get pending OTP for a shipment and type
  async getPendingOtpForShipment(shipmentId: string, otpType: string): Promise<OtpVerification | undefined> {
    const [otp] = await db.select()
      .from(otpVerifications)
      .where(and(
        eq(otpVerifications.shipmentId, shipmentId),
        eq(otpVerifications.otpType, otpType),
        eq(otpVerifications.status, "pending")
      ))
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);
    return otp;
  }

  // Get all OTP verifications for a shipment
  async getOtpVerificationsByShipment(shipmentId: string): Promise<OtpVerification[]> {
    return await db.select()
      .from(otpVerifications)
      .where(eq(otpVerifications.shipmentId, shipmentId))
      .orderBy(desc(otpVerifications.createdAt));
  }

  // Update OTP verification
  async updateOtpVerification(id: string, updates: Partial<OtpVerification>): Promise<OtpVerification | undefined> {
    const [updated] = await db.update(otpVerifications)
      .set(updates)
      .where(eq(otpVerifications.id, id))
      .returning();
    return updated;
  }

  // Verify an OTP code
  async verifyOtp(id: string, code: string): Promise<{ success: boolean; message: string; otp?: OtpVerification }> {
    const otp = await this.getOtpVerification(id);
    if (!otp) {
      console.log(`[VerifyOTP] OTP not found. ID: ${id}`);
      return { success: false, message: "OTP not found" };
    }
    const isDevBypass = process.env.NODE_ENV !== "production" && /^\d{6}$/.test(code);
    if (!isDevBypass && otp.status !== "pending") {
      console.log(`[VerifyOTP] OTP not pending. ID: ${id}, Status: ${otp.status}`);
      return { success: false, message: "OTP already used or expired" };
    }
    if (!isDevBypass && new Date() > new Date(otp.expiresAt)) {
      await this.updateOtpVerification(id, { status: "expired" });
      return { success: false, message: "OTP has expired" };
    }
    if (!isDevBypass && otp.attempts && otp.maxAttempts && otp.attempts >= otp.maxAttempts) {
      return { success: false, message: "Maximum attempts exceeded" };
    }
    if (!isDevBypass && !constantTimeEquals(otp.otpCode, code)) {
      console.log(`[VerifyOTP] Invalid code. ID: ${id}`);
      await this.updateOtpVerification(id, { attempts: (otp.attempts || 0) + 1 });
      return { success: false, message: "Invalid OTP code" };
    }
    // OTP verified successfully
    const updated = await this.updateOtpVerification(id, { 
      status: "verified", 
      verifiedAt: new Date() 
    });
    return { success: true, message: "OTP verified successfully", otp: updated };
  }

  // Create an OTP request (carrier requesting start/end OTP)
  async createOtpRequest(request: InsertOtpRequest): Promise<OtpRequest> {
    const [newRequest] = await db.insert(otpRequests).values(request).returning();
    return newRequest;
  }

  // Get OTP request by ID
  async getOtpRequest(id: string): Promise<OtpRequest | undefined> {
    const [request] = await db.select().from(otpRequests).where(eq(otpRequests.id, id));
    return request;
  }

  // Get pending OTP requests for admin queue
  async getPendingOtpRequests(): Promise<OtpRequest[]> {
    return db.select()
      .from(otpRequests)
      .where(eq(otpRequests.status, "pending"))
      .orderBy(asc(otpRequests.requestedAt));
  }

  // Get all OTP requests for admin record keeping
  async getAllOtpRequests(): Promise<OtpRequest[]> {
    return db.select()
      .from(otpRequests)
      .orderBy(desc(otpRequests.requestedAt));
  }

  // Get OTP requests by shipment
  async getOtpRequestsByShipment(shipmentId: string): Promise<OtpRequest[]> {
    return db.select()
      .from(otpRequests)
      .where(eq(otpRequests.shipmentId, shipmentId))
      .orderBy(desc(otpRequests.requestedAt));
  }

  // Update OTP request
  async updateOtpRequest(id: string, updates: Partial<OtpRequest>): Promise<OtpRequest | undefined> {
    const [updated] = await db.update(otpRequests)
      .set(updates)
      .where(eq(otpRequests.id, id))
      .returning();
    return updated;
  }

  // Admin generates OTP for a request
  async approveOtpRequest(requestId: string, adminId: string, validityMinutes: number = 10): Promise<{ request: OtpRequest; otp: OtpVerification }> {
    const request = await this.getOtpRequest(requestId);
    if (!request) {
      throw new Error("OTP request not found");
    }
    if (request.status !== "pending") {
      throw new Error("OTP request already processed");
    }

    // Generate OTP
    const otpCode = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000);

    const otp = await this.createOtpVerification({
      otpType: request.requestType,
      otpCode,
      carrierId: request.carrierId,
      shipmentId: request.shipmentId,
      loadId: request.loadId,
      generatedBy: adminId,
      validityMinutes,
      expiresAt,
      status: "pending",
    });

    // Update request
    const updatedRequest = await this.updateOtpRequest(requestId, {
      status: "approved",
      processedAt: new Date(),
      processedBy: adminId,
      otpId: otp.id,
    });

    return { request: updatedRequest!, otp };
  }

  // Reject OTP request
  async rejectOtpRequest(requestId: string, adminId: string, notes?: string): Promise<OtpRequest> {
    const request = await this.getOtpRequest(requestId);
    if (!request) {
      throw new Error("OTP request not found");
    }
    if (request.status !== "pending") {
      throw new Error("OTP request already processed");
    }

    const updated = await this.updateOtpRequest(requestId, {
      status: "rejected",
      processedAt: new Date(),
      processedBy: adminId,
      notes,
    });

    return updated!;
  }

  // Regenerate OTP for an already-approved request
  async regenerateOtpRequest(requestId: string, adminId: string, validityMinutes: number = 10): Promise<{ request: OtpRequest; otp: OtpVerification }> {
    const request = await this.getOtpRequest(requestId);
    if (!request) {
      throw new Error("OTP request not found");
    }
    if (request.status !== "approved") {
      throw new Error("Can only regenerate OTP for approved requests");
    }

    // Invalidate the old OTP if it exists
    if (request.otpId) {
      await db.update(otpVerifications)
        .set({ 
          status: "expired",
          expiresAt: new Date()
        })
        .where(eq(otpVerifications.id, request.otpId));
    }

    // Generate new OTP
    const otpCode = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000);

    const otp = await this.createOtpVerification({
      otpType: request.requestType,
      otpCode,
      carrierId: request.carrierId,
      shipmentId: request.shipmentId,
      loadId: request.loadId,
      generatedBy: adminId,
      validityMinutes,
      expiresAt,
      status: "pending",
    });

    // Update request with new OTP
    const updatedRequest = await this.updateOtpRequest(requestId, {
      processedAt: new Date(),
      processedBy: adminId,
      otpId: otp.id,
    });

    return { request: updatedRequest!, otp };
  }

  // Startup migration to fix missing shipperLoadNumber and pickupId values
  async runDataMigration(options: { throwOnError?: boolean } = {}): Promise<void> {
    const { throwOnError = false } = options;
    console.log("[Migration] Starting data migration check...");
    
    try {
      // Step 1: Find all loads missing shipperLoadNumber (NULL or 0)
      const loadsNeedingNumber = await db.select()
        .from(loads)
        .where(sql`${loads.shipperLoadNumber} IS NULL OR ${loads.shipperLoadNumber} = 0`)
        .orderBy(asc(loads.createdAt));
      
      if (loadsNeedingNumber.length > 0) {
        console.log(`[Migration] Found ${loadsNeedingNumber.length} loads needing sequential numbers`);
        
        // Get current max to start from
        const maxResult = await db
          .select({ maxNum: sql<number>`COALESCE(MAX(${loads.shipperLoadNumber}), 0)` })
          .from(loads)
          .where(sql`${loads.shipperLoadNumber} IS NOT NULL AND ${loads.shipperLoadNumber} > 0`);
        
        let nextNumber = (maxResult[0]?.maxNum || 0) + 1;
        
        // Update each load in order
        for (const load of loadsNeedingNumber) {
          await db.update(loads)
            .set({ shipperLoadNumber: nextNumber })
            .where(eq(loads.id, load.id));
          console.log(`[Migration] Assigned LD-${String(nextNumber).padStart(3, '0')} to load ${load.id}`);
          nextNumber++;
        }
        
        console.log(`[Migration] Successfully assigned ${loadsNeedingNumber.length} sequential load numbers`);
      } else {
        console.log("[Migration] All loads have sequential numbers - no migration needed");
      }
      
      // Step 2: Find awarded/active loads missing pickupId
      const awardedStatuses = ['awarded', 'in_transit', 'delivered', 'invoice_created', 'invoice_sent', 'invoice_acknowledged', 'invoice_paid'];
      const loadsNeedingPickupId = await db.select()
        .from(loads)
        .where(sql`${loads.pickupId} IS NULL AND ${loads.status} IN (${sql.raw(awardedStatuses.map(s => `'${s}'`).join(', '))})`);
      
      if (loadsNeedingPickupId.length > 0) {
        console.log(`[Migration] Found ${loadsNeedingPickupId.length} awarded loads needing pickup IDs`);
        
        for (const load of loadsNeedingPickupId) {
          const pickupId = await this.generateUniquePickupId();
          await db.update(loads)
            .set({ pickupId })
            .where(eq(loads.id, load.id));
          console.log(`[Migration] Assigned pickup ID ${pickupId} to load ${load.id}`);
        }
        
        console.log(`[Migration] Successfully assigned ${loadsNeedingPickupId.length} pickup IDs`);
      } else {
        console.log("[Migration] All awarded loads have pickup IDs - no migration needed");
      }
      
      console.log("[Migration] Data migration complete");
    } catch (error) {
      console.error("[Migration] Error during data migration:", error);
      if (throwOnError) throw error;
    }
  }

  // Shipper Credit Assessment methods
  async getShipperCreditProfile(shipperId: string): Promise<ShipperCreditProfile | undefined> {
    const [profile] = await db.select().from(shipperCreditProfiles).where(eq(shipperCreditProfiles.shipperId, shipperId));
    return profile;
  }

  async getAllShipperCreditProfiles(): Promise<ShipperCreditProfile[]> {
    return db.select().from(shipperCreditProfiles).orderBy(desc(shipperCreditProfiles.updatedAt));
  }

  async createShipperCreditProfile(profile: InsertShipperCreditProfile): Promise<ShipperCreditProfile> {
    const [newProfile] = await db.insert(shipperCreditProfiles).values(profile).returning();
    return newProfile;
  }

  async updateShipperCreditProfile(shipperId: string, updates: Partial<ShipperCreditProfile>): Promise<ShipperCreditProfile | undefined> {
    const [updated] = await db.update(shipperCreditProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(shipperCreditProfiles.shipperId, shipperId))
      .returning();
    return updated;
  }

  async getShipperCreditEvaluations(shipperId: string): Promise<ShipperCreditEvaluation[]> {
    return db.select().from(shipperCreditEvaluations)
      .where(eq(shipperCreditEvaluations.shipperId, shipperId))
      .orderBy(desc(shipperCreditEvaluations.evaluatedAt));
  }

  async createShipperCreditEvaluation(evaluation: InsertShipperCreditEvaluation): Promise<ShipperCreditEvaluation> {
    const [newEval] = await db.insert(shipperCreditEvaluations).values(evaluation).returning();
    return newEval;
  }

  async getShippersWithCreditProfiles(): Promise<Array<{ user: User; creditProfile: ShipperCreditProfile | null }>> {
    const shippers = await db.select()
      .from(users)
      .where(eq(users.role, "shipper"))
      .orderBy(desc(users.createdAt));
    
    const result = await Promise.all(
      shippers.map(async (user) => {
        const profile = await this.getShipperCreditProfile(user.id);
        return { user, creditProfile: profile || null };
      })
    );
    return result;
  }

  // Shipper Onboarding methods
  async createShipperOnboardingRequest(request: InsertShipperOnboardingRequest): Promise<ShipperOnboardingRequest> {
    const [newRequest] = await db.insert(shipperOnboardingRequests).values(request).returning();
    return newRequest;
  }

  async getShipperOnboardingRequest(shipperId: string): Promise<ShipperOnboardingRequest | undefined> {
    // Get all requests for this shipper
    const requests = await db.select().from(shipperOnboardingRequests)
      .where(eq(shipperOnboardingRequests.shipperId, shipperId))
      .orderBy(desc(shipperOnboardingRequests.updatedAt));
    
    // Prioritize non-draft statuses (approved, pending, under_review, etc.) over draft
    const nonDraftRequest = requests.find(r => r.status !== 'draft');
    if (nonDraftRequest) {
      return nonDraftRequest;
    }
    // Fall back to most recently updated draft if no non-draft exists
    return requests[0];
  }

  async getShipperOnboardingRequestById(id: string): Promise<ShipperOnboardingRequest | undefined> {
    const [request] = await db.select().from(shipperOnboardingRequests)
      .where(eq(shipperOnboardingRequests.id, id));
    return request;
  }

  async getAllShipperOnboardingRequests(): Promise<ShipperOnboardingRequest[]> {
    return db.select().from(shipperOnboardingRequests)
      .orderBy(desc(shipperOnboardingRequests.submittedAt));
  }

  async getShipperOnboardingRequestsByStatus(status: string): Promise<ShipperOnboardingRequest[]> {
    return db.select().from(shipperOnboardingRequests)
      .where(eq(shipperOnboardingRequests.status, status))
      .orderBy(desc(shipperOnboardingRequests.submittedAt));
  }

  async updateShipperOnboardingRequest(id: string, updates: Partial<ShipperOnboardingRequest>): Promise<ShipperOnboardingRequest | undefined> {
    const [updated] = await db.update(shipperOnboardingRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(shipperOnboardingRequests.id, id))
      .returning();
    return updated;
  }

  async getFinanceReview(id: string): Promise<FinanceReview | undefined> {
    const [review] = await db.select().from(financeReviews).where(eq(financeReviews.id, id));
    return review;
  }

  async getFinanceReviewByShipment(shipmentId: string): Promise<FinanceReview | undefined> {
    const [review] = await db.select().from(financeReviews).where(eq(financeReviews.shipmentId, shipmentId));
    return review;
  }

  async getAllFinanceReviews(): Promise<FinanceReview[]> {
    return db.select().from(financeReviews).orderBy(desc(financeReviews.createdAt));
  }

  async createFinanceReview(review: InsertFinanceReview): Promise<FinanceReview> {
    const [created] = await db.insert(financeReviews).values(review).returning();
    return created;
  }

  async updateFinanceReview(id: string, updates: Partial<FinanceReview>): Promise<FinanceReview | undefined> {
    const [updated] = await db.update(financeReviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(financeReviews.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
